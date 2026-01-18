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
import { getActiveFilterCount } from '@/components/browse/FilterContent';
import { SaveSearchButton } from '@/components/browse/SaveSearchButton';
import type { SavedSearchCriteria } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useActivityOptional } from '@/components/activity/ActivityProvider';

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
  const isMobile = useIsMobile();
  const filtersChangedRef = useRef(false);
  const activity = useActivityOptional();

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

      <main className="max-w-[1600px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header - Refined scholarly aesthetic */}
        <div className="mb-4 lg:mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {/* Mobile: Show NihontoWatch branding - centered with mon above */}
            <Link href="/" className="lg:hidden flex flex-col items-center mb-2">
              <Image
                src="/logo-mon.png"
                alt="NihontoWatch Mon"
                width={42}
                height={42}
                className="opacity-90"
              />
              <h1 className="font-serif text-lg tracking-tight text-ink -mt-0.5">
                Nihonto<span className="text-gold font-medium">Watch</span>
              </h1>
            </Link>
            {/* Desktop: Show "Collection" */}
            <h1 className="hidden lg:block font-serif text-2xl text-ink tracking-tight">Collection</h1>
            <p className="text-[12px] lg:text-[13px] text-muted mt-1 text-center lg:text-left">
              Japanese swords and fittings from established dealers
            </p>
          </div>

          {/* Controls row - Desktop only, mobile uses filter drawer */}
          <div className="hidden lg:flex items-center gap-6">
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
                tab: 'available',
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

        {/* Mobile item count */}
        <div className="lg:hidden text-[13px] text-muted mb-4">
          {isLoading ? 'Loading...' : `${data?.total?.toLocaleString() || 0} items`}
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
              onLoadMore={loadMore}
            />
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        <FilterDrawer
          facets={data?.facets || { itemTypes: [], certifications: [], dealers: [] }}
          filters={filters}
          onFilterChange={handleFilterChange}
          isUpdating={isLoading}
          sort={sort}
          onSortChange={(newSort) => {
            setSort(newSort);
            setPage(1);
          }}
          currency={currency}
          onCurrencyChange={handleCurrencyChange}
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
