'use client';

import { useState, useCallback, useRef, useMemo, memo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface FacetOption {
  value: string;
  count: number;
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

interface ArtistFilterSidebarProps {
  filters: Filters;
  facets: {
    schools: FacetOption[];
    provinces: FacetOption[];
    eras: FacetOption[];
    totals: { smiths: number; tosogu: number };
  };
  onFilterChange: (key: keyof Filters, value: string | boolean) => void;
  onSearchInput: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onClearSearch: () => void;
  onClearAll: () => void;
  searchInput: string;
  isLoading: boolean;
}

// =============================================================================
// MAIN SIDEBAR
// =============================================================================

export function ArtistFilterSidebar({
  filters,
  facets,
  onFilterChange,
  onSearchInput,
  onSearchSubmit,
  onClearSearch,
  onClearAll,
  searchInput,
  isLoading,
}: ArtistFilterSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Prevent scroll events from propagating to the page when at scroll boundaries
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop === 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      e.preventDefault();
    }
  }, []);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    return [filters.school, filters.province, filters.era, filters.q].filter(Boolean).length
      + (filters.notable === false ? 1 : 0);
  }, [filters.school, filters.province, filters.era, filters.q, filters.notable]);

  return (
    <aside className="hidden lg:block w-[264px] flex-shrink-0">
      <div className="sticky top-24">
        <div
          className="bg-surface-elevated rounded-2xl border border-border/40 flex flex-col max-h-[calc(100vh-7rem)]"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}
        >
          {/* ── Zone 1: Sort + Type Toggle (pinned) ── */}
          <div className="flex-shrink-0 px-4 pt-3.5 pb-3 border-b border-border/15">
            {/* Sort — inline label + borderless select */}
            <div className="flex items-center justify-center gap-2 mb-2.5">
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted/60 font-medium">Sort</span>
              <select
                value={filters.sort}
                onChange={(e) => onFilterChange('sort', e.target.value)}
                disabled={isLoading}
                className="bg-transparent text-[11px] text-ink font-medium focus:outline-none cursor-pointer pr-4 appearance-none"
                style={{
                  border: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0 center',
                  backgroundSize: '11px',
                }}
              >
                <option value="elite_factor">Elite Standing</option>
                <option value="provenance_factor">Provenance Standing</option>
                <option value="total_items">Total Works</option>
                <option value="for_sale">On the Market</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>

            {/* Type Toggle — segmented control */}
            <div className="flex rounded-lg border border-border/30 overflow-hidden">
              {(['smith', 'tosogu'] as const).map((t, i) => (
                <button
                  key={t}
                  onClick={() => onFilterChange('type', t)}
                  disabled={isLoading}
                  className={`flex-1 py-[7px] text-[11px] font-semibold tracking-[0.03em] transition-colors ${
                    i > 0 ? 'border-l border-border/20' : ''
                  } ${
                    filters.type === t
                      ? 'bg-gold/12 text-gold'
                      : 'text-muted hover:text-ink hover:bg-hover/30'
                  }`}
                >
                  {t === 'smith' ? 'Nihonto' : 'Tosogu'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Zone 2: Filter header (pinned) ── */}
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
                  onClick={onClearAll}
                  className="text-[10px] text-muted/50 hover:text-gold transition-colors font-medium"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* ── Zone 3: Scrollable filters ── */}
          <div
            ref={scrollRef}
            onWheel={handleWheel}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
          >
            <div className="px-4 pb-4 pt-2">
              {/* Search */}
              <form onSubmit={onSearchSubmit} className="relative mb-3">
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => onSearchInput(e.target.value)}
                  placeholder="Name, kanji, or code..."
                  className="w-full pl-7 pr-7 py-1.5 text-[11px] rounded-md border border-border/30 bg-transparent text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </form>

              {/* School */}
              <CollapsibleSection
                title="School"
                defaultOpen
                activeCount={filters.school ? 1 : 0}
              >
                <RadioList
                  options={facets.schools}
                  selected={filters.school}
                  onSelect={(v) => onFilterChange('school', v)}
                />
              </CollapsibleSection>

              <div className="border-t border-border/15" />

              {/* Province */}
              <CollapsibleSection
                title="Province"
                defaultOpen={false}
                activeCount={filters.province ? 1 : 0}
              >
                <RadioList
                  options={facets.provinces}
                  selected={filters.province}
                  onSelect={(v) => onFilterChange('province', v)}
                />
              </CollapsibleSection>

              <div className="border-t border-border/15" />

              {/* Period */}
              <CollapsibleSection
                title="Period"
                defaultOpen={false}
                activeCount={filters.era ? 1 : 0}
              >
                <RadioList
                  options={facets.eras}
                  selected={filters.era}
                  onSelect={(v) => onFilterChange('era', v)}
                />
              </CollapsibleSection>

              <div className="border-t border-border/15" />

              {/* Notable only toggle */}
              <div className="py-2">
                <label className="flex items-center justify-between cursor-pointer group min-h-[28px]">
                  <span className="text-[12px] text-charcoal group-hover:text-ink transition-colors">
                    Notable only
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={filters.notable}
                      onChange={(e) => onFilterChange('notable', e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className={`w-8 h-[18px] rounded-full transition-colors ${filters.notable ? 'bg-gold' : 'bg-border-dark'}`}>
                      <div className={`absolute top-[3px] w-3 h-3 bg-white rounded-full shadow transition-transform ${filters.notable ? 'translate-x-[14px]' : 'translate-x-[3px]'}`} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Bottom fade */}
          <div className="pointer-events-none h-6 bg-gradient-to-t from-surface-elevated to-transparent -mt-6 relative z-10 rounded-b-2xl" />
        </div>
      </div>
    </aside>
  );
}

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

const CollapsibleSection = memo(function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  activeCount,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  activeCount?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="py-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full text-left group ${isOpen ? 'py-0.5 mb-1' : 'py-0.5 mb-0'}`}
      >
        <div className="flex items-center gap-1.5">
          <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted">
            {title}
          </h3>
          {activeCount !== undefined && activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold text-white bg-gold rounded-full leading-none">
              {activeCount}
            </span>
          )}
        </div>
        <svg
          className={`w-2.5 h-2.5 text-muted/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
});

// =============================================================================
// RADIO LIST (single-select, click again to deselect)
// =============================================================================

const RadioList = memo(function RadioList({
  options,
  selected,
  onSelect,
}: {
  options: FacetOption[];
  selected?: string;
  onSelect: (value: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-[11px] text-muted italic py-2">None available</p>;
  }

  return (
    <div className="space-y-0">
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(isSelected ? '' : opt.value)}
            className={`flex items-center w-full gap-2.5 py-[4px] min-h-[28px] rounded -mx-1 px-1 transition-colors ${
              isSelected ? 'bg-gold/8' : 'hover:bg-hover/30'
            }`}
          >
            {/* Radio indicator */}
            <div className={`w-[15px] h-[15px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
              isSelected
                ? 'border-gold'
                : 'border-border/60 group-hover:border-border'
            }`}>
              {isSelected && (
                <div className="w-[7px] h-[7px] rounded-full bg-gold" />
              )}
            </div>
            <span className={`text-[12px] flex-1 text-left leading-tight transition-colors ${
              isSelected ? 'text-ink font-medium' : 'text-charcoal'
            }`}>
              {opt.value}
            </span>
            <span className="text-[10px] text-muted/70 tabular-nums flex-shrink-0">
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
});
