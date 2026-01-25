/**
 * Currency Conversion Utility Tests
 *
 * Tests the price conversion functions from @/lib/currency/convert.
 * Verifies exchange rate calculations and edge case handling.
 */

import { describe, it, expect } from 'vitest';
import {
  convertPriceToJPY,
  convertPricesToJPY,
  EXCHANGE_RATES,
} from '@/lib/currency/convert';

// =============================================================================
// EXCHANGE RATES TESTS
// =============================================================================

describe('EXCHANGE_RATES', () => {
  it('exports exchange rates constant', () => {
    expect(EXCHANGE_RATES).toBeDefined();
    expect(typeof EXCHANGE_RATES).toBe('object');
  });

  it('has JPY rate of 1', () => {
    expect(EXCHANGE_RATES.JPY).toBe(1);
  });

  it('has USD rate of 150', () => {
    expect(EXCHANGE_RATES.USD).toBe(150);
  });

  it('has EUR rate of 165', () => {
    expect(EXCHANGE_RATES.EUR).toBe(165);
  });

  it('has GBP rate of 190', () => {
    expect(EXCHANGE_RATES.GBP).toBe(190);
  });
});

// =============================================================================
// convertPriceToJPY TESTS
// =============================================================================

describe('convertPriceToJPY', () => {
  // ===========================================================================
  // JPY CONVERSION (NO CHANGE)
  // ===========================================================================

  describe('JPY conversion', () => {
    it('returns same value for JPY', () => {
      expect(convertPriceToJPY(100000, 'JPY')).toBe(100000);
    });

    it('handles large JPY values', () => {
      expect(convertPriceToJPY(50000000, 'JPY')).toBe(50000000);
    });

    it('handles small JPY values', () => {
      expect(convertPriceToJPY(1, 'JPY')).toBe(1);
    });
  });

  // ===========================================================================
  // USD CONVERSION
  // ===========================================================================

  describe('USD conversion', () => {
    it('converts USD to JPY at 150 rate', () => {
      expect(convertPriceToJPY(100, 'USD')).toBe(15000);
    });

    it('converts $1000 USD correctly', () => {
      expect(convertPriceToJPY(1000, 'USD')).toBe(150000);
    });

    it('converts decimal USD values', () => {
      expect(convertPriceToJPY(99.99, 'USD')).toBeCloseTo(14998.5, 1);
    });
  });

  // ===========================================================================
  // EUR CONVERSION
  // ===========================================================================

  describe('EUR conversion', () => {
    it('converts EUR to JPY at 165 rate', () => {
      expect(convertPriceToJPY(100, 'EUR')).toBe(16500);
    });

    it('converts 1000 EUR correctly', () => {
      expect(convertPriceToJPY(1000, 'EUR')).toBe(165000);
    });
  });

  // ===========================================================================
  // GBP CONVERSION
  // ===========================================================================

  describe('GBP conversion', () => {
    it('converts GBP to JPY at 190 rate', () => {
      expect(convertPriceToJPY(100, 'GBP')).toBe(19000);
    });

    it('converts 1000 GBP correctly', () => {
      expect(convertPriceToJPY(1000, 'GBP')).toBe(190000);
    });
  });

  // ===========================================================================
  // NULL/INVALID INPUT HANDLING
  // ===========================================================================

  describe('null and invalid input handling', () => {
    it('returns 0 for null price value', () => {
      expect(convertPriceToJPY(null, 'JPY')).toBe(0);
    });

    it('returns 0 for undefined price value', () => {
      expect(convertPriceToJPY(undefined, 'JPY')).toBe(0);
    });

    it('returns 0 for zero price value', () => {
      expect(convertPriceToJPY(0, 'JPY')).toBe(0);
    });

    it('returns 0 for negative price value', () => {
      expect(convertPriceToJPY(-100, 'JPY')).toBe(0);
    });

    it('handles null currency as JPY', () => {
      expect(convertPriceToJPY(100000, null)).toBe(100000);
    });

    it('handles undefined currency as JPY', () => {
      expect(convertPriceToJPY(100000, undefined)).toBe(100000);
    });

    it('handles unknown currency with 1:1 rate', () => {
      expect(convertPriceToJPY(100000, 'XYZ')).toBe(100000);
    });

    it('handles empty string currency with 1:1 rate', () => {
      expect(convertPriceToJPY(100000, '')).toBe(100000);
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles very small positive values', () => {
      expect(convertPriceToJPY(0.01, 'USD')).toBeCloseTo(1.5, 1);
    });

    it('handles very large values', () => {
      expect(convertPriceToJPY(1000000, 'USD')).toBe(150000000);
    });

    it('handles lowercase currency code with default rate', () => {
      // Lowercase won't match - should use default 1:1 rate
      expect(convertPriceToJPY(100, 'usd')).toBe(100);
    });
  });
});

// =============================================================================
// convertPricesToJPY TESTS
// =============================================================================

describe('convertPricesToJPY', () => {
  // ===========================================================================
  // BASIC CONVERSION
  // ===========================================================================

  describe('basic conversion', () => {
    it('converts array of JPY listings', () => {
      const listings = [
        { price_value: 100000, price_currency: 'JPY' },
        { price_value: 200000, price_currency: 'JPY' },
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([100000, 200000]);
    });

    it('converts mixed currency listings', () => {
      const listings = [
        { price_value: 100000, price_currency: 'JPY' },
        { price_value: 1000, price_currency: 'USD' }, // 150,000 JPY
        { price_value: 1000, price_currency: 'EUR' }, // 165,000 JPY
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([100000, 150000, 165000]);
    });
  });

  // ===========================================================================
  // FILTERING INVALID VALUES
  // ===========================================================================

  describe('filtering invalid values', () => {
    it('filters out null price values', () => {
      const listings = [
        { price_value: null, price_currency: 'JPY' },
        { price_value: 100000, price_currency: 'JPY' },
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([100000]);
    });

    it('filters out zero price values', () => {
      const listings = [
        { price_value: 0, price_currency: 'JPY' },
        { price_value: 100000, price_currency: 'JPY' },
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([100000]);
    });

    it('filters out negative price values', () => {
      const listings = [
        { price_value: -50000, price_currency: 'JPY' },
        { price_value: 100000, price_currency: 'JPY' },
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([100000]);
    });

    it('returns empty array when all values are invalid', () => {
      const listings = [
        { price_value: null, price_currency: 'JPY' },
        { price_value: 0, price_currency: 'USD' },
        { price_value: -100, price_currency: 'EUR' },
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // EMPTY AND EDGE CASES
  // ===========================================================================

  describe('empty and edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = convertPricesToJPY([]);

      expect(result).toEqual([]);
    });

    it('handles single listing', () => {
      const listings = [{ price_value: 100000, price_currency: 'JPY' }];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([100000]);
    });

    it('handles null currency in listings', () => {
      const listings = [{ price_value: 100000, price_currency: null }];

      const result = convertPricesToJPY(listings);

      // Should treat null as JPY (1:1 rate)
      expect(result).toEqual([100000]);
    });

    it('preserves order of valid listings', () => {
      const listings = [
        { price_value: 300000, price_currency: 'JPY' },
        { price_value: 100000, price_currency: 'JPY' },
        { price_value: 200000, price_currency: 'JPY' },
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([300000, 100000, 200000]);
    });

    it('handles large arrays efficiently', () => {
      const listings = Array.from({ length: 10000 }, (_, i) => ({
        price_value: (i + 1) * 1000,
        price_currency: 'JPY',
      }));

      const result = convertPricesToJPY(listings);

      expect(result.length).toBe(10000);
      expect(result[0]).toBe(1000);
      expect(result[9999]).toBe(10000000);
    });
  });

  // ===========================================================================
  // MIXED VALID/INVALID SCENARIOS
  // ===========================================================================

  describe('mixed valid/invalid scenarios', () => {
    it('handles realistic mixed data', () => {
      const listings = [
        { price_value: 1500000, price_currency: 'JPY' },     // Valid
        { price_value: null, price_currency: 'JPY' },        // Filtered
        { price_value: 5000, price_currency: 'USD' },        // 750,000 JPY
        { price_value: 0, price_currency: 'EUR' },           // Filtered
        { price_value: 3000, price_currency: 'GBP' },        // 570,000 JPY
        { price_value: -100, price_currency: 'JPY' },        // Filtered
        { price_value: 2000000, price_currency: 'JPY' },     // Valid
      ];

      const result = convertPricesToJPY(listings);

      expect(result).toEqual([1500000, 750000, 570000, 2000000]);
      expect(result.length).toBe(4);
    });
  });
});
