import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import ListingDetailClient from './ListingDetailClient';
import { RelatedListingsServer } from '@/components/listing/RelatedListingsServer';
import type { RelatedItem } from '@/components/listing/RelatedListingsServer';
import {
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
  getItemTypeBreadcrumbLabel,
} from '@/lib/seo/jsonLd';
import { buildSeoTitle, buildSeoDescription } from '@/lib/seo/metaTitle';
import { getItemTypeUrl } from '@/lib/seo/categories';
import { cache } from 'react';
import { getListingDetail } from '@/lib/listing/getListingDetail';
import { Footer } from '@/components/layout/Footer';
import { getAttributionName } from '@/lib/listing/attribution';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';

import type { Listing, Dealer, ItemType, Currency } from '@/types';

const getCachedListing = cache(async (listingId: number) => {
  const supabase = createServiceClient();
  return getListingDetail(supabase, listingId);
});

// ISR: revalidate every 5 minutes — listing data is public, no auth needed
export const revalidate = 300;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listingId = parseInt(id);

  if (isNaN(listingId)) {
    return {
      title: 'Listing Not Found | NihontoWatch',
      description: 'The requested listing could not be found.',
    };
  }

  try {
    const listing = await getCachedListing(listingId);

    if (!listing) {
      return {
        title: 'Listing Not Found | NihontoWatch',
        description: 'The requested listing could not be found.',
      };
    }

    // Build structured SEO title and description
    const seoFields = {
      title: listing.title,
      title_en: listing.title_en,
      item_type: listing.item_type,
      cert_type: listing.cert_type,
      smith: listing.smith,
      tosogu_maker: listing.tosogu_maker,
      school: listing.school,
      tosogu_school: listing.tosogu_school,
      era: listing.era,
      tosogu_era: listing.tosogu_era,
      province: listing.province,
      tosogu_material: listing.tosogu_material,
      nagasa_cm: listing.nagasa_cm,
      mei_type: listing.mei_type,
      price_value: listing.is_sold ? null : listing.price_value,
      price_currency: listing.is_sold ? null : listing.price_currency,
      is_sold: listing.is_sold,
      is_available: listing.is_available,
      dealer_name: listing.dealers?.name,
    };

    const title = buildSeoTitle(seoFields);
    const description = buildSeoDescription(seoFields);
    const isSold = listing.is_sold || !listing.is_available;

    // OG title: structured title without " | NihontoWatch" suffix
    const ogTitle = title.endsWith(' | NihontoWatch')
      ? title.slice(0, -' | NihontoWatch'.length)
      : listing.title;

    // Use pre-generated OG image if available, otherwise fall back to dynamic generation
    const ogImageUrl = listing.og_image_url || `${baseUrl}/api/og?id=${listingId}`;

    return {
      title,
      description,
      alternates: {
        canonical: `${baseUrl}/listing/${listingId}`,
      },
      // Index all listings — sold items retain SEO equity as archive pages
      // (Product JSON-LD already sets availability: SoldOut for sold items)
      robots: { index: true, follow: true },
      openGraph: {
        title: ogTitle,
        description,
        type: 'website',
        url: `${baseUrl}/listing/${listingId}`,
        siteName: 'NihontoWatch',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: ogTitle,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: ogTitle,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return {
      title: 'Listing | NihontoWatch',
      description: 'View Japanese sword and tosogu listings on NihontoWatch.',
    };
  }
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const listingId = parseInt(id);

  // Invalid ID - return 404
  if (isNaN(listingId)) {
    notFound();
  }

  const supabase = createServiceClient();
  const listing = await getCachedListing(listingId);

  // Listing doesn't exist - return proper HTTP 404
  if (!listing) {
    notFound();
  }

  // Generate JSON-LD structured data
  const listingForSchema: Partial<Listing> = {
    id: listing.id,
    title: listing.title,
    description: listing.description || undefined,
    price_value: listing.is_sold ? undefined : (listing.price_value || undefined),
    price_currency: (listing.price_currency || 'JPY') as Currency,
    item_type: (listing.item_type || 'unknown') as ItemType,
    cert_type: listing.cert_type || undefined,
    smith: listing.smith || undefined,
    tosogu_maker: listing.tosogu_maker || undefined,
    tosogu_school: listing.tosogu_school || undefined,
    school: listing.school || undefined,
    province: listing.province || undefined,
    era: listing.era || undefined,
    mei_type: listing.mei_type || undefined,
    nagasa_cm: listing.nagasa_cm || undefined,
    sori_cm: listing.sori_cm || undefined,
    stored_images: listing.stored_images || undefined,
    images: listing.images || [],
    is_sold: listing.is_sold,
    is_available: listing.is_available,
  };

  const dealerForSchema: Partial<Dealer> | undefined = listing.dealers
    ? {
        name: listing.dealers.name,
        domain: listing.dealers.domain,
      }
    : undefined;

  // Generate Product JSON-LD
  const productJsonLd = generateProductJsonLd(
    listingForSchema as Listing,
    dealerForSchema as Dealer
  );

  // Generate Breadcrumb JSON-LD
  const itemTypeLabel = listing.item_type
    ? getItemTypeBreadcrumbLabel(listing.item_type as ItemType)
    : null;

  const listingTitle = listing.title || `Listing #${listing.id}`;

  const itemTypePageUrl = listing.item_type
    ? getItemTypeUrl(listing.item_type)
    : null;

  const breadcrumbItems = [
    { name: 'Home', url: baseUrl },
    ...(itemTypeLabel
      ? [{ name: itemTypeLabel, url: itemTypePageUrl ? `${baseUrl}${itemTypePageUrl}` : `${baseUrl}/?type=${listing.item_type}` }]
      : []),
    { name: listingTitle },
  ];

  const breadcrumbJsonLd = generateBreadcrumbJsonLd(breadcrumbItems);

  // Fetch related listings server-side for SEO (visible in initial HTML)
  const artisanId = listing.artisan_id;
  const dealerId = listing.dealer_id;
  const artisanName = getAttributionName(listing);
  const dealerName = listing.dealers?.name || 'Unknown Dealer';

  const relatedQueries = [];

  // Related by artisan
  if (artisanId) {
    relatedQueries.push(
      supabase
        .from('listings')
        .select('id, title, price_value, price_currency, images, stored_images')
        .eq('is_available', true)
        .eq('artisan_id', artisanId)
        .neq('id', listingId)
        .order('first_seen_at', { ascending: false })
        .limit(4)
        .then(({ data }) => ({ type: 'artisan' as const, items: (data || []) as RelatedItem[] }))
    );
  }

  // Related by dealer (same item type if available)
  let dealerQuery = supabase
    .from('listings')
    .select('id, title, price_value, price_currency, images, stored_images')
    .eq('is_available', true)
    .eq('dealer_id', dealerId)
    .neq('id', listingId);

  if (listing.item_type) {
    dealerQuery = dealerQuery.eq('item_type', listing.item_type);
  }

  relatedQueries.push(
    dealerQuery
      .order('first_seen_at', { ascending: false })
      .limit(4)
      .then(({ data }) => ({ type: 'dealer' as const, items: (data || []) as RelatedItem[] }))
  );

  const relatedResults = await Promise.all(relatedQueries);
  const artisanItems = relatedResults.find(r => r.type === 'artisan')?.items || [];
  const dealerItems = relatedResults.find(r => r.type === 'dealer')?.items || [];

  return (
    <>
      {/* JSON-LD Structured Data - placed in body (Next.js App Router best practice) */}
      {/* Google bot reads JSON-LD from anywhere in the document */}
      <script {...jsonLdScriptProps(productJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <ListingDetailClient initialData={listing} />

      {/* Server-rendered related listings — links visible to Googlebot in initial HTML */}
      <RelatedListingsServer
        artisanItems={artisanItems}
        artisanName={artisanName}
        artisanDisplayName={listing.artisan_display_name || null}
        artisanId={artisanId}
        dealerItems={dealerItems}
        dealerName={dealerName}
        dealerId={dealerId}
      />

      <Footer />
    </>
  );
}
