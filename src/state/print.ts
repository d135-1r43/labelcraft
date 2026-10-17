import type { Printer } from '../api/types';
import { canvasToBlob, rasterize, toFeedOrientation } from '../engine/render';
import { kindById } from '../kinds';
import type { Rec } from '../kinds/types';
import { compose, type ComposeInput } from './compose';
import { api, useStore } from './store';

type BatchInput = Omit<ComposeInput, 'rec'> & { recs: Rec[]; printer: Printer; copies: number };

export async function printBatch({ recs, printer, copies, ...rest }: BatchInput) {
  const def = kindById(rest.kindId);
  const pages = await Promise.all(
    recs.map(async (rec) => {
      const { layout, frame } = compose({ ...rest, rec, printer });
      const raster = toFeedOrientation(rasterize(layout.ops, frame), frame);
      return { title: def.source.title(rec), png: await canvasToBlob(raster), widthDots: raster.width, lengthDots: raster.height };
    }),
  );
  return api.print({ printerId: printer.id, mediaId: rest.ks.mediaId, kind: rest.kindId, copies, pages }, (job) => useStore.getState().upsertJob(job));
}

/** The exact 300 dpi, 1-bit raster in reading orientation. */
export async function downloadPng(input: ComposeInput) {
  const { layout, frame } = compose(input);
  const blob = await canvasToBlob(rasterize(layout.ops, frame));
  const name = kindById(input.kindId).source.title(input.rec).replace(/[^\p{L}\d]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'label';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${frame.media.id}-300dpi.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
