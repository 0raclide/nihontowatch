import { describe, it, expect, vi } from 'vitest';
import { fetchBatchHistoricalRates, fxKey } from '@/lib/fx/batchHistoricalRates';
import type { FxRateItem } from '@/lib/fx/batchHistoricalRates';

describe('fxKey', () => {
  it('produces consistent key format', () => {
    expect(fxKey('2024-01-15', 'jpy', 'usd')).toBe('2024-01-15|JPY|USD');
    expect(fxKey('2024-01-15', 'JPY', 'USD')).toBe('2024-01-15|JPY|USD');
  });
});

describe('fetchBatchHistoricalRates', () => {
  it('deduplicates: 5 items same date/currency = 1 fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue(0.00667);

    const items: FxRateItem[] = Array.from({ length: 5 }, () => ({
      purchase_date: '2024-06-01',
      purchase_currency: 'JPY',
    }));

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('2024-06-01', 'JPY', 'USD');
    expect(map.get(fxKey('2024-06-01', 'JPY', 'USD'))).toBe(0.00667);
  });

  it('skips items with null purchase_date', async () => {
    const fetchFn = vi.fn().mockResolvedValue(0.5);

    const items: FxRateItem[] = [
      { purchase_date: null, purchase_currency: 'JPY' },
      { purchase_date: '2024-01-01', purchase_currency: 'JPY' },
    ];

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(map.size).toBe(1);
  });

  it('skips items where currency matches home', async () => {
    const fetchFn = vi.fn().mockResolvedValue(1);

    const items: FxRateItem[] = [
      { purchase_date: '2024-01-01', purchase_currency: 'USD' },
      { purchase_date: '2024-02-01', purchase_currency: 'USD' },
    ];

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });

  it('partial fetch failures do not block others', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async (date: string) => {
      callCount++;
      if (date === '2024-01-01') throw new Error('Network error');
      return 0.5;
    });

    const items: FxRateItem[] = [
      { purchase_date: '2024-01-01', purchase_currency: 'JPY' },
      { purchase_date: '2024-02-01', purchase_currency: 'EUR' },
    ];

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);

    expect(callCount).toBe(2);
    expect(map.has(fxKey('2024-01-01', 'JPY', 'USD'))).toBe(false);
    expect(map.get(fxKey('2024-02-01', 'EUR', 'USD'))).toBe(0.5);
  });

  it('empty items → empty map', async () => {
    const fetchFn = vi.fn();
    const map = await fetchBatchHistoricalRates([], 'USD', fetchFn);
    expect(map.size).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('handles null purchase_currency', async () => {
    const fetchFn = vi.fn().mockResolvedValue(0.5);

    const items: FxRateItem[] = [
      { purchase_date: '2024-01-01', purchase_currency: null },
    ];

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });

  it('handles null rate response gracefully', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);

    const items: FxRateItem[] = [
      { purchase_date: '2024-01-01', purchase_currency: 'JPY' },
    ];

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);
    expect(map.size).toBe(0);
  });

  it('handles multiple unique date/currency pairs', async () => {
    const fetchFn = vi.fn().mockImplementation(async (date: string, from: string) => {
      if (from === 'JPY') return 0.00667;
      if (from === 'EUR') return 1.08;
      return null;
    });

    const items: FxRateItem[] = [
      { purchase_date: '2024-01-01', purchase_currency: 'JPY' },
      { purchase_date: '2024-02-01', purchase_currency: 'EUR' },
      { purchase_date: '2024-01-01', purchase_currency: 'JPY' }, // duplicate
      { purchase_date: '2024-03-01', purchase_currency: 'JPY' },
    ];

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);

    // 3 unique pairs (dedup removes 1)
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(map.size).toBe(3);
    expect(map.get(fxKey('2024-01-01', 'JPY', 'USD'))).toBe(0.00667);
    expect(map.get(fxKey('2024-02-01', 'EUR', 'USD'))).toBe(1.08);
    expect(map.get(fxKey('2024-03-01', 'JPY', 'USD'))).toBe(0.00667);
  });

  it('case-insensitive currency comparison', async () => {
    const fetchFn = vi.fn().mockResolvedValue(0.5);

    const items: FxRateItem[] = [
      { purchase_date: '2024-01-01', purchase_currency: 'usd' }, // matches home (USD)
      { purchase_date: '2024-01-01', purchase_currency: 'jpy' },
    ];

    const map = await fetchBatchHistoricalRates(items, 'USD', fetchFn);
    // Only JPY item fetched (usd === USD, skipped)
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('2024-01-01', 'JPY', 'USD');
  });
});
