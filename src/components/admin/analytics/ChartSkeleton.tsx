'use client';

import React from 'react';

/**
 * Props for the ChartSkeleton component
 */
interface ChartSkeletonProps {
  /** Height of the skeleton in pixels (default: 300) */
  height?: number;
  /** Type of chart skeleton to render */
  type?: 'bar' | 'line' | 'pie';
}

/**
 * Bar chart skeleton with animated bars
 */
function BarChartSkeleton({ height }: { height: number }) {
  // Generate varying heights for skeleton bars
  const barHeights = [65, 80, 45, 90, 55, 75, 40, 85, 60, 70];

  return (
    <div className="flex items-end justify-between gap-2 px-10 pb-10 pt-5" style={{ height }}>
      {barHeights.map((barHeight, index) => (
        <div
          key={index}
          className="flex-1 bg-linen rounded-t animate-shimmer"
          style={{
            height: `${barHeight}%`,
            animationDelay: `${index * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Line chart skeleton with animated wave
 */
function LineChartSkeleton({ height }: { height: number }) {
  return (
    <div className="relative px-10 py-5" style={{ height }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-5 bottom-10 w-8 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-3 w-6 bg-linen rounded animate-shimmer"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      {/* Chart area */}
      <div className="ml-10 h-full relative">
        {/* Grid lines */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-border/30"
            style={{ top: `${(i / 3) * 100}%` }}
          />
        ))}

        {/* Animated line path */}
        <svg
          className="absolute inset-0 w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--surface)" />
              <stop offset="50%" stopColor="var(--border)" />
              <stop offset="100%" stopColor="var(--surface)" />
              <animate
                attributeName="x1"
                values="-1;1"
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="x2"
                values="0;2"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>
          <path
            d="M 0 70 Q 25 50, 50 60 T 100 40 T 150 55 T 200 35 T 250 45 T 300 30"
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="absolute left-10 right-0 bottom-0 h-5 flex justify-between">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-3 w-8 bg-linen rounded animate-shimmer"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Pie/donut chart skeleton
 */
function PieChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4"
      style={{ height }}
    >
      {/* Donut shape */}
      <div className="relative">
        <div
          className="rounded-full border-[24px] border-linen animate-pulse"
          style={{ width: 160, height: 160 }}
        />
        {/* Inner circle for donut hole */}
        <div
          className="absolute inset-0 m-auto rounded-full bg-cream"
          style={{ width: 112, height: 112 }}
        />
      </div>

      {/* Legend skeleton */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full bg-linen animate-shimmer"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
            <div
              className="h-3 w-16 bg-linen rounded animate-shimmer"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton component for charts.
 * Renders an appropriate skeleton based on the chart type.
 *
 * Features:
 * - Bar chart skeleton with animated bars
 * - Line chart skeleton with animated wave path
 * - Pie/donut chart skeleton with legend
 * - Consistent shimmer animation
 *
 * @example
 * ```tsx
 * // Bar chart loading state
 * <ChartSkeleton height={300} type="bar" />
 *
 * // Line chart loading state
 * <ChartSkeleton height={250} type="line" />
 *
 * // Pie chart loading state
 * <ChartSkeleton height={300} type="pie" />
 * ```
 */
export function ChartSkeleton({
  height = 300,
  type = 'bar',
}: ChartSkeletonProps) {
  return (
    <div
      className="bg-linen/50 rounded-lg border border-border/50 overflow-hidden"
      style={{ height }}
    >
      {type === 'bar' && <BarChartSkeleton height={height} />}
      {type === 'line' && <LineChartSkeleton height={height} />}
      {type === 'pie' && <PieChartSkeleton height={height} />}
    </div>
  );
}
