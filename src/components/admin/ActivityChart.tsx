'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface ActivityDataPoint {
  date: string;
  dayLabel: string;
  views: number;
  searches: number;
  favorites: number;
  alerts: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function ActivityChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-paper border border-border rounded-lg shadow-lg p-3">
      <p className="text-xs text-muted mb-2 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted">{entry.name}:</span>
          <span className="text-ink font-medium">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function ActivityChart({ data }: { data: ActivityDataPoint[] }) {
  const hasData = data.some(d => d.views > 0 || d.searches > 0 || d.favorites > 0 || d.alerts > 0);

  if (!hasData) {
    return (
      <div className="h-64 flex items-center justify-center bg-linen rounded-lg border border-border border-dashed">
        <div className="text-center">
          <svg className="w-10 h-10 text-muted mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-muted text-sm">No activity yet</p>
          <p className="text-muted/60 text-xs mt-1">Data will appear as users interact</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="dayLabel"
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip content={<ActivityChartTooltip />} />
        <Area
          type="monotone"
          dataKey="views"
          stackId="1"
          stroke="#3B82F6"
          fill="#3B82F6"
          fillOpacity={0.6}
          name="Views"
        />
        <Area
          type="monotone"
          dataKey="searches"
          stackId="1"
          stroke="#D4AF37"
          fill="#D4AF37"
          fillOpacity={0.6}
          name="Searches"
        />
        <Area
          type="monotone"
          dataKey="favorites"
          stackId="1"
          stroke="#EC4899"
          fill="#EC4899"
          fillOpacity={0.6}
          name="Favorites"
        />
        <Area
          type="monotone"
          dataKey="alerts"
          stackId="1"
          stroke="#10B981"
          fill="#10B981"
          fillOpacity={0.6}
          name="Alerts"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
