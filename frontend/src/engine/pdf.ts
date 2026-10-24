/**
 * The label as a vector PDF: text as glyph outlines, shapes as paths, so the
 * printer driver rasterizes at its own resolution. Barcodes stay images on
 * the 300 dpi dot grid, because a module that lands between dots prints at
 * the wrong width.
 */
import fontkit from '@pdf-lib/fontkit';
import {
  appendBezierCurve,
  appendQuadraticCurve,
  clip,
  closePath,
  endPath,
  fill,
  lineTo,
  moveTo,
  PDFDocument,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  popGraphicsState,
  PrintScaling,
  pushGraphicsState,
  rectangle,
  setFillingRgbColor,
} from 'pdf-lib';
import type { DrawOp, FontRef, Ink, MatrixOp, TextOp } from './display';
import { FONT_FILES } from './fontFiles';
import type { Frame } from './frame';
import { DOTS_PER_MM } from './units';

const PT_PER_MM = 72 / 25.4;
const INK: Record<Ink, [number, number, number]> = { black: [0, 0, 0], red: [1, 0, 0], paper: [1, 1, 1] };
/** Bézier handle length for a quarter circle. */
const KAPPA = 0.5523;

type Font = ReturnType<typeof fontkit.create>;
const fontCache = new Map<string, Promise<Font>>();

function loadFont(url: string) {
  let f = fontCache.get(url);
  if (!f) {
    f = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => fontkit.create(new Uint8Array(b)));
    fontCache.set(url, f);
  }
  return f;
}

/** The files of one weight, Latin first, then Latin Extended. */
async function fontsFor(ref: FontRef) {
  const urls = FONT_FILES[`${ref.family}|${ref.weight}`];
  if (!urls) throw new Error(`${ref.family} ${ref.weight} is not bundled`);
  return Promise.all(urls.map(loadFont));
}

/** Draws in label millimetres, y down, from the printable area's top-left dot. */
class Pen {
  readonly ops: PDFOperator[] = [];

  constructor(
    private readonly frame: Frame,
    private readonly pageH: number,
  ) {}

  private X = (mm: number) => (this.frame.offX + mm) * PT_PER_MM;
  private Y = (mm: number) => this.pageH - (this.frame.offY + mm) * PT_PER_MM;

  ink(ink: Ink) {
    this.ops.push(setFillingRgbColor(...INK[ink]));
  }
  move(x: number, y: number) {
    this.ops.push(moveTo(this.X(x), this.Y(y)));
  }
  line(x: number, y: number) {
    this.ops.push(lineTo(this.X(x), this.Y(y)));
  }
  quad(cx: number, cy: number, x: number, y: number) {
    this.ops.push(appendQuadraticCurve(this.X(cx), this.Y(cy), this.X(x), this.Y(y)));
  }
  cubic(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.ops.push(appendBezierCurve(this.X(c1x), this.Y(c1y), this.X(c2x), this.Y(c2y), this.X(x), this.Y(y)));
  }
  close() {
    this.ops.push(closePath());
  }
  rect(x: number, y: number, w: number, h: number) {
    this.ops.push(rectangle(this.X(x), this.Y(y + h), w * PT_PER_MM, h * PT_PER_MM));
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    const k = r * (1 - KAPPA);
    this.move(x + r, y);
    this.line(x + w - r, y);
    this.cubic(x + w - k, y, x + w, y + k, x + w, y + r);
    this.line(x + w, y + h - r);
    this.cubic(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h);
    this.line(x + r, y + h);
    this.cubic(x + k, y + h, x, y + h - k, x, y + h - r);
    this.line(x, y + r);
    this.cubic(x, y + k, x + k, y, x + r, y);
    this.close();
  }
  circle(cx: number, cy: number, r: number) {
    const k = r * KAPPA;
    this.move(cx + r, cy);
    this.cubic(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
    this.cubic(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
    this.cubic(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
    this.cubic(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
    this.close();
  }
  fill() {
    this.ops.push(fill());
  }
  clip() {
    this.ops.push(clip(), endPath());
  }
  push(op: PDFOperator) {
    this.ops.push(op);
  }
}

/** Snap to the dot grid, as the raster does, so rules and boxes keep their exact width. */
const snap = (mm: number) => Math.round(mm * DOTS_PER_MM) / DOTS_PER_MM;

async function drawText(pen: Pen, op: TextOp) {
  const fonts = await fontsFor(op.font);
  // Soft hyphens only mark break opportunities; the engine sets visible hyphens itself.
  const text = op.text.replace(/­/g, '');
  // Split into runs by the font file that has the glyphs. Kerning holds within a run.
  const runs: { font: Font; text: string }[] = [];
  for (const ch of text) {
    const font = fonts.find((f) => f.hasGlyphForCodePoint(ch.codePointAt(0)!)) ?? fonts[0];
    const last = runs[runs.length - 1];
    if (last?.font === font) last.text += ch;
    else runs.push({ font, text: ch });
  }
  let x = op.x;
  const track = op.tracking * op.sizeMm;
  for (const run of runs) {
    const scale = op.sizeMm / run.font.unitsPerEm;
    // Browsers drop ligatures in letterspaced text; match the preview.
    const glyphs = run.font.layout(run.text, track ? { liga: false, clig: false } : undefined);
    glyphs.glyphs.forEach((glyph, i) => {
      const pos = glyphs.positions[i];
      const ox = x + pos.xOffset * scale;
      const oy = op.y - pos.yOffset * scale;
      const gx = (fx: number) => ox + fx * scale;
      const gy = (fy: number) => oy - fy * scale;
      // fontkit replays the outline onto anything shaped like a canvas context.
      glyph.path.toFunction()({
        moveTo: (a: number, b: number) => pen.move(gx(a), gy(b)),
        lineTo: (a: number, b: number) => pen.line(gx(a), gy(b)),
        quadraticCurveTo: (c: number, d: number, a: number, b: number) => pen.quad(gx(c), gy(d), gx(a), gy(b)),
        bezierCurveTo: (c1: number, d1: number, c2: number, d2: number, a: number, b: number) => pen.cubic(gx(c1), gy(d1), gx(c2), gy(d2), gx(a), gy(b)),
        closePath: () => pen.close(),
      });
      x += pos.xAdvance * scale + track;
    });
  }
  pen.fill();
}

/** One image per barcode, one pixel per printer dot. */
async function matrixImage(doc: PDFDocument, op: MatrixOp) {
  const canvas = document.createElement('canvas');
  canvas.width = op.cols * op.moduleDots;
  canvas.height = op.rows * op.rowDots;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = op.ink === 'red' ? '#f00' : op.ink === 'paper' ? '#fff' : '#000';
  for (let r = 0; r < op.rows; r++) for (let c = 0; c < op.cols; c++) if (op.bits[r * op.cols + c]) ctx.fillRect(c * op.moduleDots, r * op.rowDots, op.moduleDots, op.rowDots);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
  return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
}

async function drawLabel(doc: PDFDocument, page: PDFPage, ops: DrawOp[], frame: Frame) {
  const pageH = frame.physH * PT_PER_MM;
  const pen = new Pen(frame, pageH);
  pen.push(pushGraphicsState());
  if (frame.shape === 'round') {
    pen.circle(frame.wMm / 2, frame.hMm / 2, Math.min(frame.physW, frame.physH) / 2);
    pen.clip();
  }
  const images: { op: MatrixOp; image: Awaited<ReturnType<typeof matrixImage>> }[] = [];
  for (const op of ops) {
    if (op.t === 'matrix') {
      images.push({ op, image: await matrixImage(doc, op) });
      continue;
    }
    pen.ink(op.ink);
    switch (op.t) {
      case 'text':
        await drawText(pen, op);
        break;
      case 'rect': {
        const x = snap(op.x);
        const y = snap(op.y);
        const w = snap(op.x + op.w) - x;
        const h = snap(op.y + op.h) - y;
        if (op.stroke) {
          // A stroked box is the ring between the outer and the inner path.
          const s = Math.max(1 / DOTS_PER_MM, op.stroke);
          const r = op.radius ?? 0;
          pen.roundRect(x - s / 2, y - s / 2, w + s, h + s, r + s / 2);
          pen.roundRect(x + s / 2, y + s / 2, w - s, h - s, Math.max(0, r - s / 2));
          pen.push(PDFOperator.of(PDFOperatorNames.FillEvenOdd));
          break;
        } else if (op.radius) pen.roundRect(x, y, w, h, op.radius);
        else pen.rect(x, y, w, h);
        pen.fill();
        break;
      }
      case 'line': {
        const w = op.dots / DOTS_PER_MM;
        if (op.y1 === op.y2) pen.rect(snap(op.x1), Math.round(op.y1 * DOTS_PER_MM - op.dots / 2) / DOTS_PER_MM, snap(op.x2) - snap(op.x1), w);
        else pen.rect(Math.round(op.x1 * DOTS_PER_MM - op.dots / 2) / DOTS_PER_MM, snap(op.y1), w, snap(op.y2) - snap(op.y1));
        pen.fill();
        break;
      }
      case 'poly':
        op.points.forEach(([x, y], i) => (i ? pen.line(x, y) : pen.move(x, y)));
        pen.close();
        pen.fill();
        break;
    }
  }
  pen.push(popGraphicsState());
  page.pushOperators(...pen.ops);
  for (const { op, image } of images) {
    const x = (frame.offX + op.xDots / DOTS_PER_MM) * PT_PER_MM;
    const h = ((op.rows * op.rowDots) / DOTS_PER_MM) * PT_PER_MM;
    const y = pageH - (frame.offY + op.yDots / DOTS_PER_MM) * PT_PER_MM - h;
    page.drawImage(image, { x, y, width: ((op.cols * op.moduleDots) / DOTS_PER_MM) * PT_PER_MM, height: h });
  }
}

/** One page per label and copy, each the size of the physical label. */
export async function vectorPdf(labels: { title: string; ops: DrawOp[]; frame: Frame }[], copies: number, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setCreator('Labeleur');
  // The page already is the label; any scaling would change its size.
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  for (const label of labels) {
    for (let c = 0; c < copies; c++) {
      const page = doc.addPage([label.frame.physW * PT_PER_MM, label.frame.physH * PT_PER_MM]);
      await drawLabel(doc, page, label.ops, label.frame);
    }
  }
  return doc.save();
}
