'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { ListingCard } from './ListingCard';
import { useAdaptiveVirtualScroll } from '@/hooks/useAdaptiveVirtualScroll';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useLocale } from '@/i18n/LocaleContext';
import { MOBILE_CARD_HEIGHTS } from '@/lib/rendering/cardHeight';
import { isSmartCropActive } from '@/types/subscription';
import type { Listing as QuickViewListing } from '@/types';


// Detect mobile devices - disable JS virtualization on mobile due to scroll issues
// Mobile browsers (especially iOS) have transform timing issues that cause "teleport" glitches
function useIsMobileDevice() {
  const [isMobile, setIsMobile] = useState(true); // Default to true (safer for SSR)
  useEffect(() => {
    // Check for touch capability and small screen
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;
    setIsMobile(isTouchDevice && isSmallScreen);
  }, []);
  return isMobile;
}

// Number of cards to prioritize for immediate loading (above the fold)
const PRIORITY_COUNT = 10;

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
  // Smart crop focal point
  focal_x?: number | null;
  focal_y?: number | null;
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
  searchId?: string; // Correlation ID for CTR tracking
  isAdmin?: boolean; // For admin-only features like artisan code display
  mobileView?: 'grid' | 'gallery'; // Mobile layout mode
  smartCropEnabled?: boolean; // Override for smart crop toggle (admin tuning)
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
  const { t } = useLocale();
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
        <span className="hidden sm:inline">&larr; {t('browse.previous')}</span>
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
        <span className="hidden sm:inline">{t('browse.next')} &rarr;</span>
        <span className="sm:hidden">&rarr;</span>
      </button>
    </div>
  );
}

/**
 * Virtual scrolling grid for listings.
 *
 * Three rendering strategies coexist, selected at runtime:
 *
 *  1. **SSR / small list** — All items rendered without virtualization.
 *     Active when: server-side render OR items <= 15 OR pagination mode.
 *
 *  2. **CSS content-visibility** (mobile) — All items rendered in the DOM
 *     but the browser skips layout/paint for off-screen cards via
 *     `content-visibility: auto`. Card height hint comes from the
 *     `--card-intrinsic-height` CSS custom property (set here, sourced
 *     from `cardHeight.ts`).
 *     Active when: touch device with small screen (< 768px).
 *
 *  3. **JS virtual scroll** (desktop) — Only visible rows are in the DOM,
 *     positioned with `translateY`. Row height computed from first
 *     principles in `cardHeight.ts`.
 *     Active when: not mobile, infinite scroll mode, > 15 items.
 *
 * The single source of truth for card heights is `src/lib/rendering/cardHeight.ts`.
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
  searchId,
  isAdmin = false,
  mobileView = 'gallery',
  smartCropEnabled: smartCropEnabledProp,
}: VirtualListingGridProps) {
  const quickView = useQuickViewOptional();
  const { t } = useLocale();
  // Use prop override if provided, otherwise fall back to env var check
  const smartCropEnabled = smartCropEnabledProp ?? isSmartCropActive();
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const lastListingCountRef = useRef(listings.length);
  const lastLoadTimeRef = useRef(0);

  // Mobile browsers have transform timing issues that cause scroll glitches
  // Disable JS virtualization on mobile - render all items directly
  const isMobileDevice = useIsMobileDevice();

  // Adaptive virtual scrolling - works for all screen sizes
  // Disabled on iOS due to transform glitches - uses CSS content-visibility instead
  const {
    visibleItems,
    startIndex,
    totalHeight,
    offsetY,
    columns,
    isVirtualized,
  } = useAdaptiveVirtualScroll({
    items: listings,
    totalCount: undefined, // Dynamic height - grows as items load (no massive empty space)
    overscan: 3, // Extra buffer rows to prevent edge flickering
    // Disable JS virtualization on mobile devices due to scroll glitches
    // With infinite scroll loading ~100 items at a time, no virtualization needed
    // Note: QuickView scroll lock handles preventing recalculation during modal
    enabled: infiniteScroll && listings.length > 15 && !isMobileDevice,
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
  // Skip when in alert carousel mode to prevent overwriting the alert listings
  useEffect(() => {
    if (quickView && quickViewListings.length > 0 && !quickView.isAlertMode) {
      if (lastSetListingsRef.current !== quickViewListings) {
        lastSetListingsRef.current = quickViewListings;
        quickView.setListings(quickViewListings);
      }
    }
  }, [quickViewListings, quickView]);

  // Use ref for isLoadingMore to avoid effect re-runs during loading
  const isLoadingMoreRef = useRef(isLoadingMore);
  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  // Infinite scroll trigger - load more when approaching bottom
  // Uses BOTH IntersectionObserver (for visibility) AND scroll position (for early loading)
  // This ensures we start loading well before users reach the end
  useEffect(() => {
    if (!infiniteScroll || !onLoadMore || !hasMore) return;

    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const triggerLoad = () => {
      // Skip if already loading (use ref to get current value)
      if (isLoadingMoreRef.current) return;

      const now = Date.now();
      // Throttle: minimum 500ms between load triggers (fast enough to keep up with scrolling)
      if (now - lastLoadTimeRef.current > 500) {
        lastLoadTimeRef.current = now;
        onLoadMore();
      }
    };

    // IntersectionObserver with very large margin (3000px) for early trigger
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          triggerLoad();
        }
      },
      { rootMargin: '3000px' }
    );
    observer.observe(trigger);

    // Backup: scroll position based trigger
    // Trigger loading when scrolled past 40% of the content height
    // This ensures we start loading well before reaching the end
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Load more when user has scrolled past 40% of the current content
      const scrollPercent = (scrollY + viewportHeight) / documentHeight;
      if (scrollPercent > 0.4) {
        triggerLoad();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [infiniteScroll, onLoadMore, hasMore]);

  // Track listing count for debugging
  useEffect(() => {
    lastListingCountRef.current = listings.length;
  }, [listings.length]);

  // Render the grid
  // On mobile (when JS virtualization is disabled), add ios-native-virtualize class
  // for CSS content-visibility virtualization - this enables native browser virtualization
  // without the transform timing issues that cause "teleport" glitches on iOS
  // Mobile grid classes: grid mode = 2 cols compact, gallery mode = 1 col with breathing room
  // sm: and up are unchanged regardless of mobileView
  const mobileGridClasses = mobileView === 'grid'
    ? 'grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
    : 'grid grid-cols-1 gap-10 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

  const renderGrid = () => (
    <div
      data-testid="virtual-listing-grid"
      className={`${mobileGridClasses}${
        !isVirtualized && isMobileDevice ? ' ios-native-virtualize' : ''
      }`}
      style={!isVirtualized && isMobileDevice ? {
        '--card-intrinsic-height': `${MOBILE_CARD_HEIGHTS[mobileView]}px`,
      } as React.CSSProperties : undefined}
    >
      {visibleItems.map((listing, idx) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          currency={currency}
          exchangeRates={exchangeRates}
          priority={startIndex + idx < PRIORITY_COUNT}
          searchId={searchId}
          isAdmin={isAdmin}
          mobileView={mobileView}
          focalPosition={
            smartCropEnabled && listing.focal_x != null && listing.focal_y != null
              ? `${listing.focal_x}% ${listing.focal_y}%`
              : undefined
          }
        />
      ))}
    </div>
  );

  // Gallery wrapper — inset cards from screen edges on mobile for shadow breathing room
  const galleryWrapperClass = mobileView === 'gallery' ? 'px-3 sm:px-0' : '';

  return (
    <div className={galleryWrapperClass}>
      {/* Results count - hidden on mobile */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <p className="text-sm text-muted">
          {t('browse.showingCount', { count: String(listings.length), total: total.toLocaleString() })}
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
              <span className="text-sm">{t('browse.loadingMore')}</span>
            </div>
          ) : hasMore ? (
            // Trigger element - only rendered when not loading
            // IntersectionObserver watches this element
            <div ref={loadMoreTriggerRef} className="h-4 w-full" aria-hidden="true" />
          ) : listings.length >= 30 ? (
            <p className="text-sm text-muted">{t('browse.seenAllItems', { total: total.toLocaleString() })}</p>
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
