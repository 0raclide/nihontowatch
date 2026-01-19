'use client';

import { VirtualListingGrid } from './VirtualListingGrid';
import { ViewportTrackingProvider } from '@/lib/viewport';

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
  onLoadMore?: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
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

function EmptyState() {
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

/**
 * ListingGrid - Wrapper component for displaying listing grids.
 *
 * This component always renders VirtualListingGrid internally, ensuring
 * the same component tree is rendered on both server and client for
 * hydration compatibility.
 *
 * The VirtualListingGrid handles:
 * - Adaptive columns via CSS (1 col mobile to 5 col desktop)
 * - Virtual scrolling for large lists
 * - Both infinite scroll and pagination modes
 */
export function ListingGrid({
  listings,
  total,
  page,
  totalPages,
  onPageChange,
  isLoading,
  isLoadingMore,
  infiniteScroll = false,
  currency,
  exchangeRates,
  onLoadMore,
}: ListingGridProps) {
  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Empty state
  if (listings.length === 0) {
    return <EmptyState />;
  }

  // Always use VirtualListingGrid - same component for all screen sizes
  // This ensures SSR hydration compatibility (no conditional component trees)
  // ViewportTrackingProvider enables dwell time tracking on listing cards
  return (
    <ViewportTrackingProvider>
      <VirtualListingGrid
        listings={listings}
        total={total}
        currency={currency}
        exchangeRates={exchangeRates}
        infiniteScroll={infiniteScroll}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        isLoadingMore={isLoadingMore}
        hasMore={listings.length < total}
        onLoadMore={onLoadMore}
      />
    </ViewportTrackingProvider>
  );
}
