import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { CreateCollectionItemInput, CollectionFilters } from '@/types/collection';

export const dynamic = 'force-dynamic';

function parseFilters(searchParams: URLSearchParams): CollectionFilters {
  return {
    itemType: searchParams.get('type') || undefined,
    certType: searchParams.get('cert') || undefined,
    status: (searchParams.get('status') as CollectionFilters['status']) || undefined,
    condition: (searchParams.get('condition') as CollectionFilters['condition']) || undefined,
    folderId: searchParams.get('folder') || undefined,
    sort: (searchParams.get('sort') as CollectionFilters['sort']) || 'newest',
    page: Number(searchParams.get('page')) || 1,
    limit: Math.min(Number(searchParams.get('limit')) || 100, 200),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const filters = parseFilters(request.nextUrl.searchParams);
    const safePage = Math.max(1, filters.page || 1);
    const offset = (safePage - 1) * filters.limit!;

    // Build main query
    let query = (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply filters
    if (filters.itemType) {
      query = query.ilike('item_type', filters.itemType);
    }
    if (filters.certType) {
      query = query.eq('cert_type', filters.certType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.condition) {
      query = query.eq('condition', filters.condition);
    }
    if (filters.folderId) {
      query = query.eq('folder_id', filters.folderId);
    }

    // Sort
    switch (filters.sort) {
      case 'value_desc':
        query = query.order('current_value', { ascending: false, nullsFirst: false });
        break;
      case 'value_asc':
        query = query.order('current_value', { ascending: true, nullsFirst: false });
        break;
      case 'type':
        query = query.order('item_type', { ascending: true, nullsFirst: false });
        break;
      default: // 'newest'
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + filters.limit! - 1);

    const { data: items, error, count } = await query as { data: Record<string, unknown>[] | null; error: { message: string } | null; count: number | null };

    if (error) {
      logger.error('Collection items query error', { error });
      return NextResponse.json({ error: 'Failed to fetch collection items' }, { status: 500 });
    }

    // Compute facets (all items for this user, ignoring current filters)
    const { data: allItems } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('item_type, cert_type, status, condition, folder_id')
      .eq('user_id', user.id) as { data: Record<string, unknown>[] | null };

    const facets = computeFacets(allItems || []);

    // Get folder names for facets
    if (facets.folders.length > 0) {
      const folderIds = facets.folders.map(f => f.id);
      const { data: folders } = await (supabase
        .from('user_collection_folders') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
        .select('id, name')
        .in('id', folderIds) as { data: { id: string; name: string }[] | null };
      if (folders) {
        const nameMap = new Map(folders.map(f => [f.id, f.name]));
        facets.folders = facets.folders.map(f => ({
          ...f,
          name: nameMap.get(f.id) || 'Unknown',
        }));
      }
    }

    return NextResponse.json({
      data: items || [],
      total: count || 0,
      facets,
    });
  } catch (error) {
    logger.logError('Collection items API error', error);
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

    const body: CreateCollectionItemInput = await request.json();

    // Max 500 items per user
    const { count, error: countError } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id) as { count: number | null; error: { message: string } | null };

    if (countError) {
      logger.error('Error counting collection items', { error: countError });
    } else if (count && count >= 500) {
      return NextResponse.json(
        { error: 'Maximum of 500 collection items allowed' },
        { status: 400 }
      );
    }

    const { data: item, error } = await (supabase
      .from('user_collection_items') as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        user_id: user.id,
        source_listing_id: body.source_listing_id || null,
        item_type: body.item_type || null,
        title: body.title || null,
        artisan_id: body.artisan_id || null,
        artisan_display_name: body.artisan_display_name || null,
        cert_type: body.cert_type || null,
        cert_session: body.cert_session || null,
        cert_organization: body.cert_organization || null,
        smith: body.smith || null,
        school: body.school || null,
        province: body.province || null,
        era: body.era || null,
        mei_type: body.mei_type || null,
        nagasa_cm: body.nagasa_cm || null,
        sori_cm: body.sori_cm || null,
        motohaba_cm: body.motohaba_cm || null,
        sakihaba_cm: body.sakihaba_cm || null,
        price_paid: body.price_paid || null,
        price_paid_currency: body.price_paid_currency || null,
        current_value: body.current_value || null,
        current_value_currency: body.current_value_currency || null,
        acquired_date: body.acquired_date || null,
        acquired_from: body.acquired_from || null,
        condition: body.condition || 'good',
        status: body.status || 'owned',
        notes: body.notes || null,
        images: body.images || [],
        catalog_reference: body.catalog_reference || null,
        is_public: body.is_public || false,
        folder_id: body.folder_id || null,
      } as never)
      .select()
      .single() as { data: Record<string, unknown> | null; error: { message: string } | null };

    if (error) {
      logger.error('Error creating collection item', { error });
      return NextResponse.json({ error: 'Failed to create collection item' }, { status: 500 });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    logger.logError('Create collection item error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Compute facet counts from all user items
function computeFacets(items: Array<Record<string, unknown>>) {
  const itemTypes = new Map<string, number>();
  const certifications = new Map<string, number>();
  const statuses = new Map<string, number>();
  const conditions = new Map<string, number>();
  const folders = new Map<string, number>();

  for (const item of items) {
    if (item.item_type) {
      const t = (item.item_type as string).toLowerCase();
      itemTypes.set(t, (itemTypes.get(t) || 0) + 1);
    }
    if (item.cert_type) {
      const c = item.cert_type as string;
      certifications.set(c, (certifications.get(c) || 0) + 1);
    }
    if (item.status) {
      const s = item.status as string;
      statuses.set(s, (statuses.get(s) || 0) + 1);
    }
    if (item.condition) {
      const co = item.condition as string;
      conditions.set(co, (conditions.get(co) || 0) + 1);
    }
    if (item.folder_id) {
      const f = item.folder_id as string;
      folders.set(f, (folders.get(f) || 0) + 1);
    }
  }

  const toArray = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    itemTypes: toArray(itemTypes),
    certifications: toArray(certifications),
    statuses: toArray(statuses),
    conditions: toArray(conditions),
    folders: Array.from(folders.entries())
      .map(([id, count]) => ({ id, name: '', count }))
      .sort((a, b) => b.count - a.count),
  };
}
