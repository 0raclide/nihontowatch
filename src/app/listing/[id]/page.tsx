import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
import type { Listing, Dealer, ItemType, Currency } from '@/types';

// Force dynamic rendering - needed for Supabase server client with cookies
export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// Listing data type for metadata generation
interface ListingMetadata {
  id: number;
  title: string;
  title_en: string | null;
  price_value: number | null;
  price_currency: string | null;
  item_type: string | null;
  cert_type: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  era: string | null;
  tosogu_era: string | null;
  province: string | null;
  nagasa_cm: number | null;
  mei_type: string | null;
  tosogu_material: string | null;
  og_image_url: string | null;  // Pre-generated OG image URL
  is_sold: boolean;
  is_available: boolean;
  dealers: { name: string; domain: string } | null;
}

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
    const supabase = await createClient();
    const { data: listingData, error } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        title_en,
        price_value,
        price_currency,
        item_type,
        cert_type,
        smith,
        tosogu_maker,
        school,
        tosogu_school,
        era,
        province,
        nagasa_cm,
        mei_type,
        tosogu_material,
        tosogu_era,
        og_image_url,
        is_sold,
        is_available,
        dealers (
          name,
          domain
        )
      `)
      .eq('id', listingId)
      .single();

    // Type assertion to fix Supabase type inference issue
    const listing = listingData as ListingMetadata | null;

    if (!listing || error) {
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
      price_value: listing.price_value,
      price_currency: listing.price_currency,
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
      // Noindex sold items so Google deindexes them
      robots: isSold ? { index: false, follow: true } : { index: true, follow: true },
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

// Extended listing data for JSON-LD (includes more fields than metadata)
interface ListingForJsonLd {
  id: number;
  title: string;
  description: string | null;
  price_value: number | null;
  price_currency: string | null;
  item_type: string | null;
  cert_type: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  tosogu_school: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  mei_type: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  stored_images: string[] | null;
  images: string[] | null;
  is_sold: boolean;
  is_available: boolean;
  dealer_id: number;
  artisan_id: string | null;
  dealers: { id: number; name: string; domain: string } | null;
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const listingId = parseInt(id);

  // Invalid ID - return 404
  if (isNaN(listingId)) {
    notFound();
  }

  // Fetch listing data for JSON-LD and existence check
  let jsonLdData: { product: object; breadcrumb: object } | null = null;

  const supabase = await createClient();
  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      description,
      price_value,
      price_currency,
      item_type,
      cert_type,
      smith,
      tosogu_maker,
      tosogu_school,
      school,
      province,
      era,
      mei_type,
      nagasa_cm,
      sori_cm,
      stored_images,
      images,
      is_sold,
      is_available,
      dealer_id,
      artisan_id,
      dealers (
        id,
        name,
        domain
      )
    `)
    .eq('id', listingId)
    .single();

  // Listing doesn't exist - return proper HTTP 404
  if (!listing || error) {
    notFound();
  }

  // Generate JSON-LD for existing listings
  const typedListing = listing as unknown as ListingForJsonLd;

  // Convert to the format expected by JSON-LD generators
  const listingForSchema: Partial<Listing> = {
    id: typedListing.id,
    title: typedListing.title,
    description: typedListing.description || undefined,
    price_value: typedListing.price_value || undefined,
    price_currency: (typedListing.price_currency || 'JPY') as Currency,
    item_type: (typedListing.item_type || 'unknown') as ItemType,
    cert_type: typedListing.cert_type || undefined,
    smith: typedListing.smith || undefined,
    tosogu_maker: typedListing.tosogu_maker || undefined,
    tosogu_school: typedListing.tosogu_school || undefined,
    school: typedListing.school || undefined,
    province: typedListing.province || undefined,
    era: typedListing.era || undefined,
    mei_type: typedListing.mei_type || undefined,
    nagasa_cm: typedListing.nagasa_cm || undefined,
    sori_cm: typedListing.sori_cm || undefined,
    stored_images: typedListing.stored_images || undefined,
    images: typedListing.images || [],
    is_sold: typedListing.is_sold,
    is_available: typedListing.is_available,
  };

  const dealerForSchema: Partial<Dealer> | undefined = typedListing.dealers
    ? {
        name: typedListing.dealers.name,
        domain: typedListing.dealers.domain,
      }
    : undefined;

  // Generate Product JSON-LD
  const productJsonLd = generateProductJsonLd(
    listingForSchema as Listing,
    dealerForSchema as Dealer
  );

  // Generate Breadcrumb JSON-LD
  const itemTypeLabel = typedListing.item_type
    ? getItemTypeBreadcrumbLabel(typedListing.item_type as ItemType)
    : null;

  const listingTitle = typedListing.title || `Listing #${typedListing.id}`;

  const breadcrumbItems = [
    { name: 'Home', url: baseUrl },
    ...(itemTypeLabel
      ? [{ name: itemTypeLabel, url: `${baseUrl}/?type=${typedListing.item_type}` }]
      : []),
    { name: listingTitle },
  ];

  const breadcrumbJsonLd = generateBreadcrumbJsonLd(breadcrumbItems);

  jsonLdData = {
    product: productJsonLd,
    breadcrumb: breadcrumbJsonLd,
  };

  // Fetch related listings server-side for SEO (visible in initial HTML)
  const artisanId = typedListing.artisan_id;
  const dealerId = typedListing.dealer_id;
  const artisanName = typedListing.smith || typedListing.tosogu_maker;
  const dealerName = typedListing.dealers?.name || 'Unknown Dealer';

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

  if (typedListing.item_type) {
    dealerQuery = dealerQuery.eq('item_type', typedListing.item_type);
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
      {jsonLdData && (
        <>
          <script {...jsonLdScriptProps(jsonLdData.product)} />
          <script {...jsonLdScriptProps(jsonLdData.breadcrumb)} />
        </>
      )}
      <ListingDetailClient />

      {/* Server-rendered related listings — links visible to Googlebot in initial HTML */}
      <RelatedListingsServer
        artisanItems={artisanItems}
        artisanName={artisanName}
        artisanId={artisanId}
        dealerItems={dealerItems}
        dealerName={dealerName}
        dealerId={dealerId}
      />
    </>
  );
}
