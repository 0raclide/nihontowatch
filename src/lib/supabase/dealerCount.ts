import { createServiceClient } from './server';

/**
 * In-memory cache for active dealer count.
 * Revalidates every 60 minutes — dealer additions are rare events.
 */
let cachedCount: number | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get the number of active dealers from the database.
 * Uses a simple in-memory cache to avoid hitting Supabase on every SSR request.
 * Falls back to 40 if the query fails (safe lower bound).
 */
export async function getActiveDealerCount(): Promise<number> {
  const now = Date.now();
  if (cachedCount !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedCount;
  }

  try {
    const supabase = createServiceClient();
    const { count, error } = await supabase
      .from('dealers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) {
      console.error('[dealerCount] Query error:', error);
      return cachedCount ?? 40;
    }

    cachedCount = count ?? 40;
    cachedAt = now;
    return cachedCount;
  } catch (err) {
    console.error('[dealerCount] Unexpected error:', err);
    return cachedCount ?? 40;
  }
}
