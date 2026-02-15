import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { getListingDetail } from '@/lib/listing/getListingDetail';

// Disable ISR caching - use HTTP Cache-Control instead
// This allows ?nocache=1 to properly bypass all caching layers for debugging
// See docs/POSTMORTEM_YUHINKAI_DATA_QUALITY.md for details
export const revalidate = 0;
export const dynamic = 'force-dynamic';

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
    const enrichedListing = await getListingDetail(supabase, listingId);

    if (!enrichedListing) {
      logger.error('Listing fetch error', { listingId });
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

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
