/**
 * Conversion Funnel API Route
 *
 * Returns user conversion funnel showing progression from visitors
 * through various engagement stages to high-intent actions.
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
import {
  verifyAdmin,
  parsePeriodParam,
  calculatePeriodDates,
  successResponse,
  errorResponse,
  roundTo,
  safeDivide,
} from '../_lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

type FunnelStageId = 'visitors' | 'searchers' | 'viewers' | 'engagers' | 'high_intent' | 'converted';

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
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<FunnelData>>;
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const { startDate, endDate } = calculatePeriodDates(period);

    // 3. Get all unique sessions in the period (Stage 1: Visitors)
    const { count: visitorCount, error: visitorsError } = await supabase
      .from('user_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    if (visitorsError) {
      logger.error('Funnel visitors query error', { error: visitorsError });
    }

    // 4. Get unique sessions that performed a search (Stage 2: Searchers)
    // Query from dedicated user_searches table
    const { data: searchSessions, error: searchError } = await supabase
      .from('user_searches')
      .select('session_id')
      .gte('searched_at', startDate.toISOString())
      .lte('searched_at', endDate.toISOString());

    if (searchError) {
      logger.error('Funnel search query error', { error: searchError });
    }

    const searchSessionsData = (searchSessions || []) as Array<{ session_id: string }>;
    const uniqueSearchSessions = new Set(searchSessionsData.map(e => e.session_id));
    const searcherCount = uniqueSearchSessions.size;

    // 5. Get unique sessions that viewed a listing (Stage 3: Viewers)
    // Query from dedicated listing_views table
    const { data: viewSessions, error: viewError } = await supabase
      .from('listing_views')
      .select('session_id')
      .gte('viewed_at', startDate.toISOString())
      .lte('viewed_at', endDate.toISOString());

    if (viewError) {
      logger.error('Funnel view query error', { error: viewError });
    }

    const viewSessionsData = (viewSessions || []) as Array<{ session_id: string }>;
    const uniqueViewSessions = new Set(viewSessionsData.map(e => e.session_id));
    const viewerCount = uniqueViewSessions.size;

    // 6. Get unique sessions that favorited (Stage 4: Engagers)
    // We need to get favorites created in the period and correlate with sessions
    const { data: favoriteSessions, error: favoriteError } = await supabase
      .from('activity_events')
      .select('session_id')
      .eq('event_type', 'favorite_add')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (favoriteError) {
      logger.error('Funnel favorite query error', { error: favoriteError });
    }

    const favoriteSessionsData = (favoriteSessions || []) as Array<{ session_id: string }>;
    const uniqueFavoriteSessions = new Set(favoriteSessionsData.map(e => e.session_id));
    const engagerCount = uniqueFavoriteSessions.size;

    // 7. Get unique users that saved a search (Stage 5: High Intent)
    const { count: savedSearchCount, error: savedSearchError } = await supabase
      .from('saved_searches')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (savedSearchError) {
      logger.error('Funnel saved search query error', { error: savedSearchError });
    }

    const highIntentCount = savedSearchCount || 0;

    // 8. Get inquiry events (Stage 6: Converted)
    // Using activity_events with event_type containing 'inquiry' or checking inquiry_history
    const { count: inquiryCount, error: inquiryError } = await supabase
      .from('inquiry_history')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (inquiryError) {
      logger.error('Funnel inquiry query error', { error: inquiryError });
    }

    const convertedCount = inquiryCount || 0;

    // 9. Build funnel stages with conversion and dropoff rates
    const totalVisitors = visitorCount || 0;

    const stageData: Array<{ id: FunnelStageId; label: string; count: number }> = [
      { id: 'visitors', label: 'Visitors', count: totalVisitors },
      { id: 'searchers', label: 'Searched', count: searcherCount },
      { id: 'viewers', label: 'Viewed Listing', count: viewerCount },
      { id: 'engagers', label: 'Favorited', count: engagerCount },
      { id: 'high_intent', label: 'Saved Search', count: highIntentCount },
      { id: 'converted', label: 'Sent Inquiry', count: convertedCount },
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

    // 10. Calculate overall conversion rate (visitors to inquiries)
    const overallConversionRate = totalVisitors > 0
      ? roundTo(safeDivide(convertedCount, totalVisitors) * 100, 2)
      : 0;

    // 11. Build response
    const funnelData: FunnelData = {
      stages,
      overallConversionRate,
      period,
    };

    // 12. Return response with 5-minute cache
    return successResponse(funnelData, 300);
  } catch (error) {
    logger.logError('Funnel API error', error);
    return errorResponse('Internal server error', 500);
  }
}
