import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryByRoute, getAllSlugsByRoute } from '@/lib/seo/categories';
import { fetchCategoryPreview } from '@/lib/seo/fetchCategoryPreview';
import { buildCategoryMetadata, buildBrowseUrl, buildBreadcrumbs } from '@/lib/seo/categoryPage';
import { CategoryLandingPage } from '@/components/seo/CategoryLandingPage';
import { generateBreadcrumbJsonLd, generateItemListJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// ISR: refresh category data every hour
export const revalidate = 3600;

export function generateStaticParams() {
  return getAllSlugsByRoute('certified').map((cert) => ({ cert }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ cert: string }> }
): Promise<Metadata> {
  const { cert } = await params;
  const cat = getCategoryByRoute('certified', cert);
  if (!cat) return {};
  return buildCategoryMetadata(cat, baseUrl);
}

export default async function CertCategoryPage(
  { params }: { params: Promise<{ cert: string }> }
) {
  const { cert } = await params;
  const cat = getCategoryByRoute('certified', cert);
  if (!cat) notFound();

  const { listings, totalCount } = await fetchCategoryPreview(cat);
  const { jsonLdItems, visibleItems } = buildBreadcrumbs(cat, baseUrl);
  const pageUrl = `${baseUrl}${cat.route}`;

  return (
    <>
      <script {...jsonLdScriptProps(generateBreadcrumbJsonLd(jsonLdItems))} />
      <script {...jsonLdScriptProps(generateItemListJsonLd(listings, cat.h1, pageUrl))} />
      <CategoryLandingPage
        category={cat}
        breadcrumbs={visibleItems}
        listings={listings}
        totalCount={totalCount}
        browseUrl={buildBrowseUrl(cat)}
      />
    </>
  );
}
