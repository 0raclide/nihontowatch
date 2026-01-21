import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import {
  generateDealerJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonLd';
import type { Dealer } from '@/types';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

export const metadata: Metadata = {
  title: 'Japanese Sword Dealers | 27 Trusted Nihonto Dealers Worldwide | Nihontowatch',
  description:
    'Browse 27 verified Japanese sword dealers from Japan and USA. Find authentic katana, wakizashi, tanto, and tosogu from trusted dealers like Aoi Art, Nipponto, and more.',
  alternates: {
    canonical: `${baseUrl}/dealers`,
  },
  openGraph: {
    title: 'Japanese Sword Dealers | Nihontowatch',
    description:
      'Browse 27 verified Japanese sword dealers from Japan and USA. Find authentic katana, wakizashi, tanto, and tosogu from trusted dealers.',
    type: 'website',
    url: `${baseUrl}/dealers`,
    siteName: 'Nihontowatch',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Japanese Sword Dealers | Nihontowatch',
    description: 'Browse 27 verified Japanese sword dealers from Japan and USA.',
  },
};

interface DealerWithCount extends Dealer {
  listing_count: number;
}

// Helper to create URL-friendly slug from dealer name
function createDealerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Derive country from domain TLD (fallback when country column doesn't exist)
function getCountryFromDomain(domain: string): string {
  if (domain.endsWith('.jp') || domain.endsWith('.co.jp')) return 'JP';
  if (domain.endsWith('.com') || domain.endsWith('.net')) return 'USA';
  if (domain.endsWith('.uk') || domain.endsWith('.co.uk')) return 'UK';
  if (domain.endsWith('.de')) return 'DE';
  return 'JP'; // Default to Japan for nihonto dealers
}

// Country flag emoji
function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    JP: '🇯🇵',
    Japan: '🇯🇵',
    US: '🇺🇸',
    USA: '🇺🇸',
    UK: '🇬🇧',
    DE: '🇩🇪',
    Germany: '🇩🇪',
  };
  return flags[country] || '🌐';
}

export default async function DealersPage() {
  const supabase = createServiceClient();

  // Fetch all active dealers with their listing counts
  // Note: country column may not exist in all environments, handled with fallback
  const { data: dealers, error } = await supabase
    .from('dealers')
    .select(`
      id,
      name,
      domain,
      is_active,
      created_at
    `)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('[DealersPage] Error fetching dealers:', error);
  }

  // Fetch listing counts for each dealer
  const dealersWithCounts: DealerWithCount[] = [];

  if (dealers && dealers.length > 0) {
    for (const dealer of dealers as Array<{ id: number; name: string; domain: string; is_active: boolean; created_at: string }>) {
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('dealer_id', dealer.id)
        .eq('is_available', true);

      dealersWithCounts.push({
        ...dealer,
        country: getCountryFromDomain(dealer.domain),
        listing_count: count || 0,
      } as DealerWithCount);
    }
  }

  // Group by country
  const japaneseDealer = dealersWithCounts.filter(
    (d) => d.country === 'JP' || d.country === 'Japan'
  );
  const westernDealers = dealersWithCounts.filter(
    (d) => d.country !== 'JP' && d.country !== 'Japan'
  );

  // Calculate totals
  const totalListings = dealersWithCounts.reduce((sum, d) => sum + d.listing_count, 0);
  const totalDealers = dealersWithCounts.length;

  // Generate JSON-LD for each dealer
  const dealerJsonLdScripts = dealersWithCounts.map((dealer) => {
    const jsonLd = generateDealerJsonLd(dealer);
    return jsonLdScriptProps(jsonLd);
  });

  return (
    <>
      {/* JSON-LD Structured Data for each dealer */}
      {dealerJsonLdScripts.map((props, i) => (
        <script key={i} {...props} />
      ))}

      <div className="min-h-screen bg-linen dark:bg-ink">
        <Header />

        <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl md:text-4xl text-ink dark:text-cream mb-2">
              Japanese Sword Dealers
            </h1>
            <p className="text-muted dark:text-muted-dark text-lg">
              Browse {totalListings.toLocaleString()} listings from {totalDealers} trusted dealers worldwide
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-cream dark:bg-charcoal rounded-lg p-4 border border-border dark:border-border-dark">
              <div className="text-2xl font-serif text-ink dark:text-cream">
                {totalDealers}
              </div>
              <div className="text-sm text-muted dark:text-muted-dark">Active Dealers</div>
            </div>
            <div className="bg-cream dark:bg-charcoal rounded-lg p-4 border border-border dark:border-border-dark">
              <div className="text-2xl font-serif text-ink dark:text-cream">
                {totalListings.toLocaleString()}
              </div>
              <div className="text-sm text-muted dark:text-muted-dark">Total Listings</div>
            </div>
            <div className="bg-cream dark:bg-charcoal rounded-lg p-4 border border-border dark:border-border-dark">
              <div className="text-2xl font-serif text-ink dark:text-cream">
                {japaneseDealer.length}
              </div>
              <div className="text-sm text-muted dark:text-muted-dark">Japanese Dealers</div>
            </div>
            <div className="bg-cream dark:bg-charcoal rounded-lg p-4 border border-border dark:border-border-dark">
              <div className="text-2xl font-serif text-ink dark:text-cream">
                {westernDealers.length}
              </div>
              <div className="text-sm text-muted dark:text-muted-dark">Western Dealers</div>
            </div>
          </div>

          {/* Japanese Dealers */}
          <section className="mb-12">
            <h2 className="font-serif text-2xl text-ink dark:text-cream mb-4 flex items-center gap-2">
              <span>🇯🇵</span> Japanese Dealers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {japaneseDealer.map((dealer) => (
                <DealerCard key={dealer.id} dealer={dealer} />
              ))}
            </div>
          </section>

          {/* Western Dealers */}
          {westernDealers.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl text-ink dark:text-cream mb-4 flex items-center gap-2">
                <span>🌐</span> International Dealers
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {westernDealers.map((dealer) => (
                  <DealerCard key={dealer.id} dealer={dealer} />
                ))}
              </div>
            </section>
          )}
        </main>

        <BottomTabBar />
      </div>
    </>
  );
}

function DealerCard({ dealer }: { dealer: DealerWithCount }) {
  const slug = createDealerSlug(dealer.name);
  const flag = getCountryFlag(dealer.country);

  return (
    <Link
      href={`/dealers/${slug}`}
      className="block bg-cream dark:bg-charcoal rounded-lg p-4 border border-border dark:border-border-dark hover:border-gold dark:hover:border-gold transition-colors group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-serif text-lg text-ink dark:text-cream group-hover:text-gold transition-colors">
          {dealer.name}
        </h3>
        <span className="text-xl" title={dealer.country}>
          {flag}
        </span>
      </div>
      <p className="text-sm text-muted dark:text-muted-dark mb-3 truncate">
        {dealer.domain}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted dark:text-muted-dark">
          {dealer.listing_count.toLocaleString()} listings
        </span>
        <span className="text-xs text-gold group-hover:underline">
          View inventory →
        </span>
      </div>
    </Link>
  );
}

// Revalidate every hour
export const revalidate = 3600;
