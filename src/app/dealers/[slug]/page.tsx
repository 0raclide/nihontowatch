import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import {
  generateDealerJsonLd,
  generateBreadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonLd';
import { createDealerSlug, getCountryFlag, getCountryFromDomain, formatItemType } from '@/lib/dealers/utils';
import { getServerLocale } from '@/i18n/server';
import { t } from '@/i18n';
import type { Dealer } from '@/types';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

type DealerRow = { id: number; name: string; domain: string; is_active: boolean; created_at: string };

async function findDealerBySlug(slug: string) {
  const supabase = createServiceClient();

  const { data: dealers } = await supabase
    .from('dealers')
    .select('*')
    .eq('is_active', true);

  if (!dealers || dealers.length === 0) return null;

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

  const locale = await getServerLocale();
  const supabase = createServiceClient();

  // Fetch listing count + type breakdown in parallel
  const [{ count: totalCount }, { data: typeBreakdown }] = await Promise.all([
    supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', dealer.id)
      .eq('is_available', true),
    supabase
      .from('listings')
      .select('item_type')
      .eq('dealer_id', dealer.id)
      .eq('is_available', true),
  ]);

  // Count by type
  const typeCounts: Record<string, number> = {};
  (typeBreakdown as Array<{ item_type: string | null }> | null)?.forEach((listing) => {
    if (listing.item_type) {
      typeCounts[listing.item_type] = (typeCounts[listing.item_type] || 0) + 1;
    }
  });

  const sortedTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

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
      <script {...jsonLdScriptProps(dealerJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <Breadcrumbs
          items={[
            { name: t(locale, 'dealers.breadcrumbHome'), url: '/' },
            { name: t(locale, 'dealers.breadcrumbDealers'), url: '/dealers' },
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
          <a
            href={`https://${dealer.domain}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-muted hover:text-gold transition-colors inline-flex items-center gap-1"
          >
            {dealer.domain}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Inventory Breakdown */}
        <div className="bg-cream rounded-lg border border-border p-5 mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[13px] uppercase tracking-[0.1em] text-ink/50 font-medium">{t(locale, 'dealers.inventory')}</h2>
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
                    backgroundColor: `color-mix(in srgb, var(--accent) ${90 - i * 10}%, var(--border))`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Type links */}
          <div className="flex flex-wrap gap-2">
            {sortedTypes.map(([type, count], i) => (
              <Link
                key={type}
                href={`/?dealer=${dealer.id}&type=${type}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:border-gold/40 hover:bg-surface transition-colors group"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--accent) ${90 - i * 10}%, var(--border))`,
                  }}
                />
                <span className="text-[13px] text-ink capitalize group-hover:text-gold transition-colors">
                  {formatItemType(type)}
                </span>
                <span className="text-[11px] text-muted tabular-nums">{count}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Primary CTA */}
        <Link
          href={`/?dealer=${dealer.id}`}
          className="flex items-center justify-center gap-2 bg-gold hover:bg-gold/90 text-white px-6 py-3.5 rounded-lg font-medium transition-colors shadow-sm w-full md:w-auto md:inline-flex"
        >
          {t(locale, 'dealers.browseAllListings', { count: listingCount.toLocaleString() })}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </main>
    </>
  );
}

// Revalidate every hour
export const revalidate = 3600;
