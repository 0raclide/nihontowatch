/**
 * Map a browse Listing (from API / Supabase) to DisplayItem.
 *
 * Resolves dealer display name at map time so display components
 * never need to call getDealerDisplayName themselves.
 */

import type { DisplayItem } from '@/types/displayItem';
import { getDealerDisplayName } from '@/lib/dealers/displayName';

/**
 * Minimal structural type for the listing input.
 * Accepts the global Listing, the browse API response shape,
 * and the VirtualListingGrid shape — anything with these fields.
 */
interface ListingInput {
  id: string | number;
  url?: string;
  title: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_ja?: string | null;
  item_type: string | null;
  price_value?: number | null;
  price_currency?: string | null;
  smith?: string | null;
  tosogu_maker?: string | null;
  school?: string | null;
  tosogu_school?: string | null;
  province?: string | null;
  era?: string | null;
  mei_type?: string | null;
  cert_type?: string | null;
  cert_session?: number | null;
  cert_organization?: string | null;
  nagasa_cm?: number | null;
  sori_cm?: number | null;
  motohaba_cm?: number | null;
  sakihaba_cm?: number | null;
  kasane_cm?: number | null;
  weight_g?: number | null;
  images: string[] | null;
  stored_images?: string[] | null;
  og_image_url?: string | null;
  focal_x?: number | null;
  focal_y?: number | null;
  thumbnail_url?: string | null;
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
  status: string;
  is_available: boolean;
  is_sold: boolean;
  first_seen_at: string;
  is_initial_import?: boolean | null;
  dealer_earliest_seen_at?: string | null;
  last_scraped_at?: string | null;
  dealer_id?: number | null;
  // Supabase join returns 'dealers' (plural) — both singular and plural accepted
  dealer?: { id?: number; name: string; name_ja?: string | null; domain?: string } | null;
  dealers?: { id?: number; name: string; name_ja?: string | null; domain?: string } | null;
  // Browse-only
  admin_hidden?: boolean;
  status_admin_locked?: boolean;
  featured_score?: number;
  sold_data?: {
    sale_date: string | null;
    days_on_market: number | null;
    days_on_market_display: string | null;
    confidence: string;
  } | null;
  // Setsumei
  setsumei_text_en?: string | null;
  setsumei_text_ja?: string | null;
  setsumei_metadata?: Record<string, unknown> | null;
  setsumei_processed_at?: string | null;
  has_setsumei?: boolean;
  yuhinkai_enrichment?: any;
}

export function listingToDisplayItem(listing: ListingInput, locale: string): DisplayItem {
  const dealerObj = listing.dealers || listing.dealer;
  const dealerName = dealerObj
    ? getDealerDisplayName(dealerObj as { name: string; name_ja?: string | null }, locale)
    : 'Dealer';

  return {
    // Identity
    id: listing.id,
    source: 'browse',

    // Content
    title: listing.title,
    title_en: listing.title_en ?? null,
    title_ja: listing.title_ja ?? null,
    description: listing.description ?? null,
    description_en: listing.description_en ?? null,
    description_ja: listing.description_ja ?? null,
    item_type: listing.item_type,

    // Pricing
    price_value: listing.price_value ?? null,
    price_currency: listing.price_currency ?? null,

    // Attribution
    smith: listing.smith ?? null,
    tosogu_maker: listing.tosogu_maker ?? null,
    school: listing.school ?? null,
    tosogu_school: listing.tosogu_school ?? null,
    province: listing.province ?? null,
    era: listing.era ?? null,
    mei_type: listing.mei_type ?? null,

    // Certification
    cert_type: listing.cert_type ?? null,
    cert_session: listing.cert_session ?? null,
    cert_organization: listing.cert_organization ?? null,

    // Measurements
    nagasa_cm: listing.nagasa_cm ?? null,
    sori_cm: listing.sori_cm ?? null,
    motohaba_cm: listing.motohaba_cm ?? null,
    sakihaba_cm: listing.sakihaba_cm ?? null,
    kasane_cm: listing.kasane_cm ?? null,
    weight_g: listing.weight_g ?? null,

    // Media
    images: listing.images,
    stored_images: listing.stored_images ?? null,
    og_image_url: listing.og_image_url ?? null,
    focal_x: listing.focal_x ?? null,
    focal_y: listing.focal_y ?? null,
    thumbnail_url: listing.thumbnail_url ?? null,

    // Artisan
    artisan_id: listing.artisan_id ?? null,
    artisan_display_name: listing.artisan_display_name ?? null,
    artisan_name_kanji: listing.artisan_name_kanji ?? null,
    artisan_confidence: listing.artisan_confidence ?? null,
    artisan_tier: listing.artisan_tier ?? null,
    artisan_method: listing.artisan_method ?? null,
    artisan_candidates: listing.artisan_candidates ?? null,
    artisan_verified: listing.artisan_verified ?? null,

    // Status
    status: listing.status,
    is_available: listing.is_available,
    is_sold: listing.is_sold,

    // Temporal
    first_seen_at: listing.first_seen_at,
    is_initial_import: listing.is_initial_import ?? null,
    dealer_earliest_seen_at: listing.dealer_earliest_seen_at ?? null,
    last_scraped_at: listing.last_scraped_at ?? null,

    // Dealer (pre-resolved)
    dealer_display_name: dealerName,
    dealer_display_name_ja: dealerObj?.name_ja ?? null,
    dealer_domain: dealerObj?.domain,
    dealer_id: listing.dealer_id ?? dealerObj?.id ?? null,

    // Setsumei
    setsumei_text_en: listing.setsumei_text_en ?? null,
    setsumei_text_ja: listing.setsumei_text_ja ?? null,
    setsumei_metadata: listing.setsumei_metadata ?? null,
    setsumei_processed_at: listing.setsumei_processed_at ?? null,
    has_setsumei: (listing as any).has_setsumei ?? undefined,
    yuhinkai_enrichment: listing.yuhinkai_enrichment ?? null,

    // Extensions
    browse: {
      url: listing.url || '',
      admin_hidden: listing.admin_hidden,
      status_admin_locked: listing.status_admin_locked,
      featured_score: listing.featured_score,
      sold_data: listing.sold_data ?? null,
    },
    collection: null,
  };
}
