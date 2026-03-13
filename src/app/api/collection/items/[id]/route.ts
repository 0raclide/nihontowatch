import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sanitizeKoshirae } from '@/lib/dealer/sanitizeKoshirae';
import { sanitizeSayagaki, sanitizeHakogaki, sanitizeProvenance, sanitizeKiwame, sanitizeKantoHibisho } from '@/lib/dealer/sanitizeSections';
import {
  selectCollectionItemSingle,
  updateCollectionItem,
  deleteCollectionItem,
  insertCollectionEvent,
} from '@/lib/supabase/collectionItems';
import { selectItemVideos, deleteItemVideo } from '@/lib/supabase/itemVideos';
import { videoProvider, isVideoProviderConfigured } from '@/lib/video/videoProvider';
import { checkCollectionAccess } from '@/lib/collection/access';

export const dynamic = 'force-dynamic';

const BUCKET = 'user-images';

/**
 * GET /api/collection/items/[id]
 * Fetch a single collection item.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const serviceClient = createServiceClient();
    const { data: item, error } = await selectCollectionItemSingle(
      serviceClient, 'id', id
    );

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check access: owner always has access; community users need matching visibility + tier
    const isOwner = user && item.owner_id === user.id;
    if (!isOwner) {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (item.visibility === 'private') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // For 'collectors' or 'dealers' visibility, check tier access
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single() as { data: { subscription_tier: string } | null };
      const tier = profile?.subscription_tier ?? 'free';
      if (item.visibility === 'dealers' && tier !== 'dealer') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (item.visibility === 'collectors' && tier !== 'inner_circle') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Enrich with videos from item_videos (separate table, no FK join)
    let videos: unknown[] = [];
    if (item.item_uuid) {
      const { data: videoRows } = await selectItemVideos(
        serviceClient, 'item_uuid', item.item_uuid, '*',
        { column: 'sort_order', ascending: true }
      );
      if (videoRows && videoRows.length > 0) {
        videos = videoRows
          .filter(v => v.status === 'ready')
          .map(v => ({
            id: v.id,
            listing_id: 0,
            provider: v.provider,
            provider_id: v.provider_id,
            duration_seconds: v.duration_seconds ?? undefined,
            width: v.width ?? undefined,
            height: v.height ?? undefined,
            thumbnail_url: v.thumbnail_url ?? undefined,
            status: v.status,
            sort_order: v.sort_order,
            original_filename: v.original_filename ?? undefined,
            size_bytes: v.size_bytes ?? undefined,
            created_at: v.created_at,
            stream_url: v.stream_url ?? undefined,
          }));
      }
    }

    return NextResponse.json({ ...item, videos });
  } catch (error) {
    logger.logError('Collection item GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Fields that users are allowed to update
const ALLOWED_FIELDS = new Set([
  'title', 'title_en', 'title_ja', 'description',
  'price_value', 'price_currency',
  'cert_type', 'cert_session', 'item_type', 'item_category',
  'smith', 'tosogu_maker', 'school', 'tosogu_school',
  'artisan_id',
  'era', 'province', 'mei_type', 'mei_text', 'mei_guaranteed', 'nakago_type',
  'nagasa_cm', 'motohaba_cm', 'sakihaba_cm', 'sori_cm',
  'height_cm', 'width_cm', 'material',
  'sayagaki', 'hakogaki', 'koshirae', 'provenance', 'kiwame', 'kanto_hibisho',
  'research_notes',
  'hero_image_index',
  'setsumei_text_en', 'setsumei_text_ja',
  'visibility', 'personal_notes',
  'ai_curator_note_en', 'ai_curator_note_ja',
  'ai_curator_headline_en', 'ai_curator_headline_ja',
  // Financial fields (vault table view)
  'purchase_price', 'purchase_currency', 'purchase_date', 'purchase_source',
  'current_value', 'current_currency', 'location',
  // Note: 'images' intentionally excluded — managed via /api/collection/images
]);

/**
 * PATCH /api/collection/items/[id]
 * Update a collection item.
 */
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

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();

    // Verify ownership
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', id, 'id, owner_id'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Filter to allowed fields only
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    // Sanitize JSONB fields
    if ('koshirae' in updates) {
      updates.koshirae = sanitizeKoshirae(updates.koshirae);
    }
    if ('sayagaki' in updates) {
      updates.sayagaki = sanitizeSayagaki(updates.sayagaki);
    }
    if ('hakogaki' in updates) {
      updates.hakogaki = sanitizeHakogaki(updates.hakogaki);
    }
    if ('provenance' in updates) {
      updates.provenance = sanitizeProvenance(updates.provenance);
    }
    if ('kiwame' in updates) {
      updates.kiwame = sanitizeKiwame(updates.kiwame);
    }
    if ('kanto_hibisho' in updates) {
      updates.kanto_hibisho = sanitizeKantoHibisho(updates.kanto_hibisho);
    }
    if ('research_notes' in updates) {
      const rn = updates.research_notes;
      updates.research_notes = typeof rn === 'string' ? rn.slice(0, 5000) || null : null;
    }

    // Sanitize hero_image_index
    if ('hero_image_index' in updates) {
      const idx = updates.hero_image_index;
      updates.hero_image_index = (typeof idx === 'number' && idx >= 0) ? Math.floor(idx) : null;
    }

    // Sanitize cert_session — TEXT in DB
    if ('cert_session' in updates) {
      updates.cert_session = updates.cert_session != null ? String(updates.cert_session) : null;
    }

    // Validate financial fields
    if ('purchase_price' in updates) {
      const pp = Number(updates.purchase_price);
      updates.purchase_price = (updates.purchase_price != null && !isNaN(pp) && pp >= 0) ? pp : null;
    }
    if ('current_value' in updates) {
      const cv = Number(updates.current_value);
      updates.current_value = (updates.current_value != null && !isNaN(cv) && cv >= 0) ? cv : null;
    }
    if ('purchase_currency' in updates) {
      const pc = updates.purchase_currency;
      updates.purchase_currency = (typeof pc === 'string' && pc.length <= 10) ? pc.toUpperCase() : null;
    }
    if ('current_currency' in updates) {
      const cc = updates.current_currency;
      updates.current_currency = (typeof cc === 'string' && cc.length <= 10) ? cc.toUpperCase() : null;
    }
    if ('purchase_date' in updates) {
      const pd = updates.purchase_date;
      if (pd && typeof pd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pd)) {
        updates.purchase_date = pd;
      } else {
        updates.purchase_date = null;
      }
    }
    if ('purchase_source' in updates) {
      const ps = updates.purchase_source;
      updates.purchase_source = (typeof ps === 'string') ? ps.slice(0, 500) || null : null;
    }
    if ('location' in updates) {
      const loc = updates.location;
      updates.location = (typeof loc === 'string') ? loc.slice(0, 500) || null : null;
    }

    // Validate visibility
    if ('visibility' in updates) {
      const v = updates.visibility;
      if (v !== 'private' && v !== 'collectors' && v !== 'dealers') {
        updates.visibility = 'private';
      }
    }

    // Handle status change side effects
    if (body.status === 'SOLD') {
      updates.status = 'SOLD';
      updates.is_available = false;
      updates.is_sold = true;
    } else if (body.status === 'INVENTORY') {
      updates.status = 'INVENTORY';
      updates.is_available = false;
      updates.is_sold = false;
    } else if (body.status === 'AVAILABLE') {
      updates.status = 'AVAILABLE';
      updates.is_available = true;
      updates.is_sold = false;
    }

    // Set artisan confidence when artisan changes
    if (updates.artisan_id && typeof updates.artisan_id === 'string') {
      updates.artisan_confidence = 'HIGH';
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await updateCollectionItem(serviceClient, id, updates);

    if (error) {
      logger.error('[collection/items/[id]] Update error:', { error });
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    // Log audit event
    await insertCollectionEvent(serviceClient, {
      item_uuid: item.item_uuid,
      actor_id: user.id,
      event_type: 'updated',
      payload: { fields: Object.keys(updates) },
    }).catch(err => logger.warn('Failed to log collection event', { error: err }));

    // Fetch updated item to return
    const { data: updated } = await selectCollectionItemSingle(serviceClient, 'id', id);

    return NextResponse.json(updated);
  } catch (error) {
    logger.logError('Collection item PATCH error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/collection/items/[id]
 * Delete a collection item with full cleanup.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    const serviceClient = createServiceClient();

    // Verify ownership and get images + item_uuid for cleanup
    const { data: item } = await selectCollectionItemSingle(
      serviceClient, 'id', id, 'id, owner_id, images, item_uuid'
    );

    if (!item || item.owner_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Log audit event BEFORE delete (so item_uuid FK still valid if needed)
    await insertCollectionEvent(serviceClient, {
      item_uuid: item.item_uuid,
      actor_id: user.id,
      event_type: 'deleted',
      payload: null,
    }).catch(err => logger.warn('Failed to log collection delete event', { error: err }));

    // Clean up storage images
    const images = (item.images as string[]) || [];
    const bucketMarker = `/${BUCKET}/`;
    const storagePaths = images
      .map(url => {
        if (typeof url !== 'string') return null;
        const idx = url.indexOf(bucketMarker);
        return idx !== -1 ? url.slice(idx + bucketMarker.length) : null;
      })
      .filter((p): p is string => p !== null);
    if (storagePaths.length > 0) {
      const { error: storageError } = await serviceClient.storage
        .from(BUCKET)
        .remove(storagePaths);
      if (storageError) {
        logger.warn('Failed to cleanup collection images', { error: storageError, itemId: id });
      }
    }

    // Clean up Bunny videos
    if (isVideoProviderConfigured() && item.item_uuid) {
      const { data: videos } = await selectItemVideos(
        serviceClient, 'item_uuid', item.item_uuid, 'id, provider_id'
      );
      if (videos && videos.length > 0) {
        await Promise.all(
          videos.map(v =>
            videoProvider.deleteVideo(v.provider_id).catch(err =>
              logger.warn(`Failed to delete Bunny video ${v.provider_id}`, { error: err })
            )
          )
        );
        await Promise.all(
          videos.map(v => deleteItemVideo(serviceClient, v.id))
        );
      }
    }

    // Delete the item
    const { error } = await deleteCollectionItem(serviceClient, id);

    if (error) {
      logger.error('[collection/items/[id]] Delete error:', { error });
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('Collection item DELETE error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
