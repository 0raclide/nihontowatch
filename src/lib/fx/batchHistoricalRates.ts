/**
 * Batch historical FX rate fetcher.
 *
 * Collects unique (date, currency) pairs from a set of items,
 * deduplicates, fetches in parallel with concurrency control,
 * and returns a lookup map.
 */

// =============================================================================
// Types
// =============================================================================

/** Key format: "YYYY-MM-DD|FROM|TO" → rate */
export type FxRateMap = Map<string, number>;

export interface FxRateItem {
  purchase_date: string | null;
  purchase_currency: string | null;
}

type FetchFn = (date: string, from: string, to: string) => Promise<number | null>;

// =============================================================================
// Helpers
// =============================================================================

export function fxKey(date: string, from: string, to: string): string {
  return `${date}|${from.toUpperCase()}|${to.toUpperCase()}`;
}

// =============================================================================
// Main
// =============================================================================

/**
 * Fetch historical FX rates for a batch of items.
 *
 * - Skips items where purchase_currency === homeCurrency
 * - Skips items with no purchase_date
 * - Deduplicates: same date + currency = one fetch
 * - Fetches in parallel with concurrency limit of 5
 */
export async function fetchBatchHistoricalRates(
  items: FxRateItem[],
  homeCurrency: string,
  fetchFn: FetchFn,
): Promise<FxRateMap> {
  const home = homeCurrency.toUpperCase();
  const map: FxRateMap = new Map();

  // Collect unique (date, currency) pairs
  const seen = new Set<string>();
  const tasks: Array<{ date: string; from: string }> = [];

  for (const item of items) {
    if (!item.purchase_date || !item.purchase_currency) continue;
    const from = item.purchase_currency.toUpperCase();
    if (from === home) continue;

    const key = fxKey(item.purchase_date, from, home);
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push({ date: item.purchase_date, from });
  }

  if (tasks.length === 0) return map;

  // Concurrent execution with proper await of ALL tasks.
  // Previous implementation had a bug: promises spawned from `finally` callbacks
  // were pushed to the results array AFTER Promise.all had started iterating,
  // so trailing tasks (beyond the concurrency limit) were never awaited.
  const CONCURRENCY = 5;

  async function fetchWithRetry(date: string, from: string): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rate = await fetchFn(date, from, home);
        if (rate != null) {
          map.set(fxKey(date, from, home), rate);
          return;
        }
      } catch {
        // Retry once on failure
      }
    }
  }

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(t => fetchWithRetry(t.date, t.from)));
  }

  return map;
}
