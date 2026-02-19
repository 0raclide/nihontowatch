'use client';

import { useEffect, useState, useCallback } from 'react';
import { VisitorDetailModal } from '@/components/admin/VisitorDetailModal';
import { VisitorsChart } from '@/components/admin/analytics';

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
  // HONEST metrics
  trackedVisitors: number;
  totalSessions: number;
  uniqueIPs: string[];
  totalEvents: number;

  // Tracking coverage
  eventsWithTracking: number;
  eventsWithoutTracking: number;
  trackingStartDate: string | null;

  // Time series
  visitorsByDay: { date: string; visitors: number; sessions: number; events: number }[];

  // Breakdowns
  topEventTypes: { type: string; count: number; percentage: number }[];
  topDealers: { name: string; clicks: number; percentage: number }[];
  topPaths: { path: string; count: number; percentage: number }[];

  // Visitor details
  visitors: {
    visitorId: string;
    visitorIdShort: string;
    ip: string | null;
    events: number;
    firstSeen: string;
    lastSeen: string;
    topEvent: string;
  }[];

  // Real-time
  activeNow: number;

  // Time range
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
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);

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

      {/* Tracking Coverage Warning */}
      {stats && stats.eventsWithoutTracking > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Visitor tracking started recently</p>
            <p className="text-xs text-amber-700 mt-1">
              {stats.eventsWithTracking} of {stats.totalEvents} events ({((stats.eventsWithTracking / stats.totalEvents) * 100).toFixed(1)}%) have visitor tracking.
              {stats.trackingStartDate && (
                <> Tracking began {formatRelativeTime(stats.trackingStartDate)}.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Top Metrics - HONEST */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Tracked Visitors</p>
          <p className="text-3xl font-serif text-ink mt-2">{formatNumber(stats?.trackedVisitors || 0)}</p>
          <p className="text-xs text-muted mt-1">Unique visitor IDs</p>
        </div>
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Unique IPs</p>
          <p className="text-3xl font-serif text-ink mt-2">{formatNumber(stats?.uniqueIPs?.length || 0)}</p>
          <p className="text-xs text-muted mt-1">Distinct IP addresses</p>
        </div>
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Sessions</p>
          <p className="text-3xl font-serif text-ink mt-2">{formatNumber(stats?.totalSessions || 0)}</p>
          <p className="text-xs text-muted mt-1">Browser tabs/sessions</p>
        </div>
        <div className="bg-cream rounded-xl p-5 border border-border">
          <p className="text-xs uppercase tracking-wider text-muted font-medium">Total Events</p>
          <p className="text-3xl font-serif text-ink mt-2">{formatNumber(stats?.totalEvents || 0)}</p>
          <p className="text-xs text-muted mt-1">All tracked actions</p>
        </div>
      </div>

      {/* Visitors Chart */}
      <div className="bg-cream rounded-xl border border-border p-6">
        <h2 className="text-sm font-medium text-charcoal mb-4">Visitors Over Time</h2>
        <VisitorsChart data={stats?.visitorsByDay || []} loading={isLoading} />
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
          <div>
            <h2 className="font-medium text-ink">Recent Visitors</h2>
            <p className="text-xs text-muted mt-0.5">Click a visitor to see their full activity</p>
          </div>
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
                    <tr
                      key={visitor.visitorId}
                      className="hover:bg-linen/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedVisitorId(visitor.visitorId)}
                    >
                      <td className="px-5 py-3">
                        <code className="text-xs bg-linen px-2 py-1 rounded text-charcoal">
                          {visitor.visitorIdShort}
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

      {/* Visitor Detail Modal */}
      {selectedVisitorId && (
        <VisitorDetailModal
          visitorId={selectedVisitorId}
          onClose={() => setSelectedVisitorId(null)}
        />
      )}
    </div>
  );
}
