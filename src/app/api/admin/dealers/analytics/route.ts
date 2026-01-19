import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface DealerStats {
  dealerId: number;
  dealerName: string;
  domain: string;

  // Traffic metrics
  clickThroughs: number;
  uniqueVisitors: number;
  listingViews: number;

  // Engagement metrics
  favorites: number;
  alerts: number;
  totalDwellMs: number;
  avgDwellMs: number;

  // Inventory metrics
  activeListings: number;
  totalValueJpy: number;
  avgPriceJpy: number;

  // Performance metrics
  clicksPerListing: number;
  viewsPerListing: number;

  // Rankings
  clicksRank: number;
  clicksPercentile: number;

  // Trend (vs previous period)
  clicksTrend: number; // Percentage change
}

interface DealerAnalytics {
  // Summary across all dealers
  totalClicks: number;
  totalViews: number;
  totalDealers: number;
  periodStart: string;
  periodEnd: string;

  // Per-dealer breakdown
  dealers: DealerStats[];

  // Top performers
  topByClicks: Array<{ dealerId: number; name: string; clicks: number }>;
  topByViews: Array<{ dealerId: number; name: string; views: number }>;
  topByEngagement: Array<{ dealerId: number; name: string; avgDwellMs: number }>;

  // Time series for charts
  dailyTrend: Array<{
    date: string;
    totalClicks: number;
    totalViews: number;
    byDealer: Record<string, number>;
  }>;
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
    const range = searchParams.get('range') || '30d';
    const dealerId = searchParams.get('dealerId');

    // Calculate date range
    const now = new Date();
    let periodStart: Date;
    let previousPeriodStart: Date;

    switch (range) {
      case '7d':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    const periodStartISO = periodStart.toISOString();
    const periodEndISO = now.toISOString();
    const previousPeriodStartISO = previousPeriodStart.toISOString();

    // Fetch all dealers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dealers, error: dealersError } = await (supabase as any)
      .from('dealers')
      .select('id, name, domain, is_active')
      .eq('is_active', true)
      .order('name');

    if (dealersError) {
      console.error('Error fetching dealers:', dealersError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Fetch activity events for the period (click-throughs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clickEvents, error: clickError } = await (supabase as any)
      .from('activity_events')
      .select('visitor_id, event_data, created_at')
      .eq('event_type', 'external_link_click')
      .gte('created_at', periodStartISO)
      .order('created_at', { ascending: false })
      .limit(10000);

    if (clickError) {
      console.error('Error fetching click events:', clickError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Fetch previous period clicks for trend comparison
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prevClickEvents } = await (supabase as any)
      .from('activity_events')
      .select('event_data')
      .eq('event_type', 'external_link_click')
      .gte('created_at', previousPeriodStartISO)
      .lt('created_at', periodStartISO)
      .limit(10000);

    // Fetch viewport dwell events (engagement)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dwellEvents } = await (supabase as any)
      .from('activity_events')
      .select('event_data, created_at')
      .eq('event_type', 'viewport_dwell')
      .gte('created_at', periodStartISO)
      .limit(20000);

    // Fetch favorites
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: favoriteEvents } = await (supabase as any)
      .from('activity_events')
      .select('event_data')
      .eq('event_type', 'favorite_add')
      .gte('created_at', periodStartISO)
      .limit(5000);

    // Fetch listing counts and values per dealer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listingStats } = await (supabase as any)
      .from('listings')
      .select('dealer_id, price_jpy')
      .eq('is_available', true);

    // Build dealer-to-listing mapping for dwell/favorite events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listingDealerMap } = await (supabase as any)
      .from('listings')
      .select('id, dealer_id');

    const listingToDealer: Record<number, number> = {};
    (listingDealerMap || []).forEach((l: { id: number; dealer_id: number }) => {
      listingToDealer[l.id] = l.dealer_id;
    });

    // Process data by dealer
    const dealerMap = new Map<number, {
      clicks: number;
      uniqueVisitors: Set<string>;
      dwellMs: number;
      dwellCount: number;
      favorites: number;
      alerts: number;
      activeListings: number;
      totalValue: number;
      dailyClicks: Map<string, number>;
    }>();

    // Initialize all dealers
    for (const dealer of dealers || []) {
      dealerMap.set(dealer.id, {
        clicks: 0,
        uniqueVisitors: new Set(),
        dwellMs: 0,
        dwellCount: 0,
        favorites: 0,
        alerts: 0,
        activeListings: 0,
        totalValue: 0,
        dailyClicks: new Map(),
      });
    }

    // Process clicks
    const dailyTotals = new Map<string, { clicks: number; views: number; byDealer: Record<string, number> }>();

    for (const event of clickEvents || []) {
      const dealerName = event.event_data?.dealerName;
      if (!dealerName) continue;

      // Find dealer by name
      const dealer = (dealers || []).find((d: { name: string }) => d.name === dealerName);
      if (!dealer) continue;

      const stats = dealerMap.get(dealer.id);
      if (stats) {
        stats.clicks++;
        if (event.visitor_id) {
          stats.uniqueVisitors.add(event.visitor_id);
        }

        // Daily tracking
        const dateKey = event.created_at.slice(0, 10);
        stats.dailyClicks.set(dateKey, (stats.dailyClicks.get(dateKey) || 0) + 1);

        // Overall daily tracking
        if (!dailyTotals.has(dateKey)) {
          dailyTotals.set(dateKey, { clicks: 0, views: 0, byDealer: {} });
        }
        const dayStats = dailyTotals.get(dateKey)!;
        dayStats.clicks++;
        dayStats.byDealer[dealerName] = (dayStats.byDealer[dealerName] || 0) + 1;
      }
    }

    // Process previous period clicks for trend
    const prevClicksByDealer = new Map<number, number>();
    for (const event of prevClickEvents || []) {
      const dealerName = event.event_data?.dealerName;
      if (!dealerName) continue;
      const dealer = (dealers || []).find((d: { name: string }) => d.name === dealerName);
      if (dealer) {
        prevClicksByDealer.set(dealer.id, (prevClicksByDealer.get(dealer.id) || 0) + 1);
      }
    }

    // Process dwell events
    for (const event of dwellEvents || []) {
      const listingId = event.event_data?.listingId;
      const dwellMs = event.event_data?.dwellMs || 0;
      if (!listingId) continue;

      const dealerIdForListing = listingToDealer[listingId];
      if (dealerIdForListing) {
        const stats = dealerMap.get(dealerIdForListing);
        if (stats) {
          stats.dwellMs += dwellMs;
          stats.dwellCount++;

          // Count as a "view" in daily totals
          const dateKey = event.created_at.slice(0, 10);
          if (dailyTotals.has(dateKey)) {
            dailyTotals.get(dateKey)!.views++;
          }
        }
      }
    }

    // Process favorites
    for (const event of favoriteEvents || []) {
      const listingId = event.event_data?.listingId;
      if (!listingId) continue;

      const dealerIdForListing = listingToDealer[listingId];
      if (dealerIdForListing) {
        const stats = dealerMap.get(dealerIdForListing);
        if (stats) {
          stats.favorites++;
        }
      }
    }

    // Process listing stats
    for (const listing of listingStats || []) {
      const stats = dealerMap.get(listing.dealer_id);
      if (stats) {
        stats.activeListings++;
        if (listing.price_jpy) {
          stats.totalValue += listing.price_jpy;
        }
      }
    }

    // Build final dealer stats with rankings
    const dealerStatsArray: DealerStats[] = [];
    let totalClicks = 0;
    let totalViews = 0;

    for (const dealer of dealers || []) {
      const stats = dealerMap.get(dealer.id);
      if (!stats) continue;

      const prevClicks = prevClicksByDealer.get(dealer.id) || 0;
      const clicksTrend = prevClicks > 0
        ? ((stats.clicks - prevClicks) / prevClicks) * 100
        : stats.clicks > 0 ? 100 : 0;

      totalClicks += stats.clicks;
      totalViews += stats.dwellCount;

      dealerStatsArray.push({
        dealerId: dealer.id,
        dealerName: dealer.name,
        domain: dealer.domain,
        clickThroughs: stats.clicks,
        uniqueVisitors: stats.uniqueVisitors.size,
        listingViews: stats.dwellCount,
        favorites: stats.favorites,
        alerts: stats.alerts,
        totalDwellMs: stats.dwellMs,
        avgDwellMs: stats.dwellCount > 0 ? Math.round(stats.dwellMs / stats.dwellCount) : 0,
        activeListings: stats.activeListings,
        totalValueJpy: stats.totalValue,
        avgPriceJpy: stats.activeListings > 0 ? Math.round(stats.totalValue / stats.activeListings) : 0,
        clicksPerListing: stats.activeListings > 0 ? Math.round((stats.clicks / stats.activeListings) * 100) / 100 : 0,
        viewsPerListing: stats.activeListings > 0 ? Math.round((stats.dwellCount / stats.activeListings) * 100) / 100 : 0,
        clicksRank: 0, // Will be set below
        clicksPercentile: 0, // Will be set below
        clicksTrend,
      });
    }

    // Sort by clicks and assign rankings
    dealerStatsArray.sort((a, b) => b.clickThroughs - a.clickThroughs);
    dealerStatsArray.forEach((dealer, index) => {
      dealer.clicksRank = index + 1;
      dealer.clicksPercentile = Math.round(((dealerStatsArray.length - index) / dealerStatsArray.length) * 100);
    });

    // Filter by specific dealer if requested
    let filteredDealers = dealerStatsArray;
    if (dealerId) {
      filteredDealers = dealerStatsArray.filter(d => d.dealerId === parseInt(dealerId));
    }

    // Build daily trend array
    const dailyTrend: DealerAnalytics['dailyTrend'] = [];
    const sortedDates = Array.from(dailyTotals.keys()).sort();
    for (const date of sortedDates) {
      const dayData = dailyTotals.get(date)!;
      dailyTrend.push({
        date,
        totalClicks: dayData.clicks,
        totalViews: dayData.views,
        byDealer: dayData.byDealer,
      });
    }

    // Build top performers
    const topByClicks = dealerStatsArray
      .slice(0, 10)
      .map(d => ({ dealerId: d.dealerId, name: d.dealerName, clicks: d.clickThroughs }));

    const topByViews = [...dealerStatsArray]
      .sort((a, b) => b.listingViews - a.listingViews)
      .slice(0, 10)
      .map(d => ({ dealerId: d.dealerId, name: d.dealerName, views: d.listingViews }));

    const topByEngagement = [...dealerStatsArray]
      .filter(d => d.listingViews >= 10) // Minimum views threshold
      .sort((a, b) => b.avgDwellMs - a.avgDwellMs)
      .slice(0, 10)
      .map(d => ({ dealerId: d.dealerId, name: d.dealerName, avgDwellMs: d.avgDwellMs }));

    const analytics: DealerAnalytics = {
      totalClicks,
      totalViews,
      totalDealers: dealers?.length || 0,
      periodStart: periodStartISO,
      periodEnd: periodEndISO,
      dealers: filteredDealers,
      topByClicks,
      topByViews,
      topByEngagement,
      dailyTrend,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Dealer analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
