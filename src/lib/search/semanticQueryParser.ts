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
  /** Canonical signature status values ('signed', 'unsigned') */
  signatureStatuses: string[];
  /** Canonical province/tradition names (e.g., 'Soshu', 'Bizen') */
  provinces: string[];
}

// =============================================================================
// CATEGORY TYPE DEFINITIONS
// =============================================================================

/**
 * All nihonto (blade) types for category expansion.
 * Must stay in sync with NIHONTO_TYPES in /src/app/api/browse/route.ts
 */
const NIHONTO_TYPES = [
  'katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi', 'ken', 'naginata naoshi', 'sword'
];

/**
 * All tosogu (fitting) types for category expansion.
 * Must stay in sync with TOSOGU_TYPES in /src/app/api/browse/route.ts
 */
const TOSOGU_TYPES = [
  'tsuba', 'fuchi-kashira', 'fuchi_kashira', 'fuchi', 'kashira',
  'kozuka', 'kogatana', 'kogai', 'menuki', 'koshirae', 'tosogu', 'mitokoromono'
];

/**
 * All armor types for category expansion.
 * Must stay in sync with ARMOR_TYPES in /src/app/api/browse/route.ts
 */
const ARMOR_TYPES = [
  'armor', 'yoroi', 'gusoku',  // Full armor suits
  'helmet', 'kabuto',  // Helmets
  'menpo', 'mengu',  // Face masks
  'kote',  // Gauntlets
  'suneate',  // Shin guards
  'do',  // Chest armor
];

// =============================================================================
// CATEGORY TERM MAPPINGS
// =============================================================================

/**
 * Maps search terms (lowercase) to arrays of item types.
 * When a user types "nihonto" or "tosogu", expand to ALL types in that category.
 * This ensures typing "tosogu" gives the same results as selecting the Tosogu filter.
 */
const CATEGORY_TERMS: Record<string, string[]> = {
  // Nihonto category terms
  'nihonto': NIHONTO_TYPES,
  'nihon-to': NIHONTO_TYPES,
  'sword': NIHONTO_TYPES,
  'swords': NIHONTO_TYPES,
  'blade': NIHONTO_TYPES,
  'blades': NIHONTO_TYPES,
  'japanese sword': NIHONTO_TYPES,
  'japanese swords': NIHONTO_TYPES,

  // Tosogu category terms
  'tosogu': TOSOGU_TYPES,
  'tōsōgu': TOSOGU_TYPES,
  'fitting': TOSOGU_TYPES,
  'fittings': TOSOGU_TYPES,
  'sword fittings': TOSOGU_TYPES,
  'sword fitting': TOSOGU_TYPES,
  'kodogu': TOSOGU_TYPES,
  'kodōgu': TOSOGU_TYPES,

  // Armor category terms
  'armor': ARMOR_TYPES,
  'armour': ARMOR_TYPES,
  'yoroi': ARMOR_TYPES,
  'gusoku': ARMOR_TYPES,
  'samurai armor': ARMOR_TYPES,
  'samurai armour': ARMOR_TYPES,
  'japanese armor': ARMOR_TYPES,
  'japanese armour': ARMOR_TYPES,
  'kacchu': ARMOR_TYPES,
  'katchū': ARMOR_TYPES,
};

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
  '重要': 'Juyo',

  // === TOKUBETSU JUYO (特別重要) - shortname: tokuju ===
  'tokuju': 'Tokuju',
  'tokubetsu juyo': 'Tokuju',
  'tokubetsujuyo': 'Tokuju',
  'toku juyo': 'Tokuju',
  'tokubetsu jūyō': 'Tokuju',
  '特別重要': 'Tokuju',

  // === HOZON (保存) ===
  'hozon': 'Hozon',
  'hōzon': 'Hozon',
  '保存': 'Hozon',

  // === TOKUBETSU HOZON (特別保存) - shortname: tokuho ===
  'tokuho': 'TokuHozon',
  'tokubetsu hozon': 'TokuHozon',
  'tokubetsuhozon': 'TokuHozon',
  'toku hozon': 'TokuHozon',
  'tokubetsu hōzon': 'TokuHozon',
  '特別保存': 'TokuHozon',

  // === KICHO (貴重) ===
  'kicho': 'Kicho',
  'kichō': 'Kicho',
  '貴重': 'Kicho',

  // === TOKUBETSU KICHO (特別貴重) ===
  'tokukicho': 'TokuKicho',
  'tokubetsu kicho': 'TokuKicho',
  'tokubetsukicho': 'TokuKicho',
  'toku kicho': 'TokuKicho',
  '特別貴重': 'TokuKicho',

  // === NTHK ===
  'nthk': 'NTHK',
  'nthk kanteisho': 'NTHK',
};

/**
 * Multi-word certification phrases to check first (longest first).
 * These need to be extracted before splitting into individual words.
 */
const MULTI_WORD_CERT_PHRASES = [
  '特別重要',
  '特別保存',
  '特別貴重',
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
  // Kanji item types
  '刀': 'katana',
  '脇差': 'wakizashi',
  '短刀': 'tanto',
  '太刀': 'tachi',
  '薙刀': 'naginata',
  '槍': 'yari',
  '剣': 'ken',

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
  // Kanji tosogu types
  '鍔': 'tsuba',
  '小柄': 'kozuka',
  '目貫': 'menuki',
  '笄': 'kogai',
  '縁頭': 'fuchi-kashira',
  '拵': 'koshirae',

  // === ARMOR ===
  'kabuto': 'kabuto',
  'helmet': 'helmet',
  'menpo': 'menpo',
  'mengu': 'mengu',
  'kote': 'kote',
  'suneate': 'suneate',
  'do': 'do',
  'dō': 'do',
  // Kanji armor types
  '兜': 'kabuto',
  '甲冑': 'armor',
};

/**
 * Multi-word item type phrases to check first.
 */
const MULTI_WORD_TYPE_PHRASES = [
  '縁頭',
  '小柄',
  '目貫',
  '甲冑',
  'fuchi kashira',
  'fuchi-kashira',
];

// =============================================================================
// SIGNATURE STATUS MAPPINGS
// =============================================================================

/**
 * Maps search terms (lowercase) to canonical signature status values.
 * These values are used for exact matching against the signature_status column.
 */
const SIGNATURE_STATUS_TERMS: Record<string, string> = {
  'signed': 'signed',
  'mei': 'signed',
  'unsigned': 'unsigned',
  'mumei': 'unsigned',
  '在銘': 'signed',
  '無銘': 'unsigned',
};

// =============================================================================
// PROVINCE / TRADITION MAPPINGS
// =============================================================================

/**
 * Maps search terms (lowercase) to canonical province/tradition names.
 * Used to extract province filters from search queries like "Soshu Masamune".
 */
const PROVINCE_TERMS: Record<string, string> = {
  // Gokaden (Five Traditions)
  'soshu': 'Soshu',
  'sagami': 'Soshu',       // Sagami province = Soshu tradition
  'bizen': 'Bizen',
  'bishu': 'Bizen',        // Bishu = alternate reading of Bizen
  'yamashiro': 'Yamashiro',
  'yamato': 'Yamato',
  'mino': 'Mino',
  'noshu': 'Mino',         // Noshu = alternate reading of Mino

  // Other major provinces
  'hizen': 'Hizen',
  'satsuma': 'Satsuma',
  'echizen': 'Echizen',
  'kaga': 'Kaga',
  'owari': 'Owari',
  'settsu': 'Settsu',
  'chikuzen': 'Chikuzen',
  'tosa': 'Tosa',
  'omi': 'Omi',
  'mutsu': 'Mutsu',
  'oshu': 'Mutsu',         // Oshu = alternate reading of Mutsu
  'awa': 'Awa',
  'bungo': 'Bungo',
  'iwami': 'Iwami',
  'seki': 'Seki',          // Seki city in Mino province

  // Kanji province names
  '備前': 'Bizen',
  '山城': 'Yamashiro',
  '大和': 'Yamato',
  '相模': 'Soshu',
  '美濃': 'Mino',
  '肥前': 'Hizen',
  '薩摩': 'Satsuma',
  '越前': 'Echizen',
  '加賀': 'Kaga',
  '尾張': 'Owari',
  '摂津': 'Settsu',
  '筑前': 'Chikuzen',
  '土佐': 'Tosa',
  '近江': 'Omi',
  '陸奥': 'Mutsu',
  '阿波': 'Awa',
  '豊後': 'Bungo',
  '石見': 'Iwami',
};

/**
 * Maps canonical province names to DB search variants.
 * Each variant is used for ILIKE matching on province/school/tosogu_school columns.
 */
export const PROVINCE_VARIANTS: Record<string, string[]> = {
  'Soshu':     ['Soshu', 'Sagami'],
  'Bizen':     ['Bizen', 'Bishu'],
  'Yamashiro': ['Yamashiro'],
  'Yamato':    ['Yamato'],
  'Mino':      ['Mino', 'Noshu'],
  'Hizen':     ['Hizen'],
  'Satsuma':   ['Satsuma'],
  'Echizen':   ['Echizen'],
  'Kaga':      ['Kaga'],
  'Owari':     ['Owari'],
  'Settsu':    ['Settsu'],
  'Chikuzen':  ['Chikuzen'],
  'Tosa':      ['Tosa'],
  'Omi':       ['Omi'],
  'Mutsu':     ['Mutsu', 'Oshu'],
  'Awa':       ['Awa'],
  'Bungo':     ['Bungo'],
  'Iwami':     ['Iwami'],
  'Seki':      ['Seki', 'Mino'],
};

/**
 * Multi-word category phrases to check before splitting into words.
 */
const MULTI_WORD_CATEGORY_PHRASES = [
  'japanese sword',
  'japanese swords',
  'sword fittings',
  'sword fitting',
  'samurai armor',
  'samurai armour',
  'japanese armor',
  'japanese armour',
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
      signatureStatuses: [],
      provinces: [],
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

  // Step 2: Extract multi-word category phrases (e.g., "japanese sword", "sword fittings")
  // These expand to ALL types in the category
  for (const phrase of MULTI_WORD_CATEGORY_PHRASES) {
    if (workingQuery.includes(phrase)) {
      const categoryTypes = CATEGORY_TERMS[phrase];
      if (categoryTypes) {
        for (const type of categoryTypes) {
          if (!result.extractedFilters.itemTypes.includes(type)) {
            result.extractedFilters.itemTypes.push(type);
          }
        }
      }
      workingQuery = workingQuery.replace(phrase, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Step 3: Extract multi-word item type phrases
  for (const phrase of MULTI_WORD_TYPE_PHRASES) {
    if (workingQuery.includes(phrase)) {
      const canonical = ITEM_TYPE_TERMS[phrase];
      if (canonical && !result.extractedFilters.itemTypes.includes(canonical)) {
        result.extractedFilters.itemTypes.push(canonical);
      }
      workingQuery = workingQuery.replace(phrase, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Step 4: Split remaining query into words and process each
  // Allow single CJK characters (e.g., 刀) — they are meaningful terms
  const containsCJK = (s: string) => /[\u3000-\u9fff\uf900-\ufaff]/.test(s);
  const words = workingQuery.split(/\s+/).filter(w => w.length >= 2 || containsCJK(w));

  for (const word of words) {
    // Check if it's a single-word certification term
    const certCanonical = CERTIFICATION_TERMS[word];
    if (certCanonical) {
      if (!result.extractedFilters.certifications.includes(certCanonical)) {
        result.extractedFilters.certifications.push(certCanonical);
      }
      continue;
    }

    // Check if it's a category term (expands to ALL types in that category)
    // e.g., "nihonto" -> all blade types, "tosogu" -> all fitting types
    const categoryTypes = CATEGORY_TERMS[word];
    if (categoryTypes) {
      for (const type of categoryTypes) {
        if (!result.extractedFilters.itemTypes.includes(type)) {
          result.extractedFilters.itemTypes.push(type);
        }
      }
      continue;
    }

    // Check if it's a single item type term
    const typeCanonical = ITEM_TYPE_TERMS[word];
    if (typeCanonical) {
      if (!result.extractedFilters.itemTypes.includes(typeCanonical)) {
        result.extractedFilters.itemTypes.push(typeCanonical);
      }
      continue;
    }

    // Check if it's a signature status term
    const sigCanonical = SIGNATURE_STATUS_TERMS[word];
    if (sigCanonical) {
      if (!result.extractedFilters.signatureStatuses.includes(sigCanonical)) {
        result.extractedFilters.signatureStatuses.push(sigCanonical);
      }
      continue;
    }

    // Check if it's a province/tradition term
    const provinceCanonical = PROVINCE_TERMS[word];
    if (provinceCanonical) {
      if (!result.extractedFilters.provinces.includes(provinceCanonical)) {
        result.extractedFilters.provinces.push(provinceCanonical);
      }
      continue;
    }

    // Not a semantic term - pass to text search
    result.remainingTerms.push(word);
  }

  return result;
}

/**
 * Check if a word is a known semantic term (certification, item type, category, or signature status).
 * Useful for highlighting or UI purposes.
 */
export function isSemanticTerm(word: string): boolean {
  const normalized = normalizeSearchText(word);
  return !!(
    CERTIFICATION_TERMS[normalized] ||
    ITEM_TYPE_TERMS[normalized] ||
    CATEGORY_TERMS[normalized] ||
    SIGNATURE_STATUS_TERMS[normalized] ||
    PROVINCE_TERMS[normalized]
  );
}

/**
 * Get the canonical signature status for a search term.
 * Returns undefined if not a signature status term.
 */
export function getSignatureStatusKey(term: string): string | undefined {
  return SIGNATURE_STATUS_TERMS[normalizeSearchText(term)];
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

/**
 * Get the expanded item types for a category term.
 * Returns undefined if not a category term.
 *
 * @example
 * getCategoryTypes('nihonto') // ['katana', 'wakizashi', 'tanto', ...]
 * getCategoryTypes('tosogu')  // ['tsuba', 'fuchi-kashira', ...]
 * getCategoryTypes('katana')  // undefined (not a category term)
 */
export function getCategoryTypes(term: string): string[] | undefined {
  return CATEGORY_TERMS[normalizeSearchText(term)];
}

/**
 * Get the canonical province name for a search term.
 * Returns undefined if not a province term.
 */
export function getProvinceKey(term: string): string | undefined {
  return PROVINCE_TERMS[normalizeSearchText(term)];
}

// Export type arrays for testing
export { NIHONTO_TYPES, TOSOGU_TYPES, ARMOR_TYPES };
