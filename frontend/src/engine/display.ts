/** A label is compiled into a flat display list. All coordinates are mm in reading orientation. */
/** `paper` knocks out: white drawn over black, e.g. arrows in a solid block. */
export type Ink = 'black' | 'red' | 'paper';

export interface FontRef {
  family: string;
  weight: number;
  style?: 'normal' | 'italic';
}

export interface TextOp {
  t: 'text';
  x: number;
  /** Baseline. */
  y: number;
  text: string;
  font: FontRef;
  sizeMm: number;
  /** Additional spacing between glyphs, in em. */
  tracking: number;
  ink: Ink;
}

export interface RectOp {
  t: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  ink: Ink;
  /** Undefined → filled; otherwise stroke width in mm. */
  stroke?: number;
  radius?: number;
}

export interface LineOp {
  t: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Stroke width in dots: rules must land on whole dots to stay crisp. */
  dots: number;
  ink: Ink;
}

export interface PolyOp {
  t: 'poly';
  points: [number, number][];
  ink: Ink;
}

/** Barcode modules placed on the dot grid. Positions and sizes are in printer dots. */
export interface MatrixOp {
  t: 'matrix';
  xDots: number;
  yDots: number;
  /** Width of one module column, in dots. */
  moduleDots: number;
  /** Height of one module row, in dots (linear barcodes use a single tall row). */
  rowDots: number;
  cols: number;
  rows: number;
  /** Row-major, 1 = dark. */
  bits: Uint8Array;
  ink: Ink;
  /** Symbology name, for inspection. */
  name?: string;
}

export type DrawOp = TextOp | RectOp | LineOp | PolyOp | MatrixOp;

export type Severity = 'error' | 'warn' | 'info';

export interface Issue {
  id: string;
  severity: Severity;
  message: string;
  detail?: string;
  /** A one-click correction the UI can offer. */
  fix?: { label: string; action: FixAction };
}

export type FixAction =
  | { type: 'media'; mediaId: string }
  | { type: 'length'; lengthMm: number }
  | { type: 'option'; key: string; value: unknown }
  | { type: 'rotate' };

export interface LabelLayout {
  ops: DrawOp[];
  issues: Issue[];
  /** Continuous tape: the length the content wants, if the template can compute it. */
  preferredLengthMm?: number;
}
