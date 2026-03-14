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

  /** -costBasisHome × (inflationFactor - 1). Negative = purchasing power lost. */
  inflationImpact: number | null;
  /** totalReturn + inflationImpact */
  realReturn: number | null;
  /** realReturn / (inflationAdjustedCost + expenses) × 100 */
  realReturnPct: number | null;
  /** costBasisHome × inflationFactor — what you paid in today's money */
  inflationAdjustedCost: number | null;

  /** Whether this is a realized (sold) or unrealized (owned) return */
  isRealized: boolean;
  /** Annualized return percentage (only when holdingDays >= 30) */
  annualizedReturnPct: number | null;
  /** Days between purchase and sold_date (or today for owned items) */
  holdingDays: number | null;
}

export interface ItemFinancialInput {
  purchase_price: number | null;
  purchase_currency: string | null;
  purchase_date: string | null;
  current_value: number | null;
  current_currency: string | null;

  // Holding status fields (sold items use sold_price as exit value)
  holding_status?: string;
  sold_price?: number | null;
  sold_currency?: string | null;
  sold_date?: string | null;
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
  const converted = convertPrice(amount, from, home, todayRates);
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
  inflationImpact: null,
  realReturn: null,
  realReturnPct: null,
  inflationAdjustedCost: null,
  isRealized: false,
  annualizedReturnPct: null,
  holdingDays: null,
};

// =============================================================================
// Main
// =============================================================================

/**
 * Compute holding days between two ISO date strings (or today).
 */
function computeHoldingDays(purchaseDate: string, endDate?: string | null): number | null {
  const start = new Date(purchaseDate);
  if (isNaN(start.getTime())) return null;
  const end = endDate ? new Date(endDate) : new Date();
  if (isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Compute annualized return percentage. Only meaningful for holding periods >= 30 days.
 */
function computeAnnualizedReturn(totalReturnPct: number | null, holdingDays: number | null): number | null {
  if (totalReturnPct == null || holdingDays == null || holdingDays < 30) return null;
  const totalReturnFraction = totalReturnPct / 100;
  // annualized = ((1 + totalReturn/invested) ^ (365/holdingDays) - 1) × 100
  const base = 1 + totalReturnFraction;
  if (base <= 0) return null; // Can't take fractional power of negative
  return (Math.pow(base, 365 / holdingDays) - 1) * 100;
}

/**
 * Compute gain/loss data for a single collection item.
 *
 * For sold items (holding_status = 'sold'), uses sold_price/sold_currency as exit value
 * and FX rates at sold_date (realized return, locked in).
 * For owned items, uses current_value/current_currency at today's rate (unrealized).
 *
 * @param item - Financial fields from the collection item
 * @param homeCurrency - User's home currency (e.g. "USD")
 * @param historicalRates - Map of "date|FROM|TO" → rate (from fetchBatchHistoricalRates)
 * @param todayRates - Today's exchange rates (from useCurrency)
 * @param expenseTotalsByCurrency - { "JPY": 50000, "USD": 200 } expense totals for this item
 * @param inflationFactor - CPI(today) / CPI(purchase). >1 = inflation, <1 = deflation. Optional.
 */
export function computeItemReturn(
  item: ItemFinancialInput,
  homeCurrency: string,
  historicalRates: FxRateMap,
  todayRates: ExchangeRates | null,
  expenseTotalsByCurrency?: Record<string, number>,
  inflationFactor?: number | null,
): ItemReturnData {
  const home = homeCurrency.toUpperCase();
  const isSold = item.holding_status === 'sold';
  const isRealized = isSold && item.sold_price != null && !!item.sold_currency;

  // Resolve exit value: sold items use sold_price, owned items use current_value
  const exitValue = isRealized ? item.sold_price! : item.current_value;
  const exitCurrency = isRealized ? item.sold_currency! : item.current_currency;
  const exitDate = isRealized ? item.sold_date : null; // null = use today's rate

  // Need at least an exit value to compute anything useful
  if (exitValue == null || !exitCurrency) {
    return NULL_RETURN;
  }

  // Convert exit value to home currency
  // For sold items: use sold_date historical rate (realized, locked in)
  // For owned items: use today's rate (unrealized, fluctuates)
  let exitValueHome: number | null;

  if (isRealized && exitDate) {
    const exitCur = exitCurrency.toUpperCase();
    if (exitCur === home) {
      exitValueHome = exitValue;
    } else {
      const soldDateRate = historicalRates.get(fxKey(exitDate, exitCur, home));
      if (soldDateRate == null) {
        // Fall back to today's rate if sold-date rate unavailable
        exitValueHome = toHome(exitValue, exitCurrency, home, todayRates);
      } else {
        exitValueHome = exitValue * soldDateRate;
      }
    }
  } else {
    exitValueHome = toHome(exitValue, exitCurrency, home, todayRates);
  }

  if (exitValueHome == null) return NULL_RETURN;

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

  // Compute holding days and annualized return metadata
  const holdingDays = item.purchase_date
    ? computeHoldingDays(item.purchase_date, isRealized ? item.sold_date : null)
    : null;

  // If no purchase price, we can still show current value but not returns
  if (item.purchase_price == null || !item.purchase_currency || !item.purchase_date) {
    return {
      currentValueHome: exitValueHome,
      totalInvestedHome: null,
      totalReturn: null,
      totalReturnPct: null,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
      inflationImpact: null,
      realReturn: null,
      realReturnPct: null,
      inflationAdjustedCost: null,
      isRealized,
      annualizedReturnPct: null,
      holdingDays,
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
        currentValueHome: exitValueHome,
        totalInvestedHome: null,
        totalReturn: null,
        totalReturnPct: null,
        canDecompose: false,
        assetReturn: null,
        fxImpact: null,
        expenseDrag: null,
        inflationImpact: null,
        realReturn: null,
        realReturnPct: null,
        inflationAdjustedCost: null,
        isRealized,
        annualizedReturnPct: null,
        holdingDays,
      };
    }
    costBasisHome = item.purchase_price * historicalRate;
  }

  const totalInvestedHome = costBasisHome + expensesHome;
  const totalReturn = exitValueHome - totalInvestedHome;
  const totalReturnPct = totalInvestedHome !== 0
    ? (totalReturn / totalInvestedHome) * 100
    : null;

  const annualizedReturnPct = computeAnnualizedReturn(totalReturnPct, holdingDays);

  // Decomposition: always possible when we have purchase-currency rates.
  // For sold items: FX impact = rate change between purchase date and sold date
  // For owned items: FX impact = rate change between purchase date and today

  // Get the exit-date rate for the PURCHASE currency → home
  // (sold: sold_date rate, owned: today's rate)
  let exitDateRateToHome: number | null;
  if (isRealized && exitDate) {
    exitDateRateToHome = purchCur === home
      ? 1
      : historicalRates.get(fxKey(exitDate, purchCur, home)) ?? null;
    // Fall back to today's rate if sold-date rate for purchase currency unavailable
    if (exitDateRateToHome == null) {
      exitDateRateToHome = purchCur === home ? 1 : toHome(1, purchCur, home, todayRates);
    }
  } else {
    exitDateRateToHome = purchCur === home
      ? 1
      : toHome(1, purchCur, home, todayRates);
  }

  if (exitDateRateToHome == null) {
    return {
      currentValueHome: exitValueHome,
      totalInvestedHome,
      totalReturn,
      totalReturnPct,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
      inflationImpact: null,
      realReturn: null,
      realReturnPct: null,
      inflationAdjustedCost: null,
      isRealized,
      annualizedReturnPct,
      holdingDays,
    };
  }

  // Historical rate for decomposition (purchase currency → home at purchase date)
  const historicalRateToHome = purchCur === home
    ? 1
    : historicalRates.get(fxKey(item.purchase_date, purchCur, home)) ?? null;

  if (historicalRateToHome == null) {
    return {
      currentValueHome: exitValueHome,
      totalInvestedHome,
      totalReturn,
      totalReturnPct,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
      inflationImpact: null,
      realReturn: null,
      realReturnPct: null,
      inflationAdjustedCost: null,
      isRealized,
      annualizedReturnPct,
      holdingDays,
    };
  }

  // FX impact: P_buy × (R_exit - R_purchase) — how much the purchase currency moved
  // For sold items, R_exit = rate at sold_date; for owned, R_exit = rate today
  const fxImpact = item.purchase_price * (exitDateRateToHome - historicalRateToHome);

  // Expense drag: negative of total expenses in home currency
  const expenseDrag = -expensesHome;

  // Asset return: residual so identity holds (asset + fx + expenses = total)
  const assetReturn = totalReturn - fxImpact - expenseDrag;

  // Inflation layer — purely additive, doesn't affect nominal values
  let inflationImpact: number | null = null;
  let realReturn: number | null = null;
  let realReturnPct: number | null = null;
  let inflationAdjustedCost: number | null = null;

  if (inflationFactor != null) {
    inflationImpact = -costBasisHome * (inflationFactor - 1);
    inflationAdjustedCost = costBasisHome * inflationFactor;
    realReturn = totalReturn + inflationImpact;
    const realDenominator = inflationAdjustedCost + expensesHome;
    realReturnPct = realDenominator !== 0
      ? (realReturn / realDenominator) * 100
      : null;
  }

  return {
    currentValueHome: exitValueHome,
    totalInvestedHome,
    totalReturn,
    totalReturnPct,
    canDecompose: true,
    assetReturn,
    fxImpact,
    expenseDrag,
    inflationImpact,
    realReturn,
    realReturnPct,
    inflationAdjustedCost,
    isRealized,
    annualizedReturnPct,
    holdingDays,
  };
}

export interface PortfolioSplit {
  totalValueHome: number;
  totalInvestedHome: number;
  totalReturn: number;
  totalReturnPct: number | null;
  itemCount: number;
}

export interface PortfolioTotals {
  totalValueHome: number;
  totalInvestedHome: number;
  totalReturn: number;
  totalReturnPct: number | null;
  totalAssetReturn: number;
  totalFxImpact: number;
  totalExpenseDrag: number;
  hasDecomposition: boolean;
  itemsWithData: number;
  totalInflationImpact: number;
  totalRealReturn: number;
  totalRealReturnPct: number | null;
  hasInflation: boolean;
  unrealized: PortfolioSplit;
  realized: PortfolioSplit;
}

/**
 * Aggregate return data across all items for portfolio totals.
 * Splits into unrealized (owned) and realized (sold) buckets.
 */
export function computePortfolioTotals(
  returnMap: Map<string, ItemReturnData>,
): PortfolioTotals {
  let totalValueHome = 0;
  let totalInvestedHome = 0;
  let totalAssetReturn = 0;
  let totalFxImpact = 0;
  let totalExpenseDrag = 0;
  let totalInflationImpact = 0;
  let totalInflationAdjustedCost = 0;
  let totalExpensesForReal = 0;
  let hasDecomposition = false;
  let hasInflation = false;
  let itemsWithData = 0;

  // Split buckets
  const unrealized: PortfolioSplit = { totalValueHome: 0, totalInvestedHome: 0, totalReturn: 0, totalReturnPct: null, itemCount: 0 };
  const realized: PortfolioSplit = { totalValueHome: 0, totalInvestedHome: 0, totalReturn: 0, totalReturnPct: null, itemCount: 0 };

  for (const data of returnMap.values()) {
    const bucket = data.isRealized ? realized : unrealized;

    if (data.currentValueHome != null) {
      totalValueHome += data.currentValueHome;
      bucket.totalValueHome += data.currentValueHome;
    }
    if (data.totalInvestedHome != null) {
      totalInvestedHome += data.totalInvestedHome;
      bucket.totalInvestedHome += data.totalInvestedHome;
    }
    if (data.totalReturn != null) {
      itemsWithData++;
      bucket.itemCount++;
      bucket.totalReturn += data.totalReturn;
    }
    if (data.canDecompose) {
      hasDecomposition = true;
      if (data.assetReturn != null) totalAssetReturn += data.assetReturn;
      if (data.fxImpact != null) totalFxImpact += data.fxImpact;
      if (data.expenseDrag != null) totalExpenseDrag += data.expenseDrag;
    }
    if (data.inflationImpact != null) {
      hasInflation = true;
      totalInflationImpact += data.inflationImpact;
      if (data.inflationAdjustedCost != null) totalInflationAdjustedCost += data.inflationAdjustedCost;
      if (data.expenseDrag != null) totalExpensesForReal += -data.expenseDrag; // expenseDrag is negative
    }
  }

  const totalReturn = totalValueHome - totalInvestedHome;
  const totalReturnPct = totalInvestedHome !== 0
    ? (totalReturn / totalInvestedHome) * 100
    : null;

  const totalRealReturn = totalReturn + totalInflationImpact;
  const realDenominator = totalInflationAdjustedCost + totalExpensesForReal;
  const totalRealReturnPct = hasInflation && realDenominator !== 0
    ? (totalRealReturn / realDenominator) * 100
    : null;

  // Compute per-bucket percentages
  unrealized.totalReturnPct = unrealized.totalInvestedHome !== 0
    ? (unrealized.totalReturn / unrealized.totalInvestedHome) * 100
    : null;
  realized.totalReturnPct = realized.totalInvestedHome !== 0
    ? (realized.totalReturn / realized.totalInvestedHome) * 100
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
    totalInflationImpact,
    totalRealReturn,
    totalRealReturnPct,
    hasInflation,
    unrealized,
    realized,
  };
}
