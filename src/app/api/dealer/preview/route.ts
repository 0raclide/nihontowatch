import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dealer/preview
 * Returns inventory stats + top 8 featured listings for the authenticated dealer.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json(
        { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
        { status: auth.error === 'unauthorized' ? 401 : 403 }
      );
    }

    const serviceClient = createServiceClient();
    const excludeDealer = process.env.NEXT_PUBLIC_DEALER_LISTINGS_LIVE !== 'true';

    // Count + type breakdown
    let countQuery = serviceClient
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', auth.dealerId)
      .eq('is_available', true);

    let typeQuery = serviceClient
      .from('listings')
      .select('item_type')
      .eq('dealer_id', auth.dealerId)
      .eq('is_available', true);

    let featuredQuery = serviceClient
      .from('listings')
      .select('*, dealers:dealers(id, name, name_ja, domain)')
      .eq('dealer_id', auth.dealerId)
      .eq('is_available', true)
      .order('featured_score', { ascending: false, nullsFirst: false })
      .limit(8);

    if (excludeDealer) {
      countQuery = countQuery.neq('source', 'dealer');
      typeQuery = typeQuery.neq('source', 'dealer');
      featuredQuery = featuredQuery.neq('source', 'dealer');
    }

    const [{ count }, { data: typeBreakdown }, { data: featuredListings }] = await Promise.all([
      countQuery,
      typeQuery,
      featuredQuery,
    ]);

    // Aggregate type counts
    const typeMap: Record<string, number> = {};
    (typeBreakdown as Array<{ item_type: string | null }> | null)?.forEach((row) => {
      if (row.item_type) {
        typeMap[row.item_type] = (typeMap[row.item_type] || 0) + 1;
      }
    });

    const typeCounts = Object.entries(typeMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([type, count]) => ({ type, count }));

    return NextResponse.json({
      stats: {
        totalListings: count || 0,
        typeCounts,
      },
      featuredListings: featuredListings || [],
    });
  } catch (error) {
    logger.logError('Dealer preview GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
