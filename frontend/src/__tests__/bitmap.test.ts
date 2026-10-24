import { describe, expect, it } from 'vitest';
import { placeBitmap, toDots, trim, type Bitmap } from '../engine/bitmap';
import { mmToDots } from '../engine/units';

/** A 6 × 4 picture: a 2 × 2 black square with a blank margin around it. */
const square = (): Bitmap => {
  const ink = new Float32Array(6 * 4);
  for (const [x, y] of [[2, 1], [3, 1], [2, 2], [3, 2]]) ink[y * 6 + x] = 1;
  return { w: 6, h: 4, ink };
};

describe('logo bitmaps', () => {
  it('trims the blank margin', () => {
    const t = trim(square());
    expect([t.w, t.h]).toEqual([2, 2]);
    expect([...t.ink]).toEqual([1, 1, 1, 1]);
  });

  it('thresholds at half ink when scaling', () => {
    const b: Bitmap = { w: 4, h: 1, ink: new Float32Array([1, 0.8, 0.2, 0]) };
    expect([...toDots(b, 2, 1)]).toEqual([1, 0]);
    expect([...toDots(b, 8, 2)]).toEqual([1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]);
  });

  it('fits the box on whole dots, keeping the aspect ratio', () => {
    const op = placeBitmap({ w: 200, h: 100, ink: new Float32Array(200 * 100).fill(1) }, { x: 0, y: 0, w: 10, h: 10 })!;
    expect(op.cols).toBe(Math.floor(mmToDots(10)));
    expect(op.rows).toBe(Math.floor(op.cols / 2));
    expect(op.bits.every((b) => b === 1)).toBe(true);
  });
});
