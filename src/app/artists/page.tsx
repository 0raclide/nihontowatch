import { Metadata } from 'next';
import { getArtistsForDirectory, getArtistDirectoryFacets, getBulkElitePercentiles, getFilteredArtistsByCodes, getSchoolMemberCounts, getSchoolMemberCodes, getBulkArtisanHeroImages } from '@/lib/supabase/yuhinkai';
import { generateArtisanSlug } from '@/lib/artisan/slugs';
import { generateBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';
import { generateArtistDirectoryJsonLd } from '@/lib/seo/jsonLd';
import { createClient } from '@/lib/supabase/server';
import { ArtistsPageClient } from './ArtistsPageClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

interface ArtistsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getStringParam(
  params: { [key: string]: string | string[] | undefined },
  key: string
): string | undefined {
  const val = params[key];
  return typeof val === 'string' ? val : undefined;
}

export async function generateMetadata({ searchParams }: ArtistsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const school = getStringParam(params, 'school');
  const province = getStringParam(params, 'province');
  const era = getStringParam(params, 'era');
  const typeParam = getStringParam(params, 'type');
  const q = getStringParam(params, 'q');

  const parts: string[] = [];
  if (q) parts.push(`"${q}"`);
  if (school) parts.push(`${school} School`);
  if (province) parts.push(province);
  if (era) parts.push(era);
  if (typeParam === 'tosogu') parts.push('Tosogu Artists');
  else parts.push('Nihonto Artists');

  const titleSuffix = parts.length > 0 ? parts.join(' — ') : 'Artist Directory';
  const title = `${titleSuffix} | NihontoWatch`;

  const description = school
    ? `Browse ${school} school artists — nihonto and tosogu makers with certification statistics, elite rankings, and detailed profiles.`
    : 'Comprehensive directory of Japanese nihonto and tosogu artists. Browse by school, province, and era with Juyo and Tokubetsu Juyo certification counts.';

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/artists` },
    openGraph: {
      title: titleSuffix,
      description,
      type: 'website',
      url: `${BASE_URL}/artists`,
    },
  };
}

async function getListingData(codes: string[]): Promise<Map<string, { count: number; firstId?: number }>> {
  const result = new Map<string, { count: number; firstId?: number }>();
  if (codes.length === 0) return result;
  try {
    const supabase = await createClient();
    // artisan_id is not in the generated DB types, so cast the result
    const { data } = await supabase
      .from('listings')
      .select('id, artisan_id')
      .in('artisan_id' as string, codes)
      .eq('is_available', true) as { data: Array<{ id: number; artisan_id: string }> | null };
    for (const row of data || []) {
      const existing = result.get(row.artisan_id);
      if (existing) {
        existing.count += 1;
      } else {
        result.set(row.artisan_id, { count: 1, firstId: row.id });
      }
    }
  } catch {
    // Non-critical — cards just won't show listing counts
  }
  return result;
}

async function getAllListingCounts(): Promise<Map<string, { count: number; firstId?: number }>> {
  const result = new Map<string, { count: number; firstId?: number }>();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('listings')
      .select('id, artisan_id')
      .eq('is_available', true)
      .not('artisan_id' as string, 'is', null) as { data: Array<{ id: number; artisan_id: string }> | null };
    for (const row of data || []) {
      const existing = result.get(row.artisan_id);
      if (existing) {
        existing.count += 1;
      } else {
        result.set(row.artisan_id, { count: 1, firstId: row.id });
      }
    }
  } catch {
    // Non-critical
  }
  return result;
}

export default async function ArtistsPage({ searchParams }: ArtistsPageProps) {
  const params = await searchParams;

  const typeParam = getStringParam(params, 'type');
  const type = (typeParam === 'tosogu') ? 'tosogu' : 'smith';
  const school = getStringParam(params, 'school');
  const province = getStringParam(params, 'province');
  const era = getStringParam(params, 'era');
  const q = getStringParam(params, 'q');
  const sortParam = getStringParam(params, 'sort');
  const sort = (['elite_factor', 'name', 'total_items', 'for_sale'].includes(sortParam || '')
    ? sortParam as 'elite_factor' | 'name' | 'total_items' | 'for_sale'
    : 'elite_factor');
  const page = Math.max(parseInt(getStringParam(params, 'page') || '1', 10) || 1, 1);
  const notable = getStringParam(params, 'notable') !== 'false';

  let artists;
  let total: number;
  let listingData: Map<string, { count: number; firstId?: number }>;

  const facets = await getArtistDirectoryFacets(type);

  if (sort === 'for_sale') {
    // Special flow: sort by available listings count
    const allListingData = await getAllListingCounts();
    const artisanCodes = [...allListingData.keys()];
    const matchedArtists = await getFilteredArtistsByCodes(artisanCodes, type, { school, province, era, q, notable });
    matchedArtists.sort((a, b) => (allListingData.get(b.code)?.count || 0) - (allListingData.get(a.code)?.count || 0));
    total = matchedArtists.length;
    const offset = (page - 1) * 50;
    artists = matchedArtists.slice(offset, offset + 50);
    listingData = allListingData;
  } else {
    const result = await getArtistsForDirectory({ type, school, province, era, q, sort, page, limit: 50, notable });
    artists = result.artists;
    total = result.total;
    const codes = artists.map(a => a.code);
    listingData = await getListingData(codes);
  }

  // For school codes, aggregate listing counts from member artisans
  const schoolArtists = artists.filter(a => a.is_school_code && a.school);
  if (schoolArtists.length > 0) {
    const memberCodesMap = await getSchoolMemberCodes(
      schoolArtists.map(a => ({ code: a.code, school: a.school!, entity_type: a.entity_type }))
    );
    const allMemberCodes: string[] = [];
    for (const [, members] of memberCodesMap) {
      allMemberCodes.push(...members);
    }
    if (allMemberCodes.length > 0) {
      const memberListingData = await getListingData(allMemberCodes);
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

  // Fetch percentiles, school member counts, and hero images in parallel
  const [percentileMap, memberCountMap, heroImages] = await Promise.all([
    getBulkElitePercentiles(
      artists.map(a => ({ code: a.code, elite_factor: a.elite_factor, entity_type: a.entity_type }))
    ),
    getSchoolMemberCounts(
      artists.map(a => ({ code: a.code, school: a.school, entity_type: a.entity_type, is_school_code: a.is_school_code }))
    ),
    getBulkArtisanHeroImages(
      artists.map(a => ({ code: a.code, entityType: a.entity_type as 'smith' | 'tosogu' }))
    ),
  ]);

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

  const totalPages = Math.ceil(total / 50);

  // JSON-LD
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: BASE_URL },
    { name: 'Artists' },
  ]);

  const directoryJsonLd = generateArtistDirectoryJsonLd(
    artistsWithSlugs.slice(0, 10).map(a => ({
      name: a.name_romaji || a.code,
      url: `${BASE_URL}/artists/${a.slug}`,
    }))
  );

  return (
    <div className="min-h-screen bg-surface">
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />
      <script {...jsonLdScriptProps(directoryJsonLd)} />

      <ArtistsPageClient
        initialArtists={artistsWithSlugs}
        initialPagination={{ page, pageSize: 50, totalPages, totalCount: total }}
        initialFacets={facets}
        initialFilters={{ type, school, province, era, q, sort, notable }}
      />
    </div>
  );
}
