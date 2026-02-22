'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';

// =============================================================================
// TYPES
// =============================================================================

interface SessionBucket {
  label: string;
  rangeStartMs: number;
  rangeEndMs: number;
  count: number;
  percentage: number;
  cumulativePercentage: number;
}

interface SessionStatistics {
  median: number;
  mean: number;
  p25: number;
  p75: number;
  totalSessions: number;
  sessionsWithData: number;
}

interface SessionDistributionChartProps {
  buckets: SessionBucket[];
  statistics: SessionStatistics;
  height?: number;
  loading?: boolean;
}

// =============================================================================
// TOOLTIP
// =============================================================================

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SessionBucket }>;
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
          <span className="font-medium tabular-nums">
            {data.cumulativePercentage.toFixed(1)}%
          </span>
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDurationStat(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SessionDistributionChart({
  buckets,
  statistics,
  height = 300,
  loading = false,
}: SessionDistributionChartProps) {
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-muted text-sm">No session data available</p>
        </div>
      </div>
    );
  }

  // Find the bucket containing the median for the reference line
  const medianMs = statistics.median * 1000;
  const medianBucket = buckets.find(
    (b) => medianMs >= b.rangeStartMs && medianMs < b.rangeEndMs
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={buckets}
          margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          {medianBucket && (
            <ReferenceLine
              x={medianBucket.label}
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
            fill="var(--accent)"
            fillOpacity={0.7}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Statistics Summary */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Median</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatDurationStat(statistics.median)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Mean</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatDurationStat(statistics.mean)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">P25</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatDurationStat(statistics.p25)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">P75</p>
            <p className="text-sm font-serif text-ink mt-1 tabular-nums">
              {formatDurationStat(statistics.p75)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
