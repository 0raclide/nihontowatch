'use client';

import React from 'react';
import type { SegmentData } from '@/hooks/useRetentionAnalytics';

interface SegmentBreakdownChartProps {
  segments: SegmentData[];
  loading?: boolean;
}

const SEGMENT_COLORS: Record<string, string> = {
  converter: 'bg-green-500',
  engaged: 'bg-gold',
  browser: 'bg-blue-400',
  bouncer: 'bg-charcoal/40',
};

const SEGMENT_LABELS: Record<string, string> = {
  converter: 'Converters',
  engaged: 'Engaged',
  browser: 'Browsers',
  bouncer: 'Bouncers',
};

export function SegmentBreakdownChart({
  segments,
  loading = false,
}: SegmentBreakdownChartProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-linen rounded-full animate-shimmer" />
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-linen animate-shimmer" />
              <div className="w-16 h-3 bg-linen rounded animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="py-8 text-center text-muted text-sm">
        No segment data available
      </div>
    );
  }

  const totalVisitors = segments.reduce((sum, s) => sum + s.visitorCount, 0);

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex h-8 rounded-full overflow-hidden">
        {segments.map((seg) => {
          const width = totalVisitors > 0 ? (seg.visitorCount / totalVisitors) * 100 : 0;
          if (width === 0) return null;
          return (
            <div
              key={seg.segment}
              className={`${SEGMENT_COLORS[seg.segment] || 'bg-linen'} transition-all duration-300`}
              style={{ width: `${width}%` }}
              title={`${SEGMENT_LABELS[seg.segment] || seg.segment}: ${seg.visitorCount} (${seg.percentage}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.segment} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-sm ${SEGMENT_COLORS[seg.segment] || 'bg-linen'}`} />
            <span className="text-sm text-ink">
              {SEGMENT_LABELS[seg.segment] || seg.segment}
            </span>
            <span className="text-xs text-muted tabular-nums">
              {seg.visitorCount} ({seg.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
