/**
 * Adapter: CollectionItem → Listing (for ListingCard consumption)
 *
 * Maps personal collection items into the shape expected by browse
 * components (ListingCard, QuickViewContent, etc.) so the collection
 * page reuses the exact same visual architecture as browse.
 */

import type { CollectionItem } from '@/types/collection';

/**
 * The subset of Listing fields that ListingCard actually reads.
 * Defined locally in ListingCard.tsx — we replicate the shape here
 * so the adapter produces exactly what the card needs.
 */
export interface AdaptedListing {
  id: string;
  url: string;
  title: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  nagasa_cm: number | null;
  era?: string | null;
  images: string[] | null;
  first_seen_at: string;
  is_initial_import?: boolean | null;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    name_ja?: string | null;
    domain: string;
  };
  artisan_id?: string | null;
  artisan_display_name?: string | null;
  artisan_confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
  focal_x?: number | null;
  focal_y?: number | null;
  // Extra fields for QuickViewContent
  description?: string | null;
  province?: string | null;
  mei_type?: string | null;
  sori_cm?: number | null;
  motohaba_cm?: number | null;
  sakihaba_cm?: number | null;
}

/**
 * Convert a CollectionItem to the Listing interface consumed by ListingCard.
 */
export function collectionItemToListing(item: CollectionItem): AdaptedListing {
  return {
    id: item.id,
    url: '',
    title: item.title,
    title_en: null,
    title_ja: null,
    item_type: item.item_type,
    price_value: item.current_value ?? item.price_paid ?? null,
    price_currency: item.current_value_currency ?? item.price_paid_currency ?? null,
    smith: item.smith,
    tosogu_maker: null,
    school: item.school,
    tosogu_school: null,
    cert_type: item.cert_type,
    nagasa_cm: item.nagasa_cm,
    era: item.era,
    images: item.images.length > 0 ? item.images : null,
    first_seen_at: item.created_at,
    is_initial_import: true, // Suppress "New" badge
    status: 'available',
    is_available: true,
    is_sold: false,
    dealer_id: -1,
    dealers: {
      id: -1,
      name: item.acquired_from || 'Personal Collection',
      name_ja: null,
      domain: '',
    },
    artisan_id: item.artisan_id,
    artisan_display_name: item.artisan_display_name,
    artisan_confidence: item.artisan_id ? 'HIGH' : null, // Collection items are user-verified
    focal_x: null,
    focal_y: null,
    // Extra fields for QuickViewContent
    description: item.notes,
    province: item.province,
    mei_type: item.mei_type,
    sori_cm: item.sori_cm,
    motohaba_cm: item.motohaba_cm,
    sakihaba_cm: item.sakihaba_cm,
  };
}

/**
 * Batch convert collection items to listings.
 * Call sites should wrap this in useMemo keyed on `items` reference
 * to maintain referential stability for ListingCard's React.memo.
 */
export function collectionItemsToListings(items: CollectionItem[]): AdaptedListing[] {
  return items.map(collectionItemToListing);
}
