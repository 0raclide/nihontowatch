/**
 * Price Changes API Route
 *
 * Returns recent price movements from the price_history table.
 * Includes listing details, dealer info, and percentage changes.
 *
 * @route GET /api/admin/analytics/market/price-changes
 *
 * @query limit - Max changes to return (default 50, max 200)
 * @query minChangePercent - Minimum absolute % change to include (optional)
 * @query period - Time period filter: 24h | 7d | 30d | all (default 7d)
 *
 * @returns {AnalyticsAPIResponse<PriceChangesResponse>}
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type {
  PriceChangesResponse,
  PriceChangeRecord,
  AnalyticsPeriod,
  AnalyticsAPIResponse,
} from '@/types/analytics';
import type { ItemType } from '@/types/index';
import {
  verifyAdmin,
  parseIntParam,
  parseFloatParam,
  errorResponse,
  successResponse,
  roundTo,
} from '../_lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// QUERY RESULT TYPES
// =============================================================================

/** Type for price history query result with joined listing and dealer */
interface PriceHistoryRow {
  id: number;
  listing_id: number;
  old_price: number | null;
  new_price: number | null;
  change_type: string;
  detected_at: string;
  listings: {
    id: number;
    title: string | null;
    item_type: string | null;
    dealer_id: number;
    dealers: { id: number; name: string } | null;
  } | null;
}

/**
 * GET /api/admin/analytics/market/price-changes
 *
 * Returns recent price changes with listing and dealer details.
 * Real-time data, no caching.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsAPIResponse<PriceChangesResponse>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<PriceChangesResponse>>;
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseIntParam(searchParams, 'limit', 50, 1, 200);
    const minChangePercent = parseFloatParam(searchParams, 'minChangePercent');
    const periodParam = searchParams.get('period') || '7d';

    // 3. Calculate date filter based on period
    const startDate = calculateStartDate(periodParam);

    // 4. Query price history with listing and dealer joins
    let query = supabase
      .from('price_history')
      .select(`
        id,
        listing_id,
        old_price,
        new_price,
        change_type,
        detected_at,
        listings (
          id,
          title,
          item_type,
          dealer_id,
          dealers (
            id,
            name
          )
        )
      `)
      .order('detected_at', { ascending: false });

    // Apply date filter
    if (startDate) {
      query = query.gte('detected_at', startDate.toISOString());
    }

    // Only get price changes (not status changes)
    query = query.in('change_type', ['increase', 'decrease']);

    // Fetch more than limit to allow filtering by minChangePercent
    const fetchLimit = minChangePercent !== null ? limit * 3 : limit;
    query = query.limit(fetchLimit);

    const result = await query;
    const priceChanges = result.data as PriceHistoryRow[] | null;
    const error = result.error;
    const count = result.count;

    if (error) {
      console.error('Price changes query error:', error);
      return errorResponse('Failed to fetch price changes', 500);
    }

    // 5. Transform and filter results
    const records: PriceChangeRecord[] = [];

    if (priceChanges) {
      for (const change of priceChanges) {
        const oldPrice = change.old_price;
        const newPrice = change.new_price;

        // Skip if prices are missing or invalid
        if (!oldPrice || !newPrice || oldPrice <= 0) {
          continue;
        }

        // Calculate change amount and percentage
        const changeAmount = newPrice - oldPrice;
        const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;

        // Apply minChangePercent filter if specified
        if (minChangePercent !== null && Math.abs(changePercent) < minChangePercent) {
          continue;
        }

        // Extract listing data from the join
        const listingData = change.listings;

        // Extract dealer data
        const dealerData = listingData?.dealers;

        const record: PriceChangeRecord = {
          listingId: change.listing_id,
          title: listingData?.title || `Listing #${change.listing_id}`,
          dealerName: dealerData?.name || 'Unknown Dealer',
          itemType: (listingData?.item_type as ItemType) || 'unknown',
          oldPrice: roundTo(oldPrice, 0),
          newPrice: roundTo(newPrice, 0),
          changeAmount: roundTo(changeAmount, 0),
          changePercent: roundTo(changePercent, 2),
          detectedAt: change.detected_at,
        };

        records.push(record);

        // Stop once we have enough records
        if (records.length >= limit) {
          break;
        }
      }
    }

    // 6. Get total count for the period (without limit)
    let totalCount = count || records.length;

    // If we need accurate count and didn't get it from the query
    if (!count) {
      const countQuery = supabase
        .from('price_history')
        .select('id', { count: 'exact', head: true })
        .in('change_type', ['increase', 'decrease']);

      if (startDate) {
        countQuery.gte('detected_at', startDate.toISOString());
      }

      const { count: exactCount } = await countQuery;
      totalCount = exactCount || records.length;
    }

    // 7. Determine the period label
    const period = periodToPeriodType(periodParam);

    // 8. Build response
    const response: PriceChangesResponse = {
      changes: records,
      totalCount,
      period,
    };

    // 9. Return response (no cache for real-time data)
    return successResponse(response, 0);
  } catch (error) {
    console.error('Price changes API error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Calculate start date based on period parameter.
 */
function calculateStartDate(period: string): Date | null {
  const now = new Date();

  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return null; // No date filter
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7d
  }
}

/**
 * Convert period string to AnalyticsPeriod type.
 */
function periodToPeriodType(period: string): AnalyticsPeriod {
  switch (period) {
    case '24h':
      return '7d'; // Closest match (24h not in AnalyticsPeriod)
    case '7d':
      return '7d';
    case '30d':
      return '30d';
    case '90d':
      return '90d';
    case '180d':
      return '180d';
    case '1y':
      return '1y';
    case 'all':
      return 'all';
    default:
      return '7d';
  }
}
