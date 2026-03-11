import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EXPENSE_CATEGORIES } from '@/types/expense';
import {
  getExpenseTotals,
  countExpensesForItem,
} from '@/lib/supabase/collectionExpenses';

// =============================================================================
// Mock Supabase client builders
// =============================================================================

function mockClient(selectData: unknown[] | null, selectError: unknown = null) {
  return {
    from: () => ({
      select: (...args: unknown[]) => {
        const isCountQuery = args.length >= 2 && typeof args[1] === 'object' && (args[1] as Record<string, unknown>).count === 'exact';
        if (isCountQuery) {
          return {
            eq: () => Promise.resolve({ count: selectData?.length ?? 0, error: selectError }),
          };
        }
        return {
          eq: () => ({
            order: () => Promise.resolve({ data: selectData, error: selectError }),
          }),
          in: () => Promise.resolve({ data: selectData, error: selectError }),
        };
      },
      insert: (row: unknown) => ({
        select: () => ({
          single: () => Promise.resolve({
            data: { id: 'exp-1', ...row as object },
            error: null,
          }),
        }),
      }),
      update: (updates: unknown) => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: { id: 'exp-1', ...updates as object },
              error: null,
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  } as any;
}

// =============================================================================
// Tests
// =============================================================================

describe('EXPENSE_CATEGORIES', () => {
  it('has 15 categories', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(15);
  });

  it('includes all expected nihonto expense types', () => {
    expect(EXPENSE_CATEGORIES).toContain('polish');
    expect(EXPENSE_CATEGORIES).toContain('habaki');
    expect(EXPENSE_CATEGORIES).toContain('shirasaya');
    expect(EXPENSE_CATEGORIES).toContain('shinsa');
    expect(EXPENSE_CATEGORIES).toContain('shipping');
    expect(EXPENSE_CATEGORIES).toContain('insurance');
    expect(EXPENSE_CATEGORIES).toContain('other');
  });
});

describe('getExpenseTotals', () => {
  it('returns empty object for no items', async () => {
    const result = await getExpenseTotals(mockClient([]), []);
    expect(result).toEqual({});
  });

  it('groups totals by item_id and currency', async () => {
    const expenses = [
      { item_id: 'item-1', currency: 'JPY', amount: 50000 },
      { item_id: 'item-1', currency: 'JPY', amount: 30000 },
      { item_id: 'item-1', currency: 'USD', amount: 200 },
      { item_id: 'item-2', currency: 'JPY', amount: 100000 },
    ];
    const result = await getExpenseTotals(mockClient(expenses), ['item-1', 'item-2']);
    expect(result['item-1']['JPY']).toBe(80000);
    expect(result['item-1']['USD']).toBe(200);
    expect(result['item-2']['JPY']).toBe(100000);
  });

  it('returns empty object on DB error', async () => {
    const result = await getExpenseTotals(
      mockClient(null, { message: 'DB error' }),
      ['item-1']
    );
    expect(result).toEqual({});
  });
});

describe('countExpensesForItem', () => {
  it('returns count of expenses', async () => {
    const count = await countExpensesForItem(
      mockClient([{ id: '1' }, { id: '2' }, { id: '3' }]),
      'item-1'
    );
    expect(count).toBe(3);
  });

  it('returns 0 on error', async () => {
    const count = await countExpensesForItem(
      mockClient(null, { message: 'error' }),
      'item-1'
    );
    expect(count).toBe(0);
  });
});

describe('expense field validation', () => {
  // These test the validation logic that exists in the API routes.
  // We verify the constants and type shapes are correct.

  it('all expense categories are lowercase alphanumeric with underscores', () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(cat).toMatch(/^[a-z_]+$/);
    }
  });

  it('category set is a superset of common nihonto expenses', () => {
    const required = ['polish', 'habaki', 'shirasaya', 'koshirae', 'shinsa', 'shipping'];
    for (const cat of required) {
      expect(EXPENSE_CATEGORIES).toContain(cat);
    }
  });
});
