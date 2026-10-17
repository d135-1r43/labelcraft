import type { AllergenCode, FoodProduct } from '../../api/types';
import type { DrawOp, Ink, Issue } from '../../engine/display';
import { fitStack, fitText, type Box, type TextStyle } from '../../engine/text';
import { NBSP, typeset, type TypeLocale } from '../../engine/typeset';
import { ptToMm } from '../../engine/units';
import type { KindDef, LayoutEnv } from '../types';

export interface FoodOptions {
  /** ISO timestamp; null means “now” and follows the clock. */
  preparedAt: string | null;
  preparedBy: string;
  allergens: boolean;
}

export const ALLERGENS: Record<AllergenCode, { de: string; en: string }> = {
  A: { de: 'Gluten', en: 'Gluten' },
  B: { de: 'Krebstiere', en: 'Crustaceans' },
  C: { de: 'Eier', en: 'Eggs' },
  D: { de: 'Fisch', en: 'Fish' },
  E: { de: 'Erdnüsse', en: 'Peanuts' },
  F: { de: 'Soja', en: 'Soy' },
  G: { de: 'Milch', en: 'Milk' },
  H: { de: 'Schalenfrüchte', en: 'Tree nuts' },
  L: { de: 'Sellerie', en: 'Celery' },
  M: { de: 'Senf', en: 'Mustard' },
  N: { de: 'Sesam', en: 'Sesame' },
  O: { de: 'Sulfite', en: 'Sulphites' },
  P: { de: 'Lupinen', en: 'Lupin' },
  R: { de: 'Weichtiere', en: 'Molluscs' },
};

const T = {
  useBy: { de: 'Verbrauchen bis', en: 'Use by' },
  made: { de: 'Hergestellt', en: 'Made' },
  allergens: { de: 'Allergene', en: 'Allergens' },
  none: { de: 'Keine kennzeichnungspflichtigen Allergene', en: 'No declarable allergens' },
  chilled: { de: 'Gekühlt lagern, 2–7 °C', en: 'Keep chilled, 2–7 °C' },
  frozen: { de: 'Tiefgekühlt lagern, −18 °C', en: 'Keep frozen, −18 °C' },
  ambient: { de: 'Trocken und kühl lagern', en: 'Store cool and dry' },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const tag = (l: TypeLocale) => (l === 'de' ? 'de-DE' : 'en-GB');

export function useBy(p: FoodProduct, o: FoodOptions, now: Date) {
  const made = o.preparedAt ? new Date(o.preparedAt) : now;
  return { made, until: new Date(made.getTime() + p.shelfLifeHours * 3600_000) };
}

function weekday(d: Date, l: TypeLocale) {
  return new Intl.DateTimeFormat(tag(l), { weekday: 'short' }).format(d).replace(/\.$/, '');
}
function shortDate(d: Date, l: TypeLocale, withYear: boolean) {
  if (l === 'de') return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${withYear ? String(d.getFullYear()).slice(2) : ''}`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: '2-digit' } : {}) }).format(d);
}
function time(d: Date, l: TypeLocale) {
  return new Intl.DateTimeFormat(tag(l), { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** The inverted use-by block: weekday as the dominant signal, then the exact date or time. */
function useByBlock(env: LayoutEnv, box: Box, until: Date, shortLife: boolean, ink: Ink, ops: DrawOp[]) {
  const { m, ts, locale } = env;
  ops.push({ t: 'rect', ...box, ink, radius: Math.min(1.4, box.h * 0.08) });
  const inset = clamp(Math.min(box.w, box.h) * 0.09, 0.9, 2.6);
  const inner = { x: box.x + inset, y: box.y + inset, w: box.w - 2 * inset, h: box.h - 2 * inset };

  // Caption: sentence case is a third narrower than spaced capitals, which matters in a 20 mm block.
  const captionStyle: TextStyle = { font: ts.roles.strong, optical: true, ink: 'paper' };
  const captionMax = clamp(box.h * 0.26, ts.minPt, 8);
  const captionCap = m.metrics(captionStyle.font).cap * ptToMm(captionMax);
  const caption = fitText(m, { text: T.useBy[locale], box: { ...inner, h: captionCap }, style: captionStyle, maxPt: captionMax, minPt: ts.minPt - 0.5, wrap: false, maxLines: 1 });
  ops.push(...caption.ops);

  // Date or time along the bottom edge.
  const detail = shortLife ? `${time(until, locale)}${locale === 'de' ? `${NBSP}Uhr` : ''}` : shortDate(until, locale, false);
  const detailStyle: TextStyle = { font: ts.roles.strong, optical: true, ink: 'paper' };
  const detailCap = Math.min(inner.h * 0.2, inner.w * 0.16);
  const detailFit = fitText(m, {
    text: detail,
    box: { x: inner.x, y: inner.y + inner.h - detailCap, w: inner.w, h: detailCap },
    style: detailStyle,
    maxPt: 40,
    minPt: ts.minPt,
    wrap: false,
    maxLines: 1,
    valign: 'bottom',
  });
  ops.push(...detailFit.ops);

  // The weekday takes every millimetre in between.
  const gap = ptToMm(detailFit.sizePt) * 0.45;
  const top = caption.lastBaseline + ptToMm(caption.sizePt) * 0.55;
  const bottom = detailFit.firstBaseline - m.metrics(detailStyle.font).cap * ptToMm(detailFit.sizePt) - gap;
  const day = fitText(m, {
    text: weekday(until, locale),
    box: { x: inner.x, y: top, w: inner.w, h: Math.max(1, bottom - top) },
    style: { font: ts.roles.display, caps: true, optical: true, ink: 'paper' },
    maxPt: 90,
    minPt: 6,
    wrap: false,
    maxLines: 1,
    valign: 'bottom',
    locale,
  });
  ops.push(...day.ops);
}

export const foodKind: KindDef<FoodProduct, FoodOptions> = {
  id: 'food',
  name: 'Food date',
  tagline: 'Computes use-by from shelf life, declares allergens',
  defaultMedia: 'DK-11209',
  media: ['DK-11209', 'DK-22251', 'DK-22205', 'DK-11204', 'DK-11218'],
  defaultTypeSystem: 'atkinson',
  defaultOptions: { preparedAt: null, preparedBy: 'MK', allergens: true },
  source: {
    name: 'Recipes',
    noun: 'product',
    load: (api) => api.foodProducts(),
    title: (p) => p.name,
    subtitle: (p) => {
      const h = p.shelfLifeHours;
      const life = h < 24 ? `${h} h` : `${Math.round(h / 24)} days`;
      return `${life} · ${p.storage}`;
    },
    group: (p) => p.category,
    editable: false,
  },

  layout(p, o, env) {
    const { m, frame, ts, locale, now } = env;
    const ops: DrawOp[] = [];
    const issues: Issue[] = [];
    const W = frame.wMm;
    const H = frame.hMm;
    const pad = clamp(Math.min(W, H) * 0.06, 0.8, 3);
    const { made, until } = useBy(p, o, now);
    const shortLife = p.shelfLifeHours < 24;
    const blockInk: Ink = frame.media.twoColor ? 'red' : 'black';
    const k = clamp(Math.min(H, W) / 25, 0.6, 2.2);

    const landscape = W >= H * 1.15;
    let col: Box;
    if (landscape) {
      const bw = clamp(W * 0.38, 14, 60);
      useByBlock(env, { x: W - pad - bw, y: pad, w: bw, h: H - 2 * pad }, until, shortLife, blockInk, ops);
      col = { x: pad, y: pad, w: W - 3 * pad - bw - 0.6, h: H - 2 * pad };
    } else {
      const bh = clamp(H * 0.36, 10, 50);
      useByBlock(env, { x: pad, y: pad, w: W - 2 * pad, h: bh }, until, shortLife, blockInk, ops);
      col = { x: pad, y: pad + bh + pad * 1.5, w: W - 2 * pad, h: H - 3.5 * pad - bh };
    }

    // Details, set bottom-up so the name gets whatever room is left.
    const small: TextStyle = { font: ts.roles.text, optical: true };
    const smallPt = clamp(6.2 * k, ts.minPt, 8);
    const madeText = `${T.made[locale]} ${weekday(made, locale)} ${shortDate(made, locale, false)} ${time(made, locale)}${o.preparedBy ? `  ·  ${o.preparedBy.toUpperCase()}` : ''}`;
    const detailLines = [{ text: T[p.storage][locale], style: small }, { text: madeText, style: small }];
    if (o.allergens) {
      const names = p.allergens.map((c) => ALLERGENS[c][locale]).join(', ');
      detailLines.push({ text: p.allergens.length ? `${T.allergens[locale]}: ${names}` : T.none[locale], style: p.allergens.length ? { font: ts.roles.strong, optical: true } : small });
    }
    const detailCap = m.metrics(small.font).cap * ptToMm(smallPt);
    const detailH = detailCap + (detailLines.length - 1) * ptToMm(smallPt) * 1.22;
    const details = fitStack(m, detailLines, { x: col.x, y: col.y + col.h - detailH, w: col.w, h: detailH }, { maxPt: smallPt, minPt: ts.minPt - 0.5, leading: 1.22, valign: 'bottom', locale });
    ops.push(...details.ops);
    if (details.overflow) issues.push({ id: 'food-details', severity: 'warn', message: 'Storage, date or allergen line is cut short' });
    if (details.sizePt < 5.5) issues.push({ id: 'food-small', severity: 'warn', message: `Allergen line set at ${details.sizePt} pt`, detail: 'Allergen information must be legible. Use a larger label or a shorter product name.' });

    const nameBox = { x: col.x, y: col.y, w: col.w, h: col.h - detailH - ptToMm(smallPt) * 1.5 };
    const name = fitText(m, {
      text: typeset(p.name, locale),
      box: nameBox,
      style: { font: ts.roles.strong, optical: true, leading: 1.1 },
      maxPt: 16 * k,
      minPt: 6,
      maxLines: 3,
      balance: true,
      hyphenate: locale,
      valign: 'top',
    });
    ops.push(...name.ops);
    if (name.overflow) issues.push({ id: 'food-name', severity: 'warn', message: 'Product name is shortened' });

    if (until.getTime() < now.getTime()) issues.push({ id: 'food-expired', severity: 'error', message: 'This use-by date has already passed', detail: 'Check the preparation time.' });
    if (p.storage === 'frozen' && p.shelfLifeHours > 24 * 30) issues.push({ id: 'food-frozen', severity: 'info', message: `Frozen: use within ${Math.round(p.shelfLifeHours / 24 / 30)} months` });
    return { ops, issues };
  },
};
