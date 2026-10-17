/**
 * Typographic correction for prose fields. People type on keyboards; labels
 * deserve real quotes, dashes and non-breaking spaces. Identifiers (SKUs,
 * asset tags, postcodes) never pass through here.
 */
export type TypeLocale = 'de' | 'en';

export const NBSP = ' ';

const QUOTES: Record<TypeLocale, { dOpen: string; dClose: string; sOpen: string; sClose: string }> = {
  de: { dOpen: '„', dClose: '“', sOpen: '‚', sClose: '‘' },
  en: { dOpen: '“', dClose: '”', sOpen: '‘', sClose: '’' },
};

const UNITS = ['mm', 'cm', 'm', 'km', 'kg', 'g', 'mg', 'l', 'ml', 'cl', '°C', '°F', 'V', 'A', 'mA', 'W', 'kW', 'Ah', 'mAh', 'GB', 'TB', 'MB', 'Hz', 'kHz', 'MHz', 'Stk.', 'pcs', '€', '$', 'EUR'];
const unitPattern = new RegExp(`(\\d)[ \\u00A0]?(${UNITS.map((u) => u.replace(/[.$]/g, '\\$&')).join('|')})(?![\\p{L}\\d])`, 'gu');

const DE_ABBREVIATIONS: [RegExp, string][] = [
  [/\bz\. ?B\./g, `z.${NBSP}B.`],
  [/\bu\. ?a\./g, `u.${NBSP}a.`],
  [/\bd\. ?h\./g, `d.${NBSP}h.`],
  [/\bz\. ?Hd\./g, `z.${NBSP}Hd.`],
  [/\bi\. ?A\./g, `i.${NBSP}A.`],
  [/\bNr\. ?(?=\d)/g, `Nr.${NBSP}`],
];

const isOpeningContext = (prev: string | undefined) => prev === undefined || /[\s([{–—/]/.test(prev);

function smartQuotes(text: string, locale: TypeLocale) {
  const q = QUOTES[locale];
  const chars = [...text];
  return chars
    .map((c, i) => {
      const prev = chars[i - 1];
      const next = chars[i + 1];
      if (c === '"') return isOpeningContext(prev) ? q.dOpen : q.dClose;
      if (c === "'") {
        // An apostrophe between letters (don't, Peter's) or before a year ('90er).
        if (prev && /\p{L}/u.test(prev) && next && /\p{L}/u.test(next)) return '’';
        if (isOpeningContext(prev) && next && /\d/.test(next)) return '’';
        return isOpeningContext(prev) ? q.sOpen : q.sClose;
      }
      return c;
    })
    .join('');
}

export function typeset(input: string, locale: TypeLocale): string {
  let s = input.replace(/[ \t]+/g, ' ').trim();
  if (!s) return s;
  s = s.replace(/\.\.\./g, '…');
  s = s.replace(/(^|\s)--?(\s|$)/g, `$1–$2`);
  s = s.replace(/ – /g, `${NBSP}– `);
  // Ranges of small numbers (2-7 °C, 10-12 Uhr). Long digit runs are likely phone numbers.
  s = s.replace(/(^|[^\p{L}\d-])(\d{1,4}) ?- ?(\d{1,4})(?![\p{L}\d-])/gu, '$1$2–$3');
  s = s.replace(/(\d) ?[x×] ?(\d)/g, `$1${NBSP}×${NBSP}$2`);
  s = s.replace(/\(c\)/gi, '©').replace(/\(r\)/gi, '®').replace(/\(tm\)/gi, '™');
  s = s.replace(/->/g, '→').replace(/<-/g, '←');
  // Inches and feet after a figure are primes, not quotes: 14″ display, 6′ cable.
  s = s.replace(/(\d)"(?=[\s,.;)\-]|$)/g, '$1″').replace(/(\d)'(?=[\s,.;)\-]|$)/g, '$1′');
  s = smartQuotes(s, locale);
  s = s.replace(unitPattern, `$1${NBSP}$2`);
  if (locale === 'de') {
    s = s.replace(/(\d) ?%/g, `$1${NBSP}%`);
    for (const [re, rep] of DE_ABBREVIATIONS) s = s.replace(re, rep);
  } else {
    s = s.replace(/(\d)[  ]%/g, '$1%');
    s = s.replace(/\bNo\. ?(?=\d)/g, `No.${NBSP}`);
  }
  // Titles stay with the name they belong to.
  s = s.replace(/\b(Dr|Prof|Dipl\.-Ing|Mr|Mrs|Ms|St)\. /g, `$1.${NBSP}`);
  return s;
}

export function upper(text: string, locale: TypeLocale) {
  return text.toLocaleUpperCase(locale === 'de' ? 'de-DE' : 'en-GB');
}
