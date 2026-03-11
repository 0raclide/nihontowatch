'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from './useCurrency';

const VALID_CURRENCIES = ['USD', 'JPY', 'EUR', 'AUD', 'GBP', 'CAD', 'CHF'];

export interface UseHomeCurrencyReturn {
  homeCurrency: string;
  setHomeCurrency: (c: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook to read/write the user's home currency preference.
 *
 * Fallback chain: DB preference → browse currency → 'USD'
 */
export function useHomeCurrency(): UseHomeCurrencyReturn {
  const { currency: browseCurrency } = useCurrency();
  const [homeCurrency, setHomeCurrencyState] = useState<string>(browseCurrency || 'USD');
  const [isLoading, setIsLoading] = useState(true);
  const [fetched, setFetched] = useState(false);

  // Fetch from DB on mount
  useEffect(() => {
    if (fetched) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/user/preferences');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const dbCurrency = data?.preferences?.home_currency;
        if (dbCurrency && VALID_CURRENCIES.includes(dbCurrency)) {
          setHomeCurrencyState(dbCurrency);
        } else if (browseCurrency && VALID_CURRENCIES.includes(browseCurrency)) {
          setHomeCurrencyState(browseCurrency);
        }
      } catch {
        // Fall through to default
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setFetched(true);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fetched, browseCurrency]);

  const setHomeCurrency = useCallback(async (c: string) => {
    if (!VALID_CURRENCIES.includes(c)) return;
    setHomeCurrencyState(c);

    try {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_currency: c }),
      });
    } catch {
      // Optimistic — local state already updated
    }
  }, []);

  return { homeCurrency, setHomeCurrency, isLoading };
}
