import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/listings/[id]/delist
 * Delists a public dealer listing back to a private collection item.
 *
 * Returns: { collection_item_id: string }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);
    if (isNaN(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns the listing and it's a dealer listing
    const serviceClient = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listing, error: fetchErr } = await (serviceClient.from('listings') as any)
      .select('id, owner_id, source, status')
      .eq('id', listingId)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (listing.source !== 'dealer') {
      return NextResponse.json({ error: 'Only dealer listings can be delisted' }, { status: 400 });
    }

    if (listing.status === 'DELISTED') {
      return NextResponse.json({ error: 'Listing is already delisted' }, { status: 400 });
    }

    // Call RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: collectionItemId, error: rpcErr } = await (serviceClient.rpc as any)(
      'delist_to_collection',
      {
        p_listing_id: listingId,
        p_owner_id: user.id,
      }
    );

    if (rpcErr) {
      logger.error('[delist] RPC error', { listingId, error: rpcErr });
      return NextResponse.json({ error: rpcErr.message || 'Delist failed' }, { status: 500 });
    }

    return NextResponse.json({ collection_item_id: collectionItemId }, { status: 200 });
  } catch (error) {
    logger.logError('Listing delist error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
