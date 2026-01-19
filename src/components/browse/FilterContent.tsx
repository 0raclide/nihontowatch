'use client';

import { useState, useCallback, useMemo } from 'react';

interface Facet {
  value: string;
  count: number;
}

interface DealerFacet {
  id: number;
  name: string;
  count: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

export interface FilterContentProps {
  facets: {
    itemTypes: Facet[];
    certifications: Facet[];
    dealers: DealerFacet[];
    historicalPeriods: Facet[];
    signatureStatuses: Facet[];
  };
  filters: {
    category: 'all' | 'nihonto' | 'tosogu';
    itemTypes: string[];
    certifications: string[];
    schools: string[];
    dealers: number[];
    historicalPeriods: string[];
    signatureStatuses: string[];
    askOnly?: boolean;
  };
  onFilterChange: (key: string, value: unknown) => void;
  onClose?: () => void;
  isUpdating?: boolean;
  // Sort and currency for mobile drawer
  sort?: string;
  onSortChange?: (sort: string) => void;
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
}

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="py-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group mb-4 py-1"
      >
        <h3 className="text-[13px] uppercase tracking-[0.15em] font-semibold text-ink">
          {title}
        </h3>
        <svg
          className={`w-4 h-4 text-charcoal transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
}

function Checkbox({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group py-2.5 min-h-[48px] lg:min-h-[40px]">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className="w-5 h-5 lg:w-[18px] lg:h-[18px] border-2 border-charcoal/40 peer-checked:border-gold peer-checked:bg-gold transition-colors rounded">
          {checked && (
            <svg className="w-5 h-5 lg:w-[18px] lg:h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-[15px] lg:text-[14px] text-charcoal group-hover:text-ink transition-colors flex-1">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[13px] lg:text-[12px] text-muted tabular-nums">{count}</span>
      )}
    </label>
  );
}

// Nihonto (swords/blades)
const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi', 'ken', 'naginata naoshi', 'sword'];

// Tosogu (fittings) - comprehensive list including all variants
const TOSOGU_TYPES = [
  'tsuba',
  'fuchi-kashira', 'fuchi_kashira',
  'fuchi', 'kashira',
  'kozuka', 'kogatana',
  'kogai',
  'menuki',
  'koshirae',
  'tosogu',
  'mitokoromono',
];

// Normalize Japanese/variant item types to standard English
const ITEM_TYPE_NORMALIZE: Record<string, string> = {
  '甲冑': 'armor',
  '兜': 'kabuto',
  '刀': 'katana',
  '脇差': 'wakizashi',
  '短刀': 'tanto',
  '太刀': 'tachi',
  '槍': 'yari',
  '薙刀': 'naginata',
  '鍔': 'tsuba',
  '小柄': 'kozuka',
  '目貫': 'menuki',
  'Tachi': 'tachi',
  'Katana': 'katana',
  'Wakizashi': 'wakizashi',
  'Tanto': 'tanto',
  'fuchi_kashira': 'fuchi-kashira',
  'tanegashima': 'other',
  'books': 'other',
};

// Display labels
const ITEM_TYPE_LABELS: Record<string, string> = {
  // Nihonto
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tantō',
  tachi: 'Tachi',
  naginata: 'Naginata',
  'naginata naoshi': 'Naginata Naoshi',
  yari: 'Yari',
  kodachi: 'Kodachi',
  ken: 'Ken',
  sword: 'Sword',
  // Tosogu
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  'fuchi_kashira': 'Fuchi-Kashira',
  fuchi: 'Fuchi',
  kashira: 'Kashira',
  kozuka: 'Kozuka',
  kogatana: 'Kogatana',
  kogai: 'Kōgai',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
  tosogu: 'Tosogu',
  mitokoromono: 'Mitokoromono',
  // Other
  armor: 'Armor',
  kabuto: 'Kabuto',
  other: 'Other',
};

const CERT_LABELS: Record<string, string> = {
  Juyo: 'Jūyō',
  juyo: 'Jūyō',
  Tokuju: 'Tokubetsu Jūyō',
  tokuju: 'Tokubetsu Jūyō',
  Hozon: 'Hozon',
  hozon: 'Hozon',
  TokuHozon: 'Tokubetsu Hozon',
  tokubetsu_hozon: 'Tokubetsu Hozon',
  TokuKicho: 'Tokubetsu Kichō',
  nbthk: 'NBTHK',
  nthk: 'NTHK',
};

// Sort order for certifications (highest to lowest)
const CERT_ORDER = ['Tokuju', 'tokuju', 'Juyo', 'juyo', 'TokuHozon', 'tokubetsu_hozon', 'Hozon', 'hozon', 'TokuKicho', 'nbthk', 'nthk'];

// Signature status labels
const SIGNATURE_LABELS: Record<string, string> = {
  signed: 'Signed',
  unsigned: 'Mumei',
};

// Historical period labels (all are display-ready as-is)
const PERIOD_LABELS: Record<string, string> = {
  Heian: 'Heian',
  Kamakura: 'Kamakura',
  Nanbokucho: 'Nanbokuchō',
  Muromachi: 'Muromachi',
  Momoyama: 'Momoyama',
  Edo: 'Edo',
  Meiji: 'Meiji',
  Taisho: 'Taishō',
  Showa: 'Shōwa',
  Heisei: 'Heisei',
  Reiwa: 'Reiwa',
};

export function FilterContent({
  facets,
  filters,
  onFilterChange,
  onClose,
  isUpdating,
  sort,
  onSortChange,
  currency,
  onCurrencyChange,
}: FilterContentProps) {
  // Normalize and aggregate item types
  const normalizedItemTypes = useMemo(() => {
    const aggregated: Record<string, number> = {};

    facets.itemTypes.forEach((facet) => {
      const normalized = ITEM_TYPE_NORMALIZE[facet.value] || facet.value.toLowerCase();
      aggregated[normalized] = (aggregated[normalized] || 0) + facet.count;
    });

    return Object.entries(aggregated)
      .map(([value, count]) => ({ value, count }))
      .filter(f => f.value !== 'null' && f.count > 0);
  }, [facets.itemTypes]);

  // Split into nihonto and tosogu
  const nihontoTypes = useMemo(() =>
    normalizedItemTypes
      .filter(f => NIHONTO_TYPES.includes(f.value))
      .sort((a, b) => b.count - a.count),
    [normalizedItemTypes]
  );

  const tosoguTypes = useMemo(() =>
    normalizedItemTypes
      .filter(f => TOSOGU_TYPES.includes(f.value))
      .sort((a, b) => b.count - a.count),
    [normalizedItemTypes]
  );

  const otherTypes = useMemo(() =>
    normalizedItemTypes
      .filter(f => !NIHONTO_TYPES.includes(f.value) && !TOSOGU_TYPES.includes(f.value))
      .sort((a, b) => b.count - a.count),
    [normalizedItemTypes]
  );

  // Filter item types based on category selection
  const visibleItemTypes = useMemo(() => {
    if (filters.category === 'nihonto') return nihontoTypes;
    if (filters.category === 'tosogu') return tosoguTypes;
    return [...nihontoTypes, ...tosoguTypes, ...otherTypes];
  }, [filters.category, nihontoTypes, tosoguTypes, otherTypes]);

  // Sort certifications by rank
  const sortedCertifications = useMemo(() => {
    return [...facets.certifications]
      .filter(f => f.value !== 'null' && CERT_LABELS[f.value])
      .sort((a, b) => {
        const aIndex = CERT_ORDER.indexOf(a.value);
        const bIndex = CERT_ORDER.indexOf(b.value);
        if (aIndex === -1 && bIndex === -1) return b.count - a.count;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [facets.certifications]);

  // Calculate totals for category tabs
  const nihontoTotal = useMemo(() =>
    nihontoTypes.reduce((sum, t) => sum + t.count, 0),
    [nihontoTypes]
  );

  const tosoguTotal = useMemo(() =>
    tosoguTypes.reduce((sum, t) => sum + t.count, 0),
    [tosoguTypes]
  );

  const handleCategoryChange = useCallback((category: 'all' | 'nihonto' | 'tosogu') => {
    onFilterChange('category', category);
    onFilterChange('itemTypes', []);
  }, [onFilterChange]);

  const handleItemTypeChange = useCallback(
    (type: string, checked: boolean) => {
      const current = filters.itemTypes;
      const updated = checked
        ? [...current, type]
        : current.filter((t) => t !== type);
      onFilterChange('itemTypes', updated);
    },
    [filters.itemTypes, onFilterChange]
  );

  const handleCertChange = useCallback(
    (cert: string, checked: boolean) => {
      const current = filters.certifications;
      const updated = checked
        ? [...current, cert]
        : current.filter((c) => c !== cert);
      onFilterChange('certifications', updated);
    },
    [filters.certifications, onFilterChange]
  );

  const handleDealerChange = useCallback(
    (dealerId: number, checked: boolean) => {
      const current = filters.dealers;
      const updated = checked
        ? [...current, dealerId]
        : current.filter((d) => d !== dealerId);
      onFilterChange('dealers', updated);
    },
    [filters.dealers, onFilterChange]
  );

  const handlePeriodChange = useCallback(
    (period: string, checked: boolean) => {
      const current = filters.historicalPeriods;
      const updated = checked
        ? [...current, period]
        : current.filter((p) => p !== period);
      onFilterChange('historicalPeriods', updated);
    },
    [filters.historicalPeriods, onFilterChange]
  );

  const handleSignatureChange = useCallback(
    (status: string, checked: boolean) => {
      const current = filters.signatureStatuses;
      const updated = checked
        ? [...current, status]
        : current.filter((s) => s !== status);
      onFilterChange('signatureStatuses', updated);
    },
    [filters.signatureStatuses, onFilterChange]
  );

  const clearAllFilters = useCallback(() => {
    onFilterChange('category', 'all');
    onFilterChange('itemTypes', []);
    onFilterChange('certifications', []);
    onFilterChange('dealers', []);
    onFilterChange('schools', []);
    onFilterChange('historicalPeriods', []);
    onFilterChange('signatureStatuses', []);
    onFilterChange('askOnly', false);
  }, [onFilterChange]);

  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.itemTypes.length > 0 ||
    filters.certifications.length > 0 ||
    filters.dealers.length > 0 ||
    filters.schools.length > 0 ||
    filters.historicalPeriods.length > 0 ||
    filters.signatureStatuses.length > 0 ||
    filters.askOnly;

  const activeFilterCount =
    (filters.category !== 'all' ? 1 : 0) +
    filters.itemTypes.length +
    filters.certifications.length +
    filters.dealers.length +
    filters.historicalPeriods.length +
    filters.signatureStatuses.length +
    (filters.askOnly ? 1 : 0);

  return (
    <div className="px-4 lg:px-0 pb-6">
      {/* Header with clear button */}
      <div className="flex items-center justify-between mb-4 py-2 lg:hidden">
        <div className="flex items-center gap-3">
          <h2 className="text-[17px] font-semibold text-ink">
            Refine Results
          </h2>
          {isUpdating && (
            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-[14px] text-gold hover:text-gold-light transition-colors font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between mb-2 py-2">
        <h2 className="text-[13px] uppercase tracking-[0.15em] font-semibold text-ink">
          Filters
        </h2>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-[12px] text-gold hover:text-gold-light transition-colors font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sort & Currency - Mobile only */}
      {onSortChange && onCurrencyChange && (
        <div className="lg:hidden grid grid-cols-2 gap-3 mb-5 pb-5 border-b border-border/50">
          {/* Sort */}
          <div>
            <label className="text-[12px] text-muted mb-2 block">Sort by</label>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full px-3 py-3 bg-paper border-2 border-border rounded-lg text-[15px] text-ink focus:outline-none focus:border-gold"
            >
              <option value="recent">Newest</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
              <option value="name">A-Z</option>
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="text-[12px] text-muted mb-2 block">Currency</label>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as Currency)}
              className="w-full px-3 py-3 bg-paper border-2 border-border rounded-lg text-[15px] text-ink focus:outline-none focus:border-gold"
            >
              <option value="JPY">¥ JPY</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
        </div>
      )}

      <div className="divide-y divide-border/50">
        {/* 1. Category Toggle - Most Important */}
        <div className="py-5">
          <h3 className="text-[13px] uppercase tracking-[0.15em] font-semibold text-ink mb-4">
            Category
          </h3>
          <div className="flex gap-2 lg:mr-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'nihonto', label: 'Nihonto' },
              { key: 'tosogu', label: 'Tosogu' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleCategoryChange(key as 'all' | 'nihonto' | 'tosogu')}
                className={`flex-1 px-4 py-3 lg:py-2.5 text-[15px] lg:text-[14px] font-medium rounded-lg transition-all duration-200 ${
                  filters.category === key
                    ? 'bg-gold text-white shadow-sm'
                    : 'bg-linen text-charcoal hover:bg-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Certification - Second Most Important */}
        <FilterSection title="Certification">
          <div className="space-y-1">
            {sortedCertifications.map((facet) => (
              <Checkbox
                key={facet.value}
                label={CERT_LABELS[facet.value] || facet.value}
                count={facet.count}
                checked={filters.certifications.includes(facet.value)}
                onChange={(checked) => handleCertChange(facet.value, checked)}
              />
            ))}
            {sortedCertifications.length === 0 && (
              <p className="text-[14px] text-muted italic py-2">No certifications</p>
            )}
          </div>
        </FilterSection>

        {/* 3. Historical Period - After Certification */}
        <FilterSection title="Period" defaultOpen={false}>
          <div className="space-y-1">
            {facets.historicalPeriods?.map((facet) => (
              <Checkbox
                key={facet.value}
                label={PERIOD_LABELS[facet.value] || facet.value}
                count={facet.count}
                checked={filters.historicalPeriods.includes(facet.value)}
                onChange={(checked) => handlePeriodChange(facet.value, checked)}
              />
            ))}
            {(!facets.historicalPeriods || facets.historicalPeriods.length === 0) && (
              <p className="text-[14px] text-muted italic py-2">No periods available</p>
            )}
          </div>
        </FilterSection>

        {/* 4. Signature Status */}
        <FilterSection title="Signature" defaultOpen={false}>
          <div className="space-y-1">
            {facets.signatureStatuses?.map((facet) => (
              <Checkbox
                key={facet.value}
                label={SIGNATURE_LABELS[facet.value] || facet.value}
                count={facet.count}
                checked={filters.signatureStatuses.includes(facet.value)}
                onChange={(checked) => handleSignatureChange(facet.value, checked)}
              />
            ))}
            {(!facets.signatureStatuses || facets.signatureStatuses.length === 0) && (
              <p className="text-[14px] text-muted italic py-2">No signature data</p>
            )}
          </div>
        </FilterSection>

        {/* 5. Item Type */}
        <FilterSection title="Type">
          <div className="space-y-1">
            {visibleItemTypes.map((facet) => (
              <Checkbox
                key={facet.value}
                label={ITEM_TYPE_LABELS[facet.value] || facet.value}
                count={facet.count}
                checked={filters.itemTypes.includes(facet.value)}
                onChange={(checked) => handleItemTypeChange(facet.value, checked)}
              />
            ))}
            {visibleItemTypes.length === 0 && (
              <p className="text-[14px] text-muted italic py-2">No items available</p>
            )}
          </div>
        </FilterSection>

        {/* 4. Dealer - Checkbox list like item types */}
        <FilterSection title="Dealer" defaultOpen={false}>
          <div className="space-y-1">
            {facets.dealers
              .sort((a, b) => b.count - a.count)
              .map((dealer) => (
                <Checkbox
                  key={dealer.id}
                  label={dealer.name}
                  count={dealer.count}
                  checked={filters.dealers.includes(dealer.id)}
                  onChange={(checked) => handleDealerChange(dealer.id, checked)}
                />
              ))}
            {facets.dealers.length === 0 && (
              <p className="text-[14px] text-muted italic py-2">No dealers available</p>
            )}
          </div>
        </FilterSection>

        {/* 5. Price on Request - Last, least important */}
        <div className="py-5">
          <label className="flex items-center justify-between cursor-pointer group min-h-[48px]">
            <span className="text-[15px] lg:text-[14px] text-charcoal group-hover:text-ink transition-colors">
              Price on request only
            </span>
            <div className="relative">
              <input
                type="checkbox"
                checked={filters.askOnly || false}
                onChange={(e) => onFilterChange('askOnly', e.target.checked)}
                className="peer sr-only"
              />
              <div className={`w-12 h-7 lg:w-11 lg:h-6 rounded-full transition-colors ${
                filters.askOnly
                  ? 'bg-gold'
                  : 'bg-border-dark'
              }`}>
                <div className={`absolute top-1 w-5 h-5 lg:w-4 lg:h-4 bg-white rounded-full shadow transition-transform ${
                  filters.askOnly ? 'translate-x-6 lg:translate-x-6' : 'translate-x-1'
                }`} />
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Live update indicator - subtle, at bottom */}
      {onClose && isUpdating && (
        <div className="lg:hidden text-center py-3">
          <span className="inline-flex items-center gap-2 text-[13px] text-muted">
            <span className="w-2 h-2 bg-gold rounded-full animate-pulse" />
            Updating...
          </span>
        </div>
      )}
    </div>
  );
}

// Export the active filter count helper for use elsewhere
export function getActiveFilterCount(filters: FilterContentProps['filters']): number {
  return (
    (filters.category !== 'all' ? 1 : 0) +
    filters.itemTypes.length +
    filters.certifications.length +
    filters.dealers.length +
    filters.historicalPeriods.length +
    filters.signatureStatuses.length +
    (filters.askOnly ? 1 : 0)
  );
}
