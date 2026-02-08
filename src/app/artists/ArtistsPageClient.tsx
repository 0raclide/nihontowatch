'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ArtistDirectoryEntry, DirectoryFacets } from '@/lib/supabase/yuhinkai';

// =============================================================================
// TYPES
// =============================================================================

interface ArtistWithSlug extends ArtistDirectoryEntry {
  slug: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

interface Filters {
  type: 'smith' | 'tosogu' | 'all';
  school?: string;
  province?: string;
  era?: string;
  q?: string;
  sort: 'elite_factor' | 'juyo_count' | 'name' | 'total_items';
  notable: boolean;
}

interface ArtistsPageClientProps {
  initialArtists: ArtistWithSlug[];
  initialPagination: Pagination;
  initialFacets: DirectoryFacets;
  initialFilters: Filters;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ArtistsPageClient({
  initialArtists,
  initialPagination,
  initialFacets,
  initialFilters,
}: ArtistsPageClientProps) {
  const [artists, setArtists] = useState(initialArtists);
  const [pagination, setPagination] = useState(initialPagination);
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialFilters.q || '');
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const facets = initialFacets;

  // Build URL search string from filters
  const buildQueryString = useCallback((f: Filters, page: number) => {
    const p = new URLSearchParams();
    if (f.type !== 'all') p.set('type', f.type);
    if (f.school) p.set('school', f.school);
    if (f.province) p.set('province', f.province);
    if (f.era) p.set('era', f.era);
    if (f.q) p.set('q', f.q);
    if (f.sort !== 'elite_factor') p.set('sort', f.sort);
    if (page > 1) p.set('page', page.toString());
    if (!f.notable) p.set('notable', 'false');
    return p.toString();
  }, []);

  // Update URL without navigation (keeps it shareable)
  const updateUrl = useCallback((f: Filters, page: number) => {
    const qs = buildQueryString(f, page);
    const url = `/artists${qs ? `?${qs}` : ''}`;
    window.history.replaceState(null, '', url);
  }, [buildQueryString]);

  // Client-side fetch — the only data-fetching path for filter interactions
  const fetchArtists = useCallback(async (f: Filters, page: number) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const p = new URLSearchParams();
    if (f.type !== 'all') p.set('type', f.type);
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
        setArtists(data.artists);
        setPagination(data.pagination);
      } else {
        setError('Failed to load artists. Please try again.');
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

  // Cleanup abort and debounce on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const applyFilters = useCallback((newFilters: Filters, page: number) => {
    setFilters(newFilters);
    updateUrl(newFilters, page);
    fetchArtists(newFilters, page);
  }, [updateUrl, fetchArtists]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    applyFilters(newFilters, 1);
  }, [filters, applyFilters]);

  const handlePageChange = useCallback((page: number) => {
    applyFilters(filters, page);
    document.getElementById('artist-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [filters, applyFilters]);

  // Debounced search — fires 300ms after user stops typing
  const debouncedSearch = useCallback((value: string, currentFilters: Filters) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      applyFilters({ ...currentFilters, q: trimmed || undefined }, 1);
    }, 300);
  }, [applyFilters]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    debouncedSearch(value, filters);
  }, [filters, debouncedSearch]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Immediate search on Enter — cancel any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = searchInput.trim();
    applyFilters({ ...filters, q: trimmed || undefined }, 1);
  }, [searchInput, filters, applyFilters]);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    applyFilters({ ...filters, q: undefined }, 1);
  }, [filters, applyFilters]);

  const clearAllFilters = useCallback(() => {
    setSearchInput('');
    applyFilters({ type: 'all', sort: 'elite_factor', notable: true }, 1);
  }, [applyFilters]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 lg:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl lg:text-3xl text-ink tracking-tight">
          Artist Directory
        </h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          {facets.totals.smiths.toLocaleString()} nihonto and {facets.totals.tosogu.toLocaleString()} tosogu artists
          from the Yuhinkai database, ranked by certified works.
        </p>
      </div>

      {/* Stats Bar */}
      <StatsBar facets={facets} pagination={pagination} filters={filters} />

      {/* Filters */}
      <div className="mt-6 space-y-4">
        {/* Search + Type Toggle Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search by name, kanji, or code..."
                className="w-full pl-4 pr-10 py-2 bg-cream border border-border text-[13px] text-ink placeholder:text-muted/40 focus:outline-none focus:border-gold/40 focus:shadow-[0_0_0_3px_rgba(181,142,78,0.1)] transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-muted/40 hover:text-muted"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-muted/50 hover:text-gold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Type Toggle */}
          <div className="flex border border-border divide-x divide-border">
            {(['all', 'smith', 'tosogu'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleFilterChange('type', t)}
                disabled={isLoading}
                className={`px-4 py-2 text-[11px] uppercase tracking-[0.15em] transition-colors ${
                  filters.type === t
                    ? 'bg-gold/10 text-gold font-medium'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                {t === 'all' ? 'All' : t === 'smith' ? 'Nihonto' : 'Tosogu'}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap gap-3 items-center">
          <FilterSelect
            label="School"
            value={filters.school || ''}
            options={facets.schools}
            onChange={(v) => handleFilterChange('school', v || '')}
          />
          <FilterSelect
            label="Province"
            value={filters.province || ''}
            options={facets.provinces}
            onChange={(v) => handleFilterChange('province', v || '')}
          />
          <FilterSelect
            label="Era"
            value={filters.era || ''}
            options={facets.eras}
            onChange={(v) => handleFilterChange('era', v || '')}
          />

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Sort */}
          <select
            value={filters.sort}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
            className="px-3 py-2 bg-cream border border-border text-[12px] text-muted focus:outline-none focus:border-gold/40 cursor-pointer"
          >
            <option value="elite_factor">Sort: Elite Factor</option>
            <option value="juyo_count">Sort: Juyo Count</option>
            <option value="total_items">Sort: Total Works</option>
            <option value="name">Sort: Name A-Z</option>
          </select>

          {/* Notable Toggle */}
          <label className="flex items-center gap-2 text-[12px] text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.notable}
              onChange={(e) => handleFilterChange('notable', e.target.checked)}
              className="accent-gold"
            />
            Notable only
          </label>

          {/* Active filter pills */}
          {(filters.school || filters.province || filters.era || filters.q) && (
            <button
              onClick={() => {
                setSearchInput('');
                applyFilters({ type: filters.type, sort: filters.sort, notable: filters.notable }, 1);
              }}
              className="text-[11px] text-gold hover:text-gold-light underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div id="artist-grid" className="mt-8">
        {/* Error state */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 flex items-center justify-between">
            <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => fetchArtists(filters, pagination.page)}
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
        ) : artists.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted text-sm">No artisans found matching your criteria.</p>
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
              {artists.map((artist) => (
                <ArtistCard key={artist.code} artist={artist} />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <PaginationBar
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                onPageChange={handlePageChange}
                disabled={isLoading}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatsBar({
  facets,
  pagination,
  filters,
}: {
  facets: DirectoryFacets;
  pagination: Pagination;
  filters: Filters;
}) {
  const items = [
    { label: 'Artists', value: pagination.totalCount.toLocaleString() },
    ...(filters.type === 'all'
      ? [
          { label: 'Nihonto', value: facets.totals.smiths.toLocaleString() },
          { label: 'Tosogu', value: facets.totals.tosogu.toLocaleString() },
        ]
      : []),
  ];

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 py-3 px-4 bg-cream/50 border border-border">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <span className="text-sm font-serif tabular-nums text-ink">{item.value}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted/60">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 bg-cream border border-border text-[12px] text-muted focus:outline-none focus:border-gold/40 cursor-pointer"
    >
      <option value="">All {label}s</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.value} ({opt.count})
        </option>
      ))}
    </select>
  );
}

function SkeletonCard() {
  return (
    <div className="p-4 bg-cream border border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-32 img-loading rounded" />
          <div className="h-3 w-16 img-loading rounded" />
        </div>
        <div className="h-5 w-12 img-loading rounded" />
      </div>
      <div className="mt-2.5 h-3 w-40 img-loading rounded" />
      <div className="mt-3 flex gap-3">
        <div className="h-3 w-16 img-loading rounded" />
        <div className="h-3 w-14 img-loading rounded" />
      </div>
      <div className="mt-3 h-1.5 w-full img-loading rounded" />
    </div>
  );
}

function ArtistCard({ artist }: { artist: ArtistWithSlug }) {
  const router = useRouter();
  const elitePct = artist.elite_factor > 0 ? Math.min(artist.elite_factor * 100, 100) : 0;

  const profileUrl = `/artists/${artist.slug}`;
  const availableCount = artist.available_count ?? 0;

  // Build browse URL for "for sale" link — opens QuickView if we have a first listing ID
  const forSaleUrl = availableCount > 0
    ? `/browse?artisan=${encodeURIComponent(artist.code)}${artist.first_listing_id ? `&listing=${artist.first_listing_id}` : ''}`
    : undefined;

  // Designation shortcodes — ordered by prestige, only shown when > 0
  // Monochrome palette: hierarchy conveyed through weight, not color
  const certBadges: Array<{ label: string; value: number; className: string }> = [];
  if (artist.kokuho_count > 0) certBadges.push({ label: 'Kokuho', value: artist.kokuho_count, className: 'text-ink font-semibold' });
  if (artist.jubun_count > 0) certBadges.push({ label: 'Jubun', value: artist.jubun_count, className: 'text-ink font-semibold' });
  if (artist.jubi_count > 0) certBadges.push({ label: 'Jubi', value: artist.jubi_count, className: 'text-ink font-medium' });
  if (artist.gyobutsu_count > 0) certBadges.push({ label: 'Gyobutsu', value: artist.gyobutsu_count, className: 'text-ink font-medium' });
  if (artist.tokuju_count > 0) certBadges.push({ label: 'Tokuju', value: artist.tokuju_count, className: 'text-ink/80 font-medium' });
  if (artist.juyo_count > 0) certBadges.push({ label: 'Juyo', value: artist.juyo_count, className: 'text-ink/70' });

  return (
    <div
      onClick={() => router.push(profileUrl)}
      className="group cursor-pointer p-4 bg-cream border border-border hover:border-gold/40 transition-colors"
    >
      {/* Row 1: Name + Type */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-ink group-hover:text-gold transition-colors truncate block">
            {artist.name_romaji || artist.code}
          </span>
          {artist.name_kanji && (
            <span className="text-xs text-muted/60 ml-2">{artist.name_kanji}</span>
          )}
        </div>
        <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 border text-muted/60 border-border">
          {artist.entity_type === 'smith' ? 'Nihonto' : 'Tosogu'}
        </span>
      </div>

      {/* Row 2: School / Era / Province */}
      <div className="mt-1.5 text-[11px] text-muted/70 truncate">
        {[artist.school, artist.era, artist.province].filter(Boolean).join(' \u00b7 ') || 'Unknown'}
      </div>

      {/* Row 3: Cert counts + available */}
      <div className="mt-2.5 flex items-center gap-3 text-[11px] tabular-nums flex-wrap">
        {certBadges.map((badge) => (
          <span key={badge.label} className={badge.className}>
            {badge.value} {badge.label}
          </span>
        ))}
        <span className="text-muted/50">{artist.total_items} total</span>
        {availableCount > 0 && forSaleUrl && (
          <Link
            href={forSaleUrl}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
          >
            {availableCount} for sale
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        )}
      </div>

      {/* Row 4: Elite bar */}
      {elitePct > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-border/50 overflow-hidden">
            <div
              className="h-full bg-gold/60 transition-all"
              style={{ width: `${elitePct}%` }}
            />
          </div>
          <span className="text-[10px] text-muted/50 tabular-nums shrink-0">
            {Math.round(elitePct)}%
          </span>
        </div>
      )}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  // Generate page numbers with ellipsis
  const pages: (number | 'ellipsis')[] = [];
  const delta = 2;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <div className={`mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <p className="text-[11px] text-muted/60">
        Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, totalCount)} of {totalCount.toLocaleString()}
      </p>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 text-[11px] text-muted hover:text-ink hover:bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          Prev
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1 text-muted/40 text-[11px]">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] px-2 py-1.5 text-[11px] transition-colors ${
                p === page
                  ? 'bg-gold/10 text-gold font-medium border border-gold/30'
                  : 'text-muted hover:text-ink hover:bg-hover'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 text-[11px] text-muted hover:text-ink hover:bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
