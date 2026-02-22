/**
 * Activity Chart API Route
 *
 * Returns daily activity breakdown for the admin dashboard chart.
 * Shows views, searches, and favorites over the specified period.
 *
 * @route GET /api/admin/stats/activity-chart
 *
 * @query days - Number of days to include (default 7, max 30)
 *
 * @returns ActivityChartResponse with daily data points and totals
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from '@/lib/api/responses';
import { fetchAllRows } from '@/app/api/admin/analytics/engagement/_lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface ActivityDataPoint {
  date: string;      // "2026-01-26"
  dayLabel: string;  // "Sun"
  views: number;
  searches: number;
  favorites: number;
}

interface ActivityChartResponse {
  dataPoints: ActivityDataPoint[];
  totals: {
    views: number;
    searches: number;
    favorites: number;
  };
  period: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return DAY_LABELS[date.getUTCDay()];
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function generateDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    dates.push(formatDate(date));
  }

  return dates;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    // Parse days parameter (default 7, max 30)
    const searchParams = request.nextUrl.searchParams;
    const daysParam = parseInt(searchParams.get('days') || '7', 10);
    const days = isNaN(daysParam) ? 7 : Math.min(Math.max(daysParam, 1), 30);

    // Calculate start date
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);
    const startDateStr = startDate.toISOString();

    // Use service client for listing_views and user_searches (bypass RLS for anonymous data)
    const serviceSupabase = createServiceClient();

    // Query all three data sources in parallel
    // Use fetchAllRows to paginate past PostgREST max_rows (default 1000)
    const [viewsResult, searchesResult, favoritesResult] = await Promise.all([
      // Views by day from listing_views (includes quickview_open + listing_detail_view)
      fetchAllRows<{ viewed_at: string }>(
        serviceSupabase
          .from('listing_views')
          .select('viewed_at')
          .gte('viewed_at', startDateStr)
      ),

      // Searches by day from user_searches
      fetchAllRows<{ searched_at: string }>(
        serviceSupabase
          .from('user_searches')
          .select('searched_at')
          .gte('searched_at', startDateStr)
      ),

      // Favorites by day from user_favorites
      fetchAllRows<{ created_at: string }>(
        supabase
          .from('user_favorites')
          .select('created_at')
          .gte('created_at', startDateStr)
      ),
    ]);

    // Aggregate views by date
    const viewsByDate: Record<string, number> = {};
    for (const row of viewsResult.data) {
      const date = row.viewed_at.split('T')[0];
      viewsByDate[date] = (viewsByDate[date] || 0) + 1;
    }

    // Aggregate searches by date
    const searchesByDate: Record<string, number> = {};
    for (const row of searchesResult.data) {
      const date = row.searched_at.split('T')[0];
      searchesByDate[date] = (searchesByDate[date] || 0) + 1;
    }

    // Aggregate favorites by date
    const favoritesByDate: Record<string, number> = {};
    for (const row of favoritesResult.data) {
      const date = row.created_at.split('T')[0];
      favoritesByDate[date] = (favoritesByDate[date] || 0) + 1;
    }

    // Build data points for all dates in range (fill missing with zeros)
    const dateRange = generateDateRange(days);
    let totalViews = 0;
    let totalSearches = 0;
    let totalFavorites = 0;

    const dataPoints: ActivityDataPoint[] = dateRange.map(date => {
      const views = viewsByDate[date] || 0;
      const searches = searchesByDate[date] || 0;
      const favorites = favoritesByDate[date] || 0;

      totalViews += views;
      totalSearches += searches;
      totalFavorites += favorites;

      return {
        date,
        dayLabel: getDayLabel(date),
        views,
        searches,
        favorites,
      };
    });

    const response: ActivityChartResponse = {
      dataPoints,
      totals: {
        views: totalViews,
        searches: totalSearches,
        favorites: totalFavorites,
      },
      period: `${days}d`,
    };

    // Return with 5-minute cache
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    logger.logError('Activity chart API error', error);
    return apiServerError();
  }
}
