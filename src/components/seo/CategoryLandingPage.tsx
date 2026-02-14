import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumbs';
import type { CategoryDef } from '@/lib/seo/categories';

interface PreviewListing {
  id: number;
  title: string;
  price_value: number | null;
  price_currency: string | null;
  cert_type: string | null;
  images: string[] | null;
  stored_images: string[] | null;
}

interface CategoryLandingPageProps {
  category: CategoryDef;
  breadcrumbs: BreadcrumbItem[];
  listings: PreviewListing[];
  totalCount: number;
  browseUrl: string;
}

function getImageUrl(listing: PreviewListing): string | null {
  const images = listing.stored_images?.length ? listing.stored_images : listing.images;
  return images?.[0] || null;
}

export function CategoryLandingPage({
  category,
  breadcrumbs,
  listings,
  totalCount,
  browseUrl,
}: CategoryLandingPageProps) {
  return (
    <div className="min-h-screen bg-linen dark:bg-ink">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <Breadcrumbs items={breadcrumbs} />

        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl text-ink dark:text-cream mb-3">
            {category.h1}
          </h1>
          <p className="text-muted dark:text-muted-dark text-base leading-relaxed max-w-3xl">
            {category.intro}
          </p>
          <p className="text-muted dark:text-muted-dark text-sm mt-3">
            <span className="font-medium text-ink dark:text-cream">{totalCount.toLocaleString()}</span> items currently available from trusted dealers worldwide.
          </p>
        </div>

        {/* Preview Grid */}
        {listings.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[13px] uppercase tracking-wider text-muted dark:text-muted-dark font-medium mb-4">
              Recently Listed
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {listings.map((listing) => {
                const imgUrl = getImageUrl(listing);
                return (
                  <Link
                    key={listing.id}
                    href={`/listing/${listing.id}`}
                    className="group bg-paper dark:bg-charcoal border border-border dark:border-border-dark hover:border-gold/40 rounded-lg overflow-hidden transition-colors"
                  >
                    <div className="relative aspect-[4/3] bg-linen dark:bg-ink">
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={listing.title}
                          fill
                          className="object-cover group-hover:scale-[1.02] transition-transform"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted/20">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[13px] text-ink dark:text-cream font-medium truncate group-hover:text-gold transition-colors">
                        {listing.title}
                      </p>
                      {listing.price_value ? (
                        <p className="text-[12px] text-muted dark:text-muted-dark mt-1 tabular-nums">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: listing.price_currency || 'JPY',
                            maximumFractionDigits: 0,
                          }).format(listing.price_value)}
                        </p>
                      ) : (
                        <p className="text-[12px] text-muted dark:text-muted-dark mt-1">Price on request</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center py-8">
          <Link
            href={browseUrl}
            className="inline-flex items-center gap-2 px-6 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
          >
            Browse all {totalCount.toLocaleString()} {category.h1.toLowerCase().replace(' for sale', '').replace(' — ', ' ')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </main>

      <Footer />
      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}
