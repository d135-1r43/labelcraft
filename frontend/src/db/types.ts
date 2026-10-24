import type { Address } from '../kinds/address/address';

/** Every record Labelcraft keeps. The leading system stays the source of truth; `uri` points at the record there. */
export interface DbRecord {
  id: string;
  /** The record in its leading system (CRM, inventory, ERP …). Empty when it exists only in Labelcraft. */
  uri?: string;
  updatedAt?: string;
}

export interface Contact extends DbRecord, Address {
  /** Free note shown only in Labelcraft, never printed. */
  note?: string;
  group: string;
}

export interface InventoryItem extends DbRecord {
  assetTag: string;
  name: string;
  category: string;
  model?: string;
  serial?: string;
  location: string;
  owner?: string;
  purchased?: string;
}

export interface StorageLocation extends DbRecord {
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

export interface FoodProduct extends DbRecord {
  name: string;
  category: string;
  shelfLifeHours: number;
  storage: 'chilled' | 'frozen' | 'ambient';
  allergens: AllergenCode[];
}

/** A road case or box that travels, and what is packed in it. */
export interface Box extends DbRecord {
  title: string;
  /** One line per thing packed. */
  items: string[];
}

export interface Sign extends DbRecord {
  title: string;
  subtitle: string;
}
