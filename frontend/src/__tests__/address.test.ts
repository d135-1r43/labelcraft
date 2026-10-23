import { describe, expect, it } from 'vitest';
import { formatAddress, parseAddress } from '../kinds/address/address';

const lines = (r: ReturnType<typeof formatAddress>) => r.lines.map((l) => l.text.replace(/ /g, ' '));

describe('formatAddress', () => {
  it('German business address: company first, no country line for domestic mail', () => {
    const r = formatAddress(
      { company: 'Kunstmühle Schwarz GmbH', honorific: 'Frau', title: 'Dr.', givenName: 'Erika', familyName: 'Schwarz', street: 'Lindwurmstraße', houseNumber: '88', postalCode: '80337', city: 'München', country: 'DE' },
      'DE',
      'de',
    );
    expect(lines(r)).toEqual(['Kunstmühle Schwarz GmbH', 'Frau Dr. Erika Schwarz', 'Lindwurmstraße 88', '80337 München']);
    expect(r.issues).toEqual([]);
  });

  it('UK: number first, post town in capitals, postcode on its own line, country in sender language', () => {
    const r = formatAddress({ givenName: 'Amelia', familyName: 'Hart', street: 'Whitehall', houseNumber: '70', postalCode: 'sw1a2aa', city: 'London', country: 'GB' }, 'DE', 'de');
    expect(lines(r)).toEqual(['Amelia Hart', '70 Whitehall', 'LONDON', 'SW1A 2AA', 'VEREINIGTES KÖNIGREICH']);
  });

  it('US: city, state and ZIP; warns on missing state', () => {
    const r = formatAddress({ givenName: 'Ada', familyName: 'Byron', street: 'Fifth Avenue', houseNumber: '350', city: 'New York', postalCode: '10118', country: 'US' }, 'US', 'en');
    expect(lines(r)).toEqual(['Ada Byron', '350 Fifth Avenue', 'New York, 10118']);
    expect(r.issues.map((i) => i.id)).toContain('addr-region');
  });

  it('flags malformed postcodes', () => {
    const r = formatAddress({ familyName: 'X', street: 'A', houseNumber: '1', postalCode: '8033', city: 'München', country: 'DE' }, 'DE', 'de');
    expect(r.issues.find((i) => i.id === 'addr-pc')?.severity).toBe('warn');
  });
});

describe('parseAddress', () => {
  it('parses a German signature block', () => {
    const { address } = parseAddress('Herrn Prof. Dr. Klaus von Bülow\nBülow & Partner Steuerberater\nMaximilianstr. 12a\n80539 München\nTel. 089 123456');
    expect(address).toMatchObject({ honorific: 'Herrn', title: 'Prof. Dr.', givenName: 'Klaus', familyName: 'von Bülow', company: 'Bülow & Partner Steuerberater', street: 'Maximilianstr.', houseNumber: '12a', postalCode: '80539', city: 'München', country: 'DE' });
  });

  it('parses a UK address with country line', () => {
    const { address } = parseAddress('Ms Priya Natarajan\nFlat 4\n221B Baker Street\nLONDON\nNW1 6XE\nUnited Kingdom');
    expect(address).toMatchObject({ honorific: 'Ms', givenName: 'Priya', familyName: 'Natarajan', houseNumber: '221B', street: 'Baker Street', city: 'London', postalCode: 'NW1 6XE', country: 'GB' });
  });

  it('parses US and French addresses', () => {
    expect(parseAddress('Jordan Lee\nAcme Robotics Inc.\n1600 Amphitheatre Pkwy\nMountain View, CA 94043\nUSA').address).toMatchObject({ company: 'Acme Robotics Inc.', city: 'Mountain View', region: 'CA', postalCode: '94043', country: 'US', houseNumber: '1600' });
    expect(parseAddress('Camille Martin\n12 rue de la Paix\n75002 PARIS\nFrance').address).toMatchObject({ street: 'rue de la Paix', houseNumber: '12', city: 'Paris', country: 'FR' });
  });

  it('recognises country prefixes and Swiss addresses', () => {
    expect(parseAddress('Lea Graf\nBahnhofstrasse 1\nCH-8001 Zürich').address).toMatchObject({ country: 'CH', postalCode: '8001', city: 'Zürich' });
  });
});
