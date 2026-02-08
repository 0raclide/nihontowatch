import { NextRequest, NextResponse } from 'next/server';
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

    // Add slugs to artists
    const artistsWithSlugs = artists.map(a => ({
      ...a,
      slug: generateArtisanSlug(a.name_romaji, a.code),
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
