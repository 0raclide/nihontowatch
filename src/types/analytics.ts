/**
 * Analytics and Market Intelligence Type Definitions
 *
 * Types for the market analytics dashboard, price distribution analysis,
 * trend tracking, and dealer/category breakdowns.
 *
 * @module types/analytics
 */

import type { Currency, ItemType } from './index';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Valid time periods for analytics queries
 */
export const ANALYTICS_PERIODS = ['7d', '30d', '90d', '180d', '1y', 'all'] as const;

/**
 * Valid granularity options for time series data
 */
export const ANALYTICS_GRANULARITIES = ['daily', 'weekly', 'monthly'] as const;

/**
 * Valid trend directions
 */
export const TREND_DIRECTIONS = ['up', 'down', 'stable'] as const;

/**
 * Valid analytics metrics that can be tracked
 */
export const ANALYTICS_METRICS = [
  'total_listings',
  'available_listings',
  'sold_listings',
  'total_value',
  'median_price',
  'average_price',
  'new_listings',
  'price_changes',
] as const;

// =============================================================================
// PERIOD TYPES
// =============================================================================

/**
 * Time period for analytics calculations
 * - '7d': Last 7 days
 * - '30d': Last 30 days
 * - '90d': Last 90 days (quarter)
 * - '180d': Last 180 days (half year)
 * - '1y': Last year
 * - 'all': All time
 */
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

/**
 * Granularity for time series data points
 */
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

/**
 * Direction of a trend (price, volume, etc.)
 */
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

/**
 * Available metrics for analytics tracking
 */
export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

// =============================================================================
// CHANGE METRICS
// =============================================================================

/**
 * Represents a change in a metric over a time period.
 * Used for showing period-over-period comparisons (e.g., "up 5% vs last week").
 */
export interface ChangeMetric {
  /** Absolute change amount (can be negative) */
  amount: number;
  /** Percentage change (can be negative) */
  percent: number;
  /** The comparison period */
  period: '7d' | '30d' | '90d';
}

// =============================================================================
// MARKET OVERVIEW
// =============================================================================

/**
 * High-level market statistics providing a snapshot of the entire marketplace.
 * Used for the main dashboard overview widget.
 */
export interface MarketOverview {
  /** ISO timestamp when this data was calculated */
  asOf: string;

  // Listing counts
  /** Total number of listings in the database */
  totalListings: number;
  /** Number of currently available listings */
  availableListings: number;
  /** Number of sold listings */
  soldListings: number;

  // Value metrics
  /** Total market value of all available listings */
  totalMarketValue: number;
  /** Currency for all monetary values in this response */
  currency: Currency;
  /** Median price of available listings */
  medianPrice: number;
  /** Average (mean) price of available listings */
  averagePrice: number;

  /** Price range of available listings */
  priceRange: {
    min: number;
    max: number;
  };

  /** Price distribution percentiles */
  percentiles: {
    /** 10th percentile price */
    p10: number;
    /** 25th percentile price (first quartile) */
    p25: number;
    /** 75th percentile price (third quartile) */
    p75: number;
    /** 90th percentile price */
    p90: number;
  };

  /** Activity in the last 24 hours */
  activity24h: {
    /** New listings added */
    newListings: number;
    /** Listings marked as sold */
    soldListings: number;
    /** Price changes detected */
    priceChanges: number;
  };

  /** Period-over-period changes for key metrics */
  changes: {
    /** Change in total market value */
    totalValue: ChangeMetric;
    /** Change in median price */
    medianPrice: ChangeMetric;
    /** Change in listing count */
    listingCount: ChangeMetric;
  };
}

// =============================================================================
// PRICE DISTRIBUTION
// =============================================================================

/**
 * A single bucket in a price histogram.
 * Used for visualizing price distribution charts.
 */
export interface PriceBucket {
  /** Lower bound of this price range (inclusive) */
  rangeStart: number;
  /** Upper bound of this price range (exclusive, except for last bucket) */
  rangeEnd: number;
  /** Human-readable label for this range (e.g., "¥100,000 - ¥500,000") */
  label: string;
  /** Number of listings in this price range */
  count: number;
  /** Percentage of total listings in this bucket */
  percentage: number;
  /** Cumulative percentage up to and including this bucket */
  cumulativePercentage: number;
}

/**
 * Statistical summary of price data.
 * Provides key metrics for understanding price distribution.
 */
export interface PriceStatistics {
  /** Total number of listings analyzed */
  count: number;
  /** Arithmetic mean of prices */
  mean: number;
  /** Median price (50th percentile) */
  median: number;
  /** Standard deviation of prices */
  stdDev: number;
  /** Skewness - positive means right-skewed (long tail of high prices) */
  skewness: number;
  /** Price distribution percentiles */
  percentiles: {
    p10: number;
    p25: number;
    p75: number;
    p90: number;
  };
}

/**
 * Complete price distribution response including histogram and statistics.
 * Used for the price distribution chart and statistics panel.
 */
export interface PriceDistributionResponse {
  /** Histogram buckets for charting */
  buckets: PriceBucket[];
  /** Statistical summary */
  statistics: PriceStatistics;
  /** Filters that were applied to generate this data */
  filters: {
    /** Item type filter (null = all types) */
    itemType: string | null;
    /** Certification filter (null = all certifications) */
    certification: string | null;
    /** Dealer filter (null = all dealers) */
    dealer: string | null;
  };
}

// =============================================================================
// CATEGORY BREAKDOWN
// =============================================================================

/**
 * Metrics for a single item category (e.g., Katana, Tsuba).
 * Used for the category comparison chart and table.
 */
export interface CategoryMetrics {
  /** Item type identifier (e.g., 'katana', 'tsuba') */
  itemType: ItemType;
  /** Human-readable display name (e.g., 'Katana', 'Tsuba') */
  displayName: string;

  // Counts
  /** Total listings in this category */
  totalCount: number;
  /** Available listings */
  availableCount: number;
  /** Sold listings */
  soldCount: number;

  // Value metrics (in JPY for consistency)
  /** Total value of available listings in JPY */
  totalValueJPY: number;
  /** Median price in JPY */
  medianPriceJPY: number;
  /** Average price in JPY */
  avgPriceJPY: number;

  /** Price range for this category */
  priceRange: {
    min: number;
    max: number;
  };

  // Market share
  /** Share of total listing count (0-1) */
  countShare: number;
  /** Share of total market value (0-1) */
  valueShare: number;

  /**
   * Percentage above or below overall market median.
   * Positive = this category's median is above market.
   * Negative = this category's median is below market.
   * Example: 0.25 means 25% above market median.
   */
  priceVsMarket: number;
}

/**
 * Complete category breakdown response.
 * Used for the category analysis section of the dashboard.
 */
export interface CategoryBreakdownResponse {
  /** Metrics for each category */
  categories: CategoryMetrics[];
  /** Market totals for context */
  totals: {
    totalCount: number;
    totalValueJPY: number;
    medianPriceJPY: number;
  };
}

// =============================================================================
// DEALER BREAKDOWN
// =============================================================================

/**
 * Metrics for a single dealer.
 * Used for dealer comparison and market share analysis.
 */
export interface DealerMetrics {
  /** Dealer ID in the database */
  dealerId: number;
  /** Dealer name (e.g., "Aoi Art") */
  dealerName: string;

  // Counts
  /** Total listings from this dealer */
  totalCount: number;
  /** Currently available listings */
  availableCount: number;

  // Value metrics (in JPY)
  /** Total value of available listings in JPY */
  totalValueJPY: number;
  /** Median price in JPY */
  medianPriceJPY: number;
  /** Average price in JPY */
  avgPriceJPY: number;

  // Market share
  /** Share of total listing count (0-1) */
  countShare: number;
  /** Share of total market value (0-1) */
  valueShare: number;
}

/**
 * Complete dealer breakdown response.
 * Used for the dealer analysis section of the dashboard.
 */
export interface DealerBreakdownResponse {
  /** Metrics for each dealer */
  dealers: DealerMetrics[];
  /** Market totals for context */
  totals: {
    totalCount: number;
    totalValueJPY: number;
  };
}

// =============================================================================
// TREND DATA (TIME SERIES)
// =============================================================================

/**
 * A single data point in a time series trend.
 */
export interface TrendDataPoint {
  /** ISO date string for this data point */
  date: string;
  /** The metric value at this point */
  value: number;
  /** Change from previous data point (absolute) */
  change: number;
  /** Percentage change from previous data point */
  changePercent: number;
}

/**
 * Summary statistics for a trend over the entire period.
 */
export interface TrendSummary {
  /** Value at the start of the period */
  startValue: number;
  /** Value at the end of the period */
  endValue: number;
  /** Minimum value during the period */
  minValue: number;
  /** Maximum value during the period */
  maxValue: number;
  /** Total change over the period (absolute) */
  totalChange: number;
  /** Total percentage change over the period */
  totalChangePercent: number;
  /** Overall trend direction */
  trend: TrendDirection;
  /**
   * Volatility measure (coefficient of variation).
   * Higher values indicate more price volatility.
   */
  volatility: number;
}

/**
 * Linear regression trend line for forecasting.
 * Calculated using least squares regression.
 */
export interface TrendLine {
  /** Slope of the trend line (rate of change per time unit) */
  slope: number;
  /** Y-intercept of the trend line */
  intercept: number;
  /** R-squared value (0-1) - goodness of fit */
  rSquared: number;
}

/**
 * Complete trend response including time series data and analysis.
 * Used for trend charts and forecasting widgets.
 */
export interface TrendResponse {
  /** The metric being tracked */
  metric: AnalyticsMetric;
  /** Time period covered */
  period: AnalyticsPeriod;
  /** Data point granularity */
  granularity: AnalyticsGranularity;
  /** Time series data points */
  dataPoints: TrendDataPoint[];
  /** Summary statistics for the trend */
  summary: TrendSummary;
  /** Linear regression trend line */
  trendLine: TrendLine;
}

// =============================================================================
// PRICE CHANGES
// =============================================================================

/**
 * A record of a price change on a listing.
 * Used for the "Recent Price Changes" feed.
 */
export interface PriceChangeRecord {
  /** Listing database ID */
  listingId: number;
  /** Listing title */
  title: string;
  /** Dealer name */
  dealerName: string;
  /** Item type */
  itemType: ItemType;
  /** Previous price */
  oldPrice: number;
  /** New price */
  newPrice: number;
  /** Absolute change amount (can be negative for price drops) */
  changeAmount: number;
  /** Percentage change (can be negative for price drops) */
  changePercent: number;
  /** ISO timestamp when the change was detected */
  detectedAt: string;
}

/**
 * Response for price change queries.
 */
export interface PriceChangesResponse {
  /** List of price change records */
  changes: PriceChangeRecord[];
  /** Total count of price changes in the period (for pagination) */
  totalCount: number;
  /** Time period covered */
  period: AnalyticsPeriod;
}

// =============================================================================
// FILTERS
// =============================================================================

/**
 * Date range for filtering analytics data.
 */
export interface DateRange {
  /** ISO date string for start (inclusive) */
  start: string;
  /** ISO date string for end (inclusive) */
  end: string;
}

/**
 * Filter state for analytics queries.
 * All fields are optional - null/undefined means "no filter".
 */
export interface AnalyticsFilters {
  /** Filter by item type */
  itemType: ItemType | null;
  /** Filter by certification type */
  certification: string | null;
  /** Filter by dealer ID */
  dealerId: number | null;
  /** Custom date range filter */
  dateRange: DateRange | null;
  /** Predefined time period (takes precedence over dateRange if both set) */
  period: AnalyticsPeriod;
}

/**
 * Default analytics filter values.
 */
export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilters = {
  itemType: null,
  certification: null,
  dealerId: null,
  dateRange: null,
  period: '30d',
};

// =============================================================================
// API RESPONSE WRAPPERS
// =============================================================================

/**
 * Standard analytics API response wrapper.
 * Provides consistent structure for all analytics endpoints.
 *
 * @template T The type of data payload
 */
export interface AnalyticsAPIResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** The data payload (present if success is true) */
  data?: T;
  /** Error message (present if success is false) */
  error?: string;
  /** ISO timestamp when this response was generated */
  timestamp: string;
}

/**
 * Paginated analytics response for large datasets.
 *
 * @template T The type of items in the data array
 */
export interface PaginatedAnalyticsResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** The data items */
  data?: T[];
  /** Total count of items (across all pages) */
  totalCount?: number;
  /** Current page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Total number of pages */
  totalPages?: number;
  /** Error message (present if success is false) */
  error?: string;
  /** ISO timestamp when this response was generated */
  timestamp: string;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a string is a valid analytics period.
 *
 * @param value - The value to check
 * @returns True if the value is a valid AnalyticsPeriod
 *
 * @example
 * ```typescript
 * const period = '30d';
 * if (isValidPeriod(period)) {
 *   // period is typed as AnalyticsPeriod here
 *   fetchData(period);
 * }
 * ```
 */
export function isValidPeriod(value: string): value is AnalyticsPeriod {
  return ANALYTICS_PERIODS.includes(value as AnalyticsPeriod);
}

/**
 * Type guard to check if a string is a valid analytics granularity.
 *
 * @param value - The value to check
 * @returns True if the value is a valid AnalyticsGranularity
 */
export function isValidGranularity(value: string): value is AnalyticsGranularity {
  return ANALYTICS_GRANULARITIES.includes(value as AnalyticsGranularity);
}

/**
 * Type guard to check if a string is a valid trend direction.
 *
 * @param value - The value to check
 * @returns True if the value is a valid TrendDirection
 */
export function isValidTrendDirection(value: string): value is TrendDirection {
  return TREND_DIRECTIONS.includes(value as TrendDirection);
}

/**
 * Type guard to check if a string is a valid analytics metric.
 *
 * @param value - The value to check
 * @returns True if the value is a valid AnalyticsMetric
 */
export function isValidMetric(value: string): value is AnalyticsMetric {
  return ANALYTICS_METRICS.includes(value as AnalyticsMetric);
}

/**
 * Type guard to check if an API response is successful.
 *
 * @param response - The analytics API response to check
 * @returns True if the response has success=true and data is present
 */
export function isSuccessResponse<T>(
  response: AnalyticsAPIResponse<T>
): response is AnalyticsAPIResponse<T> & { data: T } {
  return response.success === true && response.data !== undefined;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extracts the data type from an AnalyticsAPIResponse.
 *
 * @example
 * ```typescript
 * type OverviewData = ExtractAnalyticsData<AnalyticsAPIResponse<MarketOverview>>;
 * // OverviewData is MarketOverview
 * ```
 */
export type ExtractAnalyticsData<T> = T extends AnalyticsAPIResponse<infer U> ? U : never;

/**
 * Makes all properties of AnalyticsFilters required (non-null).
 * Useful for internal processing after defaults are applied.
 */
export type RequiredAnalyticsFilters = {
  [K in keyof AnalyticsFilters]-?: NonNullable<AnalyticsFilters[K]>;
};

/**
 * Partial analytics filters - all fields optional.
 * Useful for filter update functions.
 */
export type PartialAnalyticsFilters = Partial<AnalyticsFilters>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the number of days for a given analytics period.
 *
 * @param period - The analytics period
 * @returns Number of days, or null for 'all'
 */
export function getPeriodDays(period: AnalyticsPeriod): number | null {
  const periodMap: Record<AnalyticsPeriod, number | null> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '180d': 180,
    '1y': 365,
    'all': null,
  };
  return periodMap[period];
}

/**
 * Get a human-readable label for an analytics period.
 *
 * @param period - The analytics period
 * @returns Human-readable label
 */
export function getPeriodLabel(period: AnalyticsPeriod): string {
  const labels: Record<AnalyticsPeriod, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    '180d': 'Last 6 months',
    '1y': 'Last year',
    'all': 'All time',
  };
  return labels[period];
}

/**
 * Get a human-readable label for a granularity.
 *
 * @param granularity - The data granularity
 * @returns Human-readable label
 */
export function getGranularityLabel(granularity: AnalyticsGranularity): string {
  const labels: Record<AnalyticsGranularity, string> = {
    'daily': 'Daily',
    'weekly': 'Weekly',
    'monthly': 'Monthly',
  };
  return labels[granularity];
}

/**
 * Get a human-readable label for a metric.
 *
 * @param metric - The analytics metric
 * @returns Human-readable label
 */
export function getMetricLabel(metric: AnalyticsMetric): string {
  const labels: Record<AnalyticsMetric, string> = {
    'total_listings': 'Total Listings',
    'available_listings': 'Available Listings',
    'sold_listings': 'Sold Listings',
    'total_value': 'Total Market Value',
    'median_price': 'Median Price',
    'average_price': 'Average Price',
    'new_listings': 'New Listings',
    'price_changes': 'Price Changes',
  };
  return labels[metric];
}
