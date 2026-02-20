import { Suspense } from 'react';
import HomeContent from './HomeClient';
import { getHomePreview, type HomePreviewData } from '@/lib/browse/getHomePreview';
import { generateItemListJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';

// ISR: revalidate every 5 minutes so the SSR fallback stays fresh
export const revalidate = 300;

/**
 * Format price for SSR display (no client-side hooks needed).
 */
function formatPrice(value: number | null, currency: string | null): string {
  if (!value) return 'Price on request';
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : '\u00A5';
  return `${symbol}${value.toLocaleString()}`;
}

/**
 * SSR fallback — rendered in the initial HTML when the client component
 * suspends (because it uses useSearchParams). This is what Googlebot sees.
 *
 * Contains: H1, description with counts, and a grid of listing cards
 * with links to individual listing detail pages.
 */
function HomeSSRFallback({ preview }: { preview: HomePreviewData }) {
  return (
    <div className="min-h-screen bg-surface transition-colors">
      {/* Minimal header for crawlers — navigation links */}
      <header className="border-b border-border/50 px-4 py-3 lg:px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <a href="/" className="font-serif text-lg text-ink">
            Nihonto<span className="text-gold font-medium">Watch</span>
          </a>
          <nav className="hidden lg:flex items-center gap-6 text-[13px] text-muted">
            <a href="/dealers" className="hover:text-ink transition-colors">Dealers</a>
            <a href="/artists" className="hover:text-ink transition-colors">Artists</a>
            <a href="/glossary" className="hover:text-ink transition-colors">Glossary</a>
          </nav>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        <h1 className="font-serif text-2xl text-ink tracking-tight">Collection</h1>
        <p className="text-[13px] text-muted mt-1">
          {preview.totalCount > 0
            ? `${preview.totalCount.toLocaleString()} Japanese swords and fittings from ${preview.dealerCount} galleries worldwide`
            : 'Japanese swords and fittings from specialist galleries worldwide'}
        </p>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-6" />

        {/* Listing preview grid — gives Googlebot internal links + textual content */}
        {preview.listings.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {preview.listings.map((listing) => {
              const imgSrc = listing.stored_images?.[0] || listing.images?.[0];
              return (
                <a
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="block rounded-lg border border-border/50 overflow-hidden hover:border-gold/30 transition-colors"
                >
                  {imgSrc && (
                    // Use <img> for SSR fallback — Next Image requires client hydration
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgSrc}
                      alt={listing.title}
                      className="w-full aspect-[4/3] object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-3">
                    <h2 className="text-sm text-ink font-medium line-clamp-2">{listing.title}</h2>
                    {listing.cert_type && (
                      <span className="text-[10px] text-muted uppercase tracking-wider">
                        {listing.cert_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    <p className="text-sm text-ink mt-1">
                      {formatPrice(listing.price_value, listing.price_currency)}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">{listing.dealer_name}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Loading indicator for when JS is executing */}
        <div className="flex justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted">Loading full collection...</p>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Home page — server component that fetches preview data for SEO,
 * then hands off to the interactive client component.
 */
export default async function HomePage() {
  const preview = await getHomePreview();

  const itemListJsonLd = preview.listings.length > 0
    ? generateItemListJsonLd(
        preview.listings,
        'Featured Japanese Swords & Fittings',
        process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com'
      )
    : null;

  return (
    <>
      {itemListJsonLd && <script {...jsonLdScriptProps(itemListJsonLd)} />}
      <Suspense fallback={<HomeSSRFallback preview={preview} />}>
        <HomeContent />
      </Suspense>
    </>
  );
}
