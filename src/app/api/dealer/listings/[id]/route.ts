import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { getArtisanEliteStats } from '@/lib/featured/scoring';
import { sanitizeKoshirae } from '@/lib/dealer/sanitizeKoshirae';
import { sanitizeSayagaki, sanitizeHakogaki, sanitizeProvenance, sanitizeKiwame, sanitizeKantoHibisho } from '@/lib/dealer/sanitizeSections';
import { selectItemVideos } from '@/lib/supabase/itemVideos';
import { videoProvider, isVideoProviderConfigured } from '@/lib/video/videoProvider';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dealer/listings/[id]
 * Fetch a single dealer listing for editing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  // Use service client to bypass RLS — migration 098 blocks source='dealer' from
  // anon/authenticated reads. Auth is already verified above via verifyDealer().
  const serviceClient = createServiceClient();

  const { data: listing, error } = await (serviceClient.from('listings') as any)
    .select('id, item_uuid, title, title_en, title_ja, item_type, item_category, cert_type, cert_session, price_value, price_currency, description, artisan_id, smith, tosogu_maker, school, tosogu_school, era, province, mei_type, mei_text, mei_guaranteed, nakago_type, nagasa_cm, motohaba_cm, sakihaba_cm, sori_cm, height_cm, width_cm, material, images, sayagaki, hakogaki, koshirae, provenance, kiwame, kanto_hibisho, research_notes, hero_image_index, setsumei_text_en, setsumei_text_ja, ai_curator_note_en, ai_curator_note_ja, ai_curator_headline_en, ai_curator_headline_ja, status, is_available, is_sold, source, dealer_id')
    .eq('id', listingId)
    .eq('dealer_id', auth.dealerId)
    .eq('source', 'dealer')
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Enrich with videos from item_videos (keyed by item_uuid, no FK for nested select)
  let videos: unknown[] = [];
  const itemUuid = (listing as { item_uuid?: string }).item_uuid;
  if (itemUuid) {
    const { data: videoRows } = await selectItemVideos(
      serviceClient, 'item_uuid', itemUuid, '*',
      { column: 'sort_order', ascending: true }
    );
    if (videoRows && videoRows.length > 0) {
      videos = videoRows
        .filter(v => v.status === 'ready')
        .map(v => ({
          id: v.id,
          listing_id: listingId,
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
          stream_url: v.stream_url
            || (isVideoProviderConfigured() ? videoProvider.getStreamUrl(v.provider_id) : undefined),
        }));
    }
  }

  return NextResponse.json({ ...listing, videos });
}

// Fields that dealers are allowed to update
const ALLOWED_FIELDS = new Set([
  'title', 'title_en', 'title_ja', 'description',
  'price_value', 'price_currency',
  'cert_type', 'cert_session', 'item_type', 'item_category',
  'smith', 'tosogu_maker', 'school', 'tosogu_school',
  'artisan_id',
  'era', 'province', 'mei_type', 'mei_text', 'mei_guaranteed', 'nakago_type',
  'nagasa_cm', 'motohaba_cm', 'sakihaba_cm', 'sori_cm',
  'height_cm', 'width_cm', 'material',
  'sayagaki',
  'hakogaki',
  'koshirae',
  'provenance',
  'kiwame',
  'kanto_hibisho',
  'research_notes',
  'hero_image_index',
  'ai_curator_note_en',
  'ai_curator_note_ja',
  'ai_curator_headline_en',
  'ai_curator_headline_ja',
  'setsumei_text_en',
  'setsumei_text_ja',
  // Note: 'images' intentionally excluded — managed exclusively via /api/dealer/images
]);

/**
 * PATCH /api/dealer/listings/[id]
 * Update a dealer listing.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  // Verify listing belongs to this dealer and is dealer-sourced
  // Use service client — RLS blocks source='dealer' reads (migration 098)
  const serviceClient = createServiceClient();
  const { data: listing } = await (serviceClient.from('listings') as any)
    .select('id, dealer_id, source, status')
    .eq('id', listingId)
    .single();

  if (!listing || listing.dealer_id !== auth.dealerId || listing.source !== 'dealer') {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
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

  // Sanitize JSONB fields — whitelist every nested field, enforce length limits
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

  // Sanitize hero_image_index — must be non-negative integer or null
  if ('hero_image_index' in updates) {
    const idx = updates.hero_image_index;
    updates.hero_image_index = (typeof idx === 'number' && idx >= 0) ? Math.floor(idx) : null;
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
  } else if (body.status === 'HOLD') {
    updates.status = 'HOLD';
    updates.is_available = false;
    updates.is_sold = false;
  } else if (body.status === 'AVAILABLE') {
    updates.status = 'AVAILABLE';
    updates.is_available = true;
    updates.is_sold = false;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Sync elite stats from Yuhinkai when artisan_id changes
  if (updates.artisan_id && typeof updates.artisan_id === 'string') {
    updates.artisan_confidence = 'HIGH';
    updates.artisan_method = 'dealer_manual';
    const eliteStats = await getArtisanEliteStats(updates.artisan_id);
    if (eliteStats) {
      updates.artisan_elite_factor = eliteStats.elite_factor;
      updates.artisan_elite_count = eliteStats.elite_count;
      updates.artisan_designation_factor = eliteStats.designation_factor;
    } else {
      updates.artisan_elite_factor = 0;
      updates.artisan_elite_count = 0;
      updates.artisan_designation_factor = 0;
    }
  }

  const { data, error } = await (serviceClient.from('listings') as any)
    .update(updates)
    .eq('id', listingId)
    .select('id, url, title, item_type, price_value, price_currency, images, status, is_available, is_sold')
    .single();

  if (error) {
    console.error('[dealer/listings/[id]] Update error:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/dealer/listings/[id]
 * Delete a dealer listing (only inventory/withdrawn items).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  // Verify listing belongs to this dealer
  // Use service client — RLS blocks source='dealer' reads (migration 098)
  const serviceClient = createServiceClient();
  const { data: listing } = await (serviceClient.from('listings') as any)
    .select('id, dealer_id, source, status, item_uuid')
    .eq('id', listingId)
    .single();

  if (!listing || listing.dealer_id !== auth.dealerId || listing.source !== 'dealer') {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Only allow deletion of inventory (unlisted) items
  if (listing.status !== 'INVENTORY' && listing.status !== 'WITHDRAWN') {
    return NextResponse.json(
      { error: 'Only inventory items can be deleted. Move to inventory first.' },
      { status: 400 }
    );
  }

  // Clean up Bunny videos before deleting (item_videos has no CASCADE from listings)
  if (isVideoProviderConfigured() && listing.item_uuid) {
    const { data: videos } = await selectItemVideos(
      serviceClient, 'item_uuid', listing.item_uuid, 'id, provider_id'
    );
    if (videos && videos.length > 0) {
      await Promise.all(
        videos.map(v =>
          videoProvider.deleteVideo(v.provider_id).catch(err =>
            console.error(`Failed to delete Bunny video ${v.provider_id}:`, err)
          )
        )
      );
      // Delete item_videos rows (no CASCADE since no FK to listings)
      await Promise.all(
        videos.map(v =>
          (serviceClient.from('item_videos' as any) as any).delete().eq('id', v.id)
        )
      );
    }
  }

  const { error } = await (serviceClient.from('listings') as any)
    .delete()
    .eq('id', listingId);

  if (error) {
    console.error('[dealer/listings/[id]] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
