import { describe, expect, it } from 'vitest';
import { typeset } from '../engine/typeset';

const show = (s: string) => s.replace(/ /g, '⍽');

describe('typeset', () => {
  it('sets German quotes, dashes, units and abbreviations', () => {
    expect(show(typeset('Lagern bei 2-7 °C, z.B. im "Kühlraum" - nicht einfrieren...', 'de'))).toBe('Lagern bei 2–7⍽°C, z.⍽B. im „Kühlraum“⍽– nicht einfrieren…');
  });
  it('sets English quotes and apostrophes', () => {
    expect(typeset(`Don't "touch" it`, 'en')).toBe('Don’t “touch” it');
  });
  it('spaces dimensions and keeps units with their numbers', () => {
    expect(show(typeset('Box 120x80 mm, 5kg', 'en'))).toBe('Box 120⍽×⍽80⍽mm, 5⍽kg');
  });
  it('leaves long digit runs (phone numbers) alone', () => {
    expect(typeset('089-1234567', 'de')).toBe('089-1234567');
  });
});
