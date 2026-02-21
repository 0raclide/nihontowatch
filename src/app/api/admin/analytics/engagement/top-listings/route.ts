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
import { verifyAdmin } from '@/lib/admin/auth';
import {
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
    if (!authResult.isAdmin) {
      return errorResponse(authResult.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden',
        authResult.error === 'unauthorized' ? 401 : 403);
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const limit = parseLimitParam(searchParams, 10, 100);
    const sortBy = parseSortByParam(searchParams, ['views', 'favorites'] as const, 'views');
    const { startDate, endDate } = calculatePeriodDates(period);

    // 3. Get admin user IDs for filtering
    const adminIds = await getAdminUserIds(supabase);

    // 4. Fetch top listings via RPC (SQL aggregation with sort)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_top_listings', {
      p_start: startDate.toISOString(),
      p_end: endDate.toISOString(),
      p_admin_ids: adminIds,
      p_limit: limit,
      p_sort: sortBy,
    });

    if (rpcError) {
      logger.error('Top listings RPC error', { error: rpcError });
      return errorResponse('Failed to fetch view data', 500);
    }

    // 5. Build metrics from RPC results
    type RpcRow = { listing_id: number; view_count: number; unique_viewers: number; favorite_count: number };
    const rpcRows = (rpcData || []) as RpcRow[];

    if (rpcRows.length === 0) {
      return successResponse({
        listings: [],
        period,
        sortedBy: sortBy,
      }, 300);
    }

    // Map RPC results (already sorted and limited by SQL)
    const listingsWithMetrics = rpcRows.map(row => ({
      id: Number(row.listing_id),
      views: Number(row.view_count),
      uniqueViewers: Number(row.unique_viewers),
      favorites: Number(row.favorite_count),
    }));

    const topListingIds = listingsWithMetrics.map((l) => l.id);

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
