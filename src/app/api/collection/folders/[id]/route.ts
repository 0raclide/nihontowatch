import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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

    const { data: existing } = await (supabase
      .from('user_collection_folders') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id, user_id')
      .eq('id', id)
      .single() as { data: { id: string; user_id: string } | null };

    if (!existing) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    if (existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data: folder, error } = await supabase
      .from('user_collection_folders')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating folder', { error });
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    logger.logError('Folder PATCH error', error);
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

    const { data: existing } = await (supabase
      .from('user_collection_folders') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id, user_id')
      .eq('id', id)
      .single() as { data: { id: string; user_id: string } | null };

    if (!existing) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    if (existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Unassign items from this folder (set folder_id to null)
    await supabase
      .from('user_collection_items')
      .update({ folder_id: null } as never)
      .eq('folder_id', id)
      .eq('user_id', user.id);

    const { error } = await supabase
      .from('user_collection_folders')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting folder', { error });
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Folder DELETE error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
