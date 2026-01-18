'use client';

import { useEffect, useState, useCallback } from 'react';

// Country code to flag emoji
function getFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'XX') return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Format numbers with K/M suffix
function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// Format relative time
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface VisitorStats {
  uniqueVisitors: number;
  totalEvents: number;
  avgEventsPerVisitor: number;
  bounceRate: number;
  visitorsByDay: { date: string; visitors: number; events: number }[];
  topEventTypes: { type: string; count: number; percentage: number }[];
  topDealers: { name: string; clicks: number; percentage: number }[];
  topPaths: { path: string; count: number; percentage: number }[];
  visitors: {
    visitorId: string;
    ip: string | null;
    events: number;
    firstSeen: string;
    lastSeen: string;
    topEvent: string;
  }[];
  activeNow: number;
  uniqueIPs: string[];
  periodStart: string;
  periodEnd: string;
}

interface GeoData {
  geoData: Record<string, {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    isp: string;
  }>;
  countrySummary: {
    country: string;
    countryCode: string;
    count: number;
    percentage: number;
  }[];
}

type TimeRange = '24h' | '7d' | '30d' | '90d';

const EVENT_TYPE_LABELS: Record<string, string> = {
  page_view: 'Page Views',
  external_link_click: 'Dealer Clicks',
  filter_change: 'Filter Changes',
  search: 'Searches',
  viewport_dwell: 'Card Views',
  quickview_panel_toggle: 'Panel Toggles',
  image_pinch_zoom: 'Image Zooms',
  favorite_add: 'Favorites Added',
  favorite_remove: 'Favorites Removed',
};

export default function VisitorsPage() {
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/visitors?range=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);

      // Fetch geo data for IPs
      if (data.uniqueIPs?.length > 0) {
        setIsLoadingGeo(true);
        const geoResponse = await fetch('/api/admin/visitors/geo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ips: data.uniqueIPs }),
        });
        if (geoResponse.ok) {
          const geo = await geoResponse.json();
          setGeoData(geo);
        }
        setIsLoadingGeo(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Simple bar chart component
  const BarChart = ({ data, maxValue }: { data: { date: string; visitors: number }[]; maxValue: number }) => {
    return (
      <div className="flex items-end gap-1 h-32">
        {data.map((day, i) => (
          <div
            key={day.date}
            className="flex-1 bg-gold/20 hover:bg-gold/40 rounded-t transition-colors relative group"
            style={{ height: `${maxValue > 0 ? (day.visitors / maxValue) * 100 : 0}%`, minHeight: day.visitors > 0 ? '4px' : '0' }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {day.date}: {day.visitors} visitors
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 text-error rounded-lg p-4">
        <p className="font-medium">Error loading visitor data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const maxVisitors = Math.max(...(stats?.visitorsByDay.map(d => d.visitors) || [1]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-ink">Visitors</h1>
          <p className="text-muted text-sm mt-1">
            Real-time visitor analytics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Real-time indicator */}
          {(stats?.activeNow || 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {stats?.activeNow} online now
            </div>
          )}
          {/* Time range selector */}
          <div className="flex gap-1 bg-cream rounded-lg p-1 border border-border">
            {(['24h', '7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-gold text-white'
                    : 'text-charcoal hover:bg-linen'
                }`}
              >
                {range === '24h' ? '24h' : range === '7d' ? '7d' : range === '30d' ? '30d' : '90d'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Unique Visitors</p>
          <p className="text-3xl font-serif text-ink mt-2">{formatNumber(stats?.uniqueVisitors || 0)}</p>
        </div>
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Total Events</p>
          <p className="text-3xl font-serif text-ink mt-2">{formatNumber(stats?.totalEvents || 0)}</p>
        </div>
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Events/Visitor</p>
          <p className="text-3xl font-serif text-ink mt-2">{stats?.avgEventsPerVisitor || 0}</p>
        </div>
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Bounce Rate</p>
          <p className="text-3xl font-serif text-ink mt-2">{stats?.bounceRate || 0}%</p>
        </div>
      </div>

      {/* Visitors Chart */}
      <div className="bg-cream rounded-xl border border-border p-6">
        <h2 className="text-sm font-medium text-charcoal mb-4">Visitors Over Time</h2>
        {stats?.visitorsByDay && stats.visitorsByDay.length > 0 ? (
          <>
            <BarChart data={stats.visitorsByDay} maxValue={maxVisitors} />
            <div className="flex justify-between mt-2 text-xs text-muted">
              <span>{stats.visitorsByDay[0]?.date}</span>
              <span>{stats.visitorsByDay[stats.visitorsByDay.length - 1]?.date}</span>
            </div>
          </>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted text-sm">
            No data for this period
          </div>
        )}
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Locations */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-medium text-ink">Locations</h2>
          </div>
          <div className="p-2">
            {isLoadingGeo ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : geoData?.countrySummary && geoData.countrySummary.length > 0 ? (
              <div className="space-y-1">
                {geoData.countrySummary.slice(0, 8).map((item) => (
                  <div key={item.country} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-linen">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getFlag(item.countryCode)}</span>
                      <span className="text-sm text-ink">{item.country}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-linen rounded-full h-1.5">
                        <div
                          className="bg-gold h-1.5 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted text-sm">
                No location data
              </div>
            )}
          </div>
        </div>

        {/* Top Dealers */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-medium text-ink">Top Dealers</h2>
          </div>
          <div className="p-2">
            {stats?.topDealers && stats.topDealers.length > 0 ? (
              <div className="space-y-1">
                {stats.topDealers.slice(0, 8).map((item) => (
                  <div key={item.name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-linen">
                    <span className="text-sm text-ink truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-linen rounded-full h-1.5">
                        <div
                          className="bg-gold h-1.5 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted w-8 text-right">{item.clicks}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted text-sm">
                No dealer clicks yet
              </div>
            )}
          </div>
        </div>

        {/* Event Types */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-medium text-ink">Event Types</h2>
          </div>
          <div className="p-2">
            {stats?.topEventTypes && stats.topEventTypes.length > 0 ? (
              <div className="space-y-1">
                {stats.topEventTypes.slice(0, 8).map((item) => (
                  <div key={item.type} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-linen">
                    <span className="text-sm text-ink truncate flex-1">
                      {EVENT_TYPE_LABELS[item.type] || item.type}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-linen rounded-full h-1.5">
                        <div
                          className="bg-gold h-1.5 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted w-10 text-right">{formatNumber(item.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted text-sm">
                No events yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visitor List */}
      <div className="bg-cream rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-medium text-ink">Recent Visitors</h2>
          <span className="text-xs text-muted">{stats?.visitors?.length || 0} visitors</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-linen/30">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-muted font-medium">Visitor</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-muted font-medium">Location</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-muted font-medium">Events</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-muted font-medium">Top Activity</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-muted font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats?.visitors && stats.visitors.length > 0 ? (
                stats.visitors.slice(0, 20).map((visitor) => {
                  const geo = visitor.ip ? geoData?.geoData?.[visitor.ip] : null;
                  return (
                    <tr key={visitor.visitorId} className="hover:bg-linen/30">
                      <td className="px-5 py-3">
                        <code className="text-xs bg-linen px-2 py-1 rounded text-charcoal">
                          {visitor.visitorId}
                        </code>
                      </td>
                      <td className="px-5 py-3">
                        {geo ? (
                          <div className="flex items-center gap-2">
                            <span>{getFlag(geo.countryCode)}</span>
                            <span className="text-sm text-charcoal">{geo.city || geo.country}</span>
                          </div>
                        ) : visitor.ip ? (
                          <span className="text-xs text-muted">{visitor.ip}</span>
                        ) : (
                          <span className="text-xs text-muted">Unknown</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-ink">{visitor.events}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-gold/10 text-gold px-2 py-1 rounded">
                          {EVENT_TYPE_LABELS[visitor.topEvent] || visitor.topEvent}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-muted">{formatRelativeTime(visitor.lastSeen)}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted text-sm">
                    No visitors in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
