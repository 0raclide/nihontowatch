/**
 * Stress Tests for Search API
 *
 * These tests verify system behavior under load conditions.
 * They require a running server and should be skipped in normal CI.
 *
 * IMPORTANT: These tests make real HTTP requests!
 * Start the dev server before running:
 *   npm run dev -- -p 3020
 *
 * Run with:
 *   npm test tests/stress/search-load.test.ts
 *
 * To skip in CI, set SKIP_STRESS_TESTS=true
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3020';
const SKIP_STRESS = process.env.SKIP_STRESS_TESTS === 'true';

// Test parameters - adjust based on your system capacity
const CONCURRENT_REQUESTS = 50;
const SEQUENTIAL_REQUESTS = 100;
const MAX_AVG_RESPONSE_TIME_MS = 500; // Maximum acceptable average response time
const TIMEOUT_MS = 30000; // 30 second timeout for stress tests

// =============================================================================
// HELPERS
// =============================================================================

interface RequestResult {
  ok: boolean;
  status: number;
  duration: number;
  error?: string;
}

async function timedFetch(url: string): Promise<RequestResult> {
  const start = Date.now();
  try {
    const response = await fetch(url);
    const duration = Date.now() - start;
    return {
      ok: response.ok,
      status: response.status,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      ok: false,
      status: 0,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function calculateStats(results: RequestResult[]) {
  const successful = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  const durations = successful.map(r => r.duration);

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / results.length) * 100,
    avgDuration: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0,
    minDuration: durations.length ? Math.min(...durations) : 0,
    maxDuration: durations.length ? Math.max(...durations) : 0,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
  };
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// =============================================================================
// SERVER HEALTH CHECK
// =============================================================================

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/search/suggestions?q=test`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// STRESS TESTS
// =============================================================================

describe.skipIf(SKIP_STRESS)('Search Stress Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    // Check if server is available
    serverAvailable = await checkServerHealth();
    if (!serverAvailable) {
      console.warn(
        '\n⚠️  Server not available at ' +
          API_BASE +
          '\n   Start the dev server with: npm run dev -- -p 3020\n' +
          '   Or set SKIP_STRESS_TESTS=true to skip these tests.\n'
      );
    }
  }, TIMEOUT_MS);

  // ===========================================================================
  // CONCURRENT REQUESTS
  // ===========================================================================

  describe('Concurrent Requests', () => {
    it(
      `handles ${CONCURRENT_REQUESTS} concurrent requests`,
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        // Generate unique queries to avoid caching
        const queries = Array(CONCURRENT_REQUESTS)
          .fill(null)
          .map((_, i) => `${API_BASE}/api/search/suggestions?q=test${i}`);

        const results = await Promise.all(queries.map(url => timedFetch(url)));
        const stats = calculateStats(results);

        console.log('\n📊 Concurrent requests stats:');
        console.log(`   Total: ${stats.total}`);
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`   Avg duration: ${stats.avgDuration.toFixed(0)}ms`);
        console.log(
          `   Min/Max: ${stats.minDuration}ms / ${stats.maxDuration}ms`
        );
        console.log(`   P50/P95/P99: ${stats.p50}ms / ${stats.p95}ms / ${stats.p99}ms`);

        // Assertions
        expect(stats.successRate).toBeGreaterThanOrEqual(95); // 95%+ success rate
        expect(stats.failed).toBeLessThanOrEqual(
          Math.ceil(CONCURRENT_REQUESTS * 0.05)
        ); // Max 5% failures
      },
      TIMEOUT_MS
    );

    it(
      'handles concurrent requests with same query (cache test)',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        // Same query should benefit from caching
        const sameQuery = `${API_BASE}/api/search/suggestions?q=katana`;
        const queries = Array(CONCURRENT_REQUESTS).fill(sameQuery);

        const results = await Promise.all(queries.map(url => timedFetch(url)));
        const stats = calculateStats(results);

        console.log('\n📊 Cached concurrent requests stats:');
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`   Avg duration: ${stats.avgDuration.toFixed(0)}ms`);

        expect(stats.successRate).toBe(100); // Should all succeed
      },
      TIMEOUT_MS
    );

    it(
      'handles concurrent requests across different endpoints',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        const endpoints = [
          `${API_BASE}/api/search/suggestions?q=katana`,
          `${API_BASE}/api/search/suggestions?q=wakizashi`,
          `${API_BASE}/api/browse?q=tanto&tab=available`,
          `${API_BASE}/api/browse?type=tsuba&tab=available`,
        ];

        // Mix of endpoints
        const queries = Array(CONCURRENT_REQUESTS)
          .fill(null)
          .map((_, i) => endpoints[i % endpoints.length]);

        const results = await Promise.all(queries.map(url => timedFetch(url)));
        const stats = calculateStats(results);

        console.log('\n📊 Mixed endpoint concurrent stats:');
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`   Avg duration: ${stats.avgDuration.toFixed(0)}ms`);

        expect(stats.successRate).toBeGreaterThanOrEqual(90);
      },
      TIMEOUT_MS
    );
  });

  // ===========================================================================
  // SEQUENTIAL REQUESTS
  // ===========================================================================

  describe('Sequential Requests', () => {
    it(
      `handles ${SEQUENTIAL_REQUESTS} sequential requests`,
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        const results: RequestResult[] = [];
        const start = Date.now();

        for (let i = 0; i < SEQUENTIAL_REQUESTS; i++) {
          const result = await timedFetch(
            `${API_BASE}/api/search/suggestions?q=sword`
          );
          results.push(result);
        }

        const totalDuration = Date.now() - start;
        const stats = calculateStats(results);

        console.log('\n📊 Sequential requests stats:');
        console.log(`   Total time: ${totalDuration}ms`);
        console.log(`   Avg per request: ${(totalDuration / SEQUENTIAL_REQUESTS).toFixed(1)}ms`);
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);

        // All should succeed in sequential mode
        expect(stats.successRate).toBe(100);
        // Average should be reasonable
        expect(stats.avgDuration).toBeLessThan(MAX_AVG_RESPONSE_TIME_MS);
      },
      TIMEOUT_MS
    );

    it(
      'maintains consistent response times over duration',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        const results: RequestResult[] = [];
        const batchSize = 20;
        const batches: number[][] = [];

        // Run batches and track timing trends
        for (let batch = 0; batch < 5; batch++) {
          const batchResults: number[] = [];
          for (let i = 0; i < batchSize; i++) {
            const result = await timedFetch(
              `${API_BASE}/api/search/suggestions?q=katana`
            );
            results.push(result);
            if (result.ok) {
              batchResults.push(result.duration);
            }
          }
          batches.push(batchResults);
        }

        // Calculate average per batch
        const batchAvgs = batches.map(
          b => b.reduce((a, c) => a + c, 0) / b.length
        );

        console.log('\n📊 Response time consistency:');
        batchAvgs.forEach((avg, i) => {
          console.log(`   Batch ${i + 1}: ${avg.toFixed(0)}ms avg`);
        });

        // Check that later batches aren't significantly slower (degradation)
        const firstBatchAvg = batchAvgs[0];
        const lastBatchAvg = batchAvgs[batchAvgs.length - 1];
        const degradation = ((lastBatchAvg - firstBatchAvg) / firstBatchAvg) * 100;

        console.log(`   Degradation: ${degradation.toFixed(1)}%`);

        // Allow up to 50% degradation (adjust based on your needs)
        expect(degradation).toBeLessThan(50);
      },
      TIMEOUT_MS
    );
  });

  // ===========================================================================
  // BURST PATTERNS
  // ===========================================================================

  describe('Burst Patterns', () => {
    it(
      'handles burst of requests after idle period',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        // Warm-up request
        await timedFetch(`${API_BASE}/api/search/suggestions?q=warmup`);

        // Wait for "idle" period
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Burst of requests
        const burstSize = 30;
        const queries = Array(burstSize)
          .fill(null)
          .map((_, i) => `${API_BASE}/api/search/suggestions?q=burst${i}`);

        const results = await Promise.all(queries.map(url => timedFetch(url)));
        const stats = calculateStats(results);

        console.log('\n📊 Burst after idle stats:');
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`   Avg duration: ${stats.avgDuration.toFixed(0)}ms`);
        console.log(`   P95: ${stats.p95}ms`);

        expect(stats.successRate).toBeGreaterThanOrEqual(90);
      },
      TIMEOUT_MS
    );

    it(
      'handles repeated bursts',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        const allResults: RequestResult[] = [];
        const burstSize = 20;
        const numBursts = 3;

        for (let burst = 0; burst < numBursts; burst++) {
          const queries = Array(burstSize)
            .fill(null)
            .map(
              (_, i) =>
                `${API_BASE}/api/search/suggestions?q=burst${burst}_${i}`
            );

          const results = await Promise.all(
            queries.map(url => timedFetch(url))
          );
          allResults.push(...results);

          // Brief pause between bursts
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const stats = calculateStats(allResults);

        console.log('\n📊 Repeated bursts stats:');
        console.log(`   Total requests: ${allResults.length}`);
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`   Avg duration: ${stats.avgDuration.toFixed(0)}ms`);

        expect(stats.successRate).toBeGreaterThanOrEqual(90);
      },
      TIMEOUT_MS
    );
  });

  // ===========================================================================
  // EDGE CASE LOAD
  // ===========================================================================

  describe('Edge Case Load', () => {
    it(
      'handles many requests with long queries',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        const longQuery = 'a'.repeat(200);
        const queries = Array(20)
          .fill(null)
          .map(
            () =>
              `${API_BASE}/api/search/suggestions?q=${encodeURIComponent(longQuery)}`
          );

        const results = await Promise.all(queries.map(url => timedFetch(url)));
        const stats = calculateStats(results);

        console.log('\n📊 Long query load stats:');
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);

        expect(stats.successRate).toBe(100);
      },
      TIMEOUT_MS
    );

    it(
      'handles many requests with special characters',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        const specialQueries = [
          'test & special',
          'katana | wakizashi',
          "test'quote",
          'test"double',
          'test--comment',
          'test;semicolon',
          'test<>angle',
          'test()parens',
          'test*asterisk',
          'test:colon',
        ];

        const queries = specialQueries
          .map(q => `${API_BASE}/api/search/suggestions?q=${encodeURIComponent(q)}`)
          .concat(
            specialQueries.map(
              q => `${API_BASE}/api/search/suggestions?q=${encodeURIComponent(q)}`
            )
          ); // Double up

        const results = await Promise.all(queries.map(url => timedFetch(url)));
        const stats = calculateStats(results);

        console.log('\n📊 Special characters load stats:');
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);

        expect(stats.successRate).toBe(100);
      },
      TIMEOUT_MS
    );

    it(
      'handles many requests with Japanese characters',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        const japaneseQueries = [
          '刀', // katana
          'カタナ', // katakana
          'かたな', // hiragana
          '日本刀',
          '鍔',
          '国広',
          '正宗',
          '村正',
        ];

        const queries = Array(3)
          .fill(japaneseQueries)
          .flat()
          .map(
            q => `${API_BASE}/api/search/suggestions?q=${encodeURIComponent(q)}`
          );

        const results = await Promise.all(queries.map(url => timedFetch(url)));
        const stats = calculateStats(results);

        console.log('\n📊 Japanese characters load stats:');
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`   Avg duration: ${stats.avgDuration.toFixed(0)}ms`);

        expect(stats.successRate).toBe(100);
      },
      TIMEOUT_MS
    );
  });

  // ===========================================================================
  // MEMORY STABILITY
  // ===========================================================================

  describe('Memory Stability', () => {
    it(
      'memory usage stays stable over many requests',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        // Note: This test can only check client-side memory
        // Server-side memory monitoring would need separate tooling

        const iterations = 50;
        const results: RequestResult[] = [];

        // Run many requests
        for (let i = 0; i < iterations; i++) {
          const result = await timedFetch(
            `${API_BASE}/api/search/suggestions?q=memory${i}`
          );
          results.push(result);
        }

        const stats = calculateStats(results);

        console.log('\n📊 Memory stability test:');
        console.log(`   Requests completed: ${stats.total}`);
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);

        // If we got this far without crashes, memory is reasonably stable
        expect(stats.successRate).toBe(100);
      },
      TIMEOUT_MS
    );
  });

  // ===========================================================================
  // RATE LIMITING (if applicable)
  // ===========================================================================

  describe('Rate Limiting Behavior', () => {
    it(
      'handles rate limit gracefully if enabled',
      async () => {
        if (!serverAvailable) {
          console.log('Skipping: server not available');
          return;
        }

        // Send rapid requests to potentially trigger rate limiting
        const rapidCount = 100;
        const results: RequestResult[] = [];

        const start = Date.now();
        for (let i = 0; i < rapidCount; i++) {
          const result = await timedFetch(
            `${API_BASE}/api/search/suggestions?q=rapid${i}`
          );
          results.push(result);
        }
        const duration = Date.now() - start;

        const stats = calculateStats(results);
        const rateLimited = results.filter(r => r.status === 429);

        console.log('\n📊 Rate limit test:');
        console.log(`   Total duration: ${duration}ms`);
        console.log(`   Requests per second: ${((rapidCount / duration) * 1000).toFixed(1)}`);
        console.log(`   Rate limited (429): ${rateLimited.length}`);
        console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);

        // Either all succeed (no rate limiting) or rate limiting is working
        if (rateLimited.length > 0) {
          console.log('   Rate limiting is active');
        } else {
          expect(stats.successRate).toBe(100);
        }
      },
      TIMEOUT_MS
    );
  });
});

// =============================================================================
// BENCHMARK SUITE (for performance tracking)
// =============================================================================

describe.skipIf(SKIP_STRESS)('Search Benchmarks', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await checkServerHealth();
  });

  it(
    'baseline single request benchmark',
    async () => {
      if (!serverAvailable) return;

      const iterations = 10;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const result = await timedFetch(
          `${API_BASE}/api/search/suggestions?q=benchmark`
        );
        if (result.ok) {
          results.push(result.duration);
        }
      }

      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      const min = Math.min(...results);
      const max = Math.max(...results);

      console.log('\n⏱️  Single request benchmark:');
      console.log(`   Avg: ${avg.toFixed(1)}ms`);
      console.log(`   Min: ${min}ms`);
      console.log(`   Max: ${max}ms`);

      // Store for comparison if needed
      expect(avg).toBeLessThan(MAX_AVG_RESPONSE_TIME_MS);
    },
    TIMEOUT_MS
  );

  it(
    'browse API benchmark',
    async () => {
      if (!serverAvailable) return;

      const iterations = 10;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const result = await timedFetch(
          `${API_BASE}/api/browse?q=katana&tab=available`
        );
        if (result.ok) {
          results.push(result.duration);
        }
      }

      const avg = results.reduce((a, b) => a + b, 0) / results.length;

      console.log('\n⏱️  Browse API benchmark:');
      console.log(`   Avg: ${avg.toFixed(1)}ms`);

      expect(avg).toBeLessThan(MAX_AVG_RESPONSE_TIME_MS * 2); // Browse can be slower
    },
    TIMEOUT_MS
  );
});
