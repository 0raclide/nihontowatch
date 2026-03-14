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

  it('mixed currencies (JPY purchase, USD value) — decomposes via purchase currency rates', () => {
    // Bought ¥2M when JPY→USD = 1/110, now valued at $15,000 USD
    const historicalRates = buildHistoricalRates([
      ['2023-06-01', 'JPY', 'USD', 1 / 110],  // ¥110 = $1
    ]);

    const result = computeItemReturn(
      { purchase_price: 2000000, purchase_currency: 'JPY', purchase_date: '2023-06-01', current_value: 15000, current_currency: 'USD' },
      'USD',
      historicalRates,
      TODAY_RATES,
    );

    expect(result.currentValueHome).toBe(15000); // Already in USD
    expect(result.totalInvestedHome).toBeCloseTo(18181.82, 0); // ¥2M × 1/110
    expect(result.totalReturn).toBeCloseTo(-3181.82, 0);

    // Decomposition uses purchase currency (JPY) rates
    expect(result.canDecompose).toBe(true);
    // FX impact: ¥2M × (1/150 - 1/110) ≈ -$4,848 (yen weakened)
    expect(result.fxImpact).toBeCloseTo(2000000 * (1 / 150 - 1 / 110), 0);
    expect(result.fxImpact!).toBeLessThan(0); // Yen depreciation = negative FX impact
    expect(result.expenseDrag).toBeCloseTo(0);
    // Asset return = residual: totalReturn - fxImpact - expenses
    expect(result.assetReturn).toBeCloseTo(result.totalReturn! - result.fxImpact! - result.expenseDrag!, 2);
    // Identity holds
    expect(result.assetReturn! + result.fxImpact! + result.expenseDrag!).toBeCloseTo(result.totalReturn!, 2);
  });

  it('mixed currencies with expenses — expenses included in decomposition', () => {
    // Bought ¥50M when JPY→USD = 1/110, now valued at $1M USD, with ¥500K expenses
    const historicalRates = buildHistoricalRates([
      ['2021-05-05', 'JPY', 'USD', 1 / 110],
    ]);

    const result = computeItemReturn(
      { purchase_price: 50000000, purchase_currency: 'JPY', purchase_date: '2021-05-05', current_value: 1000000, current_currency: 'USD' },
      'USD',
      historicalRates,
      TODAY_RATES,
      { 'JPY': 500000 },
    );

    // Expenses: ¥500K / 150 ≈ $3,333
    const expensesHome = 500000 / 150;
    expect(result.totalInvestedHome).toBeCloseTo(50000000 / 110 + expensesHome, 0);
    expect(result.canDecompose).toBe(true);
    expect(result.expenseDrag).toBeCloseTo(-expensesHome, 0);
    expect(result.fxImpact).toBeCloseTo(50000000 * (1 / 150 - 1 / 110), 0);
    // Identity
    expect(result.assetReturn! + result.fxImpact! + result.expenseDrag!).toBeCloseTo(result.totalReturn!, 2);
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
// computeItemReturn — inflation
// =============================================================================

describe('computeItemReturn — inflation', () => {
  it('inflation fields are null when inflationFactor not provided (backwards compat)', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 12000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
    );

    expect(result.inflationImpact).toBeNull();
    expect(result.realReturn).toBeNull();
    expect(result.realReturnPct).toBeNull();
    expect(result.inflationAdjustedCost).toBeNull();
    // Nominal values unchanged
    expect(result.totalReturn).toBe(2000);
    expect(result.totalReturnPct).toBeCloseTo(20, 1);
  });

  it('computes inflation impact with known factor', () => {
    // $10K purchase, now $12K, 28% cumulative inflation (factor=1.28)
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 12000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
      undefined,
      1.28,
    );

    // inflationImpact = -10000 × (1.28 - 1) = -2800
    expect(result.inflationImpact).toBeCloseTo(-2800, 1);
    // inflationAdjustedCost = 10000 × 1.28 = 12800
    expect(result.inflationAdjustedCost).toBeCloseTo(12800, 1);
    // realReturn = 2000 + (-2800) = -800
    expect(result.realReturn).toBeCloseTo(-800, 1);
    // realReturnPct = -800 / 12800 × 100 = -6.25%
    expect(result.realReturnPct).toBeCloseTo(-6.25, 1);

    // Nominal values UNCHANGED
    expect(result.totalReturn).toBe(2000);
    expect(result.totalReturnPct).toBeCloseTo(20, 1);
  });

  it('4-component identity: asset + fx + inflation + expenses ≈ realReturn', () => {
    const historicalRates = buildHistoricalRates([
      ['2023-06-01', 'JPY', 'USD', 1 / 110],
    ]);

    const result = computeItemReturn(
      { purchase_price: 2000000, purchase_currency: 'JPY', purchase_date: '2023-06-01', current_value: 2500000, current_currency: 'JPY' },
      'USD',
      historicalRates,
      TODAY_RATES,
      { 'JPY': 100000 },
      1.15, // 15% inflation
    );

    expect(result.canDecompose).toBe(true);
    expect(result.realReturn).not.toBeNull();
    const sum = result.assetReturn! + result.fxImpact! + result.inflationImpact! + result.expenseDrag!;
    expect(sum).toBeCloseTo(result.realReturn!, 2);
  });

  it('nominal positive but real negative (inflation exceeds gain)', () => {
    // $40K → $45K (+12.5% nominal), but 20% inflation
    const result = computeItemReturn(
      { purchase_price: 40000, purchase_currency: 'USD', purchase_date: '2018-01-01', current_value: 45000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
      undefined,
      1.20, // 20% inflation
    );

    expect(result.totalReturn).toBe(5000); // Nominal gain
    expect(result.totalReturn!).toBeGreaterThan(0);

    expect(result.realReturn!).toBeLessThan(0); // Real loss
    // inflationImpact = -40000 × 0.20 = -8000
    // realReturn = 5000 + (-8000) = -3000
    expect(result.realReturn).toBeCloseTo(-3000, 1);
  });

  it('zero inflation (factor = 1.0) → zero impact', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 12000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
      undefined,
      1.0,
    );

    expect(result.inflationImpact).toBeCloseTo(0, 5);
    expect(result.realReturn).toBeCloseTo(result.totalReturn!, 5);
    expect(result.inflationAdjustedCost).toBeCloseTo(10000, 5);
  });

  it('deflation (factor < 1.0) → positive impact (real return > nominal)', () => {
    // JPY deflation scenario: factor = 0.97 (3% deflation)
    const result = computeItemReturn(
      { purchase_price: 1000000, purchase_currency: 'JPY', purchase_date: '2005-01-01', current_value: 1000000, current_currency: 'JPY' },
      'JPY',
      new Map(),
      TODAY_RATES,
      undefined,
      0.97,
    );

    // inflationImpact = -1000000 × (0.97 - 1) = -1000000 × (-0.03) = +30000
    expect(result.inflationImpact!).toBeGreaterThan(0);
    expect(result.totalReturn).toBe(0); // Nominal flat
    expect(result.realReturn!).toBeGreaterThan(0); // Real gain from deflation
    expect(result.realReturn).toBeCloseTo(30000, 1);
  });

  it('inflation with expenses — realReturn includes both drags', () => {
    const result = computeItemReturn(
      { purchase_price: 20000, purchase_currency: 'USD', purchase_date: '2020-01-01', current_value: 25000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
      { 'USD': 1000 },
      1.25, // 25% inflation
    );

    // Nominal: 25000 - 21000 = 4000
    expect(result.totalReturn).toBeCloseTo(4000, 1);
    // inflationImpact = -20000 × 0.25 = -5000
    expect(result.inflationImpact).toBeCloseTo(-5000, 1);
    // realReturn = 4000 + (-5000) = -1000
    expect(result.realReturn).toBeCloseTo(-1000, 1);
    // realReturnPct = -1000 / (25000 + 1000) × 100 (denom = adjCost + expenses)
    expect(result.realReturnPct).toBeCloseTo(-1000 / (25000 + 1000) * 100, 1);
  });

  it('null inflationFactor explicitly passed → fields are null', () => {
    const result = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 12000, current_currency: 'USD' },
      'USD',
      new Map(),
      TODAY_RATES,
      undefined,
      null,
    );

    expect(result.inflationImpact).toBeNull();
    expect(result.realReturn).toBeNull();
  });

  it('mixed currency with inflation — 4-component identity holds', () => {
    const historicalRates = buildHistoricalRates([
      ['2021-05-05', 'JPY', 'USD', 1 / 110],
    ]);

    const result = computeItemReturn(
      { purchase_price: 5000000, purchase_currency: 'JPY', purchase_date: '2021-05-05', current_value: 50000, current_currency: 'USD' },
      'USD',
      historicalRates,
      TODAY_RATES,
      { 'USD': 500 },
      1.18,
    );

    expect(result.canDecompose).toBe(true);
    expect(result.realReturn).not.toBeNull();
    const sum = result.assetReturn! + result.fxImpact! + result.inflationImpact! + result.expenseDrag!;
    expect(sum).toBeCloseTo(result.realReturn!, 2);
  });

  it('nominal return unchanged regardless of inflation factor', () => {
    const withoutInflation = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 15000, current_currency: 'USD' },
      'USD', new Map(), TODAY_RATES,
    );
    const withInflation = computeItemReturn(
      { purchase_price: 10000, purchase_currency: 'USD', purchase_date: '2023-01-01', current_value: 15000, current_currency: 'USD' },
      'USD', new Map(), TODAY_RATES,
      undefined, 1.30,
    );

    expect(withInflation.totalReturn).toBe(withoutInflation.totalReturn);
    expect(withInflation.totalReturnPct).toBe(withoutInflation.totalReturnPct);
    expect(withInflation.assetReturn).toBe(withoutInflation.assetReturn);
    expect(withInflation.fxImpact).toBe(withoutInflation.fxImpact);
    expect(withInflation.expenseDrag).toBe(withoutInflation.expenseDrag);
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
    expect(totals.hasInflation).toBe(false);
    expect(totals.totalInflationImpact).toBe(0);
  });

  it('aggregates inflation across items', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('a', {
      currentValueHome: 12000,
      totalInvestedHome: 10000,
      totalReturn: 2000,
      totalReturnPct: 20,
      canDecompose: true,
      assetReturn: 2000,
      fxImpact: 0,
      expenseDrag: 0,
      inflationImpact: -2800,
      realReturn: -800,
      realReturnPct: -6.25,
      inflationAdjustedCost: 12800,
    });
    map.set('b', {
      currentValueHome: 8000,
      totalInvestedHome: 5000,
      totalReturn: 3000,
      totalReturnPct: 60,
      canDecompose: true,
      assetReturn: 3000,
      fxImpact: 0,
      expenseDrag: 0,
      inflationImpact: -1000,
      realReturn: 2000,
      realReturnPct: 33.33,
      inflationAdjustedCost: 6000,
    });

    const totals = computePortfolioTotals(map);
    expect(totals.hasInflation).toBe(true);
    expect(totals.totalInflationImpact).toBe(-3800);
    expect(totals.totalRealReturn).toBe(5000 + (-3800)); // totalReturn + totalInflation
    expect(totals.totalRealReturnPct).not.toBeNull();
  });

  it('hasInflation false when no items have inflation data', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('a', {
      currentValueHome: 10000,
      totalInvestedHome: 8000,
      totalReturn: 2000,
      totalReturnPct: 25,
      canDecompose: true,
      assetReturn: 2000,
      fxImpact: 0,
      expenseDrag: 0,
      inflationImpact: null,
      realReturn: null,
      realReturnPct: null,
      inflationAdjustedCost: null,
    });

    const totals = computePortfolioTotals(map);
    expect(totals.hasInflation).toBe(false);
    expect(totals.totalInflationImpact).toBe(0);
    expect(totals.totalRealReturnPct).toBeNull();
  });

  it('mixed items — some with inflation, some without', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('withInflation', {
      currentValueHome: 15000,
      totalInvestedHome: 10000,
      totalReturn: 5000,
      totalReturnPct: 50,
      canDecompose: true,
      assetReturn: 5000,
      fxImpact: 0,
      expenseDrag: 0,
      inflationImpact: -2000,
      realReturn: 3000,
      realReturnPct: 25,
      inflationAdjustedCost: 12000,
    });
    map.set('withoutInflation', {
      currentValueHome: 8000,
      totalInvestedHome: 6000,
      totalReturn: 2000,
      totalReturnPct: 33.33,
      canDecompose: true,
      assetReturn: 2000,
      fxImpact: 0,
      expenseDrag: 0,
      inflationImpact: null,
      realReturn: null,
      realReturnPct: null,
      inflationAdjustedCost: null,
    });

    const totals = computePortfolioTotals(map);
    expect(totals.hasInflation).toBe(true);
    expect(totals.totalInflationImpact).toBe(-2000);
    // totalRealReturn = totalReturn + totalInflationImpact = 7000 + (-2000) = 5000
    expect(totals.totalRealReturn).toBe(7000 + (-2000));
  });
});

// =============================================================================
// computeItemReturn — holding status (realized/unrealized)
// =============================================================================

describe('computeItemReturn — holding status', () => {
  it('defaults to unrealized when no holding_status', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2024-01-15',
        current_value: 1500, current_currency: 'USD' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.isRealized).toBe(false);
  });

  it('marks as unrealized for owned items', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2024-01-15',
        current_value: 1500, current_currency: 'USD', holding_status: 'owned' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.isRealized).toBe(false);
  });

  it('marks as realized for sold items with sold_price', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2024-01-15',
        current_value: 1500, current_currency: 'USD',
        holding_status: 'sold', sold_price: 1800, sold_currency: 'USD', sold_date: '2025-06-01' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.isRealized).toBe(true);
  });

  it('uses sold_price as exit value for realized returns (same currency)', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2024-01-15',
        current_value: 1500, current_currency: 'USD',
        holding_status: 'sold', sold_price: 1800, sold_currency: 'USD', sold_date: '2025-06-01' },
      'USD', new Map(), TODAY_RATES,
    );
    // Exit value = sold_price (1800), not current_value (1500)
    expect(result.currentValueHome).toBe(1800);
    expect(result.totalReturn).toBe(800); // 1800 - 1000
    expect(result.totalReturnPct).toBeCloseTo(80.0, 1);
  });

  it('uses sold_date FX rate for cross-currency sold items', () => {
    // Bought in JPY, sold in JPY, home=USD
    // Purchase: 1M JPY on 2024-01-15 at rate 0.00667 → $6,670 cost basis
    // Sold: 1.5M JPY on 2025-06-01 at rate 0.00700 → $10,500 proceeds
    const historical = buildHistoricalRates([
      ['2024-01-15', 'JPY', 'USD', 0.00667],
      ['2025-06-01', 'JPY', 'USD', 0.00700],
    ]);
    const result = computeItemReturn(
      { purchase_price: 1000000, purchase_currency: 'JPY', purchase_date: '2024-01-15',
        current_value: 2000000, current_currency: 'JPY', // current_value ignored for sold
        holding_status: 'sold', sold_price: 1500000, sold_currency: 'JPY', sold_date: '2025-06-01' },
      'USD', historical, TODAY_RATES,
    );
    expect(result.isRealized).toBe(true);
    // Exit value at sold_date rate: 1,500,000 × 0.007 = $10,500
    expect(result.currentValueHome).toBeCloseTo(10500, 0);
    // Cost basis: 1,000,000 × 0.00667 = $6,670
    expect(result.totalInvestedHome).toBeCloseTo(6670, 0);
    expect(result.totalReturn).toBeCloseTo(3830, 0);
  });

  it('FX impact uses sold_date rate (not today rate) for sold items', () => {
    // Purchase: 1M JPY on 2024-01-15, rate JPY→USD = 0.00667
    // Sold: 1.5M JPY on 2025-06-01, rate JPY→USD = 0.00700
    // FX impact should use sold_date rate, not today's rate
    const historical = buildHistoricalRates([
      ['2024-01-15', 'JPY', 'USD', 0.00667],
      ['2025-06-01', 'JPY', 'USD', 0.00700],
    ]);
    const result = computeItemReturn(
      { purchase_price: 1000000, purchase_currency: 'JPY', purchase_date: '2024-01-15',
        current_value: 2000000, current_currency: 'JPY',
        holding_status: 'sold', sold_price: 1500000, sold_currency: 'JPY', sold_date: '2025-06-01' },
      'USD', historical, TODAY_RATES,
    );
    expect(result.canDecompose).toBe(true);
    // FX impact = P_buy × (R_sold_date - R_purchase) = 1M × (0.00700 - 0.00667) = $330
    expect(result.fxImpact).toBeCloseTo(330, 0);
    // Identity: asset + fx + expenses ≈ total
    if (result.assetReturn != null && result.fxImpact != null && result.expenseDrag != null && result.totalReturn != null) {
      expect(result.assetReturn + result.fxImpact + result.expenseDrag).toBeCloseTo(result.totalReturn, 1);
    }
  });

  it('returns NULL for sold items without sold_price', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2024-01-15',
        current_value: null, current_currency: null,
        holding_status: 'sold', sold_price: null, sold_currency: null },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.totalReturn).toBeNull();
  });

  it('falls back to current_value when holding_status is sold but no sold_price', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2024-01-15',
        current_value: 1500, current_currency: 'USD',
        holding_status: 'sold', sold_price: null, sold_currency: null },
      'USD', new Map(), TODAY_RATES,
    );
    // Not truly realized since no sold_price → falls back to unrealized path
    expect(result.isRealized).toBe(false);
    expect(result.currentValueHome).toBe(1500);
  });
});

// =============================================================================
// computeItemReturn — annualized return
// =============================================================================

describe('computeItemReturn — annualized return', () => {
  it('computes annualized return for owned items (holding period to today)', () => {
    // Purchase ~365 days ago with 10% total return → ~10% annualized
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const purchaseDate = oneYearAgo.toISOString().split('T')[0];

    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: purchaseDate,
        current_value: 1100, current_currency: 'USD' },
      'USD', new Map(), TODAY_RATES,
    );
    // Allow ±1 day tolerance for timezone edge cases
    expect(result.holdingDays).toBeGreaterThanOrEqual(364);
    expect(result.holdingDays).toBeLessThanOrEqual(366);
    // Annualized ~10% (varies slightly with exact holdingDays)
    expect(result.annualizedReturnPct).toBeCloseTo(10.0, -1);
  });

  it('computes annualized return for sold items (purchase → sold date)', () => {
    // Held exactly 730 days (2 years), +21% total → ~10% annualized
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2023-01-15',
        current_value: 1500, current_currency: 'USD',
        holding_status: 'sold', sold_price: 1210, sold_currency: 'USD', sold_date: '2025-01-14' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.holdingDays).toBeCloseTo(730, 1);
    // (1.21)^(365/730) - 1 = (1.21)^0.5 - 1 ≈ 10%
    expect(result.annualizedReturnPct).toBeCloseTo(10.0, 0);
  });

  it('returns null annualized for holding period < 30 days', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2026-03-01',
        current_value: 1100, current_currency: 'USD',
        holding_status: 'sold', sold_price: 1100, sold_currency: 'USD', sold_date: '2026-03-15' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.holdingDays).toBe(14);
    expect(result.annualizedReturnPct).toBeNull();
  });

  it('computes holdingDays between purchase and sold date', () => {
    const result = computeItemReturn(
      { purchase_price: 1000, purchase_currency: 'USD', purchase_date: '2024-01-01',
        current_value: 1500, current_currency: 'USD',
        holding_status: 'sold', sold_price: 1500, sold_currency: 'USD', sold_date: '2025-01-01' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.holdingDays).toBe(366); // 2024 is leap year
  });

  it('returns null holdingDays when no purchase_date', () => {
    const result = computeItemReturn(
      { purchase_price: null, purchase_currency: null, purchase_date: null,
        current_value: 1500, current_currency: 'USD' },
      'USD', new Map(), TODAY_RATES,
    );
    expect(result.holdingDays).toBeNull();
    expect(result.annualizedReturnPct).toBeNull();
  });
});

// =============================================================================
// computePortfolioTotals — unrealized/realized split
// =============================================================================

describe('computePortfolioTotals — unrealized/realized split', () => {
  it('splits items into unrealized and realized buckets', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('owned1', {
      currentValueHome: 2000, totalInvestedHome: 1500, totalReturn: 500,
      totalReturnPct: 33.3, canDecompose: false,
      assetReturn: null, fxImpact: null, expenseDrag: null,
      inflationImpact: null, realReturn: null, realReturnPct: null, inflationAdjustedCost: null,
      isRealized: false, annualizedReturnPct: null, holdingDays: 365,
    });
    map.set('sold1', {
      currentValueHome: 3000, totalInvestedHome: 2000, totalReturn: 1000,
      totalReturnPct: 50.0, canDecompose: false,
      assetReturn: null, fxImpact: null, expenseDrag: null,
      inflationImpact: null, realReturn: null, realReturnPct: null, inflationAdjustedCost: null,
      isRealized: true, annualizedReturnPct: 10.0, holdingDays: 730,
    });

    const totals = computePortfolioTotals(map);

    // Unrealized
    expect(totals.unrealized.itemCount).toBe(1);
    expect(totals.unrealized.totalValueHome).toBe(2000);
    expect(totals.unrealized.totalInvestedHome).toBe(1500);
    expect(totals.unrealized.totalReturn).toBe(500);
    expect(totals.unrealized.totalReturnPct).toBeCloseTo(33.3, 1);

    // Realized
    expect(totals.realized.itemCount).toBe(1);
    expect(totals.realized.totalValueHome).toBe(3000);
    expect(totals.realized.totalInvestedHome).toBe(2000);
    expect(totals.realized.totalReturn).toBe(1000);
    expect(totals.realized.totalReturnPct).toBeCloseTo(50.0, 1);

    // Combined
    expect(totals.totalValueHome).toBe(5000);
    expect(totals.totalInvestedHome).toBe(3500);
    expect(totals.itemsWithData).toBe(2);
  });

  it('returns zero counts for empty buckets', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('owned1', {
      currentValueHome: 2000, totalInvestedHome: 1500, totalReturn: 500,
      totalReturnPct: 33.3, canDecompose: false,
      assetReturn: null, fxImpact: null, expenseDrag: null,
      inflationImpact: null, realReturn: null, realReturnPct: null, inflationAdjustedCost: null,
      isRealized: false, annualizedReturnPct: null, holdingDays: 365,
    });

    const totals = computePortfolioTotals(map);
    expect(totals.unrealized.itemCount).toBe(1);
    expect(totals.realized.itemCount).toBe(0);
    expect(totals.realized.totalReturn).toBe(0);
    expect(totals.realized.totalReturnPct).toBeNull(); // 0/0
  });

  it('empty map has zero counts in both buckets', () => {
    const totals = computePortfolioTotals(new Map());
    expect(totals.unrealized.itemCount).toBe(0);
    expect(totals.realized.itemCount).toBe(0);
    expect(totals.unrealized.totalReturnPct).toBeNull();
    expect(totals.realized.totalReturnPct).toBeNull();
  });

  it('all sold items → unrealized bucket is empty', () => {
    const map = new Map<string, ItemReturnData>();
    map.set('sold1', {
      currentValueHome: 3000, totalInvestedHome: 2000, totalReturn: 1000,
      totalReturnPct: 50.0, canDecompose: false,
      assetReturn: null, fxImpact: null, expenseDrag: null,
      inflationImpact: null, realReturn: null, realReturnPct: null, inflationAdjustedCost: null,
      isRealized: true, annualizedReturnPct: 10.0, holdingDays: 730,
    });
    map.set('sold2', {
      currentValueHome: 5000, totalInvestedHome: 4000, totalReturn: 1000,
      totalReturnPct: 25.0, canDecompose: false,
      assetReturn: null, fxImpact: null, expenseDrag: null,
      inflationImpact: null, realReturn: null, realReturnPct: null, inflationAdjustedCost: null,
      isRealized: true, annualizedReturnPct: 8.0, holdingDays: 500,
    });

    const totals = computePortfolioTotals(map);
    expect(totals.unrealized.itemCount).toBe(0);
    expect(totals.realized.itemCount).toBe(2);
    expect(totals.realized.totalReturn).toBe(2000);
    expect(totals.realized.totalReturnPct).toBeCloseTo(33.3, 1); // 2000/6000
  });
});
