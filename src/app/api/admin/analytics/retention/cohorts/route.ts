import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  parsePeriodParam,
  calculatePeriodDates,
  getAdminUserIds,
  successResponse,
  errorResponse,
} from '@/app/api/admin/analytics/engagement/_lib/utils';

interface CohortRow {
  cohort_week: string;
  cohort_size: number;
  week_offset: number;
  active_users: number;
  retention_pct: number;
}

interface CohortData {
  cohortWeek: string;
  cohortSize: number;
  weeks: Record<number, { activeUsers: number; retentionPct: number }>;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized'
        ? errorResponse('Unauthorized', 401)
        : errorResponse('Forbidden', 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const period = parsePeriodParam(searchParams);
    const mode = searchParams.get('mode') === 'visitors' ? 'visitors' : 'users';
    const { startDate, endDate } = calculatePeriodDates(period);

    const maxWeeks = 8;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase as any;
    let rows: CohortRow[];

    if (mode === 'users') {
      const adminIds = await getAdminUserIds(supabase);
      const { data, error } = await rpc.rpc('get_user_retention_cohorts', {
        p_start: startDate.toISOString(),
        p_end: endDate.toISOString(),
        p_admin_ids: adminIds,
        p_max_weeks: maxWeeks,
      });
      if (error) throw new Error(error.message);
      rows = (data as CohortRow[]) || [];
    } else {
      const { data, error } = await rpc.rpc('get_visitor_retention_cohorts', {
        p_start: startDate.toISOString(),
        p_end: endDate.toISOString(),
        p_max_weeks: maxWeeks,
      });
      if (error) throw new Error(error.message);
      rows = (data as CohortRow[]) || [];
    }

    // Group by cohort week
    const cohortMap = new Map<string, CohortData>();
    for (const row of rows) {
      if (!cohortMap.has(row.cohort_week)) {
        cohortMap.set(row.cohort_week, {
          cohortWeek: row.cohort_week,
          cohortSize: row.cohort_size,
          weeks: {},
        });
      }
      const cohort = cohortMap.get(row.cohort_week)!;
      cohort.weeks[row.week_offset] = {
        activeUsers: row.active_users,
        retentionPct: row.retention_pct,
      };
    }

    const cohorts = Array.from(cohortMap.values());

    // Compute summary averages
    const avgRetention = (weekOffset: number) => {
      const values = cohorts
        .filter((c) => c.weeks[weekOffset] !== undefined)
        .map((c) => c.weeks[weekOffset].retentionPct);
      if (values.length === 0) return 0;
      return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    };

    return successResponse(
      {
        cohorts,
        summary: {
          avgW0: avgRetention(0),
          avgW1: avgRetention(1),
          avgW4: avgRetention(4),
          totalCohorts: cohorts.length,
        },
        mode,
        period,
      },
      120
    );
  } catch (err) {
    console.error('[retention/cohorts] Error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Internal server error',
      500
    );
  }
}
