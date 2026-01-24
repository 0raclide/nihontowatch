/**
 * Yuhinkai URL Parser
 *
 * Parses Yuhinkai URLs to extract collection, volume, and item number.
 *
 * URL Pattern: https://yuhinkai.com/item/[collection]/[volume]/[item_number]
 *
 * Examples:
 *   /item/juyo/68/14936    → { collection: 'Juyo', volume: 68, itemNumber: 14936 }
 *   /item/tokuju/12/7      → { collection: 'Tokuju', volume: 12, itemNumber: 7 }
 *   /item/kokuho/1/5       → { collection: 'Kokuho', volume: 1, itemNumber: 5 }
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedYuhinkaiUrl {
  collection: string;
  volume: number;
  itemNumber: number;
}

export interface ParseResult {
  success: true;
  data: ParsedYuhinkaiUrl;
}

export interface ParseError {
  success: false;
  error: string;
}

export type ParseYuhinkaiUrlResult = ParseResult | ParseError;

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Valid collection identifiers (lowercase for matching)
 */
const VALID_COLLECTIONS = [
  'kokuho',     // National Treasures
  'tokuju',     // Tokubetsu Juyo
  'juyo',       // Juyo
  'jubun',      // Juyo Bijutsuhin
  'jubi',       // Juyo Bijutsuhin (variant)
  'imp_koto',   // Imperial Collection - Koto
  'imp_shin',   // Imperial Collection - Shinto
  'je_koto',    // JE Koto database
] as const;

/**
 * Maps lowercase collection names to canonical database format
 */
const COLLECTION_CANONICAL: Record<string, string> = {
  kokuho: 'Kokuho',
  tokuju: 'Tokuju',
  juyo: 'Juyo',
  jubun: 'JuBun',
  jubi: 'Jubi',
  imp_koto: 'IMP_Koto',
  imp_shin: 'IMP_Shin',
  je_koto: 'JE_Koto',
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Parse a Yuhinkai URL to extract collection, volume, and item number.
 *
 * Accepts:
 * - Full URLs: https://yuhinkai.com/item/juyo/68/14936
 * - Paths with leading slash: /item/juyo/68/14936
 * - Paths without leading slash: item/juyo/68/14936
 *
 * @param url - The Yuhinkai URL or path to parse
 * @returns ParseResult with data, or ParseError with error message
 */
export function parseYuhinkaiUrl(url: string): ParseYuhinkaiUrlResult {
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: 'URL is required',
    };
  }

  const trimmedUrl = url.trim();

  try {
    // Extract pathname from full URL or use as-is for paths
    let pathname: string;

    if (trimmedUrl.includes('://')) {
      // Full URL - extract pathname
      try {
        const urlObj = new URL(trimmedUrl);
        pathname = urlObj.pathname;
      } catch {
        return {
          success: false,
          error: 'Invalid URL format',
        };
      }
    } else {
      // Path only - normalize leading slash
      pathname = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
    }

    // Match pattern: /item/{collection}/{volume}/{item_number}
    // Allows optional trailing slash
    const match = pathname.match(/^\/item\/([^/]+)\/(\d+)\/(\d+)\/?$/);

    if (!match) {
      return {
        success: false,
        error: 'Invalid URL format. Expected: /item/{collection}/{volume}/{item_number}',
      };
    }

    const [, collectionRaw, volumeStr, itemStr] = match;
    const collectionLower = collectionRaw.toLowerCase();

    // Validate collection
    if (!VALID_COLLECTIONS.includes(collectionLower as typeof VALID_COLLECTIONS[number])) {
      const validCollections = Object.values(COLLECTION_CANONICAL).join(', ');
      return {
        success: false,
        error: `Invalid collection "${collectionRaw}". Valid collections: ${validCollections}`,
      };
    }

    const volume = parseInt(volumeStr, 10);
    const itemNumber = parseInt(itemStr, 10);

    // Validate numbers are positive
    if (volume <= 0) {
      return {
        success: false,
        error: 'Volume must be a positive number',
      };
    }

    if (itemNumber <= 0) {
      return {
        success: false,
        error: 'Item number must be a positive number',
      };
    }

    return {
      success: true,
      data: {
        collection: COLLECTION_CANONICAL[collectionLower],
        volume,
        itemNumber,
      },
    };
  } catch {
    return {
      success: false,
      error: 'Failed to parse URL',
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build a Yuhinkai URL from parsed components.
 * Useful for displaying the canonical URL after parsing.
 */
export function buildYuhinkaiUrl(parsed: ParsedYuhinkaiUrl): string {
  const collectionSlug = parsed.collection.toLowerCase();
  return `/item/${collectionSlug}/${parsed.volume}/${parsed.itemNumber}`;
}

/**
 * Build a full Yuhinkai URL with domain.
 */
export function buildFullYuhinkaiUrl(parsed: ParsedYuhinkaiUrl): string {
  return `https://yuhinkai.com${buildYuhinkaiUrl(parsed)}`;
}

/**
 * Get display name for a collection.
 */
export function getCollectionDisplayName(collection: string): string {
  const displayNames: Record<string, string> = {
    Kokuho: 'Kokuho (National Treasure)',
    Tokuju: 'Tokubetsu Juyo',
    Juyo: 'Juyo',
    JuBun: 'Juyo Bijutsuhin',
    Jubi: 'Juyo Bijutsuhin',
    IMP_Koto: 'Imperial Collection (Koto)',
    IMP_Shin: 'Imperial Collection (Shinto)',
    JE_Koto: 'JE Koto',
  };
  return displayNames[collection] || collection;
}
