import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dealer/listings/counts
 * Returns counts for all 4 dealer tabs in a single call.
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  const serviceClient = createServiceClient();

  // Fire all 4 count queries in parallel (head: true = no data, just count)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = () => (serviceClient.from('listings') as any)
    .select('id', { count: 'exact', head: true })
    .eq('dealer_id', auth.dealerId)
    .eq('source', 'dealer');

  const [inventory, available, hold, sold] = await Promise.all([
    base().eq('is_available', false).eq('is_sold', false).neq('status', 'HOLD'),
    base().eq('is_available', true).eq('is_sold', false),
    base().eq('status', 'HOLD'),
    base().eq('is_sold', true),
  ]);

  return NextResponse.json({
    inventory: inventory.count ?? 0,
    available: available.count ?? 0,
    hold: hold.count ?? 0,
    sold: sold.count ?? 0,
  });
}
