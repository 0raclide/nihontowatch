import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  mode,
  standardDeviation,
  variance,
  percentile,
  percentiles,
  skewness,
  coefficientOfVariation,
  createHistogramBuckets,
  formatPriceRangeLabel,
  linearRegression,
  percentChange,
  determineTrend,
  sum,
  countBy,
  sumBy,
  calculateShares,
  normalizeToJPY,
  formatCompactNumber,
  formatCurrency,
} from '@/lib/analytics/statistics';

// =============================================================================
// DESCRIPTIVE STATISTICS
// =============================================================================

describe('mean', () => {
  it('calculates mean of positive numbers', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('handles single value', () => {
    expect(mean([42])).toBe(42);
  });

  it('handles negative numbers', () => {
    expect(mean([-5, -3, -1, 1, 3, 5])).toBe(0);
  });

  it('handles decimal numbers', () => {
    expect(mean([1.5, 2.5, 3.5])).toBeCloseTo(2.5);
  });

  it('handles large numbers (price data)', () => {
    const prices = [500000, 750000, 1000000, 1250000, 1500000];
    expect(mean(prices)).toBe(1000000);
  });
});

describe('median', () => {
  it('calculates median of odd-length array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('calculates median of even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0);
  });

  it('handles single value', () => {
    expect(median([42])).toBe(42);
  });

  it('handles unsorted input', () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3);
  });

  it('handles negative numbers', () => {
    expect(median([-5, -3, 0, 3, 5])).toBe(0);
  });

  it('handles real-world price distribution', () => {
    const prices = [100000, 250000, 500000, 750000, 3000000];
    expect(median(prices)).toBe(500000);
  });
});

describe('mode', () => {
  it('finds mode when one value is most frequent', () => {
    expect(mode([1, 2, 2, 3, 4])).toBe(2);
  });

  it('returns null for empty array', () => {
    expect(mode([])).toBeNull();
  });

  it('returns null when all values equally frequent', () => {
    expect(mode([1, 2, 3, 4, 5])).toBeNull();
  });

  it('returns smallest mode when multiple modes exist', () => {
    expect(mode([1, 1, 2, 2, 3])).toBe(1);
  });

  it('handles single value', () => {
    expect(mode([42])).toBeNull();
  });

  it('handles negative numbers', () => {
    expect(mode([-1, -1, 2, 3])).toBe(-1);
  });

  it('finds mode in price categories', () => {
    // Simulating price brackets where 500000 is most common
    const prices = [100000, 500000, 500000, 500000, 1000000, 2000000];
    expect(mode(prices)).toBe(500000);
  });
});

describe('variance', () => {
  it('calculates population variance', () => {
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4);
  });

  it('returns 0 for empty array', () => {
    expect(variance([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(variance([42])).toBe(0);
  });

  it('returns 0 when all values are the same', () => {
    expect(variance([5, 5, 5, 5])).toBe(0);
  });

  it('handles two values', () => {
    expect(variance([0, 10])).toBe(25);
  });
});

describe('standardDeviation', () => {
  it('calculates standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2);
  });

  it('returns 0 for empty array', () => {
    expect(standardDeviation([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(standardDeviation([42])).toBe(0);
  });

  it('returns 0 when all values are the same', () => {
    expect(standardDeviation([5, 5, 5, 5])).toBe(0);
  });

  it('handles price volatility calculation', () => {
    const prices = [100, 105, 98, 102, 101];
    const stdDev = standardDeviation(prices);
    expect(stdDev).toBeGreaterThan(0);
    expect(stdDev).toBeLessThan(10);
  });
});

describe('percentile', () => {
  it('calculates 50th percentile (median)', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('calculates 25th percentile (Q1)', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8], 25)).toBeCloseTo(2.75);
  });

  it('calculates 75th percentile (Q3)', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8], 75)).toBeCloseTo(6.25);
  });

  it('returns minimum for 0th percentile', () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
  });

  it('returns maximum for 100th percentile', () => {
    expect(percentile([10, 20, 30], 100)).toBe(30);
  });

  it('returns 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('handles single value', () => {
    expect(percentile([42], 50)).toBe(42);
  });

  it('throws for percentile below 0', () => {
    expect(() => percentile([1, 2, 3], -1)).toThrow('Percentile must be between 0 and 100');
  });

  it('throws for percentile above 100', () => {
    expect(() => percentile([1, 2, 3], 101)).toThrow('Percentile must be between 0 and 100');
  });

  it('handles unsorted input', () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
  });
});

describe('percentiles', () => {
  it('calculates multiple percentiles at once', () => {
    const result = percentiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [25, 50, 75]);
    expect(result[25]).toBeCloseTo(3.25);
    expect(result[50]).toBeCloseTo(5.5);
    expect(result[75]).toBeCloseTo(7.75);
  });

  it('returns zeros for empty array', () => {
    const result = percentiles([], [25, 50, 75]);
    expect(result[25]).toBe(0);
    expect(result[50]).toBe(0);
    expect(result[75]).toBe(0);
  });

  it('handles quartiles for price analysis', () => {
    const prices = [100000, 200000, 300000, 500000, 800000, 1000000, 2000000];
    const quartiles = percentiles(prices, [0, 25, 50, 75, 100]);
    expect(quartiles[0]).toBe(100000);
    expect(quartiles[100]).toBe(2000000);
    expect(quartiles[50]).toBe(500000);
  });

  it('throws for invalid percentile in array', () => {
    expect(() => percentiles([1, 2, 3], [25, 150])).toThrow();
  });
});

describe('skewness', () => {
  it('returns 0 for symmetric distribution', () => {
    expect(skewness([1, 2, 3, 4, 5])).toBeCloseTo(0, 1);
  });

  it('returns positive value for right-skewed distribution', () => {
    const rightSkewed = [1, 1, 1, 2, 2, 3, 10, 20];
    expect(skewness(rightSkewed)).toBeGreaterThan(0);
  });

  it('returns negative value for left-skewed distribution', () => {
    const leftSkewed = [1, 10, 18, 19, 19, 20, 20, 20];
    expect(skewness(leftSkewed)).toBeLessThan(0);
  });

  it('returns 0 for empty array', () => {
    expect(skewness([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(skewness([42])).toBe(0);
  });

  it('returns 0 for two values', () => {
    expect(skewness([1, 2])).toBe(0);
  });

  it('returns 0 when all values are the same', () => {
    expect(skewness([5, 5, 5, 5, 5])).toBe(0);
  });

  it('identifies right-skewed price distribution (typical for luxury market)', () => {
    // Luxury market: many items around median, few very expensive
    const prices = [100000, 150000, 200000, 250000, 300000, 350000, 500000, 1000000, 5000000];
    expect(skewness(prices)).toBeGreaterThan(0);
  });
});

describe('coefficientOfVariation', () => {
  it('calculates CV correctly', () => {
    // stdDev = 2, mean = 5, CV = 0.4
    expect(coefficientOfVariation([3, 5, 7])).toBeCloseTo(0.327, 2);
  });

  it('returns 0 for empty array', () => {
    expect(coefficientOfVariation([])).toBe(0);
  });

  it('returns 0 when mean is 0', () => {
    expect(coefficientOfVariation([-1, 0, 1])).toBe(0);
  });

  it('returns 0 when all values are the same', () => {
    expect(coefficientOfVariation([5, 5, 5])).toBe(0);
  });

  it('handles negative mean correctly', () => {
    const cv = coefficientOfVariation([-10, -8, -6]);
    expect(cv).toBeGreaterThan(0);
  });

  it('compares volatility across different price ranges', () => {
    const cheapItems = [100, 120, 80, 110, 90]; // CV around the same
    const expensiveItems = [1000, 1200, 800, 1100, 900]; // Same relative variance
    expect(coefficientOfVariation(cheapItems)).toBeCloseTo(
      coefficientOfVariation(expensiveItems),
      2
    );
  });
});

// =============================================================================
// DISTRIBUTION ANALYSIS
// =============================================================================

describe('createHistogramBuckets', () => {
  it('creates specified number of buckets', () => {
    const buckets = createHistogramBuckets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(buckets.length).toBe(5);
  });

  it('returns empty array for empty input', () => {
    expect(createHistogramBuckets([], 5)).toEqual([]);
  });

  it('returns empty array for zero buckets', () => {
    expect(createHistogramBuckets([1, 2, 3], 0)).toEqual([]);
  });

  it('handles single value', () => {
    const buckets = createHistogramBuckets([42], 5);
    expect(buckets.length).toBe(1);
    expect(buckets[0].count).toBe(1);
    expect(buckets[0].percentage).toBe(100);
  });

  it('calculates counts correctly', () => {
    const buckets = createHistogramBuckets([1, 1, 2, 3, 3, 3], 3);
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(6);
  });

  it('calculates percentages correctly', () => {
    const buckets = createHistogramBuckets([1, 2, 3, 4, 5], 5);
    const totalPercentage = buckets.reduce((sum, b) => sum + b.percentage, 0);
    expect(totalPercentage).toBeCloseTo(100);
  });

  it('calculates cumulative percentages correctly', () => {
    const buckets = createHistogramBuckets([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(buckets[buckets.length - 1].cumulativePercentage).toBeCloseTo(100);
  });

  it('respects custom min/max values', () => {
    const buckets = createHistogramBuckets([5, 6, 7], 5, { minValue: 0, maxValue: 10 });
    expect(buckets[0].rangeStart).toBe(0);
    expect(buckets[buckets.length - 1].rangeEnd).toBe(10);
  });

  it('uses nice numbers when enabled', () => {
    const buckets = createHistogramBuckets(
      [123, 456, 789, 1234, 5678],
      5,
      { useNiceNumbers: true }
    );
    // Nice numbers should result in round bucket boundaries
    expect(buckets.length).toBeGreaterThan(0);
    // Check first bucket starts at a reasonable round number
    expect(buckets[0].rangeStart % 100).toBe(0);
  });

  it('handles price distribution histogram', () => {
    const prices = [
      100000, 150000, 200000, 250000, 300000,
      400000, 500000, 600000, 800000, 1000000,
      1500000, 2000000, 3000000
    ];
    const buckets = createHistogramBuckets(prices, 5);
    expect(buckets.length).toBe(5);
    // Most items should be in lower price buckets
    expect(buckets[0].count + buckets[1].count).toBeGreaterThan(buckets[buckets.length - 1].count);
  });
});

describe('formatPriceRangeLabel', () => {
  it('formats thousands as K', () => {
    expect(formatPriceRangeLabel(500, 1000)).toBe('500-1K');
  });

  it('formats millions as M', () => {
    expect(formatPriceRangeLabel(1000000, 2000000)).toBe('1M-2M');
  });

  it('formats billions as B', () => {
    expect(formatPriceRangeLabel(1000000000, 2000000000)).toBe('1B-2B');
  });

  it('formats mixed ranges', () => {
    expect(formatPriceRangeLabel(500000, 1000000)).toBe('500K-1M');
  });

  it('includes decimals when needed', () => {
    expect(formatPriceRangeLabel(1500000, 2500000)).toBe('1.5M-2.5M');
  });

  it('handles small numbers without suffix', () => {
    expect(formatPriceRangeLabel(100, 500)).toBe('100-500');
  });

  it('formats typical price range for nihonto', () => {
    expect(formatPriceRangeLabel(100000, 500000)).toBe('100K-500K');
  });
});

// =============================================================================
// TREND ANALYSIS
// =============================================================================

describe('linearRegression', () => {
  it('calculates slope and intercept for perfect line', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(2);
    expect(result.intercept).toBeCloseTo(0);
    expect(result.rSquared).toBeCloseTo(1);
  });

  it('returns zeros for empty array', () => {
    const result = linearRegression([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
    expect(result.rSquared).toBe(0);
  });

  it('handles single point', () => {
    const result = linearRegression([{ x: 5, y: 10 }]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(10);
    expect(result.rSquared).toBe(1);
  });

  it('handles horizontal line (no trend)', () => {
    const points = [
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(0);
    expect(result.intercept).toBeCloseTo(5);
  });

  it('handles vertical line (all same x)', () => {
    const points = [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBeCloseTo(2); // mean of y values
  });

  it('identifies upward price trend', () => {
    const points = [
      { x: 0, y: 100000 },
      { x: 1, y: 110000 },
      { x: 2, y: 120000 },
      { x: 3, y: 130000 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeGreaterThan(0);
    expect(result.rSquared).toBeCloseTo(1);
  });

  it('identifies downward price trend', () => {
    const points = [
      { x: 0, y: 100000 },
      { x: 1, y: 90000 },
      { x: 2, y: 80000 },
      { x: 3, y: 70000 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeLessThan(0);
  });

  it('handles noisy data with lower R-squared', () => {
    const points = [
      { x: 0, y: 100 },
      { x: 1, y: 150 },
      { x: 2, y: 90 },
      { x: 3, y: 180 },
      { x: 4, y: 120 },
    ];
    const result = linearRegression(points);
    expect(result.rSquared).toBeLessThan(1);
    expect(result.rSquared).toBeGreaterThanOrEqual(0);
  });

  it('R-squared is bounded between 0 and 1', () => {
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 100 },
      { x: 2, y: 3 },
      { x: 3, y: 200 },
    ];
    const result = linearRegression(points);
    expect(result.rSquared).toBeGreaterThanOrEqual(0);
    expect(result.rSquared).toBeLessThanOrEqual(1);
  });
});

describe('percentChange', () => {
  it('calculates positive change', () => {
    expect(percentChange(100, 150)).toBe(50);
  });

  it('calculates negative change', () => {
    expect(percentChange(100, 80)).toBe(-20);
  });

  it('returns 0 for no change', () => {
    expect(percentChange(100, 100)).toBe(0);
  });

  it('returns 0 when both values are 0', () => {
    expect(percentChange(0, 0)).toBe(0);
  });

  it('returns Infinity when old value is 0 and new is positive', () => {
    expect(percentChange(0, 100)).toBe(Infinity);
  });

  it('returns -Infinity when old value is 0 and new is negative', () => {
    expect(percentChange(0, -100)).toBe(-Infinity);
  });

  it('handles negative old values', () => {
    expect(percentChange(-100, -50)).toBe(50); // -50 is 50% increase from -100
  });

  it('calculates price drop correctly', () => {
    expect(percentChange(1000000, 800000)).toBe(-20);
  });

  it('calculates price increase correctly', () => {
    expect(percentChange(500000, 750000)).toBe(50);
  });
});

describe('determineTrend', () => {
  it('identifies upward trend', () => {
    expect(determineTrend(100, 50, 1000)).toBe('up');
  });

  it('identifies downward trend', () => {
    expect(determineTrend(-100, 50, 1000)).toBe('down');
  });

  it('identifies stable trend for small slope', () => {
    expect(determineTrend(1, 50, 1000)).toBe('stable');
  });

  it('handles zero mean', () => {
    expect(determineTrend(1, 0, 0)).toBe('up');
    expect(determineTrend(-1, 0, 0)).toBe('down');
    expect(determineTrend(0, 0, 0)).toBe('stable');
  });

  it('identifies stable when slope is within noise threshold', () => {
    // 5% of mean = 50, 0.1 * stdDev = 10
    // threshold = min(50, 10) = 10
    // slope of 5 should be stable
    expect(determineTrend(5, 100, 1000)).toBe('stable');
  });
});

// =============================================================================
// AGGREGATION HELPERS
// =============================================================================

describe('sum', () => {
  it('sums positive numbers', () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15);
  });

  it('returns 0 for empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('handles single value', () => {
    expect(sum([42])).toBe(42);
  });

  it('handles negative numbers', () => {
    expect(sum([-1, -2, 3])).toBe(0);
  });

  it('handles decimal numbers', () => {
    expect(sum([0.1, 0.2, 0.3])).toBeCloseTo(0.6);
  });

  it('sums price values', () => {
    expect(sum([100000, 200000, 300000])).toBe(600000);
  });
});

describe('countBy', () => {
  it('counts items by key', () => {
    const items = ['a', 'b', 'a', 'c', 'a', 'b'];
    const result = countBy(items, item => item);
    expect(result).toEqual({ a: 3, b: 2, c: 1 });
  });

  it('returns empty object for empty array', () => {
    expect(countBy([], () => 'key')).toEqual({});
  });

  it('handles objects', () => {
    const items = [
      { type: 'katana' },
      { type: 'wakizashi' },
      { type: 'katana' },
    ];
    const result = countBy(items, item => item.type);
    expect(result).toEqual({ katana: 2, wakizashi: 1 });
  });

  it('counts listings by dealer', () => {
    const listings = [
      { dealer: 'Aoi Art', price: 100000 },
      { dealer: 'Eirakudo', price: 200000 },
      { dealer: 'Aoi Art', price: 150000 },
      { dealer: 'Aoi Art', price: 300000 },
    ];
    const result = countBy(listings, l => l.dealer);
    expect(result['Aoi Art']).toBe(3);
    expect(result['Eirakudo']).toBe(1);
  });
});

describe('sumBy', () => {
  it('sums values by key', () => {
    const items = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'A', value: 30 },
    ];
    const result = sumBy(items, item => item.category, item => item.value);
    expect(result).toEqual({ A: 40, B: 20 });
  });

  it('returns empty object for empty array', () => {
    expect(sumBy([], () => 'key', () => 0)).toEqual({});
  });

  it('sums sales by dealer', () => {
    const listings = [
      { dealer: 'Aoi Art', price: 100000 },
      { dealer: 'Eirakudo', price: 200000 },
      { dealer: 'Aoi Art', price: 150000 },
    ];
    const result = sumBy(listings, l => l.dealer, l => l.price);
    expect(result['Aoi Art']).toBe(250000);
    expect(result['Eirakudo']).toBe(200000);
  });
});

describe('calculateShares', () => {
  it('calculates percentage shares', () => {
    const values = { A: 50, B: 30, C: 20 };
    const shares = calculateShares(values);
    expect(shares.A).toBe(50);
    expect(shares.B).toBe(30);
    expect(shares.C).toBe(20);
  });

  it('returns 0% for all when total is 0', () => {
    const values = { A: 0, B: 0 };
    const shares = calculateShares(values);
    expect(shares.A).toBe(0);
    expect(shares.B).toBe(0);
  });

  it('handles single category', () => {
    const values = { A: 100 };
    const shares = calculateShares(values);
    expect(shares.A).toBe(100);
  });

  it('handles empty input', () => {
    expect(calculateShares({})).toEqual({});
  });

  it('calculates market share by dealer', () => {
    const inventoryByDealer = {
      'Aoi Art': 150,
      'Eirakudo': 80,
      'Nipponto': 70,
    };
    const shares = calculateShares(inventoryByDealer);
    expect(shares['Aoi Art']).toBe(50);
    expect(shares['Eirakudo']).toBeCloseTo(26.67, 1);
    expect(shares['Nipponto']).toBeCloseTo(23.33, 1);
  });
});

// =============================================================================
// PRICE UTILITIES
// =============================================================================

describe('normalizeToJPY', () => {
  const rates = { USD: 150, EUR: 160, GBP: 190 };

  it('returns value unchanged for JPY', () => {
    expect(normalizeToJPY(100000, 'JPY', rates)).toBe(100000);
  });

  it('converts USD to JPY', () => {
    expect(normalizeToJPY(1000, 'USD', rates)).toBe(150000);
  });

  it('converts EUR to JPY', () => {
    expect(normalizeToJPY(1000, 'EUR', rates)).toBe(160000);
  });

  it('converts GBP to JPY', () => {
    expect(normalizeToJPY(1000, 'GBP', rates)).toBe(190000);
  });

  it('handles zero value', () => {
    expect(normalizeToJPY(0, 'USD', rates)).toBe(0);
  });

  it('handles decimal values', () => {
    expect(normalizeToJPY(99.99, 'USD', rates)).toBeCloseTo(14998.5);
  });
});

describe('formatCompactNumber', () => {
  it('formats thousands as K', () => {
    expect(formatCompactNumber(1000)).toBe('1K');
    expect(formatCompactNumber(1500)).toBe('1.5K');
    expect(formatCompactNumber(2500)).toBe('2.5K');
  });

  it('formats millions as M', () => {
    expect(formatCompactNumber(1000000)).toBe('1M');
    expect(formatCompactNumber(1500000)).toBe('1.5M');
    expect(formatCompactNumber(2500000)).toBe('2.5M');
  });

  it('formats billions as B', () => {
    expect(formatCompactNumber(1000000000)).toBe('1B');
    expect(formatCompactNumber(1500000000)).toBe('1.5B');
  });

  it('returns small numbers as-is', () => {
    expect(formatCompactNumber(999)).toBe('999');
    expect(formatCompactNumber(100)).toBe('100');
    expect(formatCompactNumber(0)).toBe('0');
  });

  it('handles negative numbers', () => {
    expect(formatCompactNumber(-1000)).toBe('-1K');
    expect(formatCompactNumber(-1500000)).toBe('-1.5M');
  });

  it('removes unnecessary decimals', () => {
    expect(formatCompactNumber(2000)).toBe('2K');
    expect(formatCompactNumber(3000000)).toBe('3M');
  });

  it('formats typical sword prices', () => {
    expect(formatCompactNumber(100000)).toBe('100K');
    expect(formatCompactNumber(500000)).toBe('500K');
    expect(formatCompactNumber(1200000)).toBe('1.2M');
    expect(formatCompactNumber(5000000)).toBe('5M');
  });
});

describe('formatCurrency', () => {
  describe('JPY formatting', () => {
    it('formats with yen symbol', () => {
      expect(formatCurrency(100000, 'JPY')).toBe('¥100,000');
    });

    it('formats without decimals by default', () => {
      expect(formatCurrency(100000.5, 'JPY')).toBe('¥100,001');
    });

    it('uses compact notation when requested', () => {
      expect(formatCurrency(1500000, 'JPY', { compact: true })).toBe('¥1.5M');
    });

    it('respects custom decimals', () => {
      expect(formatCurrency(100000, 'JPY', { decimals: 2 })).toBe('¥100,000.00');
    });
  });

  describe('USD formatting', () => {
    it('formats with dollar symbol', () => {
      expect(formatCurrency(1000, 'USD')).toBe('$1,000.00');
    });

    it('formats with 2 decimals by default', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
    });

    it('uses compact notation when requested', () => {
      expect(formatCurrency(1500000, 'USD', { compact: true })).toBe('$1.5M');
    });

    it('respects custom decimals', () => {
      expect(formatCurrency(1000, 'USD', { decimals: 0 })).toBe('$1,000');
    });
  });

  describe('EUR formatting', () => {
    it('formats with euro symbol', () => {
      expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00');
    });

    it('uses compact notation when requested', () => {
      expect(formatCurrency(2500000, 'EUR', { compact: true })).toBe('€2.5M');
    });
  });
});

// =============================================================================
// REAL-WORLD SCENARIOS
// =============================================================================

describe('real-world market analysis scenarios', () => {
  it('analyzes price distribution for katana market', () => {
    // Simulated price data for katana listings
    const prices = [
      150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000,
      600000, 700000, 800000, 1000000, 1200000, 1500000, 2000000, 3000000,
      5000000, 8000000, 15000000
    ];

    const avg = mean(prices);
    const med = median(prices);
    const stdDev = standardDeviation(prices);
    const skew = skewness(prices);
    const cv = coefficientOfVariation(prices);

    // Typical luxury market characteristics
    expect(avg).toBeGreaterThan(med); // Mean > Median indicates right skew
    expect(skew).toBeGreaterThan(0); // Positive skewness
    expect(cv).toBeGreaterThan(0.5); // High variability

    // Quartile analysis
    const quartiles = percentiles(prices, [25, 50, 75]);
    expect(quartiles[75] - quartiles[25]).toBeGreaterThan(0); // IQR exists

    // Histogram for price range visualization
    const histogram = createHistogramBuckets(prices, 5);
    expect(histogram.length).toBe(5);
    expect(histogram[histogram.length - 1].cumulativePercentage).toBeCloseTo(100);
  });

  it('tracks price trend over time', () => {
    // Monthly average prices over 6 months (simulating market appreciation)
    const monthlyPrices = [
      { x: 0, y: 500000 },
      { x: 1, y: 520000 },
      { x: 2, y: 515000 },
      { x: 3, y: 540000 },
      { x: 4, y: 560000 },
      { x: 5, y: 580000 },
    ];

    const regression = linearRegression(monthlyPrices);
    const yValues = monthlyPrices.map(p => p.y);
    const trend = determineTrend(regression.slope, standardDeviation(yValues), mean(yValues));

    expect(regression.slope).toBeGreaterThan(0);
    expect(trend).toBe('up');
    expect(regression.rSquared).toBeGreaterThan(0.5); // Reasonable fit
  });

  it('calculates dealer market shares', () => {
    const listingsByDealer = [
      { dealer: 'Aoi Art', price: 500000 },
      { dealer: 'Aoi Art', price: 800000 },
      { dealer: 'Aoi Art', price: 1200000 },
      { dealer: 'Eirakudo', price: 600000 },
      { dealer: 'Eirakudo', price: 900000 },
      { dealer: 'Nipponto', price: 1500000 },
      { dealer: 'Nipponto', price: 2000000 },
    ];

    const countByDealer = countBy(listingsByDealer, l => l.dealer);
    const volumeByDealer = sumBy(listingsByDealer, l => l.dealer, l => l.price);

    // Count-based market share
    const countShares = calculateShares(countByDealer);
    expect(countShares['Aoi Art']).toBeCloseTo(42.86, 1);

    // Value-based market share
    const valueShares = calculateShares(volumeByDealer);
    expect(valueShares['Nipponto']).toBeGreaterThan(valueShares['Eirakudo']);
  });

  it('compares prices across currencies', () => {
    const rates = { USD: 150, EUR: 160, GBP: 190 };

    const listings = [
      { price: 1000000, currency: 'JPY' as const },
      { price: 7000, currency: 'USD' as const },
      { price: 6000, currency: 'EUR' as const },
    ];

    const normalizedPrices = listings.map(l =>
      normalizeToJPY(l.price, l.currency, rates)
    );

    expect(normalizedPrices[0]).toBe(1000000); // JPY unchanged
    expect(normalizedPrices[1]).toBe(1050000); // 7000 * 150
    expect(normalizedPrices[2]).toBe(960000); // 6000 * 160

    const avgPrice = mean(normalizedPrices);
    expect(avgPrice).toBeCloseTo(1003333.33, 0);
  });
});
