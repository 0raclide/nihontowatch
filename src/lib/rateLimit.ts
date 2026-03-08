/**
 * Sliding-window rate limiter for API routes.
 *
 * Runs in middleware before auth — no network calls, just an in-memory Map.
 * Effective on Vercel single-region (iad1) where most requests hit the same isolate.
 */

// ── Types ──

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp (seconds) when the oldest request in window expires
}

// ── Route config ──

interface RouteLimit {
  prefix: string;
  limit: number;
}

// Sorted by prefix length descending so longest match wins
const ROUTE_LIMITS: RouteLimit[] = [
  { prefix: '/api/exchange-rates', limit: 10 },
  { prefix: '/api/search/',        limit: 20 },
  { prefix: '/api/artisan/',       limit: 30 },
  { prefix: '/api/artists/',       limit: 30 },
  { prefix: '/api/browse',         limit: 30 },
  { prefix: '/api/favorites',      limit: 30 },
  { prefix: '/api/listing/',       limit: 60 },
].sort((a, b) => b.prefix.length - a.prefix.length);

const DEFAULT_LIMIT = 60;
const WINDOW_MS = 60_000; // 60 seconds

// ── Storage ──

// key = `${ip}:${routeKey}`, value = sorted array of request timestamps (ms)
const store = new Map<string, number[]>();

// ── Cleanup ──

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, timestamps] of store) {
      // Remove expired timestamps
      const firstValid = timestamps.findIndex(t => t > cutoff);
      if (firstValid === -1) {
        store.delete(key);
      } else if (firstValid > 0) {
        timestamps.splice(0, firstValid);
      }
    }
  }, 60_000);
  // Don't prevent process from exiting
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ── Helpers (exported for testing) ──

export function _getStore() {
  return store;
}

export function _clearStore() {
  store.clear();
}

export function _stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// ── Route matching ──

export function getRouteLimit(pathname: string): number {
  for (const route of ROUTE_LIMITS) {
    if (pathname.startsWith(route.prefix)) {
      return route.limit;
    }
  }
  return DEFAULT_LIMIT;
}

// ── Main function ──

export function checkRateLimit(ip: string, pathname: string): RateLimitResult {
  startCleanup();

  const limit = getRouteLimit(pathname);

  // Build a route key from the matched prefix (or 'default')
  let routeKey = 'default';
  for (const route of ROUTE_LIMITS) {
    if (pathname.startsWith(route.prefix)) {
      routeKey = route.prefix;
      break;
    }
  }

  const key = `${ip}:${routeKey}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let timestamps = store.get(key);
  if (!timestamps) {
    timestamps = [];
    store.set(key, timestamps);
  }

  // Evict expired entries
  const firstValid = timestamps.findIndex(t => t > windowStart);
  if (firstValid === -1) {
    timestamps.length = 0;
  } else if (firstValid > 0) {
    timestamps.splice(0, firstValid);
  }

  const count = timestamps.length;

  if (count >= limit) {
    // Blocked — oldest timestamp determines when a slot opens
    const resetAt = Math.ceil((timestamps[0] + WINDOW_MS) / 1000);
    return { allowed: false, limit, remaining: 0, resetAt };
  }

  // Allow and record
  timestamps.push(now);
  const remaining = limit - timestamps.length;
  const resetAt = Math.ceil((timestamps[0] + WINDOW_MS) / 1000);

  return { allowed: true, limit, remaining, resetAt };
}
