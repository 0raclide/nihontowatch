import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { collectionItemsFrom } from '@/lib/supabase/collectionItems';
import { checkCollectionAccess } from '@/lib/collection/access';

export const dynamic = 'force-dynamic';

export interface CollectionStats {
  total_items: number;
  by_visibility: { private: number; collectors: number; dealers: number };
  by_type: Record<string, number>;
  by_cert: Record<string, number>;
  listed_for_sale: number;
  sold: number;
}

/**
 * GET /api/collection/stats
 *
 * Returns aggregate statistics for the authenticated user's collection.
 * Computed on-demand from collection_items + listings.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();

    // Fetch all collection items for this user (select only needed columns)
    const { data: items, error } = await collectionItemsFrom(serviceClient)
      .select('visibility, item_type, cert_type')
      .eq('owner_id', user.id);

    if (error) {
      logger.error('[collection/stats] Query error:', { error });
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const allItems = (items || []) as Array<{
      visibility: string;
      item_type: string | null;
      cert_type: string | null;
    }>;

    // Compute visibility breakdown
    const by_visibility = { private: 0, collectors: 0, dealers: 0 };
    const by_type: Record<string, number> = {};
    const by_cert: Record<string, number> = {};

    for (const item of allItems) {
      // Visibility
      if (item.visibility === 'collectors') by_visibility.collectors++;
      else if (item.visibility === 'dealers') by_visibility.dealers++;
      else by_visibility.private++;

      // Type
      if (item.item_type) {
        by_type[item.item_type] = (by_type[item.item_type] || 0) + 1;
      }

      // Cert
      if (item.cert_type) {
        by_cert[item.cert_type] = (by_cert[item.cert_type] || 0) + 1;
      }
    }

    // Count dealer listings owned by this user
    const { count: listedCount } = await serviceClient
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('is_available', true) as { count: number | null };

    const { count: soldCount } = await serviceClient
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('is_sold', true) as { count: number | null };

    const stats: CollectionStats = {
      total_items: allItems.length,
      by_visibility,
      by_type,
      by_cert,
      listed_for_sale: listedCount ?? 0,
      sold: soldCount ?? 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    logger.logError('Collection stats GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
