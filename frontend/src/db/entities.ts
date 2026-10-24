import type { KindId } from '../kinds/types';
import type { Box, Contact, DbRecord, FoodProduct, InventoryItem, Sign, StorageLocation } from './types';

export type EntityId = 'contacts' | 'inventory' | 'locations' | 'recipes' | 'signs' | 'boxes';

/** Where an entity's records really live. Labelcraft keeps a copy; each record links back by URI. */
export interface LeadingSystem {
  name: string;
  /** Records are linked under this address. Empty: the entity lives only in Labelcraft. */
  baseUrl: string;
}

export interface EntityPrefs extends LeadingSystem {
  enabled: boolean;
}

export interface EntityDef<R extends DbRecord = DbRecord> {
  id: EntityId;
  name: string;
  noun: string;
  plural: string;
  /** Label kinds that print this entity. */
  kinds: KindId[];
  system: LeadingSystem;
  title(r: R): string;
  subtitle(r: R): string;
  group(r: R): string;
  /** The name the field for grouping goes by in the editor. */
  groupLabel: string;
  /** A key the leading system addresses the record by, for linking with one click. */
  key?(r: R): string;
  blank(): Omit<R, 'id'>;
}

export const locationCode = (l: StorageLocation) => l.segments.map((s) => s.value).join('-');

const contacts: EntityDef<Contact> = {
  id: 'contacts',
  name: 'Contacts',
  noun: 'address',
  plural: 'addresses',
  kinds: ['address'],
  system: { name: 'CRM', baseUrl: 'https://crm.nordlicht.de/contacts/' },
  title: (c) => (c.company && !c.familyName ? c.company : [c.givenName, c.familyName].filter(Boolean).join(' ') || c.company || 'Untitled address'),
  subtitle: (c) => [c.company && c.familyName ? c.company : '', c.city, c.country].filter(Boolean).join(' · '),
  group: (c) => c.group,
  groupLabel: 'Group',
  blank: () => ({ group: 'Customers', country: 'DE' }),
};

const inventory: EntityDef<InventoryItem> = {
  id: 'inventory',
  name: 'Inventory',
  noun: 'asset',
  plural: 'assets',
  kinds: ['asset'],
  system: { name: 'Inventory', baseUrl: 'https://inv.nordlicht.de/a/' },
  title: (i) => i.name || 'Untitled asset',
  subtitle: (i) => [i.assetTag, i.location].filter(Boolean).join(' · '),
  group: (i) => i.category,
  groupLabel: 'Category',
  key: (i) => i.assetTag,
  blank: () => ({ assetTag: '', name: '', category: 'Uncategorised', location: '' }),
};

const locations: EntityDef<StorageLocation> = {
  id: 'locations',
  name: 'Locations',
  noun: 'location',
  plural: 'locations',
  kinds: ['location'],
  system: { name: 'ERP', baseUrl: 'https://erp.nordlicht.de/wm/bins/' },
  title: (l) => locationCode(l) || 'New location',
  subtitle: (l) => l.contents,
  group: (l) => l.area,
  groupLabel: 'Area',
  key: (l) => locationCode(l),
  blank: () => ({
    segments: [
      { label: 'aisle', value: '' },
      { label: 'rack', value: '' },
      { label: 'shelf', value: '' },
    ],
    area: 'Unassigned',
    contents: '',
    arrow: 'down',
  }),
};

const recipes: EntityDef<FoodProduct> = {
  id: 'recipes',
  name: 'Recipes',
  noun: 'recipe',
  plural: 'recipes',
  kinds: ['food'],
  system: { name: 'Recipe book', baseUrl: 'https://kitchen.nordlicht.de/recipes/' },
  title: (p) => p.name || 'Untitled recipe',
  subtitle: (p) => {
    const h = p.shelfLifeHours;
    const life = h < 24 ? `${h} h` : `${Math.round(h / 24)} days`;
    return `${life} · ${p.storage}`;
  },
  group: (p) => p.category,
  groupLabel: 'Category',
  blank: () => ({ name: '', category: 'Uncategorised', shelfLifeHours: 72, storage: 'chilled', allergens: [] }),
};

const signs: EntityDef<Sign> = {
  id: 'signs',
  name: 'Signs',
  noun: 'sign',
  plural: 'signs',
  kinds: ['text'],
  system: { name: '', baseUrl: '' },
  title: (t) => t.title || 'Untitled sign',
  subtitle: (t) => t.subtitle,
  group: () => '',
  groupLabel: '',
  blank: () => ({ title: '', subtitle: '' }),
};

const boxes: EntityDef<Box> = {
  id: 'boxes',
  name: 'Cases',
  noun: 'case',
  plural: 'cases',
  kinds: ['contents'],
  system: { name: '', baseUrl: '' },
  title: (b) => b.title || 'New case',
  subtitle: (b) => {
    const n = b.items.filter((t) => t.trim()).length;
    return n === 1 ? '1 item' : `${n} items`;
  },
  group: () => '',
  groupLabel: '',
  blank: () => ({ title: '', items: [] }),
};

export const ENTITIES = [contacts, inventory, locations, recipes, signs, boxes] as unknown as EntityDef[];

export const entityById = (id: EntityId) => ENTITIES.find((e) => e.id === id)!;

export const defaultEntityPrefs = () => Object.fromEntries(ENTITIES.map((e) => [e.id, { enabled: true, ...e.system }])) as Record<EntityId, EntityPrefs>;

/** The host of a URI, for compact display. */
export function hostOf(uri: string) {
  try {
    return new URL(uri).host;
  } catch {
    return '';
  }
}

export function isUri(s: string) {
  try {
    const u = new URL(s);
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && (u.protocol !== 'http:' && u.protocol !== 'https:' ? true : !!u.host);
  } catch {
    return false;
  }
}
