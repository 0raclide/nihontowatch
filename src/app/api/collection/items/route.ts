import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sanitizeKoshirae } from '@/lib/dealer/sanitizeKoshirae';
import { sanitizeSayagaki, sanitizeHakogaki, sanitizeProvenance, sanitizeKiwame, sanitizeKantoHibisho } from '@/lib/dealer/sanitizeSections';
import {
  collectionItemsFrom,
  insertCollectionItem,
  insertCollectionEvent,
} from '@/lib/supabase/collectionItems';
import { checkCollectionAccess } from '@/lib/collection/access';

export const dynamic = 'force-dynamic';

// Nihonto (swords/blades)
const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi', 'ken', 'naginata naoshi', 'sword'];

// Tosogu (fittings)
const TOSOGU_TYPES = [
  'tsuba', 'fuchi-kashira', 'fuchi_kashira', 'fuchi', 'kashira',
  'kozuka', 'kogatana', 'kogai', 'menuki', 'koshirae', 'tosogu',
  'mitokoromono', 'gotokoromono',
];

interface CollectionFilters {
  category?: 'nihonto' | 'tosogu';
  itemType?: string;
  certType?: string;
  era?: string;
  meiType?: string;
  sort: 'newest' | 'value_desc' | 'value_asc' | 'type';
  page: number;
  limit: number;
}

function parseFilters(searchParams: URLSearchParams): CollectionFilters {
  return {
    category: (searchParams.get('category') as CollectionFilters['category']) || undefined,
    itemType: searchParams.get('type') || undefined,
    certType: searchParams.get('cert') || undefined,
    era: searchParams.get('era') || undefined,
    meiType: searchParams.get('meiType') || undefined,
    sort: (searchParams.get('sort') as CollectionFilters['sort']) || 'newest',
    page: Number(searchParams.get('page')) || 1,
    limit: Math.min(Number(searchParams.get('limit')) || 100, 200),
  };
}

/**
 * GET /api/collection/items
 * Fetch authenticated user's collection items with filters and facets.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();
    const filters = parseFilters(request.nextUrl.searchParams);
    const safePage = Math.max(1, filters.page || 1);
    const offset = (safePage - 1) * filters.limit;

    // Build main query
    let query = collectionItemsFrom(serviceClient)
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id);

    // Apply filters
    if (filters.category) {
      const categoryTypes = filters.category === 'nihonto' ? NIHONTO_TYPES : TOSOGU_TYPES;
      query = query.in('item_type', categoryTypes);
    }
    if (filters.itemType) {
      query = query.ilike('item_type', filters.itemType);
    }
    if (filters.certType) {
      query = query.eq('cert_type', filters.certType);
    }
    if (filters.era) {
      query = query.ilike('era', `%${filters.era}%`);
    }
    if (filters.meiType) {
      query = query.eq('mei_type', filters.meiType);
    }

    // Sort
    switch (filters.sort) {
      case 'value_desc':
        query = query.order('price_value', { ascending: false, nullsFirst: false });
        break;
      case 'value_asc':
        query = query.order('price_value', { ascending: true, nullsFirst: false });
        break;
      case 'type':
        query = query.order('item_type', { ascending: true, nullsFirst: false });
        break;
      default: // 'newest'
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + filters.limit - 1);

    const { data: items, error, count } = await query;

    if (error) {
      logger.error('Collection items query error', { error });
      return NextResponse.json({ error: 'Failed to fetch collection items' }, { status: 500 });
    }

    // Compute facets (all items for this user, ignoring current filters)
    const { data: allItems } = await collectionItemsFrom(serviceClient)
      .select('item_type, cert_type, era, mei_type')
      .eq('owner_id', user.id);

    const facets = computeFacets(allItems || []);

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

/**
 * POST /api/collection/items
 * Create a new collection item.
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

    const serviceClient = createServiceClient();

    // Max 500 items per user
    const { count, error: countError } = await collectionItemsFrom(serviceClient)
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id);

    if (countError) {
      logger.error('Error counting collection items', { error: countError });
    } else if (count && count >= 500) {
      return NextResponse.json(
        { error: 'Maximum of 500 collection items allowed' },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      title,
      title_en,
      title_ja,
      item_type,
      item_category,
      cert_type,
      price_value,
      price_currency,
      description,
      artisan_id,
      smith,
      tosogu_maker,
      school,
      tosogu_school,
      era,
      province,
      mei_type,
      mei_text,
      mei_guaranteed,
      nakago_type,
      nagasa_cm,
      motohaba_cm,
      sakihaba_cm,
      sori_cm,
      height_cm,
      width_cm,
      material,
      status: requestedStatus,
      cert_session,
      sayagaki,
      hakogaki,
      koshirae,
      provenance,
      kiwame,
      kanto_hibisho,
      research_notes,
      setsumei_text_en,
      setsumei_text_ja,
      hero_image_index,
      images: initialImages,
      personal_notes,
      source_listing_id,
    } = body;

    // Build collection item row
    const itemData: Record<string, unknown> = {
      owner_id: user.id,
      title: title ?? null,
      title_en: title_en ?? null,
      title_ja: title_ja ?? null,
      item_type: item_type ?? null,
      item_category: item_category ?? null,
      cert_type: cert_type ?? null,
      cert_session: cert_session != null ? String(cert_session) : null,
      price_value: price_value ?? null,
      price_currency: price_currency ?? 'JPY',
      description: description ?? null,
      era: era ?? null,
      province: province ?? null,
      mei_type: mei_type ?? null,
      mei_text: mei_text ?? null,
      mei_guaranteed: mei_guaranteed ?? null,
      nakago_type: nakago_type ?? null,
      nagasa_cm: nagasa_cm ?? null,
      motohaba_cm: motohaba_cm ?? null,
      sakihaba_cm: sakihaba_cm ?? null,
      sori_cm: sori_cm ?? null,
      status: requestedStatus === 'AVAILABLE' ? 'AVAILABLE' : 'INVENTORY',
      is_available: requestedStatus === 'AVAILABLE',
      is_sold: false,
      images: Array.isArray(initialImages) && initialImages.length > 0 ? initialImages : [],
      hero_image_index: (typeof hero_image_index === 'number' && hero_image_index >= 0) ? Math.floor(hero_image_index) : null,
      sayagaki: sanitizeSayagaki(sayagaki),
      hakogaki: sanitizeHakogaki(hakogaki),
      koshirae: sanitizeKoshirae(koshirae),
      provenance: sanitizeProvenance(provenance),
      kiwame: sanitizeKiwame(kiwame),
      kanto_hibisho: sanitizeKantoHibisho(kanto_hibisho),
      research_notes: typeof research_notes === 'string' ? research_notes.slice(0, 5000) || null : null,
      setsumei_text_en: setsumei_text_en ?? null,
      setsumei_text_ja: setsumei_text_ja ?? null,
      visibility: 'private',
      personal_notes: personal_notes ?? null,
      source_listing_id: source_listing_id ?? null,
    };

    // Route artisan fields based on category
    if (item_category === 'tosogu') {
      itemData.tosogu_maker = smith || tosogu_maker || null;
      itemData.tosogu_school = school || tosogu_school || null;
      itemData.height_cm = height_cm ?? null;
      itemData.width_cm = width_cm ?? null;
      itemData.material = material ?? null;
    } else {
      itemData.smith = smith || null;
      itemData.school = school || null;
    }

    // Set artisan fields if provided (no elite stats sync for collection items)
    if (artisan_id) {
      itemData.artisan_id = artisan_id;
      itemData.artisan_confidence = 'HIGH';
    }

    const { data, error } = await insertCollectionItem(serviceClient, itemData);

    if (error) {
      logger.error('[collection/items] Insert error:', { error });
      return NextResponse.json({ error: 'Failed to create collection item' }, { status: 500 });
    }

    // Log audit event
    if (data) {
      await insertCollectionEvent(serviceClient, {
        item_uuid: data.item_uuid,
        actor_id: user.id,
        event_type: 'created',
        payload: null,
      }).catch(err => logger.warn('Failed to log collection event', { error: err }));
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logger.logError('Create collection item error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Compute facet counts from all user items
function computeFacets(items: Array<Record<string, unknown>>) {
  const itemTypes = new Map<string, number>();
  const certifications = new Map<string, number>();
  const historicalPeriods = new Map<string, number>();
  const signatureStatuses = new Map<string, number>();

  for (const item of items) {
    if (item.item_type) {
      const t = (item.item_type as string).toLowerCase();
      itemTypes.set(t, (itemTypes.get(t) || 0) + 1);
    }
    if (item.cert_type) {
      const c = item.cert_type as string;
      certifications.set(c, (certifications.get(c) || 0) + 1);
    }
    if (item.era) {
      const e = item.era as string;
      historicalPeriods.set(e, (historicalPeriods.get(e) || 0) + 1);
    }
    if (item.mei_type) {
      const m = item.mei_type as string;
      signatureStatuses.set(m, (signatureStatuses.get(m) || 0) + 1);
    }
  }

  const toArray = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    itemTypes: toArray(itemTypes),
    certifications: toArray(certifications),
    historicalPeriods: toArray(historicalPeriods),
    signatureStatuses: toArray(signatureStatuses),
  };
}
