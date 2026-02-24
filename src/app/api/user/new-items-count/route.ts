import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUserSubscription, getDataDelayCutoff } from '@/lib/subscription/server';
import { LISTING_FILTERS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/new-items-count
 * Returns the count of new available listings since the user's last visit.
 * Respects data delay for free tier users.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        count: null,
        isLoggedIn: false
      });
    }

    // Get user profile with last_visit_at and preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_visit_at, preferences')
      .eq('id', user.id)
      .single();

    const profileRow = profile as { last_visit_at: string | null; preferences: Record<string, unknown> | null } | null;
    const lastVisitAt = profileRow?.last_visit_at;

    if (!lastVisitAt) {
      // First visit - return null count (will show welcome message or nothing)
      return NextResponse.json({
        count: null,
        isLoggedIn: true,
        isFirstVisit: true,
      });
    }

    // Get subscription to check for data delay
    const subscription = await getUserSubscription();

    // Build count query for available listings since last visit
    let query = supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.available,is_available.eq.true')
      .gte('first_seen_at', lastVisitAt);

    // Apply data delay for free tier (same logic as browse API)
    if (subscription.isDelayed) {
      const delayCutoff = getDataDelayCutoff();
      query = query.lte('first_seen_at', delayCutoff);
    }

    // Apply minimum price filter (same as browse API)
    // Users with showAllPrices preference bypass the ¥100K floor
    const showAllPrices = profileRow?.preferences?.showAllPrices === true;
    const minPriceJpy = showAllPrices ? 0 : LISTING_FILTERS.MIN_PRICE_JPY;
    if (minPriceJpy > 0) {
      query = query.or(`price_value.is.null,price_jpy.gte.${minPriceJpy}`);
    }

    // Exclude non-collectibles (same as browse API)
    query = query
      .not('item_type', 'ilike', 'stand')
      .not('item_type', 'ilike', 'book')
      .not('item_type', 'ilike', 'other');

    const { count, error } = await query;

    if (error) {
      console.error('Error fetching new items count:', error);
      return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 });
    }

    // Calculate days since last visit
    const lastVisitDate = new Date(lastVisitAt);
    const now = new Date();
    const daysSince = Math.floor(
      (now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json({
      count: count || 0,
      isLoggedIn: true,
      isFirstVisit: false,
      lastVisitAt,
      daysSince,
    });
  } catch (error) {
    console.error('New items count API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
