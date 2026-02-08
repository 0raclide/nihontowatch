import { Metadata } from 'next';
import { getArtistsForDirectory, getArtistDirectoryFacets } from '@/lib/supabase/yuhinkai';
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
  if (typeParam === 'smith') parts.push('Swordsmiths');
  else if (typeParam === 'tosogu') parts.push('Tosogu Makers');
  else parts.push('Artists');

  const titleSuffix = parts.length > 0 ? parts.join(' — ') : 'Artist Directory';
  const title = `${titleSuffix} | NihontoWatch`;

  const description = school
    ? `Browse ${school} school artisans — swordsmiths and tosogu makers with certification statistics, elite rankings, and detailed profiles.`
    : 'Comprehensive directory of Japanese swordsmiths and tosogu makers. Browse by school, province, and era with Juyo and Tokubetsu Juyo certification counts.';

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

async function getListingCounts(codes: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (codes.length === 0) return result;
  try {
    const supabase = await createClient();
    // artisan_id is not in the generated DB types, so cast the result
    const { data } = await supabase
      .from('listings')
      .select('artisan_id')
      .in('artisan_id' as string, codes)
      .eq('is_available', true) as { data: Array<{ artisan_id: string }> | null };
    for (const row of data || []) {
      result.set(row.artisan_id, (result.get(row.artisan_id) || 0) + 1);
    }
  } catch {
    // Non-critical — cards just won't show listing counts
  }
  return result;
}

export default async function ArtistsPage({ searchParams }: ArtistsPageProps) {
  const params = await searchParams;

  const typeParam = getStringParam(params, 'type');
  const type = (typeParam === 'smith' || typeParam === 'tosogu') ? typeParam : 'all';
  const school = getStringParam(params, 'school');
  const province = getStringParam(params, 'province');
  const era = getStringParam(params, 'era');
  const q = getStringParam(params, 'q');
  const sortParam = getStringParam(params, 'sort');
  const sort = (['elite_factor', 'juyo_count', 'name', 'total_items'].includes(sortParam || '')
    ? sortParam as 'elite_factor' | 'juyo_count' | 'name' | 'total_items'
    : 'elite_factor');
  const page = Math.max(parseInt(getStringParam(params, 'page') || '1', 10) || 1, 1);
  const notable = getStringParam(params, 'notable') !== 'false';

  const [{ artists, total }, facets] = await Promise.all([
    getArtistsForDirectory({ type, school, province, era, q, sort, page, limit: 50, notable }),
    getArtistDirectoryFacets(),
  ]);

  // Fetch listing counts for the current page of artists
  const codes = artists.map(a => a.code);
  const listingCounts = await getListingCounts(codes);

  const artistsWithSlugs = artists.map(a => ({
    ...a,
    slug: generateArtisanSlug(a.name_romaji, a.code),
    available_count: listingCounts.get(a.code) || 0,
  }));

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
