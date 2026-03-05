import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { getListingDetail } from '@/lib/listing/getListingDetail';
import { verifyDealer } from '@/lib/dealer/auth';

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
    let enrichedListing = await getListingDetail(supabase, listingId);

    // RLS (migration 098) blocks source='dealer' rows from anon/authenticated client.
    // If listing not found, check if requesting user is the owning dealer and retry
    // with service client to bypass RLS.
    if (!enrichedListing) {
      const auth = await verifyDealer(supabase);
      if (auth.isDealer) {
        const serviceClient = createServiceClient();
        enrichedListing = await getListingDetail(serviceClient, listingId);
        // Verify ownership: dealer can only see their own listings
        if (enrichedListing && enrichedListing.dealer_id !== auth.dealerId) {
          enrichedListing = null;
        }
      }
    }

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
