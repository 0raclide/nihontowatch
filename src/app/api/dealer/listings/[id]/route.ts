import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
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

  const { data: listing, error } = await (supabase.from('listings') as any)
    .select('id, title, title_en, title_ja, item_type, item_category, cert_type, price_value, price_currency, description, artisan_id, artisan_display_name, artisan_name_kanji, smith, tosogu_maker, school, tosogu_school, era, province, mei_type, nagasa_cm, images, status, is_available, is_sold, source, dealer_id')
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
  'artisan_id', 'artisan_display_name', 'artisan_name_kanji',
  'era', 'province', 'mei_type', 'nagasa_cm',
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
  const { data: listing } = await (supabase.from('listings') as any)
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
  } else if (body.status === 'WITHDRAWN') {
    updates.status = 'WITHDRAWN';
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

  const serviceClient = createServiceClient();
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
 * Delete a dealer listing (only draft/withdrawn).
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
  const { data: listing } = await (supabase.from('listings') as any)
    .select('id, dealer_id, source, status')
    .eq('id', listingId)
    .single();

  if (!listing || listing.dealer_id !== auth.dealerId || listing.source !== 'dealer') {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Only allow deletion of withdrawn listings
  if (listing.status !== 'WITHDRAWN') {
    return NextResponse.json(
      { error: 'Only withdrawn listings can be deleted. Withdraw first.' },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();
  const { error } = await (serviceClient.from('listings') as any)
    .delete()
    .eq('id', listingId);

  if (error) {
    console.error('[dealer/listings/[id]] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
