'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { PriceHistogramSlider, type PriceHistogramData } from './PriceHistogramSlider';
import type { ExchangeRates } from '@/hooks/useCurrency';
import { useLocale } from '@/i18n/LocaleContext';
import { getDealerDisplayName } from '@/lib/dealers/displayName';

export type SidebarVariant = 'default' | 'a' | 'b';

interface Facet {
  value: string;
  count: number;
}

interface DealerFacet {
  id: number;
  name: string;
  name_ja?: string | null;
  count: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

export type AvailabilityStatus = 'available' | 'sold' | 'all';

export type CornerStyle = 'sharp' | 'subtle' | 'soft';
export type SelectStyle = 'bold' | 'tint' | 'outline';

export interface FilterContentProps {
  facets: {
    itemTypes: Facet[];
    certifications: Facet[];
    dealers: DealerFacet[];
    historicalPeriods: Facet[];
    signatureStatuses: Facet[];
  };
  filters: {
    category: 'nihonto' | 'tosogu' | 'armor';
    itemTypes: string[];
    certifications: string[];
    schools: string[];
    dealers: number[];
    historicalPeriods: string[];
    signatureStatuses: string[];
    priceMin?: number;
    priceMax?: number;
    askOnly?: boolean;
    missingSetsumei?: boolean;
    missingArtisanCode?: boolean;
  };
  onFilterChange: (key: string, value: unknown) => void;
  onClose?: () => void;
  /** Whether the current user is an admin */
  isAdmin?: boolean;
  isUpdating?: boolean;
  variant?: SidebarVariant;
  cornerStyle?: CornerStyle;
  selectStyle?: SelectStyle;
  /** Price histogram data for visual range slider */
  priceHistogram?: PriceHistogramData | null;
  /** Exchange rates for currency conversion in histogram */
  exchangeRates?: ExchangeRates | null;
  // Sort, currency, and availability for mobile drawer
  sort?: string;
  onSortChange?: (sort: string) => void;
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  availability?: AvailabilityStatus;
  onAvailabilityChange?: (status: AvailabilityStatus) => void;
  /** Smart crop toggle (admin-only) */
  smartCropEnabled?: boolean;
  onSmartCropChange?: (enabled: boolean) => void;
}

const FilterSection = memo(function FilterSection({
  title,
  children,
  defaultOpen = true,
  variant,
  activeCount,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: SidebarVariant;
  activeCount?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isA = variant === 'a';
  const isB = variant === 'b';
  const elevated = isA || isB;

  return (
    <div className={isB ? 'py-1' : elevated ? 'py-3.5 first:pt-0' : 'py-5'}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full text-left group ${isB ? (isOpen ? 'py-0.5 mb-1' : 'py-0.5 mb-0') : elevated ? 'py-1 mb-2.5' : 'py-1 mb-4'}`}
      >
        <div className="flex items-center gap-1.5">
          <h3 className={
            isA
              ? 'text-[14px] font-semibold text-ink'
              : isB
                ? 'text-[11px] uppercase tracking-[0.06em] font-semibold text-muted'
                : 'text-[13px] uppercase tracking-[0.15em] font-semibold text-ink'
          }>
            {title}
          </h3>
          {elevated && activeCount !== undefined && activeCount > 0 && (
            <span className={
              isA
                ? 'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-gold rounded-full'
                : 'inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold text-white bg-gold rounded-full leading-none'
            } style={isA ? { backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)' } : undefined}>
              {activeCount}
            </span>
          )}
        </div>
        <svg
          className={`${isB ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-muted/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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

const Checkbox = memo(function Checkbox({
  label,
  count,
  checked,
  onChange,
  variant,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: SidebarVariant;
}) {
  const isA = variant === 'a';
  const elevated = variant === 'a' || variant === 'b';

  const isB = variant === 'b';

  return (
    <label className={`flex items-center cursor-pointer group transition-colors ${
      isB
        ? 'gap-2.5 py-[4px] min-h-[28px] rounded -mx-1 px-1 hover:bg-hover/30'
        : elevated
          ? 'gap-2.5 py-[5px] min-h-[32px] rounded-md -mx-1.5 px-1.5 hover:bg-hover/50'
          : 'gap-3 py-2.5 min-h-[48px] lg:min-h-[40px]'
    }`}>
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        {isA ? (
          <div className={`w-[15px] h-[15px] border-[1.5px] rounded-full transition-all duration-150 ${
            checked
              ? 'border-gold bg-gold'
              : 'border-charcoal/30 group-hover:border-charcoal/50'
          }`}>
            {checked && (
              <svg className="w-[15px] h-[15px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ) : (
          <div className={`${isB ? 'w-[15px] h-[15px] rounded-[2px]' : elevated ? 'w-[16px] h-[16px] rounded-[3px]' : 'w-5 h-5 lg:w-[18px] lg:h-[18px] rounded-[3px]'} border-[1.5px] transition-all duration-150 ${
            checked
              ? 'border-gold bg-gold'
              : isB ? 'border-border/60 group-hover:border-border' : 'border-charcoal/30 group-hover:border-charcoal/50'
          }`} style={isB && checked ? { boxShadow: '0 0 6px rgba(184, 157, 105, 0.2)' } : undefined}>
            {checked && (
              <svg className={`${isB ? 'w-[15px] h-[15px]' : elevated ? 'w-[16px] h-[16px]' : 'w-5 h-5 lg:w-[18px] lg:h-[18px]'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
      </div>
      <span className={`${
        isB ? 'text-[12px]' : elevated ? 'text-[13px]' : 'text-[15px] lg:text-[14px]'
      } text-charcoal group-hover:text-ink transition-colors flex-1 leading-tight`}>
        {label}
      </span>
      {count !== undefined && (
        <span className={`${
          isB ? 'text-[10px]' : elevated ? 'text-[11px]' : 'text-[13px] lg:text-[12px]'
        } text-muted/70 tabular-nums flex-shrink-0`}>
          {count}
        </span>
      )}
    </label>
  );
});

const GroupHeader = memo(function GroupHeader({
  label,
  dealers,
  selectedDealerIds,
  onToggle,
  variant,
  first,
}: {
  label: string;
  dealers: DealerFacet[];
  selectedDealerIds: number[];
  onToggle: (dealerIds: number[], selectAll: boolean) => void;
  variant?: SidebarVariant;
  first?: boolean;
}) {
  const groupIds = dealers.map(d => d.id);
  const selectedCount = groupIds.filter(id => selectedDealerIds.includes(id)).length;
  const isAll = selectedCount === groupIds.length;
  const isNone = selectedCount === 0;
  const isIndeterminate = !isAll && !isNone;

  const isB = variant === 'b';
  const elevated = variant === 'a' || variant === 'b';

  return (
    <button
      type="button"
      onClick={() => onToggle(groupIds, !isAll)}
      className={`flex items-center gap-1.5 w-full text-left group ${isB ? (first ? 'pt-0.5 pb-0.5' : 'pt-1.5 pb-0.5') : elevated ? (first ? 'pt-1 pb-1' : 'pt-2 pb-1') : (first ? 'pt-1 pb-2' : 'pt-4 pb-2')}`}
    >
      <div className="relative flex-shrink-0">
        <div className={`${isB ? 'w-[11px] h-[11px] rounded-[1.5px]' : 'w-[13px] h-[13px] rounded-[2px]'} border-[1.5px] transition-all duration-150 ${
          isAll
            ? 'border-gold bg-gold'
            : isIndeterminate
              ? 'border-gold bg-gold'
              : isB ? 'border-border/60 group-hover:border-border' : 'border-charcoal/30 group-hover:border-charcoal/50'
        }`}>
          {isAll && (
            <svg className={`${isB ? 'w-[11px] h-[11px]' : 'w-[13px] h-[13px]'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isIndeterminate && (
            <svg className={`${isB ? 'w-[11px] h-[11px]' : 'w-[13px] h-[13px]'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
            </svg>
          )}
        </div>
      </div>
      <span className={`${isB ? 'text-[10px] tracking-[0.08em]' : 'text-[11px] tracking-wider'} uppercase text-muted font-medium`}>
        {label}
      </span>
    </button>
  );
});

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
  'gotokoromono',
];

// Armor types (includes firearms as military equipment)
const ARMOR_TYPES = [
  'armor', 'yoroi', 'gusoku',
  'helmet', 'kabuto',
  'menpo', 'mengu',
  'kote', 'suneate', 'do',
  // Firearms
  'tanegashima', 'hinawaju',
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
  '火縄銃': 'tanegashima',
  'hinawaju': 'tanegashima',  // Normalize to tanegashima
  'books': 'other',
};

// Display labels
const ITEM_TYPE_LABELS: Record<string, string> = {
  // Nihonto
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
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
  kogai: 'Kogai',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
  tosogu: 'Tosogu',
  mitokoromono: 'Mitokoromono',
  gotokoromono: 'Gotokoromono',
  // Armor
  armor: 'Armor',
  yoroi: 'Yoroi',
  gusoku: 'Gusoku',
  helmet: 'Kabuto',
  kabuto: 'Kabuto',
  menpo: 'Menpō',
  mengu: 'Mengu',
  kote: 'Kote',
  suneate: 'Suneate',
  do: 'Dō',
  // Firearms
  tanegashima: 'Tanegashima',
  hinawaju: 'Hinawajū',
  // Other
  other: 'Other',
};

const CERT_LABELS: Record<string, string> = {
  // Pre-war government designation (highest prestige)
  'Juyo Bijutsuhin': 'Jūyō Bijutsuhin',
  // NBTHK
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
const CERT_ORDER = ['Juyo Bijutsuhin', 'Tokuju', 'tokuju', 'Juyo', 'juyo', 'TokuHozon', 'tokubetsu_hozon', 'Hozon', 'hozon', 'TokuKicho', 'nbthk', 'nthk'];

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

// International dealer region mapping (all others are Japan)
const DEALER_REGIONS: Record<string, 'us_canada' | 'europe_oceania'> = {
  'Legacy Swords': 'us_canada',
  'Nihon Art': 'us_canada',
  'Nihonto': 'us_canada',
  'Nihonto Art': 'us_canada',
  'Nihontocraft': 'us_canada',
  'SamuraiSword': 'us_canada',
  'Swords of Japan': 'us_canada',
  'Tetsugendo': 'us_canada',
  'Katana Sword': 'us_canada',
  'Giuseppe Piva': 'europe_oceania',
  'Nihonto Art EU': 'europe_oceania',
  'Nihonto Australia': 'europe_oceania',
  'Soryu': 'europe_oceania',
  'Tsuba Info': 'europe_oceania',
};

// Country labels for Europe & Oceania dealers (shown as suffix)
const DEALER_COUNTRY_LABELS: Record<string, string> = {
  'Giuseppe Piva': 'Italy',
  'Nihonto Art EU': 'FRA',
  'Nihonto Australia': 'AU',
  'Soryu': 'Poland',
  'Tsuba Info': 'NL',
};

// Category display labels for active filter pills
const CATEGORY_LABELS: Record<string, string> = {
  nihonto: 'Nihonto',
  tosogu: 'Tosogu',
  armor: 'Armor',
};

export function FilterContent({
  facets,
  filters,
  onFilterChange,
  onClose,
  isUpdating,
  isAdmin,
  variant,
  cornerStyle = 'soft',
  selectStyle = 'bold',
  priceHistogram,
  exchangeRates,
  sort,
  onSortChange,
  currency,
  onCurrencyChange,
  availability,
  onAvailabilityChange,
  smartCropEnabled,
  onSmartCropChange,
}: FilterContentProps) {
  const { t, locale } = useLocale();

  // JA users expect all info visible at a glance (ichimokuryouzen 一目瞭然)
  const jaOpen = locale === 'ja';

  // Localized label lookup: tries t('prefix.value'), falls back to static map, then raw value
  const tLabel = useCallback((prefix: string, value: string, fallbackMap: Record<string, string>) => {
    const key = `${prefix}.${value}`;
    const translated = t(key);
    return translated !== key ? translated : fallbackMap[value] || value;
  }, [t]);

  const isA = variant === 'a';
  const isB = variant === 'b';
  const elevated = isA || isB;

  // Dealer search state (elevated variants)
  const [dealerSearch, setDealerSearch] = useState('');

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

  const armorTypes = useMemo(() =>
    normalizedItemTypes
      .filter(f => ARMOR_TYPES.includes(f.value))
      .sort((a, b) => b.count - a.count),
    [normalizedItemTypes]
  );

  const otherTypes = useMemo(() =>
    normalizedItemTypes
      .filter(f => !NIHONTO_TYPES.includes(f.value) && !TOSOGU_TYPES.includes(f.value) && !ARMOR_TYPES.includes(f.value))
      .sort((a, b) => b.count - a.count),
    [normalizedItemTypes]
  );

  // Filter item types based on category selection
  const visibleItemTypes = useMemo(() => {
    if (filters.category === 'tosogu') return tosoguTypes;
    if (filters.category === 'armor') return armorTypes;
    return nihontoTypes; // nihonto is default
  }, [filters.category, nihontoTypes, tosoguTypes, armorTypes]);

  // Sort certifications by rank
  // Certifications hidden from filter (not serious for nihonto/tosogu collectors)
  const HIDDEN_CERTS = new Set(['nthk', 'TokuKicho']);

  const sortedCertifications = useMemo(() => {
    return [...facets.certifications]
      .filter(f => f.value !== 'null' && CERT_LABELS[f.value] && !HIDDEN_CERTS.has(f.value))
      .sort((a, b) => {
        const aIndex = CERT_ORDER.indexOf(a.value);
        const bIndex = CERT_ORDER.indexOf(b.value);
        if (aIndex === -1 && bIndex === -1) return b.count - a.count;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [facets.certifications]);

  // Group dealers by geography (Japan / US & Canada / Europe & Oceania), sorted alphabetically
  const japaneseDealers = useMemo(() =>
    facets.dealers
      .filter(d => !DEALER_REGIONS[d.name])
      .sort((a, b) => getDealerDisplayName(a, locale).localeCompare(getDealerDisplayName(b, locale), locale)),
    [facets.dealers, locale]
  );

  const usCanadaDealers = useMemo(() =>
    facets.dealers
      .filter(d => DEALER_REGIONS[d.name] === 'us_canada')
      .sort((a, b) => getDealerDisplayName(a, locale).localeCompare(getDealerDisplayName(b, locale), locale)),
    [facets.dealers, locale]
  );

  const europeOceaniaDealers = useMemo(() =>
    facets.dealers
      .filter(d => DEALER_REGIONS[d.name] === 'europe_oceania')
      .sort((a, b) => getDealerDisplayName(a, locale).localeCompare(getDealerDisplayName(b, locale), locale)),
    [facets.dealers, locale]
  );

  // Dealer search filtering (elevated variants)
  const filteredJapaneseDealers = useMemo(() => {
    if (!dealerSearch) return japaneseDealers;
    const q = dealerSearch.toLowerCase();
    return japaneseDealers.filter(d =>
      getDealerDisplayName(d, locale).toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
    );
  }, [japaneseDealers, dealerSearch, locale]);

  const filteredUsCanadaDealers = useMemo(() => {
    if (!dealerSearch) return usCanadaDealers;
    const q = dealerSearch.toLowerCase();
    return usCanadaDealers.filter(d =>
      getDealerDisplayName(d, locale).toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
    );
  }, [usCanadaDealers, dealerSearch, locale]);

  const filteredEuropeOceaniaDealers = useMemo(() => {
    if (!dealerSearch) return europeOceaniaDealers;
    const q = dealerSearch.toLowerCase();
    return europeOceaniaDealers.filter(d =>
      getDealerDisplayName(d, locale).toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
    );
  }, [europeOceaniaDealers, dealerSearch, locale]);

  // Calculate totals for category tabs
  const nihontoTotal = useMemo(() =>
    nihontoTypes.reduce((sum, t) => sum + t.count, 0),
    [nihontoTypes]
  );

  const tosoguTotal = useMemo(() =>
    tosoguTypes.reduce((sum, t) => sum + t.count, 0),
    [tosoguTypes]
  );

  const armorTotal = useMemo(() =>
    armorTypes.reduce((sum, t) => sum + t.count, 0),
    [armorTypes]
  );

  const handleCategoryChange = useCallback((category: 'nihonto' | 'tosogu' | 'armor') => {
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

  const handleDealerGroupToggle = useCallback((dealerIds: number[], selectAll: boolean) => {
    const current = filters.dealers;
    if (selectAll) {
      const merged = [...new Set([...current, ...dealerIds])];
      onFilterChange('dealers', merged);
    } else {
      onFilterChange('dealers', current.filter(id => !dealerIds.includes(id)));
    }
  }, [filters.dealers, onFilterChange]);

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

  const hasActiveFilters =
    filters.itemTypes.length > 0 ||
    filters.certifications.length > 0 ||
    filters.dealers.length > 0 ||
    filters.schools.length > 0 ||
    filters.historicalPeriods.length > 0 ||
    filters.signatureStatuses.length > 0 ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined ||
    filters.askOnly ||
    filters.missingSetsumei ||
    filters.missingArtisanCode;

  const activeFilterCount =
    filters.itemTypes.length +
    filters.certifications.length +
    filters.dealers.length +
    filters.historicalPeriods.length +
    filters.signatureStatuses.length +
    (filters.priceMin || filters.priceMax ? 1 : 0) +
    (filters.askOnly ? 1 : 0) +
    (filters.missingSetsumei ? 1 : 0) +
    (filters.missingArtisanCode ? 1 : 0);

  // Active filter pills (Variant A)
  const activeFilterPills = useMemo(() => {
    if (!isA) return [];
    const pills: { key: string; label: string; onRemove: () => void }[] = [];
    // Category is a mode — no pill for it
    filters.certifications.forEach(c => pills.push({ key: `cert-${c}`, label: tLabel('cert', c, CERT_LABELS), onRemove: () => handleCertChange(c, false) }));
    filters.itemTypes.forEach(tp => pills.push({ key: `type-${tp}`, label: tLabel('itemType', tp, ITEM_TYPE_LABELS), onRemove: () => handleItemTypeChange(tp, false) }));
    filters.historicalPeriods.forEach(p => pills.push({ key: `period-${p}`, label: tLabel('period', p, PERIOD_LABELS), onRemove: () => handlePeriodChange(p, false) }));
    filters.signatureStatuses.forEach(s => pills.push({ key: `sig-${s}`, label: tLabel('sig', s, SIGNATURE_LABELS), onRemove: () => handleSignatureChange(s, false) }));
    if (filters.priceMin || filters.priceMax) {
      const fmt = (v: number) => v >= 1000000 ? `¥${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}M` : `¥${(v / 1000).toFixed(0)}K`;
      const label = filters.priceMin && filters.priceMax ? `${fmt(filters.priceMin)}–${fmt(filters.priceMax)}` : filters.priceMin ? `${fmt(filters.priceMin)}+` : `Up to ${fmt(filters.priceMax!)}`;
      pills.push({ key: 'price', label, onRemove: () => { onFilterChange('priceMin', undefined); onFilterChange('priceMax', undefined); } });
    }
    filters.dealers.forEach(id => {
      const d = facets.dealers.find(dl => dl.id === id);
      if (d) pills.push({ key: `dealer-${id}`, label: getDealerDisplayName(d, locale), onRemove: () => handleDealerChange(id, false) });
    });
    return pills;
  }, [isA, filters, facets.dealers, onFilterChange, handleCertChange, handleItemTypeChange, handlePeriodChange, handleSignatureChange, handleDealerChange, locale]);

  // Which dealer lists to use
  const jpDealers = elevated ? filteredJapaneseDealers : japaneseDealers;
  const usDealers = elevated ? filteredUsCanadaDealers : usCanadaDealers;
  const euDealers = elevated ? filteredEuropeOceaniaDealers : europeOceaniaDealers;

  return (
    <div className={elevated ? 'pb-4' : 'px-4 lg:px-0 pb-6'}>
      {/* Mobile header */}
      <div className="flex items-center justify-between mb-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <h2 className="text-[17px] font-semibold text-ink">
            {t('filter.refineResults')}
          </h2>
          {isUpdating && (
            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[14px] text-gold hover:text-gold-light transition-colors font-medium"
            >
              {t('filter.clearAll')}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 -mr-1 text-charcoal hover:text-ink active:bg-black/5 rounded-full transition-colors"
              aria-label="Close filters"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Desktop header — Variant A: sentence-case with subtle border */}
      {isA && (
        <div className="hidden lg:flex items-center justify-between mb-1 pb-3 border-b border-border/30">
          <h2 className="text-[15px] font-semibold text-ink">{t('filter.filters')}</h2>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="text-[12px] text-gold hover:text-gold-light transition-colors font-medium">{t('filter.clearAll')}</button>
          )}
        </div>
      )}
      {/* Variant B: no desktop header (handled by FilterSidebar card header) */}
      {/* Default: original uppercase header */}
      {!elevated && (
        <div className="hidden lg:flex items-center justify-between mb-2 py-2">
          <h2 className="text-[13px] uppercase tracking-[0.15em] font-semibold text-ink">{t('filter.filters')}</h2>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="text-[12px] text-gold hover:text-gold-light transition-colors font-medium">{t('filter.clearAll')}</button>
          )}
        </div>
      )}

      {/* Active Filter Pills (Variant A only) */}
      {isA && activeFilterPills.length > 0 && (
        <div className="hidden lg:flex flex-wrap gap-1.5 pt-3 pb-2">
          {activeFilterPills.map(pill => (
            <button
              key={pill.key}
              onClick={pill.onRemove}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-gold border border-gold/20 rounded-full hover:border-gold/40 transition-colors group"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
            >
              {pill.label}
              <svg className="w-2.5 h-2.5 text-gold/50 group-hover:text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Category — Mobile first element (2-segment control) */}
      <div className="lg:hidden mb-3">
        <label className="text-[12px] text-muted mb-2 block">{t('filter.category')}</label>
        <div className="flex rounded-lg border-2 border-border overflow-hidden">
          {([
            { key: 'nihonto' as const, label: t('category.nihonto') },
            { key: 'tosogu' as const, label: t('category.tosogu') },
          ]).map(({ key, label }, i) => (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className={`flex-1 py-3 text-[15px] font-semibold transition-colors ${
                i > 0 ? 'border-l border-border' : ''
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

      {/* Availability - Mobile only (subtle segmented buttons) */}
      {onAvailabilityChange && (
        <div className="lg:hidden mb-3">
          <label className="text-[12px] text-muted mb-2 block">{t('filter.show')}</label>
          <div className="flex rounded-md border border-border overflow-hidden">
            {([
              { key: 'available' as const, label: t('availability.forSale') },
              { key: 'sold' as const, label: t('availability.sold') },
              { key: 'all' as const, label: t('availability.all') },
            ]).map(({ key, label }, i) => (
              <button
                key={key}
                onClick={() => onAvailabilityChange(key)}
                className={`flex-1 py-2 text-[13px] font-medium transition-colors ${
                  i > 0 ? 'border-l border-border' : ''
                } ${
                  availability === key
                    ? 'bg-gold/10 text-gold'
                    : 'text-muted hover:text-ink hover:bg-hover/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort & Currency - Mobile only */}
      {onSortChange && onCurrencyChange && (
        <div className="lg:hidden grid grid-cols-2 gap-3 mb-5 pb-5 border-b border-border/50">
          {/* Sort */}
          <div>
            <label className="text-[12px] text-muted mb-2 block">{t('filter.sortBy')}</label>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full px-3 py-3 bg-paper border-2 border-border rounded-lg text-[15px] text-ink focus:outline-none focus:border-gold"
            >
              <option value="featured">{t('sort.featured')}</option>
              <option value="recent">{t('sort.newest')}</option>
              {availability === 'sold' && <option value="sale_date">{t('sort.recentlySold')}</option>}
              <option value="price_asc">{t('sort.priceLowHigh')}</option>
              <option value="price_desc">{t('sort.priceHighLow')}</option>
              {isAdmin && <option value="elite_factor">{t('sort.eliteStanding')}</option>}
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="text-[12px] text-muted mb-2 block">{t('filter.currency')}</label>
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

      <div className={elevated ? 'space-y-0' : 'divide-y divide-border/50'}>
        {/* 1. Price — histogram slider (most visual, universal filter) */}
        <div className={isB ? 'py-2' : elevated ? 'py-3' : 'py-5'}>
          <span className={
            isB
              ? 'text-[11px] uppercase tracking-[0.06em] font-semibold text-muted block mb-1.5'
              : elevated
                ? 'text-[14px] font-semibold text-ink block mb-2'
                : 'text-[13px] uppercase tracking-[0.15em] font-semibold text-ink block mb-3'
          }>
            {t('filter.price')} {currency === 'USD' ? '($)' : currency === 'EUR' ? '(€)' : '(¥)'}
          </span>
          <PriceHistogramSlider
            histogram={priceHistogram ?? null}
            priceMin={filters.priceMin}
            priceMax={filters.priceMax}
            onPriceChange={(min, max) => {
              onFilterChange('priceMin', min);
              onFilterChange('priceMax', max);
            }}
            variant={variant}
            currency={currency}
            exchangeRates={exchangeRates}
          />
        </div>

        {elevated && <div className={`border-t ${isB ? 'border-border/15' : 'border-border/30'}`} />}

        {/* 2. Designation (checkboxes, open) */}
        <FilterSection title={t('filter.designation')} variant={variant} activeCount={filters.certifications.length}>
          <div className={elevated ? 'space-y-0' : 'space-y-1'}>
            {sortedCertifications.map((facet) => (
              <Checkbox key={facet.value} label={tLabel('cert', facet.value, CERT_LABELS)} count={facet.count} checked={filters.certifications.includes(facet.value)} onChange={(checked) => handleCertChange(facet.value, checked)} variant={variant} />
            ))}
            {sortedCertifications.length === 0 && <p className={`${isB ? 'text-[11px]' : 'text-[14px]'} text-muted italic py-2`}>{t('filter.noCertifications')}</p>}
          </div>
        </FilterSection>

        {elevated && <div className={`border-t ${isB ? 'border-border/15' : 'border-border/30'}`} />}

        {/* 2. Period (checkboxes, closed by default — open for JA) */}
        <FilterSection title={t('filter.period')} defaultOpen={jaOpen} variant={variant} activeCount={filters.historicalPeriods.length}>
          <div className={elevated ? 'space-y-0' : 'space-y-1'}>
            {facets.historicalPeriods?.map((facet) => (
              <Checkbox key={facet.value} label={tLabel('period', facet.value, PERIOD_LABELS)} count={facet.count} checked={filters.historicalPeriods.includes(facet.value)} onChange={(checked) => handlePeriodChange(facet.value, checked)} variant={variant} />
            ))}
            {(!facets.historicalPeriods || facets.historicalPeriods.length === 0) && <p className={`${isB ? 'text-[11px]' : 'text-[14px]'} text-muted italic py-2`}>{t('filter.noPeriods')}</p>}
          </div>
        </FilterSection>

        {elevated && <div className={`border-t ${isB ? 'border-border/15' : 'border-border/30'}`} />}

        {/* 3. Type (checkboxes, closed — open for JA) */}
        <FilterSection title={t('filter.type')} defaultOpen={jaOpen} variant={variant} activeCount={filters.itemTypes.length}>
          <div className={elevated ? 'space-y-0' : 'space-y-1'}>
            {visibleItemTypes.filter((facet) => facet.value !== 'other').map((facet) => (
              <Checkbox key={facet.value} label={tLabel('itemType', facet.value, ITEM_TYPE_LABELS)} count={facet.count} checked={filters.itemTypes.includes(facet.value)} onChange={(checked) => handleItemTypeChange(facet.value, checked)} variant={variant} />
            ))}
            {visibleItemTypes.length === 0 && <p className={`${isB ? 'text-[11px]' : 'text-[14px]'} text-muted italic py-2`}>{t('filter.noItems')}</p>}
          </div>
        </FilterSection>

        {elevated && <div className={`border-t ${isB ? 'border-border/15' : 'border-border/30'}`} />}

        {/* 5. Signature (collapsed by default — open for JA) */}
        <FilterSection title={t('filter.signature')} defaultOpen={jaOpen} variant={variant} activeCount={filters.signatureStatuses.length}>
          <div className={elevated ? 'space-y-0' : 'space-y-1'}>
            {facets.signatureStatuses?.map((facet) => (
              <Checkbox key={facet.value} label={tLabel('sig', facet.value, SIGNATURE_LABELS)} count={facet.count} checked={filters.signatureStatuses.includes(facet.value)} onChange={(checked) => handleSignatureChange(facet.value, checked)} variant={variant} />
            ))}
            {(!facets.signatureStatuses || facets.signatureStatuses.length === 0) && <p className={`${isB ? 'text-[11px]' : 'text-[14px]'} text-muted italic py-2`}>{t('filter.noSignatureData')}</p>}
          </div>
        </FilterSection>

        {elevated && <div className={`border-t ${isB ? 'border-border/15' : 'border-border/30'}`} />}

        {/* 6. Dealer (open for JA) */}
        <FilterSection title={t('filter.dealer')} defaultOpen={jaOpen} variant={variant} activeCount={filters.dealers.length}>
          <div className={elevated ? 'space-y-0' : 'space-y-1'}>
            {/* Dealer search (elevated variants) */}
            {elevated && (
              <div className="relative mb-1.5">
                <svg className={`absolute left-2 top-1/2 -translate-y-1/2 ${isB ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-muted`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={dealerSearch}
                  onChange={(e) => setDealerSearch(e.target.value)}
                  placeholder={t('search.searchDealers')}
                  className={`w-full ${isB ? 'pl-7 pr-3 py-1 text-[11px]' : 'pl-8 pr-3 py-1.5 text-[12px]'} rounded-md border transition-colors focus:outline-none focus:border-gold/50 ${
                    isA ? 'bg-transparent border-border/60' : 'bg-transparent border-border/30'
                  } text-ink placeholder:text-muted/70`}
                />
                {dealerSearch && (
                  <button onClick={() => setDealerSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            )}
            {/* Japan dealers */}
            {jpDealers.length > 0 && (
              <>
                <GroupHeader label={t('filter.japan')} dealers={jpDealers} selectedDealerIds={filters.dealers} onToggle={handleDealerGroupToggle} variant={variant} first />
                {jpDealers.map((dealer) => (
                  <Checkbox key={dealer.id} label={getDealerDisplayName(dealer, locale)} count={dealer.count} checked={filters.dealers.includes(dealer.id)} onChange={(checked) => handleDealerChange(dealer.id, checked)} variant={variant} />
                ))}
              </>
            )}
            {/* US & Canada dealers */}
            {usDealers.length > 0 && (
              <>
                <GroupHeader label={t('filter.usCanada')} dealers={usDealers} selectedDealerIds={filters.dealers} onToggle={handleDealerGroupToggle} variant={variant} />
                {usDealers.map((dealer) => (
                  <Checkbox key={dealer.id} label={getDealerDisplayName(dealer, locale)} count={dealer.count} checked={filters.dealers.includes(dealer.id)} onChange={(checked) => handleDealerChange(dealer.id, checked)} variant={variant} />
                ))}
              </>
            )}
            {/* Europe & Oceania dealers */}
            {euDealers.length > 0 && (
              <>
                <GroupHeader label={t('filter.europeOceania')} dealers={euDealers} selectedDealerIds={filters.dealers} onToggle={handleDealerGroupToggle} variant={variant} />
                {euDealers.map((dealer) => (
                  <Checkbox key={dealer.id} label={`${getDealerDisplayName(dealer, locale)}${DEALER_COUNTRY_LABELS[dealer.name] ? ` (${DEALER_COUNTRY_LABELS[dealer.name]})` : ''}`} count={dealer.count} checked={filters.dealers.includes(dealer.id)} onChange={(checked) => handleDealerChange(dealer.id, checked)} variant={variant} />
                ))}
              </>
            )}
            {elevated && filteredJapaneseDealers.length === 0 && filteredUsCanadaDealers.length === 0 && filteredEuropeOceaniaDealers.length === 0 && dealerSearch && (
              <p className={`${isB ? 'text-[11px]' : 'text-[12px]'} text-muted italic py-2`}>{t('filter.noDealersMatch', { q: dealerSearch })}</p>
            )}
            {facets.dealers.length === 0 && <p className={`${isB ? 'text-[11px]' : 'text-[14px]'} text-muted italic py-2`}>{t('filter.noDealers')}</p>}
          </div>
        </FilterSection>

        {elevated && <div className={`border-t ${isB ? 'border-border/15' : 'border-border/30'}`} />}

        {/* 7. Price on Request */}
        <div className={isB ? 'py-2' : elevated ? 'py-3' : 'py-5'}>
          <label className={`flex items-center justify-between cursor-pointer group ${isB ? 'min-h-[28px]' : elevated ? 'min-h-[36px]' : 'min-h-[48px]'}`}>
            <span className={`${isB ? 'text-[12px]' : elevated ? 'text-[13px]' : 'text-[15px] lg:text-[14px]'} text-charcoal group-hover:text-ink transition-colors`}>
              {t('filter.priceOnRequest')}
            </span>
            <div className="relative">
              <input type="checkbox" checked={filters.askOnly || false} onChange={(e) => onFilterChange('askOnly', e.target.checked)} className="peer sr-only" />
              <div className={`${isB ? 'w-8 h-[18px]' : elevated ? 'w-10 h-[22px]' : 'w-12 h-7 lg:w-11 lg:h-6'} rounded-full transition-colors ${filters.askOnly ? 'bg-gold' : 'bg-border-dark'}`}>
                <div className={`absolute ${isB ? 'top-[3px] w-3 h-3' : elevated ? 'top-[3px] w-4 h-4' : 'top-1 w-5 h-5 lg:w-4 lg:h-4'} bg-white rounded-full shadow transition-transform ${filters.askOnly ? (isB ? 'translate-x-[14px]' : elevated ? 'translate-x-[22px]' : 'translate-x-6 lg:translate-x-6') : 'translate-x-[3px]'}`} />
              </div>
            </div>
          </label>
        </div>

        {/* Admin: Missing Setsumei */}
        {isAdmin && (
          <div className={`${isB ? 'py-2' : elevated ? 'py-3' : 'py-5'} border-t ${isB ? 'border-gold/20' : 'border-gold/30'}`}>
            <label className={`flex items-center justify-between cursor-pointer group ${isB ? 'min-h-[28px]' : elevated ? 'min-h-[36px]' : 'min-h-[48px]'}`}>
              <div className="flex items-center gap-1.5">
                <span className={`${isB ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} bg-gold/20 text-gold rounded font-semibold`}>ADMIN</span>
                <span className={`${isB ? 'text-[12px]' : elevated ? 'text-[13px]' : 'text-[15px] lg:text-[14px]'} text-charcoal group-hover:text-ink transition-colors`}>Missing Setsumei</span>
              </div>
              <div className="relative">
                <input type="checkbox" checked={filters.missingSetsumei || false} onChange={(e) => onFilterChange('missingSetsumei', e.target.checked)} className="peer sr-only" />
                <div className={`${isB ? 'w-8 h-[18px]' : elevated ? 'w-10 h-[22px]' : 'w-12 h-7 lg:w-11 lg:h-6'} rounded-full transition-colors ${filters.missingSetsumei ? 'bg-gold' : 'bg-border-dark'}`}>
                  <div className={`absolute ${isB ? 'top-[3px] w-3 h-3' : elevated ? 'top-[3px] w-4 h-4' : 'top-1 w-5 h-5 lg:w-4 lg:h-4'} bg-white rounded-full shadow transition-transform ${filters.missingSetsumei ? (isB ? 'translate-x-[14px]' : elevated ? 'translate-x-[22px]' : 'translate-x-6 lg:translate-x-6') : 'translate-x-[3px]'}`} />
                </div>
              </div>
            </label>
            {!isB && <p className="text-[11px] text-muted mt-1">Juyo/Tokuju items without OCR setsumei translation</p>}
          </div>
        )}

        {/* Admin: Missing Artisan Code */}
        {isAdmin && (
          <div className={`${isB ? 'py-2' : elevated ? 'py-3' : 'py-5'} border-t ${isB ? 'border-gold/20' : 'border-gold/30'}`}>
            <label className={`flex items-center justify-between cursor-pointer group ${isB ? 'min-h-[28px]' : elevated ? 'min-h-[36px]' : 'min-h-[48px]'}`}>
              <div className="flex items-center gap-1.5">
                <span className={`${isB ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} bg-gold/20 text-gold rounded font-semibold`}>ADMIN</span>
                <span className={`${isB ? 'text-[12px]' : elevated ? 'text-[13px]' : 'text-[15px] lg:text-[14px]'} text-charcoal group-hover:text-ink transition-colors`}>Missing Artisan Code</span>
              </div>
              <div className="relative">
                <input type="checkbox" checked={filters.missingArtisanCode || false} onChange={(e) => onFilterChange('missingArtisanCode', e.target.checked)} className="peer sr-only" />
                <div className={`${isB ? 'w-8 h-[18px]' : elevated ? 'w-10 h-[22px]' : 'w-12 h-7 lg:w-11 lg:h-6'} rounded-full transition-colors ${filters.missingArtisanCode ? 'bg-gold' : 'bg-border-dark'}`}>
                  <div className={`absolute ${isB ? 'top-[3px] w-3 h-3' : elevated ? 'top-[3px] w-4 h-4' : 'top-1 w-5 h-5 lg:w-4 lg:h-4'} bg-white rounded-full shadow transition-transform ${filters.missingArtisanCode ? (isB ? 'translate-x-[14px]' : elevated ? 'translate-x-[22px]' : 'translate-x-6 lg:translate-x-6') : 'translate-x-[3px]'}`} />
                </div>
              </div>
            </label>
            {!isB && <p className="text-[11px] text-muted mt-1">Items without Yuhinkai artisan code match</p>}
          </div>
        )}

        {/* Admin: Smart Crop */}
        {isAdmin && onSmartCropChange && (
          <div className={`${isB ? 'py-2' : elevated ? 'py-3' : 'py-5'} border-t ${isB ? 'border-gold/20' : 'border-gold/30'}`}>
            <label className={`flex items-center justify-between cursor-pointer group ${isB ? 'min-h-[28px]' : elevated ? 'min-h-[36px]' : 'min-h-[48px]'}`}>
              <div className="flex items-center gap-1.5">
                <span className={`${isB ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5'} bg-gold/20 text-gold rounded font-semibold`}>ADMIN</span>
                <span className={`${isB ? 'text-[12px]' : elevated ? 'text-[13px]' : 'text-[15px] lg:text-[14px]'} text-charcoal group-hover:text-ink transition-colors`}>Smart Crop</span>
              </div>
              <div className="relative">
                <input type="checkbox" checked={smartCropEnabled || false} onChange={(e) => onSmartCropChange(e.target.checked)} className="peer sr-only" />
                <div className={`${isB ? 'w-8 h-[18px]' : elevated ? 'w-10 h-[22px]' : 'w-12 h-7 lg:w-11 lg:h-6'} rounded-full transition-colors ${smartCropEnabled ? 'bg-gold' : 'bg-border-dark'}`}>
                  <div className={`absolute ${isB ? 'top-[3px] w-3 h-3' : elevated ? 'top-[3px] w-4 h-4' : 'top-1 w-5 h-5 lg:w-4 lg:h-4'} bg-white rounded-full shadow transition-transform ${smartCropEnabled ? (isB ? 'translate-x-[14px]' : elevated ? 'translate-x-[22px]' : 'translate-x-6 lg:translate-x-6') : 'translate-x-[3px]'}`} />
                </div>
              </div>
            </label>
            {!isB && <p className="text-[11px] text-muted mt-1">AI focal-point crop vs center-center</p>}
          </div>
        )}
      </div>

      {/* Live update indicator - subtle, at bottom */}
      {onClose && isUpdating && (
        <div className="lg:hidden text-center py-3">
          <span className="inline-flex items-center gap-2 text-[13px] text-muted">
            <span className="w-2 h-2 bg-gold rounded-full animate-pulse" />
            {t('filter.updating')}
          </span>
        </div>
      )}
    </div>
  );
}

// Export the active filter count helper for use elsewhere
export function getActiveFilterCount(filters: FilterContentProps['filters']): number {
  return (
    filters.itemTypes.length +
    filters.certifications.length +
    filters.dealers.length +
    filters.historicalPeriods.length +
    filters.signatureStatuses.length +
    (filters.priceMin || filters.priceMax ? 1 : 0) +
    (filters.askOnly ? 1 : 0) +
    (filters.missingSetsumei ? 1 : 0) +
    (filters.missingArtisanCode ? 1 : 0)
  );
}
