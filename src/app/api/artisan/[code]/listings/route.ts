import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const LISTING_FIELDS = `
  id, url, title, item_type, item_category,
  price_value, price_currency, price_raw,
  smith, school, province, era, mei_type,
  tosogu_maker, tosogu_school,
  cert_type, cert_session,
  images,
  is_available, is_sold, status,
  first_seen_at, last_scraped_at,
  artisan_id, artisan_confidence,
  nagasa_cm, sori_cm,
  dealer:dealers(id, name, domain)
`;

/**
 * GET /api/artisan/[code]/listings
 *
 * Fetches listings from the main NihontoWatch database matched to this artisan code.
 * ?status=sold  — returns sold/unavailable items instead of available ones.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length < 2) {
    return NextResponse.json({ error: 'Invalid artisan code' }, { status: 400 });
  }

  const status = request.nextUrl.searchParams.get('status');

  try {
    const supabase = await createClient();

    let query = supabase
      .from('listings')
      .select(LISTING_FIELDS)
      .eq('artisan_id', code);

    if (status === 'sold') {
      query = query.eq('is_available', false).limit(50);
    } else {
      query = query.eq('is_available', true).limit(24);
    }

    query = query.order('first_seen_at', { ascending: false });

    const { data: listings, error } = await query;

    if (error) {
      logger.logError('Artisan listings query error', error);
      console.error('[Artisan listings] Query error:', error.message, error.details, error.hint);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const response = NextResponse.json({ listings: listings || [] });
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    );
    return response;
  } catch (error) {
    logger.logError('Artisan listings API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
