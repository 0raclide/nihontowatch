'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface DealerStats {
  dealerId: number;
  dealerName: string;
  domain: string;
  country: string;
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
  dailyTrend: Array<{
    date: string;
    totalClicks: number;
    totalViews: number;
    byDealer: Record<string, number>;
  }>;
}

type TimeRange = '7d' | '30d' | '90d';

export default function DealerReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [analytics, setAnalytics] = useState<DealerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/dealers/analytics?range=${timeRange}&dealerId=${id}`);
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
  }, [timeRange, id]);

  const dealer = analytics?.dealers?.[0];

  const formatNumber = (n: number) => {
    return new Intl.NumberFormat('en-US').format(n);
  };

  const formatCurrency = (n: number, currency = 'JPY') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-linen rounded w-1/3" />
            <div className="h-48 bg-linen rounded" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-linen rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dealer) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/dealers" className="text-sm text-muted hover:text-ink mb-4 block">
            &larr; Back to Dealer Analytics
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-semibold">Error loading dealer report</h2>
            <p className="text-red-600">{error || 'Dealer not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate daily clicks for this dealer from the trend data
  const dealerDailyClicks = analytics?.dailyTrend.map(day => ({
    date: day.date,
    clicks: day.byDealer[dealer.dealerName] || 0,
  })) || [];

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Header - Hidden when printing */}
      <div className="border-b border-border bg-paper print:hidden">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin/dealers" className="text-sm text-muted hover:text-ink mb-1 block">
                &larr; Back to Dealer Analytics
              </Link>
              <h1 className="text-2xl font-serif text-ink">Dealer Performance Report</h1>
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
              <button
                onClick={() => window.print()}
                className="ml-4 px-3 py-1.5 text-sm bg-gold text-white rounded hover:bg-gold/90"
              >
                Print / PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Report Header */}
        <div className="text-center border-b border-border pb-8">
          <p className="text-sm text-muted uppercase tracking-wider mb-2">Performance Report</p>
          <h1 className="text-3xl font-serif text-ink mb-2">{dealer.dealerName}</h1>
          <p className="text-muted">{dealer.domain}</p>
          <p className="text-sm text-muted mt-4">
            Report Period: {formatDate(analytics?.periodStart || '')} - {formatDate(analytics?.periodEnd || '')}
          </p>
        </div>

        {/* Executive Summary */}
        <div className="bg-gold/5 border border-gold/20 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Executive Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-gold">{formatNumber(dealer.clickThroughs)}</p>
              <p className="text-sm text-charcoal mt-1">Click-Throughs</p>
              <p className="text-xs text-muted">to your website</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-ink">{formatNumber(dealer.uniqueVisitors)}</p>
              <p className="text-sm text-charcoal mt-1">Unique Visitors</p>
              <p className="text-xs text-muted">interested in your items</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-ink">{formatNumber(dealer.listingViews)}</p>
              <p className="text-sm text-charcoal mt-1">Listing Views</p>
              <p className="text-xs text-muted">detailed engagement</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-ink">#{dealer.clicksRank}</p>
              <p className="text-sm text-charcoal mt-1">Traffic Rank</p>
              <p className="text-xs text-muted">of {analytics?.totalDealers} dealers</p>
            </div>
          </div>
        </div>

        {/* Traffic Value Proposition */}
        <div className="bg-paper border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Traffic Value</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="font-medium text-ink">Total Click-Throughs</p>
                <p className="text-sm text-muted">Visitors sent directly to your website</p>
              </div>
              <p className="text-2xl font-bold text-ink">{formatNumber(dealer.clickThroughs)}</p>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="font-medium text-ink">Estimated Traffic Value</p>
                <p className="text-sm text-muted">At $2-5 per qualified visitor (industry avg)</p>
              </div>
              <p className="text-2xl font-bold text-green-600">
                ${formatNumber(dealer.clickThroughs * 3)} - ${formatNumber(dealer.clickThroughs * 5)}
              </p>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-ink">Clicks Per Listing</p>
                <p className="text-sm text-muted">Efficiency of your inventory exposure</p>
              </div>
              <p className="text-2xl font-bold text-ink">{dealer.clicksPerListing.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-paper border border-border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-ink">{formatNumber(dealer.favorites)}</p>
            <p className="text-sm text-charcoal mt-1">Favorites</p>
            <p className="text-xs text-muted">Users saved your items</p>
          </div>
          <div className="bg-paper border border-border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-ink">{formatDuration(dealer.avgDwellMs)}</p>
            <p className="text-sm text-charcoal mt-1">Avg View Time</p>
            <p className="text-xs text-muted">Per listing engagement</p>
          </div>
          <div className="bg-paper border border-border rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-ink">Top {dealer.clicksPercentile}%</p>
            <p className="text-sm text-charcoal mt-1">Traffic Percentile</p>
            <p className="text-xs text-muted">Among all dealers</p>
          </div>
        </div>

        {/* Inventory Overview */}
        <div className="bg-paper border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Your Inventory on Nihontowatch</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted uppercase tracking-wider">Active Listings</p>
              <p className="text-2xl font-bold text-ink mt-1">{formatNumber(dealer.activeListings)}</p>
            </div>
            <div>
              <p className="text-sm text-muted uppercase tracking-wider">Total Inventory Value</p>
              <p className="text-2xl font-bold text-ink mt-1">{formatCurrency(dealer.totalValueJpy)}</p>
            </div>
            <div>
              <p className="text-sm text-muted uppercase tracking-wider">Average Price</p>
              <p className="text-2xl font-bold text-ink mt-1">{formatCurrency(dealer.avgPriceJpy)}</p>
            </div>
          </div>
        </div>

        {/* Daily Trend */}
        <div className="bg-paper border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Daily Click Trend</h2>
          <div className="flex items-end gap-1 h-32">
            {dealerDailyClicks.slice(-14).map((day, i) => {
              const maxClicks = Math.max(...dealerDailyClicks.map(d => d.clicks), 1);
              const height = (day.clicks / maxClicks) * 100;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gold/60 rounded-t min-h-[2px]"
                    style={{ height: `${Math.max(2, height)}%` }}
                    title={`${day.date}: ${day.clicks} clicks`}
                  />
                  {i % 2 === 0 && (
                    <p className="text-[8px] text-muted mt-1 rotate-45 origin-left">
                      {day.date.slice(5)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-ink text-white rounded-lg p-6 text-center print:bg-gray-100 print:text-ink">
          <h2 className="text-xl font-semibold mb-2">Partner with Nihontowatch</h2>
          <p className="text-white/80 print:text-charcoal mb-4">
            We&apos;re driving qualified collectors to your inventory. Let&apos;s discuss how we can grow together.
          </p>
          <p className="text-sm text-white/60 print:text-muted">
            Contact: partner@nihontowatch.com
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted pt-8 border-t border-border">
          <p>Generated by Nihontowatch Analytics</p>
          <p className="mt-1">nihontowatch.com</p>
        </div>
      </div>
    </div>
  );
}
