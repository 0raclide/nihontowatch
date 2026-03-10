/**
 * GET /api/dealer/listings/intelligence/criteria?listingId=123
 * GET /api/dealer/listings/intelligence/criteria?collectionItemId=abc
 *
 * Returns aggregated search criteria from saved searches that match the given
 * listing or collection item. Dealers see what collectors are searching for —
 * item types, certifications, schools, price ranges.
 *
 * Auth: verifyDealer() + ownership check (dealer_id or owner_id).
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextRequest, NextResponse } from 'next/server';
import { selectCollectionItemSingle } from '@/lib/supabase/collectionItems';
import {
  matchItemAgainstSearches,
  aggregateCriteria,
  type MatchableItem,
  type SavedSearchRow,
} from '@/lib/savedSearches/matchAgainstItem';

export const dynamic = 'force-dynamic';

const LISTING_SELECT = 'id, dealer_id, item_type, item_category, cert_type, price_value, school, tosogu_school, smith, tosogu_maker, artisan_id, title, source';
const COLLECTION_ITEM_SELECT = 'id, item_uuid, owner_id, item_type, item_category, cert_type, price_value, school, tosogu_school, smith, tosogu_maker, artisan_id, title';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get('listingId');
  const collectionItemId = searchParams.get('collectionItemId');

  if (!listingId && !collectionItemId) {
    return NextResponse.json({ error: 'listingId or collectionItemId required' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  let item: MatchableItem;

  if (listingId) {
    // Fetch listing and verify dealer ownership
    const numId = parseInt(listingId, 10);
    if (isNaN(numId) || numId <= 0) {
      return NextResponse.json({ error: 'Invalid listingId' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listing, error } = await (serviceClient.from('listings') as any)
      .select(LISTING_SELECT)
      .eq('id', numId)
      .eq('dealer_id', auth.dealerId)
      .eq('source', 'dealer')
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    item = listing as MatchableItem;
  } else {
    // Fetch collection item and verify ownership
    const { data: colItem, error } = await selectCollectionItemSingle(
      serviceClient, 'id', collectionItemId!, COLLECTION_ITEM_SELECT
    );

    if (error || !colItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (colItem.owner_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    item = colItem as MatchableItem;
  }

  // Fetch all active saved searches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: searches } = await (serviceClient.from('saved_searches') as any)
    .select('id, user_id, search_criteria')
    .eq('is_active', true)
    .neq('notification_frequency', 'none') as { data: SavedSearchRow[] | null; error: unknown };

  if (!searches || !Array.isArray(searches)) {
    return NextResponse.json({ totalCollectors: 0, facets: { itemTypes: [], certifications: [], schools: [], priceRanges: [], queries: [] } });
  }

  const matchResult = matchItemAgainstSearches(item, searches);
  const summary = aggregateCriteria(matchResult, item);

  return NextResponse.json(summary);
}
