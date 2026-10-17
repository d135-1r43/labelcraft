import type { FontRef } from './display';

/**
 * A type system is a curated, pre-tuned family pairing. People choose a
 * system, never a loose font: weights, tracking and leading are tuned per
 * system for 300 dpi thermal output.
 */
export interface TypeSystem {
  id: string;
  name: string;
  description: string;
  roles: {
    /** Running text: address lines, descriptions. */
    text: FontRef;
    /** Emphasised text: names, titles. */
    strong: FontRef;
    /** Large display figures and codes on location labels. */
    display: FontRef;
    /** Identifiers: asset tags, serial numbers. */
    code: FontRef;
    codeStrong: FontRef;
    /** Letterspaced capitals for field captions. */
    caption: FontRef;
  };
  /** Leading as a multiple of the font size. */
  leading: number;
  /** Tracking for all-caps settings, em. */
  capsTracking: number;
  /** Smallest size this system stays legible at on thermal paper, pt. */
  minPt: number;
}

export const TYPE_SYSTEMS: TypeSystem[] = [
  {
    id: 'plex',
    name: 'Plex Industrial',
    description: 'Engineered grotesque with a true condensed cut and a mono for identifiers. The all-rounder.',
    roles: {
      text: { family: 'IBM Plex Sans', weight: 400 },
      strong: { family: 'IBM Plex Sans', weight: 600 },
      display: { family: 'IBM Plex Sans Condensed', weight: 700 },
      code: { family: 'IBM Plex Mono', weight: 500 },
      codeStrong: { family: 'IBM Plex Mono', weight: 600 },
      caption: { family: 'IBM Plex Sans', weight: 600 },
    },
    leading: 1.2,
    capsTracking: 0.07,
    minPt: 5.5,
  },
  {
    id: 'atkinson',
    name: 'Hyperlegible',
    description: 'Drawn for low-vision readers: unambiguous I l 1, open counters. Best for kitchens and warehouses.',
    roles: {
      text: { family: 'Atkinson Hyperlegible Next', weight: 400 },
      strong: { family: 'Atkinson Hyperlegible Next', weight: 700 },
      display: { family: 'Atkinson Hyperlegible Next', weight: 800 },
      code: { family: 'Atkinson Hyperlegible Mono', weight: 500 },
      codeStrong: { family: 'Atkinson Hyperlegible Mono', weight: 700 },
      caption: { family: 'Atkinson Hyperlegible Next', weight: 700 },
    },
    leading: 1.22,
    capsTracking: 0.06,
    minPt: 6,
  },
  {
    id: 'source',
    name: 'Correspondence',
    description: 'Source Serif names over Source Sans details. For letters and invitations that should feel written, not printed.',
    roles: {
      text: { family: 'Source Sans 3', weight: 400 },
      strong: { family: 'Source Serif 4', weight: 600 },
      display: { family: 'Source Serif 4', weight: 700 },
      code: { family: 'Source Sans 3', weight: 600 },
      codeStrong: { family: 'Source Sans 3', weight: 700 },
      caption: { family: 'Source Sans 3', weight: 600 },
    },
    leading: 1.18,
    capsTracking: 0.08,
    minPt: 6,
  },
];

export const typeSystemById = (id: string) => TYPE_SYSTEMS.find((t) => t.id === id) ?? TYPE_SYSTEMS[0];

export const fontCss = (f: FontRef, sizePx: number) =>
  `${f.style === 'italic' ? 'italic ' : ''}${f.weight} ${sizePx}px "${f.family}"`;

export interface FontMetrics {
  /** All in em. */
  cap: number;
  xHeight: number;
  ascent: number;
  descent: number;
}

/** Text measurement, injectable so layout can be tested without a browser. */
export interface Measurer {
  /** Advance width of `text` at 1 em, without tracking. */
  width(text: string, font: FontRef): number;
  metrics(font: FontRef): FontMetrics;
  /** Ink extent relative to the pen origin at 1 em: left side bearing and right ink edge. */
  ink(text: string, font: FontRef): { left: number; right: number };
}

const REF = 1000;

export function createCanvasMeasurer(): Measurer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.fontKerning = 'normal';
  const widths = new Map<string, number>();
  const metrics = new Map<string, FontMetrics>();
  const inks = new Map<string, { left: number; right: number }>();
  return {
    ink(text, font) {
      const key = `${font.family}|${font.weight}|${font.style ?? ''}|${text}`;
      let r = inks.get(key);
      if (!r) {
        ctx.font = fontCss(font, REF);
        const m = ctx.measureText(text);
        r = { left: -m.actualBoundingBoxLeft / REF, right: m.actualBoundingBoxRight / REF };
        inks.set(key, r);
      }
      return r;
    },
    width(text, font) {
      const key = `${font.family}|${font.weight}|${font.style ?? ''}|${text}`;
      let w = widths.get(key);
      if (w === undefined) {
        ctx.font = fontCss(font, REF);
        w = ctx.measureText(text).width / REF;
        widths.set(key, w);
      }
      return w;
    },
    metrics(font) {
      const key = `${font.family}|${font.weight}|${font.style ?? ''}`;
      let m = metrics.get(key);
      if (!m) {
        ctx.font = fontCss(font, REF);
        const h = ctx.measureText('H');
        const x = ctx.measureText('x');
        m = {
          cap: h.actualBoundingBoxAscent / REF,
          xHeight: x.actualBoundingBoxAscent / REF,
          ascent: h.fontBoundingBoxAscent / REF,
          descent: h.fontBoundingBoxDescent / REF,
        };
        metrics.set(key, m);
      }
      return m;
    },
  };
}

/** Includes the latin-ext glyphs addresses need, so every unicode-range subset gets fetched. */
const SAMPLE = 'Hxg0123ÄÖÜäöüßẞéèêçñøåłńšžő–—„“”‚‘’…·×→↑↓€°';

export async function loadFonts(): Promise<void> {
  const refs = new Map<string, FontRef>();
  for (const ts of TYPE_SYSTEMS) for (const f of Object.values(ts.roles)) refs.set(fontCss(f, 16), f);
  await Promise.all([...refs.keys()].map((css) => document.fonts.load(css, SAMPLE)));
  await document.fonts.ready;
}
