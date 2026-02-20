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
import { verifyAdmin } from '@/lib/admin/auth';
import {
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
    if (!authResult.isAdmin) {
      return errorResponse(authResult.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden',
        authResult.error === 'unauthorized' ? 401 : 403);
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const limit = parseLimitParam(searchParams);
    const { startDate, endDate } = calculatePeriodDates(period);

    // 3. Get admin user IDs for filtering
    const adminIds = await getAdminUserIds(supabase);

    // 4. Fetch search data and totals via RPC (SQL aggregation, no row limit)
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc as any;
    const [topSearchesResult, totalsResult] = await Promise.all([
      rpc('get_top_searches', {
        p_start: startISO,
        p_end: endISO,
        p_admin_ids: adminIds,
        p_limit: limit,
      }),
      rpc('get_search_totals', {
        p_start: startISO,
        p_end: endISO,
        p_admin_ids: adminIds,
      }),
    ]);

    if (topSearchesResult.error) {
      logger.error('Top searches RPC error', { error: topSearchesResult.error });
      return errorResponse('Failed to fetch search data', 500);
    }

    // 5. Transform RPC results
    type TopSearchRow = {
      query_normalized: string;
      search_count: number;
      unique_users: number;
      avg_results: number | null;
      has_click: number;
    };

    const topSearches: SearchTermData[] = ((topSearchesResult.data || []) as TopSearchRow[]).map(row => ({
      term: row.query_normalized,
      count: Number(row.search_count),
      uniqueUsers: Number(row.unique_users),
      avgResultCount: roundTo(Number(row.avg_results || 0), 1),
      clickThroughRate: Number(row.search_count) > 0
        ? roundTo(safeDivide(Number(row.has_click), Number(row.search_count)) * 100, 1)
        : 0,
    }));

    // 6. Calculate totals
    type TotalsRow = { total_searches: number; unique_searchers: number; total_clicks: number };
    const totalsRow = ((totalsResult.data || []) as TotalsRow[])[0] || { total_searches: 0, unique_searchers: 0, total_clicks: 0 };
    const totalSearches = Number(totalsRow.total_searches);
    const totalClicks = Number(totalsRow.total_clicks);
    const avgClickThroughRate = roundTo(safeDivide(totalClicks, totalSearches) * 100, 1);

    const totals: SearchesTotals = {
      totalSearches,
      uniqueSearchers: Number(totalsRow.unique_searchers),
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
