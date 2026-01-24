/**
 * Application-wide constants
 * Single source of truth for magic numbers and configuration
 */

// =============================================================================
// LISTING FILTERS
// =============================================================================

export const LISTING_FILTERS = {
  /**
   * Minimum price threshold in JPY.
   * Listings below this price are hidden from the app.
   * Set to 0 to disable the filter.
   * This helps filter out books, accessories, and very low-quality items.
   */
  MIN_PRICE_JPY: 100000,
} as const;

// =============================================================================
// PAGINATION
// =============================================================================

export const PAGINATION = {
  /** Default page size for listing grids (initial load) */
  DEFAULT_PAGE_SIZE: 100,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 200,
  /** Page size for mobile devices */
  MOBILE_PAGE_SIZE: 12,
  /** Batch size for infinite scroll load-more requests */
  INFINITE_SCROLL_BATCH_SIZE: 50,
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
  KODACHI: 'kodachi',           // Short sword (小太刀)
  NAGINATA: 'naginata',
  NAGINATA_NAOSHI: 'naginata naoshi',  // Converted naginata
  YARI: 'yari',
  KEN: 'ken',
  DAISHO: 'daisho',             // Matched katana + wakizashi pair (大小)
  // Tosogu
  TSUBA: 'tsuba',
  MENUKI: 'menuki',
  KOZUKA: 'kozuka',
  KOGAI: 'kogai',
  FUCHI: 'fuchi',
  KASHIRA: 'kashira',
  FUCHI_KASHIRA: 'fuchi_kashira',
  FUTATOKORO: 'futatokoro',     // 2-piece set: kozuka + kogai (二所物)
  MITOKOROMONO: 'mitokoromono', // 3-piece set (三所物)
  TOSOGU: 'tosogu',             // Generic fitting
  // Armor & Accessories
  ARMOR: 'armor',
  YOROI: 'yoroi',
  GUSOKU: 'gusoku',
  HELMET: 'helmet',
  KABUTO: 'kabuto',
  MENPO: 'menpo',
  MENGU: 'mengu',
  KOTE: 'kote',
  SUNEATE: 'suneate',
  DO: 'do',
  // Other
  KOSHIRAE: 'koshirae',
  STAND: 'stand',               // Sword racks, display stands
  BOOK: 'book',                 // Reference books, catalogs
  OTHER: 'other',               // Non-collectible items
  UNKNOWN: 'unknown',
} as const;

export const BLADE_TYPES = [
  ITEM_TYPES.KATANA,
  ITEM_TYPES.WAKIZASHI,
  ITEM_TYPES.TANTO,
  ITEM_TYPES.TACHI,
  ITEM_TYPES.KODACHI,
  ITEM_TYPES.NAGINATA,
  ITEM_TYPES.NAGINATA_NAOSHI,
  ITEM_TYPES.YARI,
  ITEM_TYPES.KEN,
  ITEM_TYPES.DAISHO,
] as const;

export const TOSOGU_TYPES = [
  ITEM_TYPES.TSUBA,
  ITEM_TYPES.MENUKI,
  ITEM_TYPES.KOZUKA,
  ITEM_TYPES.KOGAI,
  ITEM_TYPES.FUCHI,
  ITEM_TYPES.KASHIRA,
  ITEM_TYPES.FUCHI_KASHIRA,
  ITEM_TYPES.FUTATOKORO,
  ITEM_TYPES.MITOKOROMONO,
  ITEM_TYPES.TOSOGU,
] as const;

// Items that should be excluded from browse results (non-collectibles)
export const EXCLUDED_TYPES = [
  ITEM_TYPES.STAND,
  ITEM_TYPES.BOOK,
  ITEM_TYPES.OTHER,
] as const;

export const ARMOR_TYPES = [
  // Full armor suits
  ITEM_TYPES.ARMOR,
  ITEM_TYPES.YOROI,
  ITEM_TYPES.GUSOKU,
  // Helmets
  ITEM_TYPES.HELMET,
  ITEM_TYPES.KABUTO,
  // Face masks
  ITEM_TYPES.MENPO,
  ITEM_TYPES.MENGU,
  // Body armor components
  ITEM_TYPES.KOTE,     // Gauntlets
  ITEM_TYPES.SUNEATE,  // Shin guards
  ITEM_TYPES.DO,       // Chest armor
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
// NEW LISTING INDICATOR
// =============================================================================

export const NEW_LISTING = {
  /**
   * Number of days after first_seen_at during which a listing shows the "New this week" badge.
   */
  THRESHOLD_DAYS: 7,
  /**
   * Items discovered within this many hours of the dealer's baseline are considered
   * part of the initial import (not genuinely new listings).
   */
  INITIAL_IMPORT_WINDOW_HOURS: 24,
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
// IMAGE QUALITY
// =============================================================================

export const IMAGE_QUALITY = {
  /**
   * Minimum width in pixels for a valid product image.
   * Images below this threshold are likely UI icons, buttons, or navigation elements
   * that were accidentally scraped from dealer pages.
   */
  MIN_WIDTH: 100,

  /**
   * Minimum height in pixels for a valid product image.
   * Combined with MIN_WIDTH, filters out tiny UI elements.
   */
  MIN_HEIGHT: 100,

  /**
   * Minimum area (width × height) for a valid product image.
   * This catches images that might pass individual dimension checks
   * but are still too small to be useful (e.g., 200x50 banner).
   * 15000 = ~125x120 or similar reasonable minimum.
   */
  MIN_AREA: 15000,

  /**
   * Aspect ratio extremes. Images outside this range are likely
   * banners, icons, or other non-product imagery.
   * Format: width/height
   *
   * Japanese sword dealers use extreme aspect ratios:
   * - Tall composites: Full blade stitched vertically (e.g., Eirakudo uses 1:17)
   * - Wide blade shots: Horizontal detail photos (e.g., Token-Net uses 9:1)
   */
  MIN_ASPECT_RATIO: 0.03, // Very tall images (1:33) - accommodates tall composite blade photos
  MAX_ASPECT_RATIO: 15.0, // Very wide images (15:1) - accommodates wide horizontal blade shots
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

// =============================================================================
// DEALER CONFIGURATION
// =============================================================================

/**
 * Dealers that are known to never publish product images.
 * Listings from these dealers will show a custom placeholder
 * instead of the generic "no image" icon.
 */
export const DEALERS_WITHOUT_IMAGES: string[] = [
  'katana-ando.com',
];

// =============================================================================
// YUHINKAI ENRICHMENT
// =============================================================================

/**
 * Whether to display auto-matched Yuhinkai enrichments from the SOTA matcher.
 *
 * Set to FALSE while the auto-matcher produces false positives (e.g., matching
 * Tokuju listings to Juyo catalog records). Only manually connected enrichments
 * will be displayed.
 *
 * Set to TRUE when the auto-matcher is production-ready and false positive rate
 * is acceptable.
 *
 * @see docs/YUHINKAI_SETSUMEI_CONNECTION.md for details
 */
export const SHOW_AUTO_MATCHED_ENRICHMENTS = false;
