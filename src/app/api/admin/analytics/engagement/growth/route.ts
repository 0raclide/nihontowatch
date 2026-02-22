/**
 * User Growth API Route
 *
 * Returns user growth time series data showing new user signups
 * over time with cumulative totals.
 *
 * @route GET /api/admin/analytics/engagement/growth
 *
 * @query period - Time period ('7d'|'30d'|'90d'), default '90d'
 * @query granularity - Data granularity ('daily'|'weekly'|'monthly'), default 'daily'
 *
 * @returns GrowthData with time series and summary statistics
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { AnalyticsAPIResponse, AnalyticsGranularity } from '@/types/analytics';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  parsePeriodParam,
  parseGranularityParam,
  calculatePeriodDates,
  successResponse,
  errorResponse,
  roundTo,
  fetchAllRows,
} from '../_lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface GrowthDataPoint {
  date: string;
  newUsers: number;
  cumulativeUsers: number;
}

interface GrowthSummary {
  totalNewUsers: number;
  avgDailySignups: number;
  peakDay: string;
  peakCount: number;
}

interface GrowthData {
  dataPoints: GrowthDataPoint[];
  summary: GrowthSummary;
  period: string;
  granularity: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the start of week (Sunday) for a date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the start of month for a date
 */
function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get date key based on granularity
 */
function getDateKey(date: Date, granularity: AnalyticsGranularity): string {
  switch (granularity) {
    case 'weekly':
      return formatDate(getWeekStart(date));
    case 'monthly':
      return formatDate(getMonthStart(date));
    default:
      return formatDate(date);
  }
}

/**
 * Generate date range array based on granularity
 */
function generateDateRange(
  startDate: Date,
  endDate: Date,
  granularity: AnalyticsGranularity
): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const key = getDateKey(current, granularity);
    if (!dates.includes(key)) {
      dates.push(key);
    }

    // Increment based on granularity
    switch (granularity) {
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      default:
        current.setDate(current.getDate() + 1);
    }
  }

  return dates;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * GET /api/admin/analytics/engagement/growth
 *
 * Returns user growth time series data.
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsAPIResponse<GrowthData>>> {
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
    const period = parsePeriodParam(searchParams, '90d');
    const granularity = parseGranularityParam(searchParams);
    const { startDate, endDate, days } = calculatePeriodDates(period);

    // 3. Get count of users before the period (for cumulative calculation)
    const { count: usersBeforePeriod } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', startDate.toISOString());

    const baseCount = usersBeforePeriod || 0;

    // 4. Get all users created in the period
    const { data: newUsers, error: usersError } = await fetchAllRows<{ id: string; created_at: string }>(
      supabase
        .from('profiles')
        .select('id, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
    );

    if (usersError) {
      logger.error('Growth query error', { error: usersError });
      return errorResponse('Failed to fetch growth data', 500);
    }

    // 5. Aggregate by date based on granularity
    const dateRange = generateDateRange(startDate, endDate, granularity);
    const countsByDate = new Map<string, number>();

    // Initialize all dates with 0
    for (const date of dateRange) {
      countsByDate.set(date, 0);
    }

    // Count users by date key
    const usersData = newUsers;
    for (const user of usersData) {
      const userDate = new Date(user.created_at);
      const key = getDateKey(userDate, granularity);
      countsByDate.set(key, (countsByDate.get(key) || 0) + 1);
    }

    // 6. Build data points with cumulative counts
    let cumulative = baseCount;
    let peakDay = '';
    let peakCount = 0;
    let totalNewUsers = 0;

    const dataPoints: GrowthDataPoint[] = dateRange.map((date) => {
      const newCount = countsByDate.get(date) || 0;
      cumulative += newCount;
      totalNewUsers += newCount;

      if (newCount > peakCount) {
        peakCount = newCount;
        peakDay = date;
      }

      return {
        date,
        newUsers: newCount,
        cumulativeUsers: cumulative,
      };
    });

    // 7. Calculate summary statistics
    const avgDailySignups = roundTo(totalNewUsers / days, 2);

    const summary: GrowthSummary = {
      totalNewUsers,
      avgDailySignups,
      peakDay: peakDay || dateRange[0] || '',
      peakCount,
    };

    // 8. Build response
    const growthData: GrowthData = {
      dataPoints,
      summary,
      period,
      granularity,
    };

    // 9. Return response with 5-minute cache
    return successResponse(growthData, 300);
  } catch (error) {
    logger.logError('Growth API error', error);
    return errorResponse('Internal server error', 500);
  }
}
