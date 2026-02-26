import { SupabaseClient } from '@supabase/supabase-js';
import { getArtisanNames } from '@/lib/supabase/yuhinkai';
import { getArtisanDisplayName, getArtisanDisplayNameKanji, getArtisanAlias } from '@/lib/artisan/displayName';
import { getArtisanTier } from '@/lib/artisan/tier';
import { getAttributionName } from '@/lib/listing/attribution';
import type { YuhinkaiEnrichment } from '@/types';

// Yuhinkai enrichment as returned by the Supabase view (array wrapper)
interface YuhinkaiEnrichmentRow {
  enrichment_id: number;
  listing_id: number;
  yuhinkai_uuid: string;
  yuhinkai_collection: string | null;
  yuhinkai_volume: number | null;
  yuhinkai_item_number: number | null;
  match_score: number;
  match_confidence: string;
  match_signals: Record<string, unknown> | null;
  matched_fields: string[] | null;
  enriched_maker: string | null;
  enriched_maker_kanji: string | null;
  enriched_school: string | null;
  enriched_period: string | null;
  enriched_form_type: string | null;
  setsumei_ja: string | null;
  setsumei_en: string | null;
  setsumei_en_format: string | null;
  enriched_cert_type: string | null;
  enriched_cert_session: number | null;
  item_category: string | null;
  verification_status: string;
  connection_source: string | null;
  enriched_at: string;
  updated_at: string;
}

// Raw listing shape from the Supabase query (before enrichment)
interface ListingWithDealer {
  id: number;
  url: string;
  title: string;
  title_en: string | null;
  title_ja: string | null;
  item_type: string | null;
  item_category: string | null;
  price_value: number | null;
  price_currency: string | null;
  price_jpy: number | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  cert_session: string | null;
  cert_organization: string | null;
  era: string | null;
  tosogu_era: string | null;
  province: string | null;
  mei_type: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  sakihaba_cm: number | null;
  kasane_cm: number | null;
  weight_g: number | null;
  tosogu_material: string | null;
  description: string | null;
  description_en: string | null;
  description_ja: string | null;
  setsumei_image_url: string | null;
  setsumei_text_en: string | null;
  setsumei_text_ja: string | null;
  setsumei_metadata: Record<string, unknown> | null;
  setsumei_processed_at: string | null;
  setsumei_pipeline_version: string | null;
  images: string[] | null;
  stored_images: string[] | null;
  og_image_url: string | null;
  first_seen_at: string;
  last_scraped_at: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  is_initial_import: boolean | null;
  admin_hidden: boolean;
  status_admin_locked: boolean;
  admin_locked_fields: Record<string, boolean> | null;
  dealer_id: number;
  artisan_id: string | null;
  artisan_confidence: string | null;
  artisan_method: string | null;
  artisan_candidates: unknown[] | null;
  artisan_verified: string | null;
  focal_x: number | null;
  focal_y: number | null;
  dealers: {
    id: number;
    name: string;
    name_ja: string | null;
    domain: string;
    earliest_listing_at: string | null;
  };
  listing_yuhinkai_enrichment?: YuhinkaiEnrichmentRow[];
}

/** Enriched listing detail — the canonical shape returned to callers. */
export interface EnrichedListingDetail {
  id: number;
  url: string;
  title: string;
  title_en: string | null;
  title_ja: string | null;
  item_type: string | null;
  item_category: string | null;
  price_value: number | null;
  price_currency: string | null;
  price_jpy: number | null;
  price_from_history?: boolean;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  cert_session: string | null;
  cert_organization: string | null;
  era: string | null;
  tosogu_era: string | null;
  province: string | null;
  mei_type: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  sakihaba_cm: number | null;
  kasane_cm: number | null;
  weight_g: number | null;
  tosogu_material: string | null;
  description: string | null;
  description_en: string | null;
  description_ja: string | null;
  setsumei_image_url: string | null;
  setsumei_text_en: string | null;
  setsumei_text_ja: string | null;
  setsumei_metadata: Record<string, unknown> | null;
  setsumei_processed_at: string | null;
  setsumei_pipeline_version: string | null;
  images: string[] | null;
  stored_images: string[] | null;
  og_image_url: string | null;
  first_seen_at: string;
  last_scraped_at: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  is_initial_import: boolean | null;
  admin_hidden: boolean;
  status_admin_locked: boolean;
  admin_locked_fields: Record<string, boolean> | null;
  dealer_id: number;
  artisan_id: string | null;
  artisan_confidence: string | null;
  artisan_method: string | null;
  artisan_candidates: unknown[] | null;
  artisan_verified: string | null;
  focal_x: number | null;
  focal_y: number | null;
  artisan_display_name?: string;
  artisan_tier?: 'kokuho' | 'elite' | 'juyo' | null;
  dealer_earliest_seen_at: string | null;
  dealers: {
    id: number;
    name: string;
    name_ja?: string | null;
    domain: string;
  };
  yuhinkai_enrichment: YuhinkaiEnrichment | null;
}

// Select clause for the Supabase query
const LISTING_SELECT = `
  id,
  url,
  title,
  title_en,
  title_ja,
  item_type,
  item_category,
  price_value,
  price_currency,
  price_jpy,
  smith,
  tosogu_maker,
  school,
  tosogu_school,
  cert_type,
  cert_session,
  cert_organization,
  era,
  tosogu_era,
  province,
  mei_type,
  nagasa_cm,
  sori_cm,
  motohaba_cm,
  sakihaba_cm,
  kasane_cm,
  weight_g,
  tosogu_material,
  description,
  description_en,
  description_ja,
  setsumei_image_url,
  setsumei_text_en,
  setsumei_text_ja,
  setsumei_metadata,
  setsumei_processed_at,
  setsumei_pipeline_version,
  images,
  stored_images,
  og_image_url,
  first_seen_at,
  last_scraped_at,
  status,
  is_available,
  is_sold,
  is_initial_import,
  admin_hidden,
  status_admin_locked,
  admin_locked_fields,
  dealer_id,
  artisan_id,
  artisan_confidence,
  artisan_method,
  artisan_candidates,
  artisan_verified,
  focal_x,
  focal_y,
  dealers (
    id,
    name,
    name_ja,
    domain,
    earliest_listing_at
  ),
  listing_yuhinkai_enrichment (
    enrichment_id,
    listing_id,
    yuhinkai_uuid,
    yuhinkai_collection,
    yuhinkai_volume,
    yuhinkai_item_number,
    match_score,
    match_confidence,
    match_signals,
    matched_fields,
    enriched_maker,
    enriched_maker_kanji,
    enriched_school,
    enriched_period,
    enriched_form_type,
    setsumei_ja,
    setsumei_en,
    setsumei_en_format,
    enriched_cert_type,
    enriched_cert_session,
    item_category,
    verification_status,
    connection_source,
    enriched_at,
    updated_at
  )
`;

/**
 * Fetch a single listing with all enrichments applied.
 *
 * Used by both the API route (GET /api/listing/[id]) and the server component
 * (page.tsx) to ensure a single canonical data shape. Does NOT set HTTP headers
 * — that's the caller's responsibility.
 *
 * Returns null if the listing is not found.
 */
export async function getListingDetail(
  supabase: SupabaseClient,
  listingId: number
): Promise<EnrichedListingDetail | null> {
  const { data: listing, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', listingId)
    .single();

  if (error || !listing) {
    return null;
  }

  const typedListing = listing as unknown as ListingWithDealer;

  // Dealer baseline for "New this week" badge
  const dealerEarliestSeenAt: string | null = typedListing.dealers?.earliest_listing_at || null;

  // Extract Yuhinkai enrichment (view returns array, we want first item or null)
  const yuhinkai_enrichment = (typedListing.listing_yuhinkai_enrichment?.[0] || null) as YuhinkaiEnrichment | null;

  // For sold items with no price, fetch sale price from price_history
  let priceValue = typedListing.price_value;
  let priceCurrency = typedListing.price_currency;
  let priceFromHistory = false;

  if (typedListing.is_sold && !typedListing.price_value) {
    const { data: priceHistory } = await supabase
      .from('price_history')
      .select('old_price, old_currency')
      .eq('listing_id', listingId)
      .in('change_type', ['sold', 'presumed_sold'])
      .order('detected_at', { ascending: false })
      .limit(1)
      .single() as { data: { old_price: number | null; old_currency: string | null } | null };

    if (priceHistory && priceHistory.old_price) {
      priceValue = priceHistory.old_price;
      priceCurrency = priceHistory.old_currency || 'JPY';
      priceFromHistory = true;
    }
  }

  // Resolve artisan display name and tier from Yuhinkai
  let artisanDisplayName: string | undefined;
  let artisanNameKanji: string | null | undefined;
  let artisanTier: 'kokuho' | 'elite' | 'juyo' | null = null;
  if (typedListing.artisan_id) {
    const artisanNameMap = await getArtisanNames([typedListing.artisan_id]);
    const artisanData = artisanNameMap.get(typedListing.artisan_id);
    if (artisanData) {
      artisanDisplayName = getArtisanAlias(typedListing.artisan_id!) || getArtisanDisplayName(artisanData.name_romaji, artisanData.school, typedListing.artisan_id);
      artisanNameKanji = getArtisanDisplayNameKanji(artisanData.name_kanji, typedListing.artisan_id);
      artisanTier = getArtisanTier(artisanData);
    } else {
      // Fallback: use smith/tosogu_maker when Yuhinkai lookup misses
      artisanDisplayName = getAttributionName(typedListing) ?? undefined;
    }
  }

  return {
    id: typedListing.id,
    url: typedListing.url,
    title: typedListing.title,
    title_en: typedListing.title_en,
    title_ja: typedListing.title_ja,
    item_type: typedListing.item_type,
    item_category: typedListing.item_category,
    price_value: priceValue,
    price_currency: priceCurrency,
    price_jpy: typedListing.price_jpy,
    ...(priceFromHistory && { price_from_history: true }),
    smith: typedListing.smith,
    tosogu_maker: typedListing.tosogu_maker,
    school: typedListing.school,
    tosogu_school: typedListing.tosogu_school,
    cert_type: typedListing.cert_type,
    cert_session: typedListing.cert_session,
    cert_organization: typedListing.cert_organization,
    era: typedListing.era,
    tosogu_era: typedListing.tosogu_era,
    province: typedListing.province,
    mei_type: typedListing.mei_type,
    nagasa_cm: typedListing.nagasa_cm,
    sori_cm: typedListing.sori_cm,
    motohaba_cm: typedListing.motohaba_cm,
    sakihaba_cm: typedListing.sakihaba_cm,
    kasane_cm: typedListing.kasane_cm,
    weight_g: typedListing.weight_g,
    tosogu_material: typedListing.tosogu_material,
    description: typedListing.description,
    description_en: typedListing.description_en,
    description_ja: typedListing.description_ja,
    setsumei_image_url: typedListing.setsumei_image_url,
    setsumei_text_en: typedListing.setsumei_text_en,
    setsumei_text_ja: typedListing.setsumei_text_ja,
    setsumei_metadata: typedListing.setsumei_metadata,
    setsumei_processed_at: typedListing.setsumei_processed_at,
    setsumei_pipeline_version: typedListing.setsumei_pipeline_version,
    images: typedListing.images,
    stored_images: typedListing.stored_images,
    og_image_url: typedListing.og_image_url,
    first_seen_at: typedListing.first_seen_at,
    last_scraped_at: typedListing.last_scraped_at,
    status: typedListing.status,
    is_available: typedListing.is_available,
    is_sold: typedListing.is_sold,
    is_initial_import: typedListing.is_initial_import,
    admin_hidden: typedListing.admin_hidden,
    status_admin_locked: typedListing.status_admin_locked,
    admin_locked_fields: typedListing.admin_locked_fields,
    dealer_id: typedListing.dealer_id,
    artisan_id: typedListing.artisan_id,
    artisan_confidence: typedListing.artisan_confidence,
    artisan_method: typedListing.artisan_method,
    artisan_candidates: typedListing.artisan_candidates,
    artisan_verified: typedListing.artisan_verified,
    focal_x: typedListing.focal_x,
    focal_y: typedListing.focal_y,
    ...(artisanDisplayName && { artisan_display_name: artisanDisplayName }),
    ...(artisanNameKanji && { artisan_name_kanji: artisanNameKanji }),
    ...(artisanTier && { artisan_tier: artisanTier }),
    dealer_earliest_seen_at: dealerEarliestSeenAt,
    dealers: {
      id: typedListing.dealers.id,
      name: typedListing.dealers.name,
      name_ja: typedListing.dealers.name_ja,
      domain: typedListing.dealers.domain,
    },
    yuhinkai_enrichment,
  };
}
