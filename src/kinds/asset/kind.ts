import type { InventoryItem } from '../../db/types';
import { placeCode, type Symbology } from '../../engine/barcode';
import type { DrawOp, Issue, TextOp } from '../../engine/display';
import { fitText, measure, type Box, type TextStyle } from '../../engine/text';
import { typeset } from '../../engine/typeset';
import { ptToMm } from '../../engine/units';
import type { KindDef, LayoutEnv } from '../types';

export interface AssetOptions {
  symbology: Extract<Symbology, 'qr' | 'datamatrix'>;
  ownerLine: boolean;
  detail: 'serial' | 'location' | 'both' | 'none';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The asset tag, with its prefix set one weight lighter so the number reads first. */
function tagOps(env: LayoutEnv, tag: string, box: Box, maxPt: number, align: 'left' | 'center', valign: 'bottom' | 'top'): { ops: TextOp[]; sizePt: number; capTop: number; baseline: number } {
  const { m, ts } = env;
  const strong: TextStyle = { font: ts.roles.codeStrong, optical: true };
  const light: TextStyle = { font: ts.roles.code, optical: true };
  const fit = fitText(m, { text: tag, box, style: strong, maxPt, minPt: 5, wrap: false, maxLines: 1, align, valign });
  const split = tag.match(/^([A-Z]+[-–])(.+)$/);
  if (!split || !fit.ops.length) return { ops: fit.ops, sizePt: fit.sizePt, capTop: fit.firstBaseline - m.metrics(strong.font).cap * ptToMm(fit.sizePt), baseline: fit.lastBaseline };
  const op = fit.ops[0];
  const prefixW = measure(m, split[1], light, op.sizeMm) + op.tracking * op.sizeMm;
  return {
    ops: [
      { ...op, text: split[1], font: light.font },
      { ...op, x: op.x + prefixW, text: split[2] },
    ],
    sizePt: fit.sizePt,
    capTop: fit.firstBaseline - m.metrics(strong.font).cap * op.sizeMm,
    baseline: op.y,
  };
}

export const assetKind: KindDef<InventoryItem, AssetOptions> = {
  id: 'asset',
  name: 'Asset tag',
  tagline: 'Linked to inventory, scans to the record',
  defaultMedia: 'DK-11201',
  media: ['DK-11201', 'DK-11221', 'DK-11204', 'DK-22211', 'DK-11209'],
  defaultTypeSystem: 'plex',
  defaultOptions: { symbology: 'qr', ownerLine: true, detail: 'serial' },
  entity: 'inventory',


  layout(item, o, env) {
    const { m, frame, ts, locale, org } = env;
    const ops: DrawOp[] = [];
    const issues: Issue[] = [];
    let W = frame.wMm;
    let H = frame.hMm;
    let ox = 0;
    let oy = 0;
    if (frame.shape === 'round') {
      // Keep everything inside the square inscribed in the circle.
      // 8 % inside the inscribed square: its corners sit exactly on the die-cut.
      const side = (Math.min(frame.physW, frame.physH) / Math.SQRT2) * 0.92;
      ox = (W - side) / 2;
      oy = (H - side) / 2;
      W = H = side;
    }
    const k = clamp(H / 25.9, 0.55, 2.2);
    const pad = frame.shape === 'round' ? 0.3 : clamp(Math.min(W, H) * 0.075, 1, 3.5);
    // The QR code opens the record in the leading system; without a link it can only carry the tag.
    const payload = o.symbology === 'qr' && item.uri ? item.uri : item.assetTag;
    if (o.symbology === 'qr' && !item.uri) issues.push({ id: 'asset-unlinked', severity: 'warn', message: 'Not linked to the inventory', detail: 'The QR code holds only the asset tag, so a phone camera cannot open the record. Add the link above.' });
    const aspect = W / H;

    if (aspect < 1.6) {
      // Square and round: code on top, tag underneath.
      const tagCap = Math.max(ptToMm(7 * k) * 0.7, 1.6);
      const codeSide = Math.min(W - 2 * pad, H - 2 * pad - tagCap - 1.4);
      const code = placeCode(o.symbology, payload, { x: ox + (W - codeSide) / 2, y: oy + pad, w: codeSide, h: codeSide }, frame, {
        clear: { left: ox + frame.offX, right: ox + frame.offX, top: oy + pad + frame.offY, bottom: 0.8 },
      });
      if (code.op) ops.push(code.op);
      issues.push(...code.issues);
      const tag = tagOps(env, item.assetTag, { x: ox + pad, y: code.box.y + code.box.h + 0.8, w: W - 2 * pad, h: oy + H - pad - (code.box.y + code.box.h + 0.8) }, 9 * k, 'center', 'bottom');
      ops.push(...tag.ops);
      if (o.ownerLine || o.detail !== 'none') issues.push({ id: 'asset-compact', severity: 'info', message: 'Compact label: only the code and tag are printed', detail: 'Use a 29 × 90 mm label for the name and details.' });
      return { ops, issues };
    }

    // Landscape: the code sits left, full height; text aligns to its top and bottom edges.
    const codeSide = Math.min(H - 2 * pad, W * 0.42);
    const codeY = (H - codeSide) / 2;
    // Left, top and bottom of the code are bare paper out to the label edge; the right side is kept clear by the column gap.
    const code = placeCode(o.symbology, payload, { x: pad, y: codeY, w: codeSide, h: codeSide }, frame, {
      align: 'start',
      clear: { left: pad + frame.offX, top: codeY + frame.offY, bottom: codeY + frame.offY, right: Infinity },
    });
    if (code.op) ops.push(code.op);
    issues.push(...code.issues);
    const quiet = code.moduleMm * (o.symbology === 'qr' ? 4 : 2);
    const colX = code.box.x + code.box.w + Math.max(quiet, 1.6);
    const colW = W - pad - colX;
    const colTop = code.box.y;
    const colBottom = code.box.y + code.box.h;

    const tag = tagOps(env, item.assetTag, { x: colX, y: colTop, w: colW, h: colBottom - colTop }, 15 * k, 'left', 'bottom');
    ops.push(...tag.ops);
    let bottom = tag.capTop;

    const details = [o.detail === 'serial' || o.detail === 'both' ? (item.serial ? `S/N ${item.serial}` : '') : '', o.detail === 'location' || o.detail === 'both' ? item.location : '']
      .filter(Boolean)
      .join('  ·  ');
    if (details) {
      const sizePt = clamp(6 * k, ts.minPt, 8);
      const style: TextStyle = { font: ts.roles.text, optical: true };
      const capH = m.metrics(style.font).cap * ptToMm(sizePt);
      const fit = fitText(m, { text: details, box: { x: colX, y: bottom - ptToMm(sizePt) * 0.95 - capH, w: colW, h: capH }, style, maxPt: sizePt, minPt: ts.minPt, wrap: false, maxLines: 1 });
      ops.push(...fit.ops);
      if (fit.overflow) issues.push({ id: 'asset-detail', severity: 'warn', message: 'Details are cut short', detail: 'Show fewer details or use a longer label.' });
      bottom = fit.firstBaseline - capH;
    }

    let top = colTop;
    if (o.ownerLine && H >= 18) {
      const style: TextStyle = { font: ts.roles.caption, caps: true, tracking: ts.capsTracking };
      const sizePt = clamp(5.5 * k, ts.minPt, 7);
      const capH = m.metrics(style.font).cap * ptToMm(sizePt);
      const label = locale === 'de' ? `Eigentum ${org.name}` : `Property of ${org.name}`;
      const fit = fitText(m, { text: label, box: { x: colX, y: colTop, w: colW, h: capH }, style, maxPt: sizePt, minPt: ts.minPt, wrap: false, maxLines: 1, locale });
      ops.push(...fit.ops);
      top = fit.lastBaseline + ptToMm(sizePt) * 1.0;
    }

    const nameBox = { x: colX, y: top, w: colW, h: Math.max(0, bottom - top - ptToMm(7 * k) * 0.45) };
    if (nameBox.h > 1) {
      const fit = fitText(m, {
        text: typeset(item.name, locale),
        box: nameBox,
        style: { font: ts.roles.strong, optical: true, leading: 1.12 },
        maxPt: 10.5 * k,
        minPt: ts.minPt,
        maxLines: H > 30 ? 3 : 2,
        balance: true,
        hyphenate: locale,
        valign: 'middle',
      });
      ops.push(...fit.ops);
      if (fit.overflow) issues.push({ id: 'asset-name', severity: 'warn', message: 'Asset name is shortened', detail: `“${item.name}” is too long for this label.` });
    }
    return { ops, issues };
  },
};
