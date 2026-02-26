'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionFacets, CollectionFilters } from '@/types/collection';
import { SORT_OPTIONS, STATUS_LABELS, CONDITION_LABELS, ITEM_TYPE_LABELS } from '@/lib/collection/labels';

// =============================================================================
// Constants (mirrored from FilterContent.tsx for category filtering)
// =============================================================================

const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi', 'ken', 'naginata naoshi', 'sword'];

const TOSOGU_TYPES = [
  'tsuba', 'fuchi-kashira', 'fuchi_kashira', 'fuchi', 'kashira',
  'kozuka', 'kogatana', 'kogai', 'menuki', 'koshirae', 'tosogu',
  'mitokoromono', 'gotokoromono',
];

const CERT_LABELS: Record<string, string> = {
  'Juyo Bijutsuhin': 'Jūyō Bijutsuhin',
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

const CERT_ORDER = ['Juyo Bijutsuhin', 'Tokuju', 'tokuju', 'Juyo', 'juyo', 'TokuHozon', 'tokubetsu_hozon', 'Hozon', 'hozon', 'TokuKicho', 'nbthk', 'nthk'];
const HIDDEN_CERTS = new Set(['nthk', 'TokuKicho']);

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

const SIGNATURE_LABELS: Record<string, string> = {
  signed: 'Signed',
  unsigned: 'Mumei',
};

// =============================================================================
// Sub-components (variant B styling from browse FilterContent)
// =============================================================================

function FilterSection({ title, isOpen, onToggle, activeCount, children }: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  activeCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <button
        onClick={onToggle}
        className={`flex items-center justify-between w-full text-left group ${isOpen ? 'py-0.5 mb-1' : 'py-0.5 mb-0'}`}
      >
        <div className="flex items-center gap-1.5">
          <h3 className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted">{title}</h3>
          {activeCount !== undefined && activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold text-white bg-gold rounded-full leading-none">
              {activeCount}
            </span>
          )}
        </div>
        <svg
          className={`w-2.5 h-2.5 text-muted/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`transition-all duration-200 overflow-hidden ${isOpen ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
}

function FilterCheckbox({ label, count, checked, onChange }: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-[4px] min-h-[28px] rounded -mx-1 px-1 hover:bg-hover/30 cursor-pointer group">
      <div className={`w-[15px] h-[15px] rounded-[2px] border-[1.5px] flex items-center justify-center shrink-0 transition-all ${
        checked
          ? 'border-gold bg-gold'
          : 'border-border/60 group-hover:border-border'
      }`} style={checked ? { boxShadow: '0 0 6px rgba(184, 157, 105, 0.2)' } : undefined}>
        {checked && (
          <svg className="w-[15px] h-[15px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-[12px] text-charcoal group-hover:text-ink transition-colors flex-1 leading-tight truncate">{label}</span>
      <span className="text-[10px] text-muted/70 tabular-nums flex-shrink-0">{count}</span>
    </label>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export interface CollectionFilterContentProps {
  facets: CollectionFacets;
  filters: CollectionFilters;
  onFilterChange: (filters: Partial<CollectionFilters>) => void;
  totalItems: number;
  onClose?: () => void;
}

export function CollectionFilterContent({
  facets,
  filters,
  onFilterChange,
  totalItems,
  onClose,
}: CollectionFilterContentProps) {
  const { t, locale } = useLocale();

  // JA users expect all info visible at a glance
  const jaOpen = locale === 'ja';

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cert: true,
    period: jaOpen,
    type: jaOpen,
    signature: jaOpen,
    status: false,
    condition: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Localized label lookup
  const tLabel = useCallback((prefix: string, value: string, fallbackMap: Record<string, string>) => {
    const key = `${prefix}.${value}`;
    const translated = t(key);
    return translated !== key ? translated : fallbackMap[value] || value;
  }, [t]);

  // Category-filtered item types
  const visibleItemTypes = useMemo(() => {
    const categoryTypes = filters.category === 'tosogu' ? TOSOGU_TYPES : NIHONTO_TYPES;
    return facets.itemTypes
      .filter(f => categoryTypes.includes(f.value))
      .sort((a, b) => b.count - a.count);
  }, [facets.itemTypes, filters.category]);

  // Sort certifications by rank
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

  // Category totals
  const nihontoTotal = useMemo(() =>
    facets.itemTypes.filter(f => NIHONTO_TYPES.includes(f.value)).reduce((sum, f) => sum + f.count, 0),
    [facets.itemTypes]
  );
  const tosoguTotal = useMemo(() =>
    facets.itemTypes.filter(f => TOSOGU_TYPES.includes(f.value)).reduce((sum, f) => sum + f.count, 0),
    [facets.itemTypes]
  );

  const handleCategoryChange = useCallback((category: 'nihonto' | 'tosogu') => {
    onFilterChange({ category, itemType: undefined });
  }, [onFilterChange]);

  // Active filter count (category is a mode, not a filter)
  const activeFilterCount = (filters.itemType ? 1 : 0) + (filters.certType ? 1 : 0) +
    (filters.era ? 1 : 0) + (filters.meiType ? 1 : 0) +
    (filters.status ? 1 : 0) + (filters.condition ? 1 : 0);

  const resetFilters = () => {
    onFilterChange({
      itemType: undefined,
      certType: undefined,
      era: undefined,
      meiType: undefined,
      status: undefined,
      condition: undefined,
    });
  };

  return (
    <div className="pb-4">
      {/* ── Zone 1: Category toggle (pinned) ── */}
      <div className="flex-shrink-0 px-4 pt-3.5 pb-3 border-b border-border/15">
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted/50 font-medium block mb-1.5">{t('filter.category')}</span>
        <div className="flex rounded-lg border border-border/30 overflow-hidden">
          {([
            { key: 'nihonto' as const, label: t('category.nihonto'), count: nihontoTotal },
            { key: 'tosogu' as const, label: t('category.tosogu'), count: tosoguTotal },
          ]).map(({ key, label, count }, i) => (
            <button
              key={key}
              onClick={() => handleCategoryChange(key)}
              className={`flex-1 py-[9px] text-[12px] font-semibold tracking-[0.02em] transition-colors ${
                i > 0 ? 'border-l border-border/20' : ''
              } ${
                filters.category === key
                  ? 'bg-gold/15 text-gold'
                  : 'text-muted hover:text-ink hover:bg-hover/30'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="ml-1 text-[10px] opacity-60">({count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Zone 2: Filter header (pinned) ── */}
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
            <button onClick={resetFilters} className="text-[10px] text-muted/50 hover:text-gold transition-colors font-medium">
              {t('filter.reset')}
            </button>
          )}
        </div>
      </div>

      {/* ── Zone 3: Scrollable filter sections ── */}
      <div className="px-4 pt-0.5">
        <div className="space-y-0">
          {/* Designation (open by default) */}
          <FilterSection
            title={t('filter.designation')}
            isOpen={openSections.cert}
            onToggle={() => toggleSection('cert')}
            activeCount={filters.certType ? 1 : 0}
          >
            <div className="space-y-0">
              {sortedCertifications.map(f => (
                <FilterCheckbox
                  key={f.value}
                  label={tLabel('cert', f.value, CERT_LABELS)}
                  count={f.count}
                  checked={filters.certType === f.value}
                  onChange={() => onFilterChange({
                    certType: filters.certType === f.value ? undefined : f.value,
                  })}
                />
              ))}
              {sortedCertifications.length === 0 && (
                <p className="text-[11px] text-muted italic py-2">{t('filter.noCertifications')}</p>
              )}
            </div>
          </FilterSection>

          <div className="border-t border-border/15" />

          {/* Period (collapsed by default — open for JA) */}
          <FilterSection
            title={t('filter.period')}
            isOpen={openSections.period}
            onToggle={() => toggleSection('period')}
            activeCount={filters.era ? 1 : 0}
          >
            <div className="space-y-0">
              {facets.historicalPeriods.map(f => (
                <FilterCheckbox
                  key={f.value}
                  label={tLabel('period', f.value, PERIOD_LABELS)}
                  count={f.count}
                  checked={filters.era === f.value}
                  onChange={() => onFilterChange({
                    era: filters.era === f.value ? undefined : f.value,
                  })}
                />
              ))}
              {facets.historicalPeriods.length === 0 && (
                <p className="text-[11px] text-muted italic py-2">{t('filter.noPeriods')}</p>
              )}
            </div>
          </FilterSection>

          <div className="border-t border-border/15" />

          {/* Type (collapsed, filtered by category) */}
          <FilterSection
            title={t('filter.type')}
            isOpen={openSections.type}
            onToggle={() => toggleSection('type')}
            activeCount={filters.itemType ? 1 : 0}
          >
            <div className="space-y-0">
              {visibleItemTypes.filter(f => f.value !== 'other').map(f => (
                <FilterCheckbox
                  key={f.value}
                  label={tLabel('itemType', f.value, ITEM_TYPE_LABELS)}
                  count={f.count}
                  checked={filters.itemType === f.value}
                  onChange={() => onFilterChange({
                    itemType: filters.itemType === f.value ? undefined : f.value,
                  })}
                />
              ))}
              {visibleItemTypes.length === 0 && (
                <p className="text-[11px] text-muted italic py-2">{t('filter.noItems')}</p>
              )}
            </div>
          </FilterSection>

          <div className="border-t border-border/15" />

          {/* Signature (collapsed — open for JA) */}
          <FilterSection
            title={t('filter.signature')}
            isOpen={openSections.signature}
            onToggle={() => toggleSection('signature')}
            activeCount={filters.meiType ? 1 : 0}
          >
            <div className="space-y-0">
              {facets.signatureStatuses.map(f => (
                <FilterCheckbox
                  key={f.value}
                  label={tLabel('sig', f.value, SIGNATURE_LABELS)}
                  count={f.count}
                  checked={filters.meiType === f.value}
                  onChange={() => onFilterChange({
                    meiType: filters.meiType === f.value ? undefined : f.value,
                  })}
                />
              ))}
              {facets.signatureStatuses.length === 0 && (
                <p className="text-[11px] text-muted italic py-2">{t('filter.noSignatureData')}</p>
              )}
            </div>
          </FilterSection>

          <div className="border-t border-border/15" />

          {/* Status (collection-specific, collapsed) */}
          {facets.statuses.length > 0 && (
            <>
              <FilterSection
                title={t('collection.status')}
                isOpen={openSections.status}
                onToggle={() => toggleSection('status')}
                activeCount={filters.status ? 1 : 0}
              >
                {facets.statuses.map(f => (
                  <FilterCheckbox
                    key={f.value}
                    label={STATUS_LABELS[f.value] || f.value}
                    count={f.count}
                    checked={filters.status === f.value}
                    onChange={() => onFilterChange({
                      status: filters.status === f.value ? undefined : f.value as CollectionFilters['status'],
                    })}
                  />
                ))}
              </FilterSection>

              <div className="border-t border-border/15" />
            </>
          )}

          {/* Condition (collection-specific, collapsed) */}
          {facets.conditions.length > 0 && (
            <FilterSection
              title={t('collection.condition')}
              isOpen={openSections.condition}
              onToggle={() => toggleSection('condition')}
              activeCount={filters.condition ? 1 : 0}
            >
              {facets.conditions.map(f => (
                <FilterCheckbox
                  key={f.value}
                  label={CONDITION_LABELS[f.value] || f.value}
                  count={f.count}
                  checked={filters.condition === f.value}
                  onChange={() => onFilterChange({
                    condition: filters.condition === f.value ? undefined : f.value as CollectionFilters['condition'],
                  })}
                />
              ))}
            </FilterSection>
          )}
        </div>
      </div>

      {/* Apply button (mobile drawer only) */}
      {onClose && (
        <div className="mx-4 mt-4 pt-4 border-t border-border/20">
          <button
            onClick={onClose}
            className="w-full py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
          >
            {t('collection.showItems', { count: totalItems, label: totalItems === 1 ? t('collection.item') : t('collection.items') })}
          </button>
        </div>
      )}
    </div>
  );
}
