import { CONTINUOUS_FEED_MARGIN_MM, MAX_CONTINUOUS_MM, MIN_CONTINUOUS_MM, type Media, type MediaShape } from './media';
import { dotsToMm, mmToDots } from './units';

/**
 * The frame is the printable area in reading orientation. Layout happens in
 * millimetres with (0,0) at the top-left printable dot.
 */
export interface Frame {
  media: Media;
  shape: MediaShape;
  /** Printable size in dots, reading orientation. */
  wDots: number;
  hDots: number;
  wMm: number;
  hMm: number;
  /** Physical label size, reading orientation. */
  physW: number;
  physH: number;
  /** Offset of the printable area inside the physical label. */
  offX: number;
  offY: number;
  /** True when the reading x-axis runs along the feed (raster must be rotated for the printer). */
  readAlong: boolean;
}

export interface FrameSpec {
  media: Media;
  /** Reading x-axis runs along the feed direction. */
  readAlong: boolean;
  /** Cut length for continuous tape, mm. */
  lengthMm: number;
}

export function clampLength(mm: number) {
  return Math.round(Math.min(MAX_CONTINUOUS_MM, Math.max(MIN_CONTINUOUS_MM, mm)));
}

export function makeFrame({ media, readAlong, lengthMm }: FrameSpec): Frame {
  const acrossDots = media.printableAcross;
  const acrossPhys = media.widthMm;
  let alongDots: number;
  let alongPhys: number;
  if (media.shape === 'continuous') {
    alongPhys = clampLength(lengthMm);
    alongDots = Math.round(mmToDots(alongPhys - 2 * CONTINUOUS_FEED_MARGIN_MM));
  } else {
    alongPhys = media.lengthMm!;
    alongDots = media.printableAlong!;
  }
  const wDots = readAlong ? alongDots : acrossDots;
  const hDots = readAlong ? acrossDots : alongDots;
  const physW = readAlong ? alongPhys : acrossPhys;
  const physH = readAlong ? acrossPhys : alongPhys;
  const wMm = dotsToMm(wDots);
  const hMm = dotsToMm(hDots);
  return {
    media,
    shape: media.shape,
    wDots,
    hDots,
    wMm,
    hMm,
    physW,
    physH,
    offX: (physW - wMm) / 2,
    offY: (physH - hMm) / 2,
    readAlong,
  };
}

/** For die-cut media, the orientation that reads landscape (wider than tall). */
export function landscapeReadAlong(media: Media) {
  if (media.shape === 'continuous') return true;
  return (media.lengthMm ?? 0) > media.widthMm;
}
