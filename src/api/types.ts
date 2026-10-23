import type { Address } from '../kinds/address/address';

export interface Organisation {
  name: string;
  address: Address;
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

export interface PrintJobRequest {
  printerId: string;
  mediaId: string;
  kind: string;
  copies: number;
  /** One PNG per label, already in feed orientation, 1-bit. */
  pages: { title: string; png: Blob; widthDots: number; lengthDots: number }[];
}

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
  error?: string;
  createdAt: number;
}

/** What still needs a server: who we are, the printers, and printing. Records live in the app's own database (`src/db`). */
export interface LabelcraftApi {
  organisation(): Promise<Organisation>;
  printers(): Promise<Printer[]>;
  print(req: PrintJobRequest, onUpdate: (job: PrintJob) => void): Promise<PrintJob>;
}
