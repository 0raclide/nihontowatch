import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

const isYuhinkaiConfigured = !!(
  (process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL) &&
  (process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY)
);

/**
 * GET /api/artists/directory
 *
 * Public endpoint for the artist directory page.
 * Returns paginated artisan list with facets for filtering.
 */
export async function GET(request: NextRequest) {
  if (!isYuhinkaiConfigured) {
    return NextResponse.json(
      { error: 'Yuhinkai database not configured' },
      { status: 503 }
    );
  }

  try {
    const { getArtistsForDirectory, getArtistDirectoryFacets, getBulkElitePercentiles } = await import('@/lib/supabase/yuhinkai');
    const { generateArtisanSlug } = await import('@/lib/artisan/slugs');

    const params = request.nextUrl.searchParams;

    const typeParam = params.get('type');
    const type = (typeParam === 'tosogu') ? 'tosogu' : 'smith';
    const school = params.get('school') || undefined;
    const province = params.get('province') || undefined;
    const era = params.get('era') || undefined;
    const q = params.get('q') || undefined;
    const sortParam = params.get('sort');
    const sort = (['elite_factor', 'name', 'total_items'].includes(sortParam || '')
      ? sortParam as 'elite_factor' | 'name' | 'total_items'
      : 'elite_factor');
    const page = Math.max(parseInt(params.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(params.get('limit') || '50', 10) || 50, 1), 100);
    const notable = params.get('notable') !== 'false';

    const [{ artists, total }, facets] = await Promise.all([
      getArtistsForDirectory({ type, school, province, era, q, sort, page, limit, notable }),
      getArtistDirectoryFacets(type),
    ]);

    // Fetch listing data and percentiles for artist cards
    const codes = artists.map(a => a.code);
    const [listingData, percentileMap] = await Promise.all([
      getListingDataForArtists(codes),
      getBulkElitePercentiles(artists.map(a => ({ code: a.code, elite_factor: a.elite_factor, entity_type: a.entity_type }))),
    ]);

    // Add slugs, percentiles, and listing data to artists
    const artistsWithSlugs = artists.map(a => {
      const ld = listingData.get(a.code);
      return {
        ...a,
        slug: generateArtisanSlug(a.name_romaji, a.code),
        percentile: percentileMap.get(a.code) ?? 0,
        available_count: ld?.count || 0,
        first_listing_id: ld?.firstId,
      };
    });

    const totalPages = Math.ceil(total / limit);

    const response = NextResponse.json({
      artists: artistsWithSlugs,
      pagination: {
        page,
        pageSize: limit,
        totalPages,
        totalCount: total,
      },
      facets,
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );

    return response;
  } catch (error) {
    logger.logError('Artists directory API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Batch-fetch available listing data per artisan code from the main database.
 * Returns map of artisan_code → { count, firstId } for available listings.
 */
async function getListingDataForArtists(codes: string[]): Promise<Map<string, { count: number; firstId?: number }>> {
  const result = new Map<string, { count: number; firstId?: number }>();
  if (codes.length === 0) return result;

  try {
    const supabase = createServiceClient();
    // artisan_id is not in the generated DB types, so cast the result
    const { data, error } = await supabase
      .from('listings')
      .select('id, artisan_id')
      .in('artisan_id' as string, codes)
      .eq('is_available', true) as { data: Array<{ id: number; artisan_id: string }> | null; error: unknown };

    if (error) {
      logger.logError('Listing data query error', error);
      return result;
    }

    for (const row of data || []) {
      const existing = result.get(row.artisan_id);
      if (existing) {
        existing.count += 1;
      } else {
        result.set(row.artisan_id, { count: 1, firstId: row.id });
      }
    }
  } catch (err) {
    logger.logError('Listing data error', err);
  }

  return result;
}
