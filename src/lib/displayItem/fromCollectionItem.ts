/**
 * Map a CollectionItemRow (Phase 2a+ schema) to DisplayItem.
 *
 * The CollectionItemRow extends ItemDataFields, so all shared fields
 * pass through directly.
 */

import type { CollectionItemRow } from '@/types/collectionItem';
import type { DisplayItem } from '@/types/displayItem';
import { getArtisanDisplayName, getArtisanDisplayNameKanji, getArtisanAlias } from '@/lib/artisan/displayName';

export interface ArtisanNameInfo {
  name_romaji?: string | null;
  name_kanji?: string | null;
  school?: string | null;
}

/**
 * Expense totals per item, grouped by currency.
 * { [item_id]: { [currency]: totalAmount } }
 */
export type ExpenseTotalsMap = Record<string, Record<string, number>>;

export function collectionRowToDisplayItem(
  item: CollectionItemRow,
  artisanNames?: Record<string, ArtisanNameInfo>,
  expenseTotals?: ExpenseTotalsMap,
): DisplayItem {
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
    images: item.images && item.images.length > 0 ? item.images : null,
    stored_images: item.stored_images ?? null,
    og_image_url: null,
    focal_x: item.focal_x ?? null,
    focal_y: item.focal_y ?? null,
    hero_image_index: item.hero_image_index ?? null,
    thumbnail_url: null,

    // Video
    video_count: item.video_count ?? 0,

    // Artisan — enrich from Yuhinkai name map when available
    artisan_id: item.artisan_id ?? null,
    artisan_display_name: (item.artisan_id && artisanNames?.[item.artisan_id])
      ? (getArtisanAlias(item.artisan_id) || getArtisanDisplayName(artisanNames[item.artisan_id].name_romaji ?? null, artisanNames[item.artisan_id].school ?? null, item.artisan_id) || null)
      : null,
    artisan_name_kanji: (item.artisan_id && artisanNames?.[item.artisan_id])
      ? (getArtisanDisplayNameKanji(artisanNames[item.artisan_id].name_kanji ?? null, item.artisan_id) || null)
      : null,
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

    // Dealer (pre-resolved — collection always shows "Private Collection")
    dealer_display_name: 'Private Collection',
    dealer_display_name_ja: null,
    dealer_domain: undefined,
    dealer_id: null,

    // Curator headline
    ai_curator_headline_en: item.ai_curator_headline_en ?? null,
    ai_curator_headline_ja: item.ai_curator_headline_ja ?? null,

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

      // Holding status
      holding_status: item.holding_status || 'owned',

      // Financial fields
      purchase_price: item.purchase_price ?? null,
      purchase_currency: item.purchase_currency ?? null,
      purchase_date: item.purchase_date ?? null,
      purchase_source: item.purchase_source ?? null,
      current_value: item.current_value ?? null,
      current_currency: item.current_currency ?? null,
      location: item.location ?? null,

      // Sold fields
      sold_price: item.sold_price ?? null,
      sold_currency: item.sold_currency ?? null,
      sold_date: item.sold_date ?? null,
      sold_to: item.sold_to ?? null,
      sold_venue: item.sold_venue ?? null,

      // Computed: purchase_price + matching-currency expenses
      total_invested: computeTotalInvested(item, expenseTotals),
    },
    dealer: null,
  };
}

/**
 * Compute total invested = purchase_price + expenses in the same currency.
 * Multi-currency expenses are NOT auto-summed (can't accurately convert without historical rates).
 * Returns null if no purchase_price is set.
 */
function computeTotalInvested(
  item: CollectionItemRow,
  expenseTotals?: ExpenseTotalsMap,
): number | null {
  if (item.purchase_price == null) return null;

  const purchaseCurrency = (item.purchase_currency || 'JPY').toUpperCase();
  const itemExpenses = expenseTotals?.[item.id];
  if (!itemExpenses) return item.purchase_price;

  // Only sum expenses in the same currency as the purchase
  const matchingExpenses = itemExpenses[purchaseCurrency] || 0;
  return item.purchase_price + matchingExpenses;
}

/**
 * Batch convert collection item rows to display items.
 * Call sites should wrap in useMemo keyed on `items` reference.
 */
export function collectionRowsToDisplayItems(
  items: CollectionItemRow[],
  artisanNames?: Record<string, ArtisanNameInfo>,
  expenseTotals?: ExpenseTotalsMap,
): DisplayItem[] {
  return items.map(item => collectionRowToDisplayItem(item, artisanNames, expenseTotals));
}

