'use client';

import React, { useState } from 'react';
import { VirtualListingGrid } from './VirtualListingGrid';
import { ViewportTrackingProvider } from '@/lib/viewport';
import type { DisplayItem } from '@/types/displayItem';


interface Listing {
  id: string;
  url: string;
  title: string;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  price_jpy?: number | null;
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  cert_type: string | null;
  cert_session?: number | null;
  cert_organization?: string | null;
  era?: string | null;
  province?: string | null;
  mei_type?: string | null;
  nagasa_cm: number | null;
  sori_cm?: number | null;
  motohaba_cm?: number | null;
  sakihaba_cm?: number | null;
  kasane_cm?: number | null;
  weight_g?: number | null;
  description?: string | null;
  description_en?: string | null;
  title_en?: string | null;
  setsumei_text_en?: string | null;
  setsumei_text_ja?: string | null;
  setsumei_metadata?: Record<string, unknown> | null;
  setsumei_processed_at?: string | null;
  images: string[] | null;
  stored_images?: string[] | null;  // Supabase Storage URLs (preferred)
  images_stored_at?: string | null;
  first_seen_at: string;
  last_scraped_at?: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    name_ja?: string | null;
    domain: string;
  };
  dealer_earliest_seen_at?: string | null;
  // Artisan matching
  artisan_id?: string | null;
  artisan_confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
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
  searchId?: string; // Correlation ID for CTR tracking
  isAdmin?: boolean; // For admin-only features like artisan code display
  mobileView?: 'grid' | 'gallery'; // Mobile layout mode
  smartCropEnabled?: boolean; // Admin toggle override for smart crop
  isUrlSearch?: boolean; // Whether the current search was a URL query
  searchQuery?: string; // The raw search query (for report missing URL)
  appendSlot?: React.ReactNode; // Optional element rendered after the last card (e.g. AddItemCard)
  onCardClick?: (listing: DisplayItem) => void; // Override default QuickView open (e.g. collection items)
  preMappedItems?: DisplayItem[]; // Pre-mapped DisplayItems (skip internal listingToDisplayItem mapping)
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
      {[...Array(20)].map((_, i) => (
        <div key={i} className="bg-paper border border-border">
          <div className="aspect-[3/4] img-loading" />
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

function EmptyState({ isAdmin, isUrlSearch, searchQuery }: {
  isAdmin?: boolean;
  isUrlSearch?: boolean;
  searchQuery?: string;
}) {
  const [reportStatus, setReportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reportMessage, setReportMessage] = useState('');

  const handleReportMissing = async () => {
    if (!searchQuery) return;
    setReportStatus('loading');
    try {
      const res = await fetch('/api/admin/report-missing-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: searchQuery }),
      });
      const data = await res.json();
      if (res.ok) {
        setReportStatus('success');
        setReportMessage(`Saved for ${data.dealer_name}. Scraper will pick it up.`);
      } else {
        setReportStatus('error');
        setReportMessage(data.error || 'Failed to report URL');
      }
    } catch {
      setReportStatus('error');
      setReportMessage('Network error');
    }
  };

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

        {/* Admin: Report missing URL button */}
        {isAdmin && isUrlSearch && searchQuery && (
          <div className="mt-4 pt-4 border-t border-border">
            {reportStatus === 'idle' && (
              <button
                onClick={handleReportMissing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gold border border-gold/40 rounded hover:bg-gold/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Report Missing URL
              </button>
            )}
            {reportStatus === 'loading' && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted">
                <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                Reporting...
              </div>
            )}
            {reportStatus === 'success' && (
              <p className="text-sm text-sage">{reportMessage}</p>
            )}
            {reportStatus === 'error' && (
              <p className="text-sm text-red-500">{reportMessage}</p>
            )}
          </div>
        )}
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
  searchId,
  isAdmin = false,
  mobileView = 'gallery',
  smartCropEnabled,
  isUrlSearch,
  searchQuery,
  appendSlot,
  onCardClick,
  preMappedItems,
}: ListingGridProps) {
  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Empty state — skip when appendSlot is provided (e.g. AddItemCard in collection)
  const itemCount = preMappedItems ? preMappedItems.length : listings.length;
  if (itemCount === 0 && !appendSlot) {
    return <EmptyState isAdmin={isAdmin} isUrlSearch={isUrlSearch} searchQuery={searchQuery} />;
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
        hasMore={itemCount < total}
        onLoadMore={onLoadMore}
        searchId={searchId}
        isAdmin={isAdmin}
        mobileView={mobileView}
        smartCropEnabled={smartCropEnabled}
        appendSlot={appendSlot}
        onCardClick={onCardClick}
        preMappedItems={preMappedItems}
      />
    </ViewportTrackingProvider>
  );
}
