/**
 * Top Listings API Route
 *
 * Returns the most viewed and/or favorited listings within a period.
 *
 * @route GET /api/admin/analytics/engagement/top-listings
 *
 * @query period - Time period ('7d'|'30d'|'90d'), default '30d'
 * @query limit - Number of results (1-100), default 10
 * @query sortBy - Sort by 'views' or 'favorites', default 'views'
 *
 * @returns TopListingsData with listing details and engagement metrics
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { AnalyticsAPIResponse } from '@/types/analytics';
import {
  verifyAdmin,
  parsePeriodParam,
  parseLimitParam,
  parseSortByParam,
  calculatePeriodDates,
  successResponse,
  errorResponse,
  getAdminUserIds,
} from '../_lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface TopListing {
  id: number;
  title: string;
  itemType: string;
  dealerName: string;
  views: number;
  uniqueViewers: number;
  favorites: number;
  priceJPY: number | null;
}

interface TopListingsData {
  listings: TopListing[];
  period: string;
  sortedBy: string;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * GET /api/admin/analytics/engagement/top-listings
 *
 * Returns most engaged-with listings.
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsAPIResponse<TopListingsData>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<TopListingsData>>;
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const limit = parseLimitParam(searchParams, 10, 100);
    const sortBy = parseSortByParam(searchParams, ['views', 'favorites'] as const, 'views');
    const { startDate, endDate } = calculatePeriodDates(period);

    // 3. Get listing views from listing_views table
    const { data: viewEvents, error: viewError } = await supabase
      .from('listing_views')
      .select('listing_id, session_id, user_id')
      .gte('viewed_at', startDate.toISOString())
      .lte('viewed_at', endDate.toISOString())
      .limit(50000);

    if (viewError) {
      logger.error('Top listings view query error', { error: viewError });
      return errorResponse('Failed to fetch view data', 500);
    }

    // 4. Aggregate views by listing_id
    const viewsByListing = new Map<number, {
      views: number;
      uniqueViewers: Set<string>;
    }>();

    type ViewRow = {
      listing_id: number;
      session_id: string;
      user_id: string | null;
    };
    // Filter out admin user activity
    const adminIds = await getAdminUserIds(supabase);
    const viewsData = ((viewEvents || []) as ViewRow[]).filter(
      v => !v.user_id || !adminIds.includes(v.user_id)
    );

    for (const view of viewsData) {
      const listingId = view.listing_id;
      if (typeof listingId !== 'number') continue;

      let listingData = viewsByListing.get(listingId);
      if (!listingData) {
        listingData = { views: 0, uniqueViewers: new Set<string>() };
        viewsByListing.set(listingId, listingData);
      }

      listingData.views++;
      // Use session_id for unique viewer tracking (handles anonymous users)
      if (view.session_id) {
        listingData.uniqueViewers.add(view.session_id);
      } else if (view.user_id) {
        listingData.uniqueViewers.add(view.user_id);
      }
    }

    // 5. Get favorites for the period
    const { data: favoriteData, error: favoriteError } = await supabase
      .from('user_favorites')
      .select('listing_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (favoriteError) {
      logger.error('Top listings favorites query error', { error: favoriteError });
    }

    // Aggregate favorites by listing_id
    const favoritesByListing = new Map<number, number>();
    const favoritesData = (favoriteData || []) as Array<{ listing_id: number }>;
    for (const fav of favoritesData) {
      const listingId = fav.listing_id;
      favoritesByListing.set(listingId, (favoritesByListing.get(listingId) || 0) + 1);
    }

    // 6. Combine all unique listing IDs
    const allListingIds = new Set<number>([
      ...viewsByListing.keys(),
      ...favoritesByListing.keys(),
    ]);

    if (allListingIds.size === 0) {
      return successResponse({
        listings: [],
        period,
        sortedBy: sortBy,
      }, 300);
    }

    // 7. Sort listings by the chosen metric
    const listingsWithMetrics = Array.from(allListingIds).map((id) => ({
      id,
      views: viewsByListing.get(id)?.views || 0,
      uniqueViewers: viewsByListing.get(id)?.uniqueViewers.size || 0,
      favorites: favoritesByListing.get(id) || 0,
    }));

    listingsWithMetrics.sort((a, b) => {
      if (sortBy === 'favorites') {
        return b.favorites - a.favorites;
      }
      return b.views - a.views;
    });

    // Take top N
    const topListingIds = listingsWithMetrics.slice(0, limit).map((l) => l.id);

    // 8. Fetch listing details from database
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        item_type,
        price_jpy,
        dealers:dealer_id (
          name
        )
      `)
      .in('id', topListingIds);

    if (listingsError) {
      logger.error('Top listings details query error', { error: listingsError });
      return errorResponse('Failed to fetch listing details', 500);
    }

    // 9. Build response with listing details and metrics
    type ListingRow = {
      id: number;
      title: string | null;
      item_type: string | null;
      price_jpy: number | null;
      dealers: { name: string } | { name: string }[] | null;
    };
    const listingsData = (listings || []) as ListingRow[];

    const listingsMap = new Map(
      listingsData.map((l) => [l.id, l])
    );

    const metricsMap = new Map(
      listingsWithMetrics.map((m) => [m.id, m])
    );

    const topListings: TopListing[] = topListingIds
      .map((id) => {
        const listing = listingsMap.get(id);
        const metrics = metricsMap.get(id);

        if (!listing || !metrics) return null;

        // Handle dealers join - can be array or object
        let dealerName = 'Unknown';
        if (listing.dealers) {
          if (Array.isArray(listing.dealers) && listing.dealers.length > 0) {
            dealerName = listing.dealers[0].name || 'Unknown';
          } else if (typeof listing.dealers === 'object' && 'name' in listing.dealers) {
            dealerName = (listing.dealers as { name: string }).name || 'Unknown';
          }
        }

        return {
          id: listing.id,
          title: listing.title || 'Untitled',
          itemType: listing.item_type || 'Unknown',
          dealerName,
          views: metrics.views,
          uniqueViewers: metrics.uniqueViewers,
          favorites: metrics.favorites,
          priceJPY: listing.price_jpy,
        };
      })
      .filter((l): l is TopListing => l !== null);

    // 10. Build response
    const data: TopListingsData = {
      listings: topListings,
      period,
      sortedBy: sortBy,
    };

    // 11. Return response with 5-minute cache
    return successResponse(data, 300);
  } catch (error) {
    logger.logError('Top listings API error', error);
    return errorResponse('Internal server error', 500);
  }
}
