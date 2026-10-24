import type { Bitmap } from '../engine/bitmap';
import type { Address } from '../kinds/address/address';

export interface Organisation {
  name: string;
  address: Address;
  /** When the logo was uploaded; absent without one. */
  logoUpdatedAt?: string;
  /** The logo, decoded in the browser. Never sent. */
  logo?: Bitmap;
}

export type PrinterStatus = 'ready' | 'printing' | 'offline' | 'cover-open' | 'no-media';

export interface Printer {
  id: string;
  name: string;
  model: string;
  location: string;
  connection: 'Wi-Fi' | 'USB' | 'Ethernet';
  status: PrinterStatus;
  /** The roll the printer reports as loaded. */
  loadedMedia: string;
  /** Remaining length on continuous rolls, or labels left on die-cut rolls. */
  remaining?: string;
}

/** The physical label in reading orientation, and where the printable raster sits on it. */
export interface PageGeometry {
  widthMm: number;
  heightMm: number;
  offsetXMm: number;
  offsetYMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
}

export interface PrintJobRequest {
  printerId: string;
  mediaId: string;
  kind: string;
  copies: number;
  geometry: PageGeometry;
  /** One title per label; raster mode adds a 1-bit PNG per label at 300 dpi, in reading orientation. */
  pages: { title: string; png?: Blob }[];
  /** Vector mode: the finished PDF, one page per label and copy. */
  document?: Blob;
}

/** Raster: the server places the dots as previewed. Vector: outlines, rasterized by the driver. */
export type PdfMode = 'raster' | 'vector';

export type JobState = 'queued' | 'printing' | 'done' | 'failed';

export interface PrintJob {
  id: string;
  printerId: string;
  printerName: string;
  kind: string;
  title: string;
  total: number;
  printed: number;
  state: JobState;
  mode?: PdfMode;
  error?: string;
  createdAt: number;
  /** The labels as a PDF at their physical size, once the job is done. */
  pdfUrl?: string;
}

/** What the Labeleur server provides besides records: who we are, the printers, and printing. */
export interface LabeleurApi {
  organisation(): Promise<Organisation>;
  printers(): Promise<Printer[]>;
  jobs(): Promise<PrintJob[]>;
  print(req: PrintJobRequest, onUpdate: (job: PrintJob) => void): Promise<PrintJob>;
}
