/**
 * Shared percentile cache for dealer intelligence.
 *
 * Caches featured_score percentiles + sorted scores in memory,
 * refreshed hourly. Used by both the listings intelligence endpoint
 * and the collection item intelligence endpoint.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseServiceClient = any;

export interface ScoreData {
  p10: number;
  p25: number;
  p50: number;
  sortedScores: number[];
  totalCount: number;
}

let percentileCache: (ScoreData & { cachedAt: number }) | null = null;
const PERCENTILE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get featured score percentiles + sorted score array for position estimation.
 * Cached in module-level memory, refreshed hourly.
 */
export async function getScoreData(
  serviceClient: SupabaseServiceClient
): Promise<ScoreData> {
  if (percentileCache && Date.now() - percentileCache.cachedAt < PERCENTILE_TTL_MS) {
    return {
      p10: percentileCache.p10,
      p25: percentileCache.p25,
      p50: percentileCache.p50,
      sortedScores: percentileCache.sortedScores,
      totalCount: percentileCache.totalCount,
    };
  }

  // Fetch all available listing scores, sorted descending.
  // Supabase default limit is 1000 — must paginate to get all scores.
  const allScores: number[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: page, error: pageErr } = await (serviceClient.from('listings') as any)
      .select('featured_score')
      .eq('is_available', true)
      .not('featured_score', 'is', null)
      .gt('featured_score', 0)
      .order('featured_score', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (pageErr || !page || page.length === 0) {
      hasMore = false;
    } else {
      for (const r of page) {
        allScores.push(r.featured_score);
      }
      offset += PAGE_SIZE;
      if (page.length < PAGE_SIZE) hasMore = false;
    }
  }

  if (allScores.length === 0) {
    return { p10: 100, p25: 50, p50: 20, sortedScores: [], totalCount: 0 };
  }

  const scores = allScores;
  const p10 = scores[Math.floor(scores.length * 0.1)] ?? 100;
  const p25 = scores[Math.floor(scores.length * 0.25)] ?? 50;
  const p50 = scores[Math.floor(scores.length * 0.5)] ?? 20;

  percentileCache = { p10, p25, p50, sortedScores: scores, totalCount: scores.length, cachedAt: Date.now() };
  return { p10, p25, p50, sortedScores: scores, totalCount: scores.length };
}
