import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import ListingDetailClient from './ListingDetailClient';

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
  dealers: { name: string } | null;
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
    const { data: listing } = await supabase
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
          name
        )
      `)
      .eq('id', listingId)
      .single();

    if (!listing) {
      return {
        title: 'Listing Not Found | Nihontowatch',
        description: 'The requested listing could not be found.',
      };
    }

    const typedListing = listing as unknown as ListingMetadata;

    // Build title
    const itemType = typedListing.item_type
      ? ITEM_TYPE_LABELS[typedListing.item_type.toLowerCase()] || typedListing.item_type
      : null;
    const title = `${typedListing.title}${itemType ? ` - ${itemType}` : ''} | Nihontowatch`;

    // Build description
    const artisan = typedListing.smith || typedListing.tosogu_maker;
    const price = formatPrice(typedListing.price_value, typedListing.price_currency);
    const dealerName = typedListing.dealers?.name || 'Unknown Dealer';

    let description = typedListing.title;
    if (artisan) description += ` by ${artisan}`;
    if (typedListing.cert_type) description += ` (${typedListing.cert_type})`;
    description += `. ${price}. Available from ${dealerName} on Nihontowatch.`;

    // Get first image for OG
    const images = typedListing.stored_images || typedListing.images || [];
    const firstImage = images[0];

    // Build OG image URL (our dynamic OG image endpoint)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';
    const ogImageUrl = `${baseUrl}/api/og?id=${listingId}`;

    return {
      title,
      description,
      openGraph: {
        title: typedListing.title,
        description: `${price}${artisan ? ` - ${artisan}` : ''}${typedListing.cert_type ? ` - ${typedListing.cert_type}` : ''}`,
        type: 'website',
        url: `${baseUrl}/listing/${listingId}`,
        siteName: 'Nihontowatch',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: typedListing.title,
          },
          // Also include the actual product image as fallback
          ...(firstImage
            ? [
                {
                  url: firstImage,
                  alt: typedListing.title,
                },
              ]
            : []),
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: typedListing.title,
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

export default function ListingPage() {
  return <ListingDetailClient />;
}
