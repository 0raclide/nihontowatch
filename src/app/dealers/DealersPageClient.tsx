'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getCountryFlag } from '@/lib/dealers/utils';
import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';

// =============================================================================
// TYPES
// =============================================================================

interface TypeBreakdown {
  type: string;
  label: string;
  count: number;
}

interface CertBreakdown {
  cert: string;
  label: string;
  count: number;
}

interface DealerEntry {
  id: number;
  name: string;
  domain: string;
  country: string;
  slug: string;
  listing_count: number;
  type_breakdown: TypeBreakdown[];
  cert_breakdown: CertBreakdown[];
}

interface Totals {
  dealers: number;
  listings: number;
  japanDealers: number;
  internationalDealers: number;
}

interface FacetItem {
  value: string;
  label: string;
  dealerCount: number;
}

interface Filters {
  sort: 'listing_count' | 'name' | 'country';
  q?: string;
  region?: 'japan' | 'international';
  types?: string[];
  certs?: string[];
}

interface DealersPageClientProps {
  initialFilters: Filters;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DealersPageClient({ initialFilters }: DealersPageClientProps) {
  const [dealers, setDealers] = useState<DealerEntry[]>([]);
  const [totals, setTotals] = useState<Totals>({ dealers: 0, listings: 0, japanDealers: 0, internationalDealers: 0 });
  const [typeFacets, setTypeFacets] = useState<FacetItem[]>([]);
  const [certFacets, setCertFacets] = useState<FacetItem[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialFilters.q || '');
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Mobile drawer state
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const { openNavDrawer } = useMobileUI();

  // Build URL search string from filters
  const buildQueryString = useCallback((f: Filters) => {
    const p = new URLSearchParams();
    if (f.sort !== 'listing_count') p.set('sort', f.sort);
    if (f.q) p.set('q', f.q);
    if (f.region) p.set('region', f.region);
    if (f.types?.length) p.set('type', f.types.join(','));
    if (f.certs?.length) p.set('cert', f.certs.join(','));
    return p.toString();
  }, []);

  // Update URL without navigation (bypass Next.js router)
  const updateUrl = useCallback((f: Filters) => {
    const qs = buildQueryString(f);
    const url = `/dealers${qs ? `?${qs}` : ''}`;
    History.prototype.replaceState.call(window.history, window.history.state, '', url);
  }, [buildQueryString]);

  // Client-side fetch
  const fetchDealers = useCallback(async (f: Filters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const p = new URLSearchParams();
    p.set('sort', f.sort);
    if (f.q) p.set('q', f.q);
    if (f.region) p.set('region', f.region);
    if (f.types?.length) p.set('type', f.types.join(','));
    if (f.certs?.length) p.set('cert', f.certs.join(','));

    try {
      const res = await fetch(`/api/dealers/directory?${p.toString()}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setDealers(data.dealers);
        setTotals(data.totals);
        if (data.facets?.types) setTypeFacets(data.facets.types);
        if (data.facets?.certs) setCertFacets(data.facets.certs);
      } else {
        setError('Failed to load dealers. Please try again.');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Network error. Please check your connection.');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchDealers(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const applyFilters = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    updateUrl(newFilters);
    fetchDealers(newFilters);
  }, [updateUrl, fetchDealers]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string | undefined) => {
    const newFilters = { ...filtersRef.current, [key]: value || undefined };
    applyFilters(newFilters);
  }, [applyFilters]);

  // Debounced search
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
    applyFilters({ sort: 'listing_count', q: undefined, region: undefined, types: undefined, certs: undefined });
  }, [applyFilters]);

  // Toggle a value in a multi-select filter array
  const toggleArrayFilter = useCallback((key: 'types' | 'certs', value: string) => {
    const current = filtersRef.current[key] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    applyFilters({ ...filtersRef.current, [key]: next.length > 0 ? next : undefined });
  }, [applyFilters]);

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    return [filters.q, filters.region].filter(Boolean).length
      + (filters.types?.length || 0)
      + (filters.certs?.length || 0);
  }, [filters.q, filters.region, filters.types, filters.certs]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 lg:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-ink tracking-tight">Dealers</h1>
        {!isLoading && totals.dealers > 0 && (
          <p className="hidden lg:block text-[13px] text-muted mt-1">
            {totals.listings.toLocaleString()} listings from {totals.dealers} trusted dealers worldwide
          </p>
        )}
        {/* Mobile subtitle */}
        {!isLoading && totals.dealers > 0 && (
          <p className="lg:hidden mt-2 text-sm text-ink/50">
            {totals.dealers} dealers &middot; {totals.listings.toLocaleString()} listings
          </p>
        )}
      </div>

      {/* Desktop: Sidebar + Content layout */}
      <div className="flex flex-col lg:flex-row lg:gap-10">
        {/* Sidebar — hidden on mobile */}
        <aside className="hidden lg:block w-[264px] flex-shrink-0">
          <div className="sticky top-24">
            <div
              className="bg-surface-elevated rounded-2xl border border-border/40 flex flex-col"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}
            >
              {/* Zone 1: Sort */}
              <div className="flex-shrink-0 px-4 pt-3.5 pb-3 border-b border-border/15">
                <div className="flex items-center justify-center gap-2 mb-2.5">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted/60 font-medium">Sort</span>
                  <select
                    value={filters.sort}
                    onChange={(e) => handleFilterChange('sort', e.target.value)}
                    disabled={isLoading && dealers.length === 0}
                    className="bg-transparent text-[11px] text-ink font-medium focus:outline-none cursor-pointer pr-4 appearance-none"
                    style={{
                      border: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0 center',
                      backgroundSize: '11px',
                    }}
                  >
                    <option value="listing_count">Most Listings</option>
                    <option value="name">Name A-Z</option>
                    <option value="country">Region</option>
                  </select>
                </div>

                {/* Region Toggle — segmented control */}
                <div className="flex rounded-lg border border-border/30 overflow-hidden">
                  {([
                    { value: undefined, label: 'All' },
                    { value: 'japan', label: 'Japan' },
                    { value: 'international', label: "Int'l" },
                  ] as const).map((opt, i) => (
                    <button
                      key={opt.label}
                      onClick={() => handleFilterChange('region', opt.value)}
                      disabled={isLoading && dealers.length === 0}
                      className={`flex-1 py-[7px] text-[11px] font-semibold tracking-[0.03em] transition-colors ${
                        i > 0 ? 'border-l border-border/20' : ''
                      } ${
                        filters.region === opt.value
                          ? 'bg-gold/12 text-gold'
                          : 'text-muted hover:text-ink hover:bg-hover/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zone 2: Filter header */}
              <div className="flex-shrink-0 px-4 py-2 border-b border-border/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[10px] uppercase tracking-[0.1em] font-medium text-muted/50">Filters</h2>
                    {activeFilterCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold bg-gold/80 text-white rounded-full leading-none">
                        {activeFilterCount}
                      </span>
                    )}
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[10px] text-muted/50 hover:text-gold transition-colors font-medium"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Zone 3: Search */}
              <div className="px-4 pb-3 pt-2">
                <form onSubmit={handleSearch} className="relative">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    placeholder="Search dealers..."
                    className="w-full pl-7 pr-7 py-1.5 text-[11px] rounded-md border border-border/30 bg-transparent text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </form>
              </div>

              {/* Zone 4: Inventory Type filter */}
              {typeFacets.length > 0 && (
                <FilterSection
                  title="Inventory Type"
                  activeCount={filters.types?.length || 0}
                  onReset={() => applyFilters({ ...filtersRef.current, types: undefined })}
                  defaultOpen={!!filters.types?.length}
                >
                  <CheckboxList
                    items={typeFacets}
                    selected={filters.types || []}
                    onToggle={(v) => toggleArrayFilter('types', v)}
                    limit={8}
                  />
                </FilterSection>
              )}

              {/* Zone 5: Designation filter */}
              {certFacets.length > 0 && (
                <FilterSection
                  title="Designation"
                  activeCount={filters.certs?.length || 0}
                  onReset={() => applyFilters({ ...filtersRef.current, certs: undefined })}
                  defaultOpen={!!filters.certs?.length}
                >
                  <CheckboxList
                    items={certFacets}
                    selected={filters.certs || []}
                    onToggle={(v) => toggleArrayFilter('certs', v)}
                    limit={10}
                  />
                </FilterSection>
              )}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0 mt-8 lg:mt-0">
          {/* Desktop count header */}
          {dealers.length > 0 && !isLoading && (
            <p className="hidden lg:block text-[11px] text-ink/45 mb-4">
              Showing {dealers.length} dealer{dealers.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Error state */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 flex items-center justify-between">
              <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={() => fetchDealers(filters)}
                className="text-[11px] text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 underline underline-offset-2 ml-4 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {isLoading && dealers.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !isLoading && dealers.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-ink/50 text-sm">No dealers found matching your criteria.</p>
              <button
                onClick={clearAllFilters}
                className="mt-3 text-[12px] text-gold hover:text-gold-light underline"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity duration-150 ${
              isLoading ? 'opacity-40 pointer-events-none' : ''
            }`}>
              {dealers.map((dealer) => (
                <DealerCard key={dealer.id} dealer={dealer} />
              ))}
            </div>
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
        aria-label="Dealer navigation"
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
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gold text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
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

      {/* Search Drawer */}
      <Drawer
        isOpen={searchDrawerOpen}
        onClose={() => setSearchDrawerOpen(false)}
        title="Search Dealers"
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
                type="search"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search by name or domain..."
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

          {/* Quick region buttons */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Region</p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: undefined, label: 'All Dealers' },
                { value: 'japan', label: 'Japan' },
                { value: 'international', label: 'International' },
              ] as const).map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    applyFilters({ ...filtersRef.current, region: opt.value });
                    setSearchDrawerOpen(false);
                  }}
                  className={`px-3 py-1.5 text-[12px] border transition-colors ${
                    filters.region === opt.value
                      ? 'bg-gold/10 border-gold/40 text-gold'
                      : 'bg-hover border-border text-ink/60 hover:text-gold hover:border-gold/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      {/* Filter Drawer */}
      <Drawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        title="Filter Dealers"
      >
        <div className="p-4 space-y-5">
          {/* Sort */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Sort by</p>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="w-full px-3 py-2.5 bg-cream border border-border text-[13px] text-ink focus:outline-none focus:border-gold/40 cursor-pointer"
            >
              <option value="listing_count">Most Listings</option>
              <option value="name">Name A-Z</option>
              <option value="country">Region</option>
            </select>
          </div>

          {/* Region */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40 mb-2">Region</p>
            <div className="flex border border-border divide-x divide-border">
              {([
                { value: undefined, label: 'All' },
                { value: 'japan', label: 'Japan' },
                { value: 'international', label: "Int'l" },
              ] as const).map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    handleFilterChange('region', opt.value);
                    setFilterDrawerOpen(false);
                  }}
                  className={`flex-1 px-4 py-2.5 min-h-[44px] text-[12px] uppercase tracking-[0.12em] transition-colors ${
                    filters.region === opt.value
                      ? 'bg-gold/10 text-gold font-medium'
                      : 'text-ink/50 hover:text-ink hover:bg-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inventory Type */}
          {typeFacets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40">Inventory Type</p>
                {(filters.types?.length || 0) > 0 && (
                  <button
                    onClick={() => applyFilters({ ...filtersRef.current, types: undefined })}
                    className="text-[14px] text-gold hover:text-gold-light transition-colors font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-0">
                {typeFacets.map((item) => {
                  const checked = filters.types?.includes(item.value) || false;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleArrayFilter('types', item.value)}
                      className="flex items-center cursor-pointer group gap-3 py-2.5 min-h-[48px] w-full text-left"
                    >
                      <div
                        className={`w-5 h-5 rounded-[3px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                          checked
                            ? 'border-gold bg-gold'
                            : 'border-charcoal/30 group-hover:border-charcoal/50'
                        }`}
                      >
                        {checked && (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[15px] text-charcoal group-hover:text-ink transition-colors flex-1 leading-tight">
                        {item.label}
                      </span>
                      <span className="text-[13px] text-muted/70 tabular-nums flex-shrink-0">
                        {item.dealerCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Designation */}
          {certFacets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40">Designation</p>
                {(filters.certs?.length || 0) > 0 && (
                  <button
                    onClick={() => applyFilters({ ...filtersRef.current, certs: undefined })}
                    className="text-[14px] text-gold hover:text-gold-light transition-colors font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-0">
                {certFacets.map((item) => {
                  const checked = filters.certs?.includes(item.value) || false;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleArrayFilter('certs', item.value)}
                      className="flex items-center cursor-pointer group gap-3 py-2.5 min-h-[48px] w-full text-left"
                    >
                      <div
                        className={`w-5 h-5 rounded-[3px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                          checked
                            ? 'border-gold bg-gold'
                            : 'border-charcoal/30 group-hover:border-charcoal/50'
                        }`}
                      >
                        {checked && (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[15px] text-charcoal group-hover:text-ink transition-colors flex-1 leading-tight">
                        {item.label}
                      </span>
                      <span className="text-[13px] text-muted/70 tabular-nums flex-shrink-0">
                        {item.dealerCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
    <div className="bg-cream border border-border rounded-lg overflow-hidden shadow-sm">
      {/* Proportion bar placeholder */}
      <div className="h-1 img-loading" />
      <div className="p-5 space-y-3">
        {/* Name + flag */}
        <div className="flex items-start justify-between">
          <div className="h-5 w-32 img-loading rounded" />
          <div className="h-5 w-5 img-loading rounded-full" />
        </div>
        {/* Domain */}
        <div className="h-3 w-24 img-loading rounded" />
        {/* Type badges */}
        <div className="flex gap-2">
          <div className="h-5 w-16 img-loading rounded" />
          <div className="h-5 w-14 img-loading rounded" />
          <div className="h-5 w-12 img-loading rounded" />
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="h-3 w-20 img-loading rounded" />
          <div className="h-3 w-24 img-loading rounded" />
        </div>
      </div>
    </div>
  );
}

function FilterSection({
  title,
  activeCount,
  onReset,
  defaultOpen = false,
  children,
}: {
  title: string;
  activeCount: number;
  onReset: () => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="py-1 border-t border-border/15">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full text-left group py-0.5 ${open ? 'mb-1' : 'mb-0'} px-4`}
      >
        <div className="flex items-center gap-1.5">
          <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted">
            {title}
          </h3>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold text-white bg-gold rounded-full leading-none">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {activeCount > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="text-[10px] text-muted/50 hover:text-gold transition-colors cursor-pointer font-medium"
            >
              Reset
            </span>
          )}
          <svg
            className={`w-2.5 h-2.5 text-muted/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div
        className="transition-all duration-200 overflow-hidden"
        style={{ maxHeight: open ? '4000px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
}

function CheckboxList({
  items,
  selected,
  onToggle,
  limit = 8,
}: {
  items: FacetItem[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const hasMore = items.length > limit;

  return (
    <div className="space-y-0">
      {visible.map((item) => {
        const checked = selected.includes(item.value);
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onToggle(item.value)}
            className="flex items-center cursor-pointer group gap-2.5 py-[4px] min-h-[28px] rounded -mx-1 px-1 hover:bg-hover/30 w-full text-left"
          >
            <div
              className={`w-[15px] h-[15px] rounded-[2px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                checked
                  ? 'border-gold bg-gold'
                  : 'border-border/60 group-hover:border-border'
              }`}
              style={checked ? { boxShadow: '0 0 6px rgba(184, 157, 105, 0.2)' } : undefined}
            >
              {checked && (
                <svg className="w-[15px] h-[15px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-[12px] text-charcoal group-hover:text-ink transition-colors flex-1 leading-tight truncate">
              {item.label}
            </span>
            <span className="text-[10px] text-muted/70 tabular-nums flex-shrink-0">
              {item.dealerCount}
            </span>
          </button>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-gold/70 hover:text-gold transition-colors mt-1 ml-0"
        >
          {expanded ? 'Show less' : `+${items.length - limit} more`}
        </button>
      )}
    </div>
  );
}

function DealerCard({ dealer }: { dealer: DealerEntry }) {
  const flag = getCountryFlag(dealer.country);
  const topTypes = dealer.type_breakdown.slice(0, 3);
  const totalTyped = topTypes.reduce((s, t) => s + t.count, 0);

  return (
    <Link
      href={`/dealers/${dealer.slug}`}
      className="card-hover group block bg-cream border border-border rounded-lg overflow-hidden shadow-sm hover:border-gold/40"
    >
      {/* Type proportion bar — visual density indicator */}
      {topTypes.length > 0 && (
        <div className="flex h-1">
          {topTypes.map((t) => (
            <div
              key={t.type}
              className="bg-gold/25 first:bg-gold/50"
              style={{ width: `${(t.count / dealer.listing_count) * 100}%` }}
            />
          ))}
        </div>
      )}

      <div className="p-5">
        {/* Name + Flag */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-serif text-[15px] text-ink group-hover:text-gold transition-colors truncate">
            {dealer.name}
          </h3>
          <span className="text-lg flex-shrink-0" title={dealer.country}>{flag}</span>
        </div>

        {/* Domain */}
        <p className="text-[11px] text-muted truncate mb-3">
          {dealer.domain}
        </p>

        {/* Type breakdown badges */}
        {topTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {topTypes.map((t) => (
              <span
                key={t.type}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-hover border border-border/50 text-ink/60 rounded"
              >
                {t.label} <span className="text-ink/40 tabular-nums">{t.count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <span className="text-[12px] text-muted tabular-nums">
            {dealer.listing_count.toLocaleString()} listing{dealer.listing_count !== 1 ? 's' : ''}
          </span>
          <span className="text-[11px] text-gold group-hover:underline underline-offset-2">
            View inventory
          </span>
        </div>
      </div>
    </Link>
  );
}
