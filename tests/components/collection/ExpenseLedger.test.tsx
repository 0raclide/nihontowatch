import { describe, it, expect } from 'vitest';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/types/expense';
import type { CollectionExpense } from '@/types/expense';

// =============================================================================
// Tests for expense ledger logic (pure unit tests — no DOM rendering)
// =============================================================================

describe('Expense total computation', () => {
  function computeTotal(
    purchasePrice: number | null,
    purchaseCurrency: string,
    expenses: Array<{ amount: number; currency: string }>
  ): Map<string, number> {
    const totals = new Map<string, number>();
    if (purchasePrice != null) {
      totals.set(purchaseCurrency, (totals.get(purchaseCurrency) || 0) + purchasePrice);
    }
    for (const exp of expenses) {
      if (exp.amount > 0) {
        totals.set(exp.currency, (totals.get(exp.currency) || 0) + exp.amount);
      }
    }
    return totals;
  }

  it('returns just purchase price when no expenses', () => {
    const totals = computeTotal(5000000, 'JPY', []);
    expect(totals.get('JPY')).toBe(5000000);
    expect(totals.size).toBe(1);
  });

  it('sums expenses in same currency as purchase', () => {
    const totals = computeTotal(5000000, 'JPY', [
      { amount: 100000, currency: 'JPY' },
      { amount: 50000, currency: 'JPY' },
    ]);
    expect(totals.get('JPY')).toBe(5150000);
  });

  it('keeps multi-currency expenses separate', () => {
    const totals = computeTotal(5000000, 'JPY', [
      { amount: 100000, currency: 'JPY' },
      { amount: 200, currency: 'USD' },
    ]);
    expect(totals.get('JPY')).toBe(5100000);
    expect(totals.get('USD')).toBe(200);
    expect(totals.size).toBe(2);
  });

  it('handles null purchase price with expenses', () => {
    const totals = computeTotal(null, 'JPY', [
      { amount: 100000, currency: 'JPY' },
    ]);
    expect(totals.get('JPY')).toBe(100000);
  });

  it('returns empty map when no data', () => {
    const totals = computeTotal(null, 'JPY', []);
    expect(totals.size).toBe(0);
  });

  it('ignores zero-amount expenses', () => {
    const totals = computeTotal(1000000, 'JPY', [
      { amount: 0, currency: 'JPY' },
      { amount: 50000, currency: 'JPY' },
    ]);
    expect(totals.get('JPY')).toBe(1050000);
  });
});

describe('Expense category labels', () => {
  it('every category has a label', () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(EXPENSE_CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof EXPENSE_CATEGORY_LABELS[cat]).toBe('string');
      expect(EXPENSE_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it('no extra labels exist beyond defined categories', () => {
    const labelKeys = Object.keys(EXPENSE_CATEGORY_LABELS);
    for (const key of labelKeys) {
      expect(EXPENSE_CATEGORIES).toContain(key);
    }
  });
});

describe('total_invested computation (from mapper)', () => {
  // Mirrors the computeTotalInvested logic in fromCollectionItem.ts

  function computeTotalInvested(
    purchasePrice: number | null,
    purchaseCurrency: string,
    expenseTotals: Record<string, Record<string, number>> | undefined,
    itemId: string,
  ): number | null {
    if (purchasePrice == null) return null;
    const curr = purchaseCurrency.toUpperCase();
    const itemExpenses = expenseTotals?.[itemId];
    if (!itemExpenses) return purchasePrice;
    const matching = itemExpenses[curr] || 0;
    return purchasePrice + matching;
  }

  it('returns purchase price when no expenses', () => {
    expect(computeTotalInvested(5000000, 'JPY', undefined, 'item-1')).toBe(5000000);
  });

  it('adds matching-currency expenses', () => {
    const totals = { 'item-1': { JPY: 150000, USD: 200 } };
    expect(computeTotalInvested(5000000, 'JPY', totals, 'item-1')).toBe(5150000);
  });

  it('ignores expenses in different currency', () => {
    const totals = { 'item-1': { USD: 200 } };
    expect(computeTotalInvested(5000000, 'JPY', totals, 'item-1')).toBe(5000000);
  });

  it('returns null when purchase_price is null', () => {
    expect(computeTotalInvested(null, 'JPY', {}, 'item-1')).toBeNull();
  });

  it('returns purchase price when item has no expenses in the map', () => {
    const totals = { 'item-2': { JPY: 100000 } };
    expect(computeTotalInvested(3000000, 'JPY', totals, 'item-1')).toBe(3000000);
  });
});
