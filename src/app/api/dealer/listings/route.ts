import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { getArtisanEliteStats } from '@/lib/featured/scoring';
import { sanitizeKoshirae } from '@/lib/dealer/sanitizeKoshirae';
import { NextRequest, NextResponse } from 'next/server';
import { getArtisanNames } from '@/lib/supabase/yuhinkai';
import { getArtisanDisplayName, getArtisanDisplayNameKanji, getArtisanAlias } from '@/lib/artisan/displayName';
import { getArtisanTier } from '@/lib/artisan/tier';
import { getAttributionName } from '@/lib/listing/attribution';

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
  const tab = searchParams.get('tab') || 'inventory';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  // Use service client to bypass RLS — migration 098 blocks source='dealer' from
  // anon/authenticated reads. Auth is already verified above via verifyDealer().
  const serviceClient = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (serviceClient.from('listings') as any)
    .select('id, url, title, title_en, title_ja, item_type, item_category, price_value, price_currency, cert_type, images, status, is_available, is_sold, first_seen_at, smith, tosogu_maker, school, tosogu_school, artisan_id, artisan_confidence, description, era, province, mei_type, mei_text, mei_guaranteed, nakago_type, nagasa_cm, motohaba_cm, sakihaba_cm, sori_cm, height_cm, width_cm, material, source, dealers:dealers(id, name, name_ja, domain)', { count: 'exact' })
    .eq('dealer_id', auth.dealerId)
    .eq('source', 'dealer');

  // Tab filters — 4-state lifecycle: Inventory → For Sale → Hold → Sold
  switch (tab) {
    case 'inventory':
      query = query.eq('is_available', false).eq('is_sold', false).neq('status', 'HOLD');
      break;
    case 'available':
      query = query.eq('is_available', true).eq('is_sold', false);
      break;
    case 'hold':
      query = query.eq('status', 'HOLD');
      break;
    case 'sold':
      query = query.eq('is_sold', true);
      break;
  }

  query = query.order('first_seen_at', { ascending: false });

  const { data: listings, error, count } = await query
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[dealer/listings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }

  // Fetch dealer name for header display
  const { data: dealer } = await (supabase.from('dealers') as any)
    .select('name, name_ja')
    .eq('id', auth.dealerId)
    .single();

  // Enrich listings with artisan display names from Yuhinkai
  let enrichedListings = listings || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artisanCodes = [...new Set(enrichedListings.map((l: any) => l.artisan_id).filter(Boolean))] as string[];
  if (artisanCodes.length > 0) {
    const artisanNameMap = await getArtisanNames(artisanCodes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enrichedListings = enrichedListings.map((listing: any) => {
      if (listing.artisan_id && artisanNameMap.has(listing.artisan_id)) {
        const entry = artisanNameMap.get(listing.artisan_id)!;
        return {
          ...listing,
          artisan_display_name: getArtisanAlias(listing.artisan_id) || getArtisanDisplayName(entry.name_romaji, entry.school, listing.artisan_id),
          artisan_name_kanji: getArtisanDisplayNameKanji(entry.name_kanji, listing.artisan_id),
          artisan_tier: getArtisanTier(entry),
        };
      }
      if (listing.artisan_id && !listing.artisan_display_name) {
        return {
          ...listing,
          artisan_display_name: getAttributionName(listing),
        };
      }
      return listing;
    });
  }

  return NextResponse.json({
    listings: enrichedListings,
    total: count || 0,
    page,
    limit,
    dealer_name: dealer?.name || null,
    dealer_name_ja: dealer?.name_ja || null,
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
    status: requestedStatus, // 'AVAILABLE' or 'INVENTORY' (default)
    cert_session,
    sayagaki,
    hakogaki,
    koshirae,
    provenance,
    kiwame,
    kanto_hibisho,
    setsumei_text_en,
    setsumei_text_ja,
    images: initialImages,
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
    cert_session: cert_session ?? null,
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
    page_exists: true,
    is_initial_import: false,
    images: Array.isArray(initialImages) && initialImages.length > 0 ? initialImages : [],
    scrape_count: 0,
    sayagaki: Array.isArray(sayagaki) && sayagaki.length > 0
      ? sayagaki.map((entry: Record<string, unknown>) => ({
          id: entry.id,
          author: entry.author,
          author_custom: entry.author_custom ?? null,
          content: entry.content ?? null,
          images: [], // Images uploaded separately after creation
        }))
      : null,
    hakogaki: Array.isArray(hakogaki) && hakogaki.length > 0
      ? hakogaki.map((entry: Record<string, unknown>) => ({
          id: entry.id,
          author: entry.author ?? null,
          content: entry.content ?? null,
          images: [], // Images uploaded separately after creation
        }))
      : null,
    koshirae: sanitizeKoshirae(koshirae),
    provenance: Array.isArray(provenance) && provenance.length > 0
      ? provenance.map((entry: Record<string, unknown>) => ({
          id: entry.id,
          owner_name: entry.owner_name ?? '',
          owner_name_ja: entry.owner_name_ja ?? null,
          notes: entry.notes ?? null,
          images: [], // Images uploaded separately after creation
        }))
      : null,
    setsumei_text_en: setsumei_text_en ?? null,
    setsumei_text_ja: setsumei_text_ja ?? null,
    kiwame: Array.isArray(kiwame) && kiwame.length > 0
      ? kiwame.map((entry: Record<string, unknown>) => ({
          id: entry.id,
          judge_name: entry.judge_name ?? '',
          judge_name_ja: entry.judge_name_ja ?? null,
          kiwame_type: entry.kiwame_type ?? 'origami',
          notes: entry.notes ?? null,
        }))
      : null,
    kanto_hibisho: kanto_hibisho && typeof kanto_hibisho === 'object'
      ? {
          volume: (kanto_hibisho as Record<string, unknown>).volume ?? '',
          entry_number: (kanto_hibisho as Record<string, unknown>).entry_number ?? '',
          text: (kanto_hibisho as Record<string, unknown>).text ?? null,
          images: Array.isArray((kanto_hibisho as Record<string, unknown>).images)
            ? ((kanto_hibisho as Record<string, unknown>).images as string[]).filter(
                (url: string) => typeof url === 'string' && !url.startsWith('blob:')
              )
            : [],
        }
      : null,
  };

  // Route artisan fields based on category
  if (item_category === 'tosogu') {
    listingData.tosogu_maker = smith || tosogu_maker || null;
    listingData.tosogu_school = school || tosogu_school || null;
    listingData.height_cm = height_cm ?? null;
    listingData.width_cm = width_cm ?? null;
    listingData.material = material ?? null;
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

    // Sync elite stats from Yuhinkai so featured score reflects artisan stature
    const eliteStats = await getArtisanEliteStats(artisan_id as string);
    if (eliteStats) {
      listingData.artisan_elite_factor = eliteStats.elite_factor;
      listingData.artisan_elite_count = eliteStats.elite_count;
      listingData.artisan_designation_factor = eliteStats.designation_factor;
    }
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
