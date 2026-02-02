/**
 * Currency Conversion Utilities
 *
 * Provides shared currency conversion helpers for price calculations.
 * Uses approximate exchange rates for analytics and display purposes.
 *
 * Note: For real-time accurate rates, use the exchange-rates API instead.
 *
 * @module lib/currency/convert
 *
 * Usage:
 *   import { convertPriceToJPY, convertPricesToJPY, EXCHANGE_RATES } from '@/lib/currency/convert';
 *
 *   const priceJPY = convertPriceToJPY(100, 'USD'); // ~15000
 *   const prices = convertPricesToJPY(listings);
 */

/**
 * Approximate exchange rates to JPY.
 * These are rough estimates for analytics purposes.
 * For accurate conversion, use real-time exchange rates.
 */
export const EXCHANGE_RATES: Record<string, number> = {
  JPY: 1,
  USD: 150,
  EUR: 165,
  GBP: 190,
  AUD: 97, // ~150/1.55 = 96.77, rounded to 97
};

/**
 * Convert a single price value to JPY.
 *
 * @param priceValue - The price amount
 * @param currency - The currency code (JPY, USD, EUR, GBP)
 * @returns Price in JPY, or 0 if invalid
 *
 * @example
 * convertPriceToJPY(100, 'USD'); // 15000
 * convertPriceToJPY(null, 'JPY'); // 0
 */
export function convertPriceToJPY(
  priceValue: number | null | undefined,
  currency: string | null | undefined
): number {
  if (!priceValue || priceValue <= 0) {
    return 0;
  }

  const rate = EXCHANGE_RATES[currency || 'JPY'] || 1;
  return priceValue * rate;
}

/**
 * Convert an array of listings with prices to JPY values.
 *
 * @param listings - Array of objects with price_value and price_currency
 * @returns Array of valid price values in JPY (filters out nulls and zeros)
 *
 * @example
 * const listings = [
 *   { price_value: 100, price_currency: 'USD' },
 *   { price_value: 50000, price_currency: 'JPY' },
 *   { price_value: null, price_currency: null },
 * ];
 * convertPricesToJPY(listings); // [15000, 50000]
 */
export function convertPricesToJPY(
  listings: Array<{ price_value: number | null; price_currency: string | null }>
): number[] {
  return listings
    .filter(
      (l): l is { price_value: number; price_currency: string | null } =>
        l.price_value !== null && l.price_value > 0
    )
    .map((l) => convertPriceToJPY(l.price_value, l.price_currency));
}
