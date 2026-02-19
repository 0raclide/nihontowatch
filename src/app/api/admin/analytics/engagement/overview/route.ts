/**
 * Engagement Overview API Route
 *
 * Returns high-level user engagement statistics including user counts,
 * session metrics, and engagement totals with period comparisons.
 *
 * @route GET /api/admin/analytics/engagement/overview
 *
 * @query period - Time period ('7d'|'30d'|'90d'), default '30d'
 *
 * @returns EngagementOverview with users, sessions, and engagement metrics
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { AnalyticsAPIResponse } from '@/types/analytics';
import {
  verifyAdmin,
  parsePeriodParam,
  calculatePeriodDates,
  getStartOfToday,
  successResponse,
  errorResponse,
  percentChange,
  roundTo,
  safeDivide,
  getAdminUserIds,
} from '../_lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface UserMetrics {
  total: number;
  newInPeriod: number;
  newPrevPeriod: number;
  changePercent: number;
  activeToday: number;
  activeInPeriod: number;
}

interface SessionMetrics {
  total: number;
  avgDurationSeconds: number;
  avgPageViews: number;
  bounceRate: number;
  totalPrevPeriod: number;
  changePercent: number;
}

interface EngagementMetrics {
  totalViews: number;
  totalSearches: number;
  totalFavorites: number;
  viewsPrevPeriod: number;
  searchesPrevPeriod: number;
  favoritesPrevPeriod: number;
}

interface EngagementOverview {
  users: UserMetrics;
  sessions: SessionMetrics;
  engagement: EngagementMetrics;
  asOf: string;
  period: string;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * GET /api/admin/analytics/engagement/overview
 *
 * Returns comprehensive engagement overview statistics.
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsAPIResponse<EngagementOverview>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<EngagementOverview>>;
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const { startDate, endDate, previousStartDate, previousEndDate } = calculatePeriodDates(period);
    const todayStart = getStartOfToday();

    // 3. Query user metrics
    const [
      totalUsersResult,
      newUsersCurrentResult,
      newUsersPreviousResult,
      activeTodayResult,
      activeInPeriodResult,
    ] = await Promise.all([
      // Total users (all time)
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),

      // New users in current period
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),

      // New users in previous period
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString()),

      // Active users today (by last_visit_at)
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('last_visit_at', todayStart.toISOString()),

      // Active users in period (by last_visit_at)
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('last_visit_at', startDate.toISOString())
        .lte('last_visit_at', endDate.toISOString()),
    ]);

    // Get admin user IDs to filter from analytics
    const adminIds = await getAdminUserIds(supabase);
    const isAdminUser = (userId: string | null) => userId != null && adminIds.includes(userId);

    // 4. Query session metrics (include user_id for admin filtering)
    const [
      sessionsCurrentResult,
      sessionsPreviousResult,
      sessionStatsResult,
    ] = await Promise.all([
      // Sessions in current period
      supabase
        .from('user_sessions')
        .select('id, user_id')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())
        .limit(50000),

      // Sessions in previous period
      supabase
        .from('user_sessions')
        .select('id, user_id')
        .gte('started_at', previousStartDate.toISOString())
        .lte('started_at', previousEndDate.toISOString())
        .limit(50000),

      // Session stats for current period (duration, page views)
      supabase
        .from('user_sessions')
        .select('total_duration_ms, page_views, user_id')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())
        .limit(10000),
    ]);

    // Filter admin sessions
    const sessionsCurrentCount = ((sessionsCurrentResult.data || []) as Array<{ id: string; user_id: string | null }>)
      .filter(s => !isAdminUser(s.user_id)).length;
    const sessionsPreviousCount = ((sessionsPreviousResult.data || []) as Array<{ id: string; user_id: string | null }>)
      .filter(s => !isAdminUser(s.user_id)).length;

    // 5. Query engagement metrics from dedicated tracking tables
    // listing_views and user_searches provide optimized analytics queries
    const [
      viewsCurrentResult,
      viewsPreviousResult,
      searchesCurrentResult,
      searchesPreviousResult,
    ] = await Promise.all([
      // Views in current period - from listing_views table
      supabase
        .from('listing_views')
        .select('id, user_id')
        .gte('viewed_at', startDate.toISOString())
        .lte('viewed_at', endDate.toISOString())
        .limit(50000),

      // Views in previous period
      supabase
        .from('listing_views')
        .select('id, user_id')
        .gte('viewed_at', previousStartDate.toISOString())
        .lte('viewed_at', previousEndDate.toISOString())
        .limit(50000),

      // Searches in current period - from user_searches table
      supabase
        .from('user_searches')
        .select('id, user_id')
        .gte('searched_at', startDate.toISOString())
        .lte('searched_at', endDate.toISOString())
        .limit(50000),

      // Searches in previous period
      supabase
        .from('user_searches')
        .select('id, user_id')
        .gte('searched_at', previousStartDate.toISOString())
        .lte('searched_at', previousEndDate.toISOString())
        .limit(50000),
    ]);

    // Filter admin activity from engagement counts
    type IdRow = { id: string; user_id: string | null };
    const viewsCurrentCount = ((viewsCurrentResult.data || []) as IdRow[])
      .filter(v => !isAdminUser(v.user_id)).length;
    const viewsPreviousCount = ((viewsPreviousResult.data || []) as IdRow[])
      .filter(v => !isAdminUser(v.user_id)).length;
    const searchesCurrentCount = ((searchesCurrentResult.data || []) as IdRow[])
      .filter(s => !isAdminUser(s.user_id)).length;
    const searchesPreviousCount = ((searchesPreviousResult.data || []) as IdRow[])
      .filter(s => !isAdminUser(s.user_id)).length;

    // 6. Query favorites
    const [
      favoritesCurrentResult,
      favoritesPreviousResult,
    ] = await Promise.all([
      // Favorites in current period
      supabase
        .from('user_favorites')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),

      // Favorites in previous period
      supabase
        .from('user_favorites')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString()),
    ]);

    // 7. Calculate session statistics (filtered to exclude admin sessions)
    const sessionsData = ((sessionStatsResult.data || []) as Array<{ total_duration_ms: number | null; page_views: number | null; user_id: string | null }>)
      .filter(s => !isAdminUser(s.user_id));
    let totalDurationMs = 0;
    let totalPageViews = 0;
    let bounceCount = 0;

    for (const session of sessionsData) {
      totalDurationMs += session.total_duration_ms || 0;
      totalPageViews += session.page_views || 0;
      // A bounce is a session with only 1 page view
      if ((session.page_views || 0) <= 1) {
        bounceCount++;
      }
    }

    const sessionCount = sessionsData.length;
    const avgDurationSeconds = roundTo(safeDivide(totalDurationMs, sessionCount) / 1000, 1);
    const avgPageViews = roundTo(safeDivide(totalPageViews, sessionCount), 1);
    const bounceRate = roundTo(safeDivide(bounceCount, sessionCount) * 100, 1);

    // 8. Calculate change percentages
    const newUsersChange = percentChange(
      newUsersPreviousResult.count || 0,
      newUsersCurrentResult.count || 0
    );

    const sessionsChange = percentChange(
      sessionsPreviousCount,
      sessionsCurrentCount
    );

    // 9. Build response
    const overview: EngagementOverview = {
      users: {
        total: totalUsersResult.count || 0,
        newInPeriod: newUsersCurrentResult.count || 0,
        newPrevPeriod: newUsersPreviousResult.count || 0,
        changePercent: roundTo(newUsersChange, 1),
        activeToday: activeTodayResult.count || 0,
        activeInPeriod: activeInPeriodResult.count || 0,
      },
      sessions: {
        total: sessionsCurrentCount,
        avgDurationSeconds,
        avgPageViews,
        bounceRate,
        totalPrevPeriod: sessionsPreviousCount,
        changePercent: roundTo(sessionsChange, 1),
      },
      engagement: {
        totalViews: viewsCurrentCount,
        totalSearches: searchesCurrentCount,
        totalFavorites: favoritesCurrentResult.count || 0,
        viewsPrevPeriod: viewsPreviousCount,
        searchesPrevPeriod: searchesPreviousCount,
        favoritesPrevPeriod: favoritesPreviousResult.count || 0,
      },
      asOf: new Date().toISOString(),
      period,
    };

    // 10. Return response with 60-second cache
    return successResponse(overview, 60);
  } catch (error) {
    logger.logError('Engagement overview API error', error);
    return errorResponse('Internal server error', 500);
  }
}
