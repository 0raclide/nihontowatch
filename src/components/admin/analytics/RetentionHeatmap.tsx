'use client';

import React from 'react';
import type { CohortData } from '@/hooks/useRetentionAnalytics';

interface RetentionHeatmapProps {
  cohorts: CohortData[];
  maxWeeks?: number;
  loading?: boolean;
}

function getCellColor(pct: number): string {
  if (pct >= 80) return 'bg-gold/80 text-white';
  if (pct >= 60) return 'bg-gold/60 text-white';
  if (pct >= 40) return 'bg-gold/40 text-ink';
  if (pct >= 20) return 'bg-gold/20 text-ink';
  if (pct > 0) return 'bg-gold/10 text-muted';
  return 'bg-linen/50 text-muted';
}

export function RetentionHeatmap({
  cohorts,
  maxWeeks = 8,
  loading = false,
}: RetentionHeatmapProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header skeleton */}
          <div className="flex gap-1 mb-2">
            <div className="w-24 h-8 bg-linen rounded animate-shimmer" />
            <div className="w-12 h-8 bg-linen rounded animate-shimmer" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-14 h-8 bg-linen rounded animate-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          {/* Row skeletons */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <div className="w-24 h-10 bg-linen rounded animate-shimmer" style={{ animationDelay: `${i * 0.15}s` }} />
              <div className="w-12 h-10 bg-linen rounded animate-shimmer" style={{ animationDelay: `${i * 0.15}s` }} />
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="w-14 h-10 bg-linen rounded animate-shimmer" style={{ animationDelay: `${(i + j) * 0.08}s` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cohorts.length === 0) {
    return (
      <div className="py-12 text-center text-muted text-sm">
        No cohort data available for this period
      </div>
    );
  }

  // Determine the max week offset present in the data
  const weekOffsets = Array.from({ length: maxWeeks + 1 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted font-medium whitespace-nowrap">
              Cohort
            </th>
            <th className="text-center px-2 py-2 text-xs uppercase tracking-wider text-muted font-medium">
              Size
            </th>
            {weekOffsets.map((w) => (
              <th
                key={w}
                className="text-center px-2 py-2 text-xs uppercase tracking-wider text-muted font-medium"
              >
                W{w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortWeek} className="border-t border-border/30">
              <td className="px-3 py-2 text-sm text-ink font-medium whitespace-nowrap">
                {cohort.cohortWeek}
              </td>
              <td className="text-center px-2 py-2 text-xs text-muted tabular-nums">
                {cohort.cohortSize}
              </td>
              {weekOffsets.map((w) => {
                const weekData = cohort.weeks[w];
                if (!weekData) {
                  return (
                    <td key={w} className="text-center px-1 py-1">
                      <div className="w-14 h-9 rounded bg-linen/30" />
                    </td>
                  );
                }
                return (
                  <td key={w} className="text-center px-1 py-1">
                    <div
                      className={`w-14 h-9 rounded flex items-center justify-center text-xs font-medium tabular-nums ${getCellColor(weekData.retentionPct)}`}
                      title={`${weekData.activeUsers} of ${cohort.cohortSize} active`}
                    >
                      {weekData.retentionPct}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
