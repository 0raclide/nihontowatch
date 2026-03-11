import { describe, it, expect } from 'vitest';
import type { ExchangeRates } from '@/hooks/useCurrency';
import type { FxRateMap } from '@/lib/fx/batchHistoricalRates';
import { fxKey } from '@/lib/fx/batchHistoricalRates';
import { computeItemReturn, computePortfolioTotals } from '@/lib/fx/financialCalculator';
import type { ItemReturnData, ItemFinancialInput } from '@/lib/fx/financialCalculator';

// =============================================================================
// Helpers
// =============================================================================

function makeRates(rates: Record<string, number>): ExchangeRates {
  return { base: 'USD', rates, timestamp: Date.now() };
}

// Today's rates: USD=1 (base), JPY=150, EUR=0.92, GBP=0.79
const TODAY_RATES = makeRates({ JPY: 150, EUR: 0.92, GBP: 0.79, AUD: 1.55, CAD: 1.37, CHF: 0.88 });

function buildHistoricalRates(entries: Array<[string, string, string, number]>): FxRateMap {
  const map: FxRateMap = new Map();
  for (const [date, from, to, rate] of entries) {
    map.set(fxKey(date, from, to), rate);
  }
  return map;
}

// =============================================================================
// computeItemReturn
// =============================================================================

describe('computeItemReturn', () => {
  it('returns null when current_value is null', () => {
    const result = computeItemReturn(
      { purchase_price: 1000000, purchase_currency: 'JPY', purchase_date: '2024-01-15', current_value: null, current_currency: null },
      'USD',
      new Map(),
      TODAY_RATES,
    );
    expect(result.totalReturn).toBeNull();
    expect(result.currentValueHome).toBeNull();
  });

  it('returns null when current_currency is null', () => {
    const result = computeItemReturn(
      { purchase_price: 1000000, purchase_currency: 'JPY', purchase_date: '2024-01-15', current_value: 2000000, current_currency: null },
      'USD',
      new Map(),
      TODAY_RATES,
    );
    expect(result.totalReturn).toBeNull();
  });

  it('returns currentValueHome but null returns when purchase_price is null', () => {
    const result = computeItemReturn(
      { purchase_price: null, purchase_currency: null, purchase_date: null, current_value: 2000000, current_currency: 'JPY' },
      'USD',
      new Map(),
      TODAY_RATES,
    );
    expect(result.currentValueHome).toBeCloseTo(2000000 / 150, 0);
    expect(result.totalReturn).toBeNull();
    expect(result.totalInvestedHome).toBeNull();
  });

  it('computes same-currency (JPY→JPY) with USD home — basic gain', () => {
    // Bought at ¥2M when 1 JPY = 1/110 USD (rate JPY→USD = 0.00909)
    // Now worth ¥2.5M at 1 JPY = 1/150 USD (rate JPY→USD = 0.00667)
    const historicalRates = buildHistoricalRates([
      ['2023-06-01', 'JPY', 'USD', 1 / 110],  // ¥110 = $1 → 1 JPY = 0.00909 USD
    ]);

    const result = computeItemReturn(
      { purchase_price: 2000000, purchase_currency: 'JPY', purchase_date: '2023-06-01', current_value: 2500000, current_currency: 'JPY' },
      'USD',
      historicalRates,
      TODAY_RATES,
    );

    // Cost basis: 2M × (1/110) = $18,181.82
    expect(result.totalInvestedHome).toBeCloseTo(18181.82, 0);
    // Current value: 2.5M × (1/150) = $16,666.67
    expect(result.currentValueHome).toBeCloseTo(16666.67, 0);
    // Total return: 16666.67 - 18181.82 = -$1,515.15
    expect(result.totalReturn).toBeCloseTo(-1515.15, 0);

    // Decomposition available (same currency JPY/JPY)
    expect(result.canDecompose).toBe(true);

    // Asset return: (2.5M - 2M) × (1/150) = 500K × 0.00667 = $3,333.33
    expect(result.assetReturn).toBeCloseTo(3333.33, 0);
    // FX impact: 2M × ((1/150) - (1/110)) = 2M × (0.00667 - 0.00909) = -$4,848.48
    expect(result.fxImpact).toBeCloseTo(-4848.48, 0);

    // Identity: asset + fx + expenses ≈ total
    expect(result.assetReturn! + result.fxImpact! + result.expenseDrag!).toBeCloseTo(result.totalReturn!, 1);
  });

  it('home currency matches item currency — FX impact is zero', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-06-01', current_value: 12000, current_currency: 'USD' },
      'USD',
      new Map(), // No historical rates needed — same currency as home
      TODAY_RATES,
    );

    expect(result.currentValueHome).toBe(12000);
    expect(result.totalInvestedHome).toBe(10000);
    expect(result.totalReturn).toBe(2000);
    expect(result.totalReturnPct).toBeCloseTo(20, 1);
    expect(result.canDecompose).toBe(true);
    expect(result.assetReturn).toBe(2000);
    expect(result.fxImpact).toBe(0);
    expect(result.expenseDrag).toBeCloseTo(0);
  });

  it('mixed currencies — canDecompose is false', () => {
    // Bought in JPY, current value in USD — different currencies
    const historicalRates = buildHistoricalRates([
      ['2023-06-01', 'JPY', 'USD', 1 / 110],
    ]);

    const result = computeItemReturn(
      { purchase_price: 2000000, purchase_currency: 'JPY', purchase_date: '2023-06-01', current_value: 15000, current_currency: 'USD' },
      'USD',
      historicalRates,
      TODAY_RATES,
    );

    expect(result.canDecompose).toBe(false);
    expect(result.assetReturn).toBeNull();
    expect(result.fxImpact).toBeNull();
    // But totalReturn should still be computed
    expect(result.totalReturn).not.toBeNull();
    expect(result.currentValueHome).toBe(15000); // Already in USD
    expect(result.totalInvestedHome).toBeCloseTo(18181.82, 0);
    expect(result.totalReturn).toBeCloseTo(-3181.82, 0);
  });

  it('includes expenses in total invested', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 13000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
      { 'USD': 500, 'JPY': 15000 }, // $500 + ¥15000
    );

    // Expenses: $500 + ¥15000/150 = $500 + $100 = $600
    expect(result.totalInvestedHome).toBeCloseTo(10600, 0);
    expect(result.totalReturn).toBeCloseTo(2400, 0);
    expect(result.canDecompose).toBe(true);
    expect(result.expenseDrag).toBeCloseTo(-600, 0);
    // Identity check
    expect(result.assetReturn! + result.fxImpact! + result.expenseDrag!).toBeCloseTo(result.totalReturn!, 1);
  });

  it('zero return', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 10000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
    );

    expect(result.totalReturn).toBe(0);
    expect(result.totalReturnPct).toBe(0);
    expect(result.assetReturn).toBe(0);
    expect(result.fxImpact).toBe(0);
  });

  it('negative return', () => {
    const result = computeItemReturn(
      { purchase_price: 15000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 10000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
    );

    expect(result.totalReturn).toBe(-5000);
    expect(result.totalReturnPct).toBeCloseTo(-33.33, 1);
  });

  it('percentage sign matches absolute sign', () => {
    // Positive
    const pos = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 12000, current_currency: 'USD' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(pos.totalReturn!).toBeGreaterThan(0);
    expect(pos.totalReturnPct!).toBeGreaterThan(0);

    // Negative
    const neg = computeItemReturn(
      { purchase_price: 12000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 10000, current_currency: 'USD' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(neg.totalReturn!).toBeLessThan(0);
    expect(neg.totalReturnPct!).toBeLessThan(0);
  });

  it('handles EUR home currency', () => {
    const historicalRates = buildHistoricalRates([
      ['2023-06-01', 'USD', 'EUR', 0.85], // Historical: $1 = €0.85
    ]);

    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-06-01', current_value: 12000, current_currency: 'USD' },
      'EUR',
      historicalRates,
      TODAY_RATES,
    );

    // Cost basis: $10K × 0.85 = €8,500
    expect(result.totalInvestedHome).toBeCloseTo(8500, 0);
    // Current value: $12K × (0.92/1) = €11,040
    expect(result.currentValueHome).toBeCloseTo(11040, 0);
    // Return: 11040 - 8500 = €2,540
    expect(result.totalReturn).toBeCloseTo(2540, 0);
    expect(result.canDecompose).toBe(true);
  });

  it('returns null return data when historical rate unavailable', () => {
    // No historical rates in map
    const result = computeItemReturn(
      { purchase_price: 2000000, purchase_currency: 'JPY', purchase_date: '2023-06-01', current_value: 2500000, current_currency: 'JPY' },
      'USD',
      new Map(), // empty — no rate for 2023-06-01|JPY|USD
      TODAY_RATES,
    );

    expect(result.currentValueHome).toBeCloseTo(16666.67, 0);
    expect(result.totalReturn).toBeNull();
    expect(result.totalInvestedHome).toBeNull();
  });

  it('handles missing purchase_date gracefully', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: null, current_value: 12000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
    );

    expect(result.currentValueHome).toBe(12000);
    expect(result.totalReturn).toBeNull(); // Can't compute without date for historical rate
  });

  it('handles null today rates gracefully', () => {
    const result = computeItemReturn(
      { purchase_price: 2000000, purchase_currency: 'JPY', purchase_date: '2023-06-01', current_value: 2500000, current_currency: 'JPY' },
      'USD',
      new Map(),
      null, // no exchange rates loaded yet
    );

    expect(result.currentValueHome).toBeNull();
    expect(result.totalReturn).toBeNull();
  });

  it('large return value computed correctly', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 100000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
    );

    expect(result.totalReturn).toBe(99000);
    expect(result.totalReturnPct).toBeCloseTo(9900, 1);
  });

  it('identity: asset + fx + expenses ≈ total (float tolerance)', () => {
    const historicalRates = buildHistoricalRates([
      ['2024-03-15', 'JPY', 'USD', 1 / 148.5],
    ]);

    const result = computeItemReturn(
      { purchase_price: 3500000, purchase_currency: 'JPY', purchase_date: '2024-03-15', current_value: 3200000, current_currency: 'JPY' },
      'USD',
      historicalRates,
      TODAY_RATES,
      { 'JPY': 150000 },
    );

    expect(result.canDecompose).toBe(true);
    const sum = result.assetReturn! + result.fxImpact! + result.expenseDrag!;
    expect(sum).toBeCloseTo(result.totalReturn!, 2);
  });

  it('multi-currency expenses all converted', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 15000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
      { 'USD': 200, 'JPY': 30000, 'EUR': 100 },
    );

    // Expenses: $200 + ¥30000/150=$200 + €100/0.92*1=$108.7 ≈ $508.7
    const expJpy = 30000 / 150;
    const expEur = 100 / 0.92;
    const totalExp = 200 + expJpy + expEur;
    expect(result.totalInvestedHome).toBeCloseTo(10000 + totalExp, 0);
    expect(result.expenseDrag).toBeCloseTo(-totalExp, 0);
  });
});

// =============================================================================
// computePortfolioTotals
// =============================================================================

describe('computePortfolioTotals', () => {
  it('sums across all items', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('a', {
      currentValueHome: 10000,
      totalInvestedHome: 8000,
      totalReturn: 2000,
      totalReturnPct: 25,
      canDecompose: true,
      assetReturn: 2500,
      fxImpact: -200,
      expenseDrag: -300,
    });
    map.set('b', {
      currentValueHome: 5000,
      totalInvestedHome: 6000,
      totalReturn: -1000,
      totalReturnPct: -16.67,
      canDecompose: true,
      assetReturn: -500,
      fxImpact: -400,
      expenseDrag: -100,
    });

    const totals = computePortfolioTotals(map);

    expect(totals.totalValueHome).toBe(15000);
    expect(totals.totalInvestedHome).toBe(14000);
    expect(totals.totalReturn).toBe(1000);
    expect(totals.totalReturnPct).toBeCloseTo(7.14, 1);
    expect(totals.totalAssetReturn).toBe(2000);
    expect(totals.totalFxImpact).toBe(-600);
    expect(totals.totalExpenseDrag).toBe(-400);
    expect(totals.hasDecomposition).toBe(true);
    expect(totals.itemsWithData).toBe(2);
  });

  it('handles items without decomposition', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('a', {
      currentValueHome: 10000,
      totalInvestedHome: 8000,
      totalReturn: 2000,
      totalReturnPct: 25,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
    });

    const totals = computePortfolioTotals(map);
    expect(totals.hasDecomposition).toBe(false);
    expect(totals.totalAssetReturn).toBe(0);
  });

  it('handles items with null returns', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('a', {
      currentValueHome: 10000,
      totalInvestedHome: null,
      totalReturn: null,
      totalReturnPct: null,
      canDecompose: false,
      assetReturn: null,
      fxImpact: null,
      expenseDrag: null,
    });

    const totals = computePortfolioTotals(map);
    expect(totals.itemsWithData).toBe(0);
    expect(totals.totalValueHome).toBe(10000);
    expect(totals.totalInvestedHome).toBe(0);
  });

  it('empty map returns zeros', () => {
    const totals = computePortfolioTotals(new Map());
    expect(totals.totalValueHome).toBe(0);
    expect(totals.totalReturn).toBe(0);
    expect(totals.itemsWithData).toBe(0);
  });
});
