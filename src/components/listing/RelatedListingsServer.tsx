import Link from 'next/link';
import Image from 'next/image';

export interface RelatedItem {
  id: number;
  title: string;
  price_value: number | null;
  price_currency: string | null;
  images: string[] | null;
  stored_images: string[] | null;
}

interface RelatedSectionProps {
  title: string;
  browseUrl: string;
  items: RelatedItem[];
}

function getImageUrl(item: RelatedItem): string | null {
  const images = item.stored_images?.length ? item.stored_images : item.images;
  return images?.[0] || null;
}

function RelatedSection({ title, browseUrl, items }: RelatedSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] uppercase tracking-wider text-muted dark:text-muted-dark font-medium">
          {title}
        </h2>
        <Link
          href={browseUrl}
          className="text-[12px] text-gold hover:text-gold-light transition-colors"
        >
          View all &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const imgUrl = getImageUrl(item);
          return (
            <Link
              key={item.id}
              href={`/listing/${item.id}`}
              className="group bg-paper border border-border hover:border-gold/40 rounded-lg overflow-hidden transition-colors"
            >
              <div className="relative aspect-[4/3] bg-linen">
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={item.title}
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
              <div className="p-2.5">
                <p className="text-[12px] text-ink font-medium truncate group-hover:text-gold transition-colors">
                  {item.title}
                </p>
                {item.price_value ? (
                  <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: item.price_currency || 'JPY',
                      maximumFractionDigits: 0,
                    }).format(item.price_value)}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted mt-0.5">Price on request</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

interface RelatedListingsServerProps {
  artisanItems: RelatedItem[];
  artisanName: string | null;
  artisanId: string | null;
  dealerItems: RelatedItem[];
  dealerName: string;
  dealerId: number;
}

/**
 * Server-rendered related listings for SEO.
 * Internal links are visible in the initial HTML for Googlebot.
 */
export function RelatedListingsServer({
  artisanItems,
  artisanName,
  artisanId,
  dealerItems,
  dealerName,
  dealerId,
}: RelatedListingsServerProps) {
  if (artisanItems.length === 0 && dealerItems.length === 0) return null;

  return (
    <section className="max-w-[1200px] mx-auto px-4 lg:px-6 pb-8">
      <div className="pt-8 border-t border-border">
        {artisanItems.length > 0 && artisanId && (
          <RelatedSection
            title={`More by ${artisanName || 'this artisan'}`}
            browseUrl={`/?artisan=${artisanId}`}
            items={artisanItems}
          />
        )}
        {dealerItems.length > 0 && (
          <RelatedSection
            title={`More from ${dealerName}`}
            browseUrl={`/?dealer=${dealerId}`}
            items={dealerItems}
          />
        )}
      </div>
    </section>
  );
}
