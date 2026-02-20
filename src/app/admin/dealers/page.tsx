'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DealerStats {
  dealerId: number;
  dealerName: string;
  domain: string;
  clickThroughs: number;
  uniqueVisitors: number;
  listingViews: number;
  favorites: number;
  avgDwellMs: number;
  activeListings: number;
  totalValueJpy: number;
  avgPriceJpy: number;
  clicksPerListing: number;
  clicksRank: number;
  clicksPercentile: number;
  clicksTrend: number;
}

interface DealerAnalytics {
  totalClicks: number;
  totalViews: number;
  totalDealers: number;
  periodStart: string;
  periodEnd: string;
  dealers: DealerStats[];
  topByClicks: Array<{ dealerId: number; name: string; clicks: number }>;
  dailyTrend: Array<{
    date: string;
    totalClicks: number;
    totalViews: number;
    byDealer: Record<string, number>;
  }>;
}

type TimeRange = '7d' | '30d' | '90d';

export default function DealerAnalyticsPage() {
  const [analytics, setAnalytics] = useState<DealerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [sortBy, setSortBy] = useState<'clicks' | 'views' | 'listings' | 'value'>('clicks');

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/dealers/analytics?range=${timeRange}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        setAnalytics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [timeRange]);

  const formatNumber = (n: number) => {
    return new Intl.NumberFormat('en-US').format(n);
  };

  const formatCurrency = (n: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  const formatTrend = (trend: number) => {
    if (trend === 0) return <span className="text-muted">-</span>;
    if (trend > 0) return <span className="text-green-600">+{trend.toFixed(0)}%</span>;
    return <span className="text-red-600">{trend.toFixed(0)}%</span>;
  };

  const sortedDealers = analytics?.dealers
    ? [...analytics.dealers].sort((a, b) => {
        switch (sortBy) {
          case 'clicks':
            return b.clickThroughs - a.clickThroughs;
          case 'views':
            return b.listingViews - a.listingViews;
          case 'listings':
            return b.activeListings - a.activeListings;
          case 'value':
            return b.totalValueJpy - a.totalValueJpy;
          default:
            return 0;
        }
      })
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-linen rounded w-1/3" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-linen rounded" />
              ))}
            </div>
            <div className="h-96 bg-linen rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-semibold">Error loading analytics</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-paper">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-sm text-muted hover:text-ink mb-1 block">
                &larr; Back to Admin
              </Link>
              <h1 className="text-2xl font-serif text-ink">Dealer Analytics</h1>
              <p className="text-sm text-muted mt-1">
                Traffic and engagement metrics to prove value to dealers
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm rounded ${
                    timeRange === range
                      ? 'bg-ink text-white'
                      : 'bg-linen text-charcoal hover:bg-border'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-paper border border-border rounded-lg p-4">
            <p className="text-sm text-muted uppercase tracking-wider">Total Click-Throughs</p>
            <p className="text-3xl font-semibold text-ink mt-1">{formatNumber(analytics?.totalClicks || 0)}</p>
            <p className="text-xs text-muted mt-1">Traffic sent to dealers</p>
          </div>
          <div className="bg-paper border border-border rounded-lg p-4">
            <p className="text-sm text-muted uppercase tracking-wider">Listing Views</p>
            <p className="text-3xl font-semibold text-ink mt-1">{formatNumber(analytics?.totalViews || 0)}</p>
            <p className="text-xs text-muted mt-1">Engagement with listings</p>
          </div>
          <div className="bg-paper border border-border rounded-lg p-4">
            <p className="text-sm text-muted uppercase tracking-wider">Active Dealers</p>
            <p className="text-3xl font-semibold text-ink mt-1">{analytics?.totalDealers || 0}</p>
            <p className="text-xs text-muted mt-1">With listed inventory</p>
          </div>
          <div className="bg-paper border border-border rounded-lg p-4">
            <p className="text-sm text-muted uppercase tracking-wider">Avg Clicks/Dealer</p>
            <p className="text-3xl font-semibold text-ink mt-1">
              {analytics && analytics.totalDealers > 0
                ? formatNumber(Math.round(analytics.totalClicks / analytics.totalDealers))
                : 0}
            </p>
            <p className="text-xs text-muted mt-1">Per dealer average</p>
          </div>
        </div>

        {/* Dealer Table */}
        <div className="bg-paper border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-ink">Dealer Performance</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Sort by:</span>
              {(['clicks', 'views', 'listings', 'value'] as const).map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`px-2 py-1 rounded ${
                    sortBy === sort ? 'bg-linen text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-linen/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-charcoal">Rank</th>
                  <th className="text-left px-4 py-2 font-medium text-charcoal">Dealer</th>
                  <th className="text-right px-4 py-2 font-medium text-charcoal">Clicks</th>
                  <th className="text-right px-4 py-2 font-medium text-charcoal">Trend</th>
                  <th className="text-right px-4 py-2 font-medium text-charcoal">Views</th>
                  <th className="text-right px-4 py-2 font-medium text-charcoal">Favorites</th>
                  <th className="text-right px-4 py-2 font-medium text-charcoal">Listings</th>
                  <th className="text-right px-4 py-2 font-medium text-charcoal">Clicks/Listing</th>
                  <th className="text-right px-4 py-2 font-medium text-charcoal">Avg Value</th>
                  <th className="text-center px-4 py-2 font-medium text-charcoal">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedDealers.map((dealer, index) => (
                  <tr key={dealer.dealerId} className="hover:bg-linen/30">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        dealer.clicksRank <= 3 ? 'bg-gold/20 text-gold' : 'bg-linen text-charcoal'
                      }`}>
                        {dealer.clicksRank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-ink">{dealer.dealerName}</p>
                        <p className="text-xs text-muted">{dealer.domain}</p>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 font-medium text-ink">
                      {formatNumber(dealer.clickThroughs)}
                    </td>
                    <td className="text-right px-4 py-3">
                      {formatTrend(dealer.clicksTrend)}
                    </td>
                    <td className="text-right px-4 py-3 text-charcoal">
                      {formatNumber(dealer.listingViews)}
                    </td>
                    <td className="text-right px-4 py-3 text-charcoal">
                      {formatNumber(dealer.favorites)}
                    </td>
                    <td className="text-right px-4 py-3 text-charcoal">
                      {formatNumber(dealer.activeListings)}
                    </td>
                    <td className="text-right px-4 py-3 text-charcoal">
                      {dealer.clicksPerListing.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3 text-charcoal">
                      {formatCurrency(dealer.avgPriceJpy)}
                    </td>
                    <td className="text-center px-4 py-3">
                      <Link
                        href={`/admin/dealers/${dealer.dealerId}`}
                        className="text-gold hover:text-gold/80 text-xs font-medium"
                      >
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Trend Chart Placeholder */}
        <div className="bg-paper border border-border rounded-lg p-4">
          <h2 className="font-semibold text-ink mb-4">Daily Trend</h2>
          <div className="h-64 flex items-center justify-center text-muted">
            <div className="text-center">
              <p>Daily click trend data available</p>
              <p className="text-xs mt-1">
                {analytics?.dailyTrend.length || 0} days of data
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {(() => {
                  const last7 = analytics?.dailyTrend.slice(-7) || [];
                  const maxClicks = Math.max(...last7.map(d => d.totalClicks), 1);
                  return last7.map((day) => (
                    <div key={day.date} className="text-center">
                      <div
                        className="w-8 bg-gold/60 rounded-t"
                        style={{ height: `${Math.max(4, (day.totalClicks / maxClicks) * 80)}px` }}
                      />
                      <p className="text-[10px] mt-1">{day.date.slice(5)}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-linen/50 border border-border rounded-lg p-4">
          <h2 className="font-semibold text-ink mb-2">Share with Dealers</h2>
          <p className="text-sm text-muted mb-4">
            Generate individual dealer reports to demonstrate the traffic and engagement value you provide.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                // TODO: Implement CSV export
                const csv = [
                  ['Dealer', 'Clicks', 'Views', 'Favorites', 'Listings', 'Clicks/Listing'].join(','),
                  ...sortedDealers.map(d =>
                    [d.dealerName, d.clickThroughs, d.listingViews, d.favorites, d.activeListings, d.clicksPerListing].join(',')
                  )
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dealer-analytics-${timeRange}.csv`;
                a.click();
              }}
              className="px-4 py-2 bg-ink text-white rounded hover:bg-charcoal text-sm"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
