/**
 * Map a CollectionItem to DisplayItem.
 *
 * Replaces the adapter.ts collectionItemToListing() that fabricated
 * fake data (url: '', dealer_id: -1, status: 'available').
 * Instead, DisplayItem carries honest data with source: 'collection'.
 */

import type { CollectionItem } from '@/types/collection';
import type { DisplayItem } from '@/types/displayItem';

export function collectionItemToDisplayItem(item: CollectionItem): DisplayItem {
  return {
    // Identity
    id: item.id,
    source: 'collection',

    // Content
    title: item.title,
    title_en: null,
    title_ja: null,
    description: item.notes,
    description_en: null,
    description_ja: null,
    item_type: item.item_type,

    // Pricing — show current value, fall back to price paid
    price_value: item.current_value ?? item.price_paid ?? null,
    price_currency: item.current_value_currency ?? item.price_paid_currency ?? null,

    // Attribution
    smith: item.smith,
    tosogu_maker: null,
    school: item.school,
    tosogu_school: null,
    province: item.province ?? null,
    era: item.era ?? null,
    mei_type: item.mei_type ?? null,

    // Certification
    cert_type: item.cert_type,
    cert_session: item.cert_session ?? null,
    cert_organization: item.cert_organization ?? null,

    // Measurements
    nagasa_cm: item.nagasa_cm,
    sori_cm: item.sori_cm ?? null,
    motohaba_cm: item.motohaba_cm ?? null,
    sakihaba_cm: item.sakihaba_cm ?? null,
    kasane_cm: null,
    weight_g: null,

    // Media
    images: item.images.length > 0 ? item.images : null,
    stored_images: null,
    og_image_url: null,
    focal_x: null,
    focal_y: null,
    thumbnail_url: null,

    // Artisan
    artisan_id: item.artisan_id ?? null,
    artisan_display_name: item.artisan_display_name ?? null,
    artisan_name_kanji: null,
    artisan_confidence: item.artisan_id ? 'HIGH' : null, // Collection items are user-verified
    artisan_tier: null,
    artisan_method: null,
    artisan_candidates: null,
    artisan_verified: null,

    // Status — collection items are always "available" from a display perspective
    status: 'available',
    is_available: true,
    is_sold: false,

    // Temporal — suppress "New" badge for collection items
    first_seen_at: item.created_at,
    is_initial_import: true,
    dealer_earliest_seen_at: null,
    last_scraped_at: null,

    // Dealer (pre-resolved — collection shows "acquired from" instead)
    dealer_display_name: item.acquired_from || 'Personal Collection',
    dealer_display_name_ja: null,
    dealer_domain: undefined,
    dealer_id: null,

    // Setsumei — collection items don't have these
    setsumei_text_en: null,
    has_setsumei: false,
    yuhinkai_enrichment: null,

    // Extensions
    browse: null,
    collection: {
      notes: item.notes,
      condition: item.condition,
      collection_status: item.status,
      price_paid: item.price_paid,
      price_paid_currency: item.price_paid_currency,
      current_value: item.current_value,
      current_value_currency: item.current_value_currency,
      acquired_from: item.acquired_from,
      acquired_date: item.acquired_date,
      source_listing_id: item.source_listing_id,
    },
  };
}

/**
 * Batch convert collection items to display items.
 * Call sites should wrap in useMemo keyed on `items` reference.
 */
export function collectionItemsToDisplayItems(items: CollectionItem[]): DisplayItem[] {
  return items.map(collectionItemToDisplayItem);
}
