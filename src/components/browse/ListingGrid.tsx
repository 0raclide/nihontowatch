'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ListingCard } from './ListingCard';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import type { Listing as QuickViewListing } from '@/types';

// Number of cards to prioritize for immediate loading (above the fold)
const PRIORITY_COUNT = 10;
// Load images when card is within this margin of viewport
const INTERSECTION_MARGIN = '200px';

interface Listing {
  id: string;
  url: string;
  title: string;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  nagasa_cm: number | null;
  images: string[] | null;
  first_seen_at: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
}

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

interface ListingGridProps {
  listings: Listing[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  infiniteScroll?: boolean;
  currency: Currency;
  exchangeRates: ExchangeRates | null;
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages: (number | 'ellipsis')[] = [];

  // Build pagination array
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (page > 3) pages.push('ellipsis');

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {/* Previous button */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-2 min-h-[44px] text-sm text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <span className="hidden sm:inline">← Previous</span>
        <span className="sm:hidden">←</span>
      </button>

      {/* Desktop: Full page numbers */}
      <div className="hidden sm:flex items-center gap-1 mx-4">
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[40px] h-10 text-sm transition-colors ${
                p === page
                  ? 'bg-ink text-paper'
                  : 'text-ink hover:bg-border/50'
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>

      {/* Mobile: Simple page indicator */}
      <span className="sm:hidden text-sm text-muted mx-3">
        {page} / {totalPages}
      </span>

      {/* Next button */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-2 min-h-[44px] text-sm text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <span className="hidden sm:inline">Next →</span>
        <span className="sm:hidden">→</span>
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {[...Array(20)].map((_, i) => (
        <div key={i} className="bg-paper border border-border">
          <div className="aspect-[4/3] img-loading" />
          <div className="p-3 space-y-2">
            <div className="h-2.5 w-16 img-loading rounded" />
            <div className="h-4 w-full img-loading rounded" />
            <div className="h-3 w-20 img-loading rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Hook to track which listing cards are near the viewport for lazy image loading.
 * Uses IntersectionObserver to efficiently detect visibility.
 */
function useVisibleCards(listingCount: number) {
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(() => {
    // Initialize with first PRIORITY_COUNT cards as visible
    const initial = new Set<number>();
    for (let i = 0; i < Math.min(PRIORITY_COUNT, listingCount); i++) {
      initial.add(i);
    }
    return initial;
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(index, el);
      // Observe new elements
      observerRef.current?.observe(el);
    } else {
      const existing = cardRefs.current.get(index);
      if (existing) {
        observerRef.current?.unobserve(existing);
        cardRefs.current.delete(index);
      }
    }
  }, []);

  useEffect(() => {
    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleIndices((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const index = Number(entry.target.getAttribute('data-index'));
            if (entry.isIntersecting) {
              // Mark this card and next few as visible (preload ahead)
              for (let i = index; i < Math.min(index + 5, listingCount); i++) {
                next.add(i);
              }
            }
            // Note: We don't remove from visible set - once loaded, stay loaded
          });
          return next;
        });
      },
      {
        rootMargin: INTERSECTION_MARGIN,
        threshold: 0
      }
    );

    // Observe all current refs
    cardRefs.current.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [listingCount]);

  // Reset visible indices when listings change significantly
  useEffect(() => {
    setVisibleIndices(() => {
      const initial = new Set<number>();
      for (let i = 0; i < Math.min(PRIORITY_COUNT, listingCount); i++) {
        initial.add(i);
      }
      return initial;
    });
  }, [listingCount]);

  return { visibleIndices, setCardRef };
}

export function ListingGrid({
  listings,
  total,
  page,
  totalPages,
  onPageChange,
  isLoading,
  isLoadingMore,
  infiniteScroll,
  currency,
  exchangeRates,
}: ListingGridProps) {
  const quickView = useQuickViewOptional();
  const { visibleIndices, setCardRef } = useVisibleCards(listings.length);

  // Pass listings to QuickView context for navigation between listings
  useEffect(() => {
    if (quickView && listings.length > 0) {
      // Convert local Listing type to QuickViewListing type
      const quickViewListings = listings.map(listing => ({
        ...listing,
        id: typeof listing.id === 'string' ? parseInt(listing.id, 10) : listing.id,
        dealer: listing.dealers ? {
          id: listing.dealers.id,
          name: listing.dealers.name,
          domain: listing.dealers.domain,
        } : undefined,
      })) as unknown as QuickViewListing[];

      quickView.setListings(quickViewListings);
    }
  }, [listings, quickView]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-block p-6 bg-paper border border-border">
          <svg
            className="w-12 h-12 text-muted mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="font-serif text-lg text-ink mb-2">No items found</h3>
          <p className="text-sm text-muted">
            Try adjusting your filters to see more results
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Results count - hidden on mobile since it's in filter trigger bar */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          Showing <span className="text-ink font-medium">{listings.length}</span> of{' '}
          <span className="text-ink font-medium">{total.toLocaleString()}</span> items
        </p>
      </div>

      {/* Grid - Compact cards for scholarly browsing */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {listings.map((listing, index) => (
          <div
            key={listing.id}
            ref={(el) => setCardRef(index, el)}
            data-index={index}
          >
            <ListingCard
              listing={listing}
              currency={currency}
              exchangeRates={exchangeRates}
              priority={index < PRIORITY_COUNT}
              isNearViewport={visibleIndices.has(index)}
            />
          </div>
        ))}
      </div>

      {/* Infinite scroll loading indicator */}
      {infiniteScroll && isLoadingMore && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-3 text-muted">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading more...</span>
          </div>
        </div>
      )}

      {/* Infinite scroll end indicator */}
      {infiniteScroll && !isLoadingMore && page >= totalPages && listings.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted">You&apos;ve seen all {total.toLocaleString()} items</p>
        </div>
      )}

      {/* Pagination - only on desktop or when not in infinite scroll mode */}
      {!infiniteScroll && totalPages > 1 && (
        <div className="mt-12 pt-8 border-t border-border">
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
