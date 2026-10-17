import { hyphenateSync as hyphenateDe } from 'hyphen/de';
import { hyphenateSync as hyphenateEn } from 'hyphen/en-us';
import type { TypeLocale } from './typeset';

const SOFT = '­';
const cache = new Map<string, string[]>();

/**
 * Split a word into hyphenation fragments. Short words, words with digits
 * and anything that looks like an identifier stay whole. At least three
 * letters remain on each side of a break.
 */
export function syllables(word: string, locale: TypeLocale): string[] {
  if (word.length < 7 || /[\d@/_]/.test(word) || word === word.toUpperCase()) return [word];
  const key = `${locale}|${word}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const hyphenated = (locale === 'de' ? hyphenateDe : hyphenateEn)(word, { minWordLength: 7 });
  const raw = hyphenated.split(SOFT);
  const merged: string[] = [];
  for (const part of raw) {
    if (merged.length && (merged[merged.length - 1].length < 3 || part.length < 3 && part === raw[raw.length - 1])) {
      merged[merged.length - 1] += part;
    } else merged.push(part);
  }
  // Guard the tail: the last fragment needs three letters too.
  while (merged.length > 1 && merged[merged.length - 1].replace(/\P{L}/gu, '').length < 3) {
    const tail = merged.pop()!;
    merged[merged.length - 1] += tail;
  }
  cache.set(key, merged);
  return merged;
}
