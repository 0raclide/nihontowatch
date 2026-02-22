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

interface SegmentDeviceRow {
  segment: string;
  device_type: string;
  visitor_count: number;
  avg_events: number;
  avg_sessions: number;
  top_event_type: string;
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
    const period = parsePeriodParam(searchParams, '30d');
    const { startDate, endDate } = calculatePeriodDates(period);
    const adminIds = await getAdminUserIds(supabase);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase as any;

    // Single RPC returns both segment stats and device breakdown
    const { data, error } = await rpc.rpc('get_visitor_segments_with_devices', {
      p_start: startDate.toISOString(),
      p_end: endDate.toISOString(),
      p_admin_ids: adminIds,
    });

    if (error) throw new Error(error.message);

    const rows = (data as SegmentDeviceRow[]) || [];

    // Aggregate rows into segment-level stats (sum across device types)
    const segmentMap = new Map<
      string,
      { visitorCount: number; totalEvents: number; totalSessions: number; topEventType: string; eventEntries: number }
    >();

    for (const row of rows) {
      const existing = segmentMap.get(row.segment);
      if (existing) {
        existing.visitorCount += row.visitor_count;
        existing.totalEvents += row.avg_events * row.visitor_count;
        existing.totalSessions += row.avg_sessions * row.visitor_count;
        existing.eventEntries += row.visitor_count;
      } else {
        segmentMap.set(row.segment, {
          visitorCount: row.visitor_count,
          totalEvents: row.avg_events * row.visitor_count,
          totalSessions: row.avg_sessions * row.visitor_count,
          topEventType: row.top_event_type,
          eventEntries: row.visitor_count,
        });
      }
    }

    const totalVisitors = Array.from(segmentMap.values()).reduce(
      (sum, s) => sum + s.visitorCount,
      0
    );

    const segments = Array.from(segmentMap.entries()).map(([segment, s]) => ({
      segment,
      visitorCount: s.visitorCount,
      percentage:
        totalVisitors > 0
          ? Math.round((s.visitorCount / totalVisitors) * 1000) / 10
          : 0,
      avgEvents: Math.round((s.totalEvents / s.eventEntries) * 10) / 10,
      avgSessions: Math.round((s.totalSessions / s.eventEntries) * 10) / 10,
      topEventType: s.topEventType,
    }));

    // Group device data by segment
    const deviceBreakdown: Record<
      string,
      { mobile: number; desktop: number; unknown: number }
    > = {};
    for (const row of rows) {
      if (!deviceBreakdown[row.segment]) {
        deviceBreakdown[row.segment] = { mobile: 0, desktop: 0, unknown: 0 };
      }
      const key = row.device_type as 'mobile' | 'desktop' | 'unknown';
      deviceBreakdown[row.segment][key] = row.visitor_count;
    }

    return successResponse(
      {
        segments,
        deviceBreakdown,
        period,
      },
      120
    );
  } catch (err) {
    console.error('[retention/segments] Error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Internal server error',
      500
    );
  }
}
