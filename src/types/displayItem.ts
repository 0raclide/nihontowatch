/**
 * DisplayItem — unified display type for browse listings AND collection items.
 *
 * Replaces the three separate Listing interfaces (global, ListingCard local,
 * VirtualListingGrid local) and the fake AdaptedListing adapter type.
 *
 * Browse-specific fields live in `browse`, collection-specific in `collection`.
 * Shared fields (artisan, cert, measurements, media) are top-level.
 */

// =============================================================================
// SOURCE DISCRIMINATOR
// =============================================================================

export type DisplayItemSource = 'browse' | 'collection' | 'dealer';

// =============================================================================
// EXTENSION TYPES (source-specific fields)
// =============================================================================

export interface BrowseExtension {
  url: string;
  admin_hidden?: boolean;
  status_admin_locked?: boolean;
  featured_score?: number;
  sold_data?: {
    sale_date: string | null;
    days_on_market: number | null;
    days_on_market_display: string | null;
    confidence: string;
  } | null;
}

export interface CollectionExtension {
  notes: string | null;
  condition: string;
  collection_status: string;
  price_paid: number | null;
  price_paid_currency: string | null;
  current_value: number | null;
  current_value_currency: string | null;
  acquired_from: string | null;
  acquired_date: string | null;
  source_listing_id: number | null;
}

// =============================================================================
// MAIN TYPE
// =============================================================================

export interface DisplayItem {
  // Identity
  id: string | number;
  source: DisplayItemSource;

  // Content
  title: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_ja?: string | null;
  item_type: string | null;

  // Pricing (pre-resolved: browse uses listing price, collection uses current_value ?? price_paid)
  price_value: number | null;
  price_currency: string | null;

  // Attribution (dual-path: swords vs tosogu)
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  province?: string | null;
  era?: string | null;
  mei_type?: string | null;

  // Certification
  cert_type: string | null;
  cert_session?: number | null;
  cert_organization?: string | null;

  // Measurements
  nagasa_cm: number | null;
  sori_cm?: number | null;
  motohaba_cm?: number | null;
  sakihaba_cm?: number | null;
  kasane_cm?: number | null;
  weight_g?: number | null;

  // Media
  images: string[] | null;
  stored_images?: string[] | null;
  og_image_url?: string | null;
  focal_x?: number | null;
  focal_y?: number | null;
  thumbnail_url?: string | null;

  // Artisan
  artisan_id?: string | null;
  artisan_display_name?: string | null;
  artisan_name_kanji?: string | null;
  artisan_confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
  artisan_tier?: string | null;
  artisan_method?: string | null;
  artisan_candidates?: Array<{
    artisan_id: string;
    name_kanji?: string;
    name_romaji?: string;
    school?: string;
    generation?: string;
    is_school_code?: boolean;
    retrieval_method?: string;
    retrieval_score?: number;
  }> | null;
  artisan_verified?: 'correct' | 'incorrect' | null;

  // Status
  status: string;
  is_available: boolean;
  is_sold: boolean;

  // Temporal ("New" badge + freshness)
  first_seen_at: string;
  is_initial_import?: boolean | null;
  dealer_earliest_seen_at?: string | null;
  last_scraped_at?: string | null;

  // Dealer display (pre-resolved by mapper, no locale logic in components)
  dealer_display_name: string;
  dealer_display_name_ja?: string | null;
  dealer_domain?: string;
  dealer_id?: number | null;

  // Setsumei
  setsumei_text_en?: string | null;
  setsumei_text_ja?: string | null;
  setsumei_metadata?: Record<string, unknown> | null;
  setsumei_processed_at?: string | null;
  has_setsumei?: boolean;
  yuhinkai_enrichment?: any;

  // Source-specific extensions
  browse?: BrowseExtension | null;
  collection?: CollectionExtension | null;
}
