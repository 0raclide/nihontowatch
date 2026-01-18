import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface VisitorStats {
  // Top metrics
  uniqueVisitors: number;
  totalEvents: number;
  avgEventsPerVisitor: number;
  bounceRate: number; // % of visitors with only 1 event

  // Time series for chart
  visitorsByDay: { date: string; visitors: number; events: number }[];

  // Breakdowns
  topEventTypes: { type: string; count: number; percentage: number }[];
  topDealers: { name: string; clicks: number; percentage: number }[];
  topPaths: { path: string; count: number; percentage: number }[];

  // Visitor details
  visitors: {
    visitorId: string;
    ip: string | null;
    events: number;
    firstSeen: string;
    lastSeen: string;
    topEvent: string;
  }[];

  // Real-time
  activeNow: number;

  // For geo lookup
  uniqueIPs: string[];

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

    // Fetch all events in the period (limit to 10000 for performance)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error } = await (supabase as any)
      .from('activity_events')
      .select('visitor_id, ip_address, event_type, event_data, session_id, created_at')
      .gte('created_at', periodStartISO)
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Process events
    const visitorMap = new Map<string, {
      ip: string | null;
      events: number;
      firstSeen: string;
      lastSeen: string;
      eventTypes: Map<string, number>;
      sessions: Set<string>;
    }>();

    const eventTypeCounts = new Map<string, number>();
    const dealerClicks = new Map<string, number>();
    const pathCounts = new Map<string, number>();
    const eventsByDay = new Map<string, { visitors: Set<string>; events: number }>();
    const ipSet = new Set<string>();

    // Real-time: visitors in last 5 minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const recentVisitors = new Set<string>();

    for (const event of events || []) {
      const visitorId = event.visitor_id || event.session_id || 'unknown';
      const eventType = event.event_type || 'unknown';
      const createdAt = event.created_at;
      const dateKey = createdAt.slice(0, 10); // YYYY-MM-DD

      // Track visitor
      if (!visitorMap.has(visitorId)) {
        visitorMap.set(visitorId, {
          ip: event.ip_address,
          events: 0,
          firstSeen: createdAt,
          lastSeen: createdAt,
          eventTypes: new Map(),
          sessions: new Set(),
        });
      }
      const visitor = visitorMap.get(visitorId)!;
      visitor.events++;
      visitor.lastSeen = createdAt > visitor.lastSeen ? createdAt : visitor.lastSeen;
      visitor.firstSeen = createdAt < visitor.firstSeen ? createdAt : visitor.firstSeen;
      visitor.eventTypes.set(eventType, (visitor.eventTypes.get(eventType) || 0) + 1);
      if (event.session_id) visitor.sessions.add(event.session_id);
      if (event.ip_address && !visitor.ip) visitor.ip = event.ip_address;

      // Track event types
      eventTypeCounts.set(eventType, (eventTypeCounts.get(eventType) || 0) + 1);

      // Track dealer clicks
      if (eventType === 'external_link_click' && event.event_data?.dealerName) {
        const dealer = event.event_data.dealerName;
        dealerClicks.set(dealer, (dealerClicks.get(dealer) || 0) + 1);
      }

      // Track paths from page_view events
      if (eventType === 'page_view' && event.event_data?.path) {
        const path = event.event_data.path;
        pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
      }

      // Track by day
      if (!eventsByDay.has(dateKey)) {
        eventsByDay.set(dateKey, { visitors: new Set(), events: 0 });
      }
      const dayData = eventsByDay.get(dateKey)!;
      dayData.visitors.add(visitorId);
      dayData.events++;

      // Track IPs
      if (event.ip_address) {
        ipSet.add(event.ip_address);
      }

      // Real-time tracking
      if (createdAt >= fiveMinutesAgo) {
        recentVisitors.add(visitorId);
      }
    }

    // Calculate metrics
    const uniqueVisitors = visitorMap.size;
    const totalEvents = events?.length || 0;
    const avgEventsPerVisitor = uniqueVisitors > 0 ? totalEvents / uniqueVisitors : 0;

    // Bounce rate: visitors with only 1 session
    let singleSessionVisitors = 0;
    visitorMap.forEach((v) => {
      if (v.sessions.size <= 1 && v.events <= 2) singleSessionVisitors++;
    });
    const bounceRate = uniqueVisitors > 0 ? (singleSessionVisitors / uniqueVisitors) * 100 : 0;

    // Build time series (fill in missing days)
    const visitorsByDay: { date: string; visitors: number; events: number }[] = [];
    const currentDate = new Date(periodStart);
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().slice(0, 10);
      const dayData = eventsByDay.get(dateKey);
      visitorsByDay.push({
        date: dateKey,
        visitors: dayData?.visitors.size || 0,
        events: dayData?.events || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Top event types
    const topEventTypes = Array.from(eventTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalEvents > 0 ? (count / totalEvents) * 100 : 0,
      }));

    // Top dealers
    const totalClicks = Array.from(dealerClicks.values()).reduce((a, b) => a + b, 0);
    const topDealers = Array.from(dealerClicks.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, clicks]) => ({
        name,
        clicks,
        percentage: totalClicks > 0 ? (clicks / totalClicks) * 100 : 0,
      }));

    // Top paths
    const totalPathViews = Array.from(pathCounts.values()).reduce((a, b) => a + b, 0);
    const topPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({
        path,
        count,
        percentage: totalPathViews > 0 ? (count / totalPathViews) * 100 : 0,
      }));

    // Visitor list (top 50 by events)
    const visitors = Array.from(visitorMap.entries())
      .sort((a, b) => b[1].events - a[1].events)
      .slice(0, 50)
      .map(([visitorId, data]) => {
        // Find top event type for this visitor
        let topEvent = 'unknown';
        let maxCount = 0;
        data.eventTypes.forEach((count, type) => {
          if (count > maxCount) {
            maxCount = count;
            topEvent = type;
          }
        });

        return {
          visitorId: visitorId.length > 30 ? visitorId.slice(0, 30) + '...' : visitorId,
          ip: data.ip,
          events: data.events,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          topEvent,
        };
      });

    const stats: VisitorStats = {
      uniqueVisitors,
      totalEvents,
      avgEventsPerVisitor: Math.round(avgEventsPerVisitor * 10) / 10,
      bounceRate: Math.round(bounceRate),
      visitorsByDay,
      topEventTypes,
      topDealers,
      topPaths,
      visitors,
      activeNow: recentVisitors.size,
      uniqueIPs: Array.from(ipSet),
      periodStart: periodStartISO,
      periodEnd: periodEndISO,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Visitor stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
