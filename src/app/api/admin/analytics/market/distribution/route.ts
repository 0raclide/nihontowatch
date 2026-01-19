/**
 * Price Distribution API Route
 *
 * Returns price distribution histogram data with configurable buckets
 * and statistical analysis (mean, median, stdDev, skewness, percentiles).
 *
 * @route GET /api/admin/analytics/market/distribution
 *
 * @query buckets - Number of histogram buckets (default 20, max 50)
 * @query itemType - Filter by item type
 * @query certification - Filter by certification type
 * @query dealer - Filter by dealer ID
 * @query minPrice - Minimum price filter
 * @query maxPrice - Maximum price filter
 *
 * @returns {AnalyticsAPIResponse<PriceDistributionResponse>}
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type {
  PriceDistributionResponse,
  PriceBucket,
  PriceStatistics,
  AnalyticsAPIResponse,
} from '@/types/analytics';
import {
  verifyAdmin,
  parseIntParam,
  parseFloatParam,
  errorResponse,
  successResponse,
  roundTo,
} from '../_lib/utils';
import {
  mean,
  median,
  standardDeviation,
  skewness,
  percentiles as calcPercentiles,
  createHistogramBuckets,
  formatPriceRangeLabel,
} from '@/lib/analytics/statistics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics/market/distribution
 *
 * Returns price distribution histogram and statistics for available listings.
 * Supports filtering by item type, certification, dealer, and price range.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsAPIResponse<PriceDistributionResponse>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<PriceDistributionResponse>>;
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const bucketCount = parseIntParam(searchParams, 'buckets', 20, 1, 50);
    const itemType = searchParams.get('itemType');
    const certification = searchParams.get('certification');
    const dealerIdParam = searchParams.get('dealer');
    const dealerId = dealerIdParam ? parseInt(dealerIdParam, 10) : null;
    const minPrice = parseFloatParam(searchParams, 'minPrice');
    const maxPrice = parseFloatParam(searchParams, 'maxPrice');

    // 3. Build query with filters
    let query = supabase
      .from('listings')
      .select('price_value, price_currency')
      .eq('is_available', true)
      .not('price_value', 'is', null)
      .gt('price_value', 0);

    // Apply filters
    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    if (certification) {
      query = query.eq('cert_type', certification);
    }

    if (dealerId && !isNaN(dealerId)) {
      query = query.eq('dealer_id', dealerId);
    }

    if (minPrice !== null && !isNaN(minPrice)) {
      query = query.gte('price_value', minPrice);
    }

    if (maxPrice !== null && !isNaN(maxPrice)) {
      query = query.lte('price_value', maxPrice);
    }

    // Limit to prevent memory issues
    query = query.limit(100000);

    // 4. Execute query
    const { data: listings, error } = await query;

    if (error) {
      console.error('Distribution query error:', error);
      return errorResponse('Failed to fetch price data', 500);
    }

    // 5. Extract and convert prices to JPY
    const priceValues = convertAndFilterPrices(listings || []);

    // Handle empty results
    if (priceValues.length === 0) {
      const emptyResponse: PriceDistributionResponse = {
        buckets: [],
        statistics: {
          count: 0,
          mean: 0,
          median: 0,
          stdDev: 0,
          skewness: 0,
          percentiles: { p10: 0, p25: 0, p75: 0, p90: 0 },
        },
        filters: {
          itemType: itemType || null,
          certification: certification || null,
          dealer: dealerId ? String(dealerId) : null,
        },
      };
      return successResponse(emptyResponse, 300);
    }

    // 6. Calculate histogram buckets
    const rawBuckets = createHistogramBuckets(priceValues, bucketCount, {
      minValue: minPrice ?? undefined,
      maxValue: maxPrice ?? undefined,
      useNiceNumbers: true,
    });

    // Format buckets with labels
    const buckets: PriceBucket[] = rawBuckets.map((bucket) => ({
      rangeStart: roundTo(bucket.rangeStart, 0),
      rangeEnd: roundTo(bucket.rangeEnd, 0),
      label: formatPriceRangeLabel(bucket.rangeStart, bucket.rangeEnd),
      count: bucket.count,
      percentage: roundTo(bucket.percentage, 2),
      cumulativePercentage: roundTo(bucket.cumulativePercentage, 2),
    }));

    // 7. Calculate statistics
    const percentileValues = calcPercentiles(priceValues, [10, 25, 75, 90]);

    const statistics: PriceStatistics = {
      count: priceValues.length,
      mean: roundTo(mean(priceValues), 0),
      median: roundTo(median(priceValues), 0),
      stdDev: roundTo(standardDeviation(priceValues), 0),
      skewness: roundTo(skewness(priceValues), 3),
      percentiles: {
        p10: roundTo(percentileValues[10] || 0, 0),
        p25: roundTo(percentileValues[25] || 0, 0),
        p75: roundTo(percentileValues[75] || 0, 0),
        p90: roundTo(percentileValues[90] || 0, 0),
      },
    };

    // 8. Build response
    const response: PriceDistributionResponse = {
      buckets,
      statistics,
      filters: {
        itemType: itemType || null,
        certification: certification || null,
        dealer: dealerId ? String(dealerId) : null,
      },
    };

    // 9. Return response with 5-minute cache
    return successResponse(response, 300);
  } catch (error) {
    console.error('Price distribution API error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Convert prices to JPY and filter out invalid values.
 *
 * @param listings - Array of listings with price_value and price_currency
 * @returns Array of valid price values in JPY
 */
function convertAndFilterPrices(
  listings: Array<{ price_value: number | null; price_currency: string | null }>
): number[] {
  // Approximate conversion rates to JPY
  const toJPY: Record<string, number> = {
    JPY: 1,
    USD: 150,
    EUR: 165,
    GBP: 190,
  };

  return listings
    .filter(
      (l): l is { price_value: number; price_currency: string } =>
        l.price_value !== null && l.price_value > 0
    )
    .map((l) => {
      const rate = toJPY[l.price_currency || 'JPY'] || 1;
      return l.price_value * rate;
    });
}
