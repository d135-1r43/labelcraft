/**
 * Pictures on labels: an uploaded logo, reduced to printer dots. A thermal
 * head prints black or nothing, so the picture is resampled to the dot grid
 * and thresholded, the way a barcode is placed: every dot decided here, none
 * left to the driver.
 */
import type { MatrixOp } from './display';
import type { Box } from './text';
import { mmToDots } from './units';

/** A decoded picture: how much ink each pixel wants, 0 (paper) to 1 (black). */
export interface Bitmap {
  w: number;
  h: number;
  ink: Float32Array;
}

const MAX_SIDE = 1024;
/** SVGs without an intrinsic size are drawn at this width. */
const SVG_FALLBACK = 512;

/** Decode an image file, flatten it onto white paper and trim the blank margin around it. */
export async function decodeBitmap(blob: Blob): Promise<Bitmap> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const iw = img.naturalWidth || SVG_FALLBACK;
    const ih = img.naturalHeight || SVG_FALLBACK;
    const scale = Math.min(1, MAX_SIDE / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const ink = new Float32Array(w * h);
    for (let i = 0; i < ink.length; i++) {
      // Rec. 709 luma: red ink reads as mid grey, as it does to the eye.
      const lum = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
      ink[i] = 1 - lum;
    }
    return trim({ w, h, ink });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Cut away rows and columns without ink, so the logo fills the space it is given. */
export function trim(b: Bitmap, threshold = 0.08): Bitmap {
  let top = b.h;
  let bottom = -1;
  let left = b.w;
  let right = -1;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++)
      if (b.ink[y * b.w + x] > threshold) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
  if (bottom < 0) return b;
  const w = right - left + 1;
  const h = bottom - top + 1;
  const ink = new Float32Array(w * h);
  for (let y = 0; y < h; y++) ink.set(b.ink.subarray((top + y) * b.w + left, (top + y) * b.w + left + w), y * w);
  return { w, h, ink };
}

/** Area-average the picture down to w × h dots and threshold it at half ink. */
export function toDots(b: Bitmap, w: number, h: number): Uint8Array {
  const bits = new Uint8Array(w * h);
  const sx = b.w / w;
  const sy = b.h / h;
  for (let y = 0; y < h; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < w; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      let sum = 0;
      let area = 0;
      for (let py = Math.floor(y0); py < Math.min(b.h, Math.ceil(y1)); py++) {
        const fy = Math.min(py + 1, y1) - Math.max(py, y0);
        for (let px = Math.floor(x0); px < Math.min(b.w, Math.ceil(x1)); px++) {
          const f = fy * (Math.min(px + 1, x1) - Math.max(px, x0));
          sum += b.ink[py * b.w + px] * f;
          area += f;
        }
      }
      bits[y * w + x] = area && sum / area >= 0.5 ? 1 : 0;
    }
  }
  return bits;
}

const dotCache = new WeakMap<Bitmap, Map<string, Uint8Array>>();

/** The picture as large as fits the box, on whole dots. Layout runs on every keystroke, so the dots are cached. */
export function placeBitmap(b: Bitmap, box: Box, opts: { align?: 'start' | 'center' | 'end'; valign?: 'start' | 'center' | 'end' } = {}): MatrixOp | null {
  const bx = Math.ceil(mmToDots(box.x));
  const by = Math.ceil(mmToDots(box.y));
  const bw = Math.floor(mmToDots(box.x + box.w)) - bx;
  const bh = Math.floor(mmToDots(box.y + box.h)) - by;
  const scale = Math.min(bw / b.w, bh / b.h);
  const w = Math.floor(b.w * scale);
  const h = Math.floor(b.h * scale);
  if (w < 4 || h < 4) return null;
  let sizes = dotCache.get(b);
  if (!sizes) dotCache.set(b, (sizes = new Map()));
  const key = `${w}×${h}`;
  let bits = sizes.get(key);
  if (!bits) sizes.set(key, (bits = toDots(b, w, h)));
  const pos = (start: number, avail: number, size: number, a: 'start' | 'center' | 'end' = 'center') =>
    a === 'start' ? start : a === 'end' ? start + avail - size : start + Math.floor((avail - size) / 2);
  return { t: 'matrix', xDots: pos(bx, bw, w, opts.align), yDots: pos(by, bh, h, opts.valign), moduleDots: 1, rowDots: 1, cols: w, rows: h, bits, ink: 'black' };
}
