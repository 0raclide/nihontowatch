/**
 * Core type definitions for Nihontowatch
 *
 * These types mirror the Oshi-scrapper data model (Python → TypeScript)
 * See: Oshi-scrapper/models/listing.py
 */

// =============================================================================
// ENUMS
// =============================================================================

export type ItemType =
  // Blades
  | 'katana'
  | 'wakizashi'
  | 'tanto'
  | 'tachi'
  | 'naginata'
  | 'yari'
  | 'ken'
  // Tosogu
  | 'tsuba'
  | 'menuki'
  | 'kozuka'
  | 'kogai'
  | 'fuchi'
  | 'kashira'
  | 'fuchi_kashira'
  // Other
  | 'armor'
  | 'helmet'
  | 'koshirae'
  | 'unknown';

export type ListingStatus =
  | 'available'
  | 'sold'
  | 'presumed_sold'
  | 'withdrawn'
  | 'expired'
  | 'error'
  | 'unknown';

export type CertificationType =
  | 'Juyo'
  | 'Tokubetsu Juyo'
  | 'Hozon'
  | 'Tokubetsu Hozon'
  | 'Juyo Tosogu'
  | 'Tokubetsu Hozon Tosogu'
  | 'Hozon Tosogu'
  | 'NTHK Kanteisho'
  | string; // Allow other values

export type Currency = 'JPY' | 'USD' | 'EUR' | 'GBP';

// =============================================================================
// DEALER
// =============================================================================

export interface Dealer {
  id: number;
  name: string;
  domain: string;
  catalog_url?: string;
  country: string;
  is_active: boolean;
  created_at: string;
  // Computed fields
  listing_count?: number;
  slug?: string;
}

// =============================================================================
// LISTING
// =============================================================================

export interface Listing {
  id: number;
  url: string;
  dealer_id: number;

  // Status
  status: ListingStatus;
  is_available: boolean;
  is_sold: boolean;
  page_exists: boolean;

  // Basic info
  title: string;
  description?: string;
  item_type: ItemType;
  item_category?: string;

  // Price
  price_value?: number;
  price_currency: Currency;
  price_raw?: string;

  // Sword specifications
  nagasa_cm?: number;
  sori_cm?: number;
  motohaba_cm?: number;
  sakihaba_cm?: number;
  kasane_cm?: number;
  weight_g?: number;
  nakago_cm?: number;

  // Tosogu specifications
  tosogu_maker?: string;
  tosogu_school?: string;
  material?: string;
  height_cm?: number;
  width_cm?: number;
  thickness_mm?: number;

  // Attribution (swords)
  smith?: string;
  school?: string;
  province?: string;
  era?: string;
  mei_type?: string;

  // Certification
  cert_type?: CertificationType;
  cert_session?: number;
  cert_organization?: string;

  // Media
  images: string[];
  raw_page_text?: string;

  // Timestamps
  first_seen_at: string;
  last_scraped_at: string;
  scrape_count: number;

  // Relations (when joined)
  dealer?: Dealer;
}

// =============================================================================
// LISTING DETAIL (with relations)
// =============================================================================

export interface ListingDetail extends Listing {
  dealer: Dealer;
  price_history: PriceChange[];
  similar_listings?: Listing[];
}

// =============================================================================
// PRICE HISTORY
// =============================================================================

export interface PriceChange {
  id: number;
  listing_id: number;
  old_price?: number;
  new_price?: number;
  old_currency?: Currency;
  new_currency?: Currency;
  change_type: 'increase' | 'decrease' | 'new' | 'sold' | 'status_change';
  detected_at: string;
}

// =============================================================================
// SEARCH & BROWSE
// =============================================================================

export interface BrowseFilters {
  q?: string;
  type?: ItemType | ItemType[];
  dealer?: string | string[];
  certification?: CertificationType | CertificationType[];
  school?: string | string[];
  province?: string | string[];
  era?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  status?: ListingStatus;
  sort?: SortOption;
  page?: number;
  limit?: number;
}

export type SortOption =
  | 'recent'
  | 'price_asc'
  | 'price_desc'
  | 'name'
  | 'dealer';

export interface BrowseResult {
  listings: Listing[];
  total: number;
  page: number;
  totalPages: number;
  facets: Facets;
}

export interface Facets {
  types: FacetItem[];
  dealers: FacetItem[];
  certifications: FacetItem[];
  schools: FacetItem[];
  provinces: FacetItem[];
  eras: FacetItem[];
  priceRanges: PriceRangeFacet[];
}

export interface FacetItem {
  value: string;
  count: number;
  label?: string;
}

export interface PriceRangeFacet {
  label: string;
  min: number;
  max: number;
  count: number;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Check if item is a blade type
 */
export function isBlade(type: ItemType): boolean {
  return ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken'].includes(type);
}

/**
 * Check if item is tosogu
 */
export function isTosogu(type: ItemType): boolean {
  return ['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'fuchi_kashira'].includes(type);
}

/**
 * Get artisan name from listing (handles both swords and tosogu)
 */
export function getArtisanName(listing: Listing): string | undefined {
  // For tosogu, use tosogu_maker
  if (isTosogu(listing.item_type)) {
    return listing.tosogu_maker;
  }
  // For swords, use smith
  return listing.smith;
}

/**
 * Get school name from listing (handles both swords and tosogu)
 */
export function getSchoolName(listing: Listing): string | undefined {
  // For tosogu, use tosogu_school
  if (isTosogu(listing.item_type)) {
    return listing.tosogu_school;
  }
  // For swords, use school
  return listing.school;
}

/**
 * Format price for display
 */
export function formatPrice(value: number | undefined, currency: Currency = 'JPY'): string {
  if (value === undefined || value === null) {
    return 'Ask';
  }

  const formatter = new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });

  return formatter.format(value);
}

/**
 * Get human-readable item type label
 */
export function getItemTypeLabel(type: ItemType): string {
  const labels: Record<ItemType, string> = {
    katana: 'Katana',
    wakizashi: 'Wakizashi',
    tanto: 'Tantō',
    tachi: 'Tachi',
    naginata: 'Naginata',
    yari: 'Yari',
    ken: 'Ken',
    tsuba: 'Tsuba',
    menuki: 'Menuki',
    kozuka: 'Kōzuka',
    kogai: 'Kōgai',
    fuchi: 'Fuchi',
    kashira: 'Kashira',
    fuchi_kashira: 'Fuchi-Kashira',
    armor: 'Armor',
    helmet: 'Helmet',
    koshirae: 'Koshirae',
    unknown: 'Unknown',
  };

  return labels[type] || type;
}

// =============================================================================
// ALERTS
// =============================================================================

export type AlertType = 'price_drop' | 'new_listing' | 'back_in_stock';

export interface AlertSearchCriteria {
  item_type?: string;
  dealer_id?: number;
  min_price?: number;
  max_price?: number;
  cert_type?: string;
}

export interface Alert {
  id: number;
  user_id: string;
  alert_type: AlertType;
  listing_id: number | null;
  target_price: number | null;
  search_criteria: AlertSearchCriteria | null;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  listing?: Listing;
}

export interface CreateAlertInput {
  alert_type: AlertType;
  listing_id?: number;
  target_price?: number;
  search_criteria?: AlertSearchCriteria;
}

export interface UpdateAlertInput {
  is_active?: boolean;
  target_price?: number;
  search_criteria?: AlertSearchCriteria;
}

/**
 * Get human-readable alert type label
 */
export function getAlertTypeLabel(type: AlertType): string {
  const labels: Record<AlertType, string> = {
    price_drop: 'Price Drop',
    new_listing: 'New Listing',
    back_in_stock: 'Back in Stock',
  };
  return labels[type] || type;
}

/**
 * Get alert type description
 */
export function getAlertTypeDescription(type: AlertType): string {
  const descriptions: Record<AlertType, string> = {
    price_drop: 'Get notified when the price drops',
    new_listing: 'Get notified when new items match your criteria',
    back_in_stock: 'Get notified when this item becomes available again',
  };
  return descriptions[type] || '';
}
