import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { generateBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';
import { DealersPageClient } from './DealersPageClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

interface DealersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getStringParam(
  params: { [key: string]: string | string[] | undefined },
  key: string,
): string | undefined {
  const val = params[key];
  return typeof val === 'string' ? val : undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('dealers')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const dealerCount = count || 0;

  return {
    title: `Japanese Sword Dealers | ${dealerCount} Trusted Nihonto Dealers Worldwide | NihontoWatch`,
    description: `Browse ${dealerCount} verified Japanese sword dealers from Japan and worldwide. Find authentic katana, wakizashi, tanto, and tosogu from trusted dealers.`,
    alternates: { canonical: `${BASE_URL}/dealers` },
    openGraph: {
      title: `Japanese Sword Dealers | ${dealerCount} Dealers | NihontoWatch`,
      description: `Browse ${dealerCount} verified Japanese sword dealers from Japan and worldwide.`,
      type: 'website',
      url: `${BASE_URL}/dealers`,
      siteName: 'NihontoWatch',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Japanese Sword Dealers | NihontoWatch`,
      description: `Browse ${dealerCount} verified dealers from Japan and worldwide.`,
    },
  };
}

export default async function DealersPage({ searchParams }: DealersPageProps) {
  const params = await searchParams;

  const sortParam = getStringParam(params, 'sort');
  const sort = (['listing_count', 'name', 'country'].includes(sortParam || '')
    ? sortParam as 'listing_count' | 'name' | 'country'
    : 'listing_count');
  const q = getStringParam(params, 'q');
  const regionParam = getStringParam(params, 'region');
  const region = (['japan', 'international'].includes(regionParam || '')
    ? regionParam as 'japan' | 'international'
    : undefined);

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: BASE_URL },
    { name: 'Dealers' },
  ]);

  return (
    <>
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <DealersPageClient
        initialFilters={{ sort, q, region }}
      />
    </>
  );
}
