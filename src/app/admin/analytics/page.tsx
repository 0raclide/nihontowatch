'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MetricCard,
  ChartSkeleton,
  ConversionFunnelChart,
  UserGrowthChart,
  SearchTermsTable,
} from '@/components/admin/analytics';
import { useUserEngagement } from '@/hooks/useUserEngagement';
import type { TopListing } from '@/hooks/useUserEngagement';

/**
 * Period type for analytics time ranges
 */
type AnalyticsPeriod = '7d' | '30d' | '90d';

/**
 * Users icon component
 */
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

/**
 * Activity icon component
 */
function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

/**
 * Clock icon component
 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Search icon component
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

/**
 * Refresh icon component
 */
function RefreshIcon({ className, spinning }: { className?: string; spinning?: boolean }) {
  return (
    <svg
      className={`${className} ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

/**
 * Eye icon for views
 */
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

/**
 * Heart icon for favorites
 */
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

/**
 * Format duration in seconds to readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format relative time for last updated display
 */
function formatLastUpdated(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Calculate percentage change between two values
 */
function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Get item type badge color
 */
function getItemTypeBadgeColor(itemType: string): string {
  const type = itemType.toLowerCase();
  if (type === 'katana') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (type === 'wakizashi') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (type === 'tanto') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  if (type === 'tsuba') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

/**
 * Top Listings Item Component
 */
function TopListingItem({ listing, rank }: { listing: TopListing; rank: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-linen/30 transition-colors">
      {/* Rank */}
      <span className="text-lg font-serif text-muted w-6 text-center flex-shrink-0">{rank}</span>

      {/* Listing info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/listing/${listing.id}`}
          className="text-sm font-medium text-ink hover:text-gold transition-colors line-clamp-1"
        >
          {listing.title}
        </Link>
        <div className="flex items-center gap-3 mt-1">
          {/* Item type badge */}
          <span
            className={`text-xs px-1.5 py-0.5 rounded capitalize ${getItemTypeBadgeColor(
              listing.itemType
            )}`}
          >
            {listing.itemType}
          </span>
          {/* Dealer name */}
          <span className="text-xs text-muted truncate">{listing.dealerName}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Views */}
        <div className="flex items-center gap-1 text-muted">
          <EyeIcon className="w-3.5 h-3.5" />
          <span className="text-xs tabular-nums">{listing.views.toLocaleString()}</span>
        </div>
        {/* Favorites */}
        <div className="flex items-center gap-1 text-muted">
          <HeartIcon className="w-3.5 h-3.5" />
          <span className="text-xs tabular-nums">{listing.favorites.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Top Listings Card Component
 */
function TopListingsCard({
  listings,
  loading,
}: {
  listings: TopListing[] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-cream rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <div className="h-5 w-32 bg-linen rounded animate-shimmer" />
        </div>
        <div className="divide-y divide-border/50">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div
                className="h-6 w-6 bg-linen rounded animate-shimmer"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
              <div className="flex-1">
                <div
                  className="h-4 w-3/4 bg-linen rounded animate-shimmer"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
                <div
                  className="h-3 w-1/3 bg-linen rounded animate-shimmer mt-2"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              </div>
              <div className="flex gap-4">
                <div
                  className="h-4 w-12 bg-linen rounded animate-shimmer"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
                <div
                  className="h-4 w-12 bg-linen rounded animate-shimmer"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="bg-cream rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-serif text-lg text-ink">Top Listings</h2>
        </div>
        <div className="px-6 py-12 text-center">
          <EyeIcon className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">No listing data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream rounded-xl border border-border">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-serif text-lg text-ink">Top Listings</h2>
      </div>
      <div className="divide-y divide-border/50">
        {listings.slice(0, 10).map((listing, index) => (
          <TopListingItem key={listing.id} listing={listing} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[300px] bg-error/5 rounded-lg border border-error/20">
      <div className="text-center">
        <svg
          className="w-12 h-12 text-error mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-error text-sm font-medium">Error loading data</p>
        <p className="text-muted text-xs mt-1 max-w-xs">{message}</p>
      </div>
    </div>
  );
}

/**
 * Summary stats card for user growth
 */
function GrowthSummaryCard({
  totalNewUsers,
  avgDailySignups,
  peakDay,
  peakCount,
  loading,
}: {
  totalNewUsers: number;
  avgDailySignups: number;
  peakDay: string;
  peakCount: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-cream rounded-lg border border-border p-4 mt-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div
                className="h-3 w-20 bg-linen rounded animate-shimmer mb-2"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
              <div
                className="h-6 w-16 bg-linen rounded animate-shimmer"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formattedPeakDay = peakDay
    ? new Date(peakDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'N/A';

  return (
    <div className="bg-cream rounded-lg border border-border p-4 mt-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">New Users</p>
          <p className="text-xl font-serif text-ink mt-1">{totalNewUsers.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">Daily Avg</p>
          <p className="text-xl font-serif text-ink mt-1">{avgDailySignups.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">Peak Day</p>
          <p className="text-xl font-serif text-ink mt-1">
            {formattedPeakDay}
            <span className="text-sm text-muted ml-1">({peakCount})</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Overall conversion rate card
 */
function ConversionRateCard({
  overallRate,
  loading,
}: {
  overallRate: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-cream rounded-lg border border-border p-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 bg-linen rounded animate-shimmer" />
          <div className="h-8 w-20 bg-linen rounded animate-shimmer" />
        </div>
      </div>
    );
  }

  // Color code based on rate
  const rateColorClass =
    overallRate >= 10
      ? 'text-green-500'
      : overallRate >= 5
        ? 'text-yellow-500'
        : 'text-red-500';

  return (
    <div className="bg-cream rounded-lg border border-border p-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">Overall Conversion Rate</p>
          <p className="text-xs text-muted mt-1">Visitors to High Intent</p>
        </div>
        <p className={`text-3xl font-serif ${rateColorClass}`}>{overallRate.toFixed(1)}%</p>
      </div>
    </div>
  );
}

/**
 * User Engagement Analytics Dashboard Page
 *
 * Comprehensive user engagement analytics showing:
 * - Key metrics (total users, active today, session duration, searches)
 * - User growth chart with summary stats
 * - Conversion funnel with overall rate
 * - Popular search terms table
 * - Top listings by views/favorites
 */
export default function UserEngagementAnalyticsPage() {
  // Period state
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');

  // Fetch all user engagement data
  const { data, loading, errors, refreshAll, isLoading, lastUpdated } = useUserEngagement({
    period,
  });

  // Extract data with safe defaults
  const overview = data.overview;
  const growth = data.growth;
  const funnel = data.funnel;
  const searches = data.searches;
  const topListings = data.topListings;

  // Calculate change percentages for metrics
  const userChangePercent = overview
    ? calculateChangePercent(overview.users.newInPeriod, overview.users.newPrevPeriod)
    : 0;

  const searchChangePercent =
    overview && overview.engagement.searchesPrevPeriod > 0
      ? calculateChangePercent(
          overview.engagement.totalSearches,
          overview.engagement.searchesPrevPeriod
        )
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-ink">User Engagement Analytics</h1>
          <p className="text-muted text-sm mt-1">
            Understand how users interact with your platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Last updated indicator */}
          <span className="text-xs text-muted">Updated {formatLastUpdated(lastUpdated)}</span>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
              ${
                isLoading
                  ? 'bg-linen border-border text-muted cursor-not-allowed'
                  : 'bg-cream border-border text-charcoal hover:bg-linen'
              }
            `}
          >
            <RefreshIcon className="w-4 h-4" spinning={isLoading} />
            Refresh
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
          </button>
        ))}
      </div>

      {/* Global error display */}
      {errors.overview && errors.growth && errors.funnel && errors.searches && errors.topListings && (
        <div className="bg-error/10 text-error rounded-lg p-4">
          <p className="font-medium">Error loading analytics</p>
          <p className="text-sm mt-1">
            Failed to load data from all endpoints. Please try refreshing.
          </p>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={overview?.users.total ?? 0}
          format="number"
          subtitle={`${overview?.users.newInPeriod ?? 0} new in period`}
          change={
            userChangePercent !== 0
              ? {
                  value: overview?.users.newInPeriod ?? 0,
                  percent: userChangePercent,
                  period: 'vs previous period',
                }
              : undefined
          }
          icon={<UsersIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Active Today"
          value={overview?.users.activeToday ?? 0}
          format="number"
          subtitle={`${overview?.users.activeInPeriod ?? 0} active in period`}
          icon={<ActivityIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Avg Session Duration"
          value={formatDuration(overview?.sessions.avgDurationSeconds ?? 0)}
          subtitle={`${overview?.sessions.avgPageViews?.toFixed(1) ?? 0} pages per session`}
          icon={<ClockIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Total Searches"
          value={overview?.engagement.totalSearches ?? 0}
          format="number"
          subtitle={`${overview?.engagement.totalFavorites ?? 0} favorites`}
          change={
            searchChangePercent !== 0
              ? {
                  value:
                    (overview?.engagement.totalSearches ?? 0) -
                    (overview?.engagement.searchesPrevPeriod ?? 0),
                  percent: searchChangePercent,
                  period: 'vs previous period',
                }
              : undefined
          }
          icon={<SearchIcon className="w-6 h-6" />}
          loading={loading.overview}
        />
      </div>

      {/* Charts Row 1: User Growth + Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Growth Section */}
        <div>
          <div className="bg-cream rounded-xl border border-border p-6">
            <h2 className="font-serif text-lg text-ink mb-4">User Growth</h2>
            {errors.growth ? (
              <ErrorDisplay message={errors.growth} />
            ) : loading.growth ? (
              <ChartSkeleton height={300} type="bar" />
            ) : (
              <UserGrowthChart
                dataPoints={growth?.dataPoints ?? []}
                loading={false}
                height={300}
                showCumulative={true}
              />
            )}
          </div>
          {/* Growth summary stats */}
          <GrowthSummaryCard
            totalNewUsers={growth?.summary.totalNewUsers ?? 0}
            avgDailySignups={growth?.summary.avgDailySignups ?? 0}
            peakDay={growth?.summary.peakDay ?? ''}
            peakCount={growth?.summary.peakCount ?? 0}
            loading={loading.growth}
          />
        </div>

        {/* Conversion Funnel Section */}
        <div>
          <div className="bg-cream rounded-xl border border-border p-6">
            <h2 className="font-serif text-lg text-ink mb-4">Conversion Funnel</h2>
            {errors.funnel ? (
              <ErrorDisplay message={errors.funnel} />
            ) : (
              <ConversionFunnelChart
                stages={funnel?.stages ?? []}
                loading={loading.funnel}
                height={400}
              />
            )}
          </div>
          {/* Overall conversion rate card */}
          <ConversionRateCard
            overallRate={funnel?.overallConversionRate ?? 0}
            loading={loading.funnel}
          />
        </div>
      </div>

      {/* Charts Row 2: Search Terms + Top Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Search Terms Section */}
        <div>
          <div className="bg-cream rounded-xl border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-serif text-lg text-ink">Popular Search Terms</h2>
              {searches?.totals && (
                <span className="text-xs text-muted">
                  {searches.totals.totalSearches.toLocaleString()} total searches
                </span>
              )}
            </div>
            <div className="p-4">
              {errors.searches ? (
                <ErrorDisplay message={errors.searches} />
              ) : (
                <SearchTermsTable searches={searches?.searches ?? []} loading={loading.searches} />
              )}
            </div>
          </div>
        </div>

        {/* Top Listings Section */}
        <div>
          {errors.topListings ? (
            <div className="bg-cream rounded-xl border border-border p-6">
              <h2 className="font-serif text-lg text-ink mb-4">Top Listings</h2>
              <ErrorDisplay message={errors.topListings} />
            </div>
          ) : (
            <TopListingsCard listings={topListings?.listings} loading={loading.topListings} />
          )}
        </div>
      </div>
    </div>
  );
}
