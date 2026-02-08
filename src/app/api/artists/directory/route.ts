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
    const { getArtistsForDirectory, getArtistDirectoryFacets } = await import('@/lib/supabase/yuhinkai');
    const { generateArtisanSlug } = await import('@/lib/artisan/slugs');

    const params = request.nextUrl.searchParams;

    const typeParam = params.get('type');
    const type = (typeParam === 'smith' || typeParam === 'tosogu') ? typeParam : 'all';
    const school = params.get('school') || undefined;
    const province = params.get('province') || undefined;
    const era = params.get('era') || undefined;
    const q = params.get('q') || undefined;
    const sortParam = params.get('sort');
    const sort = (['elite_factor', 'juyo_count', 'name', 'total_items'].includes(sortParam || '')
      ? sortParam as 'elite_factor' | 'juyo_count' | 'name' | 'total_items'
      : 'elite_factor');
    const page = Math.max(parseInt(params.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(params.get('limit') || '50', 10) || 50, 1), 100);
    const notable = params.get('notable') !== 'false';

    const [{ artists, total }, facets] = await Promise.all([
      getArtistsForDirectory({ type, school, province, era, q, sort, page, limit, notable }),
      getArtistDirectoryFacets(),
    ]);

    // Fetch listing counts for artist cards
    const codes = artists.map(a => a.code);
    const listingCounts = await getListingCountsForArtists(codes);

    // Add slugs and listing counts to artists
    const artistsWithSlugs = artists.map(a => ({
      ...a,
      slug: generateArtisanSlug(a.name_romaji, a.code),
      available_count: listingCounts.get(a.code) || 0,
    }));

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
 * Batch-fetch available listing counts per artisan code from the main database.
 * Returns map of artisan_code → number of available listings.
 */
async function getListingCountsForArtists(codes: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (codes.length === 0) return result;

  try {
    const supabase = createServiceClient();
    // artisan_id is not in the generated DB types, so cast the result
    const { data, error } = await supabase
      .from('listings')
      .select('artisan_id')
      .in('artisan_id' as string, codes)
      .eq('is_available', true) as { data: Array<{ artisan_id: string }> | null; error: unknown };

    if (error) {
      logger.logError('Listing counts query error', error);
      return result;
    }

    for (const row of data || []) {
      result.set(row.artisan_id, (result.get(row.artisan_id) || 0) + 1);
    }
  } catch (err) {
    logger.logError('Listing counts error', err);
  }

  return result;
}
