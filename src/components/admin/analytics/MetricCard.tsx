'use client';

import React from 'react';

/**
 * Props for the MetricCard component
 */
interface MetricCardProps {
  /** Card title (displayed in small caps) */
  title: string;
  /** Main value to display (can be pre-formatted string or number) */
  value: string | number;
  /** Optional subtitle for additional context */
  subtitle?: string;
  /** Optional icon displayed in the top right */
  icon?: React.ReactNode;
  /** Optional change indicator showing period-over-period comparison */
  change?: {
    /** Absolute change value */
    value: number;
    /** Percentage change */
    percent: number;
    /** Period label (e.g., "vs last week") */
    period: string;
  };
  /** Value format type for automatic formatting */
  format?: 'currency' | 'number' | 'percent';
  /** Currency for currency format (default: JPY) */
  currency?: 'JPY' | 'USD' | 'EUR';
  /** Loading state - shows skeleton */
  loading?: boolean;
}

/**
 * Format a number based on the specified format type
 */
function formatValue(
  value: string | number,
  format?: 'currency' | 'number' | 'percent',
  currency: 'JPY' | 'USD' | 'EUR' = 'JPY'
): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency': {
      const symbols: Record<string, string> = {
        JPY: '\u00A5',
        USD: '$',
        EUR: '\u20AC',
      };
      const symbol = symbols[currency];
      // Use compact notation for large values
      if (Math.abs(value) >= 1000000000) {
        const b = value / 1000000000;
        return `${symbol}${b.toFixed(1)}B`;
      }
      if (Math.abs(value) >= 1000000) {
        const m = value / 1000000;
        return `${symbol}${m.toFixed(1)}M`;
      }
      if (Math.abs(value) >= 1000) {
        const k = value / 1000;
        return `${symbol}${k.toFixed(1)}K`;
      }
      return `${symbol}${value.toLocaleString()}`;
    }
    case 'number':
      if (Math.abs(value) >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (Math.abs(value) >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return typeof value === 'number' ? value.toLocaleString() : String(value);
  }
}

/**
 * Up arrow icon for positive changes
 */
function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      width="16"
      height="16"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 17l5-5 5 5M7 11l5-5 5 5"
      />
    </svg>
  );
}

/**
 * Down arrow icon for negative changes
 */
function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      width="16"
      height="16"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 7l-5 5-5-5M17 13l-5 5-5-5"
      />
    </svg>
  );
}

/**
 * Enhanced metric card with optional change indicator.
 * Used for displaying key statistics on the analytics dashboard.
 *
 * @example
 * ```tsx
 * <MetricCard
 *   title="Total Market Value"
 *   value={1500000000}
 *   format="currency"
 *   currency="JPY"
 *   change={{ value: 50000000, percent: 3.5, period: "vs last month" }}
 *   icon={<ChartIcon />}
 * />
 * ```
 */
export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  change,
  format,
  currency = 'JPY',
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-cream rounded-xl p-6 border border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Title skeleton */}
            <div className="h-3 w-24 bg-linen rounded animate-shimmer" />
            {/* Value skeleton */}
            <div className="h-9 w-32 bg-linen rounded mt-3 animate-shimmer" />
            {/* Subtitle skeleton */}
            <div className="h-3 w-20 bg-linen rounded mt-2 animate-shimmer" />
          </div>
          {/* Icon skeleton */}
          <div className="w-12 h-12 bg-linen rounded-lg animate-shimmer" />
        </div>
      </div>
    );
  }

  const formattedValue = formatValue(value, format, currency);
  const isPositiveChange = change && change.percent > 0;
  const isNegativeChange = change && change.percent < 0;

  return (
    <div className="bg-cream rounded-xl p-6 border border-border">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-xs uppercase tracking-wider text-muted font-medium">
            {title}
          </p>

          {/* Value */}
          <p className="text-3xl font-serif text-ink mt-2 tabular-nums">
            {formattedValue}
          </p>

          {/* Change indicator */}
          {change && (
            <div className="flex items-center gap-1.5 mt-2">
              {isPositiveChange && (
                <>
                  <ArrowUpIcon className="text-success" />
                  <span className="text-xs font-medium text-success">
                    +{Math.abs(change.percent).toFixed(1)}%
                  </span>
                </>
              )}
              {isNegativeChange && (
                <>
                  <ArrowDownIcon className="text-error" />
                  <span className="text-xs font-medium text-error">
                    {change.percent.toFixed(1)}%
                  </span>
                </>
              )}
              {change.percent === 0 && (
                <span className="text-xs font-medium text-muted">0%</span>
              )}
              <span className="text-xs text-muted">{change.period}</span>
            </div>
          )}

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div className="p-3 bg-gold/10 rounded-lg text-gold flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
