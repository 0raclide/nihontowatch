/**
 * Shared helpers for category page route handlers.
 * Eliminates duplication across swords/[type], fittings/[type], and certified/[cert].
 */

import type { Metadata } from 'next';
import type { CategoryDef } from './categories';
import { getCategoryByRoute } from './categories';

const ROUTE_PREFIX_LABELS: Record<string, string> = {
  swords: 'Swords',
  fittings: 'Fittings',
  certified: 'Certified',
};

/** Build Next.js Metadata from a category definition. */
export function buildCategoryMetadata(cat: CategoryDef, baseUrl: string): Metadata {
  const url = `${baseUrl}${cat.route}`;
  return {
    title: cat.title,
    description: cat.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: cat.h1,
      description: cat.metaDescription,
      type: 'website',
      url,
      siteName: 'NihontoWatch',
    },
    twitter: {
      card: 'summary_large_image',
      title: cat.h1,
      description: cat.metaDescription,
    },
  };
}

/** Build browse URL from category filters (e.g., '/?type=katana&cert=juyo'). */
export function buildBrowseUrl(cat: CategoryDef): string {
  const params = new URLSearchParams();
  for (const [param, values] of Object.entries(cat.filters)) {
    params.set(param, values[0]);
  }
  return `/?${params.toString()}`;
}

interface BreadcrumbSet {
  jsonLdItems: Array<{ name: string; url?: string }>;
  visibleItems: Array<{ name: string; url?: string }>;
}

/** Build breadcrumbs for JSON-LD and visible display. */
export function buildBreadcrumbs(cat: CategoryDef, baseUrl: string): BreadcrumbSet {
  const sectionLabel = ROUTE_PREFIX_LABELS[cat.routePrefix] || cat.routePrefix;
  const parentCat = cat.parentSlug
    ? getCategoryByRoute(cat.routePrefix, cat.parentSlug)
    : null;

  const jsonLdItems = [
    { name: 'Home', url: `${baseUrl}/` },
    ...(parentCat
      ? [{ name: parentCat.h1, url: `${baseUrl}${parentCat.route}` }]
      : [{ name: sectionLabel, url: `${baseUrl}${cat.route}` }]),
    { name: cat.h1 },
  ];

  const visibleItems = [
    { name: 'Home', url: '/' },
    ...(parentCat
      ? [{ name: parentCat.h1, url: parentCat.route }]
      : [{ name: sectionLabel }]),
    { name: cat.h1 },
  ];

  return { jsonLdItems, visibleItems };
}
