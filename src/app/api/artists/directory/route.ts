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
    const { getArtistsForDirectory, getArtistDirectoryFacets, getBulkElitePercentiles, getBulkProvenancePercentiles, getFilteredArtistsByCodes, getSchoolMemberCounts, getSchoolMemberCodes, getBulkArtisanHeroImages } = await import('@/lib/supabase/yuhinkai');
    const { generateArtisanSlug } = await import('@/lib/artisan/slugs');

    const params = request.nextUrl.searchParams;

    const typeParam = params.get('type');
    const type = (typeParam === 'tosogu') ? 'tosogu' : 'smith';
    const school = params.get('school') || undefined;
    const province = params.get('province') || undefined;
    const era = params.get('era') || undefined;
    const q = params.get('q') || undefined;
    const sortParam = params.get('sort');
    const sort = (['elite_factor', 'provenance_factor', 'name', 'total_items', 'for_sale'].includes(sortParam || '')
      ? sortParam as 'elite_factor' | 'provenance_factor' | 'name' | 'total_items' | 'for_sale'
      : 'elite_factor');
    const page = Math.max(parseInt(params.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(params.get('limit') || '50', 10) || 50, 1), 100);
    const notable = params.get('notable') !== 'false';

    let artists;
    let total: number;
    let listingData: Map<string, { count: number; firstId?: number }>;

    if (sort === 'for_sale') {
      // Special flow: sort by available listings count.
      // 1. Get all available listing counts from main DB
      const allListingData = await getAllAvailableListingCounts();

      // 2. Query Yuhinkai for matching artists among those with listings
      const artisanCodes = [...allListingData.keys()];
      const matchedArtists = await getFilteredArtistsByCodes(artisanCodes, type, { school, province, era, q, notable });

      // 3. Sort by available count descending
      matchedArtists.sort((a, b) => (allListingData.get(b.code)?.count || 0) - (allListingData.get(a.code)?.count || 0));

      // 4. Paginate
      total = matchedArtists.length;
      const offset = (page - 1) * limit;
      artists = matchedArtists.slice(offset, offset + limit);
      listingData = allListingData;
    } else {
      const result = await getArtistsForDirectory({ type, school, province, era, q, sort, page, limit, notable });
      artists = result.artists;
      total = result.total;

      // Fetch listing data for this page's artists
      const codes = artists.map(a => a.code);
      listingData = await getListingDataForArtists(codes);
    }

    // For school codes, aggregate listing counts from member artisans
    const schoolArtists = artists.filter(a => a.is_school_code && a.school);
    if (schoolArtists.length > 0) {
      const memberCodesMap = await getSchoolMemberCodes(
        schoolArtists.map(a => ({ code: a.code, school: a.school!, entity_type: a.entity_type }))
      );

      // Collect all member codes we need listing data for
      const allMemberCodes: string[] = [];
      for (const [, members] of memberCodesMap) {
        allMemberCodes.push(...members);
      }

      if (allMemberCodes.length > 0) {
        const memberListingData = await getListingDataForArtists(allMemberCodes);

        for (const [schoolCode, memberCodes] of memberCodesMap) {
          const existing = listingData.get(schoolCode) || { count: 0 };
          for (const memberCode of memberCodes) {
            const memberData = memberListingData.get(memberCode);
            if (memberData) {
              existing.count += memberData.count;
              if (!existing.firstId && memberData.firstId) {
                existing.firstId = memberData.firstId;
              }
            }
          }
          listingData.set(schoolCode, existing);
        }
      }
    }

    const facets = await getArtistDirectoryFacets(type);

    // Fetch percentiles and school member counts for artist cards
    // When sorting by provenance, show provenance percentile on the card bar
    const [percentileMap, memberCountMap] = await Promise.all([
      sort === 'provenance_factor'
        ? getBulkProvenancePercentiles(
            artists.map(a => ({ code: a.code, provenance_factor: a.provenance_factor, entity_type: a.entity_type as 'smith' | 'tosogu' }))
          )
        : getBulkElitePercentiles(
            artists.map(a => ({ code: a.code, elite_factor: a.elite_factor, entity_type: a.entity_type }))
          ),
      getSchoolMemberCounts(
        artists.map(a => ({ code: a.code, school: a.school, entity_type: a.entity_type, is_school_code: a.is_school_code }))
      ),
    ]);

    // Fetch hero images from Yuhinkai catalog for current page's artists
    const heroImages = await getBulkArtisanHeroImages(
      artists.map(a => ({ code: a.code, entityType: a.entity_type as 'smith' | 'tosogu' }))
    );

    // Fetch live stats: last scrape time + total attributed items (for banner)
    let lastUpdated: string | null = null;
    let attributedItemCount = 0;
    try {
      const supabase = createServiceClient();
      const [freshnessRes, countRes] = await Promise.all([
        supabase
          .from('listings')
          .select('last_scraped_at')
          .order('last_scraped_at' as string, { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .not('artisan_id' as string, 'is', null)
          .eq('is_available', true),
      ]);
      lastUpdated = (freshnessRes.data as { last_scraped_at: string } | null)?.last_scraped_at || null;
      attributedItemCount = countRes.count ?? 0;
    } catch {
      // Non-critical — banner just won't show
    }

    // Add slugs, percentiles, member counts, listing data, and hero images
    const artistsWithSlugs = artists.map(a => {
      const ld = listingData.get(a.code);
      return {
        ...a,
        slug: generateArtisanSlug(a.name_romaji, a.code),
        percentile: percentileMap.get(a.code) ?? 0,
        member_count: memberCountMap.get(a.code),
        available_count: ld?.count || 0,
        first_listing_id: ld?.firstId,
        cover_image: heroImages.get(a.code) || null,
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
      lastUpdated,
      attributedItemCount,
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
      .eq('is_available', true)
      .eq('admin_hidden', false) as { data: Array<{ id: number; artisan_id: string }> | null; error: unknown };

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

/**
 * Fetch ALL available listing counts grouped by artisan_id.
 * Used when sorting by "for sale" — we need all counts upfront to sort globally.
 */
async function getAllAvailableListingCounts(): Promise<Map<string, { count: number; firstId?: number }>> {
  const result = new Map<string, { count: number; firstId?: number }>();

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('listings')
      .select('id, artisan_id')
      .eq('is_available', true)
      .eq('admin_hidden', false)
      .not('artisan_id' as string, 'is', null) as { data: Array<{ id: number; artisan_id: string }> | null; error: unknown };

    if (error) {
      logger.logError('All listing counts query error', error);
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
    logger.logError('All listing counts error', err);
  }

  return result;
}

