'use client';

import React from 'react';
import type { FunnelStage } from '@/hooks/useUserEngagement';

/**
 * Props for the ConversionFunnelChart component
 */
interface ConversionFunnelChartProps {
  /** Array of funnel stages with conversion data */
  stages: FunnelStage[];
  /** Loading state - shows skeleton */
  loading?: boolean;
  /** Chart height in pixels (default: 400) */
  height?: number;
}

/**
 * Skeleton for funnel chart loading state
 */
function FunnelSkeleton({ height }: { height: number }) {
  const skeletonStages = [100, 75, 55, 35, 20, 10];

  return (
    <div
      className="bg-linen/50 rounded-lg border border-border/50 overflow-hidden p-6"
      style={{ height }}
    >
      <div className="space-y-4">
        {skeletonStages.map((width, index) => (
          <div key={index} className="flex items-center gap-4">
            {/* Label skeleton */}
            <div
              className="h-4 w-24 bg-linen rounded animate-shimmer flex-shrink-0"
              style={{ animationDelay: `${index * 0.1}s` }}
            />
            {/* Bar skeleton */}
            <div className="flex-1 flex items-center gap-2">
              <div
                className="h-8 bg-linen rounded animate-shimmer"
                style={{
                  width: `${width}%`,
                  animationDelay: `${index * 0.1}s`,
                }}
              />
              {/* Count skeleton */}
              <div
                className="h-4 w-12 bg-linen rounded animate-shimmer flex-shrink-0"
                style={{ animationDelay: `${index * 0.1}s` }}
              />
            </div>
          </div>
        ))}
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
            d="M3 4h18M3 8h14M3 12h10M3 16h6"
          />
        </svg>
        <p className="text-muted text-sm">No funnel data available</p>
      </div>
    </div>
  );
}

/**
 * Get color class based on conversion rate
 */
function getConversionColor(rate: number): string {
  if (rate >= 50) return 'bg-green-500';
  if (rate >= 20) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Get text color class based on conversion rate
 */
function getConversionTextColor(rate: number): string {
  if (rate >= 50) return 'text-green-500';
  if (rate >= 20) return 'text-yellow-500';
  return 'text-red-500';
}

/**
 * Format large numbers with K/M suffix
 */
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

/**
 * Conversion funnel chart showing user progression through stages.
 * Displays horizontal bars with counts and conversion rates.
 *
 * Features:
 * - Horizontal bars showing count at each stage
 * - Percentage labels showing conversion rate from first stage
 * - Color coding: green (>50%), yellow (>20%), red (<20%)
 * - Dropoff indicators between stages
 * - Loading skeleton state
 * - Empty state handling
 *
 * @example
 * ```tsx
 * <ConversionFunnelChart
 *   stages={funnelData.stages}
 *   loading={loading.funnel}
 *   height={400}
 * />
 * ```
 */
export function ConversionFunnelChart({
  stages,
  loading = false,
  height = 400,
}: ConversionFunnelChartProps) {
  if (loading) {
    return <FunnelSkeleton height={height} />;
  }

  if (!stages || stages.length === 0) {
    return <EmptyState height={height} />;
  }

  // Get the max count for scaling bars
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div
      className="bg-cream rounded-lg border border-border p-6"
      style={{ minHeight: height }}
    >
      <div className="space-y-1">
        {stages.map((stage, index) => {
          const barWidth = Math.max((stage.count / maxCount) * 100, 2);
          const colorClass = getConversionColor(stage.conversionRate);
          const textColorClass = getConversionTextColor(stage.conversionRate);

          return (
            <div key={stage.stage}>
              {/* Stage row */}
              <div className="flex items-center gap-4 py-2">
                {/* Label */}
                <div className="w-28 flex-shrink-0">
                  <p className="text-sm font-medium text-ink">{stage.label}</p>
                </div>

                {/* Bar container */}
                <div className="flex-1 flex items-center gap-3">
                  {/* Bar */}
                  <div className="flex-1 h-8 bg-linen rounded-md overflow-hidden">
                    <div
                      className={`h-full ${colorClass} transition-all duration-500 ease-out rounded-md`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Count */}
                  <div className="w-16 text-right flex-shrink-0">
                    <span className="text-sm font-serif text-ink tabular-nums">
                      {formatCount(stage.count)}
                    </span>
                  </div>

                  {/* Conversion rate */}
                  <div className="w-14 text-right flex-shrink-0">
                    <span className={`text-sm font-medium ${textColorClass}`}>
                      {stage.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Dropoff indicator between stages */}
              {index < stages.length - 1 && stage.dropoffRate > 0 && (
                <div className="flex items-center gap-4 py-1 ml-28">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                    <span>
                      {stage.dropoffRate.toFixed(1)}% dropoff
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center gap-6 text-xs text-muted">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Excellent (50%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Average (20-50%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Needs Improvement (&lt;20%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
