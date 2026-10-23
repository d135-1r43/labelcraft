/**
 * Brother DK media. Printable dot counts follow Brother's raster command
 * reference: the head is 720 dots wide, but each tape only exposes the
 * dots listed here. Everything outside is margin the printer will not touch.
 */
export type MediaShape = 'continuous' | 'diecut' | 'round';

export interface Media {
  id: string;
  name: string;
  /** Physical tape width across the print head, mm. */
  widthMm: number;
  /** Physical label length along the feed, mm (die-cut only). */
  lengthMm?: number;
  shape: MediaShape;
  /** Printable dots across the head. */
  printableAcross: number;
  /** Printable dots along the feed (die-cut only). */
  printableAlong?: number;
  twoColor?: boolean;
  material: 'paper' | 'film';
  use: string;
}

export const MEDIA: Media[] = [
  { id: 'DK-11201', name: 'Standard address', widthMm: 29, lengthMm: 90, shape: 'diecut', printableAcross: 306, printableAlong: 991, material: 'paper', use: 'Envelopes, letters' },
  { id: 'DK-11209', name: 'Small address', widthMm: 62, lengthMm: 29, shape: 'diecut', printableAcross: 696, printableAlong: 271, material: 'paper', use: 'Envelopes, small parcels' },
  { id: 'DK-11208', name: 'Large address', widthMm: 38, lengthMm: 90, shape: 'diecut', printableAcross: 413, printableAlong: 991, material: 'paper', use: 'Envelopes, parcels' },
  { id: 'DK-11202', name: 'Shipping', widthMm: 62, lengthMm: 100, shape: 'diecut', printableAcross: 696, printableAlong: 1109, material: 'paper', use: 'Parcels, boxes' },
  { id: 'DK-11204', name: 'Multi-purpose', widthMm: 17, lengthMm: 54, shape: 'diecut', printableAcross: 165, printableAlong: 566, material: 'paper', use: 'Small assets, bins' },
  { id: 'DK-11203', name: 'File folder', widthMm: 17, lengthMm: 87, shape: 'diecut', printableAcross: 165, printableAlong: 956, material: 'paper', use: 'Folders, shelf edges' },
  { id: 'DK-11221', name: 'Square', widthMm: 23, lengthMm: 23, shape: 'diecut', printableAcross: 202, printableAlong: 202, material: 'paper', use: 'Asset tags, codes' },
  { id: 'DK-11218', name: 'Round', widthMm: 24, lengthMm: 24, shape: 'round', printableAcross: 236, printableAlong: 236, material: 'paper', use: 'Seals, day dots' },
  { id: 'DK-22205', name: 'Continuous 62 mm', widthMm: 62, shape: 'continuous', printableAcross: 696, material: 'paper', use: 'Any length' },
  { id: 'DK-22251', name: 'Continuous 62 mm black/red', widthMm: 62, shape: 'continuous', printableAcross: 696, twoColor: true, material: 'paper', use: 'Two-colour warnings' },
  { id: 'DK-22225', name: 'Continuous 38 mm', widthMm: 38, shape: 'continuous', printableAcross: 413, material: 'paper', use: 'Any length' },
  { id: 'DK-22210', name: 'Continuous 29 mm', widthMm: 29, shape: 'continuous', printableAcross: 306, material: 'paper', use: 'Any length' },
  { id: 'DK-22211', name: 'Film 29 mm', widthMm: 29, shape: 'continuous', printableAcross: 306, material: 'film', use: 'Cables, durable tags' },
  { id: 'DK-22212', name: 'Film 62 mm', widthMm: 62, shape: 'continuous', printableAcross: 696, material: 'film', use: 'Durable, water-resistant' },
];

export const mediaById = (id: string): Media => MEDIA.find((m) => m.id === id) ?? MEDIA[0];

/** Brother feeds roughly 3 mm of blank tape at the start and end of continuous labels. */
export const CONTINUOUS_FEED_MARGIN_MM = 3;
export const MIN_CONTINUOUS_MM = 25;
export const MAX_CONTINUOUS_MM = 300;
