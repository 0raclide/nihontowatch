/**
 * Popular Searches API Route
 *
 * Returns aggregated search query data showing the most popular
 * search terms, their frequency, and click-through rates.
 *
 * @route GET /api/admin/analytics/engagement/searches
 *
 * @query period - Time period ('7d'|'30d'|'90d'), default '30d'
 * @query limit - Number of results (1-100), default 20
 *
 * @returns SearchesData with popular terms and totals
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { AnalyticsAPIResponse } from '@/types/analytics';
import {
  verifyAdmin,
  parsePeriodParam,
  parseLimitParam,
  calculatePeriodDates,
  successResponse,
  errorResponse,
  roundTo,
  safeDivide,
  getAdminUserIds,
} from '../_lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface SearchTermData {
  term: string;
  count: number;
  uniqueUsers: number;
  avgResultCount: number;
  clickThroughRate: number;
}

interface SearchesTotals {
  totalSearches: number;
  uniqueSearchers: number;
  avgClickThroughRate: number;
}

interface SearchesData {
  searches: SearchTermData[];
  totals: SearchesTotals;
  period: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize a search query for aggregation.
 * Converts to lowercase, trims whitespace, and removes extra spaces.
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * GET /api/admin/analytics/engagement/searches
 *
 * Returns popular search terms with engagement metrics.
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsAPIResponse<SearchesData>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<SearchesData>>;
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const limit = parseLimitParam(searchParams);
    const { startDate, endDate } = calculatePeriodDates(period);

    // 3. Fetch search data from user_searches table
    // This dedicated table provides cleaner access with direct columns
    const { data: searchEvents, error: searchError } = await supabase
      .from('user_searches')
      .select('query_normalized, result_count, session_id, user_id, clicked_listing_id')
      .gte('searched_at', startDate.toISOString())
      .lte('searched_at', endDate.toISOString())
      .limit(50000); // Cap for performance

    if (searchError) {
      logger.error('Searches query error', { error: searchError });
      return errorResponse('Failed to fetch search data', 500);
    }

    // 4. Aggregate searches by normalized query
    const searchesByTerm = new Map<string, {
      count: number;
      users: Set<string>;
      sessions: Set<string>;
      totalResults: number;
      clicks: number;
    }>();

    let totalSearches = 0;
    const allUsers = new Set<string>();
    let totalClicks = 0;

    type SearchRow = {
      query_normalized: string;
      result_count: number | null;
      session_id: string;
      user_id: string | null;
      clicked_listing_id: number | null;
    };
    // Filter out admin user activity
    const adminIds = await getAdminUserIds(supabase);
    const searchData = ((searchEvents || []) as SearchRow[]).filter(
      s => !s.user_id || !adminIds.includes(s.user_id)
    );

    for (const search of searchData) {
      const normalizedQuery = search.query_normalized;
      if (!normalizedQuery || normalizedQuery.trim() === '') continue;

      totalSearches++;

      // Track unique users
      if (search.user_id) {
        allUsers.add(search.user_id);
      }

      // Get or create aggregation entry
      let termData = searchesByTerm.get(normalizedQuery);
      if (!termData) {
        termData = {
          count: 0,
          users: new Set<string>(),
          sessions: new Set<string>(),
          totalResults: 0,
          clicks: 0,
        };
        searchesByTerm.set(normalizedQuery, termData);
      }

      termData.count++;
      if (search.user_id) {
        termData.users.add(search.user_id);
      }
      if (search.session_id) {
        termData.sessions.add(search.session_id);
      }

      // Track result count - direct column access
      if (typeof search.result_count === 'number') {
        termData.totalResults += search.result_count;
      }

      // Track if a click followed this search - clicked_listing_id is set when user clicks
      if (search.clicked_listing_id !== null) {
        termData.clicks++;
        totalClicks++;
      }
    }

    // 5. Convert to sorted array
    const searchesArray: SearchTermData[] = [];

    for (const [term, data] of searchesByTerm.entries()) {
      const avgResultCount = roundTo(safeDivide(data.totalResults, data.count), 1);
      const clickThroughRate = roundTo(safeDivide(data.clicks, data.count) * 100, 1);

      searchesArray.push({
        term,
        count: data.count,
        uniqueUsers: data.users.size,
        avgResultCount,
        clickThroughRate,
      });
    }

    // Sort by count descending and take top N
    searchesArray.sort((a, b) => b.count - a.count);
    const topSearches = searchesArray.slice(0, limit);

    // 6. Calculate totals
    const avgClickThroughRate = roundTo(safeDivide(totalClicks, totalSearches) * 100, 1);

    const totals: SearchesTotals = {
      totalSearches,
      uniqueSearchers: allUsers.size,
      avgClickThroughRate,
    };

    // 7. Build response
    const searchesData: SearchesData = {
      searches: topSearches,
      totals,
      period,
    };

    // 8. Return response with 5-minute cache
    return successResponse(searchesData, 300);
  } catch (error) {
    logger.logError('Searches API error', error);
    return errorResponse('Internal server error', 500);
  }
}
