import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dealer/listings
 * Fetch dealer's own listings with tab filter.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'available';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('listings') as any)
    .select('id, url, title, title_en, title_ja, item_type, item_category, price_value, price_currency, cert_type, images, status, is_available, is_sold, first_seen_at, smith, tosogu_maker, school, tosogu_school, artisan_id, artisan_confidence, description, era, province, mei_type, nagasa_cm, dealers:dealers(id, name, name_ja, domain)', { count: 'exact' })
    .eq('dealer_id', auth.dealerId)
    .eq('source', 'dealer');

  // Tab filters
  switch (tab) {
    case 'available':
      query = query.eq('is_available', true).eq('is_sold', false);
      break;
    case 'sold':
      query = query.eq('is_sold', true);
      break;
    case 'withdrawn':
      query = query.eq('is_available', false).eq('is_sold', false);
      break;
    // 'all' — no filter
  }

  query = query.order('first_seen_at', { ascending: false });

  const { data: listings, error, count } = await query
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }

  return NextResponse.json({
    listings: listings || [],
    total: count || 0,
    page,
    limit,
  });
}

/**
 * POST /api/dealer/listings
 * Create a new dealer listing.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
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
    item_category, // 'nihonto' or 'tosogu'
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
    nagasa_cm,
  } = body;

  // Synthetic URL for UNIQUE NOT NULL constraint
  const syntheticUrl = `nw://dealer/${auth.dealerId}/${crypto.randomUUID()}`;

  const serviceClient = createServiceClient();

  // Build listing row
  const listingData: Record<string, unknown> = {
    url: syntheticUrl,
    dealer_id: auth.dealerId,
    source: 'dealer',
    title,
    title_en: title_en ?? null,
    title_ja: title_ja ?? null,
    item_type: item_type ?? null,
    item_category: item_category ?? null,
    cert_type: cert_type ?? null,
    price_value: price_value ?? null,
    price_currency: price_currency ?? 'JPY',
    description: description ?? null,
    era: era ?? null,
    province: province ?? null,
    mei_type: mei_type ?? null,
    nagasa_cm: nagasa_cm ?? null,
    status: 'AVAILABLE',
    is_available: true,
    is_sold: false,
    page_exists: true,
    is_initial_import: false,
    images: [],
    scrape_count: 0,
  };

  // Route artisan fields based on category
  if (item_category === 'tosogu') {
    listingData.tosogu_maker = smith || tosogu_maker || null;
    listingData.tosogu_school = school || tosogu_school || null;
  } else {
    listingData.smith = smith || null;
    listingData.school = school || null;
  }

  // Set artisan fields if provided
  // Note: artisan_admin_locked is NOT set here — that flag is only for admin corrections.
  // Dealer-set artisans are protected by source='dealer' guards in Oshi-scrapper instead.
  if (artisan_id) {
    listingData.artisan_id = artisan_id;
    listingData.artisan_confidence = 'HIGH';
    listingData.artisan_method = 'dealer_manual';
  }

  const { data, error } = await (serviceClient.from('listings') as any)
    .insert(listingData)
    .select('id, url, title, item_type, price_value, price_currency, images, status, is_available, is_sold, first_seen_at')
    .single();

  if (error) {
    console.error('[dealer/listings] Insert error:', error);
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
