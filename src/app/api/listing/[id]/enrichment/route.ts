import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Disable ISR caching - use HTTP Cache-Control instead
// This allows ?nocache=1 to properly bypass all caching layers
// See docs/POSTMORTEM_YUHINKAI_DATA_QUALITY.md for details
export const revalidate = 0;
export const dynamic = 'force-dynamic';

/**
 * Yuhinkai enrichment data from listing_yuhinkai_enrichment view
 */
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
  enriched_at: string;
  updated_at: string;
}

/**
 * GET /api/listing/[id]/enrichment
 *
 * Lightweight endpoint to fetch Yuhinkai catalog enrichment for a listing.
 * Returns enrichment data if available, null otherwise.
 *
 * Used by QuickView for on-demand enrichment loading.
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

    // Query the enrichment view directly
    const { data: enrichment, error } = await supabase
      .from('listing_yuhinkai_enrichment')
      .select(`
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
        enriched_at,
        updated_at
      `)
      .eq('listing_id', listingId)
      .maybeSingle();

    if (error) {
      logger.error('Enrichment fetch error', { error, listingId });
      return NextResponse.json(
        { error: 'Failed to fetch enrichment' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      enrichment: enrichment as YuhinkaiEnrichment | null,
    });

    // Aggressive caching - enrichment rarely changes
    // Cache for 1 hour at edge, serve stale for 24 hours while revalidating
    // Unless nocache=1 is passed for debugging
    if (nocache) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      response.headers.set(
        'Cache-Control',
        'public, s-maxage=3600, stale-while-revalidate=86400'
      );
    }

    return response;
  } catch (error) {
    logger.logError('Enrichment API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
