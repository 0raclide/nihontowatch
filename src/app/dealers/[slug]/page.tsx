import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Footer } from '@/components/layout/Footer';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import {
  generateDealerJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonLd';
import { createDealerSlug, getCountryFlag, getCountryFromDomain } from '@/lib/dealers/utils';
import type { Dealer } from '@/types';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// Find dealer by slug — derives country from domain TLD
async function findDealerBySlug(slug: string) {
  const supabase = createServiceClient();

  const { data: dealers } = await supabase
    .from('dealers')
    .select('*')
    .eq('is_active', true);

  if (!dealers || dealers.length === 0) return null;

  type DealerRow = { id: number; name: string; domain: string; is_active: boolean; created_at: string };
  const dealer = (dealers as DealerRow[]).find((d) => createDealerSlug(d.name) === slug);
  if (!dealer) return null;
  return { ...dealer, country: getCountryFromDomain(dealer.domain) };
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dealer = await findDealerBySlug(slug);

  if (!dealer) {
    return {
      title: 'Dealer Not Found | NihontoWatch',
      description: 'The requested dealer could not be found.',
    };
  }

  const supabase = createServiceClient();
  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', dealer.id)
    .eq('is_available', true);

  const listingCount = count || 0;
  const flag = getCountryFlag(dealer.country);

  return {
    title: `${dealer.name} ${flag} | Japanese Sword Dealer | NihontoWatch`,
    description: `Browse ${listingCount} Japanese swords and tosogu from ${dealer.name}. Find authentic katana, wakizashi, tanto, and sword fittings from this trusted dealer.`,
    alternates: {
      canonical: `${baseUrl}/dealers/${slug}`,
    },
    openGraph: {
      title: `${dealer.name} | Japanese Sword Dealer`,
      description: `Browse ${listingCount} Japanese swords and tosogu from ${dealer.name}.`,
      type: 'website',
      url: `${baseUrl}/dealers/${slug}`,
      siteName: 'NihontoWatch',
    },
    twitter: {
      card: 'summary',
      title: `${dealer.name} | NihontoWatch`,
      description: `Browse ${listingCount} listings from ${dealer.name}.`,
    },
  };
}

export default async function DealerPage({ params }: Props) {
  const { slug } = await params;
  const dealer = await findDealerBySlug(slug);

  if (!dealer) {
    notFound();
  }

  const supabase = createServiceClient();

  // Fetch listing count
  const { count: totalCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', dealer.id)
    .eq('is_available', true);

  // Fetch sample listings (first 12)
  type ListingRow = { id: number; title: string; price_value: number | null; price_currency: string; item_type: string | null; cert_type: string | null; stored_images: string[] | null; images: string[] | null };
  const { data: sampleListingsRaw } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      price_value,
      price_currency,
      item_type,
      cert_type,
      stored_images,
      images
    `)
    .eq('dealer_id', dealer.id)
    .eq('is_available', true)
    .order('price_value', { ascending: false, nullsFirst: false })
    .limit(12);
  const sampleListings = sampleListingsRaw as ListingRow[] | null;

  // Fetch item type breakdown
  const { data: typeBreakdown } = await supabase
    .from('listings')
    .select('item_type')
    .eq('dealer_id', dealer.id)
    .eq('is_available', true);

  // Count by type
  const typeCounts: Record<string, number> = {};
  (typeBreakdown as Array<{ item_type: string | null }> | null)?.forEach((listing) => {
    if (listing.item_type) {
      typeCounts[listing.item_type] = (typeCounts[listing.item_type] || 0) + 1;
    }
  });

  // Sort by count
  const sortedTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const listingCount = totalCount || 0;
  const flag = getCountryFlag(dealer.country);

  // Generate JSON-LD
  const dealerJsonLd = generateDealerJsonLd(dealer as Dealer);
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: baseUrl },
    { name: 'Dealers', url: `${baseUrl}/dealers` },
    { name: dealer.name },
  ]);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script {...jsonLdScriptProps(dealerJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <div>
        <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
          <Breadcrumbs
            items={[
              { name: 'Home', url: '/' },
              { name: 'Dealers', url: '/dealers' },
              { name: dealer.name },
            ]}
            className="mb-6"
          />

          {/* Dealer Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-serif text-3xl md:text-4xl text-ink">
                {dealer.name}
              </h1>
              <span className="text-3xl" title={dealer.country}>
                {flag}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-muted">
              <a
                href={`https://${dealer.domain}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:text-gold transition-colors flex items-center gap-1"
              >
                {dealer.domain}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              <span>•</span>
              <span>{listingCount.toLocaleString()} listings available</span>
            </div>
          </div>

          {/* Inventory Breakdown */}
          <div className="bg-cream rounded-lg border border-border p-5 mb-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[13px] uppercase tracking-[0.1em] text-ink/50 font-medium">Inventory</h2>
              <span className="text-2xl font-serif text-ink tabular-nums">{listingCount.toLocaleString()}</span>
            </div>
            {/* Proportional bar */}
            {sortedTypes.length > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden mb-4">
                {sortedTypes.map(([type, count], i) => (
                  <div
                    key={type}
                    className="transition-all duration-300"
                    style={{
                      width: `${(count / listingCount) * 100}%`,
                      backgroundColor: `color-mix(in srgb, var(--accent) ${90 - i * 15}%, var(--border))`,
                    }}
                  />
                ))}
              </div>
            )}
            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {sortedTypes.map(([type, count], i) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--accent) ${90 - i * 15}%, var(--border))`,
                    }}
                  />
                  <span className="text-[12px] text-ink capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] text-muted tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Browse All Button */}
          <div className="mb-8">
            <Link
              href={`/?dealer=${dealer.id}`}
              className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
            >
              Browse All {listingCount.toLocaleString()} Listings
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Link>
          </div>

          {/* Sample Listings */}
          {sampleListings && sampleListings.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl text-ink mb-4">
                Featured Items
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sampleListings.map((listing) => (
                  <ListingPreviewCard key={listing.id} listing={listing} />
                ))}
              </div>
              {listingCount > 12 && (
                <div className="mt-6 text-center">
                  <Link
                    href={`/?dealer=${dealer.id}`}
                    className="text-gold hover:underline"
                  >
                    View all {listingCount.toLocaleString()} listings →
                  </Link>
                </div>
              )}
            </section>
          )}
        </main>

        <Footer />
        <BottomTabBar />
      </div>
    </>
  );
}

interface ListingPreview {
  id: number;
  title: string;
  price_value: number | null;
  price_currency: string | null;
  item_type: string | null;
  cert_type: string | null;
  stored_images: string[] | null;
  images: string[] | null;
}

function ListingPreviewCard({ listing }: { listing: ListingPreview }) {
  const images = listing.stored_images || listing.images || [];
  const firstImage = images[0];

  const formatPrice = (value: number | null, currency: string | null) => {
    if (!value) return 'Ask';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'JPY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="card-hover block bg-cream rounded-lg overflow-hidden border border-border shadow-sm hover:border-gold/40 group"
    >
      {/* Image */}
      <div className="aspect-square bg-surface relative overflow-hidden">
        {firstImage ? (
          <img
            src={firstImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {/* Certification badge */}
        {listing.cert_type && (
          <div className="absolute top-2 left-2 bg-ink/80 text-cream text-xs px-2 py-1 rounded">
            {listing.cert_type}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-serif text-sm text-ink line-clamp-2 mb-1 group-hover:text-gold transition-colors">
          {listing.title}
        </h3>
        <div className="text-sm text-gold font-medium">
          {formatPrice(listing.price_value, listing.price_currency)}
        </div>
      </div>
    </Link>
  );
}

// Revalidate every hour
export const revalidate = 3600;
