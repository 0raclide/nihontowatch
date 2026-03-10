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

    // Get user's tier and admin status
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('subscription_tier, is_admin')
      .eq('id', user.id)
      .single() as { data: { subscription_tier: string; is_admin?: boolean } | null };

    const tier = (profile?.subscription_tier ?? 'free') as SubscriptionTier;
    const isAdmin = profile?.is_admin === true;

    // Yuhinkai visibility = inner_circle only; Galleries visibility = dealer only
    // Admins get full access (both visibility levels)
    const visibilityFilter: string[] = [];
    if (isAdmin || tier === 'inner_circle') visibilityFilter.push('collectors');
    if (isAdmin || tier === 'dealer') visibilityFilter.push('dealers');

    if (visibilityFilter.length === 0) {
      return NextResponse.json({ data: [], total: 0, page: 1, limit: PAGE_SIZE });
    }

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
      .select('*', { count: 'exact' });

    // Tab filter — enforce tier even if tab param is sent directly
    if (tab === 'dealers') {
      if (tier !== 'dealer' && !isAdmin) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
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
