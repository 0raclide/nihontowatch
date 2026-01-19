'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AnalyticsFilters, AnalyticsPeriod } from '@/types/analytics';
import { ANALYTICS_PERIODS, getPeriodLabel } from '@/types/analytics';

/**
 * Option type for filter dropdowns
 */
interface FilterOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Optional count indicator */
  count?: number;
}

/**
 * Props for the FilterBar component
 */
interface FilterBarProps {
  /** Current filter state */
  filters: AnalyticsFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: AnalyticsFilters) => void;
  /** Item type options for the dropdown */
  itemTypeOptions: FilterOption[];
  /** Certification options for the dropdown */
  certificationOptions: FilterOption[];
  /** Dealer options for the dropdown */
  dealerOptions: FilterOption[];
  /** Loading state - disables interactions */
  loading?: boolean;
}

/**
 * Period buttons that are shown in the filter bar
 */
const VISIBLE_PERIODS: AnalyticsPeriod[] = ['7d', '30d', '90d', '1y'];

/**
 * Dropdown component for filter selection
 */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string | number | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === String(value));
  const displayValue = selectedOption?.label || `All ${label}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
          ${
            value
              ? 'bg-gold/10 border-gold/30 text-gold'
              : 'bg-cream border-border text-charcoal hover:bg-linen'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className="truncate max-w-[120px]">{displayValue}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-paper border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {/* Clear option */}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className={`
              w-full text-left px-3 py-2 text-sm transition-colors
              ${!value ? 'bg-gold/10 text-gold' : 'text-charcoal hover:bg-hover'}
            `}
          >
            All {label}
          </button>

          <div className="border-t border-border" />

          {/* Options */}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between
                ${
                  String(value) === option.value
                    ? 'bg-gold/10 text-gold'
                    : 'text-charcoal hover:bg-hover'
                }
              `}
            >
              <span className="truncate">{option.label}</span>
              {option.count !== undefined && (
                <span className="text-xs text-muted ml-2 tabular-nums">
                  {option.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}

          {options.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted text-center">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Filter bar component for the analytics dashboard.
 * Provides period selection and dropdown filters for item type, certification, and dealer.
 *
 * Features:
 * - Period selector buttons (7d, 30d, 90d, 1y)
 * - Item type dropdown with counts
 * - Certification dropdown with counts
 * - Dealer dropdown with counts
 * - Clear all filters button
 * - Loading state handling
 *
 * @example
 * ```tsx
 * <FilterBar
 *   filters={filters}
 *   onFiltersChange={setFilters}
 *   itemTypeOptions={[
 *     { value: 'katana', label: 'Katana', count: 450 },
 *     { value: 'tsuba', label: 'Tsuba', count: 280 },
 *   ]}
 *   certificationOptions={[
 *     { value: 'juyo', label: 'Juyo', count: 85 },
 *     { value: 'hozon', label: 'Hozon', count: 320 },
 *   ]}
 *   dealerOptions={[
 *     { value: '1', label: 'Aoi Art', count: 150 },
 *     { value: '2', label: 'Eirakudo', count: 95 },
 *   ]}
 * />
 * ```
 */
export function FilterBar({
  filters,
  onFiltersChange,
  itemTypeOptions,
  certificationOptions,
  dealerOptions,
  loading = false,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.itemType !== null ||
    filters.certification !== null ||
    filters.dealerId !== null;

  const handlePeriodChange = (period: AnalyticsPeriod) => {
    onFiltersChange({ ...filters, period });
  };

  const handleItemTypeChange = (value: string | null) => {
    onFiltersChange({
      ...filters,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      itemType: value as any,
    });
  };

  const handleCertificationChange = (value: string | null) => {
    onFiltersChange({ ...filters, certification: value });
  };

  const handleDealerChange = (value: string | null) => {
    onFiltersChange({
      ...filters,
      dealerId: value ? parseInt(value, 10) : null,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      ...filters,
      itemType: null,
      certification: null,
      dealerId: null,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period selector */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        {VISIBLE_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => handlePeriodChange(period)}
            disabled={loading}
            className={`
              px-3 py-2 text-sm font-medium transition-colors
              ${
                filters.period === period
                  ? 'bg-gold text-white'
                  : 'bg-cream text-charcoal hover:bg-linen'
              }
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              border-r border-border last:border-r-0
            `}
          >
            {getPeriodLabel(period).replace('Last ', '')}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-border hidden sm:block" />

      {/* Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Item Type"
          value={filters.itemType}
          options={itemTypeOptions}
          onChange={handleItemTypeChange}
          disabled={loading}
        />

        <FilterDropdown
          label="Certification"
          value={filters.certification}
          options={certificationOptions}
          onChange={handleCertificationChange}
          disabled={loading}
        />

        <FilterDropdown
          label="Dealer"
          value={filters.dealerId}
          options={dealerOptions}
          onChange={handleDealerChange}
          disabled={loading}
        />
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearFilters}
          disabled={loading}
          className={`
            flex items-center gap-1 px-3 py-2 text-sm text-muted hover:text-ink transition-colors
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Clear filters
        </button>
      )}
    </div>
  );
}
