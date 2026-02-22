/**
 * Session Duration Distribution API Route
 *
 * Returns bucketed session duration distribution with statistics.
 * Used to visualize how long users spend per session.
 *
 * @route GET /api/admin/analytics/engagement/sessions
 *
 * @query period - Time period ('7d'|'30d'|'90d'), default '30d'
 *
 * @returns SessionDistributionData with buckets and statistics
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  parsePeriodParam,
  calculatePeriodDates,
  successResponse,
  errorResponse,
  roundTo,
  getAdminUserIds,
} from '../_lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface SessionBucket {
  label: string;
  rangeStartMs: number;
  rangeEndMs: number;
  count: number;
  percentage: number;
  cumulativePercentage: number;
}

interface SessionStatistics {
  median: number;
  mean: number;
  p25: number;
  p75: number;
  totalSessions: number;
  sessionsWithData: number;
}

interface SessionDistributionResponse {
  buckets: SessionBucket[];
  statistics: SessionStatistics;
  period: string;
}

// =============================================================================
// BUCKET DEFINITIONS
// =============================================================================

const DURATION_BUCKETS = [
  { label: '0-10s', startMs: 0, endMs: 10_000 },
  { label: '10-30s', startMs: 10_000, endMs: 30_000 },
  { label: '30s-1m', startMs: 30_000, endMs: 60_000 },
  { label: '1-2m', startMs: 60_000, endMs: 120_000 },
  { label: '2-5m', startMs: 120_000, endMs: 300_000 },
  { label: '5-10m', startMs: 300_000, endMs: 600_000 },
  { label: '10-20m', startMs: 600_000, endMs: 1_200_000 },
  { label: '20-30m', startMs: 1_200_000, endMs: 1_800_000 },
  { label: '30-60m', startMs: 1_800_000, endMs: 3_600_000 },
  { label: '60m+', startMs: 3_600_000, endMs: Infinity },
];

// =============================================================================
// HELPERS
// =============================================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export const dynamic = 'force-dynamic';

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return errorResponse(
        authResult.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden',
        authResult.error === 'unauthorized' ? 401 : 403
      );
    }

    // Parse parameters
    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const { startDate, endDate } = calculatePeriodDates(period);

    // Get admin user IDs for filtering
    const adminIds = await getAdminUserIds(supabase);

    // Fetch all sessions with duration data in the period
    const query = supabase
      .from('user_sessions')
      .select('total_duration_ms, user_id')
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .not('total_duration_ms', 'is', null)
      .limit(100000);

    const { data: sessions, error } = await query;

    if (error) {
      logger.error('Failed to fetch session data', { error: error.message });
      return errorResponse('Failed to fetch session data', 500);
    }

    // Filter out admin sessions
    const filteredSessions = (sessions || []).filter(
      (s: { user_id: string | null }) => !s.user_id || !adminIds.includes(s.user_id)
    );

    // Extract durations
    const durations = filteredSessions
      .map((s: { total_duration_ms: number }) => s.total_duration_ms)
      .filter((d: number) => d >= 0)
      .sort((a: number, b: number) => a - b);

    const totalSessions = filteredSessions.length;
    const sessionsWithData = durations.length;

    // Build buckets
    const bucketCounts = DURATION_BUCKETS.map((def) => ({
      ...def,
      count: durations.filter(
        (d: number) => d >= def.startMs && d < def.endMs
      ).length,
    }));

    let cumulative = 0;
    const buckets: SessionBucket[] = bucketCounts.map((b) => {
      const pct = sessionsWithData > 0 ? (b.count / sessionsWithData) * 100 : 0;
      cumulative += pct;
      return {
        label: b.label,
        rangeStartMs: b.startMs,
        rangeEndMs: b.endMs,
        count: b.count,
        percentage: roundTo(pct, 1),
        cumulativePercentage: roundTo(cumulative, 1),
      };
    });

    // Compute statistics
    const mean =
      sessionsWithData > 0
        ? durations.reduce((sum: number, d: number) => sum + d, 0) / sessionsWithData
        : 0;

    const statistics: SessionStatistics = {
      median: roundTo(percentile(durations, 50) / 1000, 1),
      mean: roundTo(mean / 1000, 1),
      p25: roundTo(percentile(durations, 25) / 1000, 1),
      p75: roundTo(percentile(durations, 75) / 1000, 1),
      totalSessions,
      sessionsWithData,
    };

    const responseData: SessionDistributionResponse = {
      buckets,
      statistics,
      period,
    };

    return successResponse(responseData, 60);
  } catch (err) {
    logger.error('Session distribution API error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return errorResponse('Internal server error', 500);
  }
}
