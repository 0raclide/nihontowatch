/**
 * Shared item-data fields present on BOTH `listings` and `collection_items`.
 *
 * This is the canonical list of columns that exist in both tables.
 * The golden test (collection-schema-sync.test.ts) verifies that this
 * interface stays in sync with the 120_collection_items.sql migration.
 */

import type {
  ItemType,
  CertificationType,
  Currency,
  SayagakiEntry,
  HakogakiEntry,
  KoshiraeData,
  ProvenanceData,
  KiwameEntry,
  KantoHibishoData,
} from './index';

export interface ItemDataFields {
  // Classification
  item_type: ItemType | string | null;
  item_category?: string | null;
  title: string | null;
  description?: string | null;

  // Status & price
  status: string;
  is_available: boolean;
  is_sold: boolean;
  price_value?: number | null;
  price_currency?: Currency | string | null;

  // Sword specifications
  nagasa_cm?: number | null;
  sori_cm?: number | null;
  motohaba_cm?: number | null;
  sakihaba_cm?: number | null;
  kasane_cm?: number | null;
  weight_g?: number | null;
  nakago_cm?: number | null;

  // Tosogu specifications
  tosogu_maker?: string | null;
  tosogu_school?: string | null;
  material?: string | null;
  height_cm?: number | null;
  width_cm?: number | null;
  thickness_mm?: number | null;

  // Attribution (swords)
  smith?: string | null;
  school?: string | null;
  province?: string | null;
  era?: string | null;
  mei_type?: string | null;
  mei_text?: string | null;
  mei_guaranteed?: boolean | null;
  nakago_type?: string | null;

  // Certification
  cert_type?: CertificationType | string | null;
  cert_session?: string | number | null;
  cert_organization?: string | null;

  // Media
  images: string[];
  stored_images?: string[] | null;

  // Artisan matching
  artisan_id?: string | null;
  artisan_confidence?: string | null;

  // JSONB section data
  sayagaki?: SayagakiEntry[] | null;
  hakogaki?: HakogakiEntry[] | null;
  koshirae?: KoshiraeData | null;
  provenance?: ProvenanceData | null;
  kiwame?: KiwameEntry[] | null;
  kanto_hibisho?: KantoHibishoData | null;

  // Research notes (AI curator note context — not displayed publicly)
  research_notes?: string | null;

  // Setsumei
  setsumei_text_en?: string | null;
  setsumei_text_ja?: string | null;

  // Translation cache
  title_en?: string | null;
  title_ja?: string | null;
  description_en?: string | null;
  description_ja?: string | null;

  // AI curator notes
  ai_curator_note_en?: string | null;
  ai_curator_note_ja?: string | null;
  ai_curator_headline_en?: string | null;
  ai_curator_headline_ja?: string | null;

  // Smart crop
  focal_x?: number | null;
  focal_y?: number | null;

  // Hero image
  hero_image_index?: number | null;

  // Video count
  video_count?: number;
}

/**
 * Columns that exist ONLY in `listings` (not in `collection_items`).
 * Used by the golden test to verify no overlap with COLLECTION_ONLY.
 */
export const LISTING_ONLY_COLUMNS = [
  'id',              // INTEGER PK (listings) vs UUID PK (collection_items)
  'url',
  'dealer_id',
  'page_exists',
  'price_raw',
  'raw_page_text',
  'first_seen_at',
  'last_scraped_at',
  'scrape_count',
  'is_initial_import',
  'admin_hidden',
  'status_admin_locked',
  'admin_locked_fields',
  'artisan_method',
  'artisan_candidates',
  'artisan_verified',
  'artisan_verified_at',
  'artisan_verified_by',
  'artisan_admin_locked',
  'artisan_elite_factor',
  'artisan_elite_count',
  'artisan_designation_factor',
  'artisan_display_name',  // enrichment field
  'artisan_name_kanji',    // enrichment field
  'artisan_tier',          // enrichment field
  'artisan_matched_at',
  'featured_score',
  'setsumei_image_url',
  'setsumei_metadata',
  'setsumei_processed_at',
  'setsumei_pipeline_version',
  'setsumei_error',
  'og_image_url',
  'images_stored_at',
  'source',
] as const;

/**
 * Columns that exist ONLY in `collection_items` (not in `listings`).
 */
export const COLLECTION_ONLY_COLUMNS = [
  'owner_id',         // UUID FK (collection_items identity)
  'visibility',
  'source_listing_id',
  'personal_notes',
  'purchase_price',
  'purchase_currency',
  'purchase_date',
  'purchase_source',
  'current_value',
  'current_currency',
  'location',
] as const;

/**
 * Shared columns present in BOTH tables.
 * The golden test verifies these appear in the SQL migration.
 */
export const SHARED_COLUMNS = [
  'item_uuid',
  'item_type',
  'item_category',
  'title',
  'description',
  'status',
  'is_available',
  'is_sold',
  'price_value',
  'price_currency',
  'nagasa_cm',
  'sori_cm',
  'motohaba_cm',
  'sakihaba_cm',
  'kasane_cm',
  'weight_g',
  'nakago_cm',
  'tosogu_maker',
  'tosogu_school',
  'material',
  'height_cm',
  'width_cm',
  'thickness_mm',
  'smith',
  'school',
  'province',
  'era',
  'mei_type',
  'mei_text',
  'mei_guaranteed',
  'nakago_type',
  'cert_type',
  'cert_session',
  'cert_organization',
  'images',
  'stored_images',
  'artisan_id',
  'artisan_confidence',
  'sayagaki',
  'hakogaki',
  'koshirae',
  'provenance',
  'kiwame',
  'kanto_hibisho',
  'research_notes',
  'setsumei_text_en',
  'setsumei_text_ja',
  'title_en',
  'title_ja',
  'description_en',
  'description_ja',
  'ai_curator_note_en',
  'ai_curator_note_ja',
  'focal_x',
  'focal_y',
  'hero_image_index',
  'video_count',
] as const;
