import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const LISTING_FIELDS = `
  id, url, title, title_en, item_type, item_category,
  price_value, price_currency, price_raw,
  smith, school, province, era, mei_type,
  tosogu_maker, tosogu_school,
  cert_type, cert_session,
  images, stored_images,
  description, description_en,
  is_available, is_sold, status,
  first_seen_at, last_scraped_at,
  artisan_id, artisan_confidence, artisan_method, artisan_candidates, artisan_verified,
  nagasa_cm, sori_cm,
  dealer:dealers(id, name, domain)
`;

/**
 * GET /api/artisan/[code]/listings
 *
 * Fetches listings from the main NihontoWatch database matched to this artisan code.
 * For school codes, also includes listings from all school member artisans.
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

    // Check if this is a school code — if so, include member artisan listings
    let artisanCodes = [code];
    try {
      const { getSmithEntity, getTosoguMaker, getSchoolMemberCodes } = await import('@/lib/supabase/yuhinkai');
      const smith = await getSmithEntity(code);
      const tosogu = !smith ? await getTosoguMaker(code) : null;
      const entity = smith || tosogu;

      if (entity?.is_school_code && entity?.school) {
        const entityType = smith ? 'smith' as const : 'tosogu' as const;
        const memberCodesMap = await getSchoolMemberCodes([{
          code,
          school: entity.school,
          entity_type: entityType,
        }]);
        const memberCodes = memberCodesMap.get(code) || [];
        if (memberCodes.length > 0) {
          artisanCodes = [code, ...memberCodes];
        }
      }
    } catch (err) {
      // If Yuhinkai lookup fails, fall back to exact code match
      logger.logError('School member lookup failed', err);
    }

    let query = supabase
      .from('listings')
      .select(LISTING_FIELDS);

    if (artisanCodes.length === 1) {
      query = query.eq('artisan_id', code);
    } else {
      query = query.in('artisan_id' as string, artisanCodes);
    }

    if (status === 'sold') {
      // Include is_available=false AND is_available=NULL (e.g. reserved items)
      query = query.or('is_available.eq.false,is_available.is.null').limit(50);
    } else {
      query = query.eq('is_available', true).limit(50);
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
      'private, no-store, must-revalidate'
    );
    return response;
  } catch (error) {
    logger.logError('Artisan listings API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
