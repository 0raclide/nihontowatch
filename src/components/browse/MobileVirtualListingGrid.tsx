'use client';

import { useMemo, useEffect, useRef } from 'react';
import { MobileListingCard, MOBILE_CARD_HEIGHT } from './MobileListingCard';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import type { Listing as QuickViewListing } from '@/types';

// Number of extra items to render above/below viewport
const OVERSCAN = 3;

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
  listing_published_at?: string | null;
  freshness_source?: string;
  freshness_confidence?: string;
  wayback_first_archive_at?: string | null;
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

interface MobileVirtualListingGridProps {
  listings: Listing[];
  total: number;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  currency: Currency;
  exchangeRates: ExchangeRates | null;
}

export function MobileVirtualListingGrid({
  listings,
  total,
  isLoadingMore = false,
  onLoadMore,
  hasMore = false,
  currency,
  exchangeRates,
}: MobileVirtualListingGridProps) {
  const quickView = useQuickViewOptional();

  // Virtual scroll hook
  const { visibleRange, offsetY, totalHeight } = useVirtualScroll({
    itemHeight: MOBILE_CARD_HEIGHT,
    overscan: OVERSCAN,
    totalItems: listings.length,
    enabled: true,
  });

  // Infinite scroll integration
  useInfiniteScroll({
    onLoadMore: onLoadMore || (() => {}),
    hasMore,
    isLoading: isLoadingMore,
    threshold: MOBILE_CARD_HEIGHT * 2, // Trigger 2 items before end
    enabled: !!onLoadMore && hasMore,
  });

  // Get visible listings
  const visibleListings = useMemo(() => {
    return listings.slice(visibleRange.start, visibleRange.end);
  }, [listings, visibleRange.start, visibleRange.end]);

  // Convert listings for QuickView context
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

  // Pass listings to QuickView context for navigation between listings
  useEffect(() => {
    if (quickView && quickViewListings.length > 0) {
      if (lastSetListingsRef.current !== quickViewListings) {
        lastSetListingsRef.current = quickViewListings;
        quickView.setListings(quickViewListings);
      }
    }
  }, [quickViewListings, quickView]);

  // Empty state
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
    <div data-testid="mobile-virtual-grid" className="virtual-scroll-container">
      {/* Results count */}
      <div className="px-4 py-3 text-sm text-muted border-b border-border bg-cream/50">
        Showing <span className="text-ink font-medium">{listings.length}</span> of{' '}
        <span className="text-ink font-medium">{total.toLocaleString()}</span> items
      </div>

      {/* Virtual scroll container */}
      <div
        className="relative"
        style={{ height: totalHeight }}
      >
        {/* Visible items container - positioned with transform */}
        <div
          className="absolute inset-x-0"
          style={{ transform: `translateY(${offsetY}px)` }}
        >
          {visibleListings.map((listing, index) => (
            <MobileListingCard
              key={listing.id}
              listing={listing}
              currency={currency}
              exchangeRates={exchangeRates}
            />
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="flex justify-center py-8 bg-cream/50">
          <div className="flex items-center gap-3 text-muted">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading more...</span>
          </div>
        </div>
      )}

      {/* End of list indicator */}
      {!isLoadingMore && !hasMore && listings.length > 0 && listings.length >= total && (
        <div className="text-center py-8 bg-cream/50">
          <p className="text-sm text-muted">You&apos;ve seen all {total.toLocaleString()} items</p>
        </div>
      )}
    </div>
  );
}
