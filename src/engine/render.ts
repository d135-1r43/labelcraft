import type { DrawOp, Ink } from './display';
import { fontCss } from './fonts';
import type { Frame } from './frame';
import { DOTS_PER_MM } from './units';

export type RenderMode = 'vector' | 'dots';

const SCREEN_INK: Record<Ink, string> = { black: '#111214', red: '#d0202e', paper: '#ffffff' };
/** Raster colours chosen so the threshold pass can tell red from black unambiguously. */
const RASTER_INK: Record<Ink, string> = { black: '#000000', red: '#ff0000', paper: '#ffffff' };

const supportsLetterSpacing = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;

function drawText(ctx: CanvasRenderingContext2D, op: Extract<DrawOp, { t: 'text' }>, scale: number) {
  const px = op.sizeMm * scale;
  ctx.font = fontCss(op.font, px);
  const track = op.tracking * px;
  if (!track) {
    if (supportsLetterSpacing) ctx.letterSpacing = '0px';
    ctx.fillText(op.text, op.x * scale, op.y * scale);
  } else if (supportsLetterSpacing) {
    ctx.letterSpacing = `${track}px`;
    ctx.fillText(op.text, op.x * scale, op.y * scale);
    ctx.letterSpacing = '0px';
  } else {
    let x = op.x * scale;
    for (const ch of op.text) {
      ctx.fillText(ch, x, op.y * scale);
      x += ctx.measureText(ch).width + track;
    }
  }
}

function drawOps(ctx: CanvasRenderingContext2D, ops: DrawOp[], scale: number, palette: Record<Ink, string>, snap: boolean) {
  const dotPx = scale / DOTS_PER_MM;
  const s = (mm: number) => (snap ? Math.round(mm * DOTS_PER_MM) * dotPx : mm * scale);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fontKerning = 'normal';
  for (const op of ops) {
    ctx.fillStyle = palette[op.ink];
    ctx.strokeStyle = palette[op.ink];
    switch (op.t) {
      case 'text':
        drawText(ctx, op, scale);
        break;
      case 'rect': {
        const x = s(op.x);
        const y = s(op.y);
        const w = s(op.x + op.w) - x;
        const h = s(op.y + op.h) - y;
        ctx.beginPath();
        if (op.radius) ctx.roundRect(x, y, w, h, op.radius * scale);
        else ctx.rect(x, y, w, h);
        if (op.stroke) {
          ctx.lineWidth = Math.max(dotPx, op.stroke * scale);
          ctx.stroke();
        } else ctx.fill();
        break;
      }
      case 'line': {
        // Rules are axis-aligned and land on whole dots.
        const w = op.dots * dotPx;
        if (op.y1 === op.y2) {
          const y = Math.round(op.y1 * DOTS_PER_MM - op.dots / 2) * dotPx;
          ctx.fillRect(s(op.x1), y, s(op.x2) - s(op.x1), w);
        } else {
          const x = Math.round(op.x1 * DOTS_PER_MM - op.dots / 2) * dotPx;
          ctx.fillRect(x, s(op.y1), w, s(op.y2) - s(op.y1));
        }
        break;
      }
      case 'poly': {
        ctx.beginPath();
        op.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'matrix': {
        const mw = op.moduleDots * dotPx;
        const mh = op.rowDots * dotPx;
        const ox = op.xDots * dotPx;
        const oy = op.yDots * dotPx;
        for (let r = 0; r < op.rows; r++) {
          let run = -1;
          for (let c = 0; c <= op.cols; c++) {
            const on = c < op.cols && op.bits[r * op.cols + c] === 1;
            if (on && run < 0) run = c;
            if (!on && run >= 0) {
              // Draw whole runs so adjacent modules never show hairline seams on screen.
              // Overlap rows by a fraction of a pixel; anti-aliased edges would otherwise leave seams.
              ctx.fillRect(ox + run * mw, oy + r * mh, (c - run) * mw, mh + (snap ? 0 : 0.35));
              run = -1;
            }
          }
        }
        break;
      }
    }
  }
}

function clipShape(ctx: CanvasRenderingContext2D, frame: Frame, scale: number) {
  if (frame.shape !== 'round') return;
  // The round die-cut is centred on the printable square.
  const r = (Math.min(frame.physW, frame.physH) / 2) * scale;
  ctx.beginPath();
  ctx.arc((frame.wMm / 2) * scale, (frame.hMm / 2) * scale, r, 0, Math.PI * 2);
  ctx.clip();
}

/** Anti-aliased rendering for the editing canvas. */
export function renderVector(ctx: CanvasRenderingContext2D, ops: DrawOp[], frame: Frame, scale: number) {
  ctx.save();
  clipShape(ctx, frame, scale);
  drawOps(ctx, ops, scale, SCREEN_INK, false);
  ctx.restore();
}

/**
 * Exactly what the print head will burn: one canvas pixel per dot, every
 * pixel either paper, black or (on two-colour tape) red.
 */
export function rasterize(ops: DrawOp[], frame: Frame): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = frame.wDots;
  canvas.height = frame.hDots;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  clipShape(ctx, frame, DOTS_PER_MM);
  drawOps(ctx, ops, DOTS_PER_MM, RASTER_INK, true);
  ctx.restore();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const twoColor = !!frame.media.twoColor;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // Red ink over paper at coverage a gives redness = 255·a; black gives luminance 255·(1−a).
    // A dot burns when its coverage reaches one half.
    const redness = r - Math.max(g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let out: 0 | 1 | 2 = 0;
    if (redness >= 128) out = twoColor ? 2 : 1;
    else if (lum < 128) out = 1;
    d[i] = out === 2 ? 208 : out === 1 ? 0 : 255;
    d[i + 1] = out === 2 ? 32 : out === 1 ? 0 : 255;
    d[i + 2] = out === 2 ? 46 : out === 1 ? 0 : 255;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Count of burned dots, used to estimate print-head energy and to detect empty labels. */
export function inkCoverage(raster: HTMLCanvasElement) {
  const ctx = raster.getContext('2d', { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, raster.width, raster.height).data;
  let on = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 1] < 128) on++;
  return on / (raster.width * raster.height);
}

/** Rotate a reading-orientation raster into feed orientation (head axis horizontal). */
export function toFeedOrientation(raster: HTMLCanvasElement, frame: Frame): HTMLCanvasElement {
  if (!frame.readAlong) return raster;
  const c = document.createElement('canvas');
  c.width = raster.height;
  c.height = raster.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(raster, 0, 0);
  return c;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
