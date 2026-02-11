import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: folders, error } = await supabase
      .from('user_collection_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Error fetching collection folders', { error });
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }

    return NextResponse.json({ folders: folders || [] });
  } catch (error) {
    logger.logError('Collection folders API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    // Max 50 folders per user
    const { count } = await supabase
      .from('user_collection_folders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (count && count >= 50) {
      return NextResponse.json({ error: 'Maximum of 50 folders allowed' }, { status: 400 });
    }

    const { data: folder, error } = await supabase
      .from('user_collection_folders')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description || null,
      } as never)
      .select()
      .single();

    if (error) {
      logger.error('Error creating folder', { error });
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    logger.logError('Create folder error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
