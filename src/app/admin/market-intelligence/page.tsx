'use client';

import { useState, useMemo, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import {
  MetricCard,
  PriceChangesTable,
  FilterBar,
  ChartSkeleton,
} from '@/components/admin/analytics';
import type { AnalyticsFilters, AnalyticsPeriod } from '@/types/analytics';
import { DEFAULT_ANALYTICS_FILTERS, getPeriodLabel } from '@/types/analytics';
import { useMarketIntelligence } from '@/hooks/useMarketIntelligence';

// Dynamic imports for heavy Recharts-based components (~200KB total)
// This reduces initial bundle size for the admin page
const PriceDistributionChart = lazy(() =>
  import('@/components/admin/analytics/PriceDistributionChart').then((mod) => ({
    default: mod.PriceDistributionChart,
  }))
);

const CategoryBreakdownChart = lazy(() =>
  import('@/components/admin/analytics/CategoryBreakdownChart').then((mod) => ({
    default: mod.CategoryBreakdownChart,
  }))
);

const DealerMarketShareChart = lazy(() =>
  import('@/components/admin/analytics/DealerMarketShareChart').then((mod) => ({
    default: mod.DealerMarketShareChart,
  }))
);

const TrendLineChart = lazy(() =>
  import('@/components/admin/analytics/TrendLineChart').then((mod) => ({
    default: mod.TrendLineChart,
  }))
);

/**
 * Chart metric icon component
 */
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
      />
    </svg>
  );
}

/**
 * Currency icon component
 */
function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Document icon component
 */
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
 * Download/Export icon component
 */
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
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
 * Market Intelligence Dashboard Page
 *
 * Comprehensive market analytics dashboard showing:
 * - Key metrics (total value, listings, median price, activity)
 * - Price distribution histogram
 * - Category breakdown pie chart
 * - Price trend line chart
 * - Dealer market share horizontal bar chart
 * - Recent price changes table
 */
export default function MarketIntelligencePage() {
  const router = useRouter();

  // Filter state
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_ANALYTICS_FILTERS);

  // Category chart metric toggle
  const [categoryMetric, setCategoryMetric] = useState<'count' | 'value'>('value');

  // Dealer chart metric toggle
  const [dealerMetric, setDealerMetric] = useState<'count' | 'value'>('value');

  // Fetch all market intelligence data
  const {
    data,
    loading,
    errors,
    refreshAll,
    isLoading,
    lastUpdated,
  } = useMarketIntelligence({
    filters,
    autoRefresh: false,
  });

  // Filter options for dropdowns (derived from data)
  const itemTypeOptions = useMemo(() => {
    if (!data.categoryBreakdown?.categories) return [];
    return data.categoryBreakdown.categories.map((cat) => ({
      value: cat.itemType,
      label: cat.displayName,
      count: cat.availableCount,
    }));
  }, [data.categoryBreakdown]);

  const dealerOptions = useMemo(() => {
    if (!data.dealerBreakdown?.dealers) return [];
    return data.dealerBreakdown.dealers.map((dealer) => ({
      value: String(dealer.dealerId),
      label: dealer.dealerName,
      count: dealer.availableCount,
    }));
  }, [data.dealerBreakdown]);

  // Certification options - must match exact cert_type values in database
  const certificationOptions = useMemo(() => {
    return [
      { value: 'Juyo', label: 'Juyo' },
      { value: 'Tokuju', label: 'Tokubetsu Juyo' },
      { value: 'Hozon', label: 'Hozon' },
      { value: 'TokuHozon', label: 'Tokubetsu Hozon' },
      { value: 'TokuKicho', label: 'Tokubetsu Kicho' },
    ];
  }, []);

  // Handle filter changes
  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
  };

  // Handle export (placeholder)
  const handleExport = () => {
    // TODO: Implement export functionality
    alert('Export functionality coming soon');
  };

  // Handle listing click in price changes table
  const handleViewListing = (listingId: number) => {
    router.push(`/listing/${listingId}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-ink">Market Intelligence</h1>
          <p className="text-muted text-sm mt-1">
            Comprehensive market analysis and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Last updated indicator */}
          <span className="text-xs text-muted">
            Updated {formatLastUpdated(lastUpdated)}
          </span>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
              ${isLoading
                ? 'bg-linen border-border text-muted cursor-not-allowed'
                : 'bg-cream border-border text-charcoal hover:bg-linen'
              }
            `}
          >
            <RefreshIcon className="w-4 h-4" spinning={isLoading} />
            Refresh
          </button>

          {/* Export button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gold text-white hover:bg-gold/90 transition-colors"
          >
            <DownloadIcon className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        itemTypeOptions={itemTypeOptions}
        certificationOptions={certificationOptions}
        dealerOptions={dealerOptions}
        loading={isLoading}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Market Value"
          value={data.overview?.totalMarketValue ?? 0}
          format="currency"
          currency="JPY"
          subtitle={`${data.overview?.availableListings?.toLocaleString() ?? 0} available listings`}
          change={
            data.overview?.changes?.totalValue
              ? {
                  value: data.overview.changes.totalValue.amount,
                  percent: data.overview.changes.totalValue.percent,
                  period: `vs ${getPeriodLabel(data.overview.changes.totalValue.period as AnalyticsPeriod).toLowerCase()}`,
                }
              : undefined
          }
          icon={<CurrencyIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Available Listings"
          value={data.overview?.availableListings ?? 0}
          format="number"
          subtitle={`${data.overview?.totalListings?.toLocaleString() ?? 0} total`}
          change={
            data.overview?.changes?.listingCount
              ? {
                  value: data.overview.changes.listingCount.amount,
                  percent: data.overview.changes.listingCount.percent,
                  period: `vs ${getPeriodLabel(data.overview.changes.listingCount.period as AnalyticsPeriod).toLowerCase()}`,
                }
              : undefined
          }
          icon={<DocumentIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Median Price"
          value={data.overview?.medianPrice ?? 0}
          format="currency"
          currency="JPY"
          subtitle={
            data.overview?.priceRange
              ? `Range: ${formatCompactPrice(data.overview.priceRange.min)} - ${formatCompactPrice(data.overview.priceRange.max)}`
              : undefined
          }
          change={
            data.overview?.changes?.medianPrice
              ? {
                  value: data.overview.changes.medianPrice.amount,
                  percent: data.overview.changes.medianPrice.percent,
                  period: `vs ${getPeriodLabel(data.overview.changes.medianPrice.period as AnalyticsPeriod).toLowerCase()}`,
                }
              : undefined
          }
          icon={<ChartIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="24h Activity"
          value={
            data.overview?.activity24h
              ? data.overview.activity24h.newListings +
                data.overview.activity24h.soldListings +
                data.overview.activity24h.priceChanges
              : 0
          }
          format="number"
          subtitle={
            data.overview?.activity24h
              ? `${data.overview.activity24h.newListings} new, ${data.overview.activity24h.priceChanges} price changes`
              : undefined
          }
          icon={<ActivityIcon className="w-6 h-6" />}
          loading={loading.overview}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Price Distribution */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-ink">Price Distribution</h2>
          </div>
          {errors.distribution ? (
            <ErrorDisplay message={errors.distribution} />
          ) : (
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <PriceDistributionChart
                buckets={data.distribution?.buckets ?? []}
                statistics={
                  data.distribution?.statistics ?? {
                    count: 0,
                    mean: 0,
                    median: 0,
                    stdDev: 0,
                    skewness: 0,
                    percentiles: { p10: 0, p25: 0, p75: 0, p90: 0 },
                  }
                }
                highlightMedian
                height={300}
                loading={loading.distribution}
              />
            </Suspense>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-ink">Category Breakdown</h2>
            <MetricToggle
              value={categoryMetric}
              onChange={setCategoryMetric}
              disabled={loading.categoryBreakdown}
            />
          </div>
          {errors.categoryBreakdown ? (
            <ErrorDisplay message={errors.categoryBreakdown} />
          ) : (
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <CategoryBreakdownChart
                categories={data.categoryBreakdown?.categories ?? []}
                metric={categoryMetric}
                showLegend
                height={300}
                loading={loading.categoryBreakdown}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Price Trend */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-ink">
              Price Trend ({getPeriodLabel(filters.period)})
            </h2>
          </div>
          {errors.trends ? (
            <ErrorDisplay message={errors.trends} />
          ) : (
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <TrendLineChart
                dataPoints={data.trends?.dataPoints ?? []}
                summary={
                  data.trends?.summary ?? {
                    startValue: 0,
                    endValue: 0,
                    minValue: 0,
                    maxValue: 0,
                    totalChange: 0,
                    totalChangePercent: 0,
                    trend: 'stable',
                    volatility: 0,
                  }
                }
                trendLine={data.trends?.trendLine}
                showTrendLine
                metric="median_price"
                height={300}
                loading={loading.trends}
              />
            </Suspense>
          )}
        </div>

        {/* Dealer Market Share */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg text-ink">Dealer Market Share</h2>
            <MetricToggle
              value={dealerMetric}
              onChange={setDealerMetric}
              disabled={loading.dealerBreakdown}
            />
          </div>
          {errors.dealerBreakdown ? (
            <ErrorDisplay message={errors.dealerBreakdown} />
          ) : (
            <Suspense fallback={<ChartSkeleton height={400} />}>
              <DealerMarketShareChart
                dealers={data.dealerBreakdown?.dealers ?? []}
                metric={dealerMetric}
                limit={10}
                height={400}
                loading={loading.dealerBreakdown}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Price Changes Table */}
      <div className="bg-cream rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Recent Price Changes</h2>
          {data.priceChanges?.totalCount != null && data.priceChanges.totalCount > 0 && (
            <span className="text-xs text-muted">
              {data.priceChanges.totalCount.toLocaleString()} changes in period
            </span>
          )}
        </div>
        {errors.priceChanges ? (
          <div className="p-6">
            <ErrorDisplay message={errors.priceChanges} />
          </div>
        ) : (
          <PriceChangesTable
            changes={data.priceChanges?.changes ?? []}
            loading={loading.priceChanges}
            onViewListing={handleViewListing}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Toggle button group for switching between count and value metrics
 */
function MetricToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: 'count' | 'value';
  onChange: (value: 'count' | 'value') => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('value')}
        disabled={disabled}
        className={`
          px-3 py-1.5 text-xs font-medium transition-colors
          ${value === 'value'
            ? 'bg-gold text-white'
            : 'bg-cream text-charcoal hover:bg-linen'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        Value
      </button>
      <button
        type="button"
        onClick={() => onChange('count')}
        disabled={disabled}
        className={`
          px-3 py-1.5 text-xs font-medium transition-colors border-l border-border
          ${value === 'count'
            ? 'bg-gold text-white'
            : 'bg-cream text-charcoal hover:bg-linen'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        Count
      </button>
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
 * Format price in compact notation
 */
function formatCompactPrice(value: number): string {
  if (value >= 1000000000) {
    return `¥${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `¥${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `¥${(value / 1000).toFixed(0)}K`;
  }
  return `¥${value.toLocaleString()}`;
}
