'use client';

import { useState, useCallback, useRef, useEffect, type SyntheticEvent } from 'react';
import Link from 'next/link';
import type { ArtistDirectoryEntry, DirectoryFacets } from '@/lib/supabase/yuhinkai';
import { getArtisanDisplayParts } from '@/lib/artisan/displayName';
import { eraToBroadPeriod } from '@/lib/artisan/eraPeriods';
import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { ArtistFilterSidebar } from '@/components/artisan/ArtistFilterSidebar';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

// =============================================================================
// TYPES
// =============================================================================

interface ArtistWithSlug extends ArtistDirectoryEntry {
  slug: string;
  cover_image?: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

interface Filters {
  type: 'smith' | 'tosogu';
  school?: string;
  province?: string;
  era?: string;
  q?: string;
  sort: 'elite_factor' | 'provenance_factor' | 'name' | 'total_items' | 'for_sale';
  notable: boolean;
}

interface ArtistsPageClientProps {
  initialFilters: Filters;
  initialPage: number;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ArtistsPageClient({
  initialFilters,
  initialPage,
}: ArtistsPageClientProps) {
  const [allArtists, setAllArtists] = useState<ArtistWithSlug[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: initialPage, pageSize: 50, totalPages: 0, totalCount: 0 });
  const [filters, setFilters] = useState(initialFilters);
  const [facets, setFacets] = useState<DirectoryFacets>({ schools: [], provinces: [], eras: [], totals: { smiths: 0, tosogu: 0 } });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialFilters.q || '');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [attributedItemCount, setAttributedItemCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageRef = useRef(1);
  const hasMore = currentPageRef.current < pagination.totalPages;

  // Live ref for filters — used inside setTimeout callbacks to avoid stale closures.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Mobile drawer state (local — not via MobileUIContext)
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const { openNavDrawer } = useMobileUI();
  const drawerSearchRef = useRef<HTMLInputElement>(null);

  // Build URL search string from filters (no page param — infinite scroll)
  const buildQueryString = useCallback((f: Filters) => {
    const p = new URLSearchParams();
    if (f.type === 'tosogu') p.set('type', 'tosogu');
    if (f.school) p.set('school', f.school);
    if (f.province) p.set('province', f.province);
    if (f.era) p.set('era', f.era);
    if (f.q) p.set('q', f.q);
    if (f.sort !== 'elite_factor') p.set('sort', f.sort);
    if (!f.notable) p.set('notable', 'false');
    return p.toString();
  }, []);

  // Update URL without navigation (keeps it shareable).
  // Uses native History.prototype.replaceState to bypass Next.js's monkey-patched
  // version, which would otherwise notify the router and re-trigger the Suspense
  // boundary from loading.tsx — unmounting the component and destroying client state.
  const updateUrl = useCallback((f: Filters) => {
    const qs = buildQueryString(f);
    const url = `/artists${qs ? `?${qs}` : ''}`;
    History.prototype.replaceState.call(window.history, window.history.state, '', url);
  }, [buildQueryString]);

  // Client-side fetch — the only data-fetching path (initial load + filter changes + scroll)
  // append=false: replace allArtists (filter/search change), append=true: concat (infinite scroll)
  const fetchArtists = useCallback(async (f: Filters, page: number, append: boolean = false) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setIsLoadingMore(false); // Clear in case an append request was just aborted
    }
    setError(null);

    const p = new URLSearchParams();
    p.set('type', f.type);
    if (f.school) p.set('school', f.school);
    if (f.province) p.set('province', f.province);
    if (f.era) p.set('era', f.era);
    if (f.q) p.set('q', f.q);
    p.set('sort', f.sort);
    p.set('page', page.toString());
    p.set('limit', '50');
    if (!f.notable) p.set('notable', 'false');

    try {
      const res = await fetch(`/api/artists/directory?${p.toString()}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setAllArtists(prev => [...prev, ...data.artists]);
        } else {
          setAllArtists(data.artists);
        }
        currentPageRef.current = page;
        setPagination(data.pagination);
        if (data.facets) setFacets(data.facets);
        if (data.lastUpdated !== undefined) setLastUpdated(data.lastUpdated);
        if (data.attributedItemCount !== undefined) setAttributedItemCount(data.attributedItemCount);
      } else {
        setError('Failed to load artists. Please try again.');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Network error. Please check your connection.');
    } finally {
      if (!controller.signal.aborted) {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchArtists(initialFilters, initialPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup abort and debounce on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const applyFilters = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    updateUrl(newFilters);
    currentPageRef.current = 1;
    window.scrollTo({ top: 0 });
    fetchArtists(newFilters, 1, false);
  }, [updateUrl, fetchArtists]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string | boolean) => {
    const newFilters = { ...filtersRef.current, [key]: value };
    // Clear school/province/era when switching types — they won't be valid for the other type
    if (key === 'type') {
      newFilters.school = undefined;
      newFilters.province = undefined;
      newFilters.era = undefined;
    }
    applyFilters(newFilters);
  }, [applyFilters]);

  const loadMore = useCallback(() => {
    const nextPage = currentPageRef.current + 1;
    fetchArtists(filtersRef.current, nextPage, true);
  }, [fetchArtists]);

  useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore,
    threshold: 600,
  });

  // Debounced search — fires 300ms after user stops typing.
  // Uses filtersRef.current inside the timeout to always read the LATEST filters,
  // avoiding stale closures that could reset the type.
  const debouncedSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      applyFilters({ ...filtersRef.current, q: trimmed || undefined });
    }, 300);
  }, [applyFilters]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Immediate search on Enter — cancel any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = searchInput.trim();
    applyFilters({ ...filtersRef.current, q: trimmed || undefined });
  }, [searchInput, applyFilters]);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    applyFilters({ ...filtersRef.current, q: undefined });
  }, [applyFilters]);

  const clearAllFilters = useCallback(() => {
    setSearchInput('');
    applyFilters({ type: filtersRef.current.type, sort: 'elite_factor', notable: true });
  }, [applyFilters]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 lg:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="hidden lg:block font-serif text-2xl text-ink tracking-tight">Artists</h1>
        {!isLoading && (facets.totals.smiths + facets.totals.tosogu) > 0 && (
          <p className="hidden lg:block text-[13px] text-muted mt-1">
            {attributedItemCount.toLocaleString()} items by {(facets.totals.smiths + facets.totals.tosogu).toLocaleString()} celebrated artisans across {facets.schools.length.toLocaleString()} schools
          </p>
        )}
        <LiveStatsBanner lastUpdated={lastUpdated} artisanCount={facets.totals.smiths + facets.totals.tosogu} schoolCount={facets.schools.length} />
        {/* Mobile heading */}
        <h1 className="lg:hidden font-serif text-2xl text-ink tracking-tight">
          Artists
        </h1>
        {!isLoading && (facets.totals.smiths + facets.totals.tosogu) > 0 && (
          <p className="lg:hidden mt-2 text-sm text-ink/50">
            {attributedItemCount.toLocaleString()} items by {(facets.totals.smiths + facets.totals.tosogu).toLocaleString()} celebrated artisans
          </p>
        )}
      </div>

      {/* Desktop: Sidebar + Content layout */}
      <div className="flex flex-col lg:flex-row lg:gap-10">
        {/* Sidebar — hidden on mobile */}
        <ArtistFilterSidebar
          filters={filters}
          facets={facets}
          onFilterChange={handleFilterChange}
          onSearchInput={handleSearchInput}
          onSearchSubmit={handleSearch}
          onClearSearch={clearSearch}
          onClearAll={clearAllFilters}
          searchInput={searchInput}
          isLoading={isLoading}
        />

        {/* Results */}
        <div id="artist-grid" className="flex-1 min-w-0 mt-8 lg:mt-0">
          {/* Desktop count header */}
          {!isLoading && allArtists.length > 0 && (
            <p className="hidden lg:block text-[11px] text-ink/45 mb-4">
              Showing {allArtists.length.toLocaleString()} of {pagination.totalCount.toLocaleString()} artist{pagination.totalCount !== 1 ? 's' : ''}
            </p>
          )}

          {/* Error state */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 flex items-center justify-between">
              <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={() => fetchArtists(filters, currentPageRef.current)}
                className="text-[11px] text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 underline underline-offset-2 ml-4 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : allArtists.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-ink/50 text-sm">No artists found matching your criteria.</p>
              <button
                onClick={clearAllFilters}
                className="mt-3 text-[12px] text-gold hover:text-gold-light underline"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <>
              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {allArtists.map((artist) => (
                  <ArtistCard key={artist.code} artist={artist} />
                ))}
              </div>

              {/* Loading more skeletons */}
              {isLoadingMore && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                  {[...Array(3)].map((_, i) => (
                    <SkeletonCard key={`more-${i}`} />
                  ))}
                </div>
              )}

              {/* End of results */}
              {!hasMore && allArtists.length > 0 && (
                <p className="text-center text-[11px] text-ink/30 mt-8">
                  All {pagination.totalCount.toLocaleString()} artists loaded
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================================================================
          MOBILE BOTTOM BAR + DRAWERS
          ================================================================ */}

      {/* Bottom Tab Bar — mobile only */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-cream/95 backdrop-blur-sm border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="navigation"
        aria-label="Artist navigation"
      >
        <div className="flex items-center h-16">
          {/* Search */}
          <button
            onClick={() => {
              setFilterDrawerOpen(false);
              setSearchDrawerOpen(true);
            }}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[11px] mt-1 font-medium">Search</span>
          </button>

          {/* Filters */}
          <button
            onClick={() => {
              setSearchDrawerOpen(false);
              setFilterDrawerOpen(true);
            }}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors relative"
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {(() => {
                const count = [filters.school, filters.province, filters.era, filters.q].filter(Boolean).length
                  + (filters.notable === false ? 1 : 0);
                return count > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gold text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {count}
                  </span>
                ) : null;
              })()}
            </div>
            <span className="text-[11px] mt-1 font-medium">Filters</span>
          </button>

          {/* Menu */}
          <button
            onClick={openNavDrawer}
            className="flex flex-col items-center justify-center flex-1 h-full text-charcoal active:text-gold transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[11px] mt-1 font-medium">Menu</span>
          </button>
        </div>
      </nav>

      {/* Spacer for bottom bar */}
      <div
        className="lg:hidden flex-shrink-0"
        style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
        aria-hidden="true"
      />

      {/* Artist Search Drawer */}
      <Drawer
        isOpen={searchDrawerOpen}
        onClose={() => setSearchDrawerOpen(false)}
        title="Search Artists"
      >
        <div className="p-4 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              const trimmed = searchInput.trim();
              applyFilters({ ...filtersRef.current, q: trimmed || undefined });
              setSearchDrawerOpen(false);
            }}
          >
            <div className="relative">
              <input
                ref={drawerSearchRef}
                type="search"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search by name, kanji, or code..."
                className="w-full pl-4 pr-10 py-3 bg-cream border border-border text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-gold/40 focus:shadow-[0_0_0_3px_rgba(181,142,78,0.1)] transition-all"
                autoFocus
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    clearSearch();
                    setSearchDrawerOpen(false);
                  }}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink/60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ink/40 hover:text-gold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Quick school suggestions */}
          {facets.schools.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Popular schools</p>
              <div className="flex flex-wrap gap-2">
                {facets.schools.slice(0, 6).map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      setSearchInput('');
                      applyFilters({ ...filtersRef.current, q: undefined, school: s.value });
                      setSearchDrawerOpen(false);
                    }}
                    className="px-3 py-1.5 text-[12px] bg-hover border border-border text-ink/60 hover:text-gold hover:border-gold/40 transition-colors"
                  >
                    {s.value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* Artist Filter Drawer */}
      <Drawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        title="Filter Artists"
      >
        <div className="p-4 space-y-5">
          {/* Type Toggle */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Type</p>
            <div className="flex border border-border divide-x divide-border">
              {(['smith', 'tosogu'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleFilterChange('type', t)}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2.5 min-h-[44px] text-[12px] uppercase tracking-[0.12em] transition-colors ${
                    filters.type === t
                      ? 'bg-gold/10 text-gold font-medium'
                      : 'text-ink/50 hover:text-ink hover:bg-hover'
                  }`}
                >
                  {t === 'smith' ? 'Nihonto' : 'Tosogu'}
                </button>
              ))}
            </div>
          </div>

          {/* School */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">School</p>
            <select
              value={filters.school || ''}
              onChange={(e) => handleFilterChange('school', e.target.value || '')}
              className="w-full px-3 py-2.5 bg-cream border border-border text-[13px] text-ink focus:outline-none focus:border-gold/40 cursor-pointer"
            >
              <option value="">All Schools</option>
              {facets.schools.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          {/* Province */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Province</p>
            <select
              value={filters.province || ''}
              onChange={(e) => handleFilterChange('province', e.target.value || '')}
              className="w-full px-3 py-2.5 bg-cream border border-border text-[13px] text-ink focus:outline-none focus:border-gold/40 cursor-pointer"
            >
              <option value="">All Provinces</option>
              {facets.provinces.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Period</p>
            <select
              value={filters.era || ''}
              onChange={(e) => handleFilterChange('era', e.target.value || '')}
              className="w-full px-3 py-2.5 bg-cream border border-border text-[13px] text-ink focus:outline-none focus:border-gold/40 cursor-pointer"
            >
              <option value="">All Periods</option>
              {facets.eras.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Sort by</p>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="w-full px-3 py-2.5 bg-cream border border-border text-[13px] text-ink focus:outline-none focus:border-gold/40 cursor-pointer"
            >
              <option value="elite_factor">Elite Standing</option>
              <option value="provenance_factor">Provenance Standing</option>
              <option value="total_items">Total Works</option>
              <option value="for_sale">On the Market</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          {/* Notable Toggle */}
          <label className="flex items-center gap-3 py-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.notable}
              onChange={(e) => handleFilterChange('notable', e.target.checked)}
              className="accent-gold w-4 h-4"
            />
            <span className="text-[13px] text-ink">Notable only</span>
          </label>

          {/* Clear All */}
          <button
            onClick={() => {
              clearAllFilters();
              setFilterDrawerOpen(false);
            }}
            className="w-full py-2.5 text-[12px] text-gold hover:text-gold-light border border-gold/30 hover:border-gold/50 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      </Drawer>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================


function SkeletonCard() {
  return (
    <div className="bg-cream border border-border flex flex-row overflow-hidden">
      {/* Thumbnail placeholder */}
      <div className="w-20 sm:w-28 shrink-0 bg-white/[0.04] border-r border-border/50 flex items-center justify-center p-2 sm:p-3">
        <div className="w-full h-16 sm:h-20 img-loading rounded" />
      </div>
      {/* Content */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        {/* Row 1: Name + Works */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="h-4 w-28 img-loading rounded" />
            <div className="h-3 w-14 img-loading rounded" />
          </div>
          <div className="shrink-0 text-center space-y-1">
            <div className="h-5 w-8 img-loading rounded mx-auto" />
            <div className="h-2 w-10 img-loading rounded" />
          </div>
        </div>
        {/* Row 2: School / Period / Province */}
        <div className="mt-1.5 h-3 w-36 img-loading rounded" />
        {/* Row 3: Cert badges */}
        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-3 w-14 img-loading rounded" />
          <div className="h-3 w-12 img-loading rounded" />
          <div className="h-3 w-14 img-loading rounded" />
        </div>
        {/* Elite bar */}
        <div className="mt-auto pt-2.5">
          <div className="h-1 w-full img-loading rounded" />
        </div>
      </div>
    </div>
  );
}

function ArtistCard({ artist }: { artist: ArtistWithSlug }) {
  const percentile = artist.percentile ?? 0;
  const isSchool = artist.is_school_code;

  const profileUrl = `/artists/${artist.slug}`;
  const availableCount = artist.available_count ?? 0;

  // Designation shortcodes — ordered by prestige, only shown when > 0
  const certBadges: Array<{ label: string; value: number }> = [];
  if (artist.kokuho_count > 0) certBadges.push({ label: 'Kokuho', value: artist.kokuho_count });
  if (artist.jubun_count > 0) certBadges.push({ label: 'Jubun', value: artist.jubun_count });
  if (artist.jubi_count > 0) certBadges.push({ label: 'Jubi', value: artist.jubi_count });
  if (artist.gyobutsu_count > 0) certBadges.push({ label: 'Gyobutsu', value: artist.gyobutsu_count });
  if (artist.tokuju_count > 0) certBadges.push({ label: 'Tokuju', value: artist.tokuju_count });
  if (artist.juyo_count > 0) certBadges.push({ label: 'Juyo', value: artist.juyo_count });

  // Build subtitle for school codes vs individual artists
  const subtitleParts: string[] = [];
  if (isSchool) {
    subtitleParts.push('School attribution');
    if (artist.member_count && artist.member_count > 0) {
      subtitleParts.push(`${artist.member_count} known ${artist.entity_type === 'tosogu' ? 'makers' : 'smiths'}`);
    }
    if (artist.province) subtitleParts.push(artist.province);
  }

  return (
    <Link
      href={profileUrl}
      className={`group bg-cream border border-border hover:border-gold/40 transition-colors flex flex-row overflow-hidden${
        isSchool ? ' border-l-2 border-l-gold/60' : ''
      }`}
    >
      {/* Thumbnail — catalog oshigata from Yuhinkai */}
      {artist.cover_image && (
        <div className="w-20 sm:w-28 shrink-0 bg-white/[0.04] dark:bg-white/[0.04] border-r border-border/50 flex items-center justify-center p-2 sm:p-3 overflow-hidden">
          <img
            src={artist.cover_image}
            alt={`${artist.name_romaji || artist.code} — ${artist.entity_type === 'smith' ? 'swordsmith' : 'tosogu maker'}${artist.school ? `, ${artist.school} school` : ''}`}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
            onError={(e: SyntheticEvent<HTMLImageElement>) => {
              const container = e.currentTarget.parentElement;
              if (container) container.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        {/* Row 1: Name + Total works */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-ink group-hover:text-gold transition-colors truncate block">
              {(() => { const dp = getArtisanDisplayParts(artist.name_romaji, artist.school); return <>{dp.prefix && <span className="font-normal">{dp.prefix} </span>}{dp.name || artist.code}</>; })()}
            </span>
            {artist.name_kanji && (
              <span className="text-xs text-ink/40 ml-2">{artist.name_kanji}</span>
            )}
          </div>
          <div className="shrink-0 text-center leading-none">
            <span className="block text-lg font-serif text-ink tabular-nums">{artist.total_items}</span>
            <span className={`block text-[8px] uppercase tracking-[0.15em] mt-0.5${
              isSchool ? ' text-gold' : ' text-ink/40'
            }`}>{isSchool ? 'school' : 'works'}</span>
          </div>
        </div>

        {/* Row 2: School / Period / Province (or school attribution subtitle) */}
        <div className="mt-1.5 text-[11px] text-ink/45 truncate">
          {isSchool
            ? subtitleParts.join(' \u00b7 ')
            : [artist.school, eraToBroadPeriod(artist.era) || artist.era, artist.province].filter(Boolean).join(' \u00b7 ') || 'Unknown'}
        </div>

        {/* Row 3: Cert counts */}
        {certBadges.length > 0 && (
          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-ink tabular-nums flex-wrap">
            {certBadges.map((badge) => (
              <span key={badge.label}>
                {badge.value} {badge.label}
              </span>
            ))}
          </div>
        )}

        {/* Row 4: For sale count */}
        {availableCount > 0 && (
          <div className="mt-1.5 flex justify-end text-[11px] tabular-nums">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              {availableCount} on the market
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </div>
        )}

        {/* Elite bar — pinned to bottom */}
        {percentile > 0 && (
          <div className="mt-auto pt-2.5">
            <div className="h-1 bg-border/50 overflow-hidden">
              <div
                className="h-full bg-gold/40 transition-all"
                style={{ width: `${percentile}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// =============================================================================
// LIVE STATS BANNER
// =============================================================================

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

function LiveStatsBanner({ lastUpdated, artisanCount, schoolCount }: { lastUpdated: string | null; artisanCount: number; schoolCount: number }) {
  const elapsed = useElapsedSince(lastUpdated);
  if (!elapsed) return null;

  return (
    <div className="hidden lg:flex items-center gap-1.5 mt-1.5 text-[11px] text-muted/70 font-mono tabular-nums">
      <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
      <span className="text-sage font-medium tracking-wide">LIVE</span>
      <span className="text-muted/30 mx-0.5">&middot;</span>
      <span>Scanned {elapsed} ago</span>
      <span className="text-muted/30 mx-0.5">&middot;</span>
      <span>{artisanCount.toLocaleString()} artists</span>
      <span className="text-muted/30 mx-0.5">&middot;</span>
      <span>{schoolCount.toLocaleString()} schools</span>
    </div>
  );
}
