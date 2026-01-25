'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { FilterSidebar } from '@/components/browse/FilterSidebar';
import { FilterDrawer } from '@/components/browse/FilterDrawer';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { AvailabilityToggle, type AvailabilityStatus } from '@/components/ui/AvailabilityToggle';
import { getActiveFilterCount } from '@/components/browse/FilterContent';
import { SaveSearchButton } from '@/components/browse/SaveSearchButton';
import type { SavedSearchCriteria } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { PAGINATION } from '@/lib/constants';
import { useActivityOptional } from '@/components/activity/ActivityProvider';
import { DeepLinkHandler } from '@/components/browse/DeepLinkHandler';
import { DataDelayBanner } from '@/components/subscription/DataDelayBanner';

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
  lastUpdated: string | null;
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

interface Filters {
  category: 'all' | 'nihonto' | 'tosogu' | 'armor';
  itemTypes: string[];
  certifications: string[];
  schools: string[];
  dealers: number[];
  historicalPeriods: string[];
  signatureStatuses: string[];
  askOnly?: boolean;
  enriched?: boolean;
  missingSetsumei?: boolean;
}

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const filtersChangedRef = useRef(false);
  const activity = useActivityOptional();

  const [activeTab, setActiveTab] = useState<AvailabilityStatus>(
    (searchParams.get('tab') as AvailabilityStatus) || 'available'
  );
  const [filters, setFilters] = useState<Filters>({
    category: (searchParams.get('cat') as 'all' | 'nihonto' | 'tosogu' | 'armor') || 'all',
    itemTypes: searchParams.get('type')?.split(',').filter(Boolean) || [],
    certifications: searchParams.get('cert')?.split(',').filter(Boolean) || [],
    schools: searchParams.get('school')?.split(',').filter(Boolean) || [],
    dealers: searchParams.get('dealer')?.split(',').map(Number).filter(Boolean) || [],
    historicalPeriods: searchParams.get('period')?.split(',').filter(Boolean) || [],
    signatureStatuses: searchParams.get('sig')?.split(',').filter(Boolean) || [],
    askOnly: searchParams.get('ask') === 'true',
    enriched: searchParams.get('enriched') === 'true',
    missingSetsumei: searchParams.get('missing_setsumei') === 'true',
  });
  const [sort, setSort] = useState(searchParams.get('sort') || 'price_desc');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Sync searchQuery state with URL when it changes (e.g., from header search)
  const urlQuery = searchParams.get('q') || '';
  useEffect(() => {
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
  }, [urlQuery]); // Only depend on urlQuery, not searchQuery to avoid loops

  // Sync enriched filter from URL (needed for SSR hydration - useSearchParams is empty on server)
  const urlEnriched = searchParams.get('enriched') === 'true';
  useEffect(() => {
    if (urlEnriched !== filters.enriched) {
      setFilters(prev => ({ ...prev, enriched: urlEnriched }));
    }
  }, [urlEnriched]); // Only depend on urlEnriched to avoid loops

  const [data, setData] = useState<BrowseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Infinite scroll state - accumulates listings as user scrolls
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false); // Ref for synchronous guard against rapid calls

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

  // Persist currency preference
  const handleCurrencyChange = useCallback((newCurrency: Currency) => {
    setCurrency(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_currency', newCurrency);
    }
  }, []);

  // Handle availability status change
  const handleAvailabilityChange = useCallback((status: AvailabilityStatus) => {
    setActiveTab(status);
    setPage(1); // Reset to page 1 when changing availability filter
  }, []);

  // Build URL params from state (for URL sync - filters and sort only, not page)
  const buildUrlParams = useCallback(() => {
    const params = new URLSearchParams();

    params.set('tab', activeTab);
    if (filters.category !== 'all') params.set('cat', filters.category);
    if (filters.itemTypes.length) params.set('type', filters.itemTypes.join(','));
    if (filters.certifications.length) params.set('cert', filters.certifications.join(','));
    if (filters.schools.length) params.set('school', filters.schools.join(','));
    if (filters.dealers.length) params.set('dealer', filters.dealers.join(','));
    if (filters.historicalPeriods.length) params.set('period', filters.historicalPeriods.join(','));
    if (filters.signatureStatuses.length) params.set('sig', filters.signatureStatuses.join(','));
    if (filters.askOnly) params.set('ask', 'true');
    if (filters.enriched) params.set('enriched', 'true');
    if (filters.missingSetsumei) params.set('missing_setsumei', 'true');
    if (sort !== 'recent') params.set('sort', sort);
    // Note: page not synced to URL - infinite scroll manages page internally
    if (searchQuery) params.set('q', searchQuery);

    return params;
  }, [activeTab, filters, sort, searchQuery]);

  // Build params for data fetching (excludes page - page changes handled by loadMore)
  const buildFetchParams = useCallback(() => {
    const params = new URLSearchParams();

    params.set('tab', activeTab);
    if (filters.category !== 'all') params.set('cat', filters.category);
    if (filters.itemTypes.length) params.set('type', filters.itemTypes.join(','));
    if (filters.certifications.length) params.set('cert', filters.certifications.join(','));
    if (filters.schools.length) params.set('school', filters.schools.join(','));
    if (filters.dealers.length) params.set('dealer', filters.dealers.join(','));
    if (filters.historicalPeriods.length) params.set('period', filters.historicalPeriods.join(','));
    if (filters.signatureStatuses.length) params.set('sig', filters.signatureStatuses.join(','));
    if (filters.askOnly) params.set('ask', 'true');
    if (filters.enriched) params.set('enriched', 'true');
    if (filters.missingSetsumei) params.set('missing_setsumei', 'true');
    if (sort !== 'recent') params.set('sort', sort);
    // Note: page is NOT included - handled by loadMore
    if (searchQuery) params.set('q', searchQuery);

    return params;
  }, [activeTab, filters, sort, searchQuery]); // Note: page is NOT in deps

  // Track previous URL to avoid unnecessary replaces that break history
  const prevUrlRef = useRef<string | null>(null);

  // Sync URL with state - only replace when URL actually changes
  // This prevents infinite loops and preserves router.push() history entries
  useEffect(() => {
    const params = buildUrlParams();
    const newUrl = `/${params.toString() ? `?${params.toString()}` : ''}`;

    // Skip if URL hasn't changed (prevents infinite loop and history overwrites)
    if (prevUrlRef.current === newUrl) return;

    // On initial mount, just record the URL without replacing
    // This preserves the history entry created by router.push() from search
    if (prevUrlRef.current === null) {
      prevUrlRef.current = newUrl;
      return;
    }

    prevUrlRef.current = newUrl;
    router.replace(newUrl, { scroll: false });
  }, [buildUrlParams, router]);

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

        // Set admin status from API response
        if (json.isAdmin !== undefined) {
          console.log('[Browse] Setting isAdmin from API:', json.isAdmin);
          setIsAdmin(json.isAdmin);
        } else {
          console.log('[Browse] API response missing isAdmin field');
        }

        // Reset to page 1 and set initial listings for infinite scroll
        setAllListings(json.listings || []);
        setPage(1);
        filtersChangedRef.current = false;
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [buildFetchParams]);

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


  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />
      <DataDelayBanner />

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
              </h1>
            </Link>
            {/* Desktop: Show "Collection" */}
            <h1 className="hidden lg:block font-serif text-2xl text-ink tracking-tight">Collection</h1>
            <p className="hidden lg:block text-[13px] text-muted mt-1">
              Japanese swords and fittings from established dealers
            </p>
          </div>

          {/* Controls row - Desktop only, mobile uses filter drawer */}
          <div className="hidden lg:flex items-center gap-6">
            <AvailabilityToggle value={activeTab} onChange={handleAvailabilityChange} />
            <CurrencySelector value={currency} onChange={handleCurrencyChange} />

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-0 text-[12px] text-charcoal focus:outline-none cursor-pointer pr-5 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0 center',
                backgroundSize: '14px',
              }}
            >
              <option value="recent">Newest</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
              <option value="name">A-Z</option>
            </select>

            {/* Save Search Button */}
            <SaveSearchButton
              criteria={{
                tab: activeTab,
                category: filters.category,
                itemTypes: filters.itemTypes,
                certifications: filters.certifications,
                dealers: filters.dealers,
                schools: filters.schools,
                askOnly: filters.askOnly,
                query: searchQuery || undefined,
                sort,
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

        {/* Mobile item count */}
        <div className="lg:hidden text-[13px] text-muted mb-4">
          {isLoading ? 'Loading...' : `${data?.total?.toLocaleString() || 0} items${searchQuery ? ` for "${searchQuery}"` : ''}`}
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row lg:gap-10">
          <FilterSidebar
            facets={data?.facets || { itemTypes: [], certifications: [], dealers: [], historicalPeriods: [], signatureStatuses: [] }}
            filters={filters}
            onFilterChange={handleFilterChange}
            isAdmin={isAdmin}
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
            />
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        <FilterDrawer
          facets={data?.facets || { itemTypes: [], certifications: [], dealers: [], historicalPeriods: [], signatureStatuses: [] }}
          filters={filters}
          onFilterChange={handleFilterChange}
          isUpdating={isLoading}
          isAdmin={isAdmin}
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

        {/* Mobile Bottom Tab Bar */}
        <BottomTabBar activeFilterCount={getActiveFilterCount(filters)} />
      </main>

      {/* Footer - Minimal, scholarly */}
      <footer className="border-t border-border/50 mt-12 lg:mt-20 transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 items-center lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-6">
              <span className="font-serif text-lg text-ink">
                Nihonto<span className="text-gold">watch</span>
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
