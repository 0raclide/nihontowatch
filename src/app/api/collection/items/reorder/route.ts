import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { collectionItemsFrom } from '@/lib/supabase/collectionItems';
import { checkCollectionAccess } from '@/lib/collection/access';

export const dynamic = 'force-dynamic';

interface ReorderItem {
  id: string;
  sort_order: number;
}

/**
 * POST /api/collection/items/reorder
 * Batch update sort_order for collection items.
 * Body: { items: [{ id: string, sort_order: number }] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    let body: { items?: ReorderItem[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { items } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    if (items.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 items per request' }, { status: 400 });
    }

    // Validate shape
    for (const item of items) {
      if (!item.id || typeof item.sort_order !== 'number') {
        return NextResponse.json(
          { error: 'Each item must have id (string) and sort_order (number)' },
          { status: 400 }
        );
      }
    }

    const serviceClient = createServiceClient();

    // Verify all items belong to the authenticated user
    const itemIds = items.map(i => i.id);
    const { data: owned, error: verifyError } = await collectionItemsFrom(serviceClient)
      .select('id')
      .eq('owner_id', user.id)
      .in('id', itemIds);

    if (verifyError) {
      logger.error('Reorder ownership verification error', { error: verifyError });
      return NextResponse.json({ error: 'Failed to verify ownership' }, { status: 500 });
    }

    const ownedIds = new Set((owned || []).map((r: { id: string }) => r.id));
    const unauthorized = itemIds.filter(id => !ownedIds.has(id));
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { error: 'Some items do not belong to you', unauthorized },
        { status: 403 }
      );
    }

    // Batch update sort_order — awaited per Critical Rule #9
    const results = await Promise.all(
      items.map(item =>
        collectionItemsFrom(serviceClient)
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
          .eq('owner_id', user.id)
      )
    );

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      logger.error('Reorder batch update errors', { errors: errors.map(e => e.error) });
      return NextResponse.json(
        { error: `Failed to update ${errors.length} items` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, updated: items.length });
  } catch (error) {
    logger.logError('Reorder API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
