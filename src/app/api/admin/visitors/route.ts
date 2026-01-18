import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface VisitorStats {
  // Top metrics - HONEST numbers
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
    visitorId: string;
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

    // Process events - HONEST tracking
    // Only count visitor_id as real visitors, session_id is unreliable
    const trackedVisitorMap = new Map<string, {
      ip: string | null;
      events: number;
      firstSeen: string;
      lastSeen: string;
      eventTypes: Map<string, number>;
    }>();

    const sessionIds = new Set<string>();
    const eventTypeCounts = new Map<string, number>();
    const dealerClicks = new Map<string, number>();
    const pathCounts = new Map<string, number>();
    const eventsByDay = new Map<string, { visitors: Set<string>; sessions: Set<string>; events: number }>();
    const ipSet = new Set<string>();

    // Tracking coverage
    let eventsWithTracking = 0;
    let eventsWithoutTracking = 0;
    let trackingStartDate: string | null = null;

    // Real-time: visitors in last 5 minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const recentVisitors = new Set<string>();

    for (const event of events || []) {
      const eventType = event.event_type || 'unknown';
      const createdAt = event.created_at;
      const dateKey = createdAt.slice(0, 10); // YYYY-MM-DD

      // Track sessions (all events have session_id)
      if (event.session_id) {
        sessionIds.add(event.session_id);
      }

      // Only track as "visitor" if we have visitor_id (new tracking)
      if (event.visitor_id) {
        eventsWithTracking++;

        // Track first event with visitor_id
        if (!trackingStartDate || createdAt < trackingStartDate) {
          trackingStartDate = createdAt;
        }

        if (!trackedVisitorMap.has(event.visitor_id)) {
          trackedVisitorMap.set(event.visitor_id, {
            ip: event.ip_address,
            events: 0,
            firstSeen: createdAt,
            lastSeen: createdAt,
            eventTypes: new Map(),
          });
        }
        const visitor = trackedVisitorMap.get(event.visitor_id)!;
        visitor.events++;
        visitor.lastSeen = createdAt > visitor.lastSeen ? createdAt : visitor.lastSeen;
        visitor.firstSeen = createdAt < visitor.firstSeen ? createdAt : visitor.firstSeen;
        visitor.eventTypes.set(eventType, (visitor.eventTypes.get(eventType) || 0) + 1);
        if (event.ip_address && !visitor.ip) visitor.ip = event.ip_address;
      } else {
        eventsWithoutTracking++;
      }

      // Track event types (all events)
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

      // Track by day - separate visitors (with tracking) from sessions
      if (!eventsByDay.has(dateKey)) {
        eventsByDay.set(dateKey, { visitors: new Set(), sessions: new Set(), events: 0 });
      }
      const dayData = eventsByDay.get(dateKey)!;
      if (event.visitor_id) {
        dayData.visitors.add(event.visitor_id);
      }
      if (event.session_id) {
        dayData.sessions.add(event.session_id);
      }
      dayData.events++;

      // Track IPs
      if (event.ip_address) {
        ipSet.add(event.ip_address);
      }

      // Real-time tracking (only tracked visitors)
      if (event.visitor_id && createdAt >= fiveMinutesAgo) {
        recentVisitors.add(event.visitor_id);
      }
    }

    // Calculate HONEST metrics
    const trackedVisitors = trackedVisitorMap.size;
    const totalSessions = sessionIds.size;
    const totalEvents = events?.length || 0;

    // Build time series (fill in missing days)
    const visitorsByDay: { date: string; visitors: number; sessions: number; events: number }[] = [];
    const currentDate = new Date(periodStart);
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().slice(0, 10);
      const dayData = eventsByDay.get(dateKey);
      visitorsByDay.push({
        date: dateKey,
        visitors: dayData?.visitors.size || 0,
        sessions: dayData?.sessions.size || 0,
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

    // Visitor list - ONLY tracked visitors (with visitor_id)
    const visitors = Array.from(trackedVisitorMap.entries())
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
      // HONEST metrics
      trackedVisitors,
      totalSessions,
      uniqueIPs: Array.from(ipSet),
      totalEvents,

      // Tracking coverage
      eventsWithTracking,
      eventsWithoutTracking,
      trackingStartDate,

      // Time series
      visitorsByDay,

      // Breakdowns
      topEventTypes,
      topDealers,
      topPaths,

      // Visitor details
      visitors,

      // Real-time
      activeNow: recentVisitors.size,

      // Time range
      periodStart: periodStartISO,
      periodEnd: periodEndISO,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Visitor stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
