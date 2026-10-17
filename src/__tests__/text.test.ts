import { describe, expect, it } from 'vitest';
import type { Measurer } from '../engine/fonts';
import { breakParagraph, fitText } from '../engine/text';

// Monospaced fake: every glyph is 0.5 em.
const m: Measurer = {
  width: (t) => [...t].length * 0.5,
  metrics: () => ({ cap: 0.7, xHeight: 0.5, ascent: 0.9, descent: 0.25 }),
  ink: (t) => ({ left: 0, right: [...t].length * 0.5 }),
};
const style = { font: { family: 'x', weight: 400 } };

describe('line breaking', () => {
  it('never exceeds the measure; balance mode evens out lines', () => {
    const ragged = breakParagraph(m, 'aaa bbb ccc ddd eee fff', style, 1, 8, { maxLines: 4, hyphenate: false })!;
    for (const l of ragged) expect(l.width).toBeLessThanOrEqual(8);
    expect(ragged.map((l) => l.text)).toEqual(['aaa bbb ccc ddd', 'eee fff']);
    const balanced = breakParagraph(m, 'aaa bbb ccc ddd eee fff', style, 1, 8, { maxLines: 4, hyphenate: false, balance: true })!;
    expect(balanced.map((l) => l.text)).toEqual(['aaa bbb ccc', 'ddd eee fff']);
  });
  it('hyphenates long German words when it helps', () => {
    const lines = breakParagraph(m, 'Donaudampfschifffahrt', style, 1, 6, { maxLines: 3, hyphenate: 'de' })!;
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].text.endsWith('-')).toBe(true);
  });
  it('breaks after existing hyphens without adding one', () => {
    const lines = breakParagraph(m, 'Max-Planck-Straße', style, 1, 6, { maxLines: 3, hyphenate: false })!;
    expect(lines.map((l) => l.text)).toEqual(['Max-Planck-', 'Straße']);
  });
});

describe('fitText', () => {
  it('finds the largest size that fits', () => {
    const r = fitText(m, { text: 'Hello', box: { x: 0, y: 0, w: 10, h: 20 }, style, maxPt: 72, minPt: 4, wrap: false });
    // 5 glyphs × 0.5 em = 2.5 em ≤ 10 mm → 4 mm ≈ 11.34 pt
    expect(r.sizePt).toBeCloseTo(11.25, 2);
    expect(r.overflow).toBe(false);
  });
  it('reports overflow and ellipsises at minimum size', () => {
    const r = fitText(m, { text: 'An extremely long text that cannot fit', box: { x: 0, y: 0, w: 5, h: 2 }, style, maxPt: 10, minPt: 8, maxLines: 1 });
    expect(r.overflow).toBe(true);
    expect(r.lines[0].text.endsWith('…')).toBe(true);
  });
});
