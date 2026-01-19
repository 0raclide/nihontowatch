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
} from 'recharts';
import type { DealerMetrics } from '@/types/analytics';
import { formatCurrency } from '@/lib/analytics/statistics';
import { ChartSkeleton } from './ChartSkeleton';

/**
 * Props for the DealerMarketShareChart component
 */
interface DealerMarketShareChartProps {
  /** Array of dealer metrics to display */
  dealers: DealerMetrics[];
  /** Which metric to show: listing count or total value */
  metric: 'count' | 'value';
  /** Maximum number of dealers to display (default: 10) */
  limit?: number;
  /** Chart height in pixels (default: 400) */
  height?: number;
  /** Loading state - shows skeleton */
  loading?: boolean;
}

/**
 * Custom tooltip component for the dealer chart
 */
function CustomTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: DealerMetrics & { displayShare: number } }>;
  metric: 'count' | 'value';
}) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-ink mb-2">{data.dealerName}</p>
      <div className="space-y-1 text-xs">
        <p className="text-charcoal">
          <span className="text-muted">Listings:</span>{' '}
          <span className="font-medium tabular-nums">{data.availableCount.toLocaleString()}</span>
        </p>
        <p className="text-charcoal">
          <span className="text-muted">Total Value:</span>{' '}
          <span className="font-medium tabular-nums">
            {formatCurrency(data.totalValueJPY, 'JPY', { compact: true })}
          </span>
        </p>
        <p className="text-charcoal">
          <span className="text-muted">
            {metric === 'count' ? 'Count Share' : 'Value Share'}:
          </span>{' '}
          <span className="font-medium tabular-nums">
            {((metric === 'count' ? data.countShare : data.valueShare) * 100).toFixed(1)}%
          </span>
        </p>
        <p className="text-charcoal">
          <span className="text-muted">Avg Price:</span>{' '}
          <span className="font-medium tabular-nums">
            {formatCurrency(data.avgPriceJPY, 'JPY', { compact: true })}
          </span>
        </p>
        <p className="text-charcoal">
          <span className="text-muted">Median Price:</span>{' '}
          <span className="font-medium tabular-nums">
            {formatCurrency(data.medianPriceJPY, 'JPY', { compact: true })}
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * Dealer market share horizontal bar chart.
 * Visualizes market share by dealer, sorted by share descending.
 *
 * Features:
 * - Horizontal bar chart for easy name reading
 * - Toggle between count and value metrics
 * - Automatic "Others" aggregation for dealers beyond limit
 * - Tooltip with full dealer details
 * - Gradient coloring by rank
 *
 * @example
 * ```tsx
 * <DealerMarketShareChart
 *   dealers={dealerData}
 *   metric="value"
 *   limit={10}
 * />
 * ```
 */
export function DealerMarketShareChart({
  dealers,
  metric,
  limit = 10,
  height = 400,
  loading = false,
}: DealerMarketShareChartProps) {
  if (loading) {
    return <ChartSkeleton height={height} type="bar" />;
  }

  if (!dealers || dealers.length === 0) {
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <p className="text-muted text-sm">No dealer data available</p>
        </div>
      </div>
    );
  }

  // Sort by the selected metric and limit
  const sortedDealers = [...dealers].sort((a, b) => {
    const aValue = metric === 'count' ? a.countShare : a.valueShare;
    const bValue = metric === 'count' ? b.countShare : b.valueShare;
    return bValue - aValue;
  });

  // Take top dealers and aggregate the rest as "Others"
  const topDealers = sortedDealers.slice(0, limit);
  const otherDealers = sortedDealers.slice(limit);

  let chartData: Array<DealerMetrics & { displayShare: number; isOthers?: boolean }> = topDealers.map((dealer) => ({
    ...dealer,
    displayShare: (metric === 'count' ? dealer.countShare : dealer.valueShare) * 100,
  }));

  // Add "Others" aggregation if there are more dealers
  if (otherDealers.length > 0) {
    const othersMetrics: DealerMetrics & { displayShare: number; isOthers: boolean } = {
      dealerId: -1,
      dealerName: `Others (${otherDealers.length})`,
      totalCount: otherDealers.reduce((sum, d) => sum + d.totalCount, 0),
      availableCount: otherDealers.reduce((sum, d) => sum + d.availableCount, 0),
      totalValueJPY: otherDealers.reduce((sum, d) => sum + d.totalValueJPY, 0),
      medianPriceJPY: otherDealers.length > 0
        ? otherDealers.reduce((sum, d) => sum + d.medianPriceJPY, 0) / otherDealers.length
        : 0,
      avgPriceJPY: otherDealers.length > 0
        ? otherDealers.reduce((sum, d) => sum + d.avgPriceJPY, 0) / otherDealers.length
        : 0,
      countShare: otherDealers.reduce((sum, d) => sum + d.countShare, 0),
      valueShare: otherDealers.reduce((sum, d) => sum + d.valueShare, 0),
      displayShare:
        otherDealers.reduce(
          (sum, d) => sum + (metric === 'count' ? d.countShare : d.valueShare),
          0
        ) * 100,
      isOthers: true,
    };
    chartData.push(othersMetrics);
  }

  // Calculate bar height based on number of items
  const barHeight = Math.max(28, Math.min(40, height / (chartData.length + 2)));
  const dynamicHeight = barHeight * chartData.length + 60;

  // Color gradient from gold to muted
  const getBarColor = (index: number, total: number, isOthers?: boolean) => {
    if (isOthers) return 'var(--text-muted)';
    const opacity = 1 - (index / total) * 0.5;
    return `rgba(184, 134, 11, ${opacity})`; // Gold with decreasing opacity
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(height, dynamicHeight)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(0)}%`}
          domain={[0, 'auto']}
        />
        <YAxis
          type="category"
          dataKey="dealerName"
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          tickLine={false}
          axisLine={false}
          width={95}
        />
        <Tooltip content={<CustomTooltip metric={metric} />} />
        <Bar dataKey="displayShare" radius={[0, 4, 4, 0]} barSize={barHeight - 8}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getBarColor(index, chartData.length, entry.isOthers)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
