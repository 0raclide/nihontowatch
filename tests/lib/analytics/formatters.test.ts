/**
 * Analytics Formatter Functions Unit Tests
 *
 * Tests the format utility functions used in analytics components.
 * These functions handle number formatting, currency display, and
 * price range labels for the market intelligence dashboard.
 */

import { describe, it, expect } from 'vitest';
import {
  formatCompactNumber,
  formatCurrency,
  formatPriceRangeLabel,
  mean,
  median,
  standardDeviation,
  percentiles,
  skewness,
  createHistogramBuckets,
  percentChange,
  linearRegression,
  determineTrend,
  sum,
  countBy,
  sumBy,
  calculateShares,
} from '@/lib/analytics/statistics';

// =============================================================================
// FORMAT COMPACT NUMBER TESTS
// =============================================================================

describe('formatCompactNumber', () => {
  describe('millions', () => {
    it('formats 1.5 million as 1.5M', () => {
      expect(formatCompactNumber(1500000)).toBe('1.5M');
    });

    it('formats exactly 2 million as 2M (no decimal)', () => {
      expect(formatCompactNumber(2000000)).toBe('2M');
    });

    it('formats 10 million as 10M', () => {
      expect(formatCompactNumber(10000000)).toBe('10M');
    });

    it('formats 999 million as 999M', () => {
      expect(formatCompactNumber(999000000)).toBe('999M');
    });
  });

  describe('billions', () => {
    it('formats 2.5 billion as 2.5B', () => {
      expect(formatCompactNumber(2500000000)).toBe('2.5B');
    });

    it('formats exactly 1 billion as 1B', () => {
      expect(formatCompactNumber(1000000000)).toBe('1B');
    });

    it('formats 10 billion as 10B', () => {
      expect(formatCompactNumber(10000000000)).toBe('10B');
    });
  });

  describe('thousands', () => {
    it('formats 150K as 150K', () => {
      expect(formatCompactNumber(150000)).toBe('150K');
    });

    it('formats 500K as 500K', () => {
      expect(formatCompactNumber(500000)).toBe('500K');
    });

    it('formats 1.5K as 1.5K', () => {
      expect(formatCompactNumber(1500)).toBe('1.5K');
    });

    it('formats exactly 1000 as 1K', () => {
      expect(formatCompactNumber(1000)).toBe('1K');
    });
  });

  describe('small numbers', () => {
    it('formats 999 as-is', () => {
      expect(formatCompactNumber(999)).toBe('999');
    });

    it('formats 0 as 0', () => {
      expect(formatCompactNumber(0)).toBe('0');
    });

    it('formats 1 as 1', () => {
      expect(formatCompactNumber(1)).toBe('1');
    });
  });

  describe('negative numbers', () => {
    it('formats negative millions with sign', () => {
      expect(formatCompactNumber(-1500000)).toBe('-1.5M');
    });

    it('formats negative thousands with sign', () => {
      expect(formatCompactNumber(-5000)).toBe('-5K');
    });

    it('formats small negative as-is', () => {
      expect(formatCompactNumber(-500)).toBe('-500');
    });
  });
});

// =============================================================================
// FORMAT CURRENCY TESTS
// =============================================================================

describe('formatCurrency', () => {
  describe('JPY formatting', () => {
    it('formats JPY with yen symbol', () => {
      expect(formatCurrency(1500000, 'JPY')).toBe('\u00A51,500,000');
    });

    it('formats JPY compact', () => {
      expect(formatCurrency(1500000, 'JPY', { compact: true })).toBe('\u00A51.5M');
    });

    it('formats small JPY amount', () => {
      expect(formatCurrency(500, 'JPY')).toBe('\u00A5500');
    });

    it('JPY has 0 decimal places by default', () => {
      expect(formatCurrency(1234, 'JPY')).toBe('\u00A51,234');
    });
  });

  describe('USD formatting', () => {
    it('formats USD with dollar symbol', () => {
      expect(formatCurrency(10000, 'USD')).toBe('$10,000.00');
    });

    it('formats USD compact', () => {
      expect(formatCurrency(2500000, 'USD', { compact: true })).toBe('$2.5M');
    });

    it('USD has 2 decimal places by default', () => {
      expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
    });
  });

  describe('EUR formatting', () => {
    it('formats EUR with euro symbol', () => {
      expect(formatCurrency(10000, 'EUR')).toBe('\u20AC10,000.00');
    });

    it('formats EUR compact', () => {
      expect(formatCurrency(5000000, 'EUR', { compact: true })).toBe('\u20AC5M');
    });

    it('EUR has 2 decimal places by default', () => {
      expect(formatCurrency(999.99, 'EUR')).toBe('\u20AC999.99');
    });
  });

  describe('custom decimals', () => {
    it('respects custom decimal places', () => {
      expect(formatCurrency(1234.5678, 'USD', { decimals: 0 })).toBe('$1,235');
    });

    it('allows more decimal places', () => {
      expect(formatCurrency(1234.5678, 'USD', { decimals: 3 })).toBe('$1,234.568');
    });
  });

  describe('compact with large values', () => {
    it('formats billions compact', () => {
      expect(formatCurrency(15000000000, 'JPY', { compact: true })).toBe('\u00A515B');
    });

    it('formats millions compact', () => {
      expect(formatCurrency(750000, 'USD', { compact: true })).toBe('$750K');
    });
  });
});

// =============================================================================
// FORMAT PRICE RANGE LABEL TESTS
// =============================================================================

describe('formatPriceRangeLabel', () => {
  it('formats thousand ranges', () => {
    expect(formatPriceRangeLabel(0, 500000)).toBe('0-500K');
  });

  it('formats million ranges', () => {
    expect(formatPriceRangeLabel(1000000, 2000000)).toBe('1M-2M');
  });

  it('formats mixed ranges', () => {
    expect(formatPriceRangeLabel(500000, 1000000)).toBe('500K-1M');
  });

  it('formats billion ranges', () => {
    expect(formatPriceRangeLabel(1000000000, 2000000000)).toBe('1B-2B');
  });

  it('formats small number ranges', () => {
    expect(formatPriceRangeLabel(0, 999)).toBe('0-999');
  });

  it('handles decimal values', () => {
    expect(formatPriceRangeLabel(1500000, 2500000)).toBe('1.5M-2.5M');
  });
});

// =============================================================================
// STATISTICAL FUNCTIONS TESTS
// =============================================================================

describe('mean', () => {
  it('calculates mean correctly', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('handles single value', () => {
    expect(mean([42])).toBe(42);
  });

  it('handles decimal values', () => {
    expect(mean([1.5, 2.5, 3.5])).toBe(2.5);
  });
});

describe('median', () => {
  it('calculates median for odd-length array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('calculates median for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0);
  });

  it('handles unsorted input', () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3);
  });

  it('handles single value', () => {
    expect(median([42])).toBe(42);
  });
});

describe('standardDeviation', () => {
  it('calculates standard deviation correctly', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const stdDev = standardDeviation(values);
    expect(stdDev).toBeCloseTo(2, 0);
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
});

describe('percentiles', () => {
  it('calculates multiple percentiles', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = percentiles(values, [10, 25, 50, 75, 90]);

    expect(result[10]).toBeCloseTo(10.9, 0);
    expect(result[25]).toBeCloseTo(25.75, 0);
    expect(result[50]).toBeCloseTo(50.5, 0);
    expect(result[75]).toBeCloseTo(75.25, 0);
    expect(result[90]).toBeCloseTo(90.1, 0);
  });

  it('returns 0s for empty array', () => {
    const result = percentiles([], [10, 50, 90]);
    expect(result[10]).toBe(0);
    expect(result[50]).toBe(0);
    expect(result[90]).toBe(0);
  });

  it('handles p0 and p100', () => {
    const values = [1, 5, 10, 20, 50];
    const result = percentiles(values, [0, 100]);
    expect(result[0]).toBe(1);
    expect(result[100]).toBe(50);
  });
});

describe('skewness', () => {
  it('returns 0 for empty array', () => {
    expect(skewness([])).toBe(0);
  });

  it('returns 0 for arrays with <= 2 elements', () => {
    expect(skewness([1])).toBe(0);
    expect(skewness([1, 2])).toBe(0);
  });

  it('returns 0 for symmetric distribution', () => {
    // Perfectly symmetric
    const values = [1, 2, 3, 4, 5, 4, 3, 2, 1];
    expect(Math.abs(skewness(values))).toBeLessThan(0.5);
  });

  it('returns positive for right-skewed distribution', () => {
    // Right-skewed (long tail to the right)
    const values = [1, 1, 1, 2, 2, 3, 10, 20, 50];
    expect(skewness(values)).toBeGreaterThan(0);
  });
});

// =============================================================================
// HISTOGRAM FUNCTIONS TESTS
// =============================================================================

describe('createHistogramBuckets', () => {
  it('creates correct number of buckets', () => {
    const values = Array.from({ length: 100 }, (_, i) => i * 1000);
    const buckets = createHistogramBuckets(values, 10);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.length).toBeLessThanOrEqual(10);
  });

  it('returns empty array for empty input', () => {
    expect(createHistogramBuckets([], 10)).toEqual([]);
  });

  it('returns empty array for zero bucket count', () => {
    expect(createHistogramBuckets([1, 2, 3], 0)).toEqual([]);
  });

  it('handles single value correctly', () => {
    const buckets = createHistogramBuckets([100], 5);
    expect(buckets.length).toBe(1);
    expect(buckets[0].count).toBe(1);
    expect(buckets[0].percentage).toBe(100);
  });

  it('calculates cumulative percentages correctly', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const buckets = createHistogramBuckets(values, 5);

    // Last bucket should have cumulative percentage close to 100
    const lastBucket = buckets[buckets.length - 1];
    expect(lastBucket.cumulativePercentage).toBeCloseTo(100, 0);
  });

  it('bucket counts sum to total values', () => {
    const values = Array.from({ length: 50 }, () => Math.random() * 1000);
    const buckets = createHistogramBuckets(values, 10);

    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(values.length);
  });
});

// =============================================================================
// TREND ANALYSIS TESTS
// =============================================================================

describe('percentChange', () => {
  it('calculates positive percent change', () => {
    expect(percentChange(100, 150)).toBe(50);
  });

  it('calculates negative percent change', () => {
    expect(percentChange(100, 80)).toBe(-20);
  });

  it('handles zero old value', () => {
    expect(percentChange(0, 100)).toBe(Infinity);
    expect(percentChange(0, -100)).toBe(-Infinity);
    expect(percentChange(0, 0)).toBe(0);
  });

  it('handles doubling', () => {
    expect(percentChange(100, 200)).toBe(100);
  });
});

describe('linearRegression', () => {
  it('calculates regression for perfect positive line', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    const result = linearRegression(points);

    expect(result.slope).toBeCloseTo(1, 5);
    expect(result.intercept).toBeCloseTo(0, 5);
    expect(result.rSquared).toBeCloseTo(1, 5);
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

  it('handles vertical line (all same x)', () => {
    const points = [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBe(0);
  });
});

describe('determineTrend', () => {
  it('returns up for significant positive slope', () => {
    expect(determineTrend(100, 50, 500)).toBe('up');
  });

  it('returns down for significant negative slope', () => {
    expect(determineTrend(-100, 50, 500)).toBe('down');
  });

  it('returns stable for small slope', () => {
    expect(determineTrend(0.001, 50, 500)).toBe('stable');
  });

  it('handles zero mean', () => {
    expect(determineTrend(1, 0, 0)).toBe('up');
    expect(determineTrend(-1, 0, 0)).toBe('down');
    expect(determineTrend(0, 0, 0)).toBe('stable');
  });
});

// =============================================================================
// AGGREGATION HELPERS TESTS
// =============================================================================

describe('sum', () => {
  it('calculates sum correctly', () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15);
  });

  it('returns 0 for empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('handles negative values', () => {
    expect(sum([1, -2, 3, -4, 5])).toBe(3);
  });
});

describe('countBy', () => {
  it('counts items by key', () => {
    const items = [
      { type: 'a', value: 1 },
      { type: 'b', value: 2 },
      { type: 'a', value: 3 },
      { type: 'a', value: 4 },
    ];
    const result = countBy(items, (item) => item.type);

    expect(result['a']).toBe(3);
    expect(result['b']).toBe(1);
  });

  it('returns empty object for empty array', () => {
    expect(countBy([], () => 'key')).toEqual({});
  });
});

describe('sumBy', () => {
  it('sums values by key', () => {
    const items = [
      { type: 'a', value: 10 },
      { type: 'b', value: 20 },
      { type: 'a', value: 30 },
    ];
    const result = sumBy(
      items,
      (item) => item.type,
      (item) => item.value
    );

    expect(result['a']).toBe(40);
    expect(result['b']).toBe(20);
  });

  it('returns empty object for empty array', () => {
    expect(sumBy([], () => 'key', () => 0)).toEqual({});
  });
});

describe('calculateShares', () => {
  it('calculates percentage shares', () => {
    const values = { a: 50, b: 30, c: 20 };
    const result = calculateShares(values);

    expect(result['a']).toBe(50);
    expect(result['b']).toBe(30);
    expect(result['c']).toBe(20);
  });

  it('returns 0% for all when total is 0', () => {
    const values = { a: 0, b: 0, c: 0 };
    const result = calculateShares(values);

    expect(result['a']).toBe(0);
    expect(result['b']).toBe(0);
    expect(result['c']).toBe(0);
  });

  it('handles single key', () => {
    const result = calculateShares({ only: 100 });
    expect(result['only']).toBe(100);
  });
});
