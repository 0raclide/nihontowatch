/**
 * Market Trends API Route
 *
 * Returns time-series data for trend charts with linear regression analysis.
 * Supports multiple metrics with configurable periods and granularity.
 *
 * @route GET /api/admin/analytics/market/trends
 *
 * @query metric - Required: total_value | median_price | listing_count | available_count
 * @query period - Time period: 7d | 30d | 90d | 180d | 1y (default 90d)
 * @query itemType - Filter by item type (optional)
 * @query granularity - Data point granularity: daily | weekly | monthly (default daily)
 *
 * @returns {AnalyticsAPIResponse<TrendResponse>}
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { convertPriceToJPY } from '@/lib/currency/convert';
import type {
  TrendResponse,
  TrendDataPoint,
  TrendSummary,
  TrendLine,
  AnalyticsGranularity,
  AnalyticsAPIResponse,
} from '@/types/analytics';
import {
  verifyAdmin,
  parsePeriodParam,
  parseGranularityParam,
  parseDateRange,
  validateTrendMetric,
  errorResponse,
  successResponse,
  calculatePercentChange,
  roundTo,
} from '../_lib/utils';
import {
  mean,
  median,
  standardDeviation,
  coefficientOfVariation,
  linearRegression,
  determineTrend,
} from '@/lib/analytics/statistics';

export const dynamic = 'force-dynamic';

type TrendMetric = 'total_value' | 'median_price' | 'listing_count' | 'available_count';

/**
 * GET /api/admin/analytics/market/trends
 *
 * Returns time-series trend data for the specified metric.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsAPIResponse<TrendResponse>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<TrendResponse>>;
    }

    // 2. Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const metricParam = searchParams.get('metric');
    const metric = validateTrendMetric(metricParam);
    const period = parsePeriodParam(searchParams, '90d');
    const granularity = parseGranularityParam(searchParams, 'daily');
    const itemType = searchParams.get('itemType');

    if (!metric) {
      return errorResponse(
        "Missing or invalid 'metric' parameter. Must be one of: total_value, median_price, listing_count, available_count",
        400
      );
    }

    // 3. Calculate date range
    const { startDate, endDate } = parseDateRange(period);

    // 4. Try to get data from market_daily_snapshots table first
    let dataPoints = await getSnapshotData(
      supabase,
      metric,
      startDate,
      endDate,
      granularity,
      itemType
    );

    // 5. If no snapshot data, calculate from listings
    if (dataPoints.length === 0) {
      dataPoints = await calculateFromListings(
        supabase,
        metric,
        startDate,
        endDate,
        granularity,
        itemType
      );
    }

    // 6. Calculate trend statistics
    const summary = calculateTrendSummary(dataPoints);
    const trendLine = calculateTrendLine(dataPoints);

    // 7. Build response
    const response: TrendResponse = {
      metric: metricToAnalyticsMetric(metric),
      period,
      granularity,
      dataPoints,
      summary,
      trendLine,
    };

    // 8. Return response with 5-minute cache
    return successResponse(response, 300);
  } catch (error) {
    logger.logError('Market trends API error', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Get trend data from market_daily_snapshots table.
 */
async function getSnapshotData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  metric: TrendMetric,
  startDate: Date,
  endDate: Date,
  granularity: AnalyticsGranularity,
  itemType: string | null
): Promise<TrendDataPoint[]> {
  try {
    // Check if the table exists by querying it
    let query = supabase
      .from('market_daily_snapshots')
      .select('snapshot_date, total_value_jpy, median_price_jpy, total_listings, available_listings')
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .lte('snapshot_date', endDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true });

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    const { data, error } = await query;

    if (error) {
      // Table might not exist - that's okay, we'll fall back to calculating
      logger.warn('market_daily_snapshots query failed, will calculate from listings', { error: error.message });
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Aggregate by granularity
    const aggregated = aggregateByGranularity(data, granularity, metric);
    return formatDataPoints(aggregated, metric);
  } catch {
    return [];
  }
}

/**
 * Calculate trend data from listings table when snapshots aren't available.
 */
async function calculateFromListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  metric: TrendMetric,
  startDate: Date,
  endDate: Date,
  granularity: AnalyticsGranularity,
  itemType: string | null
): Promise<TrendDataPoint[]> {
  // For simplicity, we'll generate synthetic data points based on current state
  // In production, you'd have historical snapshots or use a time-series approach

  let query = supabase
    .from('listings')
    .select('first_seen_at, price_value, price_currency, is_available')
    .gte('first_seen_at', startDate.toISOString())
    .lte('first_seen_at', endDate.toISOString())
    .order('first_seen_at', { ascending: true })
    .limit(100000);

  if (itemType) {
    query = query.eq('item_type', itemType);
  }

  const { data: listings, error } = await query;

  if (error || !listings || listings.length === 0) {
    // Return minimal synthetic data
    return generateMinimalDataPoints(startDate, endDate, granularity);
  }

  // Group listings by date based on granularity
  const dateGroups = groupListingsByDate(listings, granularity);

  // Calculate cumulative metrics
  return calculateCumulativeMetrics(dateGroups, metric, startDate, endDate, granularity);
}

/**
 * Group listings by date period based on granularity.
 */
function groupListingsByDate(
  listings: Array<{
    first_seen_at: string;
    price_value: number | null;
    price_currency: string | null;
    is_available: boolean;
  }>,
  granularity: AnalyticsGranularity
): Map<string, typeof listings> {
  const groups = new Map<string, typeof listings>();

  for (const listing of listings) {
    const date = new Date(listing.first_seen_at);
    const key = getDateKey(date, granularity);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(listing);
  }

  return groups;
}

/**
 * Get date key for grouping based on granularity.
 */
function getDateKey(date: Date, granularity: AnalyticsGranularity): string {
  switch (granularity) {
    case 'daily':
      return date.toISOString().split('T')[0];
    case 'weekly': {
      // Get Monday of the week
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split('T')[0];
    }
    case 'monthly':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Calculate cumulative metrics over time.
 */
function calculateCumulativeMetrics(
  dateGroups: Map<string, Array<{
    first_seen_at: string;
    price_value: number | null;
    price_currency: string | null;
    is_available: boolean;
  }>>,
  metric: TrendMetric,
  startDate: Date,
  endDate: Date,
  granularity: AnalyticsGranularity
): TrendDataPoint[] {
  const dataPoints: TrendDataPoint[] = [];
  const sortedKeys = Array.from(dateGroups.keys()).sort();

  let cumulativeCount = 0;
  let cumulativeAvailable = 0;
  let cumulativeValue = 0;
  const allPrices: number[] = [];

  let prevValue = 0;

  for (const dateKey of sortedKeys) {
    const listings = dateGroups.get(dateKey) || [];

    for (const listing of listings) {
      cumulativeCount++;
      if (listing.is_available) {
        cumulativeAvailable++;
        const priceJPY = convertPriceToJPY(listing.price_value, listing.price_currency);
        if (priceJPY > 0) {
          cumulativeValue += priceJPY;
          allPrices.push(priceJPY);
        }
      }
    }

    let value: number;
    switch (metric) {
      case 'total_value':
        value = cumulativeValue;
        break;
      case 'median_price':
        value = median(allPrices);
        break;
      case 'listing_count':
        value = cumulativeCount;
        break;
      case 'available_count':
        value = cumulativeAvailable;
        break;
      default:
        value = 0;
    }

    const change = value - prevValue;
    const changePercent = prevValue > 0 ? calculatePercentChange(prevValue, value) : 0;

    dataPoints.push({
      date: dateKey,
      value: roundTo(value, metric === 'median_price' ? 0 : 0),
      change: roundTo(change, metric === 'median_price' ? 0 : 0),
      changePercent: roundTo(changePercent, 2),
    });

    prevValue = value;
  }

  // Fill in missing dates
  return fillMissingDates(dataPoints, startDate, endDate, granularity);
}

/**
 * Fill in missing dates with interpolated or carried-forward values.
 */
function fillMissingDates(
  dataPoints: TrendDataPoint[],
  startDate: Date,
  endDate: Date,
  granularity: AnalyticsGranularity
): TrendDataPoint[] {
  if (dataPoints.length === 0) {
    return generateMinimalDataPoints(startDate, endDate, granularity);
  }

  const filledPoints: TrendDataPoint[] = [];
  const existingDates = new Set(dataPoints.map((p) => p.date));

  const currentDate = new Date(startDate);
  let lastValue = dataPoints[0]?.value || 0;
  let pointIndex = 0;

  while (currentDate <= endDate) {
    const dateKey = getDateKey(currentDate, granularity);

    if (existingDates.has(dateKey) && pointIndex < dataPoints.length) {
      filledPoints.push(dataPoints[pointIndex]);
      lastValue = dataPoints[pointIndex].value;
      pointIndex++;
    } else if (!existingDates.has(dateKey)) {
      // Carry forward the last known value
      filledPoints.push({
        date: dateKey,
        value: lastValue,
        change: 0,
        changePercent: 0,
      });
    }

    // Move to next date based on granularity
    switch (granularity) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }

  return filledPoints;
}

/**
 * Generate minimal data points when no data is available.
 */
function generateMinimalDataPoints(
  startDate: Date,
  endDate: Date,
  granularity: AnalyticsGranularity
): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    points.push({
      date: getDateKey(currentDate, granularity),
      value: 0,
      change: 0,
      changePercent: 0,
    });

    switch (granularity) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }

  return points;
}

/**
 * Aggregate snapshot data by granularity.
 */
function aggregateByGranularity(
  data: Array<{
    snapshot_date: string;
    total_value_jpy: number | null;
    median_price_jpy: number | null;
    total_listings: number | null;
    available_listings: number | null;
  }>,
  granularity: AnalyticsGranularity,
  metric: TrendMetric
): Map<string, number> {
  const aggregated = new Map<string, { values: number[]; count: number }>();

  for (const row of data) {
    const date = new Date(row.snapshot_date);
    const key = getDateKey(date, granularity);

    let value: number;
    switch (metric) {
      case 'total_value':
        value = row.total_value_jpy || 0;
        break;
      case 'median_price':
        value = row.median_price_jpy || 0;
        break;
      case 'listing_count':
        value = row.total_listings || 0;
        break;
      case 'available_count':
        value = row.available_listings || 0;
        break;
      default:
        value = 0;
    }

    if (!aggregated.has(key)) {
      aggregated.set(key, { values: [], count: 0 });
    }
    aggregated.get(key)!.values.push(value);
    aggregated.get(key)!.count++;
  }

  // Average values for each period
  const result = new Map<string, number>();
  for (const [key, data] of aggregated) {
    const avg = data.values.reduce((a, b) => a + b, 0) / data.count;
    result.set(key, avg);
  }

  return result;
}

/**
 * Format aggregated data into TrendDataPoint array.
 */
function formatDataPoints(
  aggregated: Map<string, number>,
  metric: TrendMetric
): TrendDataPoint[] {
  const sortedEntries = Array.from(aggregated.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const dataPoints: TrendDataPoint[] = [];
  let prevValue = 0;

  for (const [date, value] of sortedEntries) {
    const change = value - prevValue;
    const changePercent = prevValue > 0 ? calculatePercentChange(prevValue, value) : 0;

    dataPoints.push({
      date,
      value: roundTo(value, metric === 'median_price' ? 0 : 0),
      change: roundTo(change, 0),
      changePercent: roundTo(changePercent, 2),
    });

    prevValue = value;
  }

  return dataPoints;
}

/**
 * Calculate trend summary statistics.
 */
function calculateTrendSummary(dataPoints: TrendDataPoint[]): TrendSummary {
  if (dataPoints.length === 0) {
    return {
      startValue: 0,
      endValue: 0,
      minValue: 0,
      maxValue: 0,
      totalChange: 0,
      totalChangePercent: 0,
      trend: 'stable',
      volatility: 0,
    };
  }

  const values = dataPoints.map((p) => p.value);
  const startValue = dataPoints[0].value;
  const endValue = dataPoints[dataPoints.length - 1].value;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const totalChange = endValue - startValue;
  const totalChangePercent = startValue > 0 ? calculatePercentChange(startValue, endValue) : 0;

  // Calculate trend direction using linear regression
  const points = dataPoints.map((p, i) => ({ x: i, y: p.value }));
  const regression = linearRegression(points);
  const stdDev = standardDeviation(values);
  const meanValue = mean(values);
  const trend = determineTrend(regression.slope, stdDev, meanValue);

  // Calculate volatility (coefficient of variation)
  const volatility = coefficientOfVariation(values);

  return {
    startValue: roundTo(startValue, 0),
    endValue: roundTo(endValue, 0),
    minValue: roundTo(minValue, 0),
    maxValue: roundTo(maxValue, 0),
    totalChange: roundTo(totalChange, 0),
    totalChangePercent: roundTo(totalChangePercent, 2),
    trend,
    volatility: roundTo(volatility, 4),
  };
}

/**
 * Calculate linear regression trend line.
 */
function calculateTrendLine(dataPoints: TrendDataPoint[]): TrendLine {
  if (dataPoints.length < 2) {
    return {
      slope: 0,
      intercept: dataPoints.length > 0 ? dataPoints[0].value : 0,
      rSquared: 1,
    };
  }

  const points = dataPoints.map((p, i) => ({ x: i, y: p.value }));
  const result = linearRegression(points);

  return {
    slope: roundTo(result.slope, 4),
    intercept: roundTo(result.intercept, 0),
    rSquared: roundTo(result.rSquared, 4),
  };
}

/**
 * Convert trend metric to analytics metric type.
 */
function metricToAnalyticsMetric(
  metric: TrendMetric
): 'total_value' | 'median_price' | 'total_listings' | 'available_listings' {
  switch (metric) {
    case 'total_value':
      return 'total_value';
    case 'median_price':
      return 'median_price';
    case 'listing_count':
      return 'total_listings';
    case 'available_count':
      return 'available_listings';
  }
}

