/**
 * Market Overview API Route
 *
 * Returns high-level market statistics including listing counts, value metrics,
 * price distribution percentiles, 24h activity, and period-over-period changes.
 *
 * @route GET /api/admin/analytics/market/overview
 *
 * @query currency - Response currency (JPY|USD|EUR), default JPY
 *
 * @returns {AnalyticsAPIResponse<MarketOverview>}
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { convertPricesToJPY } from '@/lib/currency/convert';
import type { MarketOverview, AnalyticsAPIResponse, ChangeMetric } from '@/types/analytics';
import type { Currency } from '@/types/index';
import {
  verifyAdmin,
  parseCurrencyParam,
  getComparisonDate,
  errorResponse,
  successResponse,
  calculatePercentChange,
  roundTo,
} from '../_lib/utils';
import { percentiles as calcPercentiles, median, mean } from '@/lib/analytics/statistics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/market/overview
 *
 * Returns high-level market statistics for the analytics dashboard.
 * Data is cached for 5 minutes to reduce database load.
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsAPIResponse<MarketOverview>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<MarketOverview>>;
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const currency: Currency = parseCurrencyParam(searchParams, 'JPY');

    // 3. Get current time references
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = getComparisonDate();

    // 4. Query current market data
    const [
      totalCountResult,
      availableCountResult,
      soldCountResult,
      availablePricesResult,
      newListings24hResult,
      soldListings24hResult,
      priceChanges24hResult,
    ] = await Promise.all([
      // Total listings count
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true }),

      // Available listings count
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('is_available', true),

      // Sold listings count
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('is_sold', true),

      // Available listings with prices for value calculations
      supabase
        .from('listings')
        .select('price_value, price_currency')
        .eq('is_available', true)
        .not('price_value', 'is', null)
        .limit(50000), // Cap to prevent memory issues

      // New listings in last 24 hours
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .gte('first_seen_at', twentyFourHoursAgo.toISOString()),

      // Sold listings in last 24 hours
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('is_sold', true)
        .gte('last_scraped_at', twentyFourHoursAgo.toISOString()),

      // Price changes in last 24 hours
      supabase
        .from('price_history')
        .select('id', { count: 'exact', head: true })
        .gte('detected_at', twentyFourHoursAgo.toISOString()),
    ]);

    // 5. Query 7-day-ago data for comparison metrics
    const [
      availableCount7dAgoResult,
      availablePrices7dAgoResult,
    ] = await Promise.all([
      // Available listings count 7 days ago (approximate using first_seen_at)
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('is_available', true)
        .lte('first_seen_at', sevenDaysAgo.toISOString()),

      // Available listings prices as of 7 days ago (simplified - using current prices for older listings)
      supabase
        .from('listings')
        .select('price_value, price_currency')
        .eq('is_available', true)
        .not('price_value', 'is', null)
        .lte('first_seen_at', sevenDaysAgo.toISOString())
        .limit(50000),
    ]);

    // 6. Process current price data
    const availablePrices = availablePricesResult.data || [];
    const priceValuesJPY = convertPricesToJPY(availablePrices);

    // Calculate statistics
    const totalMarketValue = priceValuesJPY.reduce((sum, p) => sum + p, 0);
    const medianPrice = median(priceValuesJPY);
    const averagePrice = mean(priceValuesJPY);
    const priceRange = {
      min: priceValuesJPY.length > 0 ? Math.min(...priceValuesJPY) : 0,
      max: priceValuesJPY.length > 0 ? Math.max(...priceValuesJPY) : 0,
    };

    // Calculate percentiles
    const percentileValues = calcPercentiles(priceValuesJPY, [10, 25, 75, 90]);

    // 7. Process 7-day-ago data for comparisons
    const prices7dAgo = availablePrices7dAgoResult.data || [];
    const priceValues7dAgoJPY = convertPricesToJPY(prices7dAgo);
    const totalValue7dAgo = priceValues7dAgoJPY.reduce((sum, p) => sum + p, 0);
    const medianPrice7dAgo = median(priceValues7dAgoJPY);
    const listingCount7dAgo = availableCount7dAgoResult.count || 0;

    // 8. Calculate change metrics
    const totalValueChange: ChangeMetric = {
      amount: roundTo(totalMarketValue - totalValue7dAgo, 0),
      percent: roundTo(calculatePercentChange(totalValue7dAgo, totalMarketValue), 2),
      period: '7d',
    };

    const medianPriceChange: ChangeMetric = {
      amount: roundTo(medianPrice - medianPrice7dAgo, 0),
      percent: roundTo(calculatePercentChange(medianPrice7dAgo, medianPrice), 2),
      period: '7d',
    };

    const availableCount = availableCountResult.count || 0;
    const listingCountChange: ChangeMetric = {
      amount: availableCount - listingCount7dAgo,
      percent: roundTo(calculatePercentChange(listingCount7dAgo, availableCount), 2),
      period: '7d',
    };

    // 9. Build response
    const overview: MarketOverview = {
      asOf: now.toISOString(),

      // Counts
      totalListings: totalCountResult.count || 0,
      availableListings: availableCount,
      soldListings: soldCountResult.count || 0,

      // Value metrics
      totalMarketValue: roundTo(totalMarketValue, 0),
      currency,
      medianPrice: roundTo(medianPrice, 0),
      averagePrice: roundTo(averagePrice, 0),

      // Price range
      priceRange: {
        min: roundTo(priceRange.min, 0),
        max: roundTo(priceRange.max, 0),
      },

      // Percentiles
      percentiles: {
        p10: roundTo(percentileValues[10] || 0, 0),
        p25: roundTo(percentileValues[25] || 0, 0),
        p75: roundTo(percentileValues[75] || 0, 0),
        p90: roundTo(percentileValues[90] || 0, 0),
      },

      // 24h activity
      activity24h: {
        newListings: newListings24hResult.count || 0,
        soldListings: soldListings24hResult.count || 0,
        priceChanges: priceChanges24hResult.count || 0,
      },

      // Period-over-period changes
      changes: {
        totalValue: totalValueChange,
        medianPrice: medianPriceChange,
        listingCount: listingCountChange,
      },
    };

    // 10. Return response with 5-minute cache
    return successResponse(overview, 300);
  } catch (error) {
    logger.logError('Market overview API error', error);
    return errorResponse('Internal server error', 500);
  }
}

