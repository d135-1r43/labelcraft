import type { PdfMode, Printer } from '../api/types';
import { vectorPdf } from '../engine/pdf';
import { canvasToBlob, rasterize } from '../engine/render';
import { entityById } from '../db/entities';
import { kindById } from '../kinds';
import type { Rec } from '../kinds/types';
import { compose, type ComposeInput } from './compose';
import { api, useStore } from './store';

type BatchInput = Omit<ComposeInput, 'rec'> & { recs: Rec[]; printer: Printer; copies: number; mode: PdfMode };

/**
 * Sends the batch to the server, which returns it as a PDF with one page per
 * label at the label's physical size, for printing through the Brother driver.
 */
export async function printBatch({ recs, printer, copies, mode, ...rest }: BatchInput) {
  const entity = entityById(kindById(rest.kindId).entity);
  const composed = recs.map((rec) => ({ title: entity.title(rec), ...compose({ ...rest, rec, printer }) }));
  const frame = composed[0].frame;
  let document: Blob | undefined;
  let pages: { title: string; png?: Blob }[];
  if (mode === 'vector') {
    const title = composed.length === 1 ? composed[0].title : `${composed[0].title} + ${composed.length - 1} more`;
    const bytes = await vectorPdf(composed.map((c) => ({ title: c.title, ops: c.layout.ops, frame: c.frame })), copies, title);
    document = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    pages = composed.map((c) => ({ title: c.title }));
  } else {
    pages = await Promise.all(composed.map(async ({ title, layout, frame: f }) => ({ title, png: await canvasToBlob(rasterize(layout.ops, f)) })));
  }
  return api.print(
    {
      printerId: printer.id,
      mediaId: rest.ks.mediaId,
      kind: rest.kindId,
      copies,
      geometry: {
        widthMm: frame.physW,
        heightMm: frame.physH,
        offsetXMm: Math.max(0, frame.offX),
        offsetYMm: Math.max(0, frame.offY),
        printableWidthMm: frame.wMm,
        printableHeightMm: frame.hMm,
      },
      pages,
      document,
    },
    (job) => useStore.getState().upsertJob(job),
  );
}

/** The exact 300 dpi, 1-bit raster in reading orientation. */
export async function downloadPng(input: ComposeInput) {
  const { layout, frame } = compose(input);
  const blob = await canvasToBlob(rasterize(layout.ops, frame));
  const name = entityById(kindById(input.kindId).entity).title(input.rec).replace(/[^\p{L}\d]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'label';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${frame.media.id}-300dpi.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
