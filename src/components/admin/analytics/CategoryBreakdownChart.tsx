'use client';

import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Sector,
} from 'recharts';
import type { CategoryMetrics } from '@/types/analytics';
import { formatCurrency } from '@/lib/analytics/statistics';
import { ChartSkeleton } from './ChartSkeleton';

/**
 * Props for the CategoryBreakdownChart component
 */
interface CategoryBreakdownChartProps {
  /** Array of category metrics to display */
  categories: CategoryMetrics[];
  /** Which metric to show: listing count or total value */
  metric: 'count' | 'value';
  /** Whether to show the legend (default: true) */
  showLegend?: boolean;
  /** Chart height in pixels (default: 300) */
  height?: number;
  /** Loading state - shows skeleton */
  loading?: boolean;
}

/**
 * Consistent color palette for categories
 * Using earthy, muted tones that fit the nihontowatch aesthetic
 */
const CATEGORY_COLORS: Record<string, string> = {
  katana: '#B8860B', // Gold
  wakizashi: '#8B7355', // Warm brown
  tanto: '#6B8E23', // Olive
  tachi: '#708090', // Slate
  tsuba: '#8B4513', // Saddle brown
  kozuka: '#556B2F', // Dark olive
  menuki: '#9D7B5A', // Caramel
  'fuchi-kashira': '#7B6B5A', // Taupe
  koshirae: '#5D6B7A', // Blue gray
  armor: '#8B6914', // Dark gold
  kabuto: '#6A5F4B', // Bronze
  naginata: '#7A8A6A', // Sage
  yari: '#8A7A6A', // Warm gray
  other: '#A0A0A0', // Gray
};

/**
 * Get color for a category, with fallback
 */
function getCategoryColor(itemType: string): string {
  const normalized = itemType.toLowerCase().replace(/_/g, '-');
  return CATEGORY_COLORS[normalized] || CATEGORY_COLORS.other;
}

/**
 * Custom tooltip component for the pie chart
 */
function CustomTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategoryMetrics & { fill: string } }>;
  metric: 'count' | 'value';
}) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: data.fill }}
        />
        <p className="text-sm font-medium text-ink">{data.displayName}</p>
      </div>
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
 * Custom legend component
 */
function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-charcoal">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Active shape renderer for hover effect
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderActiveShape(props: any) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
  } = props as {
    cx: number;
    cy: number;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    fill: string;
    payload: { displayName: string };
    percent: number;
  };

  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill="var(--text-primary)"
        className="text-sm font-medium"
      >
        {payload.displayName}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="var(--text-secondary)"
        className="text-xs"
      >
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
    </g>
  );
}

/**
 * Category breakdown donut chart.
 * Visualizes market share by item category (e.g., Katana, Tsuba, etc.).
 *
 * Features:
 * - Donut chart showing distribution
 * - Toggle between count and value metrics
 * - Interactive hover state with expanded segment
 * - Color-coded segments with consistent palette
 * - Optional legend
 *
 * @example
 * ```tsx
 * <CategoryBreakdownChart
 *   categories={categoryData}
 *   metric="value"
 *   showLegend
 * />
 * ```
 */
export function CategoryBreakdownChart({
  categories,
  metric,
  showLegend = true,
  height = 300,
  loading = false,
}: CategoryBreakdownChartProps) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  if (loading) {
    return <ChartSkeleton height={height} type="pie" />;
  }

  if (!categories || categories.length === 0) {
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
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
          <p className="text-muted text-sm">No category data available</p>
        </div>
      </div>
    );
  }

  // Prepare chart data with colors
  const chartData = categories
    .filter((cat) => (metric === 'count' ? cat.availableCount > 0 : cat.totalValueJPY > 0))
    .map((cat) => ({
      ...cat,
      value: metric === 'count' ? cat.availableCount : cat.totalValueJPY,
      fill: getCategoryColor(cat.itemType),
    }))
    .sort((a, b) => b.value - a.value);

  const handleMouseEnter = (_: unknown, index: number) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(-1);
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            nameKey="displayName"
            // @ts-expect-error Recharts 3.x has typing issues with activeShape/activeIndex
            activeIndex={activeIndex >= 0 ? activeIndex : undefined}
            activeShape={renderActiveShape}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip metric={metric} />} />
          {showLegend && <Legend content={<CustomLegend />} />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
