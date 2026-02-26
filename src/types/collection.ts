/**
 * Collection Manager type definitions.
 *
 * Personal collection cataloging for authenticated users.
 * Reuses item_type/cert_type vocabulary from listings.
 */

// =============================================================================
// ENUMS
// =============================================================================

export type CollectionItemStatus = 'owned' | 'sold' | 'lent' | 'consignment';

export type CollectionItemCondition = 'mint' | 'excellent' | 'good' | 'fair' | 'project';

// =============================================================================
// CORE TYPES
// =============================================================================

export interface CollectionItem {
  id: string;
  user_id: string;
  source_listing_id: number | null;

  // Classification
  item_type: string | null;
  title: string | null;

  // Artisan
  artisan_id: string | null;
  artisan_display_name: string | null;

  // Certification
  cert_type: string | null;
  cert_session: number | null;
  cert_organization: string | null;

  // Attribution
  smith: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  mei_type: string | null;

  // Measurements
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  sakihaba_cm: number | null;

  // Provenance & value
  price_paid: number | null;
  price_paid_currency: string | null;
  current_value: number | null;
  current_value_currency: string | null;
  acquired_date: string | null;
  acquired_from: string | null;

  // Status & condition
  condition: CollectionItemCondition;
  status: CollectionItemStatus;
  notes: string | null;

  // Media
  images: string[];

  // Catalog reference
  catalog_reference: CatalogReference | null;

  // Visibility
  is_public: boolean;

  // Organization
  folder_id: string | null;
  sort_order: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CollectionFolder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CatalogReference {
  collection: string;
  volume: number;
  item_number: number;
  object_uuid: string;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface CollectionFilters {
  category?: 'nihonto' | 'tosogu';
  itemType?: string;
  certType?: string;
  era?: string;
  meiType?: string;
  status?: CollectionItemStatus;
  condition?: CollectionItemCondition;
  folderId?: string;
  sort?: 'newest' | 'value_desc' | 'value_asc' | 'type';
  page?: number;
  limit?: number;
}

export interface CollectionFacets {
  itemTypes: Array<{ value: string; count: number }>;
  certifications: Array<{ value: string; count: number }>;
  historicalPeriods: Array<{ value: string; count: number }>;
  signatureStatuses: Array<{ value: string; count: number }>;
  statuses: Array<{ value: string; count: number }>;
  conditions: Array<{ value: string; count: number }>;
  folders: Array<{ id: string; name: string; count: number }>;
}

export interface CollectionListResponse {
  data: CollectionItem[];
  total: number;
  facets: CollectionFacets;
}

export interface CreateCollectionItemInput {
  source_listing_id?: number;
  item_type?: string;
  title?: string;
  artisan_id?: string;
  artisan_display_name?: string;
  cert_type?: string;
  cert_session?: number;
  cert_organization?: string;
  smith?: string;
  school?: string;
  province?: string;
  era?: string;
  mei_type?: string;
  nagasa_cm?: number;
  sori_cm?: number;
  motohaba_cm?: number;
  sakihaba_cm?: number;
  price_paid?: number;
  price_paid_currency?: string;
  current_value?: number;
  current_value_currency?: string;
  acquired_date?: string;
  acquired_from?: string;
  condition?: CollectionItemCondition;
  status?: CollectionItemStatus;
  notes?: string;
  images?: string[];
  catalog_reference?: CatalogReference;
  is_public?: boolean;
  folder_id?: string;
}

export interface UpdateCollectionItemInput extends Partial<CreateCollectionItemInput> {
  sort_order?: number;
}

// =============================================================================
// CATALOG SEARCH TYPES
// =============================================================================

export interface CatalogSearchResult {
  object_uuid: string;
  collection: string;
  volume: number;
  item_number: number;
  smith_id: string | null;
  smith_name: string | null;
  smith_school: string | null;
  form_type: string | null;
  nagasa: number | null;
  sori: number | null;
  motohaba: number | null;
  sakihaba: number | null;
  mei_status: string | null;
  province: string | null;
  era: string | null;
}
