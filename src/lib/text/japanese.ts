/**
 * Shared Japanese text detection utility.
 *
 * Single source of truth for the JAPANESE_REGEX pattern used across the
 * codebase (translate API, TranslatedTitle, TranslatedDescription,
 * MetadataGrid, SEO meta title builder, ListingCard).
 */

/** Matches hiragana, katakana, and CJK Unified Ideographs (kanji). */
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

/** Returns true if the string contains any Japanese characters. */
export function containsJapanese(str: string): boolean {
  return JAPANESE_REGEX.test(str);
}
