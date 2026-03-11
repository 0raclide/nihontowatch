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

  // Inline semaphore for concurrency control
  const CONCURRENCY = 5;
  let running = 0;
  const queue = [...tasks];
  const results: Promise<void>[] = [];

  function next(): Promise<void> | null {
    const task = queue.shift();
    if (!task) return null;

    running++;
    const promise = fetchFn(task.date, task.from, home)
      .then(rate => {
        if (rate != null) {
          map.set(fxKey(task.date, task.from, home), rate);
        }
      })
      .catch(() => {
        // Partial failures don't block others
      })
      .finally(() => {
        running--;
        const n = next();
        if (n) results.push(n);
      });

    return promise;
  }

  // Kick off initial batch
  for (let i = 0; i < Math.min(CONCURRENCY, tasks.length); i++) {
    const p = next();
    if (p) results.push(p);
  }

  await Promise.all(results);
  return map;
}
