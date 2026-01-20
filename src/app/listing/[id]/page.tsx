import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import ListingDetailClient from './ListingDetailClient';
import {
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
  getItemTypeBreadcrumbLabel,
} from '@/lib/seo/jsonLd';
import type { Listing, Dealer, ItemType, Currency } from '@/types';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// Listing data type for metadata generation
interface ListingMetadata {
  id: number;
  title: string;
  price_value: number | null;
  price_currency: string | null;
  item_type: string | null;
  cert_type: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  stored_images: string[] | null;
  images: string[] | null;
  dealers: { name: string; domain: string; country: string } | null;
}

// Item type labels for meta description
const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
};

function formatPrice(value: number | null, currency: string | null): string {
  if (!value) return 'Price on Request';

  const curr = currency || 'JPY';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  });

  return formatter.format(value);
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listingId = parseInt(id);

  if (isNaN(listingId)) {
    return {
      title: 'Listing Not Found | Nihontowatch',
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
        price_value,
        price_currency,
        item_type,
        cert_type,
        smith,
        tosogu_maker,
        stored_images,
        images,
        dealers (
          name,
          domain,
          country
        )
      `)
      .eq('id', listingId)
      .single();

    // Type assertion to fix Supabase type inference issue
    const listing = listingData as ListingMetadata | null;

    if (!listing || error) {
      return {
        title: 'Listing Not Found | Nihontowatch',
        description: 'The requested listing could not be found.',
      };
    }

    // Build title
    const itemType = listing.item_type
      ? ITEM_TYPE_LABELS[listing.item_type.toLowerCase()] || listing.item_type
      : null;
    const title = `${listing.title}${itemType ? ` - ${itemType}` : ''} | Nihontowatch`;

    // Build description
    const artisan = listing.smith || listing.tosogu_maker;
    const price = formatPrice(listing.price_value, listing.price_currency);
    const dealerName = listing.dealers?.name || 'Unknown Dealer';

    let description = listing.title;
    if (artisan) description += ` by ${artisan}`;
    if (listing.cert_type) description += ` (${listing.cert_type})`;
    description += `. ${price}. Available from ${dealerName} on Nihontowatch.`;

    // Get first image for OG
    const images = listing.stored_images || listing.images || [];
    const firstImage = images[0];

    // Build OG image URL (our dynamic OG image endpoint)
    const ogImageUrl = `${baseUrl}/api/og?id=${listingId}`;

    return {
      title,
      description,
      alternates: {
        canonical: `${baseUrl}/listing/${listingId}`,
      },
      openGraph: {
        title: listing.title,
        description: `${price}${artisan ? ` - ${artisan}` : ''}${listing.cert_type ? ` - ${listing.cert_type}` : ''}`,
        type: 'website',
        url: `${baseUrl}/listing/${listingId}`,
        siteName: 'Nihontowatch',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: listing.title,
          },
          // Also include the actual product image as fallback
          ...(firstImage
            ? [
                {
                  url: firstImage,
                  alt: listing.title,
                },
              ]
            : []),
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: listing.title,
        description: `${price}${artisan ? ` - ${artisan}` : ''}`,
        images: [ogImageUrl],
      },
    };
  } catch {
    return {
      title: 'Listing | Nihontowatch',
      description: 'View Japanese sword and tosogu listings on Nihontowatch.',
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
  dealers: { name: string; domain: string; country: string } | null;
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const listingId = parseInt(id);

  // Fetch listing data for JSON-LD
  let jsonLdData: { product: object; breadcrumb: object } | null = null;

  if (!isNaN(listingId)) {
    try {
      const supabase = await createClient();
      const { data: listing } = await supabase
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
          dealers (
            name,
            domain,
            country
          )
        `)
        .eq('id', listingId)
        .single();

      if (listing) {
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
              country: typedListing.dealers.country,
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

        const breadcrumbItems = [
          { name: 'Home', url: baseUrl },
          ...(itemTypeLabel
            ? [{ name: itemTypeLabel, url: `${baseUrl}/?type=${typedListing.item_type}` }]
            : []),
          { name: typedListing.title },
        ];

        const breadcrumbJsonLd = generateBreadcrumbJsonLd(breadcrumbItems);

        jsonLdData = {
          product: productJsonLd,
          breadcrumb: breadcrumbJsonLd,
        };
      }
    } catch {
      // Silently fail - JSON-LD is optional
    }
  }

  return (
    <>
      {/* JSON-LD Structured Data */}
      {jsonLdData && (
        <>
          <script {...jsonLdScriptProps(jsonLdData.product)} />
          <script {...jsonLdScriptProps(jsonLdData.breadcrumb)} />
        </>
      )}
      <ListingDetailClient />
    </>
  );
}
