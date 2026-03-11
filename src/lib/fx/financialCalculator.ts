/**
 * Pure financial calculator for vault gain/loss decomposition.
 *
 * All functions are pure — no side effects, no API calls.
 * FX rates and today's rates are passed in as parameters.
 */

import type { ExchangeRates } from '@/hooks/useCurrency';
import { convertPrice } from '@/hooks/useCurrency';
import type { FxRateMap } from './batchHistoricalRates';
import { fxKey } from './batchHistoricalRates';

// =============================================================================
// Types
// =============================================================================

export interface ItemReturnData {
  /** Current value converted to home currency */
  currentValueHome: number | null;
  /** Cost basis + all expenses, converted to home currency */
  totalInvestedHome: number | null;
  /** currentValueHome - totalInvestedHome */
  totalReturn: number | null;
  /** totalReturn / totalInvestedHome as percentage */
  totalReturnPct: number | null;

  /** Whether asset vs FX decomposition is available */
  canDecompose: boolean;
  /** (V_now - P_buy) × R_today_to_home */
  assetReturn: number | null;
  /** P_buy × (R_today_to_home - R_purchase_to_home) */
  fxImpact: number | null;
  /** -(sum of expenses converted at today's rate) */
  expenseDrag: number | null;
}

export interface ItemFinancialInput {
  purchase_price: number | null;
  purchase_currency: string | null;
  purchase_date: string | null;
  current_value: number | null;
  current_currency: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert an amount to home currency using today's exchange rates.
 * Returns null if rates are unavailable.
 */
function toHome(
  amount: number,
  fromCurrency: string,
  homeCurrency: string,
  todayRates: ExchangeRates | null,
): number | null {
  const from = fromCurrency.toUpperCase();
  const home = homeCurrency.toUpperCase();
  if (from === home) return amount;
  if (!todayRates) return null;
  const converted = convertPrice(amount, from, home as 'USD' | 'JPY' | 'EUR', todayRates);
  // convertPrice returns the original value if rates missing — detect that case
  if (from !== home && converted === amount) return null;
  return converted;
}

const NULL_RETURN: ItemReturnData = {
  currentValueHome: null,
  totalInvestedHome: null,
  totalReturn: null,
  totalReturnPct: null,
  canDecompose: false,
  assetReturn: null,
  fxImpact: null,
  expenseDrag: null,
};

// =============================================================================
// Main
// =============================================================================

/**
 * Compute gain/loss data for a single collection item.
 *
 * @param item - Financial fields from the collection item
 * @param homeCurrency - User's home currency (e.g. "USD")
 * @param historicalRates - Map of "date|FROM|TO" → rate (from fetchBatchHistoricalRates)
 * @param todayRates - Today's exchange rates (from useCurrency)
 * @param expenseTotalsByCurrency - { "JPY": 50000, "USD": 200 } expense totals for this item
 */
export function computeItemReturn(
  item: ItemFinancialInput,
  homeCurrency: string,
  historicalRates: FxRateMap,
  todayRates: ExchangeRates | null,
  expenseTotalsByCurrency?: Record<string, number>,
): ItemReturnData {
  const home = homeCurrency.toUpperCase();

  // Need at least current_value to compute anything useful
  if (item.current_value == null || !item.current_currency) {
    return NULL_RETURN;
  }

  // Convert current value to home currency
  const currentValueHome = toHome(item.current_value, item.current_currency, home, todayRates);
  if (currentValueHome == null) return NULL_RETURN;

  // Convert expenses to home currency (all at today's rate)
  let expensesHome = 0;
  if (expenseTotalsByCurrency) {
    for (const [cur, amount] of Object.entries(expenseTotalsByCurrency)) {
      const converted = toHome(amount, cur, home, todayRates);
      if (converted != null) {
        expensesHome += converted;
      }
    }
  }

  // If no purchase price, we can still show current value but not returns
  if (item.purchase_price == null || !item.purchase_currency || !item.purchase_date) {
    return {
      currentValueHome,
      totalInvestedHome: null,
      totalReturn: null,
      totalReturnPct: null,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
    };
  }

  // Get historical rate for purchase date
  const purchCur = item.purchase_currency.toUpperCase();
  let costBasisHome: number;

  if (purchCur === home) {
    costBasisHome = item.purchase_price;
  } else {
    const historicalRate = historicalRates.get(fxKey(item.purchase_date, purchCur, home));
    if (historicalRate == null) {
      // No historical rate available — can't compute proper cost basis
      return {
        currentValueHome,
        totalInvestedHome: null,
        totalReturn: null,
        totalReturnPct: null,
        canDecompose: false,
        assetReturn: null,
        fxImpact: null,
        expenseDrag: null,
      };
    }
    costBasisHome = item.purchase_price * historicalRate;
  }

  const totalInvestedHome = costBasisHome + expensesHome;
  const totalReturn = currentValueHome - totalInvestedHome;
  const totalReturnPct = totalInvestedHome !== 0
    ? (totalReturn / totalInvestedHome) * 100
    : null;

  // Decomposition: only when purchase_currency === current_currency
  // (same asset currency means we can cleanly separate asset gain from FX)
  const currCur = item.current_currency.toUpperCase();
  const canDecompose = purchCur === currCur;

  if (!canDecompose) {
    return {
      currentValueHome,
      totalInvestedHome,
      totalReturn,
      totalReturnPct,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
    };
  }

  // Get today's rate for the asset currency → home
  const todayRateToHome = purchCur === home
    ? 1
    : (() => {
        const converted = toHome(1, purchCur, home, todayRates);
        return converted;
      })();

  if (todayRateToHome == null) {
    return {
      currentValueHome,
      totalInvestedHome,
      totalReturn,
      totalReturnPct,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
    };
  }

  // Historical rate for decomposition
  const historicalRateToHome = purchCur === home
    ? 1
    : historicalRates.get(fxKey(item.purchase_date, purchCur, home)) ?? null;

  if (historicalRateToHome == null) {
    return {
      currentValueHome,
      totalInvestedHome,
      totalReturn,
      totalReturnPct,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
    };
  }

  // Asset return: (V_now - P_buy) × R_today
  const assetReturn = (item.current_value - item.purchase_price) * todayRateToHome;

  // FX impact: P_buy × (R_today - R_purchase)
  const fxImpact = item.purchase_price * (todayRateToHome - historicalRateToHome);

  // Expense drag: negative of total expenses in home currency
  const expenseDrag = -expensesHome;

  return {
    currentValueHome,
    totalInvestedHome,
    totalReturn,
    totalReturnPct,
    canDecompose: true,
    assetReturn,
    fxImpact,
    expenseDrag,
  };
}

/**
 * Aggregate return data across all items for portfolio totals.
 */
export function computePortfolioTotals(
  returnMap: Map<string, ItemReturnData>,
): {
  totalValueHome: number;
  totalInvestedHome: number;
  totalReturn: number;
  totalReturnPct: number | null;
  totalAssetReturn: number;
  totalFxImpact: number;
  totalExpenseDrag: number;
  hasDecomposition: boolean;
  itemsWithData: number;
} {
  let totalValueHome = 0;
  let totalInvestedHome = 0;
  let totalAssetReturn = 0;
  let totalFxImpact = 0;
  let totalExpenseDrag = 0;
  let hasDecomposition = false;
  let itemsWithData = 0;

  for (const data of returnMap.values()) {
    if (data.currentValueHome != null) {
      totalValueHome += data.currentValueHome;
    }
    if (data.totalInvestedHome != null) {
      totalInvestedHome += data.totalInvestedHome;
    }
    if (data.totalReturn != null) {
      itemsWithData++;
    }
    if (data.canDecompose) {
      hasDecomposition = true;
      if (data.assetReturn != null) totalAssetReturn += data.assetReturn;
      if (data.fxImpact != null) totalFxImpact += data.fxImpact;
      if (data.expenseDrag != null) totalExpenseDrag += data.expenseDrag;
    }
  }

  const totalReturn = totalValueHome - totalInvestedHome;
  const totalReturnPct = totalInvestedHome !== 0
    ? (totalReturn / totalInvestedHome) * 100
    : null;

  return {
    totalValueHome,
    totalInvestedHome,
    totalReturn,
    totalReturnPct,
    totalAssetReturn,
    totalFxImpact,
    totalExpenseDrag,
    hasDecomposition,
    itemsWithData,
  };
}
