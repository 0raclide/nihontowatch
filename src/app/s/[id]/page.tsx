import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

/**
 * Share Proxy Route
 *
 * This route solves the Discord/social media OG image caching problem.
 *
 * The Problem:
 * Discord caches OG images by PAGE URL, not image URL. Once cached,
 * changing the og:image URL has NO effect - Discord ignores it.
 *
 * The Solution:
 * 1. Share URLs use /s/[id]?v=[version] instead of /listing/[id]
 * 2. The version is derived from og_image_url (timestamp in filename)
 * 3. When og_image changes, version changes, Discord sees "new" page URL
 * 4. Humans are immediately redirected to /listing/[id]
 * 5. Bot crawlers (Discord, Twitter, etc.) get the OG metadata they need
 *
 * URL Format: /s/123?v=abc123
 * - 123 = listing ID
 * - v=abc123 = version (extracted from og_image_url timestamp)
 */

interface ListingForShare {
  id: number;
  title: string;
  price_value: number | null;
  price_currency: string | null;
  item_type: string | null;
  cert_type: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  og_image_url: string | null;
  dealers: { name: string; domain: string } | null;
}

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

/**
 * Extract version from og_image_url
 * Filename format: dealer/LISTING_TIMESTAMP.png
 * Example: aoi-art/L00007_1768921557.png → returns "1768921557"
 */
function extractVersion(ogImageUrl: string | null): string {
  if (!ogImageUrl) return 'v1';

  // Try to extract timestamp from filename
  const match = ogImageUrl.match(/_(\d+)\.png/);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback: hash the URL for consistency
  let hash = 0;
  for (let i = 0; i < ogImageUrl.length; i++) {
    const char = ogImageUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listingId = parseInt(id);

  if (isNaN(listingId)) {
    return {
      title: 'Share | Nihontowatch',
      description: 'View Japanese sword and tosogu listings on Nihontowatch.',
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
        og_image_url,
        dealers (
          name,
          domain
        )
      `)
      .eq('id', listingId)
      .single();

    const listing = listingData as ListingForShare | null;

    if (!listing || error) {
      return {
        title: 'Listing Not Found | Nihontowatch',
        description: 'The requested listing could not be found.',
      };
    }

    // Build description
    const artisan = listing.smith || listing.tosogu_maker;
    const price = formatPrice(listing.price_value, listing.price_currency);
    const dealerName = listing.dealers?.name || 'Unknown Dealer';

    let description = listing.title;
    if (artisan) description += ` by ${artisan}`;
    if (listing.cert_type) description += ` (${listing.cert_type})`;
    description += `. ${price}. Available from ${dealerName} on Nihontowatch.`;

    // Get OG image URL - use pre-generated if available, else fallback to dynamic
    const ogImageUrl = listing.og_image_url || `${baseUrl}/api/og?id=${listingId}`;

    // Extract version for cache-busting
    const version = extractVersion(listing.og_image_url);

    // The canonical URL points to the share route WITH version
    // This is key: Discord will cache based on this URL
    const shareUrl = `${baseUrl}/s/${listingId}?v=${version}`;

    return {
      title: `${listing.title} | Nihontowatch`,
      description,
      alternates: {
        // Canonical points to the real listing page for SEO
        canonical: `${baseUrl}/listing/${listingId}`,
      },
      openGraph: {
        title: listing.title,
        description: `${price}${artisan ? ` - ${artisan}` : ''}${listing.cert_type ? ` - ${listing.cert_type}` : ''}`,
        type: 'website',
        url: shareUrl,
        siteName: 'Nihontowatch',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: listing.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: listing.title,
        description: `${price}${artisan ? ` - ${artisan}` : ''}`,
        images: [ogImageUrl],
      },
      // Robots: index the share page but tell crawlers the canonical is /listing/[id]
      robots: {
        index: true,
        follow: true,
      },
      // Important: Add cache control hints
      other: {
        'og:image:secure_url': ogImageUrl,
      },
    };
  } catch {
    return {
      title: 'Share | Nihontowatch',
      description: 'View Japanese sword and tosogu listings on Nihontowatch.',
    };
  }
}

/**
 * Share Proxy Page Component
 *
 * This page does two things:
 * 1. Serves OG metadata (in generateMetadata above) for social crawlers
 * 2. Redirects human visitors to the actual listing page
 *
 * Crawlers (Discord, Twitter, Facebook):
 * - Make HTTP request to /s/123?v=xxx
 * - Read the HTML <head> to extract OG meta tags
 * - Don't execute JavaScript or follow meta refresh
 * - Cache the OG image based on this page URL
 *
 * Human visitors:
 * - Get redirected immediately via client-side navigation
 * - See a brief loading state (usually too fast to notice)
 */
export default async function ShareProxyPage({ params }: Props) {
  const { id } = await params;
  const listingId = parseInt(id);

  const targetUrl = isNaN(listingId) ? '/' : `/listing/${listingId}`;

  return (
    <>
      {/* Meta refresh for crawlers and non-JS browsers */}
      <head>
        <meta httpEquiv="refresh" content={`0; url=${targetUrl}`} />
      </head>

      {/* Minimal loading UI while redirecting */}
      <div className="flex flex-col items-center justify-center min-h-screen bg-ink text-cream">
        <div className="flex flex-col items-center gap-4">
          {/* Loading spinner */}
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          <div className="text-lg">Opening listing...</div>
          <a
            href={targetUrl}
            className="text-gold hover:underline text-sm"
          >
            Click here if not redirected
          </a>
        </div>
      </div>

      {/* Immediate JavaScript redirect */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace("${targetUrl}");`,
        }}
      />
    </>
  );
}
