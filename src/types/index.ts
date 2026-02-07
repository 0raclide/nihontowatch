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
  | 'kodachi'           // Short sword (小太刀)
  | 'naginata'
  | 'naginata naoshi'   // Converted naginata (薙刀直し)
  | 'yari'
  | 'ken'
  | 'daisho'            // Matched pair (大小)
  // Tosogu
  | 'tsuba'
  | 'menuki'
  | 'kozuka'
  | 'kogai'
  | 'fuchi'
  | 'kashira'
  | 'fuchi_kashira'
  | 'futatokoro'        // 2-piece set (二所物)
  | 'mitokoromono'      // 3-piece set (三所物)
  | 'tosogu'            // Generic fitting
  // Other
  | 'armor'
  | 'helmet'
  | 'koshirae'
  | 'stand'             // Display stands
  | 'book'              // Reference books
  | 'other'             // Non-collectibles
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
// SETSUMEI METADATA (from Oshi-scrapper setsumei pipeline)
// =============================================================================

export interface SetsumeiMetadata {
  designation?: {
    classification?: string; // "juyo", "tokubetsu_juyo"
    session_number?: number; // e.g., 70
    date?: string;
  };
  smith?: {
    name_romaji?: string;
    name_kanji?: string;
    school?: string;
    province?: string;
    era?: string;
  };
  maker?: {
    name_romaji?: string;
    name_kanji?: string;
    school?: string;
  };
  measurements?: {
    nagasa?: number;
    sori?: number;
    motohaba?: number;
    sakihaba?: number;
    kasane?: number;
    nakago?: number;
  };
  attribution?: {
    mei_type?: string; // "mei", "mumei", etc.
    description?: string;
  };
  pipeline_info?: {
    refusal_detected?: boolean;
    source?: string;
  };
  // Allow additional fields
  [key: string]: unknown;
}

// =============================================================================
// YUHINKAI ENRICHMENT
// =============================================================================

export type EnrichmentConfidence = 'DEFINITIVE' | 'HIGH' | 'MEDIUM' | 'LOW';
export type VerificationStatus = 'auto' | 'confirmed' | 'rejected' | 'review_needed';

/**
 * Match signals from SOTA matcher
 */
export interface EnrichmentMatchSignals {
  ocr?: number;        // OCR text match score (0-1)
  session?: boolean;   // Session number matched
  maker?: number;      // Maker name match score (0-1)
}

/**
 * Yuhinkai catalog enrichment data
 * Pulled from Yuhinkai when SOTA matcher produces DEFINITIVE match
 */
export interface YuhinkaiEnrichment {
  // Database fields
  enrichment_id: number;
  listing_id: number;

  // Yuhinkai reference
  yuhinkai_uuid: string;
  yuhinkai_collection?: string;
  yuhinkai_volume?: number;
  yuhinkai_item_number?: number;

  // Match metadata
  match_score: number;
  match_confidence: EnrichmentConfidence;
  match_signals?: EnrichmentMatchSignals;
  matched_fields?: string[];

  // Enriched artisan info
  enriched_maker?: string;
  enriched_maker_kanji?: string;
  enriched_school?: string;
  enriched_period?: string;
  enriched_form_type?: string;

  // Translations - the "magic" value add
  setsumei_ja?: string;
  setsumei_en?: string;
  setsumei_en_format?: 'markdown' | 'plain';

  // Certification info
  enriched_cert_type?: string;
  enriched_cert_session?: number;

  // Item category (for extensibility: 'tosogu' now, 'blade' later)
  item_category?: string;

  // Verification
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;

  // Connection source (auto = SOTA matcher, manual = admin URL paste)
  connection_source?: 'auto' | 'manual';

  // Timestamps
  enriched_at: string;
  updated_at: string;
}

/**
 * Listing with Yuhinkai enrichment data
 */
export interface ListingWithEnrichment extends Listing {
  yuhinkai_enrichment?: YuhinkaiEnrichment | null;
}

/**
 * Check if listing has verified Yuhinkai enrichment that should be displayed.
 *
 * Only returns true for:
 * - Manual connections (connection_source === 'manual') with 'confirmed' status
 * - Auto connections only if SHOW_AUTO_MATCHED_ENRICHMENTS is enabled (currently disabled
 *   because the auto-matcher produces false positives)
 *
 * @see SHOW_AUTO_MATCHED_ENRICHMENTS in src/lib/constants.ts
 * @see docs/YUHINKAI_SETSUMEI_CONNECTION.md
 */
export function hasVerifiedEnrichment(listing: ListingWithEnrichment): boolean {
  const enrichment = listing.yuhinkai_enrichment;
  if (!enrichment) return false;

  // Must have DEFINITIVE confidence
  if (enrichment.match_confidence !== 'DEFINITIVE') return false;

  // Check connection source
  const isManual = enrichment.connection_source === 'manual';
  const isAuto = !enrichment.connection_source || enrichment.connection_source === 'auto';

  // Only show manual connections (auto-matcher is not production-ready)
  // To enable auto-matches, set SHOW_AUTO_MATCHED_ENRICHMENTS = true in constants.ts
  // Note: We inline the value here to avoid circular import from constants.ts
  const SHOW_AUTO_MATCHED_ENRICHMENTS = false;

  if (isAuto && !SHOW_AUTO_MATCHED_ENRICHMENTS) {
    return false;
  }

  // Manual connections must be 'confirmed', auto must be in allowed statuses
  if (isManual) {
    return enrichment.verification_status === 'confirmed';
  }

  return ['auto', 'confirmed'].includes(enrichment.verification_status);
}

/**
 * Get enriched artisan name (prefers Yuhinkai if available)
 */
export function getEnrichedArtisanName(listing: ListingWithEnrichment): string | undefined {
  if (hasVerifiedEnrichment(listing)) {
    return listing.yuhinkai_enrichment?.enriched_maker;
  }
  return getArtisanName(listing);
}

/**
 * Get enriched school name (prefers Yuhinkai if available)
 */
export function getEnrichedSchoolName(listing: ListingWithEnrichment): string | undefined {
  if (hasVerifiedEnrichment(listing)) {
    return listing.yuhinkai_enrichment?.enriched_school;
  }
  return getSchoolName(listing);
}

// =============================================================================
// SETSUMEI DATA HELPERS (for Study Mode)
// =============================================================================

/**
 * Setsumei content returned by getSetsumeiContent
 */
export interface SetsumeiContent {
  text_en: string;
  text_ja?: string;
  image_url?: string;
  source: 'yuhinkai' | 'ocr';
  cert_type?: string;
  cert_session?: number;
  format: 'markdown' | 'plain';
}

/**
 * Check if listing has any setsumei data available for study mode.
 * Returns true if listing has:
 * - OCR setsumei (setsumei_text_en) for Juyo/Tokuju items
 * - Verified Yuhinkai enrichment with setsumei_en
 */
export function hasSetsumeiData(listing: ListingWithEnrichment): boolean {
  // Check for OCR setsumei
  if (listing.setsumei_text_en) {
    return true;
  }

  // Check for verified Yuhinkai enrichment with setsumei
  if (hasVerifiedEnrichment(listing)) {
    const enrichment = listing.yuhinkai_enrichment;
    if (enrichment?.setsumei_en) {
      return true;
    }
  }

  return false;
}

/**
 * Get the best available setsumei content for a listing.
 * Prefers Yuhinkai enrichment (professional translation) over OCR setsumei.
 *
 * @returns SetsumeiContent or null if no setsumei available
 */
export function getSetsumeiContent(listing: ListingWithEnrichment): SetsumeiContent | null {
  // Prefer Yuhinkai enrichment (higher quality professional translation)
  if (hasVerifiedEnrichment(listing)) {
    const enrichment = listing.yuhinkai_enrichment;
    if (enrichment?.setsumei_en) {
      return {
        text_en: enrichment.setsumei_en,
        text_ja: enrichment.setsumei_ja,
        image_url: listing.setsumei_image_url, // Use OCR image if available
        source: 'yuhinkai',
        cert_type: enrichment.enriched_cert_type,
        cert_session: enrichment.enriched_cert_session,
        format: enrichment.setsumei_en_format || 'markdown',
      };
    }
  }

  // Fall back to OCR setsumei
  if (listing.setsumei_text_en) {
    return {
      text_en: listing.setsumei_text_en,
      text_ja: listing.setsumei_text_ja,
      image_url: listing.setsumei_image_url,
      source: 'ocr',
      cert_type: listing.cert_type,
      cert_session: listing.cert_session,
      format: 'markdown', // OCR always returns markdown
    };
  }

  return null;
}

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

  // Contact information
  contact_email?: string | null;
  contact_page_url?: string | null;
  sales_policy_url?: string | null;

  // Shipping & payment policies
  ships_international?: boolean | null;
  accepts_wire_transfer?: boolean | null;
  accepts_paypal?: boolean | null;
  accepts_credit_card?: boolean | null;

  // Deposit requirements
  requires_deposit?: boolean | null;
  deposit_percentage?: number | null;

  // Language support
  english_support?: boolean | null;

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
  stored_images?: string[] | null;  // Supabase Storage URLs (preferred)
  images_stored_at?: string | null; // When images were uploaded to storage
  og_image_url?: string | null;  // Pre-generated OG image URL in Supabase Storage
  raw_page_text?: string;
  description_en?: string; // Cached English translation of description
  title_en?: string; // Cached English translation of title

  // Setsumei (Official NBTHK/NTHK certification translations - Juyo/Tokuju only)
  setsumei_image_url?: string;       // URL of the detected setsumei image
  setsumei_text_ja?: string;         // Original Japanese OCR text
  setsumei_text_en?: string;         // English translation (Markdown format)
  setsumei_metadata?: SetsumeiMetadata; // Structured metadata from translation
  setsumei_processed_at?: string;    // When setsumei was processed
  setsumei_pipeline_version?: string; // Pipeline version (e.g., "3.6.0")
  setsumei_error?: string;           // Error message if processing failed

  // Artisan matching (from Oshi-scrapper)
  artisan_id?: string;
  artisan_confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

  // Timestamps
  first_seen_at: string;
  last_scraped_at: string;
  scrape_count: number;

  // Enriched by API (for "New this week" badge)
  dealer_earliest_seen_at?: string | null;

  // Relations (when joined)
  dealer?: Dealer;
  // Supabase returns 'dealers' (plural) from single-row joins
  // Partial allows extended interfaces to use a subset of Dealer fields
  dealers?: Partial<Dealer> & { id: number; name: string; domain: string };
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
  | 'dealer'
  | 'elite_factor';

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
  return ['katana', 'wakizashi', 'tanto', 'tachi', 'kodachi', 'naginata', 'naginata naoshi', 'yari', 'ken', 'daisho'].includes(type);
}

/**
 * Check if item is tosogu
 */
export function isTosogu(type: ItemType): boolean {
  return ['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'fuchi_kashira', 'futatokoro', 'mitokoromono', 'tosogu'].includes(type);
}

/**
 * Check if item type should be excluded from browse results
 */
export function isExcludedType(type: ItemType): boolean {
  return ['stand', 'book', 'other'].includes(type);
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
    // Blades
    katana: 'Katana',
    wakizashi: 'Wakizashi',
    tanto: 'Tantō',
    tachi: 'Tachi',
    kodachi: 'Kodachi',
    naginata: 'Naginata',
    'naginata naoshi': 'Naginata-Naoshi',
    yari: 'Yari',
    ken: 'Ken',
    daisho: 'Daishō',
    // Tosogu
    tsuba: 'Tsuba',
    menuki: 'Menuki',
    kozuka: 'Kōzuka',
    kogai: 'Kōgai',
    fuchi: 'Fuchi',
    kashira: 'Kashira',
    fuchi_kashira: 'Fuchi-Kashira',
    futatokoro: 'Futatokoro',
    mitokoromono: 'Mitokoromono',
    tosogu: 'Tosogu',
    // Other
    armor: 'Armor',
    helmet: 'Helmet',
    koshirae: 'Koshirae',
    stand: 'Stand',
    book: 'Book',
    other: 'Other',
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

// =============================================================================
// SAVED SEARCHES
// =============================================================================

export type NotificationFrequency = 'instant' | 'daily' | 'none';

/**
 * Full search criteria matching browse page filter state
 */
export interface SavedSearchCriteria {
  tab?: 'available' | 'sold' | 'all';
  category?: 'all' | 'nihonto' | 'tosogu';
  itemTypes?: string[];
  certifications?: string[];
  dealers?: number[];
  schools?: string[];
  signatureStatuses?: string[];
  askOnly?: boolean;
  query?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name?: string;
  search_criteria: SavedSearchCriteria;
  notification_frequency: NotificationFrequency;
  is_active: boolean;
  last_notified_at?: string;
  last_match_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedSearchInput {
  name?: string;
  search_criteria: SavedSearchCriteria;
  notification_frequency?: NotificationFrequency;
}

export interface UpdateSavedSearchInput {
  name?: string;
  search_criteria?: SavedSearchCriteria;
  notification_frequency?: NotificationFrequency;
  is_active?: boolean;
}

export type SavedSearchNotificationStatus = 'pending' | 'sent' | 'failed';

export interface SavedSearchNotification {
  id: string;
  saved_search_id: string;
  matched_listing_ids: number[];
  status: SavedSearchNotificationStatus;
  error_message?: string;
  created_at: string;
  sent_at?: string;
}

/**
 * Get human-readable notification frequency label
 */
export function getNotificationFrequencyLabel(freq: NotificationFrequency): string {
  const labels: Record<NotificationFrequency, string> = {
    instant: 'Instant (every 15 min)',
    daily: 'Daily digest',
    none: 'No notifications',
  };
  return labels[freq] || freq;
}

/**
 * Get notification frequency description
 */
export function getNotificationFrequencyDescription(freq: NotificationFrequency): string {
  const descriptions: Record<NotificationFrequency, string> = {
    instant: 'Get notified within 15 minutes of new matches',
    daily: 'Receive a daily email at 8am UTC with all new matches',
    none: 'Save for quick access, no email notifications',
  };
  return descriptions[freq] || '';
}

// =============================================================================
// INQUIRY EMAIL GENERATION
// =============================================================================

// Re-export inquiry types from dedicated module
export type {
  InquiryInput,
  ValidatedInquiryInput,
  GeneratedEmail,
  DealerPolicies,
  ListingContext,
  DealerContext,
  InquiryContext,
  InquiryApiResponse,
  InquiryApiError,
  InquiryResponse,
  ValidationResult,
} from '@/lib/inquiry/types';

// =============================================================================
// SUBSCRIPTION TYPES
// =============================================================================

export type {
  SubscriptionTier,
  SubscriptionStatus,
  Feature,
  BillingPeriod,
  StripeCheckoutRequest,
  StripeCheckoutResponse,
  StripePortalResponse,
  SubscriptionState,
  SubscriptionFields,
  TierPricing,
  TierInfo,
} from './subscription';

export {
  TIER_RANK,
  FEATURE_MIN_TIER,
  TIER_PRICING,
  TIER_INFO,
  FEATURE_PAYWALL_MESSAGES,
  canAccessFeature,
  getTierFeatures,
  createSubscriptionState,
} from './subscription';
