/**
 * Semantic Query Parser for Nihontowatch Search
 *
 * Extracts certification terms and item type terms from search queries
 * and converts them to exact-match database filters instead of text search.
 *
 * This fixes the bug where searching "Tanto Juyo" would return Hozon items
 * because "Juyo" was being matched via ILIKE across all text fields.
 *
 * @example
 * parseSemanticQuery("Tanto Juyo Goto")
 * // Returns:
 * // {
 * //   extractedFilters: { certifications: ['Juyo'], itemTypes: ['tanto'] },
 * //   remainingTerms: ['goto']
 * // }
 */

import { normalizeSearchText } from './textNormalization';

// =============================================================================
// TYPES
// =============================================================================

export interface SemanticFilters {
  /** Canonical certification keys for exact match (e.g., 'Juyo', 'Tokuju', 'Hozon') */
  certifications: string[];
  /** Canonical item type values (e.g., 'katana', 'tanto', 'tsuba') */
  itemTypes: string[];
}

export interface ParsedSemanticQuery {
  /** Extracted semantic filters to apply as exact-match DB filters */
  extractedFilters: SemanticFilters;
  /** Remaining terms that should go to text search (ILIKE) */
  remainingTerms: string[];
}

// =============================================================================
// CERTIFICATION MAPPINGS
// =============================================================================

/**
 * Maps search terms (lowercase) to canonical certification keys.
 * These keys match the CERT_VARIANTS keys in route.ts for DB filtering.
 */
const CERTIFICATION_TERMS: Record<string, string> = {
  // === JUYO (重要) ===
  'juyo': 'Juyo',
  'jūyō': 'Juyo',
  'juuyou': 'Juyo',
  'juyou': 'Juyo',

  // === TOKUBETSU JUYO (特別重要) - shortname: tokuju ===
  'tokuju': 'Tokuju',
  'tokubetsu juyo': 'Tokuju',
  'tokubetsujuyo': 'Tokuju',
  'toku juyo': 'Tokuju',
  'tokubetsu jūyō': 'Tokuju',

  // === HOZON (保存) ===
  'hozon': 'Hozon',
  'hōzon': 'Hozon',

  // === TOKUBETSU HOZON (特別保存) - shortname: tokuho ===
  'tokuho': 'TokuHozon',
  'tokubetsu hozon': 'TokuHozon',
  'tokubetsuhozon': 'TokuHozon',
  'toku hozon': 'TokuHozon',
  'tokubetsu hōzon': 'TokuHozon',

  // === KICHO (貴重) ===
  'kicho': 'Kicho',
  'kichō': 'Kicho',

  // === TOKUBETSU KICHO (特別貴重) ===
  'tokukicho': 'TokuKicho',
  'tokubetsu kicho': 'TokuKicho',
  'tokubetsukicho': 'TokuKicho',
  'toku kicho': 'TokuKicho',

  // === NTHK ===
  'nthk': 'NTHK',
  'nthk kanteisho': 'NTHK',
};

/**
 * Multi-word certification phrases to check first (longest first).
 * These need to be extracted before splitting into individual words.
 */
const MULTI_WORD_CERT_PHRASES = [
  'tokubetsu juyo',
  'tokubetsu hozon',
  'tokubetsu kicho',
  'tokubetsu jūyō',
  'tokubetsu hōzon',
  'toku juyo',
  'toku hozon',
  'toku kicho',
  'nthk kanteisho',
];

// =============================================================================
// ITEM TYPE MAPPINGS
// =============================================================================

/**
 * Maps search terms (lowercase) to canonical item_type values.
 * These values are used for exact matching against the item_type column.
 */
const ITEM_TYPE_TERMS: Record<string, string> = {
  // === NIHONTO (Blades) ===
  'katana': 'katana',
  'wakizashi': 'wakizashi',
  'waki': 'wakizashi',
  'tanto': 'tanto',
  'tantō': 'tanto',
  'tantou': 'tanto',
  'tachi': 'tachi',
  'naginata': 'naginata',
  'nagi': 'naginata',
  'yari': 'yari',
  'ken': 'ken',
  'kodachi': 'kodachi',

  // === TOSOGU (Fittings) ===
  'tsuba': 'tsuba',
  'tuba': 'tsuba', // common misspelling
  'fuchi': 'fuchi',
  'kashira': 'kashira',
  'fuchi-kashira': 'fuchi-kashira',
  'fuchikashira': 'fuchi-kashira',
  'fuchi kashira': 'fuchi-kashira',
  'menuki': 'menuki',
  'kozuka': 'kozuka',
  'kogatana': 'kogatana',
  'kogai': 'kogai',
  'koshirae': 'koshirae',
  'mitokoromono': 'mitokoromono',
};

/**
 * Multi-word item type phrases to check first.
 */
const MULTI_WORD_TYPE_PHRASES = [
  'fuchi kashira',
  'fuchi-kashira',
];

// =============================================================================
// PARSER FUNCTIONS
// =============================================================================

/**
 * Parse a search query to extract semantic filters.
 *
 * The function:
 * 1. Normalizes the query (lowercase, remove macrons)
 * 2. Extracts multi-word phrases first (e.g., "tokubetsu juyo")
 * 3. Extracts single-word semantic terms (certifications, item types)
 * 4. Returns remaining terms for text search
 *
 * @param queryStr - The raw search query string
 * @returns Parsed semantic query with extracted filters and remaining terms
 */
export function parseSemanticQuery(queryStr: string): ParsedSemanticQuery {
  const result: ParsedSemanticQuery = {
    extractedFilters: {
      certifications: [],
      itemTypes: [],
    },
    remainingTerms: [],
  };

  if (!queryStr || !queryStr.trim()) {
    return result;
  }

  // Normalize the query (lowercase, remove macrons, collapse whitespace)
  let workingQuery = normalizeSearchText(queryStr);

  // Step 1: Extract multi-word certification phrases first
  for (const phrase of MULTI_WORD_CERT_PHRASES) {
    if (workingQuery.includes(phrase)) {
      const canonical = CERTIFICATION_TERMS[phrase];
      if (canonical && !result.extractedFilters.certifications.includes(canonical)) {
        result.extractedFilters.certifications.push(canonical);
      }
      // Remove the phrase from working query
      workingQuery = workingQuery.replace(phrase, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Step 2: Extract multi-word item type phrases
  for (const phrase of MULTI_WORD_TYPE_PHRASES) {
    if (workingQuery.includes(phrase)) {
      const canonical = ITEM_TYPE_TERMS[phrase];
      if (canonical && !result.extractedFilters.itemTypes.includes(canonical)) {
        result.extractedFilters.itemTypes.push(canonical);
      }
      workingQuery = workingQuery.replace(phrase, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Step 3: Split remaining query into words and process each
  const words = workingQuery.split(/\s+/).filter(w => w.length >= 2);

  for (const word of words) {
    // Check if it's a single-word certification term
    const certCanonical = CERTIFICATION_TERMS[word];
    if (certCanonical) {
      if (!result.extractedFilters.certifications.includes(certCanonical)) {
        result.extractedFilters.certifications.push(certCanonical);
      }
      continue;
    }

    // Check if it's an item type term
    const typeCanonical = ITEM_TYPE_TERMS[word];
    if (typeCanonical) {
      if (!result.extractedFilters.itemTypes.includes(typeCanonical)) {
        result.extractedFilters.itemTypes.push(typeCanonical);
      }
      continue;
    }

    // Not a semantic term - pass to text search
    result.remainingTerms.push(word);
  }

  return result;
}

/**
 * Check if a word is a known semantic term (certification or item type).
 * Useful for highlighting or UI purposes.
 */
export function isSemanticTerm(word: string): boolean {
  const normalized = normalizeSearchText(word);
  return !!(CERTIFICATION_TERMS[normalized] || ITEM_TYPE_TERMS[normalized]);
}

/**
 * Get the canonical certification key for a search term.
 * Returns undefined if not a certification term.
 */
export function getCertificationKey(term: string): string | undefined {
  return CERTIFICATION_TERMS[normalizeSearchText(term)];
}

/**
 * Get the canonical item type for a search term.
 * Returns undefined if not an item type term.
 */
export function getItemTypeKey(term: string): string | undefined {
  return ITEM_TYPE_TERMS[normalizeSearchText(term)];
}
