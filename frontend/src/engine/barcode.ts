import bwip from 'bwip-js';
import type { Issue, MatrixOp } from './display';
import type { Frame } from './frame';
import type { Box } from './text';
import { dotsToMm, mmToDots } from './units';

export type Symbology = 'qr' | 'datamatrix' | 'code128';

export const SYMBOLOGY_LABEL: Record<Symbology, string> = {
  qr: 'QR code',
  datamatrix: 'Data Matrix',
  code128: 'Code 128',
};

interface Encoded {
  cols: number;
  rows: number;
  bits: Uint8Array;
  linear: boolean;
}

/** Quiet zone the symbology specifies, in modules. */
const QUIET: Record<Symbology, number> = { qr: 4, datamatrix: 1, code128: 10 };

const cache = new Map<string, Encoded | null>();

export function encode(sym: Symbology, text: string): Encoded | null {
  const key = `${sym}|${text}`;
  if (cache.has(key)) return cache.get(key)!;
  let out: Encoded | null = null;
  try {
    if (sym === 'code128') {
      const [r] = bwip.raw({ bcid: 'code128', text }) as { sbs: number[] }[];
      const widths = r.sbs;
      const cols = widths.reduce((a, b) => a + b, 0);
      const bits = new Uint8Array(cols);
      let x = 0;
      widths.forEach((w, i) => {
        if (i % 2 === 0) bits.fill(1, x, x + w);
        x += w;
      });
      out = { cols, rows: 1, bits, linear: true };
    } else {
      const [r] = bwip.raw({ bcid: sym === 'qr' ? 'qrcode' : 'datamatrix', text, eclevel: 'M' } as never) as {
        pixs: number[];
        pixx: number;
        pixy: number;
      }[];
      out = { cols: r.pixx, rows: r.pixy, bits: Uint8Array.from(r.pixs), linear: false };
    }
  } catch {
    out = null;
  }
  cache.set(key, out);
  return out;
}

export interface PlacedCode {
  op: MatrixOp | null;
  /** Actual footprint in mm (without quiet zone). */
  box: Box;
  moduleMm: number;
  issues: Issue[];
}

/**
 * Place a symbol on the dot grid. Module size is always a whole number of
 * dots: a 2.6-dot module rasterises into alternating 2- and 3-dot bars,
 * which is exactly how cheap label software produces unscannable codes.
 *
 * `box` is reserved for the code; white printable margin and unprinted label
 * edge around it count towards the quiet zone.
 */
export function placeCode(
  sym: Symbology,
  text: string,
  box: Box,
  frame: Frame,
  opts: {
    align?: 'start' | 'center' | 'end';
    valign?: 'start' | 'center' | 'end';
    maxModuleDots?: number;
    ink?: 'black' | 'red';
    /** White space the template guarantees outside the box on each side, mm. */
    clear?: { left?: number; right?: number; top?: number; bottom?: number };
  } = {},
): PlacedCode {
  const issues: Issue[] = [];
  const enc = encode(sym, text);
  if (!enc) {
    issues.push({ id: 'code-encode', severity: 'error', message: `“${text}” cannot be encoded as ${SYMBOLOGY_LABEL[sym]}.` });
    return { op: null, box, moduleMm: 0, issues };
  }
  const bx = Math.ceil(mmToDots(box.x));
  const by = Math.ceil(mmToDots(box.y));
  const bw = Math.floor(mmToDots(box.x + box.w)) - bx;
  const bh = Math.floor(mmToDots(box.y + box.h)) - by;
  const moduleDots = Math.max(1, Math.min(opts.maxModuleDots ?? 99, Math.floor(enc.linear ? bw / enc.cols : Math.min(bw / enc.cols, bh / enc.rows))));
  const rowDots = enc.linear ? bh : moduleDots;
  const wDots = enc.cols * moduleDots;
  const hDots = enc.rows * rowDots;
  const pos = (start: number, avail: number, size: number, a: 'start' | 'center' | 'end' = 'center') =>
    a === 'start' ? start : a === 'end' ? start + avail - size : start + Math.floor((avail - size) / 2);
  const xDots = pos(bx, bw, wDots, opts.align);
  const yDots = pos(by, bh, hDots, opts.valign ?? 'center');

  const op: MatrixOp = {
    t: 'matrix',
    xDots,
    yDots,
    moduleDots,
    rowDots,
    cols: enc.cols,
    rows: enc.rows,
    bits: enc.bits,
    ink: opts.ink ?? 'black',
    name: SYMBOLOGY_LABEL[sym],
  };
  const moduleMm = dotsToMm(moduleDots);
  const name = SYMBOLOGY_LABEL[sym];

  if (wDots > bw || hDots > bh) {
    issues.push({ id: 'code-too-big', severity: 'error', message: `${name} does not fit its area`, detail: `Needs ${enc.cols} modules across; there is room for ${bw} dots.` });
  }
  if (moduleDots < 2) {
    issues.push({ id: 'code-module', severity: 'error', message: `${name} modules are 1 dot wide`, detail: 'Thermal print spreads by about half a dot. Scanners will misread this. Use a larger label, shorter data or Data Matrix.' });
  } else if (moduleDots < 3) {
    issues.push({ id: 'code-module', severity: 'warn', message: `${name} modules are 2 dots (${(moduleMm).toFixed(2)} mm)`, detail: 'Readable by handheld scanners, marginal for phone cameras. 3 dots or more is reliable.' });
  }

  // Quiet zone: white space inside the reserved box plus unprinted label edge where the box touches the frame.
  const q = QUIET[sym] * moduleDots;
  // Unprinted label edge counts too, where the box reaches the printable boundary.
  const edge = (touches: boolean, extraMm: number) => (touches ? Math.floor(mmToDots(extraMm)) : 0);
  const c = opts.clear ?? {};
  const extra = (mm?: number) => Math.floor(mmToDots(mm ?? 0));
  const gaps = [
    xDots - bx + edge(bx <= 1, frame.offX) + extra(c.left),
    bx + bw - (xDots + wDots) + edge(bx + bw >= frame.wDots - 1, frame.offX) + extra(c.right),
    ...(enc.linear
      ? []
      : [yDots - by + edge(by <= 1, frame.offY) + extra(c.top), by + bh - (yDots + hDots) + edge(by + bh >= frame.hDots - 1, frame.offY) + extra(c.bottom)]),
  ];
  const minGap = Math.min(...gaps);
  if (minGap < q) {
    const sev = minGap >= q / 2 ? 'info' : 'warn';
    issues.push({
      id: 'code-quiet',
      severity: sev,
      message: `${name} quiet zone is ${Math.max(0, Math.floor(minGap / moduleDots))} of ${QUIET[sym]} modules`,
      detail: sev === 'info' ? 'Most scanners cope; the specification asks for more white space.' : 'Leave more white space around the code so scanners can find it.',
    });
  }

  return {
    op,
    box: { x: dotsToMm(xDots), y: dotsToMm(yDots), w: dotsToMm(wDots), h: dotsToMm(hDots) },
    moduleMm,
    issues,
  };
}

/** Footprint in mm of a square 2D code at a given module size, without placing it. */
export function codeModules(sym: Symbology, text: string) {
  const e = encode(sym, text);
  return e ? { cols: e.cols, rows: e.rows } : null;
}
