'use client';

import React, { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';

interface VisitorDayData {
  date: string;
  visitors: number;
  sessions: number;
  events: number;
}

interface VisitorsChartProps {
  data: VisitorDayData[];
  loading?: boolean;
  height?: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function CustomTooltip({
  active,
  payload,
  showSessions,
  showEvents,
}: {
  active?: boolean;
  payload?: Array<{
    payload: VisitorDayData & { formattedDate: string };
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
  showSessions: boolean;
  showEvents: boolean;
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
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--accent)' }} />
          <span className="text-sm text-ink">
            Visitors: <span className="font-medium">{data.visitors.toLocaleString()}</span>
          </span>
        </div>
        {showSessions && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--gold)' }} />
            <span className="text-sm text-ink">
              Sessions: <span className="font-medium">{data.sessions.toLocaleString()}</span>
            </span>
          </div>
        )}
        {showEvents && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--text-muted)' }} />
            <span className="text-sm text-ink">
              Events: <span className="font-medium">{data.events.toLocaleString()}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

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
        <p className="text-muted text-sm">No visitor data for this period</p>
      </div>
    </div>
  );
}

export function VisitorsChart({
  data,
  loading = false,
  height = 300,
}: VisitorsChartProps) {
  const [showSessions, setShowSessions] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  if (loading) {
    return <ChartSkeleton height={height} type="bar" />;
  }

  if (!data || data.length === 0) {
    return <EmptyState height={height} />;
  }

  const chartData = data.map((point) => ({
    ...point,
    formattedDate: formatDate(point.date),
  }));

  const hasSecondaryAxis = showSessions || showEvents;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowSessions((s) => !s)}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            showSessions
              ? 'bg-gold/10 border-gold/30 text-gold'
              : 'border-border text-muted hover:bg-linen'
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setShowEvents((s) => !s)}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            showEvents
              ? 'bg-charcoal/10 border-charcoal/30 text-charcoal'
              : 'border-border text-muted hover:bg-linen'
          }`}
        >
          Events
        </button>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: hasSecondaryAxis ? 50 : 20, left: 0, bottom: 20 }}
        >
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCompactNumber}
            width={40}
          />

          {hasSecondaryAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactNumber}
              width={45}
            />
          )}

          <Tooltip
            content={
              <CustomTooltip showSessions={showSessions} showEvents={showEvents} />
            }
          />

          <Bar
            yAxisId="left"
            dataKey="visitors"
            name="Visitors"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />

          {showSessions && (
            <Line
              yAxisId={hasSecondaryAxis ? 'right' : 'left'}
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="var(--gold)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--gold)' }}
            />
          )}

          {showEvents && (
            <Line
              yAxisId={hasSecondaryAxis ? 'right' : 'left'}
              type="monotone"
              dataKey="events"
              name="Events"
              stroke="var(--text-muted)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--text-muted)' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
