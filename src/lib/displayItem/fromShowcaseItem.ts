/**
 * Map a showcase API response row (collection_items + profile join)
 * to DisplayItem with source: 'showcase'.
 *
 * Similar to collectionRowToDisplayItem but:
 * - source = 'showcase' (read-only, no edit/delete)
 * - Includes owner identity from the profile JOIN
 * - Price stripped for 'collectors' visibility (community items don't show price)
 */

import type { CollectionVisibility } from '@/types/collectionItem';
import type { DisplayItem } from '@/types/displayItem';
import type {
  SayagakiEntry,
  HakogakiEntry,
  KoshiraeData,
  ProvenanceData,
  KiwameEntry,
  KantoHibishoData,
} from '@/types';
import { getArtisanDisplayName, getArtisanDisplayNameKanji, getArtisanAlias } from '@/lib/artisan/displayName';

export interface ArtisanNameInfo {
  name_romaji?: string | null;
  name_kanji?: string | null;
  school?: string | null;
}

export interface ShowcaseApiRow {
  // collection_items fields
  id: string;
  item_uuid: string;
  owner_id: string;
  visibility: CollectionVisibility;
  source_listing_id: number | null;
  personal_notes: string | null;
  title: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_ja?: string | null;
  item_type: string | null;
  item_category?: string | null;
  price_value?: number | null;
  price_currency?: string | null;
  smith?: string | null;
  tosogu_maker?: string | null;
  school?: string | null;
  tosogu_school?: string | null;
  province?: string | null;
  era?: string | null;
  mei_type?: string | null;
  mei_text?: string | null;
  mei_guaranteed?: boolean | null;
  cert_type?: string | null;
  cert_session?: string | number | null;
  cert_organization?: string | null;
  nagasa_cm?: number | null;
  sori_cm?: number | null;
  motohaba_cm?: number | null;
  sakihaba_cm?: number | null;
  kasane_cm?: number | null;
  weight_g?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  images?: string[] | null;
  stored_images?: string[] | null;
  focal_x?: number | null;
  focal_y?: number | null;
  hero_image_index?: number | null;
  video_count?: number;
  artisan_id?: string | null;
  artisan_confidence?: string | null;
  status?: string | null;
  is_available?: boolean | null;
  is_sold?: boolean | null;
  setsumei_text_en?: string | null;
  setsumei_text_ja?: string | null;
  // JSONB section data (returned by select('*') from collection_items)
  sayagaki?: SayagakiEntry[] | null;
  hakogaki?: HakogakiEntry[] | null;
  koshirae?: KoshiraeData | null;
  provenance?: ProvenanceData | null;
  kiwame?: KiwameEntry[] | null;
  kanto_hibisho?: KantoHibishoData | null;
  ai_curator_note_en?: string | null;
  ai_curator_note_ja?: string | null;
  ai_curator_headline_en?: string | null;
  ai_curator_headline_ja?: string | null;
  created_at: string;
  // Profile JOIN
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function showcaseItemToDisplayItem(
  item: ShowcaseApiRow,
  artisanNames?: Record<string, ArtisanNameInfo>,
): DisplayItem {
  let certSession: number | null = null;
  if (item.cert_session != null) {
    const parsed = Number(item.cert_session);
    if (!isNaN(parsed)) certSession = parsed;
  }

  // Strip price for 'collectors' visibility — community showcase doesn't show price
  const showPrice = item.visibility === 'dealers';

  return {
    id: item.item_uuid,
    source: 'showcase',

    title: item.title,
    title_en: item.title_en ?? null,
    title_ja: item.title_ja ?? null,
    description: item.description ?? null,
    description_en: item.description_en ?? null,
    description_ja: item.description_ja ?? null,
    item_type: item.item_type,

    price_value: showPrice ? (item.price_value ?? null) : null,
    price_currency: showPrice ? (item.price_currency as string | null ?? null) : null,

    smith: item.smith ?? null,
    tosogu_maker: item.tosogu_maker ?? null,
    school: item.school ?? null,
    tosogu_school: item.tosogu_school ?? null,
    province: item.province ?? null,
    era: item.era ?? null,
    mei_type: item.mei_type ?? null,
    mei_text: item.mei_text ?? null,
    mei_guaranteed: item.mei_guaranteed ?? null,

    cert_type: item.cert_type as string | null ?? null,
    cert_session: certSession,
    cert_organization: item.cert_organization ?? null,

    nagasa_cm: item.nagasa_cm ?? null,
    sori_cm: item.sori_cm ?? null,
    motohaba_cm: item.motohaba_cm ?? null,
    sakihaba_cm: item.sakihaba_cm ?? null,
    kasane_cm: item.kasane_cm ?? null,
    weight_g: item.weight_g ?? null,

    images: item.images && item.images.length > 0 ? item.images : null,
    stored_images: item.stored_images ?? null,
    og_image_url: null,
    focal_x: item.focal_x ?? null,
    focal_y: item.focal_y ?? null,
    hero_image_index: item.hero_image_index ?? null,
    thumbnail_url: null,

    video_count: item.video_count ?? 0,

    artisan_id: item.artisan_id ?? null,
    artisan_display_name: (item as any).artisan_display_name
      ?? ((item.artisan_id && artisanNames?.[item.artisan_id])
        ? (getArtisanAlias(item.artisan_id) || getArtisanDisplayName(artisanNames[item.artisan_id].name_romaji ?? null, artisanNames[item.artisan_id].school ?? null, item.artisan_id) || null)
        : null),
    artisan_name_kanji: (item as any).artisan_name_kanji
      ?? ((item.artisan_id && artisanNames?.[item.artisan_id])
        ? (getArtisanDisplayNameKanji(artisanNames[item.artisan_id].name_kanji ?? null, item.artisan_id) || null)
        : null),
    artisan_confidence: (item.artisan_confidence as DisplayItem['artisan_confidence']) ?? null,
    artisan_tier: null,
    artisan_method: null,
    artisan_candidates: null,
    artisan_verified: null,

    status: item.status || 'INVENTORY',
    is_available: item.is_available ?? true,
    is_sold: item.is_sold ?? false,

    first_seen_at: item.created_at,
    is_initial_import: true,
    dealer_earliest_seen_at: null,
    last_scraped_at: null,

    dealer_display_name: 'Private Collection',
    dealer_display_name_ja: null,
    dealer_domain: undefined,
    dealer_id: null,

    setsumei_text_en: item.setsumei_text_en ?? null,
    setsumei_text_ja: item.setsumei_text_ja ?? null,
    setsumei_metadata: null,
    setsumei_processed_at: null,
    has_setsumei: !!(item.setsumei_text_en || item.setsumei_text_ja),
    ai_curator_headline_en: item.ai_curator_headline_en ?? null,
    ai_curator_headline_ja: item.ai_curator_headline_ja ?? null,
    yuhinkai_enrichment: null,

    browse: null,
    collection: null,
    dealer: null,
    showcase: {
      item_uuid: item.item_uuid,
      visibility: item.visibility,
      owner_display_name: null,
      owner_avatar_url: null,
    },
  };
}

export function showcaseItemsToDisplayItems(
  items: ShowcaseApiRow[],
  artisanNames?: Record<string, ArtisanNameInfo>,
): DisplayItem[] {
  return items.map(item => showcaseItemToDisplayItem(item, artisanNames));
}
