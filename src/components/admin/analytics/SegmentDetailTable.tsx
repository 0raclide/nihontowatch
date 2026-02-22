'use client';

import React from 'react';
import type { SegmentData } from '@/hooks/useRetentionAnalytics';

interface SegmentDetailTableProps {
  segments: SegmentData[];
  loading?: boolean;
}

const SEGMENT_LABELS: Record<string, string> = {
  converter: 'Converters',
  engaged: 'Engaged',
  browser: 'Browsers',
  bouncer: 'Bouncers',
};

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  converter: 'Clicked through to dealer',
  engaged: 'Favorited or created alert',
  browser: '2+ sessions or 5+ events',
  bouncer: 'Single session, few events',
};

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page Views',
  listing_view: 'Listing Views',
  listing_detail_view: 'Detail Views',
  search: 'Searches',
  filter_change: 'Filters',
  favorite_add: 'Favorites',
  external_link_click: 'Dealer Clicks',
  dealer_click: 'Dealer Clicks',
  quickview_open: 'Quick Views',
  viewport_dwell: 'Card Views',
  alert_create: 'Alerts',
};

export function SegmentDetailTable({
  segments,
  loading = false,
}: SegmentDetailTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Segment', 'Count', '%', 'Avg Events', 'Avg Sessions', 'Top Event'].map((h) => (
                <th key={h} className="text-left px-4 py-3">
                  <div className="h-3 w-16 bg-linen rounded animate-shimmer" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-border/30">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 w-14 bg-linen rounded animate-shimmer" style={{ animationDelay: `${(i + j) * 0.08}s` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-linen/30">
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted font-medium">Segment</th>
            <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted font-medium">Count</th>
            <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted font-medium">%</th>
            <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted font-medium">Avg Events</th>
            <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted font-medium">Avg Sessions</th>
            <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted font-medium">Top Event</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {segments.map((seg) => (
            <tr key={seg.segment} className="hover:bg-linen/30 transition-colors">
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-ink">
                  {SEGMENT_LABELS[seg.segment] || seg.segment}
                </div>
                <div className="text-xs text-muted">
                  {SEGMENT_DESCRIPTIONS[seg.segment] || ''}
                </div>
              </td>
              <td className="text-right px-4 py-3 text-sm font-medium text-ink tabular-nums">
                {seg.visitorCount.toLocaleString()}
              </td>
              <td className="text-right px-4 py-3 text-sm text-muted tabular-nums">
                {seg.percentage}%
              </td>
              <td className="text-right px-4 py-3 text-sm text-charcoal tabular-nums">
                {seg.avgEvents}
              </td>
              <td className="text-right px-4 py-3 text-sm text-charcoal tabular-nums">
                {seg.avgSessions}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs bg-gold/10 text-gold px-2 py-1 rounded">
                  {EVENT_LABELS[seg.topEventType] || seg.topEventType}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
