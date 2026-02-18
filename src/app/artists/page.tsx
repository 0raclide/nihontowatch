import { Metadata } from 'next';
import { generateBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';
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

  const ogImageUrl = `${BASE_URL}/api/og`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/artists` },
    openGraph: {
      title: titleSuffix,
      description,
      type: 'website',
      url: `${BASE_URL}/artists`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'NihontoWatch — Artist Directory' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titleSuffix,
      description,
      images: [ogImageUrl],
    },
  };
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
  const sort = (['elite_factor', 'provenance_factor', 'name', 'total_items', 'for_sale'].includes(sortParam || '')
    ? sortParam as 'elite_factor' | 'provenance_factor' | 'name' | 'total_items' | 'for_sale'
    : 'elite_factor');
  const page = Math.max(parseInt(getStringParam(params, 'page') || '1', 10) || 1, 1);
  const notable = getStringParam(params, 'notable') !== 'false';

  // JSON-LD breadcrumbs (lightweight, no DB needed)
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: BASE_URL },
    { name: 'Artists' },
  ]);

  return (
    <>
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <ArtistsPageClient
        key={[type, school, province, era, q, sort, notable].join('|')}
        initialFilters={{ type, school, province, era, q, sort, notable }}
        initialPage={page}
      />
    </>
  );
}
