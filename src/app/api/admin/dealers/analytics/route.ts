import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import { apiUnauthorized, apiForbidden } from '@/lib/api/responses';

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
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
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

    // Fetch all data in parallel — RPC for event aggregation, direct query for dealers/listings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc as any;
    const [
      dealersResult,
      clickStatsResult,
      prevClickStatsResult,
      dwellStatsResult,
      favoriteStatsResult,
      dailyClicksResult,
      listingStatsResult,
    ] = await Promise.all([
      supabase
        .from('dealers')
        .select('id, name, domain, is_active')
        .eq('is_active', true)
        .order('name'),

      rpc('get_dealer_click_stats', {
        p_start: periodStartISO,
        p_end: periodEndISO,
      }),

      rpc('get_dealer_click_stats_prev', {
        p_start: previousPeriodStartISO,
        p_end: periodStartISO,
      }),

      rpc('get_dealer_dwell_stats', {
        p_start: periodStartISO,
        p_end: periodEndISO,
      }),

      rpc('get_dealer_favorite_stats', {
        p_start: periodStartISO,
        p_end: periodEndISO,
      }),

      rpc('get_dealer_daily_clicks', {
        p_start: periodStartISO,
        p_end: periodEndISO,
      }),

      supabase
        .from('listings')
        .select('dealer_id, price_jpy')
        .eq('is_available', true)
        .limit(100000),
    ]);

    if (dealersResult.error) {
      logger.error('Error fetching dealers', { error: dealersResult.error });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const dealers = dealersResult.data as { id: number; name: string; domain: string; is_active: boolean }[] | null;

    type ClickRow = { dealer_name: string; dealer_id: number | null; clicks: number; unique_visitors: number };
    type PrevClickRow = { dealer_name: string; dealer_id: number | null; clicks: number };
    type DwellRow = { dealer_id: number; total_dwell_seconds: number };
    type FavRow = { dealer_id: number; favorites: number };
    type DailyClickRow = { click_date: string; dealer_name: string; clicks: number };

    const clickStats = (clickStatsResult.data || []) as ClickRow[];
    const prevClickStats = (prevClickStatsResult.data || []) as PrevClickRow[];
    const dwellStats = (dwellStatsResult.data || []) as DwellRow[];
    const favStats = (favoriteStatsResult.data || []) as FavRow[];
    const dailyClicks = (dailyClicksResult.data || []) as DailyClickRow[];
    const listingStats = (listingStatsResult.data || []) as { dealer_id: number; price_jpy: number | null }[];

    // Build lookup maps by dealer name → dealer id (for click stats that use dealerName)
    const dealerByName = new Map<string, { id: number; name: string; domain: string }>();
    for (const d of dealers || []) {
      dealerByName.set(d.name, d);
    }

    // Process data by dealer
    const dealerMap = new Map<number, {
      clicks: number;
      uniqueVisitors: number;
      dwellMs: number;
      dwellCount: number;
      favorites: number;
      alerts: number;
      activeListings: number;
      totalValue: number;
    }>();

    // Initialize all dealers
    for (const dealer of dealers || []) {
      dealerMap.set(dealer.id, {
        clicks: 0,
        uniqueVisitors: 0,
        dwellMs: 0,
        dwellCount: 0,
        favorites: 0,
        alerts: 0,
        activeListings: 0,
        totalValue: 0,
      });
    }

    // Process click stats from RPC
    for (const row of clickStats) {
      const did = row.dealer_id ?? dealerByName.get(row.dealer_name)?.id;
      if (!did) continue;
      const stats = dealerMap.get(did);
      if (stats) {
        stats.clicks = Number(row.clicks);
        stats.uniqueVisitors = Number(row.unique_visitors);
      }
    }

    // Process previous period clicks for trend
    const prevClicksByDealer = new Map<number, number>();
    for (const row of prevClickStats) {
      const did = row.dealer_id ?? dealerByName.get(row.dealer_name)?.id;
      if (did) {
        prevClicksByDealer.set(did, Number(row.clicks));
      }
    }

    // Process dwell stats from RPC
    for (const row of dwellStats) {
      const stats = dealerMap.get(row.dealer_id);
      if (stats) {
        stats.dwellMs = Number(row.total_dwell_seconds) * 1000;
        stats.dwellCount = 1; // dwell is now total seconds, not row count
      }
    }

    // Process favorites from RPC
    for (const row of favStats) {
      const stats = dealerMap.get(row.dealer_id);
      if (stats) {
        stats.favorites = Number(row.favorites);
      }
    }

    // Build daily trend from RPC
    const dailyTotals = new Map<string, { clicks: number; views: number; byDealer: Record<string, number> }>();
    for (const row of dailyClicks) {
      const dateKey = String(row.click_date);
      if (!dailyTotals.has(dateKey)) {
        dailyTotals.set(dateKey, { clicks: 0, views: 0, byDealer: {} });
      }
      const dayStats = dailyTotals.get(dateKey)!;
      const n = Number(row.clicks);
      dayStats.clicks += n;
      if (row.dealer_name) {
        dayStats.byDealer[row.dealer_name] = (dayStats.byDealer[row.dealer_name] || 0) + n;
      }
    }

    // Process listing stats
    for (const listing of listingStats) {
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
        uniqueVisitors: stats.uniqueVisitors,
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
    logger.logError('Dealer analytics error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
