/**
 * DEBUG ENDPOINT - Verify subscription detection
 *
 * Returns subscription status and listing counts to diagnose
 * why admin might not see fresh listings.
 *
 * DELETE THIS AFTER DEBUGGING
 */

import { createClient } from '@/lib/supabase/server';
import { getUserSubscription, getDataDelayCutoff } from '@/lib/subscription/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get subscription status
    const subscription = await getUserSubscription();
    const delayCutoff = getDataDelayCutoff();

    // Get Supabase client to query listings
    const supabase = await createClient();

    // Count total available listings
    const { count: totalAvailable } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .or('status.eq.available,is_available.eq.true');

    // Count listings within 72h (fresh listings)
    const { count: freshListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .or('status.eq.available,is_available.eq.true')
      .gt('first_seen_at', delayCutoff);

    // Count listings older than 72h (delayed listings)
    const { count: delayedListings } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .or('status.eq.available,is_available.eq.true')
      .lte('first_seen_at', delayCutoff);

    // Get most recent listing
    const { data: mostRecent } = await supabase
      .from('listings')
      .select('id, first_seen_at, title, dealer_id, dealers(name)')
      .or('status.eq.available,is_available.eq.true')
      .order('first_seen_at', { ascending: false })
      .limit(1)
      .single();

    // Get Iida Koendo dealer ID and their recent listings
    const { data: iidaDealer } = await supabase
      .from('dealers')
      .select('id, name')
      .ilike('name', '%iida%')
      .single() as { data: { id: number; name: string } | null };

    let iidaListings = null;
    if (iidaDealer) {
      const { data, count } = await supabase
        .from('listings')
        .select('id, first_seen_at, title, status, is_available, price_value, item_type', { count: 'exact' })
        .eq('dealer_id', iidaDealer.id)
        .or('status.eq.available,is_available.eq.true')
        .order('first_seen_at', { ascending: false })
        .limit(5);

      iidaListings = { dealer: iidaDealer, count, recentListings: data };
    }

    return NextResponse.json({
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        userId: subscription.userId,
        isDelayed: subscription.isDelayed,
      },
      timing: {
        now: new Date().toISOString(),
        delayCutoff,
        cutoffAge: '72 hours ago',
      },
      counts: {
        totalAvailable,
        freshListings,
        delayedListings,
        note: subscription.isDelayed
          ? `You should see ${delayedListings} listings (72h+ old)`
          : `You should see ${totalAvailable} listings (all)`,
      },
      mostRecentListing: mostRecent,
      iidaKoendo: iidaListings,
      debug: {
        message: subscription.isDelayed
          ? 'AUTH NOT WORKING - You are being treated as FREE tier'
          : 'Auth working - You should see fresh listings',
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
