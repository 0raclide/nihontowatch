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

/**
 * Search term aliases for common variations and related terms.
 * Maps normalized terms to arrays of related terms.
 */
const SEARCH_ALIASES: Record<string, string[]> = {
  // Item type aliases
  'sword': ['katana', 'wakizashi', 'tanto', 'tachi'],
  'blade': ['katana', 'wakizashi', 'tanto', 'tachi'],
  'fittings': ['tsuba', 'fuchi', 'kashira', 'menuki', 'kozuka', 'kogai'],
  'tosogu': ['tsuba', 'fuchi', 'kashira', 'menuki', 'kozuka', 'kogai'],

  // Certification aliases
  'juyo': ['juyou', 'juuyou'],
  'tokubetsu': ['tokubetsu hozon', 'toku hozon'],
  'hozon': ['hozon'],

  // Common romanization variations
  'goto': ['gotou'],
  'koto': ['kotou'],
  'shinto': ['shintou'],
  'shinshinto': ['shinshintou'],
};

/**
 * Expand a search term to include related aliases.
 * Returns an array containing the original term plus any aliases.
 *
 * @example
 * expandSearchAliases('sword') // => ['sword', 'katana', 'wakizashi', 'tanto', 'tachi']
 * expandSearchAliases('masa') // => ['masa'] (no aliases)
 */
export function expandSearchAliases(term: string): string[] {
  const normalized = normalizeSearchText(term);
  const aliases = SEARCH_ALIASES[normalized];

  if (aliases) {
    return [normalized, ...aliases];
  }

  return [normalized];
}

/**
 * Numeric filter result
 */
interface NumericFilter {
  field: string;
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
}

/**
 * Field name mappings for numeric filter shortcuts
 */
const NUMERIC_FIELD_MAP: Record<string, string> = {
  'cm': 'nagasa_cm',
  'nagasa': 'nagasa_cm',
  'sori': 'sori_cm',
  'price': 'price_value',
  'motohaba': 'motohaba_cm',
  'sakihaba': 'sakihaba_cm',
  'kasane': 'kasane_cm',
  'weight': 'weight_g',
};

/**
 * Parse numeric filters from search query.
 * Supports patterns like: cm>70, price<500000, nagasa>=65
 *
 * @example
 * parseNumericFilters('katana cm>70 juyo')
 * // => { filters: [{ field: 'nagasa_cm', op: 'gt', value: 70 }], textWords: ['katana', 'juyo'] }
 */
export function parseNumericFilters(query: string): { filters: NumericFilter[]; textWords: string[] } {
  const filters: NumericFilter[] = [];
  const textWords: string[] = [];

  // Split query into words
  const words = query.trim().split(/\s+/);

  // Pattern: field(>=|<=|>|<|=)number
  const numericPattern = /^(\w+)(>=|<=|>|<|=)(\d+(?:\.\d+)?)$/;

  for (const word of words) {
    const match = word.match(numericPattern);

    if (match) {
      const [, fieldKey, operator, numValue] = match;
      const field = NUMERIC_FIELD_MAP[fieldKey.toLowerCase()];

      if (field) {
        let op: NumericFilter['op'];
        switch (operator) {
          case '>=': op = 'gte'; break;
          case '<=': op = 'lte'; break;
          case '>': op = 'gt'; break;
          case '<': op = 'lt'; break;
          case '=': op = 'eq'; break;
          default: op = 'eq';
        }

        filters.push({ field, op, value: parseFloat(numValue) });
      } else {
        // Unknown field, treat as text
        textWords.push(word);
      }
    } else {
      // Not a numeric filter, treat as text
      textWords.push(word);
    }
  }

  return { filters, textWords };
}
