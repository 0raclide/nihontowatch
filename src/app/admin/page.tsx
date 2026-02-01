'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ActivityDataPoint {
  date: string;
  dayLabel: string;
  views: number;
  searches: number;
  favorites: number;
}

interface ActivityChartData {
  dataPoints: ActivityDataPoint[];
  totals: {
    views: number;
    searches: number;
    favorites: number;
  };
  period: string;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers24h: number;
  totalListings: number;
  favoritesCount: number;
  recentSignups: {
    id: string;
    email: string;
    display_name: string | null;
    created_at: string;
  }[];
  popularListings: {
    id: number;
    title: string;
    views: number;
    favorites: number;
  }[];
}

function MetricCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}) {
  return (
    <div className="bg-cream rounded-xl p-6 border border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted font-medium">{title}</p>
          <p className="text-3xl font-serif text-ink mt-2">{value}</p>
          {trendLabel && (
            <p className={`text-xs mt-2 flex items-center gap-1 ${
              trend === 'up' ? 'text-success' :
              trend === 'down' ? 'text-error' :
              'text-muted'
            }`}>
              {trend === 'up' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              {trend === 'down' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {trendLabel}
            </p>
          )}
        </div>
        <div className="p-3 bg-gold/10 rounded-lg text-gold">
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
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

function ActivityChart({ data }: { data: ActivityDataPoint[] }) {
  const hasData = data.some(d => d.views > 0 || d.searches > 0 || d.favorites > 0);

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
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activityData, setActivityData] = useState<ActivityChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchActivityChart() {
      try {
        const response = await fetch('/api/admin/stats/activity-chart');
        if (response.ok) {
          const data = await response.json();
          setActivityData(data);
        }
      } catch {
        // Silent fail - activity chart is supplementary
      } finally {
        setActivityLoading(false);
      }
    }

    fetchStats();
    fetchActivityChart();
  }, []);

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
        <p className="font-medium">Error loading dashboard</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-serif text-ink">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Overview of your site activity</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Active Users (24h)"
          value={stats.activeUsers24h.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Total Listings"
          value={stats.totalListings.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <MetricCard
          title="Favorites"
          value={stats.favoritesCount.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          }
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/dealers"
          className="bg-gold/5 border border-gold/20 rounded-xl p-4 hover:bg-gold/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/10 rounded-lg text-gold group-hover:bg-gold/20 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-ink">Dealer Analytics</p>
              <p className="text-xs text-muted">Track traffic sent to dealers</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/visitors"
          className="bg-paper border border-border rounded-xl p-4 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linen rounded-lg text-charcoal group-hover:bg-gold/10 group-hover:text-gold transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-ink">Visitor Analytics</p>
              <p className="text-xs text-muted">See who&apos;s browsing</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/scrapers"
          className="bg-paper border border-border rounded-xl p-4 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linen rounded-lg text-charcoal group-hover:bg-gold/10 group-hover:text-gold transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-ink">Scraper Status</p>
              <p className="text-xs text-muted">Manage data collection</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Signups */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Recent Signups</h2>
            <Link
              href="/admin/users"
              className="text-xs uppercase tracking-wider text-gold hover:text-gold-light transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="divide-y divide-border">
            {stats.recentSignups.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted text-sm">
                No recent signups
              </div>
            ) : (
              stats.recentSignups.map((user) => (
                <div key={user.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-medium">
                      {(user.display_name || user.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {user.display_name || 'No name'}
                      </p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted">{formatDate(user.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Popular Listings */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Popular Listings</h2>
            <Link
              href="/admin/analytics"
              className="text-xs uppercase tracking-wider text-gold hover:text-gold-light transition-colors"
            >
              View Analytics
            </Link>
          </div>
          <div className="divide-y divide-border">
            {stats.popularListings.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted text-sm">
                No listing data available
              </div>
            ) : (
              stats.popularListings.map((listing, index) => (
                <div key={listing.id} className="px-6 py-4 flex items-center gap-4">
                  <span className="text-lg font-serif text-muted w-6">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{listing.title}</p>
                    <div className="flex items-center gap-4 mt-1">
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
      </div>

      {/* Activity Overview Chart */}
      <div className="bg-cream rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-ink">Activity Overview</h2>
          {activityData && (
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                <span className="text-muted">Views</span>
                <span className="text-ink font-medium">{activityData.totals.views}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <span className="text-muted">Searches</span>
                <span className="text-ink font-medium">{activityData.totals.searches}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#EC4899]" />
                <span className="text-muted">Favorites</span>
                <span className="text-ink font-medium">{activityData.totals.favorites}</span>
              </span>
            </div>
          )}
        </div>
        {activityLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activityData ? (
          <ActivityChart data={activityData.dataPoints} />
        ) : (
          <div className="h-64 flex items-center justify-center bg-linen rounded-lg border border-border border-dashed">
            <div className="text-center">
              <p className="text-muted text-sm">Unable to load activity data</p>
            </div>
          </div>
        )}
        <p className="text-xs text-muted text-center mt-3">Last 7 days</p>
      </div>
    </div>
  );
}
