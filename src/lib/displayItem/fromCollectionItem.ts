/**
 * Map a CollectionItemRow (Phase 2a+ schema) to DisplayItem.
 *
 * Replaces the V1 mapper that dropped all JSONB sections, tosogu fields,
 * setsumei, descriptions, etc. The new CollectionItemRow extends ItemDataFields,
 * so all shared fields pass through directly.
 *
 * Exports V1 aliases for backward compat until Phase 5 cleanup.
 */

import type { CollectionItemRow } from '@/types/collectionItem';
import type { DisplayItem } from '@/types/displayItem';

export function collectionRowToDisplayItem(item: CollectionItemRow): DisplayItem {
  // Parse cert_session: DB stores TEXT, DisplayItem expects number | null
  let certSession: number | null = null;
  if (item.cert_session != null) {
    const parsed = Number(item.cert_session);
    if (!isNaN(parsed)) certSession = parsed;
  }

  return {
    // Identity — use item_uuid as the stable identity (not PK `id`)
    id: item.item_uuid,
    source: 'collection',

    // Content
    title: item.title,
    title_en: item.title_en ?? null,
    title_ja: item.title_ja ?? null,
    description: item.description ?? null,
    description_en: item.description_en ?? null,
    description_ja: item.description_ja ?? null,
    item_type: item.item_type,

    // Pricing — direct pass-through of shared fields
    price_value: item.price_value ?? null,
    price_currency: item.price_currency as string | null ?? null,

    // Attribution (dual-path: swords + tosogu)
    smith: item.smith ?? null,
    tosogu_maker: item.tosogu_maker ?? null,
    school: item.school ?? null,
    tosogu_school: item.tosogu_school ?? null,
    province: item.province ?? null,
    era: item.era ?? null,
    mei_type: item.mei_type ?? null,
    mei_text: item.mei_text ?? null,
    mei_guaranteed: item.mei_guaranteed ?? null,

    // Certification
    cert_type: item.cert_type as string | null ?? null,
    cert_session: certSession,
    cert_organization: item.cert_organization ?? null,

    // Measurements
    nagasa_cm: item.nagasa_cm ?? null,
    sori_cm: item.sori_cm ?? null,
    motohaba_cm: item.motohaba_cm ?? null,
    sakihaba_cm: item.sakihaba_cm ?? null,
    kasane_cm: item.kasane_cm ?? null,
    weight_g: item.weight_g ?? null,

    // Media — empty array → null for ListingCard null-check
    images: item.images.length > 0 ? item.images : null,
    stored_images: item.stored_images ?? null,
    og_image_url: null,
    focal_x: item.focal_x ?? null,
    focal_y: item.focal_y ?? null,
    hero_image_index: item.hero_image_index ?? null,
    thumbnail_url: null,

    // Video
    video_count: item.video_count ?? 0,

    // Artisan
    artisan_id: item.artisan_id ?? null,
    artisan_display_name: null,
    artisan_name_kanji: null,
    artisan_confidence: (item.artisan_confidence as DisplayItem['artisan_confidence']) ?? null,
    artisan_tier: null,
    artisan_method: null,
    artisan_candidates: null,
    artisan_verified: null,

    // Status
    status: item.status || 'INVENTORY',
    is_available: item.is_available ?? true,
    is_sold: item.is_sold ?? false,

    // Temporal — suppress "New" badge for collection items
    first_seen_at: item.created_at,
    is_initial_import: true,
    dealer_earliest_seen_at: null,
    last_scraped_at: null,

    // Dealer (pre-resolved — collection always shows "Personal Collection")
    dealer_display_name: 'Personal Collection',
    dealer_display_name_ja: null,
    dealer_domain: undefined,
    dealer_id: null,

    // Setsumei
    setsumei_text_en: item.setsumei_text_en ?? null,
    setsumei_text_ja: item.setsumei_text_ja ?? null,
    setsumei_metadata: null,
    setsumei_processed_at: null,
    has_setsumei: !!(item.setsumei_text_en || item.setsumei_text_ja),
    yuhinkai_enrichment: null,

    // Extensions
    browse: null,
    collection: {
      item_uuid: item.item_uuid,
      personal_notes: item.personal_notes,
      visibility: item.visibility,
      source_listing_id: item.source_listing_id,
    },
    dealer: null,
  };
}

/**
 * Batch convert collection item rows to display items.
 * Call sites should wrap in useMemo keyed on `items` reference.
 */
export function collectionRowsToDisplayItems(items: CollectionItemRow[]): DisplayItem[] {
  return items.map(collectionRowToDisplayItem);
}

// V1 aliases — backward compat until Phase 5 cleanup
export const collectionItemToDisplayItem = collectionRowToDisplayItem;
export const collectionItemsToDisplayItems = collectionRowsToDisplayItems;
