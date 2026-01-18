'use client';

import { useEffect, useRef, useMemo } from 'react';
import { ListingCard } from './ListingCard';
import { useAdaptiveVirtualScroll } from '@/hooks/useAdaptiveVirtualScroll';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import type { Listing as QuickViewListing } from '@/types';

// Number of cards to prioritize for immediate loading (above the fold)
const PRIORITY_COUNT = 10;

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

interface VirtualListingGridProps {
  listings: Listing[];
  total: number;
  currency: Currency;
  exchangeRates: ExchangeRates | null;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  // Pagination props (for non-infinite scroll mode)
  infiniteScroll?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
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
        <span className="hidden sm:inline">&larr; Previous</span>
        <span className="sm:hidden">&larr;</span>
      </button>

      {/* Desktop: Full page numbers */}
      <div className="hidden sm:flex items-center gap-1 mx-4">
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted">
              &hellip;
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
        <span className="hidden sm:inline">Next &rarr;</span>
        <span className="sm:hidden">&rarr;</span>
      </button>
    </div>
  );
}

/**
 * Virtual scrolling grid for listings.
 *
 * Features:
 * - Adaptive columns: 1 (mobile) to 5 (large desktop)
 * - Virtual scrolling: Only renders visible items
 * - SSR-safe: Renders initial batch without virtualization on server
 * - Scroll anchoring: Maintains position when items are added
 *
 * The grid uses CSS for responsive layout (no JS conditional rendering),
 * ensuring hydration compatibility.
 */
export function VirtualListingGrid({
  listings,
  total,
  currency,
  exchangeRates,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  infiniteScroll = true,
  page = 1,
  totalPages = 1,
  onPageChange,
}: VirtualListingGridProps) {
  const quickView = useQuickViewOptional();
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const lastListingCountRef = useRef(listings.length);
  const loadMoreCooldownRef = useRef(false);

  // Adaptive virtual scrolling - works for all screen sizes
  // Only enable for infinite scroll mode with larger lists
  const {
    visibleItems,
    startIndex,
    totalHeight,
    offsetY,
    columns,
    isVirtualized,
  } = useAdaptiveVirtualScroll({
    items: listings,
    totalCount: infiniteScroll ? total : undefined, // Pre-reserve height for all items
    overscan: 3, // Extra buffer rows to prevent edge flickering
    enabled: infiniteScroll && listings.length > 30, // Only virtualize in infinite scroll mode
  });

  // Memoize the converted listings for QuickView
  const quickViewListings = useMemo(() => {
    if (listings.length === 0) return [];
    return listings.map(listing => ({
      ...listing,
      id: typeof listing.id === 'string' ? parseInt(listing.id, 10) : listing.id,
      dealer: listing.dealers ? {
        id: listing.dealers.id,
        name: listing.dealers.name,
        domain: listing.dealers.domain,
      } : undefined,
    })) as unknown as QuickViewListing[];
  }, [listings]);

  // Track what we've set to avoid unnecessary updates
  const lastSetListingsRef = useRef<QuickViewListing[] | null>(null);

  // Pass listings to QuickView context for navigation
  useEffect(() => {
    if (quickView && quickViewListings.length > 0) {
      if (lastSetListingsRef.current !== quickViewListings) {
        lastSetListingsRef.current = quickViewListings;
        quickView.setListings(quickViewListings);
      }
    }
  }, [quickViewListings, quickView]);

  // Store loading state in ref so observer callback can check it without recreating observer
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;

  // Infinite scroll trigger - load more when approaching bottom
  // Observer is NOT recreated when isLoadingMore changes (uses ref instead)
  // Cooldown prevents rapid re-triggering; reset when new items load
  useEffect(() => {
    if (!infiniteScroll || !onLoadMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Check loading state via ref (avoids recreating observer)
        // Check cooldown to prevent rapid re-triggering
        if (
          entries[0].isIntersecting &&
          !isLoadingMoreRef.current &&
          !loadMoreCooldownRef.current
        ) {
          loadMoreCooldownRef.current = true;
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    const trigger = loadMoreTriggerRef.current;
    if (trigger) {
      observer.observe(trigger);
    }

    return () => observer.disconnect();
  }, [infiniteScroll, onLoadMore, hasMore]); // Note: isLoadingMore NOT in deps

  // Track listing count changes and reset cooldown when new items load
  useEffect(() => {
    if (listings.length > lastListingCountRef.current) {
      // New items loaded - reset cooldown so user can trigger more loads
      // But delay slightly to ensure the DOM has updated
      setTimeout(() => {
        loadMoreCooldownRef.current = false;
      }, 100);
    }
    lastListingCountRef.current = listings.length;
  }, [listings.length]);

  // Render the grid
  const renderGrid = () => (
    <div
      data-testid="virtual-listing-grid"
      className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {visibleItems.map((listing, idx) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          currency={currency}
          exchangeRates={exchangeRates}
          priority={startIndex + idx < PRIORITY_COUNT}
          isNearViewport={true} // All visible items should load images
        />
      ))}
    </div>
  );

  return (
    <div>
      {/* Results count - hidden on mobile */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          Showing <span className="text-ink font-medium">{listings.length}</span> of{' '}
          <span className="text-ink font-medium">{total.toLocaleString()}</span> items
          {columns === 1 && <span className="text-muted/60"> (1 column)</span>}
        </p>
      </div>

      {/* Virtualized container with scroll anchoring CSS */}
      {isVirtualized ? (
        <div
          className="relative virtual-scroll-container"
          style={{ height: totalHeight }}
        >
          <div
            className="absolute inset-x-0"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            {renderGrid()}
          </div>
        </div>
      ) : (
        // Non-virtualized (SSR or small lists)
        renderGrid()
      )}

      {/* Fixed-height loading zone (prevents layout shifts during infinite scroll) */}
      {infiniteScroll && (
        <div className="load-more-placeholder flex items-center justify-center">
          {isLoadingMore ? (
            <div className="flex items-center gap-3 text-muted">
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          ) : hasMore ? (
            <div ref={loadMoreTriggerRef} className="h-1" aria-hidden="true" />
          ) : listings.length >= 30 ? (
            <p className="text-sm text-muted">You&apos;ve seen all {total.toLocaleString()} items</p>
          ) : null}
        </div>
      )}

      {/* Pagination (only in pagination mode) */}
      {!infiniteScroll && totalPages > 1 && onPageChange && (
        <div className="mt-12 pt-8 border-t border-border">
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
