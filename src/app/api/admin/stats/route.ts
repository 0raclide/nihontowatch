/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section');
    const range = searchParams.get('range') || '30d';
    const detailed = searchParams.get('detailed') === 'true';

    // Calculate date range
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // If requesting alerts section specifically
    if (section === 'alerts') {
      return await getAlertsData(supabase, searchParams);
    }

    // Get basic dashboard stats
    const [
      usersResult,
      activeUsersResult,
      listingsResult,
      favoritesResult,
      recentSignupsResult,
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      // Active users in last 24h (using updated_at as proxy for activity)
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      // Total listings
      supabase.from('listings').select('id', { count: 'exact', head: true }),
      // Total favorites
      supabase.from('user_favorites').select('id', { count: 'exact', head: true }),
      // Recent signups
      supabase
        .from('profiles')
        .select('id, email, display_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Get popular listings (most favorited)
    type FavoriteWithListing = { listing_id: number; listings: { id: number; title: string } | null };
    const { data: popularListings, error: popularError } = await supabase
      .from('user_favorites')
      .select('listing_id, listings(id, title)')
      .limit(1000) as { data: FavoriteWithListing[] | null; error: unknown };

    if (popularError) {
      console.error('Error fetching popular listings:', popularError);
    }

    // Count favorites per listing
    const listingFavorites: Record<number, { title: string; count: number }> = {};
    if (popularListings) {
      for (const fav of popularListings) {
        const listingId = fav.listing_id;
        const listing = fav.listings;
        // Skip if listing was deleted (orphaned favorite)
        if (!listing) continue;
        if (!listingFavorites[listingId]) {
          listingFavorites[listingId] = { title: listing.title || 'Unknown', count: 0 };
        }
        listingFavorites[listingId].count++;
      }
    }

    const topListings = Object.entries(listingFavorites)
      .map(([id, data]) => ({
        id: parseInt(id),
        title: data.title,
        views: 0, // Views tracking not yet implemented
        favorites: data.count,
      }))
      .sort((a, b) => b.favorites - a.favorites)
      .slice(0, 10);

    const basicStats = {
      totalUsers: usersResult.count || 0,
      activeUsers24h: activeUsersResult.count || 0,
      totalListings: listingsResult.count || 0,
      favoritesCount: favoritesResult.count || 0,
      recentSignups: recentSignupsResult.data || [],
      popularListings: topListings,
    };

    // If detailed analytics requested
    if (detailed) {
      // Use service role client for activity data to bypass RLS
      // (RLS policies make anonymous events invisible to regular queries)
      const serviceSupabase = createServiceClient();

      const [sessionsResult, searchTermsResult, alertsResult] = await Promise.all([
        // Session stats (if user_sessions table exists)
        serviceSupabase
          .from('user_sessions')
          .select('total_duration_ms, page_views')
          .gte('started_at', startDate.toISOString())
          .limit(1000),
        // Search terms from activity_events
        serviceSupabase
          .from('activity_events')
          .select('event_data')
          .eq('event_type', 'search')
          .gte('created_at', startDate.toISOString())
          .limit(1000),
        // Alerts count
        supabase.from('alerts').select('id', { count: 'exact', head: true }),
      ]);

      // Calculate session stats
      let totalSessions = 0;
      let totalDuration = 0;
      let totalPageViews = 0;

      if (sessionsResult.data) {
        totalSessions = sessionsResult.data.length;
        for (const session of sessionsResult.data as any[]) {
          totalDuration += (session.total_duration_ms || 0) / 1000;
          totalPageViews += session.page_views || 0;
        }
      }

      // Aggregate search terms
      const searchCounts: Record<string, number> = {};
      if (searchTermsResult.data) {
        for (const event of searchTermsResult.data as any[]) {
          const query = (event.event_data as Record<string, unknown>)?.query as string;
          if (query) {
            const normalized = query.toLowerCase().trim();
            searchCounts[normalized] = (searchCounts[normalized] || 0) + 1;
          }
        }
      }

      const popularSearchTerms = Object.entries(searchCounts)
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return NextResponse.json({
        ...basicStats,
        sessionStats: {
          totalSessions,
          avgDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
          avgPageViews: totalSessions > 0 ? totalPageViews / totalSessions : 0,
        },
        mostViewedListings: topListings, // Reusing popular listings
        popularSearchTerms,
        conversionFunnel: {
          views: totalPageViews,
          favorites: favoritesResult.count || 0,
          alerts: alertsResult.count || 0,
        },
      });
    }

    return NextResponse.json(basicStats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getAlertsData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const typeFilter = searchParams.get('type');
  const statusFilter = searchParams.get('status');
  const offset = (page - 1) * limit;

  // Try the newer 'alerts' table first, fall back to 'user_alerts' if it doesn't exist
  let tableName: 'alerts' | 'user_alerts' = 'alerts';
  let query = supabase
    .from(tableName)
    .select(`
      id,
      user_id,
      alert_type,
      listing_id,
      target_price,
      search_criteria,
      is_active,
      last_triggered_at,
      created_at
    `, { count: 'exact' });

  if (typeFilter) {
    query = query.eq('alert_type', typeFilter);
  }

  if (statusFilter === 'active') {
    query = query.eq('is_active', true);
  } else if (statusFilter === 'inactive') {
    query = query.eq('is_active', false);
  }

  let { data: alerts, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // If 'alerts' table doesn't exist, try 'user_alerts'
  if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
    tableName = 'user_alerts';
    query = supabase
      .from(tableName)
      .select(`
        id,
        user_id,
        alert_type,
        listing_id,
        target_price,
        search_criteria,
        is_active,
        last_triggered_at,
        created_at
      `, { count: 'exact' });

    if (typeFilter) {
      query = query.eq('alert_type', typeFilter);
    }

    if (statusFilter === 'active') {
      query = query.eq('is_active', true);
    } else if (statusFilter === 'inactive') {
      query = query.eq('is_active', false);
    }

    const result = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    alerts = result.data;
    count = result.count;
    error = result.error;
  }

  if (error) {
    console.error('Alerts query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch user profiles separately to avoid join issues
  const userIds = [...new Set(alerts?.map(a => a.user_id).filter(Boolean) || [])];
  const listingIds = [...new Set(alerts?.map(a => a.listing_id).filter(Boolean) || [])];

  // Fetch profiles
  const profilesMap: Record<string, { email: string; display_name: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', userIds);

    if (profiles) {
      for (const p of profiles) {
        profilesMap[p.id] = { email: p.email, display_name: p.display_name };
      }
    }
  }

  // Fetch listings
  const listingsMap: Record<number, { title: string | null; price_value: number | null }> = {};
  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, price_value')
      .in('id', listingIds);

    if (listings) {
      for (const l of listings) {
        listingsMap[l.id] = { title: l.title, price_value: l.price_value };
      }
    }
  }

  // Get alert history - skip if IDs are integers but table expects UUIDs
  const historyByAlert: Record<string | number, any[]> = {};
  try {
    const alertIds = alerts?.map(a => a.id) || [];
    if (alertIds.length > 0) {
      const { data: historyData, error: historyError } = await supabase
        .from('alert_history')
        .select('*')
        .in('alert_id', alertIds)
        .order('triggered_at', { ascending: false });

      if (!historyError && historyData) {
        for (const record of historyData) {
          const alertId = record.alert_id;
          if (!historyByAlert[alertId]) {
            historyByAlert[alertId] = [];
          }
          historyByAlert[alertId].push(record);
        }
      }
    }
  } catch (historyErr) {
    // History fetch failed (likely due to type mismatch), continue without it
    console.warn('Could not fetch alert history:', historyErr);
  }

  // Format response
  const formattedAlerts = alerts?.map(alert => ({
    ...alert,
    user: profilesMap[alert.user_id] || null,
    listing: alert.listing_id ? listingsMap[alert.listing_id] || null : null,
    history: historyByAlert[alert.id] || [],
  })) || [];

  return NextResponse.json({
    alerts: formattedAlerts,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
