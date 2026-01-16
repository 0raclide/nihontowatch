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

export interface FilterContentProps {
  facets: {
    itemTypes: Facet[];
    certifications: Facet[];
    dealers: DealerFacet[];
  };
  filters: {
    category: 'all' | 'nihonto' | 'tosogu';
    itemTypes: string[];
    certifications: string[];
    schools: string[];
    dealers: number[];
    askOnly?: boolean;
  };
  onFilterChange: (key: string, value: unknown) => void;
  onClose?: () => void;
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
    <div className="pb-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group mb-3 py-1 lg:py-0"
      >
        <h3 className="text-[11px] uppercase tracking-[0.2em] font-medium text-charcoal dark:text-gray-300">
          {title}
        </h3>
        <svg
          className={`w-3 h-3 text-muted dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
    <label className="flex items-center gap-2.5 cursor-pointer group py-2 lg:py-1 min-h-[44px] lg:min-h-0">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className="w-4 h-4 lg:w-3.5 lg:h-3.5 border border-border-dark dark:border-gray-600 peer-checked:border-gold peer-checked:bg-gold transition-colors rounded-sm">
          {checked && (
            <svg className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-[13px] text-charcoal dark:text-gray-300 group-hover:text-ink dark:group-hover:text-white transition-colors flex-1">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[11px] text-muted/70 dark:text-gray-600 tabular-nums">{count}</span>
      )}
    </label>
  );
}

// Nihonto (swords/blades)
const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi'];

// Tosogu (fittings)
const TOSOGU_TYPES = ['tsuba', 'fuchi-kashira', 'kozuka', 'menuki', 'koshirae'];

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
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tantō',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  kodachi: 'Kodachi',
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
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

export function FilterContent({ facets, filters, onFilterChange, onClose }: FilterContentProps) {
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerDropdownOpen, setDealerDropdownOpen] = useState(false);

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

  // Filter dealers by search
  const filteredDealers = useMemo(() => {
    if (!dealerSearch.trim()) return facets.dealers;
    const search = dealerSearch.toLowerCase();
    return facets.dealers.filter(d => d.name.toLowerCase().includes(search));
  }, [facets.dealers, dealerSearch]);

  // Selected dealer names for display
  const selectedDealerNames = useMemo(() => {
    return facets.dealers
      .filter(d => filters.dealers.includes(d.id))
      .map(d => d.name);
  }, [facets.dealers, filters.dealers]);

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

  const clearAllFilters = useCallback(() => {
    onFilterChange('category', 'all');
    onFilterChange('itemTypes', []);
    onFilterChange('certifications', []);
    onFilterChange('dealers', []);
    onFilterChange('schools', []);
    onFilterChange('askOnly', false);
    setDealerSearch('');
  }, [onFilterChange]);

  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.itemTypes.length > 0 ||
    filters.certifications.length > 0 ||
    filters.dealers.length > 0 ||
    filters.schools.length > 0 ||
    filters.askOnly;

  const activeFilterCount =
    (filters.category !== 'all' ? 1 : 0) +
    filters.itemTypes.length +
    filters.certifications.length +
    filters.dealers.length +
    (filters.askOnly ? 1 : 0);

  return (
    <div className="px-4 lg:px-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[11px] uppercase tracking-[0.25em] font-medium text-ink dark:text-white">Refine</h2>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-[10px] uppercase tracking-[0.1em] text-gold hover:text-gold-light transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-1 divide-y divide-border/50 dark:divide-gray-700/30">
        {/* Category Toggle - Elegant segmented control */}
        <div className="pb-5">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-medium text-charcoal dark:text-gray-300 mb-3">
            Category
          </h3>
          <div className="inline-flex bg-linen dark:bg-gray-800/50 p-0.5 rounded-sm">
            {[
              { key: 'all', label: 'All' },
              { key: 'nihonto', label: 'Nihonto', count: nihontoTotal },
              { key: 'tosogu', label: 'Tosogu', count: tosoguTotal },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleCategoryChange(key as 'all' | 'nihonto' | 'tosogu')}
                className={`px-3 py-2.5 lg:py-1.5 text-[11px] tracking-wide transition-all duration-200 ${
                  filters.category === key
                    ? 'bg-white dark:bg-gray-700 text-ink dark:text-white shadow-sm'
                    : 'text-muted dark:text-gray-500 hover:text-charcoal dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dealer - Elegant dropdown */}
        <div className="py-5">
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-medium text-charcoal dark:text-gray-300 mb-3">
            Dealer
          </h3>
          <div className="relative">
            <button
              onClick={() => setDealerDropdownOpen(!dealerDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-3 lg:py-2 bg-white dark:bg-gray-800/50 border border-border dark:border-gray-700 text-left text-[13px] text-charcoal dark:text-gray-300 hover:border-border-dark dark:hover:border-gray-600 transition-colors min-h-[44px] lg:min-h-0"
            >
              <span className={selectedDealerNames.length > 0 ? 'text-ink dark:text-white' : 'text-muted'}>
                {selectedDealerNames.length > 0
                  ? selectedDealerNames.length === 1
                    ? selectedDealerNames[0]
                    : `${selectedDealerNames.length} selected`
                  : 'All dealers'}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${dealerDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dealerDropdownOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-border dark:border-gray-700 shadow-lg max-h-64 overflow-hidden">
                {/* Search */}
                <div className="p-2 border-b border-border/50 dark:border-gray-700/50">
                  <input
                    type="text"
                    value={dealerSearch}
                    onChange={(e) => setDealerSearch(e.target.value)}
                    placeholder="Search dealers..."
                    className="w-full px-2 py-2 lg:py-1.5 text-[12px] bg-linen dark:bg-gray-900 border-0 text-ink dark:text-white placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                </div>
                {/* Dealer list */}
                <div className="max-h-48 overflow-y-auto py-1">
                  {filteredDealers.map((dealer) => (
                    <label
                      key={dealer.id}
                      className="flex items-center gap-2 px-3 py-2.5 lg:py-1.5 cursor-pointer hover:bg-linen dark:hover:bg-gray-700/50 transition-colors min-h-[44px] lg:min-h-0"
                    >
                      <input
                        type="checkbox"
                        checked={filters.dealers.includes(dealer.id)}
                        onChange={(e) => handleDealerChange(dealer.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-4 h-4 lg:w-3 lg:h-3 border border-border-dark dark:border-gray-600 peer-checked:border-gold peer-checked:bg-gold transition-colors rounded-sm flex items-center justify-center">
                        {filters.dealers.includes(dealer.id) && (
                          <svg className="w-3 h-3 lg:w-2.5 lg:h-2.5 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1 text-[12px] text-charcoal dark:text-gray-300">{dealer.name}</span>
                      <span className="text-[10px] text-muted/60 tabular-nums">{dealer.count}</span>
                    </label>
                  ))}
                  {filteredDealers.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-muted italic">No dealers found</p>
                  )}
                </div>
                {/* Clear selection */}
                {filters.dealers.length > 0 && (
                  <div className="p-2 border-t border-border/50 dark:border-gray-700/50">
                    <button
                      onClick={() => {
                        onFilterChange('dealers', []);
                        setDealerDropdownOpen(false);
                      }}
                      className="w-full text-[10px] uppercase tracking-wider text-muted hover:text-gold transition-colors py-1"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price on Request toggle - below dealer */}
          <div className="mt-4 pt-4 border-t border-border/30 dark:border-gray-700/30">
            <label className="flex items-center gap-3 cursor-pointer group min-h-[44px] lg:min-h-0">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={filters.askOnly || false}
                  onChange={(e) => onFilterChange('askOnly', e.target.checked)}
                  className="peer sr-only"
                />
                <div className={`w-10 h-5 lg:w-8 lg:h-4 rounded-full transition-colors ${
                  filters.askOnly
                    ? 'bg-gold'
                    : 'bg-border-dark dark:bg-gray-600'
                }`}>
                  <div className={`absolute top-0.5 w-4 h-4 lg:w-3 lg:h-3 bg-white rounded-full shadow transition-transform ${
                    filters.askOnly ? 'translate-x-5 lg:translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </div>
              </div>
              <span className="text-[13px] text-charcoal dark:text-gray-300 group-hover:text-ink dark:group-hover:text-white transition-colors">
                Price on request only
              </span>
            </label>
          </div>
        </div>

        {/* Certification */}
        <FilterSection title="Certification">
          <div className="space-y-0.5">
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
              <p className="text-[11px] text-muted dark:text-gray-500 italic">No certifications</p>
            )}
          </div>
        </FilterSection>

        {/* Item Type */}
        <FilterSection title="Type">
          <div className="space-y-0.5">
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
              <p className="text-[11px] text-muted dark:text-gray-500 italic">No items available</p>
            )}
          </div>
        </FilterSection>
      </div>

      {/* Mobile Apply Button */}
      {onClose && (
        <div className="lg:hidden mt-6 pb-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gold text-white text-[13px] uppercase tracking-[0.1em] font-medium hover:bg-gold-light transition-colors"
          >
            Apply Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
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
    (filters.askOnly ? 1 : 0)
  );
}
