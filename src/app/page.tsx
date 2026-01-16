'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { FilterSidebar } from '@/components/browse/FilterSidebar';
import { FilterDrawer } from '@/components/browse/FilterDrawer';
import { ListingGrid } from '@/components/browse/ListingGrid';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { getActiveFilterCount } from '@/components/browse/FilterContent';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

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
  category: 'all' | 'nihonto' | 'tosogu';
  itemTypes: string[];
  certifications: string[];
  schools: string[];
  dealers: number[];
  askOnly?: boolean;
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
  const { openFilterDrawer } = useMobileUI();
  const isMobile = useIsMobile();
  const filtersChangedRef = useRef(false);

  const activeTab = 'available'; // Only show available items
  const [filters, setFilters] = useState<Filters>({
    category: (searchParams.get('cat') as 'all' | 'nihonto' | 'tosogu') || 'all',
    itemTypes: searchParams.get('type')?.split(',').filter(Boolean) || [],
    certifications: searchParams.get('cert')?.split(',').filter(Boolean) || [],
    schools: searchParams.get('school')?.split(',').filter(Boolean) || [],
    dealers: searchParams.get('dealer')?.split(',').map(Number).filter(Boolean) || [],
    askOnly: searchParams.get('ask') === 'true',
  });
  const [sort, setSort] = useState(searchParams.get('sort') || 'price_desc');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const [data, setData] = useState<BrowseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Infinite scroll state for mobile
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  // Build URL params from state
  const buildUrlParams = useCallback(() => {
    const params = new URLSearchParams();

    params.set('tab', 'available');
    if (filters.category !== 'all') params.set('cat', filters.category);
    if (filters.itemTypes.length) params.set('type', filters.itemTypes.join(','));
    if (filters.certifications.length) params.set('cert', filters.certifications.join(','));
    if (filters.schools.length) params.set('school', filters.schools.join(','));
    if (filters.dealers.length) params.set('dealer', filters.dealers.join(','));
    if (filters.askOnly) params.set('ask', 'true');
    if (sort !== 'recent') params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    if (searchQuery) params.set('q', searchQuery);

    return params;
  }, [activeTab, filters, sort, page, searchQuery]);

  // Sync URL with state
  useEffect(() => {
    const params = buildUrlParams();
    const newUrl = `/${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [buildUrlParams, router]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = buildUrlParams();
        const res = await fetch(`/api/browse?${params.toString()}`);
        const json = await res.json();
        setData(json);

        // Reset accumulated listings when filters change or on fresh load
        if (isMobile) {
          setAllListings(json.listings || []);
          filtersChangedRef.current = false;
        }
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [buildUrlParams, isMobile]);

  // Load more for infinite scroll
  const loadMore = useCallback(async () => {
    if (!data || page >= data.totalPages || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = buildUrlParams();
      params.set('page', String(nextPage));

      const res = await fetch(`/api/browse?${params.toString()}`);
      const json = await res.json();

      setAllListings((prev) => [...prev, ...(json.listings || [])]);
      setPage(nextPage);
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [data, page, isLoadingMore, buildUrlParams]);

  // Infinite scroll hook - only on mobile
  useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore: data ? page < data.totalPages : false,
    isLoading: isLoadingMore,
    enabled: isMobile,
  });

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
    filtersChangedRef.current = true;
  }, []);


  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900 transition-colors">
      <Header />

      <main className="max-w-[1600px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header - Refined scholarly aesthetic */}
        <div className="mb-4 lg:mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-xl lg:text-2xl text-ink dark:text-white tracking-tight">Collection</h1>
            <p className="text-[12px] lg:text-[13px] text-muted dark:text-gray-500 mt-1">
              Japanese swords and fittings from established dealers
            </p>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between lg:justify-end gap-4 lg:gap-6">
            <CurrencySelector value={currency} onChange={handleCurrencyChange} />

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-0 text-[12px] text-charcoal dark:text-gray-300 focus:outline-none cursor-pointer pr-5 appearance-none"
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
          </div>
        </div>

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border dark:via-gray-700 to-transparent mb-4 lg:mb-8" />

        {/* Mobile Filter Bar - Prominent sticky bar */}
        <div className="lg:hidden sticky top-[57px] z-30 bg-cream/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-border/50 dark:border-gray-800/50 -mx-4 px-4 py-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted dark:text-gray-500">
              {isLoading ? 'Loading...' : `${data?.total?.toLocaleString() || 0} items`}
            </span>
            <button
              onClick={openFilterDrawer}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-[13px] transition-all active:scale-95 ${
                getActiveFilterCount(filters) > 0
                  ? 'bg-gold text-white shadow-md'
                  : 'bg-ink dark:bg-white text-white dark:text-ink'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {getActiveFilterCount(filters) > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-white/20 rounded-full text-[11px] flex items-center justify-center">
                  {getActiveFilterCount(filters)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row lg:gap-10">
          <FilterSidebar
            facets={data?.facets || { itemTypes: [], certifications: [], dealers: [] }}
            filters={filters}
            onFilterChange={handleFilterChange}
          />

          <div className="flex-1 min-w-0">
            <ListingGrid
              listings={isMobile ? allListings : (data?.listings || [])}
              total={data?.total || 0}
              page={page}
              totalPages={data?.totalPages || 1}
              onPageChange={handlePageChange}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              infiniteScroll={isMobile}
              currency={currency}
              exchangeRates={exchangeRates}
            />
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        <FilterDrawer
          facets={data?.facets || { itemTypes: [], certifications: [], dealers: [] }}
          filters={filters}
          onFilterChange={handleFilterChange}
          isUpdating={isLoading}
        />

        {/* Mobile Floating Action Button - always visible when scrolling */}
        <button
          onClick={openFilterDrawer}
          className="lg:hidden fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-gold text-white shadow-lg shadow-gold/30 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Open filters"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {getActiveFilterCount(filters) > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 bg-ink text-white text-[11px] rounded-full flex items-center justify-center font-medium">
              {getActiveFilterCount(filters)}
            </span>
          )}
        </button>
      </main>

      {/* Footer - Minimal, scholarly */}
      <footer className="border-t border-border/50 dark:border-gray-800/50 mt-12 lg:mt-20 transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 items-center lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-6">
              <span className="font-serif text-lg text-ink dark:text-white">
                Nihonto<span className="text-gold">watch</span>
              </span>
              <span className="text-[11px] text-muted dark:text-gray-600 text-center lg:text-left">
                Curated Japanese arms from dealers worldwide
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-4">
              {/* Freshness indicator */}
              {data?.lastUpdated && (
                <div className="flex items-center gap-2 text-[10px] text-muted/70 dark:text-gray-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
                  <span>Updated {formatFreshness(data.lastUpdated)}</span>
                  <span className="text-muted/40 hidden lg:inline">·</span>
                  <span className="hidden lg:inline">Daily refresh</span>
                </div>
              )}
              <span className="text-[10px] text-muted/60 dark:text-gray-600">
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
        <div className="min-h-screen bg-cream dark:bg-gray-900 flex items-center justify-center transition-colors">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted dark:text-gray-400">Loading collection...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
