'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { FilterSidebar } from '@/components/browse/FilterSidebar';
import type { SidebarVariant } from '@/components/browse/FilterContent';
import { FilterDrawer } from '@/components/browse/FilterDrawer';
import { ListingGrid } from '@/components/browse/ListingGrid';
import type { AvailabilityStatus } from '@/components/ui/AvailabilityToggle';
import { getActiveFilterCount } from '@/components/browse/FilterContent';
import { SaveSearchButton } from '@/components/browse/SaveSearchButton';
import type { SavedSearchCriteria } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useBrowseURLSync, type BrowseFilters } from '@/hooks/useBrowseURLSync';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { PAGINATION, BLADE_TYPES, TOSOGU_TYPES } from '@/lib/constants';
import { useActivityOptional } from '@/components/activity/ActivityProvider';
import { DeepLinkHandler } from '@/components/browse/DeepLinkHandler';
import { DataDelayBanner } from '@/components/subscription/DataDelayBanner';
import { trackSearch } from '@/lib/tracking/searchTracker';
import { getSessionId } from '@/lib/activity/sessionManager';
import { NewSinceLastVisitBanner } from '@/components/browse/NewSinceLastVisitBanner';
import { useAuth } from '@/lib/auth/AuthContext';
import { useNewSinceLastVisit } from '@/contexts/NewSinceLastVisitContext';
import { NEW_SINCE_LAST_VISIT } from '@/lib/constants';
import type { PriceHistogramData } from '@/components/browse/PriceHistogramSlider';


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
  images_stored_at?: string | null; // When images were uploaded to storage
  first_seen_at: string;
  last_scraped_at?: string;
  status: string;
  is_available: boolean;
  is_sold: boolean;
  dealer_id: number;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
  dealer_earliest_seen_at?: string | null;
  // Artisan matching
  artisan_id?: string | null;
  artisan_confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
  artisan_display_name?: string | null;
}

interface Facet {
  value: string;
  count: number;
}

interface DealerFacet {
  id: number;
  name: string;
  count: number;
}

interface BrowseResponse {
  listings: Listing[];
  total: number;
  page: number;
  totalPages: number;
  facets: {
    itemTypes: Facet[];
    certifications: Facet[];
    dealers: DealerFacet[];
    historicalPeriods: Facet[];
    signatureStatuses: Facet[];
  };
  priceHistogram?: PriceHistogramData | null;
  totalDealerCount?: number;
  lastUpdated: string | null;
  isUrlSearch?: boolean;
  isAdmin?: boolean;
}

// Format relative time for freshness display
function formatFreshness(isoDate: string | null): string {
  if (!isoDate) return 'Unknown';

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Live-ticking elapsed time since last scan
function useElapsedSince(isoDate: string | null): string | null {
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!isoDate) return;

    function compute() {
      const diffMs = Date.now() - new Date(isoDate!).getTime();
      if (diffMs < 0) return '0s';
      const totalSec = Math.floor(diffMs / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (d > 0) return `${d}d ${h}h ${m}m`;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }

    setElapsed(compute());
    const id = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(id);
  }, [isoDate]);

  return elapsed;
}

function LiveStatsBanner({ data }: { data: BrowseResponse | null }) {
  const elapsed = useElapsedSince(data?.lastUpdated ?? null);
  if (!data || !elapsed) return null;

  const galleryCount = data.totalDealerCount || data.facets.dealers.length;
  const itemCount = data.total.toLocaleString();

  return (
    <div className="hidden lg:flex items-center gap-1.5 mt-1.5 text-[11px] text-muted/70 font-mono tabular-nums">
      <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
      <span className="text-sage font-medium tracking-wide">LIVE</span>
      <span className="text-muted/30 mx-0.5">&middot;</span>
      <span>Scanned {elapsed} ago</span>
      <span className="text-muted/30 mx-0.5">&middot;</span>
      <span>{galleryCount} galleries</span>
      <span className="text-muted/30 mx-0.5">&middot;</span>
      <span>{itemCount} items</span>
    </div>
  );
}

type Filters = BrowseFilters;

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

function HomeContent() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const {
    activeTab, filters, sort, searchQuery, artisanCode,
    setActiveTab, setFilters, setSort, setSearchQuery, setArtisanCode,
    buildFetchParams, filtersChangedRef,
  } = useBrowseURLSync();

  const activity = useActivityOptional();
  // Use auth context for admin status - more reliable than API response
  const { isAdmin: authIsAdmin, user } = useAuth();
  const { recordVisit } = useNewSinceLastVisit();
  // Sidebar design: Panel variant with soft corners and tint selection
  const sidebarVariant: SidebarVariant = 'b';
  const toolbarVariant = 'panel' as const;
  const cornerStyle = 'soft' as const;
  const selectStyle = 'tint' as const;
  const [page, setPage] = useState(1);

  // Mobile view toggle (grid = 2-col compact, gallery = 1-col breathing)
  const [mobileView, setMobileView] = useState<'grid' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nihontowatch-mobile-view') as 'grid' | 'gallery') || 'gallery';
    }
    return 'gallery';
  });

  const [data, setData] = useState<BrowseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // isAdmin now comes from authIsAdmin (useAuth hook) - no need for local state

  // Infinite scroll state - accumulates listings as user scrolls
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false); // Ref for synchronous guard against rapid calls
  const currentSearchIdRef = useRef<number | undefined>(undefined); // For CTR tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Mobile contained-scroll container

  // Currency state - default to JPY
  const [currency, setCurrency] = useState<Currency>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('preferred_currency') as Currency) || 'JPY';
    }
    return 'JPY';
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);

  // Fetch exchange rates on mount
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/exchange-rates');
        const rates = await res.json();
        setExchangeRates(rates);
      } catch (error) {
        console.error('Failed to fetch exchange rates:', error);
      }
    };
    fetchRates();
  }, []);

  // Sync browse grid when a listing is edited in QuickView or via card tooltip
  // (e.g. artisan fix, setsumei connect)
  useEffect(() => {
    const handler = (e: Event) => {
      const updated = (e as CustomEvent).detail;
      if (!updated?.id) return;
      // String-coerce ids for comparison — browse API may return number while
      // listing detail API or tooltip dispatch may use a different type
      const updatedId = String(updated.id);
      setAllListings(prev => prev.map(l =>
        String(l.id) === updatedId ? { ...l, ...updated } : l
      ));
    };
    window.addEventListener('listing-refreshed', handler);
    return () => window.removeEventListener('listing-refreshed', handler);
  }, []);

  // Record visit for "New Since Last Visit" banner (debounced to avoid rapid updates)
  useEffect(() => {
    if (!isLoading && user) {
      const timer = setTimeout(() => {
        recordVisit();
      }, NEW_SINCE_LAST_VISIT.RECORD_VISIT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user, recordVisit]);

  // Persist currency preference
  const handleCurrencyChange = useCallback((newCurrency: Currency) => {
    setCurrency(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_currency', newCurrency);
    }
  }, []);

  // Persist mobile view preference
  const handleMobileViewChange = useCallback((view: 'grid' | 'gallery') => {
    setMobileView(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nihontowatch-mobile-view', view);
    }
  }, []);

  // Handle availability status change
  const handleAvailabilityChange = useCallback((status: AvailabilityStatus) => {
    setActiveTab(status);
    setPage(1); // Reset to page 1 when changing availability filter
    // Auto-switch to sale_date sort for sold tab, price_desc for others
    if (status === 'sold') {
      setSort('sale_date');
    } else if (sort === 'sale_date') {
      setSort('recent'); // Reset to default when leaving sold tab
    }
  }, [sort]);


  // Helper to check if there are active filters (for search tracking)
  const hasActiveFilters = useCallback(() => {
    return (
      filters.itemTypes.length > 0 ||
      filters.certifications.length > 0 ||
      filters.dealers.length > 0 ||
      filters.schools.length > 0 ||
      filters.historicalPeriods.length > 0 ||
      filters.signatureStatuses.length > 0 ||
      filters.askOnly === true ||
      filters.enriched === true
    );
  }, [filters]);

  // Fetch data - uses buildFetchParams (excludes page) so this only runs on filter/search changes
  // Page changes are handled by loadMore via infinite scroll
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Always fetch page 1 on initial/filter change
        const params = buildFetchParams();
        params.set('page', '1');
        const res = await fetch(`/api/browse?${params.toString()}`, { credentials: 'include' });
        const json = await res.json();
        setData(json);

        // Note: isAdmin now comes from useAuth() context, not API response
        // This is more reliable as it's determined client-side from the profile

        // Reset to page 1 and set initial listings for infinite scroll
        setAllListings(json.listings || []);
        setPage(1);
        filtersChangedRef.current = false;

        // Scroll to top of contained scroll container on filter/search change
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0 });
        }

        // Track search if there's a query or active filters
        if (searchQuery || hasActiveFilters()) {
          const sessionId = getSessionId();
          const searchFilters = {
            itemType: filters.itemTypes,
            dealer: filters.dealers.map(String),
            certification: filters.certifications,
          };
          const searchId = await trackSearch(
            searchQuery || '',
            searchFilters,
            json.total || 0,
            sessionId,
            user?.id
          );
          currentSearchIdRef.current = searchId;
        } else {
          // Clear searchId when not a search (just browsing)
          currentSearchIdRef.current = undefined;
        }
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [buildFetchParams, searchQuery, hasActiveFilters, filters, user?.id]);

  // Load more for infinite scroll
  // Uses explicit offset based on loaded items count to avoid pagination bugs
  // when page sizes differ between initial load and subsequent loads
  const loadMore = useCallback(async () => {
    // Use ref for synchronous guard (state updates are async and can cause race conditions)
    if (!data || loadingMoreRef.current) return;

    // Check if we have more items to load based on total count
    if (allListings.length >= data.total) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const params = buildFetchParams();
      // Use explicit offset = number of items already loaded
      // This fixes the bug where page-based offset calculation was wrong
      // when initial page size (100) differs from subsequent page size (50)
      params.set('offset', String(allListings.length));
      params.set('limit', String(PAGINATION.INFINITE_SCROLL_BATCH_SIZE));

      const res = await fetch(`/api/browse?${params.toString()}`, { credentials: 'include' });
      const json = await res.json();

      // Deduplicate items as a safety net
      const newListings = json.listings || [];
      const existingIds = new Set(allListings.map(l => l.id));
      const uniqueNewListings = newListings.filter((l: Listing) => !existingIds.has(l.id));

      if (uniqueNewListings.length > 0) {
        setAllListings((prev) => [...prev, ...uniqueNewListings]);
      }
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [data, allListings, buildFetchParams]);

  // Note: Infinite scroll is now handled internally by VirtualListingGrid
  // via IntersectionObserver. The useInfiniteScroll hook is no longer needed here.

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    // Track filter change
    const previousValue = filters[key as keyof Filters];

    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };

      // Track filter change event
      if (activity) {
        activity.trackFilterChange(
          {
            category: newFilters.category,
            itemTypes: newFilters.itemTypes,
            certifications: newFilters.certifications,
            schools: newFilters.schools,
            dealers: newFilters.dealers,
            askOnly: newFilters.askOnly,
            sort,
          },
          key,
          previousValue,
          value
        );
      }

      return newFilters;
    });
    setPage(1); // Reset to first page on filter change
    filtersChangedRef.current = true;
  }, [filters, sort, activity]);


  // Scroll to top of content — uses contained scroll container on mobile, window on desktop
  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    scrollToTop();
  }, [scrollToTop]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden lg:block lg:h-auto lg:min-h-screen lg:overflow-visible bg-surface transition-colors">
      {/* Desktop header — hidden on mobile, sticky on desktop (unaffected by contained scroll) */}
      <Header />

      {/* Scrollable content area: contained scroll on mobile, normal body scroll on desktop */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-none lg:overflow-visible"
      >
      <DataDelayBanner />
      <NewSinceLastVisitBanner />

      {/* Handle deep links to specific listings via ?listing= URL param */}
      <DeepLinkHandler />

      <main className="max-w-[1600px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header - Refined scholarly aesthetic */}
        <div className="mb-2 lg:mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between">
          <div>
            {/* Mobile: Show NihontoWatch branding - centered with mon above */}
            <Link href="/" className="lg:hidden flex flex-col items-center">
              <Image
                src="/logo-mon.png"
                alt="NihontoWatch Mon"
                width={44}
                height={44}
                className="opacity-90"
              />
              <h1 className="font-serif text-[22px] tracking-wide text-ink mt-1.5">
                Nihonto<span className="text-gold font-medium">Watch</span>
                <sup className="ml-1 text-[8px] font-sans font-semibold tracking-widest text-gold/70 border border-gold/30 rounded px-1 py-px align-super">BETA</sup>
              </h1>
            </Link>
            {/* Desktop: Show "Collection" */}
            <h1 className="hidden lg:block font-serif text-2xl text-ink tracking-tight">Collection</h1>
            <p className="hidden lg:block text-[13px] text-muted mt-1">
              {data ? (() => {
                const bladeSet = new Set(BLADE_TYPES as readonly string[]);
                const tosoguSet = new Set(TOSOGU_TYPES as readonly string[]);
                const swordCount = data.facets.itemTypes
                  .filter(f => bladeSet.has(f.value))
                  .reduce((sum, f) => sum + f.count, 0);
                const fittingsCount = data.facets.itemTypes
                  .filter(f => tosoguSet.has(f.value))
                  .reduce((sum, f) => sum + f.count, 0);
                const galleryCount = data.totalDealerCount || data.facets.dealers.length;
                return `${swordCount.toLocaleString()} Japanese swords and ${fittingsCount.toLocaleString()} fittings from ${galleryCount} galleries worldwide`;
              })() : 'Japanese swords and fittings from specialist galleries worldwide'}
            </p>
            {/* Live stats banner - desktop only */}
            <LiveStatsBanner data={data} />
          </div>

          {/* Desktop: Sort + item count + Save Search — inline with header */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted/60 font-medium">Sort</span>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="bg-transparent text-[12px] text-ink font-medium focus:outline-none cursor-pointer pr-4 appearance-none"
                style={{
                  border: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0 center',
                  backgroundSize: '11px',
                }}
              >
                <option value="recent">Newest</option>
                <option value="sale_date">Recently Sold</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                {authIsAdmin && <option value="elite_factor">Elite Standing</option>}
              </select>
            </div>
            <div className="w-px h-3 bg-border/30" />
            <span className="text-[11px] text-muted tabular-nums">
              {isLoading ? 'Loading...' : `${data?.total?.toLocaleString() || 0} items`}
            </span>
            <div className="w-px h-3 bg-border/30" />
            <SaveSearchButton
              criteria={{
                tab: activeTab, category: filters.category, itemTypes: filters.itemTypes,
                certifications: filters.certifications, dealers: filters.dealers,
                schools: filters.schools, askOnly: filters.askOnly,
                minPrice: filters.priceMin, maxPrice: filters.priceMax,
                query: searchQuery || undefined, sort,
              } as SavedSearchCriteria}
              currentMatchCount={data?.total}
            />
          </div>
        </div>

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-4 lg:mb-8" />

        {/* Active search indicator with clear button - visible on all screen sizes */}
        {searchQuery && (
          <div className="flex items-center gap-2 mb-3 lg:mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/15 dark:bg-gold/25 border border-gold/30 dark:border-gold/40 rounded-full">
              <svg className="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-[12px] lg:text-[13px] text-ink dark:text-white font-medium max-w-[150px] lg:max-w-[300px] truncate">
                {searchQuery}
              </span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  // Use router.push to create history entry for back navigation
                  router.push('/');
                }}
                aria-label="Clear search"
                className="p-0.5 -mr-1 text-gold hover:text-gold/80 hover:bg-gold/10 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Mobile item count + view toggle */}
        <div className="lg:hidden flex items-center justify-between mb-4">
          <span className="text-[13px] text-muted">
            {isLoading ? 'Loading...' : `${data?.total?.toLocaleString() || 0} items${searchQuery ? ` for "${searchQuery}"` : ''}`}
          </span>
          {/* View toggle — only on phone-sized screens */}
          <div className="flex items-center gap-0.5 sm:hidden">
            <button
              onClick={() => handleMobileViewChange('gallery')}
              className={`p-1.5 rounded transition-colors ${mobileView === 'gallery' ? 'text-gold' : 'text-muted/50'}`}
              aria-label="Gallery view"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="4" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              onClick={() => handleMobileViewChange('grid')}
              className={`p-1.5 rounded transition-colors ${mobileView === 'grid' ? 'text-gold' : 'text-muted/50'}`}
              aria-label="Grid view"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
                <rect x="10" y="2.5" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
                <rect x="2.5" y="10" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
                <rect x="10" y="10" width="5.5" height="5.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row lg:gap-10">
          <FilterSidebar
            facets={data?.facets || { itemTypes: [], certifications: [], dealers: [], historicalPeriods: [], signatureStatuses: [] }}
            filters={filters}
            onFilterChange={handleFilterChange}
            isAdmin={authIsAdmin}
            variant={sidebarVariant}
            cornerStyle={cornerStyle}
            selectStyle={selectStyle}
            priceHistogram={data?.priceHistogram}
            panelControls={{
              currency,
              onCurrencyChange: handleCurrencyChange,
              availability: activeTab,
              onAvailabilityChange: handleAvailabilityChange,
              isAdmin: authIsAdmin,
            }}
          />

          <div className="flex-1 min-w-0">
            <ListingGrid
              listings={allListings}
              total={data?.total || 0}
              page={page}
              totalPages={data?.totalPages || 1}
              onPageChange={handlePageChange}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              infiniteScroll={true}
              currency={currency}
              exchangeRates={exchangeRates}
              onLoadMore={loadMore}
              searchId={currentSearchIdRef.current}
              isAdmin={authIsAdmin || data?.isAdmin || false}
              mobileView={mobileView}
              isUrlSearch={data?.isUrlSearch || false}
              searchQuery={searchQuery}
            />
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        <FilterDrawer
          facets={data?.facets || { itemTypes: [], certifications: [], dealers: [], historicalPeriods: [], signatureStatuses: [] }}
          filters={filters}
          onFilterChange={handleFilterChange}
          isUpdating={isLoading}
          isAdmin={authIsAdmin}
          priceHistogram={data?.priceHistogram}
          sort={sort}
          onSortChange={(newSort) => {
            setSort(newSort);
            setPage(1);
          }}
          currency={currency}
          onCurrencyChange={handleCurrencyChange}
          availability={activeTab}
          onAvailabilityChange={handleAvailabilityChange}
        />

      </main>

      {/* Footer - Minimal, scholarly */}
      <footer className="border-t border-border/50 mt-12 lg:mt-20 transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 items-center lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-6">
              <span className="font-serif text-lg text-ink">
                Nihonto<span className="text-gold">watch</span>
                <sup className="ml-1 text-[8px] font-sans font-semibold tracking-widest text-gold/60 border border-gold/25 rounded px-1 py-px align-super">BETA</sup>
              </span>
              <span className="text-[11px] text-muted text-center lg:text-left">
                Curated Japanese arms from dealers worldwide
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-4">
              {/* Freshness indicator */}
              {data?.lastUpdated && (
                <div className="flex items-center gap-2 text-[10px] text-muted/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
                  <span>Updated {formatFreshness(data.lastUpdated)}</span>
                  <span className="text-muted/40 hidden lg:inline">·</span>
                  <span className="hidden lg:inline">Daily refresh</span>
                </div>
              )}
              <span className="text-[10px] text-muted/60">
                © {new Date().getFullYear()}
              </span>
            </div>
          </div>
        </div>
      </footer>
      </div>{/* end scrollable content */}

      {/* Mobile bottom bar — flex child at bottom of contained layout, never jumps */}
      <BottomTabBar activeFilterCount={getActiveFilterCount(filters)} contained />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center transition-colors">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted">Loading collection...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
