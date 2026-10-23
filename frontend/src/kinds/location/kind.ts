import { locationCode } from '../../db/entities';
import type { StorageLocation } from '../../db/types';
import { placeCode } from '../../engine/barcode';
import type { DrawOp, Issue } from '../../engine/display';
import { fitText, measure, setLine, sizeForCapHeight, type TextStyle } from '../../engine/text';
import { typeset } from '../../engine/typeset';
import { DOTS_PER_MM, ptToMm, snapMm } from '../../engine/units';
import type { KindDef } from '../types';

export interface LocationOptions {
  arrow: 'auto' | 'none';
  barcode: boolean;
  contents: boolean;
}

const CAPTIONS: Record<string, { de: string; en: string }> = {
  aisle: { de: 'Gang', en: 'Aisle' },
  rack: { de: 'Regal', en: 'Rack' },
  shelf: { de: 'Fach', en: 'Shelf' },
  zone: { de: 'Zone', en: 'Zone' },
  bin: { de: 'Box', en: 'Bin' },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A solid arrow inside a unit square, pointing up; rotated per direction. */
function arrowPoints(x: number, y: number, s: number, dir: 'up' | 'down' | 'left' | 'right'): [number, number][] {
  const unit: [number, number][] = [
    [0.5, 0.16],
    [0.84, 0.52],
    [0.62, 0.52],
    [0.62, 0.84],
    [0.38, 0.84],
    [0.38, 0.52],
    [0.16, 0.52],
  ];
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  const rad = (rot * Math.PI) / 180;
  return unit.map(([px, py]) => {
    const dx = px - 0.5;
    const dy = py - 0.5;
    return [x + s * (0.5 + dx * Math.cos(rad) - dy * Math.sin(rad)), y + s * (0.5 + dx * Math.sin(rad) + dy * Math.cos(rad))];
  });
}

export const locationKind: KindDef<StorageLocation, LocationOptions> = {
  id: 'location',
  name: 'Storage location',
  tagline: 'Aisle, rack and shelf, readable from three metres',
  defaultMedia: 'DK-11203',
  media: ['DK-11203', 'DK-11204', 'DK-11201', 'DK-22205', 'DK-22212'],
  defaultTypeSystem: 'atkinson',
  defaultOptions: { arrow: 'auto', barcode: true, contents: true },
  entity: 'locations',


  layout(loc, o, { m, frame, ts, locale }) {
    const ops: DrawOp[] = [];
    const issues: Issue[] = [];
    const W = frame.wMm;
    const H = frame.hMm;
    const pad = clamp(H * 0.08, 0.8, 3);
    let x = pad;
    const innerH = H - 2 * pad;

    // Direction block: a solid square with the arrow knocked out.
    if (o.arrow === 'auto' && loc.arrow) {
      const s = snapMm(innerH);
      ops.push({ t: 'rect', x, y: pad, w: s, h: s, ink: 'black', radius: Math.min(1.2, s * 0.08) });
      ops.push({ t: 'poly', points: arrowPoints(x, pad, s, loc.arrow), ink: 'paper' });
      x += s + Math.max(1.6, s * 0.16);
    }

    // Barcode column on the right, only when it can scan.
    let right = W - pad;
    const code = locationCode(loc);
    if (o.barcode) {
      const want = Math.min(W * 0.34, 34);
      const trial = placeCode('code128', code, { x: right - want, y: pad, w: want, h: innerH }, frame, {
        align: 'end',
        // The segments are moved left to leave the full quiet zone; the right edge is bare paper.
        clear: { left: Infinity, right: pad + frame.offX },
      });
      const tooSmall = trial.issues.some((i) => i.id === 'code-module' && i.severity === 'error');
      if (W - x - want < 18 || tooSmall) {
        issues.push({ id: 'loc-nobarcode', severity: 'info', message: 'Barcode left off: not enough room', detail: 'A longer label fits a scannable Code 128.', fix: { label: 'Hide barcode', action: { type: 'option', key: 'barcode', value: false } } });
      } else if (trial.op) {
        ops.push(trial.op);
        issues.push(...trial.issues);
        right = trial.box.x - Math.max(trial.moduleMm * 10, 2);
      }
    }

    // Segments: big figures with small captions underneath, ruled apart.
    const showContents = o.contents && H >= 12;
    const captionPt = clamp(H * 0.2, ts.minPt, 7.5);
    const captionStyle: TextStyle = { font: ts.roles.caption, caps: true, tracking: ts.capsTracking };
    const captionCap = m.metrics(captionStyle.font).cap * ptToMm(captionPt);
    const contentsPt = clamp(H * 0.24, ts.minPt, 9);
    const contentsCap = m.metrics(ts.roles.text).cap * ptToMm(contentsPt);
    const figureStyle: TextStyle = { font: ts.roles.display, optical: true };
    const reserved = captionCap + ptToMm(captionPt) * 0.55 + (showContents ? contentsCap + ptToMm(contentsPt) * 0.75 : 0);
    const availW = right - x;
    const figCapTarget = Math.max(2, innerH - reserved);
    let sizePt = sizeForCapHeight(m, figureStyle.font, figCapTarget);
    const gapEm = 0.42;
    const totalWidth = (pt: number) => {
      const s = ptToMm(pt);
      return loc.segments.reduce((acc, seg) => acc + measure(m, seg.value, figureStyle, s), 0) + (loc.segments.length - 1) * gapEm * 2 * s;
    };
    if (totalWidth(sizePt) > availW) sizePt = (sizePt * availW) / totalWidth(sizePt);
    sizePt = Math.floor(sizePt * 4) / 4;
    const sizeMm = ptToMm(sizePt);
    const figCap = m.metrics(figureStyle.font).cap * sizeMm;
    const figBaseline = pad + figCap;
    const captionBaseline = figBaseline + ptToMm(captionPt) * 0.55 + captionCap;
    let cx = x;
    loc.segments.forEach((seg, i) => {
      const op = setLine(m, seg.value, figureStyle, sizePt, cx, figBaseline);
      const segW = op.width;
      const { width: _w, ...textOp } = op;
      ops.push(textOp);
      const caption = CAPTIONS[seg.label]?.[locale] ?? seg.label;
      const capOp = setLine(m, caption, captionStyle, captionPt, cx + segW / 2, captionBaseline, 'center', locale);
      if (capOp.width <= segW + gapEm * sizeMm * 1.6) {
        const { width: _cw, ...c } = capOp;
        ops.push(c);
      }
      cx += segW;
      if (i < loc.segments.length - 1) {
        const ruleX = cx + gapEm * sizeMm;
        ops.push({ t: 'line', x1: ruleX, y1: pad + figCap * 0.08, x2: ruleX, y2: captionBaseline, dots: Math.max(2, Math.round(sizeMm * 0.012 * DOTS_PER_MM)), ink: 'black' });
        cx += gapEm * 2 * sizeMm;
      }
    });
    if (sizePt < 14) issues.push({ id: 'loc-small', severity: 'warn', message: `Location figures are only ${sizePt} pt`, detail: 'Shelf labels should be readable from a distance; use a taller label.' });

    if (showContents) {
      const fit = fitText(m, {
        text: typeset(loc.contents, locale),
        box: { x, y: H - pad - contentsCap, w: right - x, h: contentsCap },
        style: { font: ts.roles.text, optical: true },
        maxPt: contentsPt,
        minPt: ts.minPt,
        wrap: false,
        maxLines: 1,
      });
      ops.push(...fit.ops);
      if (fit.overflow) issues.push({ id: 'loc-contents', severity: 'info', message: 'Contents description is shortened' });
    }
    return { ops, issues };
  },
};
