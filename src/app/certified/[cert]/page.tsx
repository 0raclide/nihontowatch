import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCertCategory, getAllCertSlugs } from '@/lib/seo/categories';
import { fetchCategoryPreview } from '@/lib/seo/fetchCategoryPreview';
import { CategoryLandingPage } from '@/components/seo/CategoryLandingPage';
import { generateBreadcrumbJsonLd, generateItemListJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

export function generateStaticParams() {
  return getAllCertSlugs().map((cert) => ({ cert }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ cert: string }> }
): Promise<Metadata> {
  const { cert } = await params;
  const cat = getCertCategory(cert);
  if (!cat) return {};

  return {
    title: cat.title,
    description: cat.metaDescription,
    alternates: { canonical: `${baseUrl}/certified/${cat.slug}` },
    openGraph: {
      title: cat.h1,
      description: cat.metaDescription,
      type: 'website',
      url: `${baseUrl}/certified/${cat.slug}`,
      siteName: 'NihontoWatch',
    },
    twitter: {
      card: 'summary_large_image',
      title: cat.h1,
      description: cat.metaDescription,
    },
  };
}

export default async function CertCategoryPage(
  { params }: { params: Promise<{ cert: string }> }
) {
  const { cert } = await params;
  const cat = getCertCategory(cert);
  if (!cat) notFound();

  const { listings, totalCount } = await fetchCategoryPreview(cat);

  const breadcrumbItems = [
    { name: 'Home', url: `${baseUrl}/` },
    { name: 'Certified', url: `${baseUrl}/certified/${cat.slug}` },
    { name: cat.h1 },
  ];

  const browseUrl = `/?cert=${cat.filterValues[0]}`;

  const pageUrl = `${baseUrl}/certified/${cat.slug}`;

  return (
    <>
      <script {...jsonLdScriptProps(generateBreadcrumbJsonLd(breadcrumbItems))} />
      <script {...jsonLdScriptProps(generateItemListJsonLd(listings, cat.h1, pageUrl))} />
      <CategoryLandingPage
        category={cat}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Certified' },
          { name: cat.h1 },
        ]}
        listings={listings}
        totalCount={totalCount}
        browseUrl={browseUrl}
      />
    </>
  );
}
