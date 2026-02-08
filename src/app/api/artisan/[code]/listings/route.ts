import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/artisan/[code]/listings
 *
 * Fetches currently available listings from the main NihontoWatch database
 * that are matched to this artisan code.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length < 2) {
    return NextResponse.json({ error: 'Invalid artisan code' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
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
      `)
      .eq('artisan_id', code)
      .eq('is_available', true)
      .order('first_seen_at', { ascending: false })
      .limit(24);

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
