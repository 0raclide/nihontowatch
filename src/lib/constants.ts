/**
 * Application-wide constants
 * Single source of truth for magic numbers and configuration
 */

// =============================================================================
// PAGINATION
// =============================================================================

export const PAGINATION = {
  /** Default page size for listing grids */
  DEFAULT_PAGE_SIZE: 100,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 200,
  /** Page size for mobile devices */
  MOBILE_PAGE_SIZE: 12,
} as const;

// =============================================================================
// CACHE
// =============================================================================

export const CACHE = {
  /** Browse results cache (seconds) */
  BROWSE_RESULTS: 300, // 5 minutes
  /** Listing detail cache (seconds) */
  LISTING_DETAIL: 600, // 10 minutes
  /** Facet counts cache (seconds) */
  FACETS: 300, // 5 minutes
  /** Dealer list cache (seconds) */
  DEALERS: 3600, // 1 hour
  /** Stale-while-revalidate window (seconds) */
  SWR_WINDOW: 600, // 10 minutes
} as const;

// =============================================================================
// SEARCH
// =============================================================================

export const SEARCH = {
  /** Minimum characters to trigger search */
  MIN_QUERY_LENGTH: 2,
  /** Debounce delay for search input (ms) */
  DEBOUNCE_MS: 300,
  /** Maximum search results to return */
  MAX_RESULTS: 1000,
  /** Facet count threshold for showing "Show all" */
  FACET_SHOW_ALL_THRESHOLD: 10,
} as const;

// =============================================================================
// PRICE RANGES
// =============================================================================

export const PRICE_RANGES = [
  { label: 'Under ¥100,000', min: 0, max: 100000 },
  { label: '¥100,000 - ¥500,000', min: 100000, max: 500000 },
  { label: '¥500,000 - ¥1,000,000', min: 500000, max: 1000000 },
  { label: '¥1,000,000 - ¥3,000,000', min: 1000000, max: 3000000 },
  { label: '¥3,000,000 - ¥5,000,000', min: 3000000, max: 5000000 },
  { label: '¥5,000,000 - ¥10,000,000', min: 5000000, max: 10000000 },
  { label: 'Over ¥10,000,000', min: 10000000, max: Infinity },
] as const;

// =============================================================================
// ITEM TYPES
// =============================================================================

export const ITEM_TYPES = {
  // Blades
  KATANA: 'katana',
  WAKIZASHI: 'wakizashi',
  TANTO: 'tanto',
  TACHI: 'tachi',
  NAGINATA: 'naginata',
  YARI: 'yari',
  KEN: 'ken',
  // Tosogu
  TSUBA: 'tsuba',
  MENUKI: 'menuki',
  KOZUKA: 'kozuka',
  KOGAI: 'kogai',
  FUCHI: 'fuchi',
  KASHIRA: 'kashira',
  FUCHI_KASHIRA: 'fuchi_kashira',
  // Other
  ARMOR: 'armor',
  HELMET: 'helmet',
  KOSHIRAE: 'koshirae',
  UNKNOWN: 'unknown',
} as const;

export const BLADE_TYPES = [
  ITEM_TYPES.KATANA,
  ITEM_TYPES.WAKIZASHI,
  ITEM_TYPES.TANTO,
  ITEM_TYPES.TACHI,
  ITEM_TYPES.NAGINATA,
  ITEM_TYPES.YARI,
  ITEM_TYPES.KEN,
] as const;

export const TOSOGU_TYPES = [
  ITEM_TYPES.TSUBA,
  ITEM_TYPES.MENUKI,
  ITEM_TYPES.KOZUKA,
  ITEM_TYPES.KOGAI,
  ITEM_TYPES.FUCHI,
  ITEM_TYPES.KASHIRA,
  ITEM_TYPES.FUCHI_KASHIRA,
] as const;

// =============================================================================
// CERTIFICATIONS
// =============================================================================

export const CERTIFICATIONS = {
  // NBTHK
  JUYO: 'Juyo',
  TOKUBETSU_JUYO: 'Tokubetsu Juyo',
  HOZON: 'Hozon',
  TOKUBETSU_HOZON: 'Tokubetsu Hozon',
  // NTHK
  NTHK_KANTEISHO: 'NTHK Kanteisho',
  // Tosogu specific
  JUYO_TOSOGU: 'Juyo Tosogu',
  TOKUBETSU_HOZON_TOSOGU: 'Tokubetsu Hozon Tosogu',
  HOZON_TOSOGU: 'Hozon Tosogu',
} as const;

export const CERTIFICATION_PRIORITY = {
  [CERTIFICATIONS.TOKUBETSU_JUYO]: 1,
  [CERTIFICATIONS.JUYO]: 2,
  [CERTIFICATIONS.TOKUBETSU_HOZON]: 3,
  [CERTIFICATIONS.HOZON]: 4,
  [CERTIFICATIONS.JUYO_TOSOGU]: 2,
  [CERTIFICATIONS.TOKUBETSU_HOZON_TOSOGU]: 3,
  [CERTIFICATIONS.HOZON_TOSOGU]: 4,
  [CERTIFICATIONS.NTHK_KANTEISHO]: 5,
} as const;

// =============================================================================
// LISTING STATUS
// =============================================================================

export const LISTING_STATUS = {
  AVAILABLE: 'available',
  SOLD: 'sold',
  PRESUMED_SOLD: 'presumed_sold',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
  ERROR: 'error',
  UNKNOWN: 'unknown',
} as const;

// =============================================================================
// DISPLAY
// =============================================================================

export const DISPLAY = {
  /** Truncate title after this many characters */
  TITLE_MAX_LENGTH: 80,
  /** Truncate description after this many characters */
  DESCRIPTION_MAX_LENGTH: 200,
  /** Number of images to show in grid view */
  GRID_IMAGE_COUNT: 1,
  /** Number of images to show in detail view */
  DETAIL_IMAGE_COUNT: 10,
} as const;

// =============================================================================
// API
// =============================================================================

export const API = {
  /** Request timeout (ms) */
  TIMEOUT: 10000,
  /** Retry attempts for failed requests */
  RETRY_ATTEMPTS: 3,
  /** Base delay between retries (ms) */
  RETRY_DELAY: 1000,
} as const;

// =============================================================================
// ROUTES
// =============================================================================

export const ROUTES = {
  HOME: '/',
  BROWSE: '/browse',
  SEARCH: '/search',
  LISTING: (id: string | number) => `/listing/${id}`,
  ALERTS: '/alerts',
  ABOUT: '/about',
} as const;
