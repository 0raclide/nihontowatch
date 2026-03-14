import { SupabaseClient } from '@supabase/supabase-js';
import { getArtisanNames, getArtisan, getElitePercentile } from '@/lib/supabase/yuhinkai';
import { getArtisanDisplayName, getArtisanDisplayNameKanji, getArtisanAlias } from '@/lib/artisan/displayName';
import { getArtisanTier } from '@/lib/artisan/tier';
import { getAttributionName } from '@/lib/listing/attribution';
import { isVideoProviderConfigured, videoProvider } from '@/lib/video/videoProvider';
import { selectItemVideos } from '@/lib/supabase/itemVideos';
import { normalizeProvenance } from '@/lib/provenance/normalize';
import type { YuhinkaiEnrichment, SayagakiEntry, HakogakiEntry, KoshiraeData, ProvenanceData, KiwameEntry, KantoHibishoData } from '@/types';
import type { ListingVideo } from '@/types/media';

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
  mei_text: string | null;
  mei_guaranteed: boolean | null;
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
  hero_image_index: number | null;
  sayagaki: SayagakiEntry[] | null;
  hakogaki: HakogakiEntry[] | null;
  koshirae: KoshiraeData | null;
  provenance: ProvenanceData | null;
  kiwame: KiwameEntry[] | null;
  kanto_hibisho: KantoHibishoData | null;
  research_notes: string | null;
  showcase_override: boolean | null;
  ai_curator_note_en: string | null;
  ai_curator_note_ja: string | null;
  ai_curator_headline_en: string | null;
  ai_curator_headline_ja: string | null;
  dealers: {
    id: number;
    name: string;
    name_ja: string | null;
    domain: string;
    earliest_listing_at: string | null;
  };
  item_uuid: string | null;
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
  mei_text: string | null;
  mei_guaranteed: boolean | null;
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
  hero_image_index: number | null;
  sayagaki: SayagakiEntry[] | null;
  hakogaki: HakogakiEntry[] | null;
  koshirae: KoshiraeData | null;
  provenance: ProvenanceData | null;
  kiwame: KiwameEntry[] | null;
  kanto_hibisho: KantoHibishoData | null;
  research_notes: string | null;
  showcase_override?: boolean | null;
  ai_curator_note_en: string | null;
  ai_curator_note_ja: string | null;
  ai_curator_headline_en: string | null;
  ai_curator_headline_ja: string | null;
  artisan_display_name?: string;
  artisan_name_kanji?: string;
  artisan_tier?: 'kokuho' | 'elite' | 'juyo' | null;
  artisan_elite_factor?: number;
  artisan_elite_count?: number;
  artisan_total_items?: number;
  artisan_elite_percentile?: number;
  artisan_entity_type?: 'smith' | 'tosogu';
  dealer_earliest_seen_at: string | null;
  dealers: {
    id: number;
    name: string;
    name_ja?: string | null;
    domain: string;
  };
  yuhinkai_enrichment: YuhinkaiEnrichment | null;
  videos?: ListingVideo[];
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
  mei_text,
  mei_guaranteed,
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
  hero_image_index,
  sayagaki,
  hakogaki,
  koshirae,
  provenance,
  kiwame,
  kanto_hibisho,
  research_notes,
  showcase_override,
  ai_curator_note_en,
  ai_curator_note_ja,
  ai_curator_headline_en,
  ai_curator_headline_ja,
  item_uuid,
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

  // Hide dealer-uploaded listings from non-admin users when feature flag is off
  if (
    (typedListing as any).source === 'dealer' &&
    process.env.NEXT_PUBLIC_DEALER_LISTINGS_LIVE !== 'true'
  ) {
    return null;
  }

  // Dealer baseline for "New this week" badge
  const dealerEarliestSeenAt: string | null = typedListing.dealers?.earliest_listing_at || null;

  // Extract Yuhinkai enrichment (view returns array, we want first item or null)
  const yuhinkai_enrichment = (typedListing.listing_yuhinkai_enrichment?.[0] || null) as YuhinkaiEnrichment | null;

  // Strip prices from sold items — sold prices are hidden from the UI
  const priceValue = typedListing.is_sold ? null : typedListing.price_value;
  const priceCurrency = typedListing.is_sold ? null : typedListing.price_currency;

  // Resolve artisan display name and tier from Yuhinkai
  let artisanDisplayName: string | undefined;
  let artisanNameKanji: string | null | undefined;
  let artisanTier: 'kokuho' | 'elite' | 'juyo' | null = null;
  let artisanEliteFactor: number | undefined;
  let artisanEliteCount: number | undefined;
  let artisanTotalItems: number | undefined;
  let artisanElitePercentile: number | undefined;
  let artisanEntityType: 'smith' | 'tosogu' | undefined;
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

    // Fetch elite factor data for showcase display
    const artisanEntity = await getArtisan(typedListing.artisan_id);
    if (artisanEntity) {
      artisanEliteFactor = artisanEntity.elite_factor;
      artisanEliteCount = artisanEntity.elite_count;
      artisanTotalItems = artisanEntity.total_items;
      artisanEntityType = artisanEntity.entity_type;
      if (artisanEntity.elite_factor > 0) {
        artisanElitePercentile = await getElitePercentile(artisanEntity.elite_factor, artisanEntity.entity_type);
      }
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
    price_jpy: typedListing.is_sold ? null : typedListing.price_jpy,
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
    mei_text: typedListing.mei_text,
    mei_guaranteed: typedListing.mei_guaranteed,
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
    hero_image_index: typedListing.hero_image_index,
    sayagaki: typedListing.sayagaki,
    hakogaki: typedListing.hakogaki,
    koshirae: typedListing.koshirae,
    provenance: normalizeProvenance(typedListing.provenance),
    kiwame: typedListing.kiwame,
    kanto_hibisho: typedListing.kanto_hibisho,
    research_notes: typedListing.research_notes ?? null,
    showcase_override: typedListing.showcase_override ?? null,
    ai_curator_note_en: typedListing.ai_curator_note_en ?? null,
    ai_curator_note_ja: typedListing.ai_curator_note_ja ?? null,
    ai_curator_headline_en: typedListing.ai_curator_headline_en ?? null,
    ai_curator_headline_ja: typedListing.ai_curator_headline_ja ?? null,
    ...(artisanDisplayName && { artisan_display_name: artisanDisplayName }),
    ...(artisanNameKanji && { artisan_name_kanji: artisanNameKanji }),
    ...(artisanTier && { artisan_tier: artisanTier }),
    ...(artisanEliteFactor !== undefined && { artisan_elite_factor: artisanEliteFactor }),
    ...(artisanEliteCount !== undefined && { artisan_elite_count: artisanEliteCount }),
    ...(artisanTotalItems !== undefined && { artisan_total_items: artisanTotalItems }),
    ...(artisanElitePercentile !== undefined && { artisan_elite_percentile: artisanElitePercentile }),
    ...(artisanEntityType && { artisan_entity_type: artisanEntityType }),
    dealer_earliest_seen_at: dealerEarliestSeenAt,
    dealers: {
      id: typedListing.dealers.id,
      name: typedListing.dealers.name,
      name_ja: typedListing.dealers.name_ja,
      domain: typedListing.dealers.domain,
    },
    yuhinkai_enrichment,
    // Enrich videos from item_videos (separate query — no FK for nested select)
    videos: await getVideosForListing(supabase, typedListing.item_uuid, typedListing.id),
  };
}

/**
 * Fetch ready videos for a listing from item_videos (keyed by item_uuid).
 * Returns empty array for scraped listings (no item_uuid).
 */
async function getVideosForListing(
  supabase: SupabaseClient,
  itemUuid: string | null,
  listingId: number,
): Promise<ListingVideo[]> {
  if (!itemUuid) return [];

  const { data: videos } = await selectItemVideos(
    supabase, 'item_uuid', itemUuid, '*',
    { column: 'sort_order', ascending: true }
  );

  if (!videos || videos.length === 0) return [];

  return videos
    .filter(v => v.status === 'ready')
    .map(v => ({
      id: v.id,
      listing_id: listingId,
      provider: v.provider,
      provider_id: v.provider_id,
      duration_seconds: v.duration_seconds ?? undefined,
      width: v.width ?? undefined,
      height: v.height ?? undefined,
      thumbnail_url: v.thumbnail_url ?? undefined,
      status: v.status as 'ready',
      sort_order: v.sort_order,
      original_filename: v.original_filename ?? undefined,
      size_bytes: v.size_bytes ?? undefined,
      created_at: v.created_at,
      stream_url: v.stream_url
        || (isVideoProviderConfigured() ? videoProvider.getStreamUrl(v.provider_id) : undefined),
    }));
}
