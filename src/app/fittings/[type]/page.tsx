import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFittingCategory, getAllFittingSlugs } from '@/lib/seo/categories';
import { fetchCategoryPreview } from '@/lib/seo/fetchCategoryPreview';
import { CategoryLandingPage } from '@/components/seo/CategoryLandingPage';
import { generateBreadcrumbJsonLd, generateItemListJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

export function generateStaticParams() {
  return getAllFittingSlugs().map((type) => ({ type }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ type: string }> }
): Promise<Metadata> {
  const { type } = await params;
  const cat = getFittingCategory(type);
  if (!cat) return {};

  return {
    title: cat.title,
    description: cat.metaDescription,
    alternates: { canonical: `${baseUrl}/fittings/${cat.slug}` },
    openGraph: {
      title: cat.h1,
      description: cat.metaDescription,
      type: 'website',
      url: `${baseUrl}/fittings/${cat.slug}`,
      siteName: 'NihontoWatch',
    },
    twitter: {
      card: 'summary_large_image',
      title: cat.h1,
      description: cat.metaDescription,
    },
  };
}

export default async function FittingCategoryPage(
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const cat = getFittingCategory(type);
  if (!cat) notFound();

  const { listings, totalCount } = await fetchCategoryPreview(cat);

  const breadcrumbItems = [
    { name: 'Home', url: `${baseUrl}/` },
    { name: 'Fittings', url: `${baseUrl}/fittings/${cat.slug}` },
    { name: cat.h1 },
  ];

  const browseUrl = `/?type=${cat.filterValues[0]}`;

  const pageUrl = `${baseUrl}/fittings/${cat.slug}`;

  return (
    <>
      <script {...jsonLdScriptProps(generateBreadcrumbJsonLd(breadcrumbItems))} />
      <script {...jsonLdScriptProps(generateItemListJsonLd(listings, cat.h1, pageUrl))} />
      <CategoryLandingPage
        category={cat}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Fittings' },
          { name: cat.h1 },
        ]}
        listings={listings}
        totalCount={totalCount}
        browseUrl={browseUrl}
      />
    </>
  );
}
