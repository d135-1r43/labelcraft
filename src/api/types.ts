import type { Address } from '../kinds/address/address';

export interface Organisation {
  name: string;
  address: Address;
  inventoryUrl: string;
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

export interface Contact extends Address {
  id: string;
  /** Free note shown only in Labelcraft, never printed. */
  note?: string;
  group: string;
}

export interface InventoryItem {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  model?: string;
  serial?: string;
  location: string;
  owner?: string;
  purchased: string;
  updatedAt: string;
}

export interface StorageLocation {
  id: string;
  /** Hierarchical code segments, e.g. aisle A, rack 03, shelf 2. */
  segments: { label: string; value: string }[];
  area: string;
  contents: string;
  /** Where the location is relative to the label. */
  arrow?: 'up' | 'down' | 'left' | 'right';
  sku?: string;
}

/** EU Regulation 1169/2011 Annex II, with the letter codes German kitchens use. */
export type AllergenCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'L' | 'M' | 'N' | 'O' | 'P' | 'R';

export interface FoodProduct {
  id: string;
  name: string;
  category: string;
  shelfLifeHours: number;
  storage: 'chilled' | 'frozen' | 'ambient';
  allergens: AllergenCode[];
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

export interface LabelcraftApi {
  organisation(): Promise<Organisation>;
  printers(): Promise<Printer[]>;
  contacts(): Promise<Contact[]>;
  inventory(): Promise<InventoryItem[]>;
  locations(): Promise<StorageLocation[]>;
  foodProducts(): Promise<FoodProduct[]>;
  print(req: PrintJobRequest, onUpdate: (job: PrintJob) => void): Promise<PrintJob>;
}
