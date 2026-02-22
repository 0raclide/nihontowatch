'use client';

import React from 'react';
import type { DeviceBreakdown } from '@/hooks/useRetentionAnalytics';

interface DeviceBreakdownChartProps {
  deviceBreakdown: Record<string, DeviceBreakdown>;
  loading?: boolean;
}

const SEGMENT_LABELS: Record<string, string> = {
  converter: 'Converters',
  engaged: 'Engaged',
  browser: 'Browsers',
  bouncer: 'Bouncers',
};

const SEGMENT_ORDER = ['converter', 'engaged', 'browser', 'bouncer'];

export function DeviceBreakdownChart({
  deviceBreakdown,
  loading = false,
}: DeviceBreakdownChartProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-20 bg-linen rounded animate-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
            <div className="h-5 bg-linen rounded-full animate-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
          </div>
        ))}
      </div>
    );
  }

  const segments = SEGMENT_ORDER.filter((s) => deviceBreakdown[s]);

  if (segments.length === 0) {
    return (
      <div className="py-8 text-center text-muted text-sm">
        No device data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-muted">Desktop</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-500" />
          <span className="text-muted">Mobile</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-charcoal/20" />
          <span className="text-muted">Unknown</span>
        </div>
      </div>

      {/* Per-segment bars */}
      <div className="space-y-3">
        {segments.map((seg) => {
          const data = deviceBreakdown[seg];
          const total = data.mobile + data.desktop + data.unknown;
          if (total === 0) return null;

          const desktopPct = (data.desktop / total) * 100;
          const mobilePct = (data.mobile / total) * 100;
          const unknownPct = (data.unknown / total) * 100;

          return (
            <div key={seg}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-ink">
                  {SEGMENT_LABELS[seg] || seg}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {total} visitors
                </span>
              </div>
              <div className="flex h-5 rounded-full overflow-hidden">
                {data.desktop > 0 && (
                  <div
                    className="bg-blue-500 transition-all duration-300"
                    style={{ width: `${desktopPct}%` }}
                    title={`Desktop: ${data.desktop} (${desktopPct.toFixed(1)}%)`}
                  />
                )}
                {data.mobile > 0 && (
                  <div
                    className="bg-amber-500 transition-all duration-300"
                    style={{ width: `${mobilePct}%` }}
                    title={`Mobile: ${data.mobile} (${mobilePct.toFixed(1)}%)`}
                  />
                )}
                {data.unknown > 0 && (
                  <div
                    className="bg-charcoal/20 transition-all duration-300"
                    style={{ width: `${unknownPct}%` }}
                    title={`Unknown: ${data.unknown} (${unknownPct.toFixed(1)}%)`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
