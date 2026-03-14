'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { DisplayItem } from '@/types/displayItem';
import { useCurrency } from './useCurrency';
import type { FxRateMap } from '@/lib/fx/batchHistoricalRates';
import { fetchBatchHistoricalRates } from '@/lib/fx/batchHistoricalRates';
import type { ItemReturnData } from '@/lib/fx/financialCalculator';
import { computeItemReturn } from '@/lib/fx/financialCalculator';
import { getCumulativeInflation } from '@/lib/fx/inflation';
import type { ExpenseTotalsMap } from '@/lib/displayItem/fromCollectionItem';

/**
 * Orchestrates historical FX fetching and per-item return computation.
 */
export function useVaultReturns(
  items: DisplayItem[],
  homeCurrency: string,
  expenseTotals: ExpenseTotalsMap,
): {
  returnMap: Map<string, ItemReturnData>;
  isLoadingRates: boolean;
} {
  const { fetchHistoricalRate, exchangeRates } = useCurrency();
  const [historicalRates, setHistoricalRates] = useState<FxRateMap>(new Map());
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Track request identity to avoid stale updates
  const requestIdRef = useRef(0);

  // Fetch historical rates when items or home currency change
  // Include sold_date rates for realized return computation
  useEffect(() => {
    const rateItems: { purchase_date: string | null; purchase_currency: string | null }[] = [];
    for (const i of items) {
      const ext = i.collection;
      if (!ext) continue;
      // Purchase date rate (always needed)
      rateItems.push({
        purchase_date: ext.purchase_date,
        purchase_currency: ext.purchase_currency,
      });
      // Sold date rates (for realized returns — sold_currency→home and purchase_currency→home at sold_date)
      if (ext.holding_status === 'sold' && ext.sold_date) {
        if (ext.sold_currency) {
          rateItems.push({
            purchase_date: ext.sold_date,
            purchase_currency: ext.sold_currency,
          });
        }
        if (ext.purchase_currency) {
          rateItems.push({
            purchase_date: ext.sold_date,
            purchase_currency: ext.purchase_currency,
          });
        }
      }
    }

    if (rateItems.length === 0) {
      setHistoricalRates(new Map());
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoadingRates(true);

    fetchBatchHistoricalRates(rateItems, homeCurrency, fetchHistoricalRate)
      .then(map => {
        if (requestIdRef.current === requestId) {
          setHistoricalRates(map);
        }
      })
      .catch(() => {
        if (requestIdRef.current === requestId) {
          setHistoricalRates(new Map());
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setIsLoadingRates(false);
        }
      });
  }, [items, homeCurrency, fetchHistoricalRate]);

  // Compute returns for each item
  const returnMap = useMemo(() => {
    const map = new Map<string, ItemReturnData>();

    for (const item of items) {
      const ext = item.collection;
      if (!ext) continue;

      const itemId = String(item.id);

      // Look up expense totals — ExpenseTotalsMap keys by DB id (number),
      // but item.id here is item_uuid (string). We need to find by item_uuid.
      // The expenseTotals map uses DB numeric ID as key, which we don't have here.
      // However, onExpenseTotalsChange in CollectionPageClient stores by item_uuid.
      const itemExpenses = expenseTotals[itemId];

      // Compute inflation factor from purchase date to today (synchronous, static CPI data)
      let inflationFactor: number | null = null;
      if (ext.purchase_date) {
        inflationFactor = getCumulativeInflation(homeCurrency, ext.purchase_date);
      }

      const data = computeItemReturn(
        {
          purchase_price: ext.purchase_price,
          purchase_currency: ext.purchase_currency,
          purchase_date: ext.purchase_date,
          current_value: ext.current_value,
          current_currency: ext.current_currency,
          holding_status: ext.holding_status,
          sold_price: ext.sold_price,
          sold_currency: ext.sold_currency,
          sold_date: ext.sold_date,
        },
        homeCurrency,
        historicalRates,
        exchangeRates,
        itemExpenses,
        inflationFactor,
      );

      map.set(itemId, data);
    }

    return map;
  }, [items, homeCurrency, historicalRates, exchangeRates, expenseTotals]);

  return { returnMap, isLoadingRates };
}
