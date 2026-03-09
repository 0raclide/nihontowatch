import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyDealer } from '@/lib/dealer/auth';
import { selectCollectionItemSingle } from '@/lib/supabase/collectionItems';
import { recomputeScoreForListing } from '@/lib/featured/scoring';

export const dynamic = 'force-dynamic';

/**
 * POST /api/collection/items/[id]/promote
 * Promotes a private collection item to a public dealer listing.
 *
 * Body (optional):
 *   { price_value?: number, price_currency?: string }
 *
 * Returns: { listing_id: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionItemId } = await params;
    const supabase = await createClient();

    // 1. Verify dealer tier
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      const status = auth.error === 'unauthorized' ? 401 : 403;
      return NextResponse.json(
        { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Dealer subscription required' },
        { status }
      );
    }

    // 2. Verify user owns the collection item
    const serviceClient = createServiceClient();
    const { data: item, error: itemErr } = await selectCollectionItemSingle(
      serviceClient, 'id', collectionItemId
    );

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Collection item not found' }, { status: 404 });
    }

    if (item.owner_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Parse optional price override
    const body = await request.json().catch(() => ({}));
    const priceValue = typeof body.price_value === 'number' ? body.price_value : null;
    const priceCurrency = typeof body.price_currency === 'string' ? body.price_currency : null;

    // 4. Call RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listingId, error: rpcErr } = await (serviceClient.rpc as any)(
      'promote_to_listing',
      {
        p_collection_item_id: collectionItemId,
        p_dealer_id: auth.dealerId,
        p_owner_id: auth.user.id,
        p_price_value: priceValue,
        p_price_currency: priceCurrency,
      }
    );

    if (rpcErr) {
      logger.error('[promote] RPC error', { collectionItemId, error: rpcErr });
      return NextResponse.json({ error: rpcErr.message || 'Promote failed' }, { status: 500 });
    }

    // 5. Sync elite stats + recompute featured score (always await — Critical Rule #9)
    if (item.artisan_id) {
      await recomputeScoreForListing(serviceClient, listingId, {
        syncElite: true,
        artisanId: item.artisan_id,
      });
    } else {
      await recomputeScoreForListing(serviceClient, listingId);
    }

    return NextResponse.json({ listing_id: listingId }, { status: 200 });
  } catch (error) {
    logger.logError('Collection item promote error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
