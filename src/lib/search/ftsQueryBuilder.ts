/**
 * Full-Text Search Query Builder for PostgreSQL
 *
 * Builds tsquery strings with proper word boundary matching to fix the
 * substring pollution problem (e.g., "rai" matching "grained").
 *
 * Features:
 * - Word boundary matching (prevents substring matches)
 * - Phrase detection for quoted strings: "Rai Kunimitsu"
 * - Prefix matching for typeahead: rai -> rai:*
 * - Safe escaping of special tsquery characters
 * - Integration with existing text normalization
 */

import { normalizeSearchText } from './textNormalization';

// =============================================================================
// TYPES
// =============================================================================

export interface FTSQueryOptions {
  /** Enable prefix matching (term:*) for typeahead/partial matches */
  prefixMatch?: boolean;
  /** Minimum term length to include (default: 2) */
  minTermLength?: number;
}

export interface FTSQuery {
  /** The PostgreSQL tsquery string (for use with @@ operator) */
  tsquery: string;
  /** Whether the query contains phrase matching (quoted strings) */
  isPhraseSearch: boolean;
  /** Original terms after normalization (for debugging/logging) */
  terms: string[];
  /** Whether the query is empty/invalid */
  isEmpty: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Characters that have special meaning in PostgreSQL tsquery syntax.
 * These must be escaped or removed to prevent query errors.
 */
const TSQUERY_SPECIAL_CHARS = /[&|!():<>\\*'"]/g;

/**
 * Default minimum term length for search
 */
const DEFAULT_MIN_TERM_LENGTH = 2;

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Escape special tsquery characters from a search term.
 * Removes characters that would break the tsquery syntax.
 *
 * @example
 * escapeForTsquery('test & query') // 'test query'
 * escapeForTsquery("user's input") // 'users input'
 */
export function escapeForTsquery(term: string): string {
  return term
    .replace(TSQUERY_SPECIAL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract quoted phrases from input, returning phrases and remaining text.
 *
 * @example
 * extractPhrases('"Rai Kunimitsu" katana')
 * // { phrases: ['Rai Kunimitsu'], remaining: 'katana' }
 */
export function extractPhrases(input: string): {
  phrases: string[];
  remaining: string;
} {
  const phrases: string[] = [];
  let remaining = input;

  // Match both "double quotes" and 'single quotes'
  const phrasePattern = /["']([^"']+)["']/g;
  let match;

  while ((match = phrasePattern.exec(input)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length >= DEFAULT_MIN_TERM_LENGTH) {
      phrases.push(phrase);
    }
    remaining = remaining.replace(match[0], ' ');
  }

  return {
    phrases,
    remaining: remaining.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Build a phrase tsquery using the <-> (followed by) operator.
 * This requires words to appear adjacent to each other.
 *
 * @example
 * buildPhraseQuery('Rai Kunimitsu', { prefixMatch: false })
 * // 'rai <-> kunimitsu'
 */
export function buildPhraseQuery(
  phrase: string,
  options: FTSQueryOptions = {}
): string {
  const normalized = normalizeSearchText(phrase);
  const escaped = escapeForTsquery(normalized);
  const terms = escaped.split(/\s+/).filter(t => t.length >= (options.minTermLength ?? DEFAULT_MIN_TERM_LENGTH));

  if (terms.length === 0) return '';
  if (terms.length === 1) {
    return options.prefixMatch ? `${terms[0]}:*` : terms[0];
  }

  // Join with <-> for adjacency (phrase matching)
  // Last term can have prefix match if enabled
  if (options.prefixMatch) {
    const allButLast = terms.slice(0, -1);
    const last = terms[terms.length - 1];
    return [...allButLast, `${last}:*`].join(' <-> ');
  }

  return terms.join(' <-> ');
}

/**
 * Build a standard tsquery with AND logic between terms.
 * Each term must match (word boundary matching, not substring).
 *
 * @example
 * buildTermsQuery('bizen katana', { prefixMatch: true })
 * // 'bizen:* & katana:*'
 */
export function buildTermsQuery(
  input: string,
  options: FTSQueryOptions = {}
): string {
  const normalized = normalizeSearchText(input);
  const escaped = escapeForTsquery(normalized);
  const terms = escaped.split(/\s+/).filter(t => t.length >= (options.minTermLength ?? DEFAULT_MIN_TERM_LENGTH));

  if (terms.length === 0) return '';

  // Add prefix matching if enabled
  const formattedTerms = options.prefixMatch
    ? terms.map(t => `${t}:*`)
    : terms;

  // Join with & for AND logic (all terms must match)
  return formattedTerms.join(' & ');
}

/**
 * Build a PostgreSQL tsquery string from user input.
 *
 * Handles:
 * - Quoted phrases: "Rai Kunimitsu" -> rai <-> kunimitsu
 * - Multiple terms: bizen katana -> bizen:* & katana:*
 * - Mixed: "Rai Kunimitsu" katana -> (rai <-> kunimitsu) & katana:*
 *
 * @example
 * buildFTSQuery('rai kunimitsu', { prefixMatch: true })
 * // { tsquery: 'rai:* & kunimitsu:*', isPhraseSearch: false, terms: ['rai', 'kunimitsu'] }
 *
 * buildFTSQuery('"Rai Kunimitsu"', { prefixMatch: false })
 * // { tsquery: 'rai <-> kunimitsu', isPhraseSearch: true, terms: ['rai kunimitsu'] }
 */
export function buildFTSQuery(
  input: string,
  options: FTSQueryOptions = {}
): FTSQuery {
  if (!input || typeof input !== 'string') {
    return { tsquery: '', isPhraseSearch: false, terms: [], isEmpty: true };
  }

  const trimmed = input.trim();
  if (trimmed.length < (options.minTermLength ?? DEFAULT_MIN_TERM_LENGTH)) {
    return { tsquery: '', isPhraseSearch: false, terms: [], isEmpty: true };
  }

  // Extract quoted phrases
  const { phrases, remaining } = extractPhrases(trimmed);
  const isPhraseSearch = phrases.length > 0;

  const queryParts: string[] = [];
  const allTerms: string[] = [];

  // Build phrase queries
  for (const phrase of phrases) {
    const phraseQuery = buildPhraseQuery(phrase, { ...options, prefixMatch: false });
    if (phraseQuery) {
      // Wrap in parentheses if it contains multiple terms
      if (phraseQuery.includes('<->')) {
        queryParts.push(`(${phraseQuery})`);
      } else {
        queryParts.push(phraseQuery);
      }
      allTerms.push(phrase.toLowerCase());
    }
  }

  // Build remaining terms query
  if (remaining) {
    const termsQuery = buildTermsQuery(remaining, options);
    if (termsQuery) {
      // Split the termsQuery to get individual terms for logging
      const normalizedRemaining = normalizeSearchText(remaining);
      const escapedRemaining = escapeForTsquery(normalizedRemaining);
      const terms = escapedRemaining.split(/\s+/).filter(t => t.length >= (options.minTermLength ?? DEFAULT_MIN_TERM_LENGTH));
      allTerms.push(...terms);

      // Add each term part separately if we have phrase parts
      if (queryParts.length > 0) {
        queryParts.push(termsQuery);
      } else {
        queryParts.push(termsQuery);
      }
    }
  }

  if (queryParts.length === 0) {
    return { tsquery: '', isPhraseSearch, terms: allTerms, isEmpty: true };
  }

  // Join all parts with AND
  const tsquery = queryParts.join(' & ');

  return {
    tsquery,
    isPhraseSearch,
    terms: allTerms,
    isEmpty: false,
  };
}

/**
 * Validate that a tsquery string is safe and properly formatted.
 * Returns true if valid, false if it would cause a PostgreSQL error.
 */
export function isValidTsquery(tsquery: string): boolean {
  if (!tsquery || tsquery.trim() === '') return false;

  // Check for unbalanced parentheses
  let depth = 0;
  for (const char of tsquery) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth < 0) return false;
  }
  if (depth !== 0) return false;

  // Check for empty operators (& or | with nothing on one side)
  if (/^\s*[&|]/.test(tsquery) || /[&|]\s*$/.test(tsquery)) return false;
  if (/[&|]\s*[&|]/.test(tsquery)) return false;

  return true;
}
