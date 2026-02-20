/**
 * Conversion Funnel API Route
 *
 * Returns user conversion funnel showing progression from visitors
 * through various engagement stages to high-intent actions.
 *
 * All stages are normalized to UNIQUE VISITORS (session-based) for
 * consistent measurement across the funnel.
 *
 * Stages:
 *   1. Visitors      — unique sessions in period
 *   2. Searched       — unique sessions that performed a search
 *   3. Viewed Listing — unique sessions that opened a listing detail
 *   4. Signed Up      — unique users who created an account
 *   5. Favorited      — unique users who favorited a listing (from user_favorites table)
 *   6. Saved Search   — unique users who saved a search/alert
 *   7. Clicked to Dealer — unique visitors who clicked through to a dealer website
 *   8. Generated Draft — unique users who generated an inquiry email draft
 *
 * @route GET /api/admin/analytics/engagement/funnel
 *
 * @query period - Time period ('7d'|'30d'|'90d'), default '30d'
 *
 * @returns FunnelData with stage progression and conversion rates
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { AnalyticsAPIResponse } from '@/types/analytics';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  parsePeriodParam,
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

type FunnelStageId =
  | 'visitors'
  | 'searchers'
  | 'viewers'
  | 'signed_up'
  | 'engagers'
  | 'high_intent'
  | 'dealer_click'
  | 'converted';

interface FunnelStage {
  stage: FunnelStageId;
  label: string;
  count: number;
  conversionRate: number;  // % of visitors at this stage
  dropoffRate: number;     // % that dropped off from previous stage
}

interface FunnelData {
  stages: FunnelStage[];
  overallConversionRate: number;
  period: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Count unique non-null values in a field across rows, excluding admin users */
function countUnique<T extends Record<string, unknown>>(
  rows: T[],
  field: keyof T,
  isAdminUser: (userId: string | null) => boolean,
  userIdField: keyof T = 'user_id' as keyof T,
): number {
  const unique = new Set<unknown>();
  for (const row of rows) {
    if (isAdminUser(row[userIdField] as string | null)) continue;
    const val = row[field];
    if (val != null) unique.add(val);
  }
  return unique.size;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * GET /api/admin/analytics/engagement/funnel
 *
 * Returns conversion funnel data with stage-by-stage metrics.
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsAPIResponse<FunnelData>>> {
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
    const { startDate, endDate } = calculatePeriodDates(period);
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    // Get admin user IDs to filter from analytics
    const adminIds = await getAdminUserIds(supabase);
    const isAdminUser = (userId: string | null) => userId != null && adminIds.includes(userId);

    // 3. Run all queries in parallel for performance
    const [
      visitorsResult,
      searchResult,
      viewResult,
      signupResult,
      favoritesResult,
      savedSearchResult,
      dealerClickResult,
      inquiryResult,
    ] = await Promise.all([
      // Stage 1: Visitors — unique sessions
      supabase
        .from('user_sessions')
        .select('id, user_id')
        .gte('started_at', start)
        .lte('started_at', end)
        .limit(100000),

      // Stage 2: Searched — unique sessions that searched
      supabase
        .from('user_searches')
        .select('session_id, user_id')
        .gte('searched_at', start)
        .lte('searched_at', end),

      // Stage 3: Viewed listing — unique sessions that viewed a listing
      supabase
        .from('listing_views')
        .select('session_id, user_id')
        .gte('viewed_at', start)
        .lte('viewed_at', end),

      // Stage 4: Signed up — unique users who created accounts
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end),

      // Stage 5: Favorited — from user_favorites table (NOT activity_events)
      supabase
        .from('user_favorites')
        .select('user_id')
        .gte('created_at', start)
        .lte('created_at', end),

      // Stage 6: Saved search — unique users who created saved searches
      supabase
        .from('saved_searches')
        .select('user_id')
        .gte('created_at', start)
        .lte('created_at', end),

      // Stage 7: Dealer click-through — unique visitors who clicked to dealer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('dealer_clicks') as any)
        .select('visitor_id, session_id')
        .gte('created_at', start)
        .lte('created_at', end) as ReturnType<ReturnType<typeof supabase.from>['select']>,

      // Stage 8: Generated draft — unique users who generated inquiry drafts
      supabase
        .from('inquiry_history')
        .select('user_id')
        .gte('created_at', start)
        .lte('created_at', end),
    ]);

    // Log any query errors
    if (visitorsResult.error) logger.error('Funnel visitors query error', { error: visitorsResult.error });
    if (searchResult.error) logger.error('Funnel search query error', { error: searchResult.error });
    if (viewResult.error) logger.error('Funnel view query error', { error: viewResult.error });
    if (signupResult.error) logger.error('Funnel signup query error', { error: signupResult.error });
    if (favoritesResult.error) logger.error('Funnel favorites query error', { error: favoritesResult.error });
    if (savedSearchResult.error) logger.error('Funnel saved search query error', { error: savedSearchResult.error });
    if (dealerClickResult.error) logger.error('Funnel dealer click query error', { error: dealerClickResult.error });
    if (inquiryResult.error) logger.error('Funnel inquiry query error', { error: inquiryResult.error });

    // 4. Compute unique counts per stage

    // Stage 1: Unique sessions (excluding admin)
    type SessionRow = { id: string; user_id: string | null };
    const visitorRows = (visitorsResult.data || []) as SessionRow[];
    const totalVisitors = visitorRows.filter(s => !isAdminUser(s.user_id)).length;

    // Stage 2: Unique sessions that searched
    type SearchRow = { session_id: string; user_id: string | null };
    const searchRows = (searchResult.data || []) as SearchRow[];
    const searcherCount = countUnique(searchRows, 'session_id', isAdminUser);

    // Stage 3: Unique sessions that viewed listings
    type ViewRow = { session_id: string; user_id: string | null };
    const viewRows = (viewResult.data || []) as ViewRow[];
    const viewerCount = countUnique(viewRows, 'session_id', isAdminUser);

    // Stage 4: Users who signed up
    const signedUpCount = signupResult.count || 0;

    // Stage 5: Unique users who favorited (from user_favorites, NOT activity_events)
    type FavoriteRow = { user_id: string };
    const favoriteRows = (favoritesResult.data || []) as FavoriteRow[];
    const favoriteUserIds = new Set(favoriteRows.map(r => r.user_id));
    // Filter out admin users
    for (const id of favoriteUserIds) {
      if (isAdminUser(id)) favoriteUserIds.delete(id);
    }
    const engagerCount = favoriteUserIds.size;

    // Stage 6: Unique users who saved a search
    type SavedSearchRow = { user_id: string };
    const savedSearchRows = (savedSearchResult.data || []) as SavedSearchRow[];
    const savedSearchUserIds = new Set(savedSearchRows.map(r => r.user_id));
    for (const id of savedSearchUserIds) {
      if (isAdminUser(id)) savedSearchUserIds.delete(id);
    }
    const highIntentCount = savedSearchUserIds.size;

    // Stage 7: Unique visitors who clicked through to dealer website
    type DealerClickRow = { visitor_id: string | null; session_id: string | null };
    const dealerClickRows = (dealerClickResult.data || []) as DealerClickRow[];
    // dealer_clicks doesn't have user_id, use visitor_id for uniqueness
    const dealerClickVisitorIds = new Set<string>();
    for (const row of dealerClickRows) {
      if (row.visitor_id) dealerClickVisitorIds.add(row.visitor_id);
      else if (row.session_id) dealerClickVisitorIds.add(row.session_id);
    }
    const dealerClickCount = dealerClickVisitorIds.size;

    // Stage 8: Unique users who generated inquiry drafts
    type InquiryRow = { user_id: string };
    const inquiryRows = (inquiryResult.data || []) as InquiryRow[];
    const inquiryUserIds = new Set(inquiryRows.map(r => r.user_id));
    for (const id of inquiryUserIds) {
      if (isAdminUser(id)) inquiryUserIds.delete(id);
    }
    const draftCount = inquiryUserIds.size;

    // 5. Build funnel stages with conversion and dropoff rates
    const stageData: Array<{ id: FunnelStageId; label: string; count: number }> = [
      { id: 'visitors', label: 'Visitors', count: totalVisitors },
      { id: 'searchers', label: 'Searched', count: searcherCount },
      { id: 'viewers', label: 'Viewed Listing', count: viewerCount },
      { id: 'signed_up', label: 'Signed Up', count: signedUpCount },
      { id: 'engagers', label: 'Favorited', count: engagerCount },
      { id: 'high_intent', label: 'Saved Search', count: highIntentCount },
      { id: 'dealer_click', label: 'Clicked to Dealer', count: dealerClickCount },
      { id: 'converted', label: 'Generated Draft', count: draftCount },
    ];

    const stages: FunnelStage[] = stageData.map((stage, index) => {
      const conversionRate = totalVisitors > 0
        ? roundTo(safeDivide(stage.count, totalVisitors) * 100, 1)
        : (index === 0 ? 100 : 0);

      let dropoffRate = 0;
      if (index > 0) {
        const previousCount = stageData[index - 1].count;
        if (previousCount > 0) {
          const retained = Math.min(stage.count, previousCount);
          dropoffRate = roundTo((1 - safeDivide(retained, previousCount)) * 100, 1);
        }
      }

      return {
        stage: stage.id,
        label: stage.label,
        count: stage.count,
        conversionRate,
        dropoffRate,
      };
    });

    // 6. Calculate overall conversion rate (visitors to draft generation)
    const overallConversionRate = totalVisitors > 0
      ? roundTo(safeDivide(draftCount, totalVisitors) * 100, 2)
      : 0;

    // 7. Build response
    const funnelData: FunnelData = {
      stages,
      overallConversionRate,
      period,
    };

    // 8. Return response with 5-minute cache
    return successResponse(funnelData, 300);
  } catch (error) {
    logger.logError('Funnel API error', error);
    return errorResponse('Internal server error', 500);
  }
}
