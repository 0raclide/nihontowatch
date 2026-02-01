'use client';

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { GrowthDataPoint } from '@/hooks/useUserEngagement';
import { ChartSkeleton } from './ChartSkeleton';

/**
 * Props for the UserGrowthChart component
 */
interface UserGrowthChartProps {
  /** Time series data points showing user growth */
  dataPoints: GrowthDataPoint[];
  /** Loading state - shows skeleton */
  loading?: boolean;
  /** Chart height in pixels (default: 300) */
  height?: number;
  /** Whether to show cumulative users line (default: true) */
  showCumulative?: boolean;
}

/**
 * Format date for X-axis display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format number with compact notation
 */
function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Custom tooltip component for the growth chart
 */
function CustomTooltip({
  active,
  payload,
  showCumulative,
}: {
  active?: boolean;
  payload?: Array<{
    payload: GrowthDataPoint;
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
  showCumulative: boolean;
}) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted mb-2">
        {new Date(data.date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-accent" />
          <span className="text-sm text-ink">
            New users: <span className="font-medium">{data.newUsers.toLocaleString()}</span>
          </span>
        </div>
        {showCumulative && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gold" />
            <span className="text-sm text-ink">
              Total users: <span className="font-medium">{data.cumulativeUsers.toLocaleString()}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Empty state when no data is available
 */
function EmptyState({ height }: { height: number }) {
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
            d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-muted text-sm">No growth data available</p>
      </div>
    </div>
  );
}

/**
 * User growth chart showing new signups over time.
 * Uses Recharts ComposedChart with bars for daily new users
 * and an optional line for cumulative totals.
 *
 * Features:
 * - Bar chart for daily new users (left Y axis)
 * - Line chart for cumulative users (right Y axis, optional)
 * - Custom tooltip showing both values
 * - Loading skeleton state
 * - Empty state handling
 * - Responsive with ResponsiveContainer
 *
 * @example
 * ```tsx
 * <UserGrowthChart
 *   dataPoints={growthData.dataPoints}
 *   loading={loading.growth}
 *   showCumulative={true}
 *   height={300}
 * />
 * ```
 */
export function UserGrowthChart({
  dataPoints,
  loading = false,
  height = 300,
  showCumulative = true,
}: UserGrowthChartProps) {
  if (loading) {
    return <ChartSkeleton height={height} type="bar" />;
  }

  if (!dataPoints || dataPoints.length === 0) {
    return <EmptyState height={height} />;
  }

  // Transform data with formatted dates
  const chartData = dataPoints.map((point) => ({
    ...point,
    formattedDate: formatDate(point.date),
  }));

  return (
    <div className="bg-cream rounded-lg border border-border p-4">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: showCumulative ? 60 : 20, left: 0, bottom: 20 }}
        >
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          {/* Left Y-axis for new users (bar) */}
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCompactNumber}
            width={40}
          />

          {/* Right Y-axis for cumulative users (line) */}
          {showCumulative && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactNumber}
              width={50}
            />
          )}

          <Tooltip content={<CustomTooltip showCumulative={showCumulative} />} />

          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-muted">{value}</span>
            )}
          />

          {/* Bar chart for new users */}
          <Bar
            yAxisId="left"
            dataKey="newUsers"
            name="New Users"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />

          {/* Line chart for cumulative users */}
          {showCumulative && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativeUsers"
              name="Total Users"
              stroke="var(--gold)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--gold)' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
