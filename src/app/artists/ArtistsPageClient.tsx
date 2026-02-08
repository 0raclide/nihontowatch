'use client';

import { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [artists, setArtists] = useState(initialArtists);
  const [pagination, setPagination] = useState(initialPagination);
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(initialFilters.q || '');

  const facets = initialFacets;

  // Build URL params from filters
  const buildParams = useCallback((f: Filters, page: number) => {
    const p = new URLSearchParams();
    if (f.type !== 'all') p.set('type', f.type);
    if (f.school) p.set('school', f.school);
    if (f.province) p.set('province', f.province);
    if (f.era) p.set('era', f.era);
    if (f.q) p.set('q', f.q);
    if (f.sort !== 'elite_factor') p.set('sort', f.sort);
    if (page > 1) p.set('page', page.toString());
    if (!f.notable) p.set('notable', 'false');
    return p;
  }, []);

  // Navigate with updated params (SSR handles fresh data)
  const navigate = useCallback((f: Filters, page: number) => {
    const p = buildParams(f, page);
    const qs = p.toString();
    startTransition(() => {
      router.push(`/artists${qs ? `?${qs}` : ''}`, { scroll: false });
    });
  }, [buildParams, router]);

  // Also fetch client-side for instant feel
  const fetchArtists = useCallback(async (f: Filters, page: number) => {
    setIsLoading(true);
    const p = buildParams(f, page);
    p.set('limit', '50');
    if (page <= 1) p.delete('page');
    p.set('page', page.toString());

    try {
      const res = await fetch(`/api/artists/directory?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setArtists(data.artists);
        setPagination(data.pagination);
      }
    } catch {
      // Fall back to SSR navigation
    } finally {
      setIsLoading(false);
    }
  }, [buildParams]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    // Reset to page 1 on filter change
    setFilters(newFilters);
    navigate(newFilters, 1);
    fetchArtists(newFilters, 1);
  }, [filters, navigate, fetchArtists]);

  const handlePageChange = useCallback((page: number) => {
    navigate(filters, page);
    fetchArtists(filters, page);
    // Scroll to top of results
    document.getElementById('artist-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [filters, navigate, fetchArtists]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    const newFilters = { ...filters, q: trimmed || undefined };
    setFilters(newFilters);
    navigate(newFilters, 1);
    fetchArtists(newFilters, 1);
  }, [searchInput, filters, navigate, fetchArtists]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    const newFilters = { ...filters, q: undefined };
    setFilters(newFilters);
    navigate(newFilters, 1);
    fetchArtists(newFilters, 1);
  }, [filters, navigate, fetchArtists]);

  const loading = isLoading || isPending;

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 lg:px-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl lg:text-3xl text-ink tracking-tight">
          Artist Directory
        </h1>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Browse {facets.totals.smiths.toLocaleString()} swordsmiths and {facets.totals.tosogu.toLocaleString()} tosogu makers
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
                onChange={(e) => setSearchInput(e.target.value)}
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
                className={`px-4 py-2 text-[11px] uppercase tracking-[0.15em] transition-colors ${
                  filters.type === t
                    ? 'bg-gold/10 text-gold font-medium'
                    : 'text-muted hover:text-ink hover:bg-hover'
                }`}
              >
                {t === 'all' ? 'All' : t === 'smith' ? 'Smiths' : 'Tosogu'}
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
                const cleared: Filters = { type: filters.type, sort: filters.sort, notable: filters.notable };
                setFilters(cleared);
                setSearchInput('');
                navigate(cleared, 1);
                fetchArtists(cleared, 1);
              }}
              className="text-[11px] text-gold hover:text-gold-light underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div id="artist-grid" className={`mt-8 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
        {artists.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted text-sm">No artisans found matching your criteria.</p>
            <button
              onClick={() => {
                const cleared: Filters = { type: 'all', sort: 'elite_factor', notable: true };
                setFilters(cleared);
                setSearchInput('');
                navigate(cleared, 1);
                fetchArtists(cleared, 1);
              }}
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
    { label: 'Results', value: pagination.totalCount.toLocaleString() },
    ...(filters.type === 'all'
      ? [
          { label: 'Smiths', value: facets.totals.smiths.toLocaleString() },
          { label: 'Tosogu', value: facets.totals.tosogu.toLocaleString() },
        ]
      : []),
    { label: 'Schools', value: facets.schools.length.toLocaleString() },
    { label: 'Provinces', value: facets.provinces.length.toLocaleString() },
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

function ArtistCard({ artist }: { artist: ArtistWithSlug }) {
  const elitePct = artist.elite_factor > 0 ? Math.min(artist.elite_factor * 100, 100) : 0;

  return (
    <Link
      href={`/artists/${artist.slug}`}
      className="group block p-4 bg-cream border border-border hover:border-gold/40 transition-colors"
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
        <span className={`shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${
          artist.entity_type === 'smith'
            ? 'text-muted/60 border-border'
            : 'text-amber-600/60 border-amber-600/20'
        }`}>
          {artist.entity_type === 'smith' ? 'Smith' : 'Tosogu'}
        </span>
      </div>

      {/* Row 2: School / Era / Province */}
      <div className="mt-1.5 text-[11px] text-muted/70 truncate">
        {[artist.school, artist.era, artist.province].filter(Boolean).join(' \u00b7 ') || 'Unknown'}
      </div>

      {/* Row 3: Cert counts */}
      <div className="mt-2.5 flex items-center gap-3 text-[11px] tabular-nums">
        {artist.tokuju_count > 0 && (
          <span className="text-gold font-medium">{artist.tokuju_count} Tokuju</span>
        )}
        {artist.juyo_count > 0 && (
          <span className="text-ink">{artist.juyo_count} Juyo</span>
        )}
        <span className="text-muted/50">{artist.total_items} total</span>
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
    </Link>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
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
    <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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
