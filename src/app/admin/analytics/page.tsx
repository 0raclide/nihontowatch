'use client';

import { useEffect, useState } from 'react';

interface AnalyticsData {
  sessionStats: {
    totalSessions: number;
    avgDuration: number;
    avgPageViews: number;
  };
  mostViewedListings: {
    id: number;
    title: string;
    views: number;
    favorites: number;
    item_type: string;
  }[];
  popularSearchTerms: {
    term: string;
    count: number;
  }[];
  userGrowth: {
    date: string;
    count: number;
  }[];
  conversionFunnel: {
    views: number;
    favorites: number;
    alerts: number;
  };
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-cream rounded-xl p-6 border border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted font-medium">{title}</p>
          <p className="text-3xl font-serif text-ink mt-2">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          )}
        </div>
        <div className="p-3 bg-gold/10 rounded-lg text-gold">
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/stats?range=${timeRange}&detailed=true`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange]);

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
        <p className="font-medium">Error loading analytics</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-ink">Analytics</h1>
          <p className="text-muted text-sm mt-1">
            Detailed insights into site performance
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-gold text-white'
                  : 'bg-cream border border-border text-charcoal hover:bg-linen'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Sessions"
          value={data?.sessionStats?.totalSessions?.toLocaleString() || 0}
          subtitle="Unique browsing sessions"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <MetricCard
          title="Avg. Session Duration"
          value={formatDuration(data?.sessionStats?.avgDuration || 0)}
          subtitle="Time spent per visit"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Avg. Pages per Session"
          value={data?.sessionStats?.avgPageViews?.toFixed(1) || '0'}
          subtitle="Engagement depth"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most Viewed Listings */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-serif text-lg text-ink">Most Viewed Listings</h2>
          </div>
          <div className="divide-y divide-border">
            {!data?.mostViewedListings?.length ? (
              <div className="px-6 py-8 text-center text-muted text-sm">
                No listing data available
              </div>
            ) : (
              data.mostViewedListings.slice(0, 10).map((listing, index) => (
                <div key={listing.id} className="px-6 py-4 flex items-center gap-4">
                  <span className="text-lg font-serif text-muted w-6">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{listing.title}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted capitalize">{listing.item_type}</span>
                      <span className="text-xs text-muted flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {listing.views}
                      </span>
                      <span className="text-xs text-muted flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {listing.favorites}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Popular Search Terms */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-serif text-lg text-ink">Popular Search Terms</h2>
          </div>
          <div className="divide-y divide-border">
            {!data?.popularSearchTerms?.length ? (
              <div className="px-6 py-8 text-center text-muted text-sm">
                No search data available
              </div>
            ) : (
              data.popularSearchTerms.slice(0, 10).map((term, index) => (
                <div key={term.term} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-serif text-muted w-6">{index + 1}</span>
                    <span className="text-sm text-ink">{term.term}</span>
                  </div>
                  <span className="text-sm text-muted tabular-nums">{term.count} searches</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-cream rounded-xl border border-border p-6">
        <h2 className="font-serif text-lg text-ink mb-6">Conversion Funnel</h2>
        <div className="flex items-end justify-center gap-8 h-48">
          {data?.conversionFunnel ? (
            <>
              <FunnelBar
                label="Views"
                value={data.conversionFunnel.views}
                maxValue={data.conversionFunnel.views}
              />
              <FunnelBar
                label="Favorites"
                value={data.conversionFunnel.favorites}
                maxValue={data.conversionFunnel.views}
                percentage={(data.conversionFunnel.favorites / data.conversionFunnel.views * 100).toFixed(1)}
              />
              <FunnelBar
                label="Alerts"
                value={data.conversionFunnel.alerts}
                maxValue={data.conversionFunnel.views}
                percentage={(data.conversionFunnel.alerts / data.conversionFunnel.views * 100).toFixed(1)}
              />
            </>
          ) : (
            <div className="text-center text-muted text-sm">
              No funnel data available
            </div>
          )}
        </div>
      </div>

      {/* User Growth Chart Placeholder */}
      <div className="bg-cream rounded-xl border border-border p-6">
        <h2 className="font-serif text-lg text-ink mb-4">User Growth</h2>
        <div className="h-64 flex items-center justify-center bg-linen rounded-lg border border-border border-dashed">
          <div className="text-center">
            <svg className="w-12 h-12 text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className="text-muted text-sm">User growth chart coming soon</p>
            <p className="text-muted/60 text-xs mt-1">Track signups over time</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  maxValue,
  percentage,
}: {
  label: string;
  value: number;
  maxValue: number;
  percentage?: string;
}) {
  const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-40 w-24 bg-linen rounded-lg flex items-end overflow-hidden">
        <div
          className="w-full bg-gold/80 rounded-t-lg transition-all duration-500"
          style={{ height: `${heightPercent}%` }}
        />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-lg font-serif text-gold">{value.toLocaleString()}</p>
        {percentage && (
          <p className="text-xs text-muted">{percentage}%</p>
        )}
      </div>
    </div>
  );
}
