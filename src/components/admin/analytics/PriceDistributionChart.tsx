'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { PriceBucket, PriceStatistics } from '@/types/analytics';
import { formatCompactNumber, formatCurrency } from '@/lib/analytics/statistics';
import { ChartSkeleton } from './ChartSkeleton';

/**
 * Props for the PriceDistributionChart component
 */
interface PriceDistributionChartProps {
  /** Histogram buckets for the price distribution */
  buckets: PriceBucket[];
  /** Statistical summary of the price data */
  statistics: PriceStatistics;
  /** Whether to highlight the median line on the chart */
  highlightMedian?: boolean;
  /** Callback when a bucket is clicked */
  onBucketClick?: (bucket: PriceBucket) => void;
  /** Chart height in pixels (default: 300) */
  height?: number;
  /** Loading state - shows skeleton */
  loading?: boolean;
}

/**
 * Custom tooltip component for the price distribution chart
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PriceBucket }>;
}) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-medium text-ink mb-2">{data.label}</p>
      <div className="space-y-1 text-xs">
        <p className="text-charcoal">
          <span className="text-muted">Count:</span>{' '}
          <span className="font-medium tabular-nums">{data.count.toLocaleString()}</span>
        </p>
        <p className="text-charcoal">
          <span className="text-muted">Share:</span>{' '}
          <span className="font-medium tabular-nums">{data.percentage.toFixed(1)}%</span>
        </p>
        <p className="text-charcoal">
          <span className="text-muted">Cumulative:</span>{' '}
          <span className="font-medium tabular-nums">{data.cumulativePercentage.toFixed(1)}%</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Format bucket label for X-axis display
 * Converts full range labels to shortened versions
 */
function formatBucketLabel(label: string): string {
  // If label already uses compact notation, return as-is
  if (label.includes('K') || label.includes('M') || label.includes('B')) {
    return label;
  }
  // Try to extract numbers and format them compactly
  const match = label.match(/([0-9,]+)\s*-\s*([0-9,]+)/);
  if (match) {
    const start = parseInt(match[1].replace(/,/g, ''), 10);
    const end = parseInt(match[2].replace(/,/g, ''), 10);
    return `${formatCompactNumber(start)}-${formatCompactNumber(end)}`;
  }
  return label;
}

/**
 * Price distribution histogram chart.
 * Visualizes the distribution of listing prices across price ranges.
 *
 * Features:
 * - Bar chart showing count per price range
 * - Optional median line indicator
 * - Tooltip with count, percentage, and cumulative percentage
 * - Statistics summary below chart
 * - Click handler for bucket selection
 *
 * @example
 * ```tsx
 * <PriceDistributionChart
 *   buckets={priceData.buckets}
 *   statistics={priceData.statistics}
 *   highlightMedian
 *   onBucketClick={(bucket) => console.log('Selected:', bucket)}
 * />
 * ```
 */
export function PriceDistributionChart({
  buckets,
  statistics,
  highlightMedian = false,
  onBucketClick,
  height = 300,
  loading = false,
}: PriceDistributionChartProps) {
  if (loading) {
    return <ChartSkeleton height={height} type="bar" />;
  }

  if (!buckets || buckets.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-linen rounded-lg border border-border border-dashed"
        style={{ height }}
      >
        <div className="text-center">
          <svg
            className="w-12 h-12 text-muted mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-muted text-sm">No price data available</p>
        </div>
      </div>
    );
  }

  // Find which bucket contains the median for highlighting
  const medianBucketIndex = buckets.findIndex(
    (bucket) =>
      statistics.median >= bucket.rangeStart && statistics.median < bucket.rangeEnd
  );

  // Format data for the chart
  const chartData = buckets.map((bucket, index) => ({
    ...bucket,
    shortLabel: formatBucketLabel(bucket.label),
    isMedian: index === medianBucketIndex,
  }));

  return (
    <div>
      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 0, bottom: 60 }}
        >
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCompactNumber(value)}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          {highlightMedian && (
            <ReferenceLine
              x={chartData[medianBucketIndex]?.shortLabel}
              stroke="var(--accent)"
              strokeDasharray="4 4"
              label={{
                value: 'Median',
                position: 'top',
                fill: 'var(--accent)',
                fontSize: 10,
              }}
            />
          )}
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            cursor={onBucketClick ? 'pointer' : 'default'}
            onClick={(data) => onBucketClick?.(data as unknown as PriceBucket)}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  highlightMedian && entry.isMedian
                    ? 'var(--accent)'
                    : 'var(--accent)'
                }
                fillOpacity={highlightMedian && entry.isMedian ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Statistics Summary */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Median</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatCurrency(statistics.median, 'JPY', { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">P25</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatCurrency(statistics.percentiles.p25, 'JPY', { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">P75</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatCurrency(statistics.percentiles.p75, 'JPY', { compact: true })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Std Dev</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatCurrency(statistics.stdDev, 'JPY', { compact: true })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
