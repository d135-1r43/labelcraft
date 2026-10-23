import { CONTINUOUS_FEED_MARGIN_MM } from '../../engine/media';
import type { DrawOp, Issue } from '../../engine/display';
import { fitText, measure, sizeForCapHeight, type TextStyle } from '../../engine/text';
import { typeset } from '../../engine/typeset';
import { ptToMm, snapMm } from '../../engine/units';
import type { Sign } from '../../db/types';
import type { KindDef } from '../types';

export interface TextOptions {
  align: 'left' | 'center';
  caps: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const textKind: KindDef<Sign, TextOptions> = {
  id: 'text',
  name: 'Sign',
  tagline: 'Free text, set with optimal line breaks',
  defaultMedia: 'DK-22205',
  media: ['DK-22205', 'DK-22251', 'DK-22210', 'DK-11202', 'DK-22212'],
  defaultTypeSystem: 'plex',
  defaultOptions: { align: 'left', caps: false },
  entity: 'signs',

  layout(note, o, { m, frame, ts, locale }) {
    const ops: DrawOp[] = [];
    const issues: Issue[] = [];
    const W = frame.wMm;
    const H = frame.hMm;
    const pad = clamp(Math.min(W, H) * 0.1, 1.2, 5);
    const title = typeset(note.title, locale);
    const subtitle = typeset(note.subtitle, locale);
    const inner = { x: pad, y: pad, w: W - 2 * pad, h: H - 2 * pad };
    const titleStyle: TextStyle = { font: o.caps ? ts.roles.display : ts.roles.strong, caps: o.caps, tracking: o.caps ? ts.capsTracking * 0.6 : 0, optical: true, leading: 1.08 };
    const subStyle: TextStyle = { font: ts.roles.text, optical: true, leading: 1.2 };
    const align = o.align;

    if (!title && !subtitle) {
      issues.push({ id: 'text-empty', severity: 'info', message: 'Type a heading to start' });
      return { ops, issues };
    }

    let titleBox = inner;
    let preferred: number | undefined;
    if (subtitle) {
      const subMax = clamp(H * 0.2, 6, 14);
      const subH = Math.min(inner.h * 0.3, m.metrics(subStyle.font).cap * ptToMm(subMax) + ptToMm(subMax) * 1.2);
      const sub = fitText(m, { text: subtitle, box: { x: inner.x, y: inner.y + inner.h - subH, w: inner.w, h: subH }, style: subStyle, maxPt: subMax, minPt: ts.minPt, maxLines: 2, balance: true, hyphenate: locale, align, valign: 'bottom' });
      ops.push(...sub.ops);
      if (sub.overflow) issues.push({ id: 'text-sub', severity: 'warn', message: 'Second line is shortened' });
      const gap = ptToMm(sub.sizePt) * 1.4;
      const subTop = sub.firstBaseline - m.metrics(subStyle.font).cap * ptToMm(sub.sizePt);
      titleBox = { ...inner, h: subTop - gap - inner.y };
    }
    if (title) {
      const fit = fitText(m, { text: title, box: titleBox, style: titleStyle, maxPt: 96, minPt: 6, maxLines: 3, balance: true, hyphenate: locale, align, valign: subtitle ? 'bottom' : 'middle', locale });
      // Centre heading and second line as one group, a touch above the middle.
      if (subtitle) {
        const spare = fit.firstBaseline - m.metrics(titleStyle.font).cap * ptToMm(fit.sizePt) - inner.y;
        const shift = snapMm(spare * 0.46);
        for (const op of ops) if (op.t === 'text') op.y -= shift;
        for (const op of fit.ops) op.y -= shift;
      }
      ops.push(...fit.ops);
      if (fit.overflow) issues.push({ id: 'text-title', severity: 'warn', message: 'Heading does not fit and is shortened' });
      if (fit.lines.some((l) => l.hyphenated)) issues.push({ id: 'text-hyph', severity: 'info', message: 'Heading is hyphenated', detail: 'A longer label would set it on one line.' });
    }

    // On continuous tape the label can be exactly as long as the text needs.
    if (frame.shape === 'continuous' && frame.readAlong) {
      const capTarget = (inner.h - (subtitle ? inner.h * 0.3 + 1 : 0)) * 0.92;
      const pt = Math.min(96, sizeForCapHeight(m, titleStyle.font, capTarget));
      const tw = measure(m, o.caps ? title.toLocaleUpperCase() : title, titleStyle, ptToMm(pt));
      const sw = subtitle ? measure(m, subtitle, subStyle, ptToMm(clamp(H * 0.2, 6, 14))) : 0;
      preferred = Math.ceil(Math.max(tw, sw) + 2 * pad + 2 * CONTINUOUS_FEED_MARGIN_MM + 0.5);
    }
    return { ops, issues, preferredLengthMm: preferred };
  },
};
