'use client';

import { useState } from 'react';
import type { CollectionFacets, CollectionFilters } from '@/types/collection';

// =============================================================================
// Constants (shared between sidebar and drawer)
// =============================================================================

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest Added' },
  { value: 'value_desc', label: 'Value: High to Low' },
  { value: 'value_asc', label: 'Value: Low to High' },
  { value: 'type', label: 'Item Type' },
];

const STATUS_LABELS: Record<string, string> = {
  owned: 'Owned', sold: 'Sold', lent: 'Lent', consignment: 'On Consignment',
};

const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint', excellent: 'Excellent', good: 'Good', fair: 'Fair', project: 'Project',
};

const TYPE_LABELS: Record<string, string> = {
  katana: 'Katana', wakizashi: 'Wakizashi', tanto: 'Tanto', tachi: 'Tachi',
  naginata: 'Naginata', yari: 'Yari', ken: 'Ken',
  tsuba: 'Tsuba', kozuka: 'Kozuka', kogai: 'Kogai', menuki: 'Menuki',
  'fuchi-kashira': 'Fuchi-Kashira', koshirae: 'Koshirae',
  armor: 'Armor', helmet: 'Kabuto', tosogu: 'Tosogu',
};

// =============================================================================
// Sub-components
// =============================================================================

function FilterSection({ title, isOpen, onToggle, activeCount, children }: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  activeCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <button onClick={onToggle} className="flex items-center justify-between w-full text-left group">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted">{title}</span>
          {activeCount ? (
            <span className="min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold text-white bg-gold rounded-full flex items-center justify-center leading-none">
              {activeCount}
            </span>
          ) : null}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-muted/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[4000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
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
      <div className={`w-[15px] h-[15px] rounded-[2px] border flex items-center justify-center shrink-0 transition-all ${
        checked ? 'border-gold bg-gold shadow-[0_0_6px_rgba(181,142,78,0.3)]' : 'border-border group-hover:border-gold/40'
      }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-[12px] text-ink flex-1 truncate">{label}</span>
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    type: true,
    cert: true,
    status: false,
    condition: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeFilterCount = (filters.itemType ? 1 : 0) + (filters.certType ? 1 : 0) +
    (filters.status ? 1 : 0) + (filters.condition ? 1 : 0);

  const resetFilters = () => {
    onFilterChange({ itemType: undefined, certType: undefined, status: undefined, condition: undefined });
  };

  return (
    <div className="px-4 pb-4">
      {/* Sort */}
      <div className="pb-3 border-b border-border/15">
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.1em] font-medium text-muted/50 shrink-0">Sort</label>
          <select
            value={filters.sort || 'newest'}
            onChange={e => onFilterChange({ sort: e.target.value as CollectionFilters['sort'] })}
            className="flex-1 text-[12px] text-ink bg-transparent border-none focus:outline-none cursor-pointer font-medium"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-1.5 text-[10px] text-muted/40 tabular-nums">
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Filter Header */}
      <div className="py-2 border-b border-border/10 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.1em] font-medium text-muted/50">Filters</span>
          {activeFilterCount > 0 && (
            <span className="min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold bg-gold/80 text-white rounded-full flex items-center justify-center leading-none">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button onClick={resetFilters} className="text-[10px] text-muted/50 hover:text-gold transition-colors font-medium">
            Reset
          </button>
        )}
      </div>

      {/* Filter sections */}
      <div className="pt-0.5">
        {/* Item Type */}
        {facets.itemTypes.length > 0 && (
          <FilterSection
            title="Type"
            isOpen={openSections.type}
            onToggle={() => toggleSection('type')}
            activeCount={filters.itemType ? 1 : 0}
          >
            {facets.itemTypes.map(f => (
              <FilterCheckbox
                key={f.value}
                label={TYPE_LABELS[f.value] || f.value}
                count={f.count}
                checked={filters.itemType === f.value}
                onChange={() => onFilterChange({
                  itemType: filters.itemType === f.value ? undefined : f.value,
                })}
              />
            ))}
          </FilterSection>
        )}

        {/* Certification */}
        {facets.certifications.length > 0 && (
          <FilterSection
            title="Certification"
            isOpen={openSections.cert}
            onToggle={() => toggleSection('cert')}
            activeCount={filters.certType ? 1 : 0}
          >
            {facets.certifications.map(f => (
              <FilterCheckbox
                key={f.value}
                label={f.value}
                count={f.count}
                checked={filters.certType === f.value}
                onChange={() => onFilterChange({
                  certType: filters.certType === f.value ? undefined : f.value,
                })}
              />
            ))}
          </FilterSection>
        )}

        {/* Status */}
        {facets.statuses.length > 0 && (
          <FilterSection
            title="Status"
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
        )}

        {/* Condition */}
        {facets.conditions.length > 0 && (
          <FilterSection
            title="Condition"
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

      {/* Apply button (mobile drawer only) */}
      {onClose && (
        <div className="mt-4 pt-4 border-t border-border/20">
          <button
            onClick={onClose}
            className="w-full py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
          >
            Show {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </button>
        </div>
      )}
    </div>
  );
}
