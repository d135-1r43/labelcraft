import { describe, expect, it } from 'vitest';
import { ENTITIES, isUri, locationCode } from '../db/entities';

describe('entities', () => {
  it('every entity names its noun and makes valid blank records', () => {
    for (const e of ENTITIES) {
      expect(e.noun).toBeTruthy();
      expect(e.blank()).toBeTypeOf('object');
    }
  });

  it('recognises complete URIs only', () => {
    expect(isUri('https://crm.nordlicht.de/contacts/4100')).toBe(true);
    expect(isUri('crm.nordlicht.de/contacts')).toBe(false);
    expect(isUri('https://')).toBe(false);
  });

  it('builds location codes from segments', () => {
    const segments = [
      { label: 'aisle', value: 'A' },
      { label: 'rack', value: '03' },
      { label: 'shelf', value: '2' },
    ];
    expect(locationCode({ id: 'l1', segments, area: '', contents: '' })).toBe('A-03-2');
  });
});
