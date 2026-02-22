/**
 * Shared Japanese text detection utility.
 *
 * Single source of truth for the JAPANESE_REGEX pattern used across the
 * codebase (translate API, TranslatedTitle, TranslatedDescription,
 * MetadataGrid, SEO meta title builder, ListingCard).
 */

/** Matches hiragana, katakana, and CJK Unified Ideographs (kanji). */
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
const JAPANESE_REGEX_GLOBAL = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g;

/** Returns true if the string contains any Japanese characters. */
export function containsJapanese(str: string): boolean {
  return JAPANESE_REGEX.test(str);
}

/**
 * Returns true if the text is predominantly Japanese (>20% JP characters).
 *
 * Used for translation direction detection where mixed texts (English with
 * embedded kanji like "JUYO TANTO BY BIZEN KAGEMITSU 備前景光") should be
 * treated as English-source. The simple `containsJapanese()` check fails
 * on these because even a single kanji triggers it.
 */
export function isPredominantlyJapanese(str: string): boolean {
  const stripped = str.replace(/\s/g, '');
  if (stripped.length === 0) return false;

  const jpChars = (str.match(JAPANESE_REGEX_GLOBAL) || []).length;
  return jpChars / stripped.length > 0.2;
}
