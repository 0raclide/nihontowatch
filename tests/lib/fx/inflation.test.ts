import { describe, it, expect } from 'vitest';
import {
  CPI_DATA,
  getCpiIndex,
  getCumulativeInflation,
  getInflationAdjustedAmount,
} from '@/lib/fx/inflation';

// =============================================================================
// CPI Data structure
// =============================================================================

describe('CPI_DATA', () => {
  const CURRENCIES = ['USD', 'JPY', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF'];

  it('has data for all 7 vault currencies', () => {
    for (const cur of CURRENCIES) {
      expect(CPI_DATA[cur]).toBeDefined();
    }
  });

  it('2020 is exactly 100.0 for all currencies', () => {
    for (const cur of CURRENCIES) {
      expect(CPI_DATA[cur][2020]).toBe(100.0);
    }
  });

  it('has data from 2000 to 2026 for all currencies', () => {
    for (const cur of CURRENCIES) {
      const years = Object.keys(CPI_DATA[cur]).map(Number);
      expect(Math.min(...years)).toBe(2000);
      expect(Math.max(...years)).toBe(2026);
      expect(years.length).toBe(27); // 2000 through 2026
    }
  });

  it('all values are positive numbers', () => {
    for (const cur of CURRENCIES) {
      for (const [, value] of Object.entries(CPI_DATA[cur])) {
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});

// =============================================================================
// getCpiIndex
// =============================================================================

describe('getCpiIndex', () => {
  it('returns exact value at mid-year (July 1)', () => {
    // At exactly mid-year, should return the year's value
    const val = getCpiIndex('USD', '2020-07-01');
    expect(val).toBeCloseTo(100.0, 0);
  });

  it('returns interpolated value between years', () => {
    // January of 2021 should be between 2020 (100.0) and 2021 (104.7) values
    const val = getCpiIndex('USD', '2021-01-15');
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThan(100.0);
    expect(val!).toBeLessThan(104.7);
  });

  it('returns value at year boundaries', () => {
    // Start of 2020 — should be between 2019 (98.8) and 2020 (100.0)
    const jan = getCpiIndex('USD', '2020-01-01');
    expect(jan).not.toBeNull();
    expect(jan!).toBeGreaterThanOrEqual(98.8);
    expect(jan!).toBeLessThanOrEqual(100.0);

    // End of 2020 — should be between 2020 (100.0) and 2021 (104.7)
    const dec = getCpiIndex('USD', '2020-12-31');
    expect(dec).not.toBeNull();
    expect(dec!).toBeGreaterThan(100.0);
    expect(dec!).toBeLessThanOrEqual(104.7);
  });

  it('returns null for unknown currency', () => {
    expect(getCpiIndex('XYZ', '2020-06-01')).toBeNull();
    expect(getCpiIndex('BTC', '2020-06-01')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(getCpiIndex('USD', 'not-a-date')).toBeNull();
  });

  it('returns null for date before data range', () => {
    expect(getCpiIndex('USD', '1999-06-01')).toBeNull();
  });

  it('handles case-insensitive currency codes', () => {
    const upper = getCpiIndex('USD', '2020-07-01');
    const lower = getCpiIndex('usd', '2020-07-01');
    expect(upper).toEqual(lower);
  });

  it('accepts Date objects', () => {
    const val = getCpiIndex('USD', new Date(2020, 6, 1)); // July 1, 2020
    expect(val).toBeCloseTo(100.0, 0);
  });

  it('JPY shows near-flat CPI in 2000s (deflation era)', () => {
    const cpi2000 = getCpiIndex('JPY', '2000-07-01');
    const cpi2010 = getCpiIndex('JPY', '2010-07-01');
    expect(cpi2000).not.toBeNull();
    expect(cpi2010).not.toBeNull();
    // JPY CPI was roughly flat/declining from 2000 to 2010
    expect(Math.abs(cpi2000! - cpi2010!)).toBeLessThan(5);
  });

  it('CHF shows low inflation compared to USD', () => {
    const chf2025 = getCpiIndex('CHF', '2025-07-01');
    const usd2025 = getCpiIndex('USD', '2025-07-01');
    expect(chf2025).not.toBeNull();
    expect(usd2025).not.toBeNull();
    // CHF ~107 vs USD ~124 in 2025 — Switzerland has much lower inflation
    expect(chf2025!).toBeLessThan(usd2025!);
  });
});

// =============================================================================
// getCumulativeInflation
// =============================================================================

describe('getCumulativeInflation', () => {
  it('same date returns approximately 1.0', () => {
    const ratio = getCumulativeInflation('USD', '2020-07-01', '2020-07-01');
    expect(ratio).toBeCloseTo(1.0, 3);
  });

  it('positive inflation returns > 1.0 (USD)', () => {
    const ratio = getCumulativeInflation('USD', '2018-07-01', '2024-07-01');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(1.0);
    // USD: ~97.0 → ~121.2, so ~1.25 (25% cumulative inflation)
    expect(ratio!).toBeGreaterThan(1.2);
    expect(ratio!).toBeLessThan(1.35);
  });

  it('JPY deflation returns < 1.0 for early 2000s', () => {
    // Japan CPI fell from 2000 (97.3) to 2012 (94.5)
    const ratio = getCumulativeInflation('JPY', '2000-07-01', '2012-07-01');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(1.0);
  });

  it('JPY recent inflation returns > 1.0', () => {
    // Japan CPI rose from 2020 to 2025
    const ratio = getCumulativeInflation('JPY', '2020-07-01', '2025-07-01');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(1.0);
  });

  it('defaults toDate to now', () => {
    const ratio = getCumulativeInflation('USD', '2020-01-01');
    expect(ratio).not.toBeNull();
    // From 2020 to ~2026, should be well above 1.0
    expect(ratio!).toBeGreaterThan(1.15);
  });

  it('returns null for unknown currency', () => {
    expect(getCumulativeInflation('XYZ', '2020-01-01')).toBeNull();
  });

  it('returns null for date outside range', () => {
    expect(getCumulativeInflation('USD', '1990-01-01', '2020-01-01')).toBeNull();
  });

  it('handles all 7 currencies from 2010 to 2024', () => {
    const currencies = ['USD', 'JPY', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF'];
    for (const cur of currencies) {
      const ratio = getCumulativeInflation(cur, '2010-07-01', '2024-07-01');
      expect(ratio).not.toBeNull();
      // All currencies should show some net change over 14 years
      expect(typeof ratio).toBe('number');
    }
  });
});

// =============================================================================
// getInflationAdjustedAmount
// =============================================================================

describe('getInflationAdjustedAmount', () => {
  it('adjusts old purchase upward for high-inflation currency', () => {
    // $40,000 USD spent in mid-2018
    const adjusted = getInflationAdjustedAmount(40000, 'USD', '2018-07-01', '2024-07-01');
    expect(adjusted).not.toBeNull();
    // USD CPI 2018→2024: ~97 → ~121, so ~1.25 ratio → ~$50,000
    expect(adjusted!).toBeGreaterThan(45000);
    expect(adjusted!).toBeLessThan(55000);
  });

  it('recent purchase shows negligible adjustment', () => {
    const adjusted = getInflationAdjustedAmount(10000, 'USD', '2024-01-01', '2024-06-01');
    expect(adjusted).not.toBeNull();
    // 5 months of inflation — should be very close to original
    expect(Math.abs(adjusted! - 10000)).toBeLessThan(500);
  });

  it('returns null for unknown currency', () => {
    expect(getInflationAdjustedAmount(10000, 'XYZ', '2020-01-01')).toBeNull();
  });

  it('JPY deflation adjusts downward for 2000s purchases', () => {
    // ¥1M JPY in 2000 when CPI was 97.3, valued at 2012 when CPI was 94.5
    const adjusted = getInflationAdjustedAmount(1000000, 'JPY', '2000-07-01', '2012-07-01');
    expect(adjusted).not.toBeNull();
    // Deflation → adjusted amount is LESS than original
    expect(adjusted!).toBeLessThan(1000000);
  });

  it('CHF shows minimal adjustment (low inflation)', () => {
    const adjusted = getInflationAdjustedAmount(50000, 'CHF', '2015-07-01', '2024-07-01');
    expect(adjusted).not.toBeNull();
    // CHF CPI 2015→2024: ~99.3 → ~106.7, so ~1.07 ratio → ~$53,500
    expect(adjusted!).toBeGreaterThan(50000);
    expect(adjusted!).toBeLessThan(58000);
  });

  it('preserves zero amount', () => {
    const adjusted = getInflationAdjustedAmount(0, 'USD', '2020-01-01', '2024-01-01');
    expect(adjusted).toBe(0);
  });
});
