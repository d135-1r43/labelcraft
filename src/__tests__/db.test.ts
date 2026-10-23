import { describe, expect, it } from 'vitest';
import { ENTITIES, isUri, locationCode } from '../db/entities';
import { SEED } from '../db/seed';
import { useDb } from '../db/store';

describe('database', () => {
  it('seeds every entity, and every seeded record outside signs links to its leading system', () => {
    for (const e of ENTITIES) {
      const recs = SEED[e.id];
      expect(recs.length).toBeGreaterThan(0);
      if (e.system.baseUrl) for (const r of recs) expect(r.uri?.startsWith(e.system.baseUrl)).toBe(true);
    }
  });

  it('creates, updates and removes records', () => {
    const db = useDb.getState();
    const rec = db.create('inventory');
    expect(useDb.getState().collections.inventory.some((r) => r.id === rec.id)).toBe(true);
    useDb.getState().put('inventory', { ...rec, uri: 'https://inv.nordlicht.de/a/NL-1' });
    expect(useDb.getState().collections.inventory.find((r) => r.id === rec.id)?.uri).toBe('https://inv.nordlicht.de/a/NL-1');
    useDb.getState().remove('inventory', rec.id);
    expect(useDb.getState().collections.inventory.some((r) => r.id === rec.id)).toBe(false);
  });

  it('recognises complete URIs only', () => {
    expect(isUri('https://crm.nordlicht.de/contacts/4100')).toBe(true);
    expect(isUri('crm.nordlicht.de/contacts')).toBe(false);
    expect(isUri('https://')).toBe(false);
  });

  it('builds location codes from segments', () => {
    expect(locationCode(SEED.locations[0])).toBe('A-03-2');
  });
});
