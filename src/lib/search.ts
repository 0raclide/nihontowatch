/**
 * Search and text normalization utilities for Japanese romanization
 */

const MACRON_MAP: Record<string, string> = {
  'ā': 'a', 'Ā': 'A',
  'ē': 'e', 'Ē': 'E',
  'ī': 'i', 'Ī': 'I',
  'ō': 'o', 'Ō': 'O',
  'ū': 'u', 'Ū': 'U',
};

/**
 * Remove macrons from romanized Japanese text.
 * Converts characters like ō → o, ū → u for search matching.
 *
 * @example
 * removeMacrons('Jūyō') // => 'Juyo'
 * removeMacrons('Tantō') // => 'Tanto'
 */
export function removeMacrons(str: string): string {
  return str.replace(/[āĀēĒīĪōŌūŪ]/g, char => MACRON_MAP[char] || char);
}

/**
 * Normalize text for search matching.
 * - Removes macrons
 * - Converts to lowercase
 * - Trims whitespace
 *
 * @example
 * normalizeSearchText('  Gotō  ') // => 'goto'
 * normalizeSearchText('KATANA') // => 'katana'
 */
export function normalizeSearchText(str: string): string {
  return removeMacrons(str.trim()).toLowerCase();
}

/**
 * Escape special characters for PostgreSQL full-text search.
 */
function escapeSearchChars(term: string): string {
  // Remove or escape characters that have special meaning in tsquery
  return term
    .replace(/[&|!():*<>'"\\]/g, '') // Remove special tsquery characters
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();
}

/**
 * Prepare a search query for PostgreSQL full-text search.
 * - Normalizes text (removes macrons, lowercases)
 * - Splits into terms
 * - Filters short terms (< 2 characters)
 * - Adds prefix matching (:*)
 * - Joins with AND (&)
 *
 * @example
 * prepareSearchQuery('masa') // => 'masa:*'
 * prepareSearchQuery('katana soshu') // => 'katana:* & soshu:*'
 * prepareSearchQuery('a b cd') // => 'cd:*' (single char terms filtered)
 */
export function prepareSearchQuery(query: string): string {
  // Normalize and escape
  const normalized = normalizeSearchText(query);
  const escaped = escapeSearchChars(normalized);

  // Split into terms and filter short ones
  const terms = escaped
    .split(/\s+/)
    .filter(term => term.length >= 2);

  if (terms.length === 0) {
    return '';
  }

  // Add prefix matching and join with AND
  return terms.map(term => `${term}:*`).join(' & ');
}

/**
 * Minimum query length for search to execute
 */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Check if a search query is valid (long enough to search)
 */
export function isValidSearchQuery(query: string): boolean {
  return normalizeSearchText(query).length >= MIN_SEARCH_LENGTH;
}
