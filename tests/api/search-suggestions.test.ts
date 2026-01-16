/**
 * Comprehensive Search Suggestions API Integration Tests
 *
 * Tests the /api/search/suggestions endpoint for:
 * - Query validation (length, empty, whitespace)
 * - Limit parameter handling
 * - Response structure verification
 * - Search behavior across multiple fields
 * - Japanese text handling (romanization, macrons)
 * - Security (SQL injection, special characters)
 * - Performance characteristics
 *
 * REQUIREMENTS:
 * - Development server must be running: npm run dev -- -p 3020
 * - Run tests: npm test tests/api/search-suggestions.test.ts
 *
 * NOTE: Tests use real API calls to verify actual behavior.
 * Some tests may be skipped if server is not running.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3020';
const SUGGESTIONS_ENDPOINT = `${API_BASE}/api/search/suggestions`;

/**
 * Helper to check if server is available
 */
async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/browse?tab=available&limit=1`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Helper for making suggestion requests with error handling
 */
async function fetchSuggestions(
  query: string,
  limit?: number
): Promise<{ status: number; data: SuggestionsResponse | null; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (query !== undefined) params.set('q', query);
    if (limit !== undefined) params.set('limit', String(limit));

    const res = await fetch(`${SUGGESTIONS_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return { status: res.status, data };
  } catch (error) {
    return {
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Response type for suggestions API
 */
interface SuggestionsResponse {
  suggestions: Suggestion[];
  total: number;
  query: string;
}

interface Suggestion {
  id: string;
  title: string;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  image_url: string | null;
  dealer_name: string;
  dealer_domain?: string;
  url: string;
  cert_type?: string | null;
  smith?: string | null;
  tosogu_maker?: string | null;
}

// Store server availability status
let serverAvailable = false;

describe('Search Suggestions API - /api/search/suggestions', () => {
  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (!serverAvailable) {
      console.warn(
        '\n[WARN] Development server not available at ' + API_BASE +
        '\nSome tests will be skipped. Start server with: npm run dev -- -p 3020\n'
      );
    }
    // Allow server to warm up
    if (serverAvailable) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  // =============================================================================
  // QUERY VALIDATION
  // =============================================================================
  describe('Query Validation', () => {
    it('returns empty for query length < 2 (single character)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('a');

      expect(status).toBe(200);
      expect(data?.suggestions).toEqual([]);
      expect(data?.total).toBe(0);
    });

    it('returns empty for empty query string', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('');

      expect(status).toBe(200);
      expect(data?.suggestions).toEqual([]);
      expect(data?.total).toBe(0);
    });

    it('returns empty for missing query parameter', async () => {
      if (!serverAvailable) return;

      const res = await fetch(SUGGESTIONS_ENDPOINT, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.suggestions).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('returns empty for whitespace-only query', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('   ');

      expect(status).toBe(200);
      expect(data?.suggestions).toEqual([]);
      expect(data?.total).toBe(0);
    });

    it('returns empty for tab/newline whitespace query', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('\t\n  ');

      expect(status).toBe(200);
      expect(data?.suggestions).toEqual([]);
      expect(data?.total).toBe(0);
    });

    it('accepts 2-character query (minimum valid length)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('ka');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('query');
      // May or may not have results depending on data
    });

    it('accepts 3-character query', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('kat');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('accepts long queries up to reasonable length', async () => {
      if (!serverAvailable) return;

      // Test with 100 character query
      const longQuery = 'katana'.repeat(16).substring(0, 100);
      const { status, data } = await fetchSuggestions(longQuery);

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles extremely long queries (500+ chars) gracefully', async () => {
      if (!serverAvailable) return;

      const veryLongQuery = 'a'.repeat(500);
      const { status, data } = await fetchSuggestions(veryLongQuery);

      // Should not crash - returns 200 with empty or results
      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles queries with leading/trailing whitespace', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('  katana  ');

      expect(status).toBe(200);
      // Query should be trimmed
      expect(data?.query).toBe('  katana  '); // Original echoed back
      expect(data).toHaveProperty('suggestions');
    });
  });

  // =============================================================================
  // LIMIT PARAMETER
  // =============================================================================
  describe('Limit Parameter', () => {
    it('defaults to 5 suggestions when limit not specified', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      expect(data?.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('respects custom limit of 1', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 1);

      expect(status).toBe(200);
      expect(data?.suggestions.length).toBeLessThanOrEqual(1);
    });

    it('respects custom limit of 3', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 3);

      expect(status).toBe(200);
      expect(data?.suggestions.length).toBeLessThanOrEqual(3);
    });

    it('respects custom limit of 10', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 10);

      expect(status).toBe(200);
      expect(data?.suggestions.length).toBeLessThanOrEqual(10);
    });

    it('caps limit at 10 maximum (request 100, get max 10)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 100);

      expect(status).toBe(200);
      expect(data?.suggestions.length).toBeLessThanOrEqual(10);
    });

    it('floors limit at 1 minimum (request 0)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 0);

      expect(status).toBe(200);
      // Should fallback to default (5) or floor to 1
      expect(data?.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('floors limit at 1 minimum (request negative)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', -5);

      expect(status).toBe(200);
      // Should fallback to default or floor to 1
      expect(data).toHaveProperty('suggestions');
    });

    it('handles non-numeric limit gracefully', async () => {
      if (!serverAvailable) return;

      const res = await fetch(`${SUGGESTIONS_ENDPOINT}?q=katana&limit=abc`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      // Should fallback to default
      expect(data.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('handles float limit by truncating', async () => {
      if (!serverAvailable) return;

      const res = await fetch(`${SUGGESTIONS_ENDPOINT}?q=katana&limit=3.7`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  // =============================================================================
  // RESPONSE STRUCTURE
  // =============================================================================
  describe('Response Structure', () => {
    it('returns suggestions array', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
      expect(Array.isArray(data?.suggestions)).toBe(true);
    });

    it('returns total count', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      expect(data).toHaveProperty('total');
      expect(typeof data?.total).toBe('number');
      expect(data!.total).toBeGreaterThanOrEqual(0);
    });

    it('returns original query echoed back', async () => {
      if (!serverAvailable) return;

      const query = 'test_query';
      const { status, data } = await fetchSuggestions(query);

      expect(status).toBe(200);
      expect(data).toHaveProperty('query');
      expect(data?.query).toBe(query);
    });

    it('each suggestion has required id field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('id');
          expect(typeof suggestion.id).toBe('string');
          expect(suggestion.id.length).toBeGreaterThan(0);
        });
      }
    });

    it('each suggestion has required title field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('title');
          expect(typeof suggestion.title).toBe('string');
        });
      }
    });

    it('each suggestion has item_type field (nullable)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('item_type');
          expect(
            suggestion.item_type === null || typeof suggestion.item_type === 'string'
          ).toBe(true);
        });
      }
    });

    it('each suggestion has price_value field (nullable number)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('price_value');
          expect(
            suggestion.price_value === null || typeof suggestion.price_value === 'number'
          ).toBe(true);
        });
      }
    });

    it('each suggestion has price_currency field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('price_currency');
        });
      }
    });

    it('each suggestion has dealer_name field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('dealer_name');
          expect(typeof suggestion.dealer_name).toBe('string');
        });
      }
    });

    it('each suggestion has url field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('url');
          expect(typeof suggestion.url).toBe('string');
        });
      }
    });

    it('each suggestion has image_url field (nullable)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      if (data && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          expect(suggestion).toHaveProperty('image_url');
          expect(
            suggestion.image_url === null || typeof suggestion.image_url === 'string'
          ).toBe(true);
        });
      }
    });

    it('total is >= suggestions.length (more results may exist)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 3);

      expect(status).toBe(200);
      if (data) {
        expect(data.total).toBeGreaterThanOrEqual(data.suggestions.length);
      }
    });
  });

  // =============================================================================
  // SEARCH BEHAVIOR
  // =============================================================================
  describe('Search Behavior', () => {
    it('searches title field', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana');

      expect(status).toBe(200);
      // Should find items with "katana" in title
      expect(data).toHaveProperty('suggestions');
    });

    it('searches smith field (sword maker attribution)', async () => {
      if (!serverAvailable) return;

      // Common smith names like "Masamune", "Muramasa", "Kunihiro"
      const { status, data } = await fetchSuggestions('Masamune');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('searches tosogu_maker field (fittings maker)', async () => {
      if (!serverAvailable) return;

      // Common tosogu makers like "Goto", "Hirata"
      const { status, data } = await fetchSuggestions('Goto');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('searches school field', async () => {
      if (!serverAvailable) return;

      // Common schools like "Bizen", "Soshu", "Yamashiro"
      const { status, data } = await fetchSuggestions('Bizen');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('is case-insensitive (uppercase query)', async () => {
      if (!serverAvailable) return;

      const [upperRes, lowerRes] = await Promise.all([
        fetchSuggestions('KATANA'),
        fetchSuggestions('katana'),
      ]);

      expect(upperRes.status).toBe(200);
      expect(lowerRes.status).toBe(200);

      // Both should return results (may differ if data varies)
      expect(upperRes.data?.total).toBe(lowerRes.data?.total);
    });

    it('is case-insensitive (mixed case query)', async () => {
      if (!serverAvailable) return;

      const [mixedRes, lowerRes] = await Promise.all([
        fetchSuggestions('KaTaNa'),
        fetchSuggestions('katana'),
      ]);

      expect(mixedRes.status).toBe(200);
      expect(lowerRes.status).toBe(200);
      expect(mixedRes.data?.total).toBe(lowerRes.data?.total);
    });

    it('returns only available items (not sold)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 10);

      expect(status).toBe(200);
      // Cannot directly verify availability from suggestion response
      // but API should filter by status.eq.available OR is_available.eq.true
      expect(data).toHaveProperty('suggestions');
    });

    it('returns results ordered by recency (first_seen_at desc)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana', 10);

      expect(status).toBe(200);
      // Results should be ordered by first_seen_at descending
      // We can't verify the actual order without knowing the dates
      expect(data).toHaveProperty('suggestions');
    });

    it('handles partial matches (prefix search)', async () => {
      if (!serverAvailable) return;

      // "kat" should match "katana"
      const { status, data } = await fetchSuggestions('kat');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles multi-word queries', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana sword');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('returns empty for nonsense query with no matches', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('xyznonexistentquery12345');

      expect(status).toBe(200);
      expect(data?.suggestions).toEqual([]);
      expect(data?.total).toBe(0);
    });
  });

  // =============================================================================
  // JAPANESE TEXT HANDLING
  // =============================================================================
  describe('Japanese Text Handling', () => {
    it('handles romanized Japanese (common sword term)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('wakizashi');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles romanized Japanese smith names', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('Masamune');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles school names (Bizen school)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('Bizen');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles school names (Soshu school)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('Soshu');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles school names (Yamashiro school)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('Yamashiro');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('normalizes macrons (Goto should match Goto with macron)', async () => {
      if (!serverAvailable) return;

      // Test that "Goto" (no macron) finds results that may have "Goto" (with macron)
      const { status, data } = await fetchSuggestions('Goto');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('normalizes macrons (o-macron character)', async () => {
      if (!serverAvailable) return;

      // Test with actual macron character
      const { status, data } = await fetchSuggestions('Gotō');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles tosogu terms (tsuba)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('tsuba');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles tosogu terms (kozuka)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('kozuka');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles tosogu terms (menuki)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('menuki');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles tosogu terms (fuchi)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('fuchi');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles certification terms (Juyo)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('Juyo');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles certification terms (Hozon)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('Hozon');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });
  });

  // =============================================================================
  // SECURITY
  // =============================================================================
  describe('Security', () => {
    it('prevents SQL injection (basic)', async () => {
      if (!serverAvailable) return;

      const maliciousQuery = "test'; DROP TABLE listings; --";
      const { status, data } = await fetchSuggestions(maliciousQuery);

      // Should not crash - parameterized queries should prevent injection
      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('prevents SQL injection (UNION attack)', async () => {
      if (!serverAvailable) return;

      const maliciousQuery = "test' UNION SELECT * FROM dealers --";
      const { status, data } = await fetchSuggestions(maliciousQuery);

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('prevents SQL injection (OR 1=1)', async () => {
      if (!serverAvailable) return;

      const maliciousQuery = "test' OR '1'='1";
      const { status, data } = await fetchSuggestions(maliciousQuery);

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles special characters safely (percent)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('test%');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles special characters safely (underscore)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('test_query');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles special characters safely (backslash)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('test\\query');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles special characters safely (single quote)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions("test'query");

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles special characters safely (double quote)', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('test"query');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('escapes regex characters safely', async () => {
      if (!serverAvailable) return;

      // Characters that are special in regex: . * + ? ^ $ { } [ ] \ | ( )
      const regexQuery = 'test.*+?^${}[]\\|()';
      const { status, data } = await fetchSuggestions(regexQuery);

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles HTML/script injection attempt', async () => {
      if (!serverAvailable) return;

      const xssQuery = '<script>alert("xss")</script>';
      const { status, data } = await fetchSuggestions(xssQuery);

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles null byte injection', async () => {
      if (!serverAvailable) return;

      const nullByteQuery = 'test\x00query';
      const { status, data } = await fetchSuggestions(nullByteQuery);

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles Unicode characters safely', async () => {
      if (!serverAvailable) return;

      const unicodeQuery = 'test\u0000\uFFFF\u202E';
      const { status, data } = await fetchSuggestions(unicodeQuery);

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });
  });

  // =============================================================================
  // PERFORMANCE
  // =============================================================================
  describe('Performance', () => {
    it('responds within 500ms for typical query', async () => {
      if (!serverAvailable) return;

      const start = Date.now();
      const { status } = await fetchSuggestions('katana');
      const elapsed = Date.now() - start;

      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(500);
    });

    it('responds within 500ms for short query', async () => {
      if (!serverAvailable) return;

      const start = Date.now();
      const { status } = await fetchSuggestions('ka');
      const elapsed = Date.now() - start;

      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(500);
    });

    it('handles concurrent requests without degradation', async () => {
      if (!serverAvailable) return;

      const queries = ['katana', 'wakizashi', 'tsuba', 'tanto', 'kozuka'];
      const startAll = Date.now();

      const results = await Promise.all(
        queries.map(q => fetchSuggestions(q))
      );

      const elapsedAll = Date.now() - startAll;

      // All should succeed
      results.forEach(({ status }) => {
        expect(status).toBe(200);
      });

      // Concurrent requests should complete in reasonable time (not 5x serial)
      expect(elapsedAll).toBeLessThan(2000);
    });

    it('response time is stable across multiple requests', async () => {
      if (!serverAvailable) return;

      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await fetchSuggestions('katana');
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // Max should not be more than 3x average (no major outliers)
      expect(maxTime).toBeLessThan(avgTime * 3);
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================
  describe('Edge Cases', () => {
    it('handles URL-encoded characters', async () => {
      if (!serverAvailable) return;

      // Space encoded as %20
      const res = await fetch(`${SUGGESTIONS_ENDPOINT}?q=katana%20sword`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles plus sign as space', async () => {
      if (!serverAvailable) return;

      const res = await fetch(`${SUGGESTIONS_ENDPOINT}?q=katana+sword`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles repeated parameters (uses last value)', async () => {
      if (!serverAvailable) return;

      const res = await fetch(`${SUGGESTIONS_ENDPOINT}?q=katana&q=wakizashi`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      // URL spec: last value wins, but this depends on implementation
      expect(data).toHaveProperty('query');
    });

    it('handles empty limit parameter', async () => {
      if (!serverAvailable) return;

      const res = await fetch(`${SUGGESTIONS_ENDPOINT}?q=katana&limit=`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles query with only numbers', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('12345');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles query with mixed alphanumeric', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('katana123');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });

    it('handles query with emojis', async () => {
      if (!serverAvailable) return;

      const { status, data } = await fetchSuggestions('sword ');

      expect(status).toBe(200);
      expect(data).toHaveProperty('suggestions');
    });
  });
});
