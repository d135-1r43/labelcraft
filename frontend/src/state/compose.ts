import { useEffect, useMemo, useState } from 'react';
import type { Organisation, Printer } from '../api/types';
import type { Issue, LabelLayout } from '../engine/display';
import { createCanvasMeasurer, typeSystemById, type Measurer } from '../engine/fonts';
import { makeFrame, type Frame } from '../engine/frame';
import { mediaById } from '../engine/media';
import type { TypeLocale } from '../engine/typeset';
import { mmToPt } from '../engine/units';
import { kindById } from '../kinds';
import type { KindId, Rec } from '../kinds/types';
import type { KindState } from './store';

let measurer: Measurer | null = null;
export const getMeasurer = () => (measurer ??= createCanvasMeasurer());

export interface Composed {
  frame: Frame;
  layout: LabelLayout;
  issues: Issue[];
}

export interface ComposeInput {
  kindId: KindId;
  rec: Rec;
  ks: KindState;
  locale: TypeLocale;
  org: Organisation;
  printer?: Printer;
  now: Date;
}

/** Turn a record into a positioned label plus every preflight finding. */
export function compose({ kindId, rec, ks, locale, org, printer, now }: ComposeInput): Composed {
  const def = kindById(kindId);
  const media = mediaById(ks.mediaId);
  const frame = makeFrame({ media, readAlong: ks.readAlong, lengthMm: ks.lengthMm });
  const ts = typeSystemById(ks.typeSystemId);
  const layout = def.layout(rec, ks.options, { m: getMeasurer(), frame, ts, locale, org, now, appUrl: location.origin });
  const issues: Issue[] = [...layout.issues];

  const smallest = Math.min(...layout.ops.filter((o) => o.t === 'text').map((o) => mmToPt(o.sizeMm)));
  if (Number.isFinite(smallest) && smallest < ts.minPt - 0.01) {
    issues.push({
      id: 'type-min',
      severity: 'warn',
      message: `Smallest text is ${smallest.toFixed(2).replace(/\.?0+$/, '')} pt`,
      detail: `${ts.name} stays crisp on thermal paper from ${ts.minPt} pt. Below that, counters fill in.`,
    });
  }
  if (printer && printer.loadedMedia !== media.id) {
    const loaded = mediaById(printer.loadedMedia);
    issues.push({
      id: 'media-mismatch',
      severity: 'warn',
      message: `${printer.name} has ${loaded.id} loaded`,
      detail: `${loaded.name}, ${loaded.widthMm}${loaded.lengthMm ? ` × ${loaded.lengthMm}` : ''} mm. This label is designed for ${media.id}.`,
      fix: { label: `Switch to ${loaded.id}`, action: { type: 'media', mediaId: loaded.id } },
    });
  }
  if (!def.media.includes(media.id)) {
    issues.push({ id: 'media-unusual', severity: 'info', message: `${media.name} is unusual for ${def.name.toLowerCase()} labels`, fix: { label: `Use ${def.defaultMedia}`, action: { type: 'media', mediaId: def.defaultMedia } } });
  }
  if (frame.shape === 'continuous' && layout.preferredLengthMm && Math.abs(layout.preferredLengthMm - ks.lengthMm) > 4) {
    issues.push({
      id: 'length-fit',
      severity: 'info',
      message: `The text wants ${layout.preferredLengthMm} mm of tape`,
      fix: { label: `Cut at ${layout.preferredLengthMm} mm`, action: { type: 'length', lengthMm: layout.preferredLengthMm } },
    });
  }
  const order = { error: 0, warn: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return { frame, layout, issues };
}

/** Wall clock, ticking every 30 s, so “now” on food labels stays honest. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useComposed(input: ComposeInput | null, fontsReady: boolean): Composed | null {
  return useMemo(
    () => (input && fontsReady ? compose(input) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input?.kindId, input?.rec, input?.ks, input?.locale, input?.org, input?.printer, input?.now, fontsReady],
  );
}
