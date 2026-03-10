import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { collectionItemsFrom } from '@/lib/supabase/collectionItems';
import type { SubscriptionTier } from '@/types/subscription';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/**
 * GET /api/showcase
 *
 * Returns collection items visible to the authenticated user (not their own items).
 * Dealers + inner_circle see both 'collectors' and 'dealers' items.
 * Other paid tiers see only 'collectors' items.
 * Free users get 403.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tier
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single() as { data: { subscription_tier: string } | null };

    const tier = (profile?.subscription_tier ?? 'free') as SubscriptionTier;

    if (tier === 'free') {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    // Determine visible visibility levels
    const visibilityFilter: string[] = tier === 'dealer' || tier === 'inner_circle'
      ? ['collectors', 'dealers']
      : ['collectors'];

    // Parse query params
    const url = request.nextUrl;
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || PAGE_SIZE));
    const itemType = url.searchParams.get('type');
    const certType = url.searchParams.get('cert');
    const search = url.searchParams.get('q');
    const tab = url.searchParams.get('tab') || 'community'; // 'community' or 'dealers'

    // Build query (no profile join — collection_items has no direct FK to profiles)
    let query = collectionItemsFrom(serviceClient)
      .select('*', { count: 'exact' })
      .neq('owner_id', user.id); // Exclude own items

    // Tab filter
    if (tab === 'dealers') {
      query = query.in('visibility', ['dealers']);
    } else {
      query = query.in('visibility', visibilityFilter);
    }

    // Optional filters
    if (itemType) {
      query = query.eq('item_type', itemType);
    }
    if (certType) {
      query = query.eq('cert_type', certType);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    // Sort: newest first
    query = query.order('created_at', { ascending: false });

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: items, error, count } = await query;

    if (error) {
      logger.error('[showcase] Query error:', { error });
      return NextResponse.json({ error: 'Failed to fetch showcase items' }, { status: 500 });
    }

    // Fetch profiles for unique owner_ids separately
    const ownerIds = [...new Set((items || []).map((i: { owner_id: string }) => i.owner_id))];
    const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    if (ownerIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ownerIds) as { data: Array<{ id: string; display_name: string | null; avatar_url: string | null }> | null };
      for (const p of profiles || []) {
        profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
      }
    }

    // Merge profile data into items
    const enriched = (items || []).map((item: { owner_id: string }) => ({
      ...item,
      profiles: profileMap.get(item.owner_id) || null,
    }));

    return NextResponse.json({
      data: enriched,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    logger.logError('Showcase GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
