/**
 * CJK character detection utilities.
 *
 * Shared between browse API and search suggestions API
 * to avoid duplicating the Unicode range regex.
 */

/** Matches CJK Unified Ideographs + CJK Compatibility Ideographs */
const CJK_PATTERN = /[\u3000-\u9fff\uf900-\ufaff]/;

/** Check if a string contains any CJK characters (kanji, kana, CJK punctuation) */
export function containsCJK(str: string): boolean {
  return CJK_PATTERN.test(str);
}
