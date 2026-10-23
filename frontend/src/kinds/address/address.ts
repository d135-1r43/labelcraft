/**
 * Postal address semantics: country-specific line order, postcode formats,
 * casing conventions and the destination-country line. Rules follow
 * DIN 5008, UPU S42 and the national posts (Royal Mail PAF, USPS Pub 28,
 * La Poste, PostNL, Canada Post, Australia Post).
 */
import type { Issue } from '../../engine/display';
import { NBSP, upper, type TypeLocale } from '../../engine/typeset';

export interface Address {
  honorific?: string;
  title?: string;
  givenName?: string;
  familyName?: string;
  company?: string;
  department?: string;
  street?: string;
  houseNumber?: string;
  /** Second address line: c/o, apartment, Hinterhaus, PO box. */
  extra?: string;
  postalCode?: string;
  city?: string;
  /** State, province or county where the post requires it. */
  region?: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

interface CountryRule {
  /** House number before the street name. */
  numberFirst: boolean;
  /** Company line before the person (German business convention). */
  companyFirst: boolean;
  postcode?: { re: RegExp; example: string; normalize?: (s: string) => string };
  /** Builds the locality line(s). */
  locality: (a: Address) => string[];
  regionRequired?: boolean;
  regionLabel?: string;
  honorifics: string[];
}

const pcCity = (a: Address) => [[a.postalCode, a.city].filter(Boolean).join(' ')];
const up = (s?: string) => (s ? upper(s, 'en') : '');

const DE_HONORIFICS = ['Frau', 'Herrn', 'Divers'];
const EN_HONORIFICS = ['Ms', 'Mr', 'Mrs', 'Mx'];
const FR_HONORIFICS = ['Madame', 'Monsieur'];

export const COUNTRY_RULES: Record<string, CountryRule> = {
  DE: { numberFirst: false, companyFirst: true, postcode: { re: /^\d{5}$/, example: '80331' }, locality: pcCity, honorifics: DE_HONORIFICS },
  AT: { numberFirst: false, companyFirst: true, postcode: { re: /^\d{4}$/, example: '1010' }, locality: pcCity, honorifics: DE_HONORIFICS },
  CH: { numberFirst: false, companyFirst: true, postcode: { re: /^\d{4}$/, example: '8001' }, locality: pcCity, honorifics: DE_HONORIFICS },
  LI: { numberFirst: false, companyFirst: true, postcode: { re: /^\d{4}$/, example: '9490' }, locality: pcCity, honorifics: DE_HONORIFICS },
  NL: {
    numberFirst: false,
    companyFirst: false,
    postcode: { re: /^\d{4} [A-Z]{2}$/, example: '1012 AB', normalize: (s) => s.toUpperCase().replace(/^(\d{4})\s*([A-Z]{2})$/, '$1 $2') },
    // PostNL: two spaces between postcode and an upper-case place name.
    locality: (a) => [[a.postalCode, up(a.city)].filter(Boolean).join('  ')],
    honorifics: EN_HONORIFICS,
  },
  BE: { numberFirst: false, companyFirst: false, postcode: { re: /^\d{4}$/, example: '1000' }, locality: pcCity, honorifics: FR_HONORIFICS },
  FR: {
    numberFirst: true,
    companyFirst: false,
    postcode: { re: /^\d{5}$/, example: '75002' },
    // La Poste: the commune in capitals, without accents being required.
    locality: (a) => [[a.postalCode, up(a.city)].filter(Boolean).join(' ')],
    honorifics: FR_HONORIFICS,
  },
  IT: {
    numberFirst: false,
    companyFirst: false,
    postcode: { re: /^\d{5}$/, example: '00184' },
    locality: (a) => [[a.postalCode, up(a.city), up(a.region)].filter(Boolean).join(' ')],
    regionLabel: 'Province',
    honorifics: ['Sig.ra', 'Sig.'],
  },
  ES: { numberFirst: false, companyFirst: false, postcode: { re: /^\d{5}$/, example: '28013' }, locality: pcCity, honorifics: ['Sra.', 'Sr.'] },
  DK: { numberFirst: false, companyFirst: false, postcode: { re: /^\d{4}$/, example: '1050' }, locality: pcCity, honorifics: EN_HONORIFICS },
  SE: {
    numberFirst: false,
    companyFirst: false,
    postcode: { re: /^\d{3} \d{2}$/, example: '111 52', normalize: (s) => s.replace(/^(\d{3})\s*(\d{2})$/, '$1 $2') },
    locality: (a) => [[a.postalCode, up(a.city)].filter(Boolean).join(' ')],
    honorifics: EN_HONORIFICS,
  },
  PL: {
    numberFirst: false,
    companyFirst: false,
    postcode: { re: /^\d{2}-\d{3}$/, example: '00-950', normalize: (s) => s.replace(/^(\d{2})\s*-?\s*(\d{3})$/, '$1-$2') },
    locality: pcCity,
    honorifics: ['Pani', 'Pan'],
  },
  GB: {
    numberFirst: true,
    companyFirst: false,
    postcode: {
      re: /^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2})$/,
      example: 'SW1A 2AA',
      normalize: (s) => s.toUpperCase().replace(/\s+/g, '').replace(/^(.+)(\d[A-Z]{2})$/, '$1 $2'),
    },
    // Royal Mail: post town in capitals on its own line, postcode last.
    locality: (a) => [up(a.city), a.postalCode ?? ''].filter(Boolean),
    honorifics: EN_HONORIFICS,
  },
  IE: { numberFirst: true, companyFirst: false, postcode: { re: /^[A-Z\d]{3} [A-Z\d]{4}$/, example: 'D02 X285', normalize: (s) => s.toUpperCase().replace(/\s+/g, '').replace(/^(.{3})(.{4})$/, '$1 $2') }, locality: (a) => [[a.city, a.region].filter(Boolean).join(', '), a.postalCode ?? ''].filter(Boolean), honorifics: EN_HONORIFICS },
  US: {
    numberFirst: true,
    companyFirst: false,
    postcode: { re: /^\d{5}(-\d{4})?$/, example: '10118' },
    locality: (a) => [`${a.city ?? ''}${a.city && (a.region || a.postalCode) ? ', ' : ''}${[up(a.region), a.postalCode].filter(Boolean).join(NBSP)}`],
    regionRequired: true,
    regionLabel: 'State',
    honorifics: EN_HONORIFICS,
  },
  CA: {
    numberFirst: true,
    companyFirst: false,
    postcode: { re: /^[A-Z]\d[A-Z] \d[A-Z]\d$/, example: 'K1A 0B1', normalize: (s) => s.toUpperCase().replace(/\s+/g, '').replace(/^(.{3})(.{3})$/, '$1 $2') },
    // Canada Post: municipality, province, two spaces, postal code.
    locality: (a) => [`${[a.city, up(a.region)].filter(Boolean).join(' ')}${a.postalCode ? '  ' + a.postalCode : ''}`],
    regionRequired: true,
    regionLabel: 'Province',
    honorifics: EN_HONORIFICS,
  },
  AU: {
    numberFirst: true,
    companyFirst: false,
    postcode: { re: /^\d{4}$/, example: '2000' },
    // Australia Post: locality, state and postcode in capitals on the last line.
    locality: (a) => [[up(a.city), up(a.region), a.postalCode].filter(Boolean).join('  ')],
    regionRequired: true,
    regionLabel: 'State',
    honorifics: EN_HONORIFICS,
  },
};

const FALLBACK_RULE: CountryRule = { numberFirst: false, companyFirst: false, locality: pcCity, honorifics: EN_HONORIFICS };

export const ruleFor = (country: string) => COUNTRY_RULES[country] ?? FALLBACK_RULE;

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_RULES);

export function countryName(code: string, locale: TypeLocale) {
  try {
    return new Intl.DisplayNames([locale === 'de' ? 'de-DE' : 'en-GB'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function normalizePostcode(country: string, pc: string | undefined) {
  if (!pc) return pc;
  const trimmed = pc.trim();
  const n = ruleFor(country).postcode?.normalize;
  return n ? n(trimmed) : trimmed;
}

export function personLine(a: Address) {
  const name = [a.title, a.givenName, a.familyName].filter(Boolean).join(' ').replace(/\. /g, `.${NBSP}`);
  if (!name) return '';
  return a.honorific ? `${a.honorific}${NBSP}${name}` : name;
}

export function streetLine(a: Address) {
  if (!a.street) return a.houseNumber ?? '';
  if (!a.houseNumber) return a.street;
  return ruleFor(a.country).numberFirst ? `${a.houseNumber} ${a.street}` : `${a.street}${NBSP}${a.houseNumber}`;
}

export interface FormattedAddress {
  lines: { text: string; role: 'person' | 'company' | 'department' | 'street' | 'extra' | 'locality' | 'country' }[];
  issues: Issue[];
}

/**
 * Lay out an address the way the destination's post expects it.
 * `originCountry` decides whether the destination country line is needed
 * and the locale the country name is written in.
 */
export function formatAddress(a: Address, originCountry: string, locale: TypeLocale): FormattedAddress {
  const rule = ruleFor(a.country);
  const issues: Issue[] = [];
  const norm: Address = { ...a, postalCode: normalizePostcode(a.country, a.postalCode) };
  const out: FormattedAddress['lines'] = [];
  const person = personLine(norm);
  const company = norm.company?.trim();
  if (rule.companyFirst) {
    if (company) out.push({ text: company, role: 'company' });
    if (norm.department) out.push({ text: norm.department, role: 'department' });
    if (person) out.push({ text: person, role: 'person' });
  } else {
    if (person) out.push({ text: person, role: 'person' });
    if (norm.department) out.push({ text: norm.department, role: 'department' });
    if (company) out.push({ text: company, role: 'company' });
  }
  if (norm.extra) out.push({ text: norm.extra, role: 'extra' });
  const street = streetLine(norm);
  if (street) out.push({ text: street, role: 'street' });
  for (const l of rule.locality(norm)) if (l.trim()) out.push({ text: l, role: 'locality' });
  if (a.country !== originCountry) out.push({ text: upper(countryName(a.country, locale), locale), role: 'country' });

  if (!person && !company) issues.push({ id: 'addr-name', severity: 'error', message: 'Add a recipient name or company' });
  if (!street && !norm.extra) issues.push({ id: 'addr-street', severity: 'error', message: 'Add a street or PO box' });
  if (!norm.city) issues.push({ id: 'addr-city', severity: 'error', message: 'Add the town or city' });
  if (rule.postcode) {
    if (!norm.postalCode) issues.push({ id: 'addr-pc', severity: 'error', message: `Add the postcode (${countryName(a.country, 'en')}: e.g. ${rule.postcode.example})` });
    else if (!rule.postcode.re.test(norm.postalCode))
      issues.push({ id: 'addr-pc', severity: 'warn', message: `Postcode “${norm.postalCode}” is not a valid ${countryName(a.country, 'en')} format`, detail: `Expected something like ${rule.postcode.example}.` });
  }
  if (rule.regionRequired && !norm.region) issues.push({ id: 'addr-region', severity: 'warn', message: `${countryName(a.country, 'en')} addresses need a ${(rule.regionLabel ?? 'region').toLowerCase()}` });
  if (street && norm.street && !norm.houseNumber && !/\d/.test(norm.street) && !norm.extra)
    issues.push({ id: 'addr-number', severity: 'info', message: 'No house number', detail: 'Most posts need one unless the building has a name.' });
  return { lines: out, issues };
}

/**
 * One-line form for the return address above the recipient (DIN 5008
 * Rücksendeangabe). On mail going abroad the origin country is written in
 * English: if the item comes back, the destination post has to read it.
 */
export function senderLine(a: Address, destination: string) {
  const parts = [a.company || personLine({ ...a, honorific: undefined }), streetLine(a), ruleFor(a.country).locality(a).join(' ')];
  if (a.country !== destination) parts.push(upper(countryName(a.country, 'en'), 'en'));
  return parts.filter(Boolean).join(' · ');
}

/* ───────────────────────── parsing ───────────────────────── */

const COMPANY_MARKERS =
  /\b(GmbH|gGmbH|mbH|AG|KG|KGaA|OHG|GbR|UG|e\.\s?V\.|eG|SE|Ltd\.?|Limited|LLP|plc|Inc\.?|LLC|Corp\.?|Co\.|Company|S\.?A\.?R\.?L\.?|SAS|S\.A\.|B\.?V\.?|N\.?V\.?|S\.p\.A\.|S\.r\.l\.|AB|A\/S|Oy|Stiftung|Verlag|Werkstatt|Studio|Institut|Universität|University|Hotel|Praxis|Kanzlei)\b|&/i;

const HONORIFIC_MAP: Record<string, string> = {
  frau: 'Frau', herr: 'Herrn', herrn: 'Herrn', mr: 'Mr', 'mr.': 'Mr', mrs: 'Mrs', 'mrs.': 'Mrs', ms: 'Ms', 'ms.': 'Ms', mx: 'Mx',
  madame: 'Madame', monsieur: 'Monsieur', mme: 'Madame', 'mme.': 'Madame', m: 'Monsieur', 'm.': 'Monsieur',
};

let countryIndex: Map<string, string> | null = null;
function countryLookup() {
  if (countryIndex) return countryIndex;
  countryIndex = new Map();
  const codes = 'AD AE AT AU BE BG BR CA CH CN CY CZ DE DK EE ES FI FR GB GR HK HR HU IE IL IN IS IT JP KR LI LT LU LV MC MT MX NL NO NZ PL PT RO RS SE SG SI SK TR UA US ZA'.split(' ');
  for (const loc of ['de', 'en', 'fr', 'it', 'nl', 'es']) {
    const dn = new Intl.DisplayNames([loc], { type: 'region' });
    for (const c of codes) {
      const name = dn.of(c);
      if (name) countryIndex.set(name.toLowerCase(), c);
    }
  }
  const aliases: Record<string, string> = {
    usa: 'US', 'u.s.a.': 'US', 'united states of america': 'US', uk: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
    'vereinigtes königreich': 'GB', großbritannien: 'GB', grossbritannien: 'GB', holland: 'NL', suisse: 'CH', schweiz: 'CH', svizzera: 'CH', österreich: 'AT', oesterreich: 'AT', deutschland: 'DE', germany: 'DE',
  };
  for (const [k, v] of Object.entries(aliases)) countryIndex.set(k, v);
  for (const c of codes) countryIndex.set(c.toLowerCase(), c);
  return countryIndex;
}

export function detectCountry(line: string): string | undefined {
  return countryLookup().get(line.trim().replace(/[.,]$/, '').toLowerCase());
}

const POSTCODE_LINE: { country: string; re: RegExp; build: (m: RegExpMatchArray) => Partial<Address> }[] = [
  { country: 'US', re: /^(.+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/, build: (m) => ({ city: m[1], region: m[2], postalCode: m[3] }) },
  { country: 'CA', re: /^(.+?),?\s+([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i, build: (m) => ({ city: m[1], region: m[2].toUpperCase(), postalCode: m[3] }) },
  { country: 'AU', re: /^(.+?)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})$/i, build: (m) => ({ city: titleCase(m[1]), region: m[2].toUpperCase(), postalCode: m[3] }) },
  { country: 'NL', re: /^(\d{4}\s?[A-Z]{2})\s+(.+)$/, build: (m) => ({ postalCode: m[1], city: titleCase(m[2]) }) },
  { country: 'PL', re: /^(\d{2}-\d{3})\s+(.+)$/, build: (m) => ({ postalCode: m[1], city: m[2] }) },
  { country: 'SE', re: /^(?:SE-)?(\d{3}\s\d{2})\s+(.+)$/, build: (m) => ({ postalCode: m[1], city: titleCase(m[2]) }) },
  { country: '5', re: /^(?:([A-Z]{1,2})-)?(\d{5})\s+(.+)$/, build: (m) => ({ postalCode: m[2], city: m[3].replace(/\s+[A-Z]{2}$/, '') }) },
  { country: '4', re: /^(?:([A-Z]{1,2})-)?(\d{4})\s+(.+)$/, build: (m) => ({ postalCode: m[2], city: m[3] }) },
];

const GB_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i;

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}

const PREFIX_COUNTRY: Record<string, string> = { D: 'DE', A: 'AT', CH: 'CH', F: 'FR', I: 'IT', E: 'ES', L: 'LU', B: 'BE', FL: 'LI' };

export interface ParseResult {
  address: Address;
  /** Lines the parser could not place; shown so nothing is silently lost. */
  unplaced: string[];
}

/** Turn a pasted block (e-mail signature, web shop order, letterhead) into fields. */
export function parseAddress(text: string, defaultCountry = 'DE'): ParseResult {
  const lines = text
    .split(/\r?\n|;/)
    .map((l) => l.replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim())
    .filter((l) => l && !/^(tel|phone|fon|fax|mobil|e-?mail|www\.|https?:)/i.test(l) && !/@/.test(l));
  const a: Address = { country: defaultCountry };
  let explicitCountry: string | undefined;
  if (lines.length && detectCountry(lines[lines.length - 1])) explicitCountry = detectCountry(lines.pop()!);

  // Locality.
  let locIdx = -1;
  for (let i = lines.length - 1; i >= 0 && locIdx < 0; i--) {
    const line = lines[i];
    if (GB_POSTCODE.test(line) && i > 0) {
      a.postalCode = line.toUpperCase();
      a.city = titleCase(lines[i - 1]);
      a.country = 'GB';
      lines.splice(i, 1);
      locIdx = i - 1;
      break;
    }
    const gbInline = line.match(/^(.+?),?\s+([A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2})$/);
    if (gbInline) {
      Object.assign(a, { city: titleCase(gbInline[1]), postalCode: gbInline[2], country: 'GB' });
      locIdx = i;
      break;
    }
    for (const p of POSTCODE_LINE) {
      const m = line.match(p.re);
      if (!m) continue;
      Object.assign(a, p.build(m));
      if (p.country === '5' || p.country === '4') {
        const prefix = m[1] && PREFIX_COUNTRY[m[1]];
        a.country = prefix || explicitCountry || (p.country === '5' ? (['DE', 'FR', 'IT', 'ES'].includes(defaultCountry) ? defaultCountry : 'DE') : ['AT', 'CH', 'BE', 'DK', 'LI'].includes(defaultCountry) ? defaultCountry : 'AT');
        if (a.country === 'FR' || a.country === 'IT') a.city = titleCase(a.city ?? '');
      } else a.country = p.country;
      locIdx = i;
      break;
    }
  }
  if (explicitCountry) a.country = explicitCountry;
  const before = locIdx >= 0 ? lines.slice(0, locIdx) : lines.slice();
  const unplaced = locIdx >= 0 ? lines.slice(locIdx + 1) : [];

  // Street: the nearest line above the locality that carries a house number.
  const rule = ruleFor(a.country);
  for (let i = before.length - 1; i >= 0; i--) {
    const l = before[i];
    const tail = l.match(/^(.*?\p{L}.*?)\s+(\d+\s?[a-zA-Z]?(?:\s?[-/]\s?\d+[a-zA-Z]?)?)$/u);
    const head = l.match(/^(\d+[a-zA-Z]?(?:-\d+)?),?\s+(.*\p{L}.*)$/u);
    if (/^(postfach|po box|p\.o\. box|boîte postale|bp)\b/i.test(l)) {
      a.extra = l;
      before.splice(i, 1);
      break;
    }
    if (head && (rule.numberFirst || !tail)) {
      a.houseNumber = head[1];
      a.street = head[2];
      before.splice(i, 1);
      break;
    }
    if (tail) {
      a.street = tail[1];
      a.houseNumber = tail[2].replace(/\s/g, '');
      before.splice(i, 1);
      break;
    }
  }

  // Remaining lines: company, department, person.
  const rest = before.filter(Boolean);
  const coIdx = rest.findIndex((l) => COMPANY_MARKERS.test(l));
  if (coIdx >= 0) a.company = rest.splice(coIdx, 1)[0];
  const attn = rest.findIndex((l) => /^(z\.\s?hd\.?|attn\.?:?|attention:?|c\/o)\s*/i.test(l));
  let personText: string | undefined;
  if (attn >= 0) personText = rest.splice(attn, 1)[0].replace(/^(z\.\s?hd\.?|attn\.?:?|attention:?|c\/o)\s*/i, '');
  else if (rest.length) personText = rest.shift();
  if (personText) Object.assign(a, splitPerson(personText, a.country));
  if (rest.length && !a.company) a.company = rest.shift();
  if (rest.length) a.department = rest.shift();
  unplaced.push(...rest);
  a.postalCode = normalizePostcode(a.country, a.postalCode);
  return { address: a, unplaced };
}

export function splitPerson(text: string, country: string): Partial<Address> {
  const tokens = text.split(' ').filter(Boolean);
  const out: Partial<Address> = {};
  const hon = tokens[0] && HONORIFIC_MAP[tokens[0].toLowerCase()];
  if (hon) {
    tokens.shift();
    const deStyle = ['DE', 'AT', 'CH', 'LI'].includes(country);
    out.honorific = deStyle || !['Frau', 'Herrn'].includes(hon) ? hon : hon === 'Frau' ? 'Ms' : 'Mr';
  }
  const titles: string[] = [];
  while (tokens.length > 1 && /^(Dr\.|Prof\.|Dipl\.-\w+\.?|Mag\.|Ing\.|med\.|rer\.|nat\.|h\.c\.)$/i.test(tokens[0])) titles.push(tokens.shift()!);
  if (titles.length) out.title = titles.join(' ');
  if (tokens.length === 1) out.familyName = tokens[0];
  else if (tokens.length > 1) {
    // Nobiliary particles belong to the family name: Ursula von der Leyen, Vincent van Gogh.
    let split = tokens.length - 1;
    while (split > 1 && /^(von|van|de|der|den|del|della|di|da|du|le|la|zu|ten|ter|vom|zum|zur)$/i.test(tokens[split - 1])) split--;
    out.givenName = tokens.slice(0, split).join(' ');
    out.familyName = tokens.slice(split).join(' ');
  }
  return out;
}
