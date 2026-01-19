'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import type { TrendDataPoint, TrendSummary, TrendLine } from '@/types/analytics';
import { formatCompactNumber, formatCurrency } from '@/lib/analytics/statistics';
import { ChartSkeleton } from './ChartSkeleton';

/**
 * Props for the TrendLineChart component
 */
interface TrendLineChartProps {
  /** Time series data points */
  dataPoints: TrendDataPoint[];
  /** Summary statistics for the trend */
  summary: TrendSummary;
  /** Optional linear regression trend line */
  trendLine?: TrendLine;
  /** Whether to display the trend line overlay */
  showTrendLine?: boolean;
  /** Metric name for axis label and formatting */
  metric: string;
  /** Chart height in pixels (default: 300) */
  height?: number;
  /** Loading state - shows skeleton */
  loading?: boolean;
}

/**
 * Format date for X-axis display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format value based on metric type
 */
function formatMetricValue(value: number, metric: string): string {
  if (metric.includes('price') || metric.includes('value')) {
    return formatCurrency(value, 'JPY', { compact: true });
  }
  return formatCompactNumber(value);
}

/**
 * Custom tooltip component for the trend chart
 */
function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendDataPoint }>;
  label?: string;
  metric: string;
}) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;
  const isPositive = data.changePercent > 0;
  const isNegative = data.changePercent < 0;

  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted mb-2">
        {new Date(data.date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <p className="text-sm font-medium text-ink mb-1">
        {formatMetricValue(data.value, metric)}
      </p>
      {data.changePercent !== 0 && (
        <p
          className={`text-xs ${
            isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-muted'
          }`}
        >
          {isPositive ? '+' : ''}
          {data.changePercent.toFixed(1)}% from previous
        </p>
      )}
    </div>
  );
}

/**
 * Trend direction icon
 */
function TrendIcon({ direction }: { direction: 'up' | 'down' | 'stable' }) {
  if (direction === 'up') {
    return (
      <svg
        className="w-4 h-4 text-success"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg
        className="w-4 h-4 text-error"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-4 h-4 text-muted"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 12h14"
      />
    </svg>
  );
}

/**
 * Time series trend line chart.
 * Visualizes metric changes over time with optional trend line overlay.
 *
 * Features:
 * - Line chart with date on X axis, value on Y axis
 * - Optional trend line overlay (dashed)
 * - Area fill under the line for visual weight
 * - Tooltip with date, value, and change from previous
 * - Summary stats with trend direction indicator
 *
 * @example
 * ```tsx
 * <TrendLineChart
 *   dataPoints={trendData.dataPoints}
 *   summary={trendData.summary}
 *   trendLine={trendData.trendLine}
 *   showTrendLine
 *   metric="median_price"
 * />
 * ```
 */
export function TrendLineChart({
  dataPoints,
  summary,
  trendLine,
  showTrendLine = false,
  metric,
  height = 300,
  loading = false,
}: TrendLineChartProps) {
  if (loading) {
    return <ChartSkeleton height={height} type="line" />;
  }

  if (!dataPoints || dataPoints.length === 0) {
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
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
          <p className="text-muted text-sm">No trend data available</p>
        </div>
      </div>
    );
  }

  // Calculate trend line points if provided
  const chartData = dataPoints.map((point, index) => ({
    ...point,
    formattedDate: formatDate(point.date),
    trendValue:
      showTrendLine && trendLine
        ? trendLine.intercept + trendLine.slope * index
        : undefined,
  }));

  const isPositiveChange = summary.totalChangePercent > 0;
  const isNegativeChange = summary.totalChangePercent < 0;

  return (
    <div>
      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatMetricValue(value, metric)}
            width={50}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          {/* Mean reference line */}
          <ReferenceLine
            y={(summary.startValue + summary.endValue) / 2}
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
          {/* Area fill */}
          <Area
            type="monotone"
            dataKey="value"
            fill="url(#areaGradient)"
            stroke="none"
          />
          {/* Main value line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent)' }}
          />
          {/* Trend line overlay */}
          {showTrendLine && trendLine && (
            <Line
              type="monotone"
              dataKey="trendValue"
              stroke="var(--text-muted)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Trend indicator */}
          <div className="flex items-center gap-2">
            <TrendIcon direction={summary.trend} />
            <span
              className={`text-sm font-medium ${
                isPositiveChange
                  ? 'text-success'
                  : isNegativeChange
                  ? 'text-error'
                  : 'text-muted'
              }`}
            >
              {isPositiveChange ? '+' : ''}
              {summary.totalChangePercent.toFixed(1)}%
            </span>
            <span className="text-xs text-muted">over period</span>
          </div>

          {/* Stats row */}
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted">Start</p>
              <p className="text-sm font-serif text-ink tabular-nums">
                {formatMetricValue(summary.startValue, metric)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">End</p>
              <p className="text-sm font-serif text-ink tabular-nums">
                {formatMetricValue(summary.endValue, metric)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">High</p>
              <p className="text-sm font-serif text-ink tabular-nums">
                {formatMetricValue(summary.maxValue, metric)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Low</p>
              <p className="text-sm font-serif text-ink tabular-nums">
                {formatMetricValue(summary.minValue, metric)}
              </p>
            </div>
          </div>

          {/* R-squared if trend line is shown */}
          {showTrendLine && trendLine && (
            <div className="text-xs text-muted">
              R<sup>2</sup>: {trendLine.rSquared.toFixed(3)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
