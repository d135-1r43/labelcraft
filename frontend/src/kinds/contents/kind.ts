import type { Box as BoxRecord } from '../../db/types';
import { placeCode } from '../../engine/barcode';
import { placeBitmap } from '../../engine/bitmap';
import type { DrawOp, Issue, TextOp } from '../../engine/display';
import { CONTINUOUS_FEED_MARGIN_MM } from '../../engine/media';
import { breakParagraph, fitStack, fitText, measure, setLine, sizeForCapHeight, type Box, type StackLine, type TextStyle } from '../../engine/text';
import { typeset } from '../../engine/typeset';
import { dotsToMm, mmToPt, ptToMm, snapMm } from '../../engine/units';
import { ruleFor, streetLine } from '../address/address';
import type { KindDef, LayoutEnv } from '../types';

export interface ContentsOptions {
  /** The sender's name and address, as the owner. */
  ownerTag: boolean;
  logo: boolean;
  /** A QR code that opens the box in Labelcraft. */
  qr: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const COLUMN_MIN_MM = 24;
/** The size the list is set at when tape length is chosen to fit it. */
const LIST_COMFORT_PT = 10;
const LIST_LEADING = 1.32;

/** The link to this box in Labelcraft itself. */
export const boxLink = (appUrl: string, box: BoxRecord) => `${appUrl}/r/boxes/${encodeURIComponent(box.id)}`;

/**
 * Set the list as large as it fits: items run down as many columns as the
 * width allows, and a long item wraps onto a second line, hung behind its dash
 * so the dashes still count the items.
 */
function fitList(env: LayoutEnv, items: string[], box: Box, maxPt: number) {
  const { m, ts, locale } = env;
  const style: TextStyle = { font: ts.roles.text, optical: true };
  const gap = Math.max(3, box.w * 0.04);
  const texts = items.map((t) => typeset(t, locale));
  const maxCols = Math.max(1, Math.min(texts.length, Math.floor((box.w + gap) / (COLUMN_MIN_MM + gap))));
  const cap = m.metrics(style.font).cap;

  /** Lines per item and the column each starts in, or null if the list does not fit. */
  const arrange = (pt: number, cols: number) => {
    const size = ptToMm(pt);
    const colW = (box.w - (cols - 1) * gap) / cols;
    const indent = measure(m, '–\u2002', style, size);
    const pitch = LIST_LEADING * size;
    const placed: { col: number; lines: string[]; y: number }[] = [];
    let col = 0;
    let y = cap * size;
    for (const text of texts) {
      const lines = breakParagraph(m, text, style, size, colW - indent, { maxLines: 2, hyphenate: locale });
      if (!lines) return null;
      const h = (lines.length - 1) * size * 1.15;
      if (y + h > box.h + 1e-6 && placed.length) {
        if (++col >= cols) return null;
        y = cap * size;
      }
      if (y + h > box.h + 1e-6) return null;
      placed.push({ col, lines: lines.map((l) => l.text), y });
      y += h + pitch;
    }
    return { size, colW, indent, placed, cols: col + 1 };
  };

  let best: { pt: number; set: NonNullable<ReturnType<typeof arrange>> } | null = null;
  for (let cols = 1; cols <= maxCols; cols++) {
    let lo = Math.round(ts.minPt * 4);
    let hi = Math.round(maxPt * 4);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const set = arrange(mid / 4, cols);
      if (set) {
        if (!best || mid / 4 > best.pt + 0.25) best = { pt: mid / 4, set };
        lo = mid + 1;
      } else hi = mid - 1;
    }
  }
  let overflow = false;
  if (!best) {
    // Nothing fits even at the smallest size: set what fits there and say so.
    overflow = true;
    const size = ptToMm(ts.minPt);
    const cols = maxCols;
    const colW = (box.w - (cols - 1) * gap) / cols;
    const indent = measure(m, '–\u2002', style, size);
    const placed: { col: number; lines: string[]; y: number }[] = [];
    let col = 0;
    let y = cap * size;
    for (const text of texts) {
      if (y > box.h) {
        if (++col >= cols) break;
        y = cap * size;
      }
      placed.push({ col, lines: [text], y });
      y += LIST_LEADING * size;
    }
    best = { pt: ts.minPt, set: { size, colW, indent, placed, cols } };
  }
  const { pt, set } = best;
  const ops: TextOp[] = [];
  for (const item of set.placed) {
    const x = box.x + item.col * (set.colW + gap);
    const { width: _dw, ...dash } = setLine(m, '–', style, pt, x, box.y + item.y);
    ops.push(dash);
    item.lines.forEach((line, i) => {
      const { width: _w, ...op } = setLine(m, line, style, pt, x + set.indent, box.y + item.y + i * set.size * 1.15);
      if (op.text) ops.push(op);
    });
  }
  return { ops, sizePt: pt, overflow };
}

/** The case's name, in condensed capitals like the stencilling on a flight case. */
function header(env: LayoutEnv, b: BoxRecord, area: Box) {
  const { m, ts, locale } = env;
  const title = typeset(b.title, locale);
  if (!title) return [];
  const style: TextStyle = { font: ts.roles.display, caps: true, tracking: ts.capsTracking * 0.5, optical: true, leading: 1.02 };
  const maxPt = Math.min(72, sizeForCapHeight(m, style.font, area.h * 0.9));
  return fitText(m, { text: title, box: area, style, maxPt, minPt: ts.minPt, maxLines: 2, balance: true, hyphenate: locale, valign: 'bottom', locale }).ops;
}

/** The sender's name and address, sized to the box. */
function ownerBlock(env: LayoutEnv, area: Box, maxPt: number, align: 'left' | 'center', valign: 'top' | 'middle') {
  const { m, ts, locale, org } = env;
  const a = org.address;
  const lines: StackLine[] = [
    { text: org.name, style: { font: ts.roles.strong } },
    { text: streetLine(a), style: { font: ts.roles.text } },
    { text: ruleFor(a.country).locality(a).join(' '), style: { font: ts.roles.text } },
  ].filter((l) => l.text);
  return fitStack(m, lines, area, { maxPt, minPt: ts.minPt, leading: 1.25, align, valign: valign === 'middle' ? 'middle' : 'top', bias: 0.5, locale }).ops;
}

export const contentsKind: KindDef<BoxRecord, ContentsOptions> = {
  id: 'contents',
  name: 'Case contents',
  tagline: 'Road cases: what is inside, whose it is, a code back here',
  defaultMedia: 'DK-11202',
  media: ['DK-11202', 'DK-22205', 'DK-22212', 'DK-11209', 'DK-11208'],
  defaultTypeSystem: 'plex',
  defaultOptions: { ownerTag: true, logo: true, qr: true },
  entity: 'boxes',

  layout(b, o, env) {
    const { m, frame, ts, org, appUrl } = env;
    const ops: DrawOp[] = [];
    const issues: Issue[] = [];
    const W = frame.wMm;
    const H = frame.hMm;
    const pad = clamp(Math.min(W, H) * 0.06, 1.5, 4);
    const inner: Box = { x: pad, y: pad, w: W - 2 * pad, h: H - 2 * pad };
    const items = b.items.map((t) => t.trim()).filter(Boolean);
    const logo = o.logo ? org.logo : undefined;
    const hasOwner = o.ownerTag && !!org.name;
    const link = boxLink(appUrl, b);
    if (o.logo && !org.logo) issues.push({ id: 'contents-logo', severity: 'info', message: 'No logo uploaded', detail: 'Add one in Preferences, next to your address.' });
    let preferred: number | undefined;

    const rule = (x1: number, y1: number, x2: number, y2: number) => ops.push({ t: 'line', x1, y1, x2, y2, dots: 2, ink: 'black' });
    const qrCode = (box: Box, align: 'start' | 'center' | 'end', valign: 'start' | 'center' | 'end') => {
      const code = placeCode('qr', link, box, frame, { align, valign, maxModuleDots: 8 });
      if (code.op) ops.push(code.op);
      issues.push(...code.issues);
      return code;
    };
    const list = (box: Box, maxPt: number) => {
      if (!items.length) {
        issues.push({ id: 'contents-empty', severity: 'info', message: 'List what is in the case', detail: 'One item per line.' });
        return;
      }
      const fit = fitList(env, items, box, maxPt);
      ops.push(...fit.ops);
      if (fit.overflow) issues.push({ id: 'contents-overflow', severity: 'warn', message: 'Not every line fits', detail: 'Shorten the list, or use a larger label or continuous tape.' });
    };

    if (H < 36) {
      // Short labels: the code at the left, full height; the list runs on in one paragraph.
      let x = inner.x;
      if (o.qr) {
        const code = qrCode({ x: inner.x, y: inner.y, w: inner.h, h: inner.h }, 'start', 'center');
        x = code.box.x + code.box.w + Math.max(2, pad);
      }
      const col: Box = { x, y: inner.y, w: inner.x + inner.w - x, h: inner.h };
      const headH = clamp(col.h * 0.38, 5, 12);
      ops.push(...header(env, b, { ...col, h: headH }));
      let bottom = col.y + col.h;
      if (hasOwner && col.h >= 18) {
        const a = org.address;
        const style: TextStyle = { font: ts.roles.text, optical: true };
        const pt = clamp(mmToPt(col.h) * 0.12, ts.minPt, 7);
        const locality = ruleFor(a.country).locality(a).join(' ');
        // The whole address if it fits, else name and town, else the name alone.
        const candidates = [[org.name, streetLine(a), locality], [org.name, a.city ?? ''], [org.name]].map((parts) => parts.filter(Boolean).join(' · '));
        const set = (text: string) => fitText(m, { text, box: { ...col, y: bottom - ptToMm(pt), h: ptToMm(pt) }, style, maxPt: pt, minPt: Math.min(pt, ts.minPt + 0.5), wrap: false, maxLines: 1, valign: 'bottom', locale: env.locale });
        const fit = candidates.map(set).find((f) => !f.overflow) ?? set(candidates[candidates.length - 1]);
        ops.push(...fit.ops);
        bottom = fit.firstBaseline - m.metrics(style.font).cap * ptToMm(fit.sizePt) - ptToMm(pt) * 0.9;
      }
      if (items.length) {
        const top = col.y + headH + Math.max(1.2, headH * 0.22);
        const fit = fitText(m, { text: items.map((t) => typeset(t, env.locale)).join('\u00a0· '), box: { ...col, y: top, h: bottom - top }, style: { font: ts.roles.text, optical: true, leading: 1.18 }, maxPt: 11, minPt: ts.minPt, maxLines: 4, hyphenate: env.locale, locale: env.locale });
        ops.push(...fit.ops);
        if (fit.overflow) issues.push({ id: 'contents-overflow', severity: 'warn', message: 'Not every line fits', detail: 'Shorten the list, or use a larger label or continuous tape.' });
      }
      if (logo) issues.push({ id: 'contents-compact', severity: 'info', message: 'Short label: the logo is left out', detail: 'Use the 62 × 100 mm shipping label or continuous tape for logo and address.' });
      return { ops, issues };
    }

    const sideW = W / H > 1.25 && (hasOwner || logo || o.qr) ? clamp(Math.min(inner.w * 0.32, inner.h * 0.62), 18, 40) : 0;
    const main: Box = { ...inner, w: inner.w - (sideW ? sideW + 2 * pad : 0) };
    let mainBottom = main.y + main.h;

    if (sideW) {
      // Landscape: a tag along the right edge, like a luggage label: logo, owner, code.
      const side: Box = { x: inner.x + inner.w - sideW, y: inner.y, w: sideW, h: inner.h };
      rule(side.x - pad, inner.y, side.x - pad, inner.y + inner.h);
      let top = side.y;
      let bottom = side.y + side.h;
      if (o.qr) {
        const code = qrCode({ x: side.x, y: bottom - sideW, w: sideW, h: sideW }, 'center', 'end');
        bottom = code.box.y - Math.max(1.5, pad * 0.6);
      }
      if (logo) {
        const op = placeBitmap(logo, { x: side.x, y: top, w: side.w, h: Math.min(side.w * 0.45, (bottom - top) * 0.4) }, { valign: 'start' });
        if (op) {
          ops.push(op);
          top = dotsToMm(op.yDots + op.rows) + Math.max(1.5, pad * 0.6);
        }
      }
      if (hasOwner && bottom - top > 6) ops.push(...ownerBlock(env, { x: side.x, y: top, w: side.w, h: bottom - top }, 9, 'center', 'middle'));
    } else if (hasOwner || logo || o.qr) {
      // Portrait: the same, as a band along the bottom.
      const bandH = clamp(main.h * 0.2, 12, 24);
      const band: Box = { ...main, y: main.y + main.h - bandH, h: bandH };
      rule(inner.x, band.y - pad * 0.8, inner.x + inner.w, band.y - pad * 0.8);
      mainBottom = band.y - pad * 1.6;
      const left = band.x;
      let right = band.x + band.w;
      if (o.qr) {
        const code = qrCode({ x: right - bandH, y: band.y, w: bandH, h: bandH }, 'end', 'center');
        right = code.box.x - Math.max(2, pad);
      }
      if (hasOwner && right - left > 10) ops.push(...ownerBlock(env, { x: left, y: band.y, w: right - left, h: band.h }, 9, 'left', 'middle'));
    }

    if (logo && !sideW) {
      // Portrait: the logo heads the label on a row of its own; the band below keeps its width for the address.
      const op = placeBitmap(logo, { x: main.x, y: main.y, w: main.w * 0.6, h: clamp(main.h * 0.1, 5, 11) }, { align: 'start', valign: 'start' });
      if (op) {
        ops.push(op);
        const below = dotsToMm(op.yDots + op.rows) + Math.max(2, pad);
        main.h -= below - main.y;
        main.y = below;
      }
    }
    const headH = clamp(main.h * 0.2, 6.5, 16);
    ops.push(...header(env, b, { ...main, h: headH }));
    const listTop = main.y + headH + Math.max(1.5, headH * 0.18);
    rule(main.x, listTop, main.x + main.w, listTop);
    const listBox: Box = { ...main, y: listTop + Math.max(1.8, headH * 0.2), h: mainBottom - listTop - Math.max(1.8, headH * 0.2) };
    list(listBox, 14);

    // On continuous tape the label can be as long as the list needs at a comfortable size.
    if (frame.shape === 'continuous' && frame.readAlong && items.length) {
      const sizeMm = ptToMm(LIST_COMFORT_PT);
      const style: TextStyle = { font: ts.roles.text, optical: true };
      const perCol = Math.max(1, Math.floor((listBox.h - m.metrics(style.font).cap * sizeMm) / (LIST_LEADING * sizeMm)) + 1);
      const cols = Math.ceil(items.length / perCol);
      const colW = Math.max(COLUMN_MIN_MM, ...items.map((t) => measure(m, `– ${t}`, style, sizeMm)));
      const gap = 3;
      const mainW = Math.max(cols * colW + (cols - 1) * gap, b.title ? measure(m, b.title, { font: ts.roles.strong }, ptToMm(clamp(mmToPt(headH) * 0.48, 8, 26))) + 20 : 0);
      preferred = Math.ceil(mainW + (sideW ? sideW + 2 * pad : 0) + 2 * pad + 2 * CONTINUOUS_FEED_MARGIN_MM + 0.5);
    }
    return { ops, issues, preferredLengthMm: preferred ? snapMm(preferred) : undefined };
  },
};
