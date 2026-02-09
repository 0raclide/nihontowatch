import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE } from '@/lib/constants';
import { logger } from '@/lib/logger';

// Disable ISR caching - use HTTP Cache-Control instead
// This allows ?nocache=1 to properly bypass all caching layers for debugging
// See docs/POSTMORTEM_YUHINKAI_DATA_QUALITY.md for details
export const revalidate = 0;
export const dynamic = 'force-dynamic';

// Yuhinkai enrichment type (from listing_yuhinkai_enrichment view)
interface YuhinkaiEnrichment {
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

// Extended listing type with dealer info
interface ListingWithDealer {
  id: number;
  url: string;
  title: string;
  title_en: string | null;
  item_type: string | null;
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
  province: string | null;
  mei_type: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  sakihaba_cm: number | null;
  kasane_cm: number | null;
  weight_g: number | null;
  description: string | null;
  description_en: string | null;
  setsumei_image_url: string | null;
  setsumei_text_en: string | null;
  setsumei_text_ja: string | null;
  setsumei_metadata: Record<string, unknown> | null;
  setsumei_processed_at: string | null;
  setsumei_pipeline_version: string | null;
  images: string[] | null;
  stored_images: string[] | null;
  first_seen_at: string;
  last_scraped_at: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  // Artisan matching
  artisan_id: string | null;
  artisan_confidence: string | null;
  artisan_method: string | null;
  artisan_candidates: unknown[] | null;
  artisan_verified: string | null;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
  // Yuhinkai enrichment (from view, returns array but we want first item)
  listing_yuhinkai_enrichment?: YuhinkaiEnrichment[];
}

/**
 * GET /api/listing/[id]
 *
 * Fetch a single listing with dealer info and baseline for "New this week" badge.
 * Server-side route enables edge caching - reducing Supabase queries.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id);

  // Allow cache bypass with ?nocache=1 for debugging
  const nocache = request.nextUrl.searchParams.get('nocache') === '1';

  if (isNaN(listingId)) {
    return NextResponse.json(
      { error: 'Invalid listing ID' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Fetch listing with dealer info and Yuhinkai enrichment
    const { data: listing, error } = await supabase
      .from('listings')
      .select(`
        id,
        url,
        title,
        title_en,
        item_type,
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
        province,
        mei_type,
        nagasa_cm,
        sori_cm,
        motohaba_cm,
        sakihaba_cm,
        kasane_cm,
        weight_g,
        description,
        description_en,
        setsumei_image_url,
        setsumei_text_en,
        setsumei_text_ja,
        setsumei_metadata,
        setsumei_processed_at,
        setsumei_pipeline_version,
        images,
        stored_images,
        first_seen_at,
        last_scraped_at,
        status,
        is_available,
        is_sold,
        dealer_id,
        artisan_id,
        artisan_confidence,
        artisan_method,
        artisan_candidates,
        artisan_verified,
        dealers (
          id,
          name,
          domain
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
      `)
      .eq('id', listingId)
      .single();

    if (error || !listing) {
      logger.error('Listing fetch error', { error, listingId });
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    const typedListing = listing as unknown as ListingWithDealer;

    // Fetch dealer baseline for "New this week" badge
    // This is the earliest listing from this dealer
    let dealerEarliestSeenAt: string | null = null;

    if (typedListing.dealer_id) {
      const { data: baseline } = await supabase
        .from('listings')
        .select('first_seen_at')
        .eq('dealer_id', typedListing.dealer_id)
        .order('first_seen_at', { ascending: true })
        .limit(1)
        .single();

      if (baseline) {
        dealerEarliestSeenAt = (baseline as { first_seen_at: string }).first_seen_at;
      }
    }

    // Extract Yuhinkai enrichment (view returns array, we want first item or null)
    const yuhinkai_enrichment = typedListing.listing_yuhinkai_enrichment?.[0] || null;

    // For sold items with no price, fetch sale price from price_history
    let salePrice: number | null = null;
    let saleCurrency: string | null = null;
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
        salePrice = priceHistory.old_price;
        saleCurrency = priceHistory.old_currency || 'JPY';
        priceFromHistory = true;
      }
    }

    // Enrich listing with dealer baseline and Yuhinkai enrichment
    const enrichedListing = {
      ...typedListing,
      dealer_earliest_seen_at: dealerEarliestSeenAt,
      // Replace array with single object (or null)
      yuhinkai_enrichment,
      // Remove the array version
      listing_yuhinkai_enrichment: undefined,
      // Add sale price from history if available
      ...(priceFromHistory && {
        price_value: salePrice,
        price_currency: saleCurrency,
        price_from_history: true,
      }),
    };

    const response = NextResponse.json({ listing: enrichedListing });

    // Cache headers - bypass with ?nocache=1 for debugging
    if (nocache) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      // Cache for 10 minutes at edge, serve stale for 30 minutes while revalidating
      response.headers.set(
        'Cache-Control',
        `public, s-maxage=${CACHE.LISTING_DETAIL}, stale-while-revalidate=1800`
      );
    }

    return response;
  } catch (error) {
    logger.logError('Listing API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
