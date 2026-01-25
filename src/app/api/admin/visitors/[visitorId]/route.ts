import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface VisitorSession {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  pageViews: number;
  userAgent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
}

interface ActivityEvent {
  id: number;
  eventType: string;
  eventData: Record<string, unknown>;
  createdAt: string;
  sessionId: string;
}

interface VisitorDetail {
  visitorId: string;
  ipAddresses: string[];
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
  totalSessions: number;
  totalDurationMs: number;

  // Summary stats
  searchCount: number;
  filterChangeCount: number;
  pageViewCount: number;
  dealerClickCount: number;
  favoriteCount: number;

  // Top searches
  topSearches: { query: string; count: number }[];

  // Filter patterns
  filterPatterns: {
    category: string;
    filters: Record<string, unknown>;
    count: number;
  }[];

  // Sessions with duration
  sessions: VisitorSession[];

  // Recent activity timeline
  recentActivity: ActivityEvent[];

  // Dealers clicked
  dealersClicked: { name: string; count: number }[];

  // Pages viewed
  pagesViewed: { path: string; count: number }[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ visitorId: string }> }
) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { visitorId } = await params;

    if (!visitorId) {
      return NextResponse.json({ error: 'Visitor ID required' }, { status: 400 });
    }

    // Fetch all events for this visitor (use service client to bypass RLS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error: eventsError } = await (serviceSupabase as any)
      .from('activity_events')
      .select('id, session_id, event_type, event_data, ip_address, created_at')
      .eq('visitor_id', visitorId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (eventsError) {
      logger.error('Error fetching visitor events', { error: eventsError, visitorId });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ error: 'Visitor not found' }, { status: 404 });
    }

    // Get unique session IDs
    const sessionIds = [...new Set(events.map((e: { session_id: string }) => e.session_id))];

    // Fetch session data by session_id (TEXT), not id (UUID)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionsData } = await (serviceSupabase as any)
      .from('user_sessions')
      .select('session_id, started_at, ended_at, total_duration_ms, page_views, user_agent, screen_width, screen_height')
      .in('session_id', sessionIds);

    // Build session map using session_id as the key
    const sessionMap = new Map<string, VisitorSession>();
    for (const session of sessionsData || []) {
      sessionMap.set(session.session_id, {
        sessionId: session.session_id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        durationMs: session.total_duration_ms,
        pageViews: session.page_views || 0,
        userAgent: session.user_agent,
        screenWidth: session.screen_width,
        screenHeight: session.screen_height,
      });
    }

    // Process events to build stats
    const ipAddresses = new Set<string>();
    const searchQueries = new Map<string, number>();
    const filterPatterns = new Map<string, { filters: Record<string, unknown>; count: number }>();
    const dealersClicked = new Map<string, number>();
    const pagesViewed = new Map<string, number>();

    let firstSeen = events[events.length - 1]?.created_at;
    let lastSeen = events[0]?.created_at;
    let searchCount = 0;
    let filterChangeCount = 0;
    let pageViewCount = 0;
    let dealerClickCount = 0;
    let favoriteCount = 0;

    const recentActivity: ActivityEvent[] = [];

    for (const event of events) {
      // Track IP addresses
      if (event.ip_address) {
        ipAddresses.add(event.ip_address);
      }

      // Track first/last seen
      if (event.created_at < firstSeen) firstSeen = event.created_at;
      if (event.created_at > lastSeen) lastSeen = event.created_at;

      // Count by type
      switch (event.event_type) {
        case 'search':
          searchCount++;
          const query = event.event_data?.query?.toLowerCase?.() || '';
          if (query) {
            searchQueries.set(query, (searchQueries.get(query) || 0) + 1);
          }
          break;
        case 'filter_change':
          filterChangeCount++;
          // Track filter patterns
          const newFilters = event.event_data?.newFilters;
          if (newFilters) {
            const key = JSON.stringify(newFilters);
            const existing = filterPatterns.get(key);
            if (existing) {
              existing.count++;
            } else {
              filterPatterns.set(key, { filters: newFilters, count: 1 });
            }
          }
          break;
        case 'page_view':
          pageViewCount++;
          const path = event.event_data?.path || '/';
          pagesViewed.set(path, (pagesViewed.get(path) || 0) + 1);
          break;
        case 'external_link_click':
          dealerClickCount++;
          const dealer = event.event_data?.dealerName;
          if (dealer) {
            dealersClicked.set(dealer, (dealersClicked.get(dealer) || 0) + 1);
          }
          break;
        case 'favorite_add':
        case 'favorite_remove':
          favoriteCount++;
          break;
      }

      // Add to recent activity (first 100)
      if (recentActivity.length < 100) {
        recentActivity.push({
          id: event.id,
          eventType: event.event_type,
          eventData: event.event_data || {},
          createdAt: event.created_at,
          sessionId: event.session_id,
        });
      }
    }

    // Calculate total session duration
    let totalDurationMs = 0;
    for (const session of sessionMap.values()) {
      if (session.durationMs) {
        totalDurationMs += session.durationMs;
      }
    }

    // Build top searches
    const topSearches = Array.from(searchQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    // Build filter patterns (top 10 unique combinations)
    const filterPatternsArray = Array.from(filterPatterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, data]) => ({
        category: summarizeFilters(data.filters),
        filters: data.filters,
        count: data.count,
      }));

    // Build dealers clicked
    const dealersClickedArray = Array.from(dealersClicked.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Build pages viewed
    const pagesViewedArray = Array.from(pagesViewed.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Build sessions array sorted by start time
    const sessions = Array.from(sessionMap.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const detail: VisitorDetail = {
      visitorId,
      ipAddresses: Array.from(ipAddresses),
      firstSeen,
      lastSeen,
      totalEvents: events.length,
      totalSessions: sessionMap.size,
      totalDurationMs,

      searchCount,
      filterChangeCount,
      pageViewCount,
      dealerClickCount,
      favoriteCount,

      topSearches,
      filterPatterns: filterPatternsArray,
      sessions,
      recentActivity,
      dealersClicked: dealersClickedArray,
      pagesViewed: pagesViewedArray,
    };

    return NextResponse.json(detail);
  } catch (error) {
    logger.logError('Visitor detail error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Summarize filter settings into a readable string
 */
function summarizeFilters(filters: Record<string, unknown>): string {
  const parts: string[] = [];

  if (filters.category) {
    parts.push(`Category: ${filters.category}`);
  }
  if (Array.isArray(filters.itemTypes) && filters.itemTypes.length > 0) {
    parts.push(`Types: ${filters.itemTypes.join(', ')}`);
  }
  if (Array.isArray(filters.certifications) && filters.certifications.length > 0) {
    parts.push(`Certs: ${filters.certifications.join(', ')}`);
  }
  if (Array.isArray(filters.dealers) && filters.dealers.length > 0) {
    parts.push(`Dealers: ${filters.dealers.length}`);
  }
  if (filters.priceMin || filters.priceMax) {
    const min = filters.priceMin || '0';
    const max = filters.priceMax || '∞';
    parts.push(`Price: ${min}-${max}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Default filters';
}
