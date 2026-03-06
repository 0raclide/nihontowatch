import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { getArtisanEliteStats } from '@/lib/featured/scoring';
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
    .select('id, title, title_en, title_ja, item_type, item_category, cert_type, price_value, price_currency, description, artisan_id, smith, tosogu_maker, school, tosogu_school, era, province, mei_type, nakago_type, nagasa_cm, motohaba_cm, sakihaba_cm, sori_cm, height_cm, width_cm, material, images, sayagaki, koshirae, status, is_available, is_sold, source, dealer_id')
    .eq('id', listingId)
    .eq('dealer_id', auth.dealerId)
    .eq('source', 'dealer')
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  return NextResponse.json(listing);
}

// Fields that dealers are allowed to update
const ALLOWED_FIELDS = new Set([
  'title', 'title_en', 'title_ja', 'description',
  'price_value', 'price_currency',
  'cert_type', 'item_type', 'item_category',
  'smith', 'tosogu_maker', 'school', 'tosogu_school',
  'artisan_id',
  'era', 'province', 'mei_type', 'nakago_type',
  'nagasa_cm', 'motohaba_cm', 'sakihaba_cm', 'sori_cm',
  'height_cm', 'width_cm', 'material',
  'sayagaki',
  'koshirae',
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
    .select('id, dealer_id, source, status')
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
  const { error } = await (serviceClient.from('listings') as any)
    .delete()
    .eq('id', listingId);

  if (error) {
    console.error('[dealer/listings/[id]] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
