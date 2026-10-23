import type { Contact } from '../../db/types';
import type { DrawOp, Issue } from '../../engine/display';
import { fitStack, fitText, measure, type StackLine, type TextStyle } from '../../engine/text';
import { typeset } from '../../engine/typeset';
import { dotsToMm, ptToMm } from '../../engine/units';
import type { KindDef } from '../types';
import { formatAddress, senderLine } from './address';

export interface AddressOptions {
  showSender: boolean;
  emphasiseName: boolean;
  /** Service endorsement printed above the address: Einschreiben, PRIORITY, Fragile. */
  endorsement: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const addressKind: KindDef<Contact, AddressOptions> = {
  id: 'address',
  name: 'Address',
  tagline: 'Knows postal formats for 20 countries',
  defaultMedia: 'DK-11201',
  media: ['DK-11201', 'DK-11208', 'DK-11209', 'DK-11202', 'DK-22205'],
  defaultTypeSystem: 'plex',
  defaultOptions: { showSender: true, emphasiseName: true, endorsement: '' },
  entity: 'contacts',


  layout(r, o, { m, frame, ts, locale, org }) {
    const ops: DrawOp[] = [];
    const issues: Issue[] = [];
    const W = frame.wMm;
    const H = frame.hMm;
    const padX = clamp(W * 0.05, 1.5, 6);
    const padY = clamp(H * 0.075, 1, 5);
    const inner = { x: padX, y: padY, w: W - 2 * padX, h: H - 2 * padY };
    let top = inner.y;

    const formatted = formatAddress(r, org.address.country, locale);
    issues.push(...formatted.issues);

    // Return address (DIN 5008 Rücksendeangabe): one line, small, ruled off.
    if (o.showSender) {
      const style: TextStyle = { font: ts.roles.text, optical: true };
      const text = senderLine(org.address, r.country);
      const fit = fitText(m, { text, box: { x: inner.x, y: top, w: inner.w, h: ptToMm(8) }, style, maxPt: clamp(H * 0.24, ts.minPt, 7.5), minPt: ts.minPt, wrap: false, maxLines: 1 });
      ops.push(...fit.ops);
      if (fit.overflow) issues.push({ id: 'sender-cut', severity: 'warn', message: 'Return address is cut short', detail: 'It is longer than the label at 5 pt.' });
      // The rule matches the stem weight of the type above it: about 2 dots at 6 pt.
      const ruleY = fit.lastBaseline + ptToMm(fit.sizePt) * 0.32;
      ops.push({ t: 'line', x1: inner.x, y1: ruleY, x2: inner.x + Math.min(fit.maxWidth, inner.w), y2: ruleY, dots: 2, ink: 'black' });
      top = ruleY + dotsToMm(2) + ptToMm(fit.sizePt) * 1.25;
    }

    if (o.endorsement.trim()) {
      const style: TextStyle = { font: ts.roles.caption, caps: true, tracking: ts.capsTracking, ink: frame.media.twoColor ? 'red' : 'black' };
      const fit = fitText(m, { text: typeset(o.endorsement, locale), box: { x: inner.x, y: top, w: inner.w, h: ptToMm(9) * 0.72 }, style, maxPt: clamp(H * 0.3, 6, 9), minPt: ts.minPt, wrap: false, locale });
      ops.push(...fit.ops);
      top = fit.lastBaseline + ptToMm(fit.sizePt) * 1.1;
    }

    const textStyle: TextStyle = { font: ts.roles.text, optical: true };
    const strongStyle: TextStyle = { font: ts.roles.strong, optical: true };
    const firstEntity = formatted.lines[0]?.role;
    const lines: StackLine[] = formatted.lines.map((l) => ({
      text: l.text,
      style:
        l.role === 'country'
          ? { font: ts.roles.caption, tracking: ts.capsTracking, optical: true }
          : o.emphasiseName && l.role === firstEntity && (l.role === 'person' || l.role === 'company')
            ? strongStyle
            : textStyle,
    }));
    const box = { x: inner.x, y: top, w: inner.w, h: inner.y + inner.h - top };
    const maxPt = clamp(H * 0.4, 9, 16);
    const fitOpts = { maxPt, minPt: 6, leading: ts.leading, valign: 'middle' as const, bias: 0.4, locale };
    let stack = fitStack(m, lines, box, fitOpts);

    // DIN 5008 lets a long company or department name run over two lines.
    // Try the longest such line split at its most balanced space; keep it if the address gets larger.
    const splittable = formatted.lines
      .map((l, i) => ({ ...l, i }))
      .filter((l) => (l.role === 'company' || l.role === 'department') && l.text.includes(' '))
      .sort((a, b) => b.text.length - a.text.length)[0];
    if (splittable && (stack.overflow || stack.sizePt < 9)) {
      const words = splittable.text.split(' ');
      const style = lines[splittable.i].style;
      let best: [string, string] | null = null;
      let bestW = Infinity;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(' ');
        const b = words.slice(k).join(' ');
        const w = Math.max(measure(m, a, style, 1), measure(m, b, style, 1));
        if (w < bestW) {
          bestW = w;
          best = [a, b];
        }
      }
      if (best) {
        const split = [...lines.slice(0, splittable.i), { text: best[0], style }, { text: best[1], style }, ...lines.slice(splittable.i + 1)];
        const alt = fitStack(m, split, box, fitOpts);
        if ((!alt.overflow && stack.overflow) || (alt.overflow === stack.overflow && alt.sizePt >= stack.sizePt + 0.5)) stack = alt;
      }
    }
    ops.push(...stack.ops);

    if (!formatted.lines.length) {
      issues.push({ id: 'addr-empty', severity: 'info', message: 'Start typing an address or paste one' });
    } else if (stack.overflow) {
      issues.push({
        id: 'addr-overflow',
        severity: 'error',
        message: 'Address does not fit; long lines are cut',
        detail: 'Shorten the longest line or use a larger label.',
        fix: frame.media.id === 'DK-11201' ? { label: 'Use 38 × 90 mm labels', action: { type: 'media', mediaId: 'DK-11208' } } : undefined,
      });
    } else if (stack.sizePt < 8) {
      issues.push({
        id: 'addr-small',
        severity: 'warn',
        message: `Address set at ${stack.sizePt.toLocaleString('en')} pt`,
        detail: 'Sorting machines read reliably from 8 pt. Hide the return address, shorten a line or use a larger label.',
        fix: o.showSender ? { label: 'Hide return address', action: { type: 'option', key: 'showSender', value: false } } : undefined,
      });
    }
    return { ops, issues };
  },
};
