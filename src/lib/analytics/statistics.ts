/**
 * Statistical utility functions for market intelligence system.
 * All functions are pure (no side effects) and handle edge cases gracefully.
 */

// =============================================================================
// DESCRIPTIVE STATISTICS
// =============================================================================

/**
 * Calculate the arithmetic mean of an array of numbers.
 * @param values - Array of numbers
 * @returns Mean value, or 0 for empty array
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, val) => acc + val, 0) / values.length;
}

/**
 * Calculate the median (50th percentile) of an array of numbers.
 * @param values - Array of numbers
 * @returns Median value, or 0 for empty array
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate the mode (most frequent value) of an array of numbers.
 * @param values - Array of numbers
 * @returns Mode value, or null if no mode exists (all values equally frequent or empty)
 */
export function mode(values: number[]): number | null {
  if (values.length === 0) return null;

  const counts = new Map<number, number>();
  let maxCount = 0;

  for (const val of values) {
    const count = (counts.get(val) || 0) + 1;
    counts.set(val, count);
    if (count > maxCount) {
      maxCount = count;
    }
  }

  // Find all values with maxCount
  const modes: number[] = [];
  for (const [val, count] of counts) {
    if (count === maxCount) {
      modes.push(val);
    }
  }

  // If all values have the same frequency (including single occurrences), return null
  if (modes.length === counts.size) return null;

  // Return the smallest mode if there are ties
  return Math.min(...modes);
}

/**
 * Calculate the variance of an array of numbers (population variance).
 * @param values - Array of numbers
 * @returns Variance value, or 0 for empty array or single value
 */
export function variance(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  return mean(squaredDiffs);
}

/**
 * Calculate the standard deviation of an array of numbers (population).
 * @param values - Array of numbers
 * @returns Standard deviation, or 0 for empty array or single value
 */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Calculate a specific percentile of an array of numbers.
 * Uses linear interpolation between data points.
 * @param values - Array of numbers
 * @param p - Percentile to calculate (0-100)
 * @returns Percentile value, or 0 for empty array
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p < 0 || p > 100) {
    throw new Error('Percentile must be between 0 and 100');
  }

  const sorted = [...values].sort((a, b) => a - b);

  if (p === 0) return sorted[0];
  if (p === 100) return sorted[sorted.length - 1];

  // Calculate the rank
  const rank = (p / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  // Linear interpolation
  const fraction = rank - lowerIndex;
  return sorted[lowerIndex] + fraction * (sorted[upperIndex] - sorted[lowerIndex]);
}

/**
 * Calculate multiple percentiles at once (more efficient than calling percentile multiple times).
 * @param values - Array of numbers
 * @param ps - Array of percentiles to calculate (0-100)
 * @returns Record mapping each percentile to its value
 */
export function percentiles(values: number[], ps: number[]): Record<number, number> {
  if (values.length === 0) {
    return ps.reduce((acc, p) => ({ ...acc, [p]: 0 }), {} as Record<number, number>);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const result: Record<number, number> = {};

  for (const p of ps) {
    if (p < 0 || p > 100) {
      throw new Error(`Percentile ${p} must be between 0 and 100`);
    }

    if (p === 0) {
      result[p] = sorted[0];
    } else if (p === 100) {
      result[p] = sorted[sorted.length - 1];
    } else {
      const rank = (p / 100) * (sorted.length - 1);
      const lowerIndex = Math.floor(rank);
      const upperIndex = Math.ceil(rank);

      if (lowerIndex === upperIndex) {
        result[p] = sorted[lowerIndex];
      } else {
        const fraction = rank - lowerIndex;
        result[p] = sorted[lowerIndex] + fraction * (sorted[upperIndex] - sorted[lowerIndex]);
      }
    }
  }

  return result;
}

/**
 * Calculate the skewness (measure of asymmetry) of a distribution.
 * Positive skew = tail extends to the right
 * Negative skew = tail extends to the left
 * @param values - Array of numbers
 * @returns Skewness value, or 0 for arrays with <= 2 elements
 */
export function skewness(values: number[]): number {
  if (values.length <= 2) return 0;

  const avg = mean(values);
  const stdDev = standardDeviation(values);

  if (stdDev === 0) return 0;

  const n = values.length;
  const sumCubedDiffs = values.reduce((acc, val) => acc + Math.pow((val - avg) / stdDev, 3), 0);

  // Fisher's moment coefficient of skewness (adjusted)
  return (n / ((n - 1) * (n - 2))) * sumCubedDiffs;
}

/**
 * Calculate the coefficient of variation (relative standard deviation).
 * Useful for comparing variability between datasets with different means.
 * @param values - Array of numbers
 * @returns Coefficient of variation (stdDev / mean), or 0 if mean is 0
 */
export function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return standardDeviation(values) / Math.abs(avg);
}

// =============================================================================
// DISTRIBUTION ANALYSIS
// =============================================================================

/**
 * Options for creating histogram buckets.
 */
interface HistogramOptions {
  /** Minimum value for the histogram range (defaults to data minimum) */
  minValue?: number;
  /** Maximum value for the histogram range (defaults to data maximum) */
  maxValue?: number;
  /** If true, use nice round numbers for bucket boundaries */
  useNiceNumbers?: boolean;
}

/**
 * A histogram bucket with range and count information.
 */
interface HistogramBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  percentage: number;
  cumulativePercentage: number;
}

/**
 * Find a "nice" number close to the given value for histogram buckets.
 * Nice numbers are 1, 2, 2.5, 5, 10 and their powers of 10.
 */
function niceNumber(value: number, round: boolean): number {
  if (value === 0) return 0;

  const exp = Math.floor(Math.log10(Math.abs(value)));
  const fraction = value / Math.pow(10, exp);

  let niceFraction: number;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }

  return niceFraction * Math.pow(10, exp);
}

/**
 * Create histogram buckets from an array of values.
 * @param values - Array of numbers
 * @param bucketCount - Number of buckets to create
 * @param options - Optional configuration for histogram generation
 * @returns Array of histogram buckets with counts and percentages
 */
export function createHistogramBuckets(
  values: number[],
  bucketCount: number,
  options: HistogramOptions = {}
): HistogramBucket[] {
  if (values.length === 0 || bucketCount <= 0) {
    return [];
  }

  const { useNiceNumbers = false } = options;

  let minVal = options.minValue ?? Math.min(...values);
  let maxVal = options.maxValue ?? Math.max(...values);

  // Handle case where all values are the same
  if (minVal === maxVal) {
    return [{
      rangeStart: minVal,
      rangeEnd: maxVal,
      count: values.length,
      percentage: 100,
      cumulativePercentage: 100,
    }];
  }

  let bucketWidth: number;

  if (useNiceNumbers) {
    const range = maxVal - minVal;
    bucketWidth = niceNumber(range / bucketCount, true);
    minVal = Math.floor(minVal / bucketWidth) * bucketWidth;
    maxVal = Math.ceil(maxVal / bucketWidth) * bucketWidth;
  } else {
    bucketWidth = (maxVal - minVal) / bucketCount;
  }

  // Initialize buckets
  const actualBucketCount = useNiceNumbers
    ? Math.ceil((maxVal - minVal) / bucketWidth)
    : bucketCount;

  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < actualBucketCount; i++) {
    buckets.push({
      rangeStart: minVal + i * bucketWidth,
      rangeEnd: minVal + (i + 1) * bucketWidth,
      count: 0,
      percentage: 0,
      cumulativePercentage: 0,
    });
  }

  // Count values in each bucket
  for (const val of values) {
    // Find the bucket for this value
    let bucketIndex = Math.floor((val - minVal) / bucketWidth);
    // Clamp to valid range (handle edge case where val === maxVal)
    bucketIndex = Math.min(Math.max(0, bucketIndex), buckets.length - 1);
    buckets[bucketIndex].count++;
  }

  // Calculate percentages
  let cumulative = 0;
  for (const bucket of buckets) {
    bucket.percentage = (bucket.count / values.length) * 100;
    cumulative += bucket.percentage;
    bucket.cumulativePercentage = cumulative;
  }

  return buckets;
}

/**
 * Format a price range for display (e.g., "500K-1M").
 * @param start - Range start value
 * @param end - Range end value
 * @returns Formatted string
 */
export function formatPriceRangeLabel(start: number, end: number): string {
  const formatValue = (val: number): string => {
    if (val >= 1000000000) {
      const b = val / 1000000000;
      return b % 1 === 0 ? `${b}B` : `${b.toFixed(1)}B`;
    }
    if (val >= 1000000) {
      const m = val / 1000000;
      return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
    }
    if (val >= 1000) {
      const k = val / 1000;
      return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
    }
    return val.toString();
  };

  return `${formatValue(start)}-${formatValue(end)}`;
}

// =============================================================================
// TREND ANALYSIS
// =============================================================================

/**
 * Result of linear regression calculation.
 */
interface LinearRegressionResult {
  /** Slope of the regression line */
  slope: number;
  /** Y-intercept of the regression line */
  intercept: number;
  /** Coefficient of determination (R-squared) */
  rSquared: number;
}

/**
 * Perform simple linear regression on a set of points.
 * @param points - Array of {x, y} points
 * @returns Regression result with slope, intercept, and R-squared
 */
export function linearRegression(
  points: Array<{ x: number; y: number }>
): LinearRegressionResult {
  if (points.length === 0) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  if (points.length === 1) {
    return { slope: 0, intercept: points[0].y, rSquared: 1 };
  }

  const n = points.length;

  // Calculate sums
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x * point.x;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate slope and intercept
  const denominator = sumX2 - (sumX * sumX) / n;

  if (denominator === 0) {
    // All x values are the same
    return { slope: 0, intercept: meanY, rSquared: 0 };
  }

  const slope = (sumXY - (sumX * sumY) / n) / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  let ssTotal = 0;
  let ssResidual = 0;

  for (const point of points) {
    const predicted = slope * point.x + intercept;
    ssTotal += Math.pow(point.y - meanY, 2);
    ssResidual += Math.pow(point.y - predicted, 2);
  }

  const rSquared = ssTotal === 0 ? 1 : 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared: Math.max(0, Math.min(1, rSquared)) };
}

/**
 * Calculate the percent change between two values.
 * @param oldValue - Original value
 * @param newValue - New value
 * @returns Percent change (e.g., 50 for 50% increase, -20 for 20% decrease)
 */
export function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    if (newValue === 0) return 0;
    return newValue > 0 ? Infinity : -Infinity;
  }
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Determine trend direction based on regression slope and data characteristics.
 * Uses a threshold based on coefficient of variation to determine significance.
 * @param slope - Slope from linear regression
 * @param stdDev - Standard deviation of the y values
 * @param meanValue - Mean of the y values
 * @returns Trend direction: 'up', 'down', or 'stable'
 */
export function determineTrend(
  slope: number,
  stdDev: number,
  meanValue: number
): 'up' | 'down' | 'stable' {
  if (meanValue === 0) {
    if (slope > 0) return 'up';
    if (slope < 0) return 'down';
    return 'stable';
  }

  // Use a threshold based on the data's variability
  // Threshold is 5% of the mean or 0.1 standard deviations, whichever is smaller
  const threshold = Math.min(Math.abs(meanValue) * 0.05, stdDev * 0.1);

  if (slope > threshold) return 'up';
  if (slope < -threshold) return 'down';
  return 'stable';
}

// =============================================================================
// AGGREGATION HELPERS
// =============================================================================

/**
 * Calculate the sum of an array of numbers.
 * @param values - Array of numbers
 * @returns Sum of all values, or 0 for empty array
 */
export function sum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

/**
 * Count items grouped by a key function.
 * @param items - Array of items
 * @param keyFn - Function to extract the grouping key from each item
 * @returns Record mapping each key to its count
 */
export function countBy<T>(
  items: T[],
  keyFn: (item: T) => string
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] || 0) + 1;
  }

  return result;
}

/**
 * Sum values grouped by a key function.
 * @param items - Array of items
 * @param keyFn - Function to extract the grouping key from each item
 * @param valueFn - Function to extract the numeric value from each item
 * @returns Record mapping each key to its summed value
 */
export function sumBy<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] || 0) + valueFn(item);
  }

  return result;
}

/**
 * Calculate market share percentages from absolute values.
 * @param values - Record of category names to their absolute values
 * @returns Record of category names to their percentage share
 */
export function calculateShares(
  values: Record<string, number>
): Record<string, number> {
  const total = Object.values(values).reduce((acc, val) => acc + val, 0);

  if (total === 0) {
    // Return 0% for all if total is 0
    return Object.keys(values).reduce(
      (acc, key) => ({ ...acc, [key]: 0 }),
      {} as Record<string, number>
    );
  }

  return Object.entries(values).reduce(
    (acc, [key, val]) => ({ ...acc, [key]: (val / total) * 100 }),
    {} as Record<string, number>
  );
}

// =============================================================================
// PRICE UTILITIES
// =============================================================================

/**
 * Currency exchange rates relative to JPY.
 */
interface ExchangeRates {
  USD: number;
  EUR: number;
  GBP: number;
}

/**
 * Normalize a price value to JPY using exchange rates.
 * @param value - Price value in the source currency
 * @param currency - Source currency
 * @param rates - Exchange rates (how many JPY per unit of foreign currency)
 * @returns Price in JPY
 */
export function normalizeToJPY(
  value: number,
  currency: 'JPY' | 'USD' | 'EUR' | 'GBP',
  rates: ExchangeRates
): number {
  if (currency === 'JPY') return value;
  return value * rates[currency];
}

/**
 * Format a number in compact notation (e.g., 1500000 -> "1.5M").
 * @param value - Number to format
 * @returns Compact string representation
 */
export function formatCompactNumber(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1000000000) {
    const b = absValue / 1000000000;
    return sign + (b % 1 === 0 ? `${b}B` : `${b.toFixed(1)}B`);
  }
  if (absValue >= 1000000) {
    const m = absValue / 1000000;
    return sign + (m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`);
  }
  if (absValue >= 1000) {
    const k = absValue / 1000;
    return sign + (k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`);
  }
  return value.toString();
}

/**
 * Options for currency formatting.
 */
interface CurrencyFormatOptions {
  /** Use compact notation (e.g., 1.5M instead of 1,500,000) */
  compact?: boolean;
  /** Number of decimal places (default: 0 for JPY, 2 for others) */
  decimals?: number;
}

/**
 * Format a currency value for display.
 * @param value - Numeric value
 * @param currency - Currency code
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: 'JPY' | 'USD' | 'EUR',
  options: CurrencyFormatOptions = {}
): string {
  const { compact = false, decimals } = options;

  const symbols: Record<string, string> = {
    JPY: '¥',
    USD: '$',
    EUR: '€',
  };

  const defaultDecimals = currency === 'JPY' ? 0 : 2;
  const actualDecimals = decimals ?? defaultDecimals;

  const symbol = symbols[currency];

  if (compact) {
    return symbol + formatCompactNumber(Math.round(value));
  }

  // Use locale formatting with the appropriate number of decimals
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: actualDecimals,
    maximumFractionDigits: actualDecimals,
  });

  return symbol + formatted;
}
