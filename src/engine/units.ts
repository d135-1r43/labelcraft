/** Brother QL print heads resolve 300 dots per inch across the tape. */
export const DPI = 300;
export const DOTS_PER_MM = DPI / 25.4;

export const mmToDots = (mm: number) => mm * DOTS_PER_MM;
export const dotsToMm = (dots: number) => dots / DOTS_PER_MM;
export const ptToMm = (pt: number) => (pt * 25.4) / 72;
export const mmToPt = (mm: number) => (mm * 72) / 25.4;

/** Snap a millimetre coordinate onto the printer's dot grid. */
export const snapMm = (mm: number) => dotsToMm(Math.round(mmToDots(mm)));

export const fmtMm = (mm: number, digits = 1) =>
  `${mm.toLocaleString('en', { maximumFractionDigits: digits, minimumFractionDigits: 0 })} mm`;
