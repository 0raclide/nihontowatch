'use client';

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type Currency = 'USD' | 'JPY' | 'EUR';

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'preferred_currency';
const DEFAULT_CURRENCY: Currency = 'JPY';

// Cache exchange rates in memory (shared across hook instances)
let cachedRates: ExchangeRates | null = null;
let ratesFetchPromise: Promise<ExchangeRates | null> | null = null;

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to get the user's currency preference and exchange rates.
 * Reads from localStorage and caches exchange rates.
 */
export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(cachedRates);
  const [isLoading, setIsLoading] = useState(!cachedRates);

  // Load currency preference from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['USD', 'JPY', 'EUR'].includes(stored)) {
      setCurrencyState(stored as Currency);
    }
  }, []);

  // Fetch exchange rates (with caching)
  useEffect(() => {
    async function fetchRates() {
      // Use cached rates if available
      if (cachedRates) {
        setExchangeRates(cachedRates);
        setIsLoading(false);
        return;
      }

      // Wait for in-flight request if one exists
      if (ratesFetchPromise) {
        const rates = await ratesFetchPromise;
        setExchangeRates(rates);
        setIsLoading(false);
        return;
      }

      // Fetch new rates
      ratesFetchPromise = fetch('/api/exchange-rates')
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);

      const rates = await ratesFetchPromise;
      cachedRates = rates;
      ratesFetchPromise = null;

      setExchangeRates(rates);
      setIsLoading(false);
    }

    fetchRates();
  }, []);

  // Update currency preference
  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newCurrency);
    }
  }, []);

  return {
    currency,
    setCurrency,
    exchangeRates,
    isLoading,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a price from one currency to another using exchange rates.
 */
export function convertPrice(
  value: number,
  sourceCurrency: string,
  targetCurrency: Currency,
  rates: ExchangeRates | null
): number {
  if (!rates || sourceCurrency === targetCurrency) {
    return value;
  }

  const source = sourceCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();

  // Convert through USD (base currency)
  const sourceRate = source === 'USD' ? 1 : rates.rates[source];
  const targetRate = target === 'USD' ? 1 : rates.rates[target];

  if (!sourceRate || !targetRate) {
    return value;
  }

  // Convert source to USD, then USD to target
  return (value / sourceRate) * targetRate;
}

/**
 * Format a price with currency conversion.
 */
export function formatPriceWithConversion(
  value: number | null | undefined,
  sourceCurrency: string | null,
  targetCurrency: Currency,
  rates: ExchangeRates | null
): string {
  if (value === null || value === undefined) {
    return 'Ask';
  }

  const source = sourceCurrency || 'JPY';
  const converted = convertPrice(value, source, targetCurrency, rates);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: targetCurrency,
    maximumFractionDigits: 0,
  }).format(converted);
}
