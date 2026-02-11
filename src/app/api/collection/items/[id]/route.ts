import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { UpdateCollectionItemInput } from '@/types/collection';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Fetch the item
    const { data: item, error } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('*')
      .eq('id', id)
      .single() as { data: Record<string, unknown> | null; error: { message: string } | null };

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check access: owner or public
    const isOwner = user && item.user_id === user.id;
    if (!isOwner && !item.is_public) {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    logger.logError('Collection item GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id, user_id')
      .eq('id', id)
      .single() as { data: { id: string; user_id: string } | null; error: { message: string } | null };

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: UpdateCollectionItemInput = await request.json();

    // Build update object — only include fields that were provided
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'item_type', 'title', 'artisan_id', 'artisan_display_name',
      'cert_type', 'cert_session', 'cert_organization',
      'smith', 'school', 'province', 'era', 'mei_type',
      'nagasa_cm', 'sori_cm', 'motohaba_cm', 'sakihaba_cm',
      'price_paid', 'price_paid_currency', 'current_value', 'current_value_currency',
      'acquired_date', 'acquired_from', 'condition', 'status', 'notes',
      'images', 'catalog_reference', 'is_public', 'folder_id', 'sort_order',
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: item, error } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single() as { data: Record<string, unknown> | null; error: { message: string } | null };

    if (error) {
      logger.error('Error updating collection item', { error });
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    logger.logError('Collection item PATCH error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership and get images for cleanup
    const { data: existing, error: fetchError } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id, user_id, images')
      .eq('id', id)
      .single() as { data: { id: string; user_id: string; images: string[] | null } | null; error: { message: string } | null };

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cleanup storage images
    const images = (existing.images as string[]) || [];
    if (images.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('collection-images')
        .remove(images);
      if (storageError) {
        logger.warn('Failed to cleanup collection images', { error: storageError, itemId: id });
      }
    }

    // Delete the item
    const { error } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .delete()
      .eq('id', id) as { error: { message: string } | null };

    if (error) {
      logger.error('Error deleting collection item', { error });
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Collection item DELETE error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
