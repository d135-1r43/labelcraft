import type { FontRef, Ink, TextOp } from './display';
import type { Measurer } from './fonts';
import { syllables } from './hyphenate';
import { upper, type TypeLocale } from './typeset';
import { mmToPt, ptToMm, snapMm } from './units';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextStyle {
  font: FontRef;
  /** em */
  tracking?: number;
  /** Line pitch as a multiple of the size. */
  leading?: number;
  caps?: boolean;
  ink?: Ink;
  /**
   * Optical tracking: open up small sizes, tighten display sizes. Fonts are
   * spaced for ~10 pt; thermal print at 5 pt needs air between glyphs,
   * 40 pt figures need less.
   */
  optical?: boolean;
}

export function opticalTracking(sizePt: number) {
  if (sizePt <= 5) return 0.025;
  if (sizePt <= 9) return 0.025 * ((9 - sizePt) / 4);
  if (sizePt <= 14) return 0;
  return -Math.min(0.025, ((sizePt - 14) / 26) * 0.025);
}

export function trackingOf(style: TextStyle, sizeMm: number) {
  return (style.tracking ?? 0) + (style.optical ? opticalTracking(mmToPt(sizeMm)) : 0);
}

export type Align = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';

interface Fragment {
  text: string;
  /** This fragment ends a word: a break here is a space. */
  wordEnd: boolean;
  /** Breaking after this fragment requires a visible hyphen. */
  needsHyphen: boolean;
}

export interface SetLine {
  text: string;
  /** Advance width in mm, tracking included. */
  width: number;
  hyphenated: boolean;
}

/* ───────────────────────── measurement ───────────────────────── */

export function graphemes(text: string) {
  return [...text].length;
}

/** Advance width in mm. Tracking is applied between glyphs, not after the last one. */
export function measure(m: Measurer, text: string, style: TextStyle, sizeMm: number) {
  const t = trackingOf(style, sizeMm);
  const n = graphemes(text);
  return m.width(text, style.font) * sizeMm + (n > 1 ? t * sizeMm * (n - 1) : 0);
}

/* ───────────────────────── line breaking ───────────────────────── */

function fragments(paragraph: string, locale: TypeLocale | false): Fragment[] {
  const out: Fragment[] = [];
  for (const word of paragraph.split(' ').filter(Boolean)) {
    // Existing hyphens and slashes are break opportunities that need no extra glyph.
    const pieces = word.split(/(?<=[\p{L}\d][-–/])(?=\p{L})/u);
    pieces.forEach((piece, pi) => {
      const sylls = locale ? syllables(piece, locale) : [piece];
      sylls.forEach((s, si) => {
        const lastSyll = si === sylls.length - 1;
        out.push({
          text: s,
          wordEnd: lastSyll && pi === pieces.length - 1,
          needsHyphen: !lastSyll,
        });
      });
    });
  }
  return out;
}

function lineText(frags: Fragment[], from: number, to: number) {
  let s = '';
  for (let i = from; i < to; i++) {
    s += frags[i].text;
    if (i < to - 1 && frags[i].wordEnd) s += ' ';
  }
  const last = frags[to - 1];
  return { text: last.needsHyphen ? s + '-' : s, hyphenated: last.needsHyphen };
}

export interface BreakOptions {
  maxLines: number;
  /** Treat the last line like the others: produces even, balanced lines for titles. */
  balance?: boolean;
  hyphenate: TypeLocale | false;
}

/**
 * Optimal-fit line breaking (a compact Knuth–Plass): minimise squared slack
 * across lines, penalise hyphens, short last lines and stacked hyphens.
 * Returns null when no arrangement fits in maxLines without overfull lines.
 */
export function breakParagraph(
  m: Measurer,
  paragraph: string,
  style: TextStyle,
  sizeMm: number,
  width: number,
  opts: BreakOptions,
): SetLine[] | null {
  const frags = fragments(paragraph, opts.hyphenate);
  const n = frags.length;
  if (n === 0) return [{ text: '', width: 0, hyphenated: false }];
  const L = opts.maxLines;
  const INF = Number.POSITIVE_INFINITY;
  // cost[k][j]: best cost to set the first j fragments in exactly k lines.
  const cost: number[][] = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(INF));
  const back: number[][] = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(-1));
  const hyph: boolean[][] = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(false));
  cost[0][0] = 0;
  const lineCache = new Map<number, { text: string; width: number; hyphenated: boolean }>();
  const getLine = (i: number, j: number) => {
    const key = i * (n + 1) + j;
    let l = lineCache.get(key);
    if (!l) {
      const t = lineText(frags, i, j);
      l = { ...t, width: measure(m, t.text, style, sizeMm) };
      lineCache.set(key, l);
    }
    return l;
  };

  for (let k = 1; k <= L; k++) {
    for (let j = 1; j <= n; j++) {
      // Every fragment boundary is a legal break: a space, a hyphenation point or an existing hyphen.
      for (let i = j - 1; i >= 0; i--) {
        if (cost[k - 1][i] === INF) continue;
        const line = getLine(i, j);
        if (line.width > width + 1e-6) break; // longer lines only get wider
        const isLast = j === n;
        const slack = (width - line.width) / width;
        let c = isLast && !opts.balance ? 0 : slack * slack * 100;
        if (isLast && k > 1 && !opts.balance && slack > 0.75) c += 25; // stranded last word
        if (line.hyphenated) {
          c += 35;
          if (hyph[k - 1][i]) c += 60; // two hyphens in a row
        }
        const total = cost[k - 1][i] + c + 1; // +1 per line prefers fewer lines
        if (total < cost[k][j]) {
          cost[k][j] = total;
          back[k][j] = i;
          hyph[k][j] = line.hyphenated;
        }
      }
    }
  }
  let bestK = -1;
  for (let k = 1; k <= L; k++) if (cost[k][n] < INF && (bestK < 0 || cost[k][n] < cost[bestK][n])) bestK = k;
  if (bestK < 0) return null;
  const lines: SetLine[] = [];
  let j = n;
  for (let k = bestK; k > 0; k--) {
    const i = back[k][j];
    const l = getLine(i, j);
    lines.unshift({ text: l.text, width: l.width, hyphenated: l.hyphenated });
    j = i;
  }
  return lines;
}

/* ───────────────────────── fitting ───────────────────────── */

export interface FitParams {
  text: string;
  box: Box;
  style: TextStyle;
  maxPt: number;
  minPt: number;
  /** Maximum lines across all paragraphs. */
  maxLines?: number;
  /** false: every paragraph is exactly one line, the size shrinks until it fits. */
  wrap?: boolean;
  balance?: boolean;
  hyphenate?: TypeLocale | false;
  align?: Align;
  valign?: VAlign;
  locale?: TypeLocale;
}

export interface FitResult {
  ops: TextOp[];
  sizePt: number;
  lines: SetLine[];
  /** True if the text could not be set at minPt without overflowing. */
  overflow: boolean;
  /** Height from cap line of the first line to the baseline of the last. */
  blockH: number;
  /** Baseline of the last line, mm. */
  lastBaseline: number;
  firstBaseline: number;
  /** Widest set line, mm. */
  maxWidth: number;
}

function setAt(m: Measurer, text: string, p: FitParams, sizeMm: number): SetLine[] | null {
  const style = p.style;
  const paragraphs = text.split('\n');
  const maxLines = p.maxLines ?? 99;
  const out: SetLine[] = [];
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    const remaining = maxLines - out.length - (paragraphs.length - 1 - pi);
    if (remaining < 1) return null;
    if (p.wrap === false) {
      const w = measure(m, para, style, sizeMm);
      if (w > p.box.w + 1e-6) return null;
      out.push({ text: para, width: w, hyphenated: false });
    } else {
      const lines = breakParagraph(m, para, style, sizeMm, p.box.w, {
        maxLines: remaining,
        balance: p.balance,
        hyphenate: p.hyphenate ?? false,
      });
      if (!lines) return null;
      out.push(...lines);
    }
  }
  return out;
}

const blockHeight = (m: Measurer, style: TextStyle, sizeMm: number, lines: number) =>
  (m.metrics(style.font).cap + (lines - 1) * (style.leading ?? 1.2)) * sizeMm;

const STEP = 0.25;

function largestFit(m: Measurer, text: string, p: FitParams): { lines: SetLine[]; pt: number } | null {
  const fits = (pt: number) => {
    const s = ptToMm(pt);
    const lines = setAt(m, text, p, s);
    if (!lines) return null;
    return blockHeight(m, p.style, s, lines.length) <= p.box.h + 1e-6 ? lines : null;
  };
  const atMax = fits(p.maxPt);
  if (atMax) return { lines: atMax, pt: p.maxPt };
  // Binary search over quarter-point steps: the largest size that fits.
  let lo = 0;
  let hi = Math.max(0, Math.round((p.maxPt - p.minPt) / STEP));
  let best: { lines: SetLine[]; pt: number } | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const pt = p.minPt + mid * STEP;
    const r = fits(pt);
    if (r) {
      best = { lines: r, pt };
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

/**
 * Size text into a box. Biggest is not best: a heading on two clean lines
 * beats the same heading three per cent larger with a hyphen. Candidates
 * with fewer lines and no hyphenation are tried too and scored.
 */
export function fitText(m: Measurer, p: FitParams): FitResult {
  const text = p.style.caps ? upper(p.text, p.locale ?? 'en') : p.text;
  const maxLines = p.maxLines ?? 99;
  const variants: FitParams[] = [p];
  if (p.wrap !== false && maxLines <= 6) {
    for (let k = 1; k < maxLines; k++) variants.push({ ...p, maxLines: k });
    if (p.hyphenate) for (let k = 1; k <= maxLines; k++) variants.push({ ...p, maxLines: k, hyphenate: false });
  }
  let chosen: { lines: SetLine[]; pt: number } | null = null;
  let bestScore = -1;
  for (const v of variants) {
    const r = largestFit(m, text, v);
    if (!r) continue;
    const hyphens = r.lines.filter((l) => l.hyphenated).length;
    const score = r.pt * (1 - 0.06 * (r.lines.length - 1)) * Math.pow(0.82, hyphens);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      chosen = r;
    }
  }
  if (!chosen) return place(m, forceSet(m, text, p, ptToMm(p.minPt)), p, p.minPt, true);
  return place(m, chosen.lines, p, chosen.pt, false);
}

/** At minimum size and still overflowing: keep what fits, end the last visible line with an ellipsis. */
function forceSet(m: Measurer, text: string, p: FitParams, sizeMm: number): SetLine[] {
  const leading = p.style.leading ?? 1.2;
  const cap = m.metrics(p.style.font).cap;
  const maxByHeight = Math.max(1, Math.floor((p.box.h / sizeMm - cap) / leading) + 1);
  const maxLines = Math.min(p.maxLines ?? 99, maxByHeight);
  const lines: SetLine[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (p.wrap === false) lines.push({ text: para, width: measure(m, para, p.style, sizeMm), hyphenated: false });
    else {
      const set = breakParagraph(m, para, p.style, sizeMm, p.box.w, { maxLines: 30, hyphenate: p.hyphenate ?? false });
      if (set) lines.push(...set);
      else lines.push({ text: para, width: measure(m, para, p.style, sizeMm), hyphenated: false });
    }
  }
  const kept = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;
  return kept.map((l, i) => {
    if (l.width <= p.box.w && !(truncated && i === kept.length - 1)) return l;
    let t = l.text.replace(/-$/, '');
    while (t.length > 1 && measure(m, t + '…', p.style, sizeMm) > p.box.w) t = t.slice(0, -1);
    t = t.trimEnd() + '…';
    return { text: t, width: measure(m, t, p.style, sizeMm), hyphenated: false };
  });
}

const HANGING = new Set(['„', '“', '”', '‚', '‘', '’', '"', "'", '(', '«', '»', '‹', '›']);

function place(m: Measurer, lines: SetLine[], p: FitParams, sizePt: number, overflow: boolean): FitResult {
  const sizeMm = ptToMm(sizePt);
  const style = p.style;
  const leading = (style.leading ?? 1.2) * sizeMm;
  const cap = m.metrics(style.font).cap * sizeMm;
  const blockH = cap + (lines.length - 1) * leading;
  const valign = p.valign ?? 'top';
  const top =
    valign === 'top' ? p.box.y : valign === 'bottom' ? p.box.y + p.box.h - blockH : p.box.y + (p.box.h - blockH) / 2;
  const ops: TextOp[] = [];
  let maxWidth = 0;
  lines.forEach((line, i) => {
    const y = snapMm(top + cap + i * leading);
    let x = p.box.x;
    const align = p.align ?? 'left';
    // Align ink, not advance boxes: remove side bearings at the aligned edge.
    const ink = m.ink(line.text, style.font);
    if (align === 'left') {
      x -= ink.left * sizeMm;
      const first = line.text[0];
      if (first && HANGING.has(first)) x -= measure(m, first, style, sizeMm);
    } else if (align === 'right') {
      const rsb = (m.width(line.text, style.font) - ink.right) * sizeMm;
      x += p.box.w - line.width + rsb;
    } else {
      const inkW = (ink.right - ink.left) * sizeMm + (line.width - m.width(line.text, style.font) * sizeMm);
      x += (p.box.w - inkW) / 2 - ink.left * sizeMm;
    }
    maxWidth = Math.max(maxWidth, line.width);
    if (line.text)
      ops.push({ t: 'text', x, y, text: line.text, font: style.font, sizeMm, tracking: trackingOf(style, sizeMm), ink: style.ink ?? 'black' });
  });
  return {
    ops,
    sizePt,
    lines,
    overflow,
    blockH,
    firstBaseline: top + cap,
    lastBaseline: top + blockH,
    maxWidth,
  };
}

/** Set a single line at a fixed size. */
export function setLine(
  m: Measurer,
  text: string,
  style: TextStyle,
  sizePt: number,
  x: number,
  baseline: number,
  align: Align = 'left',
  locale: TypeLocale = 'en',
): TextOp & { width: number } {
  const t = style.caps ? upper(text, locale) : text;
  const sizeMm = ptToMm(sizePt);
  const width = measure(m, t, style, sizeMm);
  const ink = m.ink(t, style.font);
  let px = x;
  if (align === 'left') px -= ink.left * sizeMm;
  else if (align === 'right') px -= width - (m.width(t, style.font) - ink.right) * sizeMm;
  else px -= width / 2;
  return { t: 'text', x: px, y: snapMm(baseline), text: t, font: style.font, sizeMm, tracking: trackingOf(style, sizeMm), ink: style.ink ?? 'black', width };
}

export const capHeightMm = (m: Measurer, font: FontRef, sizePt: number) => m.metrics(font).cap * ptToMm(sizePt);

/** Largest size (pt) at which `text` set on one line fits `width` mm, capped at maxPt. */
export function sizeForWidth(m: Measurer, text: string, style: TextStyle, width: number, maxPt: number) {
  const at1 = measure(m, text, style, ptToMm(1));
  if (at1 <= 0) return maxPt;
  return Math.min(maxPt, Math.floor((width / at1) / STEP) * STEP);
}

/** Size (pt) whose cap height equals `mm`. */
export function sizeForCapHeight(m: Measurer, font: FontRef, mm: number) {
  return mmToPt(mm / m.metrics(font).cap);
}

/* ───────────────────────── stacks ───────────────────────── */

export interface StackLine {
  text: string;
  style: TextStyle;
  /** Extra space before this line, in multiples of the size (paragraph gap). */
  gapBefore?: number;
}

export interface StackResult {
  ops: TextOp[];
  sizePt: number;
  overflow: boolean;
  /** Per input line: set text, baseline and advance width. */
  placed: { text: string; baseline: number; x: number; width: number }[];
  blockH: number;
}

/**
 * Set several unwrapped lines at one common size, each in its own style,
 * on a shared baseline pitch. The size is the largest that fits the box.
 * Used for addresses, where wrapping a line would corrupt the address.
 */
export function fitStack(
  m: Measurer,
  input: StackLine[],
  box: Box,
  opts: { maxPt: number; minPt: number; leading: number; align?: Align; valign?: VAlign; bias?: number; locale?: TypeLocale },
): StackResult {
  const lines = input.map((l) => ({ ...l, text: l.style.caps ? upper(l.text, opts.locale ?? 'en') : l.text }));
  const height = (sizeMm: number) => {
    if (!lines.length) return 0;
    let h = m.metrics(lines[0].style.font).cap * sizeMm;
    for (let i = 1; i < lines.length; i++) h += (opts.leading + (lines[i].gapBefore ?? 0)) * sizeMm;
    return h;
  };
  const widest = (sizeMm: number) => Math.max(0, ...lines.map((l) => measure(m, l.text, l.style, sizeMm)));
  const fits = (pt: number) => {
    const s = ptToMm(pt);
    return widest(s) <= box.w + 1e-6 && height(s) <= box.h + 1e-6;
  };
  let sizePt = opts.minPt;
  let overflow = false;
  if (fits(opts.maxPt)) sizePt = opts.maxPt;
  else {
    let lo = 0;
    let hi = Math.round((opts.maxPt - opts.minPt) / STEP);
    let found = false;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const pt = opts.minPt + mid * STEP;
      if (fits(pt)) {
        sizePt = pt;
        found = true;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    overflow = !found;
  }
  const s = ptToMm(sizePt);
  const blockH = height(s);
  const valign = opts.valign ?? 'top';
  const slack = box.h - blockH;
  const top = valign === 'top' ? box.y : valign === 'bottom' ? box.y + slack : box.y + Math.max(0, slack) * (opts.bias ?? 0.5);
  const ops: TextOp[] = [];
  const placed: StackResult['placed'] = [];
  let baseline = top + (lines.length ? m.metrics(lines[0].style.font).cap * s : 0);
  lines.forEach((l, i) => {
    if (i > 0) baseline += (opts.leading + (l.gapBefore ?? 0)) * s;
    let text = l.text;
    let width = measure(m, text, l.style, s);
    if (width > box.w + 1e-6) {
      while (text.length > 1 && measure(m, text + '…', l.style, s) > box.w) text = text.slice(0, -1);
      text = text.trimEnd() + '…';
      width = measure(m, text, l.style, s);
    }
    const op = setLine(m, text, { ...l.style, caps: false }, sizePt, opts.align === 'center' ? box.x + box.w / 2 : opts.align === 'right' ? box.x + box.w : box.x, baseline, opts.align ?? 'left');
    placed.push({ text, baseline: op.y, x: op.x, width });
    if (text) {
      const { width: _w, ...rest } = op;
      ops.push(rest);
    }
  });
  return { ops, sizePt, overflow, placed, blockH };
}
