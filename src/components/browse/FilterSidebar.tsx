'use client';

import { useCallback, useRef, useMemo } from 'react';
import { FilterContent, type FilterContentProps, type SidebarVariant, type CornerStyle, type SelectStyle } from './FilterContent';
import type { AvailabilityStatus } from '@/components/ui/AvailabilityToggle';
import { useLocale } from '@/i18n/LocaleContext';

type Currency = 'USD' | 'JPY' | 'EUR';

interface PanelControls {
  sort?: string;
  onSortChange?: (sort: string) => void;
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  availability: AvailabilityStatus;
  onAvailabilityChange: (status: AvailabilityStatus) => void;
  isAdmin?: boolean;
}

interface FilterSidebarProps {
  facets: FilterContentProps['facets'];
  filters: FilterContentProps['filters'];
  onFilterChange: FilterContentProps['onFilterChange'];
  isAdmin?: boolean;
  variant?: SidebarVariant;
  panelControls?: PanelControls;
  cornerStyle?: CornerStyle;
  selectStyle?: SelectStyle;
  priceHistogram?: FilterContentProps['priceHistogram'];
  exchangeRates?: FilterContentProps['exchangeRates'];
}

export function FilterSidebar({ facets, filters, onFilterChange, isAdmin, variant = 'default', panelControls, cornerStyle = 'soft', selectStyle = 'bold', priceHistogram, exchangeRates }: FilterSidebarProps) {
  const { t } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Prevent scroll events from propagating to the page when at scroll boundaries
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop === 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    // If scrolling up at the top, or scrolling down at the bottom, prevent propagation
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      e.preventDefault();
    }
  }, []);

  // Active filter count for variant B header badge
  // Category is a mode (not a filter), so it doesn't count. Price range does.
  const activeFilterCount = useMemo(() => {
    return (
      filters.itemTypes.length +
      filters.certifications.length +
      filters.dealers.length +
      (filters.historicalPeriods?.length || 0) +
      (filters.signatureStatuses?.length || 0) +
      ((filters as Record<string, unknown>).priceMin || (filters as Record<string, unknown>).priceMax ? 1 : 0) +
      (filters.askOnly ? 1 : 0) +
      (filters.missingSetsumei ? 1 : 0) +
      (filters.missingArtisanCode ? 1 : 0)
    );
  }, [filters]);

  const clearAllFilters = useCallback(() => {
    // Category is a mode — don't reset it
    onFilterChange('itemTypes', []);
    onFilterChange('certifications', []);
    onFilterChange('dealers', []);
    onFilterChange('schools', []);
    onFilterChange('historicalPeriods', []);
    onFilterChange('signatureStatuses', []);
    onFilterChange('priceMin', undefined);
    onFilterChange('priceMax', undefined);
    onFilterChange('askOnly', false);
    onFilterChange('missingSetsumei', false);
    onFilterChange('missingArtisanCode', false);
  }, [onFilterChange]);

  const hasPanelSort = panelControls?.sort !== undefined && panelControls?.onSortChange !== undefined;
  const hasPanelCurrency = panelControls?.currency !== undefined && panelControls?.onCurrencyChange !== undefined;

  // ── Variant B: Floating Panel ───────────────────────────────────────
  if (variant === 'b') {
    const hasViewControls = panelControls !== undefined;

    // Corner radius tokens based on style
    const cardRadius = cornerStyle === 'sharp' ? 'rounded-none' : cornerStyle === 'subtle' ? 'rounded' : 'rounded-2xl';
    const controlRadius = cornerStyle === 'sharp' ? 'rounded-none' : cornerStyle === 'subtle' ? 'rounded-sm' : 'rounded-lg';
    const fadeRadius = cornerStyle === 'sharp' ? '' : cornerStyle === 'subtle' ? 'rounded-b' : 'rounded-b-2xl';
    const currencyRadius = cornerStyle === 'sharp' ? 'rounded-none' : cornerStyle === 'subtle' ? 'rounded-sm' : 'rounded';

    return (
      <aside className="hidden lg:block w-[264px] flex-shrink-0">
        <div className="sticky top-24">
          <div
            className={`bg-surface-elevated ${cardRadius} border border-border/40 flex flex-col max-h-[calc(100vh-7rem)]`}
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}
          >
            {/* ── Zone 1: Category + Availability (pinned) ── */}
            {hasViewControls && (
              <div className="flex-shrink-0 px-4 pt-3.5 pb-3 border-b border-border/15">
                {/* Category — 2-segment: Nihonto | Tosogu */}
                <div className="mb-2.5">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted/50 font-medium block mb-1.5">{t('filter.category')}</span>
                  <div className={`flex ${controlRadius} border border-border/30 overflow-hidden`}>
                    {([
                      { key: 'nihonto' as const, label: t('category.nihonto') },
                      { key: 'tosogu' as const, label: t('category.tosogu') },
                    ]).map(({ key, label }, i) => (
                      <button
                        key={key}
                        onClick={() => {
                          onFilterChange('category', key);
                          onFilterChange('itemTypes', []);
                        }}
                        className={`flex-1 py-[9px] text-[12px] font-semibold tracking-[0.02em] transition-colors ${
                          i > 0 ? 'border-l border-border/20' : ''
                        } ${
                          filters.category === key
                            ? 'bg-gold/15 text-gold'
                            : 'text-muted hover:text-ink hover:bg-hover/30'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability — full-width segmented control */}
                <div className={`flex ${controlRadius} border border-border/30 overflow-hidden`}>
                  {([
                    { key: 'available' as const, label: t('availability.forSale') },
                    { key: 'sold' as const, label: t('availability.sold') },
                    { key: 'all' as const, label: t('availability.all') },
                  ]).map(({ key, label }, i) => (
                    <button
                      key={key}
                      onClick={() => panelControls!.onAvailabilityChange(key)}
                      className={`flex-1 py-[7px] text-[11px] font-semibold tracking-[0.03em] transition-colors ${
                        i > 0 ? 'border-l border-border/20' : ''
                      } ${
                        panelControls!.availability === key
                          ? selectStyle === 'bold'
                            ? 'bg-gold text-white'
                            : selectStyle === 'tint'
                              ? 'bg-gold/12 text-gold'
                              : 'border border-gold/50 text-gold -m-px'
                          : 'text-muted hover:text-ink hover:bg-hover/30'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Zone 2: Filter header (pinned) — very light divider ── */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-border/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[10px] uppercase tracking-[0.1em] font-medium text-muted/50">{t('filter.filters')}</h2>
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
                    {t('filter.reset')}
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
              <div className="px-4 pb-4 pt-0.5">
                <FilterContent
                  facets={facets}
                  filters={filters}
                  onFilterChange={onFilterChange}
                  isAdmin={isAdmin}
                  variant="b"
                  cornerStyle={cornerStyle}
                  selectStyle={selectStyle}
                  priceHistogram={priceHistogram}
                  exchangeRates={exchangeRates}
                  currency={panelControls?.currency}
                />
                {/* Currency — quiet preference */}
                {hasPanelCurrency && (
                  <div className="pt-2 border-t border-border/10">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-muted/50 font-medium">{t('filter.currency')}</span>
                      <div className={`flex ${currencyRadius} border border-border/20 overflow-hidden`}>
                        {(['USD', 'JPY', 'EUR'] as const).map((c, i) => (
                          <button
                            key={c}
                            onClick={() => panelControls!.onCurrencyChange!(c)}
                            className={`px-2 py-[3px] text-[9px] font-semibold tracking-wider transition-colors ${
                              i > 0 ? 'border-l border-border/15' : ''
                            } ${
                              panelControls!.currency === c
                                ? selectStyle === 'bold'
                                  ? 'bg-gold/90 text-white'
                                  : selectStyle === 'tint'
                                    ? 'bg-gold/12 text-gold'
                                    : 'border border-gold/50 text-gold -m-px'
                                : 'text-muted/60 hover:text-ink hover:bg-hover/20'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom fade */}
            <div className={`pointer-events-none h-6 bg-gradient-to-t from-surface-elevated to-transparent -mt-6 relative z-10 ${fadeRadius}`} />
          </div>
        </div>
      </aside>
    );
  }

  // ── Default (original) ─────────────────────────────────────────────
  return (
    <aside className="hidden lg:block w-60 flex-shrink-0">
      <div className="sticky top-20">
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pr-5"
        >
          <FilterContent
            facets={facets}
            filters={filters}
            onFilterChange={onFilterChange}
            isAdmin={isAdmin}
            priceHistogram={priceHistogram}
            exchangeRates={exchangeRates}
          />
        </div>
      </div>
    </aside>
  );
}
