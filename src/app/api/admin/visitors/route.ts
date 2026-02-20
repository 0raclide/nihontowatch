import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface VisitorStats {
  // Top metrics - HONEST numbers (from SQL aggregates, no row limit)
  trackedVisitors: number;      // Unique visitor_ids (reliable)
  totalSessions: number;        // Unique session_ids (less reliable)
  uniqueIPs: string[];          // For geo lookup
  totalEvents: number;

  // Tracking coverage
  eventsWithTracking: number;   // Events that have visitor_id
  eventsWithoutTracking: number; // Old events without visitor_id
  trackingStartDate: string | null; // When visitor tracking began

  // Time series for chart
  visitorsByDay: { date: string; visitors: number; sessions: number; events: number }[];

  // Breakdowns
  topEventTypes: { type: string; count: number; percentage: number }[];
  topDealers: { name: string; clicks: number; percentage: number }[];
  topPaths: { path: string; count: number; percentage: number }[];

  // Visitor details (only tracked visitors)
  visitors: {
    visitorId: string;       // Full ID for API calls
    visitorIdShort: string;  // Truncated for display
    ip: string | null;
    events: number;
    firstSeen: string;
    lastSeen: string;
    topEvent: string;
  }[];

  // Real-time
  activeNow: number;

  // Time range
  periodStart: string;
  periodEnd: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use service client to bypass RLS for admin queries
    const serviceClient = createServiceClient();

    // Get time range from query params
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';

    // Calculate date range
    const now = new Date();
    let periodStart: Date;
    switch (range) {
      case '24h':
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const periodStartISO = periodStart.toISOString();
    const periodEndISO = now.toISOString();

    // =========================================================================
    // Run SQL aggregate queries in parallel (no row limit — accurate counts)
    // =========================================================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = serviceClient as any;

    const [aggregateResult, timeseriesResult, topVisitorsResult, uniqueIpsResult, eventTypesResult] =
      await Promise.all([
        // 1. Top-line aggregate stats
        sc.rpc('get_visitor_aggregate_stats', {
          p_start: periodStartISO,
          p_end: periodEndISO,
        }),
        // 2. Time series (visitors/sessions/events per day)
        sc.rpc('get_visitor_timeseries', {
          p_start: periodStartISO,
          p_end: periodEndISO,
        }),
        // 3. Top 50 visitors by event count
        sc.rpc('get_top_visitors', {
          p_start: periodStartISO,
          p_end: periodEndISO,
          p_limit: 50,
        }),
        // 4. Unique IPs for geo lookup
        sc.rpc('get_unique_ips', {
          p_start: periodStartISO,
          p_end: periodEndISO,
        }),
        // 5. Event type breakdown
        sc.rpc('get_event_type_breakdown', {
          p_start: periodStartISO,
          p_end: periodEndISO,
          p_limit: 15,
        }),
      ]);

    // Check for errors
    if (aggregateResult.error) {
      logger.error('Aggregate stats RPC error', { error: aggregateResult.error });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const agg = aggregateResult.data;

    // =========================================================================
    // Fetch recent events for JSONB breakdowns (dealer clicks, paths)
    // These need event_data extraction which can't be done in simple SQL
    // Use a smaller limit since this is only for breakdowns, not counting
    // =========================================================================
    const { data: recentEvents } = await sc
      .from('activity_events')
      .select('event_type, event_data')
      .gte('created_at', periodStartISO)
      .in('event_type', ['external_link_click', 'dealer_click', 'page_view'])
      .order('created_at', { ascending: false })
      .limit(5000);

    // Process JSONB breakdowns from recent events
    const dealerClicks = new Map<string, number>();
    const pathCounts = new Map<string, number>();

    for (const event of recentEvents || []) {
      // Track dealer clicks (both old external_link_click and new dealer_click)
      if ((event.event_type === 'external_link_click' || event.event_type === 'dealer_click')
          && event.event_data?.dealerName) {
        const dealer = event.event_data.dealerName;
        dealerClicks.set(dealer, (dealerClicks.get(dealer) || 0) + 1);
      }

      // Track paths from page_view events
      if (event.event_type === 'page_view' && event.event_data?.path) {
        const path = event.event_data.path;
        pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
      }
    }

    // =========================================================================
    // Build response from RPC results
    // =========================================================================

    // Time series — fill in missing days with zeros
    const timeseriesMap = new Map<string, { visitors: number; sessions: number; events: number }>();
    for (const row of timeseriesResult.data || []) {
      timeseriesMap.set(row.day, {
        visitors: Number(row.visitors),
        sessions: Number(row.sessions),
        events: Number(row.events),
      });
    }

    const visitorsByDay: { date: string; visitors: number; sessions: number; events: number }[] = [];
    const currentDate = new Date(periodStart);
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().slice(0, 10);
      const dayData = timeseriesMap.get(dateKey);
      visitorsByDay.push({
        date: dateKey,
        visitors: dayData?.visitors || 0,
        sessions: dayData?.sessions || 0,
        events: dayData?.events || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Top event types from RPC
    const totalEvents = Number(agg.total_events) || 0;
    const topEventTypes = (eventTypesResult.data || []).map(
      (row: { event_type: string; count: number }) => ({
        type: row.event_type,
        count: Number(row.count),
        percentage: totalEvents > 0 ? (Number(row.count) / totalEvents) * 100 : 0,
      })
    );

    // Top dealers from JSONB extraction
    const totalDealerClicks = Array.from(dealerClicks.values()).reduce((a, b) => a + b, 0);
    const topDealers = Array.from(dealerClicks.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, clicks]) => ({
        name,
        clicks,
        percentage: totalDealerClicks > 0 ? (clicks / totalDealerClicks) * 100 : 0,
      }));

    // Top paths from JSONB extraction
    const totalPathViews = Array.from(pathCounts.values()).reduce((a, b) => a + b, 0);
    const topPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({
        path,
        count,
        percentage: totalPathViews > 0 ? (count / totalPathViews) * 100 : 0,
      }));

    // Visitors list from RPC
    const visitors = (topVisitorsResult.data || []).map(
      (row: { visitor_id: string; ip: string | null; events: number; first_seen: string; last_seen: string; top_event: string }) => ({
        visitorId: row.visitor_id,
        visitorIdShort: row.visitor_id.length > 30
          ? row.visitor_id.slice(0, 30) + '...'
          : row.visitor_id,
        ip: row.ip,
        events: Number(row.events),
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        topEvent: row.top_event,
      })
    );

    // Unique IPs for geo lookup
    const uniqueIPs = (uniqueIpsResult.data || []).map(
      (row: { ip: string }) => row.ip
    );

    const stats: VisitorStats = {
      // Accurate counts from SQL aggregates
      trackedVisitors: Number(agg.tracked_visitors) || 0,
      totalSessions: Number(agg.total_sessions) || 0,
      uniqueIPs,
      totalEvents,

      // Tracking coverage
      eventsWithTracking: Number(agg.events_with_tracking) || 0,
      eventsWithoutTracking: Number(agg.events_without_tracking) || 0,
      trackingStartDate: null, // Not worth computing — all events have tracking now

      // Time series
      visitorsByDay,

      // Breakdowns
      topEventTypes,
      topDealers,
      topPaths,

      // Visitor details
      visitors,

      // Real-time
      activeNow: Number(agg.active_now) || 0,

      // Time range
      periodStart: periodStartISO,
      periodEnd: periodEndISO,
    };

    return NextResponse.json(stats);
  } catch (error) {
    logger.logError('Visitor stats error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
