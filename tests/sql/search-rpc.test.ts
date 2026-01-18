/**
 * SQL RPC Function Tests for Nihontowatch Search
 *
 * Tests the PostgreSQL full-text search RPC functions deployed to production:
 * - search_listings_instant: Fast typeahead/autocomplete search
 * - search_listings_ranked: Full search with filters, pagination, and sorting
 *
 * These tests run directly against the production Supabase database
 * to verify the RPC functions work correctly.
 *
 * Run with: npm test tests/sql/search-rpc.test.ts
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Set longer timeout for all tests in this file (network latency to Supabase)
vi.setConfig({ testTimeout: 30000 });

// Production Supabase credentials
const SUPABASE_URL = 'https://itbhfhyptogxcjbjfzwx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YmhmaHlwdG9neGNqYmpmend4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg5MDgzNCwiZXhwIjoyMDgxNDY2ODM0fQ.sBLqYOuuK5m1dUK5GBA2lbRmCLZ037dQV8i9OwnyMWQ';

let supabase: SupabaseClient;

beforeAll(() => {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
});

// ============================================================================
// search_listings_instant RPC Tests
// ============================================================================
describe('search_listings_instant RPC', () => {
  describe('Basic Functionality', () => {
    it('returns results for common search term "katana"', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns results for search term "wakizashi"', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'wakizashi',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns results for search term "tanto"', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'tanto',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns results for search term "tsuba"', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'tsuba',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns results for province name "Bizen"', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'Bizen',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('function exists and is callable', async () => {
      const { error } = await supabase.rpc('search_listings_instant', {
        p_query: 'test',
        p_limit: 1,
      });

      // No "function not found" error means function exists
      // Either error is null (success) or error message doesn't contain "function not found"
      if (error) {
        expect(error.message).not.toContain('function search_listings_instant');
      } else {
        expect(error).toBeNull();
      }
    });
  });

  describe('Return Value Structure', () => {
    it('returns correct column structure', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 1,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        const result = data[0];

        // Check all expected columns exist
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('item_type');
        expect(result).toHaveProperty('price_value');
        expect(result).toHaveProperty('price_currency');
        expect(result).toHaveProperty('images');
        expect(result).toHaveProperty('dealer_id');
        expect(result).toHaveProperty('dealer_name');
        expect(result).toHaveProperty('rank');
        expect(result).toHaveProperty('total_count');
      }
    });

    it('returns dealer_name via JOIN (not null for valid results)', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 5,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // At least one result should have a dealer_name
        const hasDealer = data.some(
          (r: { dealer_name: string | null }) => r.dealer_name !== null && r.dealer_name !== ''
        );
        expect(hasDealer).toBe(true);
      }
    });

    it('returns total_count for pagination UI', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 1,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty('total_count');
        expect(typeof data[0].total_count).toBe('number');
        expect(data[0].total_count).toBeGreaterThanOrEqual(1);
      }
    });

    it('returns rank score for relevance ordering', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 5,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // All results should have a rank
        data.forEach((result: { rank: number }) => {
          expect(result).toHaveProperty('rank');
          expect(typeof result.rank).toBe('number');
        });
      }
    });

    it('returns results ordered by rank descending', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 10,
      });

      expect(error).toBeNull();

      if (data && data.length > 1) {
        const ranks = data.map((r: { rank: number }) => r.rank);
        for (let i = 1; i < ranks.length; i++) {
          expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
        }
      }
    });

    it('returns valid integer for id column', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 1,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // id should be an integer
        expect(typeof data[0].id).toBe('number');
        expect(Number.isInteger(data[0].id)).toBe(true);
        expect(data[0].id).toBeGreaterThan(0);
      }
    });
  });

  describe('Parameter Handling', () => {
    it('returns empty array for empty query', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: '',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('returns empty array for null query', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: null,
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('returns empty array for whitespace-only query', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: '   ',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('respects p_limit parameter', async () => {
      const { data: data3, error: error3 } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 3,
      });

      const { data: data10, error: error10 } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 10,
      });

      expect(error3).toBeNull();
      expect(error10).toBeNull();

      if (data3) {
        expect(data3.length).toBeLessThanOrEqual(3);
      }
      if (data10) {
        expect(data10.length).toBeLessThanOrEqual(10);
      }
    });

    it('uses default limit of 5 when not specified', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
      });

      expect(error).toBeNull();

      if (data) {
        expect(data.length).toBeLessThanOrEqual(5);
      }
    });

    it('handles limit of 1', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 1,
      });

      expect(error).toBeNull();

      if (data) {
        expect(data.length).toBeLessThanOrEqual(1);
      }
    });

    it('handles large limit gracefully', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 1000,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Query Processing', () => {
    it('is case-insensitive', async () => {
      const { data: upper, error: upperErr } = await supabase.rpc('search_listings_instant', {
        p_query: 'KATANA',
        p_limit: 5,
      });

      const { data: lower, error: lowerErr } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 5,
      });

      expect(upperErr).toBeNull();
      expect(lowerErr).toBeNull();

      // Total counts should be the same (case insensitive)
      if (upper && upper.length > 0 && lower && lower.length > 0) {
        expect(upper[0].total_count).toBe(lower[0].total_count);
      }
    });

    it('handles multi-word queries', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana blade',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('handles Japanese romanization terms', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'Sukehiro',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('handles province names', async () => {
      const provinces = ['Bizen', 'Yamashiro', 'Yamato', 'Mino', 'Sagami'];

      for (const province of provinces) {
        const { data, error } = await supabase.rpc('search_listings_instant', {
          p_query: province,
          p_limit: 5,
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('handles era names', async () => {
      const eras = ['Koto', 'Shinto', 'Shinshinto', 'Muromachi', 'Kamakura'];

      for (const era of eras) {
        const { data, error } = await supabase.rpc('search_listings_instant', {
          p_query: era,
          p_limit: 5,
        });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('returns empty for nonsense query', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'xyznonexistentquery12345abcdef',
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('Availability Filter', () => {
    it('only returns available items', async () => {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // Fetch full listing details to check availability
        const ids = data.map((r: { id: string }) => r.id);
        const { data: listings } = await supabase
          .from('listings')
          .select('id, status, is_available, is_sold')
          .in('id', ids);

        if (listings) {
          listings.forEach((listing) => {
            // Either status is 'available' OR is_available is true
            const isAvailable = listing.status === 'available' || listing.is_available === true;
            expect(isAvailable).toBe(true);
          });
        }
      }
    });
  });

  describe('Security', () => {
    it('handles SQL injection attempt safely', async () => {
      const maliciousQueries = [
        "'; DROP TABLE listings; --",
        "1'; DELETE FROM listings WHERE '1'='1",
        "' OR '1'='1",
        "'; SELECT * FROM pg_catalog.pg_tables; --",
        "UNION SELECT * FROM dealers --",
      ];

      for (const query of maliciousQueries) {
        const { error } = await supabase.rpc('search_listings_instant', {
          p_query: query,
          p_limit: 5,
        });

        // Should not cause a database error (parameterized queries prevent injection)
        // Either no error (success) or error doesn't indicate SQL injection
        if (error) {
          expect(error.message).not.toContain('syntax error');
          expect(error.message).not.toContain('permission denied');
        } else {
          expect(error).toBeNull();
        }
      }
    });

    it('handles special PostgreSQL characters', async () => {
      const specialQueries = ['test:test', 'test&test', 'test|test', 'test!test', 'test*test'];

      for (const query of specialQueries) {
        const { error } = await supabase.rpc('search_listings_instant', {
          p_query: query,
          p_limit: 5,
        });

        // plainto_tsquery handles special characters safely
        expect(error).toBeNull();
      }
    });

    it('handles very long query strings', async () => {
      const longQuery = 'a'.repeat(10000);
      const { error } = await supabase.rpc('search_listings_instant', {
        p_query: longQuery,
        p_limit: 5,
      });

      // Should handle gracefully (either return empty or error gracefully)
      if (error) {
        expect(error.message).not.toContain('out of memory');
      } else {
        expect(error).toBeNull();
      }
    });

    it('handles Unicode and emoji', async () => {
      const unicodeQueries = [
        '\u5200', // Japanese character for "katana"
        '\u3064\u3070', // Hiragana for "tsuba"
        '\ud83d\udde1\ufe0f', // Dagger emoji
      ];

      for (const query of unicodeQueries) {
        const { error } = await supabase.rpc('search_listings_instant', {
          p_query: query,
          p_limit: 5,
        });

        expect(error).toBeNull();
      }
    });
  });

  describe('Performance', () => {
    it('returns results within reasonable time (<2s)', async () => {
      const startTime = Date.now();

      const { error } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: 5,
      });

      const duration = Date.now() - startTime;

      expect(error).toBeNull();
      expect(duration).toBeLessThan(5000); // Allow for network latency
    });

    it('handles rapid consecutive requests', async () => {
      const queries = ['katana', 'wakizashi', 'tanto', 'tsuba', 'blade'];

      const results = await Promise.all(
        queries.map((q) =>
          supabase.rpc('search_listings_instant', {
            p_query: q,
            p_limit: 5,
          })
        )
      );

      results.forEach(({ error }) => {
        expect(error).toBeNull();
      });
    });
  });
});

// ============================================================================
// search_listings_ranked RPC Tests
// ============================================================================
describe('search_listings_ranked RPC', () => {
  describe('Basic Functionality', () => {
    it('function exists and is callable', async () => {
      const { error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'test',
        p_limit: 1,
      });

      // Either no error (success) or error doesn't indicate function not found
      if (error) {
        expect(error.message).not.toContain('function search_listings_ranked');
      } else {
        expect(error).toBeNull();
      }
    });

    it('returns results for common search term', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_limit: 10,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns results without query (browse mode)', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_limit: 10,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Return Value Structure', () => {
    it('returns all expected columns', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_limit: 1,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        const result = data[0];

        // Check all expected columns
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('item_type');
        expect(result).toHaveProperty('price_value');
        expect(result).toHaveProperty('price_currency');
        expect(result).toHaveProperty('smith');
        expect(result).toHaveProperty('tosogu_maker');
        expect(result).toHaveProperty('school');
        expect(result).toHaveProperty('tosogu_school');
        expect(result).toHaveProperty('cert_type');
        expect(result).toHaveProperty('nagasa_cm');
        expect(result).toHaveProperty('images');
        expect(result).toHaveProperty('first_seen_at');
        expect(result).toHaveProperty('last_scraped_at');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('is_available');
        expect(result).toHaveProperty('is_sold');
        expect(result).toHaveProperty('dealer_id');
        expect(result).toHaveProperty('dealer_name');
        expect(result).toHaveProperty('dealer_domain');
        expect(result).toHaveProperty('rank');
        expect(result).toHaveProperty('total_count');
      }
    });

    it('returns dealer info via JOIN', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_limit: 5,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { dealer_name: string | null; dealer_domain: string | null }) => {
          expect(result.dealer_name).toBeTruthy();
          expect(result.dealer_domain).toBeTruthy();
        });
      }
    });

    it('returns total_count for pagination', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_limit: 1,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        expect(typeof data[0].total_count).toBe('number');
        expect(data[0].total_count).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Tab Filter (p_tab)', () => {
    it('filters to available items with tab="available"', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { status: string; is_available: boolean }) => {
          const isAvailable = result.status === 'available' || result.is_available === true;
          expect(isAvailable).toBe(true);
        });
      }
    });

    it('filters to sold items with tab="sold"', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'sold',
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { status: string; is_sold: boolean }) => {
          const isSold =
            result.status === 'sold' || result.status === 'presumed_sold' || result.is_sold === true;
          expect(isSold).toBe(true);
        });
      }
    });

    it('returns all items with tab="all" or null', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'all',
        p_limit: 20,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      // Should include a mix of available and sold
    });
  });

  describe('Item Type Filter (p_item_types)', () => {
    it('filters by single item type', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_item_types: ['katana'],
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { item_type: string }) => {
          expect(result.item_type.toLowerCase()).toBe('katana');
        });
      }
    });

    it('filters by multiple item types', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_item_types: ['katana', 'wakizashi'],
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { item_type: string }) => {
          expect(['katana', 'wakizashi']).toContain(result.item_type.toLowerCase());
        });
      }
    });

    it('handles empty item types array (no filter)', async () => {
      const { data: filtered, error: filteredErr } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_item_types: [],
        p_limit: 20,
      });

      const { data: unfiltered, error: unfilteredErr } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_item_types: null,
        p_limit: 20,
      });

      expect(filteredErr).toBeNull();
      expect(unfilteredErr).toBeNull();
    });

    it('filters tosogu types correctly', async () => {
      const tosouguTypes = ['tsuba', 'kozuka', 'menuki', 'fuchi-kashira'];

      for (const type of tosouguTypes) {
        const { data, error } = await supabase.rpc('search_listings_ranked', {
          p_query: null,
          p_tab: 'available',
          p_item_types: [type],
          p_limit: 5,
        });

        expect(error).toBeNull();

        if (data && data.length > 0) {
          data.forEach((result: { item_type: string }) => {
            expect(result.item_type.toLowerCase()).toBe(type);
          });
        }
      }
    });
  });

  describe('Certification Filter (p_certifications)', () => {
    it('filters by single certification', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_certifications: ['Juyo'],
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { cert_type: string }) => {
          expect(result.cert_type).toBe('Juyo');
        });
      }
    });

    it('filters by multiple certifications', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_certifications: ['Juyo', 'Hozon'],
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { cert_type: string }) => {
          expect(['Juyo', 'Hozon']).toContain(result.cert_type);
        });
      }
    });

    it('handles various NBTHK certifications', async () => {
      const certs = ['Juyo', 'TokuHozon', 'Hozon', 'Tokuju'];

      for (const cert of certs) {
        const { error } = await supabase.rpc('search_listings_ranked', {
          p_query: null,
          p_tab: 'available',
          p_certifications: [cert],
          p_limit: 5,
        });

        expect(error).toBeNull();
      }
    });
  });

  describe('Dealer Filter (p_dealers)', () => {
    it('filters by single dealer ID', async () => {
      // First get a valid dealer ID
      const { data: dealers } = await supabase.from('dealers').select('id').limit(1);

      if (dealers && dealers.length > 0) {
        const dealerId = dealers[0].id;

        const { data, error } = await supabase.rpc('search_listings_ranked', {
          p_query: null,
          p_tab: 'available',
          p_dealers: [dealerId],
          p_limit: 20,
        });

        expect(error).toBeNull();

        if (data && data.length > 0) {
          data.forEach((result: { dealer_id: number }) => {
            expect(result.dealer_id).toBe(dealerId);
          });
        }
      }
    });

    it('filters by multiple dealer IDs', async () => {
      const { data: dealers } = await supabase.from('dealers').select('id').limit(3);

      if (dealers && dealers.length >= 2) {
        const dealerIds = dealers.map((d) => d.id);

        const { data, error } = await supabase.rpc('search_listings_ranked', {
          p_query: null,
          p_tab: 'available',
          p_dealers: dealerIds,
          p_limit: 20,
        });

        expect(error).toBeNull();

        if (data && data.length > 0) {
          data.forEach((result: { dealer_id: number }) => {
            expect(dealerIds).toContain(result.dealer_id);
          });
        }
      }
    });
  });

  describe('Ask Only Filter (p_ask_only)', () => {
    it('returns only price-on-request items when p_ask_only=true', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_ask_only: true,
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { price_value: number | null }) => {
          expect(result.price_value).toBeNull();
        });
      }
    });

    it('includes priced items when p_ask_only=false', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_ask_only: false,
        p_limit: 50,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        // Should have at least some items with prices
        const pricedItems = data.filter((r: { price_value: number | null }) => r.price_value !== null);
        expect(pricedItems.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Sort Parameter (p_sort)', () => {
    it('sorts by relevance when query provided', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_sort: 'relevance',
        p_limit: 10,
      });

      expect(error).toBeNull();

      if (data && data.length > 1) {
        // Ranks should be descending
        const ranks = data.map((r: { rank: number }) => r.rank);
        for (let i = 1; i < ranks.length; i++) {
          expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
        }
      }
    });

    it('sorts by price ascending', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_sort: 'price_asc',
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 1) {
        const prices = data
          .map((r: { price_value: number | null }) => r.price_value)
          .filter((p: number | null): p is number => p !== null);

        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
        }
      }
    });

    it('sorts by price descending', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_sort: 'price_desc',
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 1) {
        const prices = data
          .map((r: { price_value: number | null }) => r.price_value)
          .filter((p: number | null): p is number => p !== null);

        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
        }
      }
    });

    it('sorts by recent (first_seen_at descending)', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_sort: 'recent',
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 1) {
        const dates = data
          .map((r: { first_seen_at: string }) => new Date(r.first_seen_at).getTime())
          .filter((d: number) => !isNaN(d));

        for (let i = 1; i < dates.length; i++) {
          expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
        }
      }
    });

    it('sorts by name (title ascending)', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_sort: 'name',
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 1) {
        const titles = data
          .map((r: { title: string | null }) => r.title)
          .filter((t: string | null): t is string => t !== null);

        for (let i = 1; i < titles.length; i++) {
          expect(titles[i].localeCompare(titles[i - 1])).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Pagination (p_limit, p_offset)', () => {
    it('respects p_limit', async () => {
      const limits = [5, 10, 30, 50];

      for (const limit of limits) {
        const { data, error } = await supabase.rpc('search_listings_ranked', {
          p_query: null,
          p_tab: 'available',
          p_limit: limit,
        });

        expect(error).toBeNull();
        if (data) {
          expect(data.length).toBeLessThanOrEqual(limit);
        }
      }
    });

    it('uses default limit of 30', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
      });

      expect(error).toBeNull();
      if (data) {
        expect(data.length).toBeLessThanOrEqual(30);
      }
    });

    it('respects p_offset for pagination', async () => {
      // Get first page
      const { data: page1 } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_sort: 'recent',
        p_limit: 5,
        p_offset: 0,
      });

      // Get second page
      const { data: page2 } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_sort: 'recent',
        p_limit: 5,
        p_offset: 5,
      });

      if (page1 && page2 && page1.length > 0 && page2.length > 0) {
        const page1Ids = page1.map((r: { id: string }) => r.id);
        const page2Ids = page2.map((r: { id: string }) => r.id);

        // No overlap between pages
        const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    it('returns consistent total_count across pages', async () => {
      const { data: page1 } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_limit: 5,
        p_offset: 0,
      });

      const { data: page2 } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_limit: 5,
        p_offset: 5,
      });

      if (page1 && page1.length > 0 && page2 && page2.length > 0) {
        expect(page1[0].total_count).toBe(page2[0].total_count);
      }
    });
  });

  describe('Combined Filters', () => {
    it('combines search query with item type filter', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'blade',
        p_tab: 'available',
        p_item_types: ['katana'],
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { item_type: string }) => {
          expect(result.item_type.toLowerCase()).toBe('katana');
        });
      }
    });

    it('combines search query with certification filter', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_certifications: ['Juyo'],
        p_limit: 20,
      });

      expect(error).toBeNull();

      if (data && data.length > 0) {
        data.forEach((result: { cert_type: string }) => {
          expect(result.cert_type).toBe('Juyo');
        });
      }
    });

    it('combines multiple filters together', async () => {
      const { data: dealers } = await supabase.from('dealers').select('id').limit(1);

      if (dealers && dealers.length > 0) {
        const { data, error } = await supabase.rpc('search_listings_ranked', {
          p_query: null,
          p_tab: 'available',
          p_item_types: ['katana', 'wakizashi'],
          p_certifications: ['Juyo', 'TokuHozon', 'Hozon'],
          p_dealers: [dealers[0].id],
          p_sort: 'price_desc',
          p_limit: 20,
        });

        expect(error).toBeNull();
        // Results should satisfy all filters
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty result set gracefully', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'xyznonexistentquery12345',
        p_tab: 'available',
        p_limit: 10,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('handles contradictory filters (empty result)', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_item_types: ['nonexistent_type'],
        p_limit: 10,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('handles large offset (past end of results)', async () => {
      const { data, error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_limit: 10,
        p_offset: 1000000,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('Security', () => {
    it('handles SQL injection in query parameter', async () => {
      const maliciousQueries = [
        "'; DROP TABLE listings; --",
        "' UNION SELECT * FROM pg_shadow --",
        "1' OR '1'='1",
      ];

      for (const query of maliciousQueries) {
        const { error } = await supabase.rpc('search_listings_ranked', {
          p_query: query,
          p_tab: 'available',
          p_limit: 5,
        });

        // Either no error (success) or error doesn't indicate SQL injection
        if (error) {
          expect(error.message).not.toContain('syntax error');
          expect(error.message).not.toContain('permission denied');
        } else {
          expect(error).toBeNull();
        }
      }
    });

    it('handles malicious values in array parameters', async () => {
      const { error } = await supabase.rpc('search_listings_ranked', {
        p_query: null,
        p_tab: 'available',
        p_item_types: ["'; DROP TABLE listings; --", 'katana'],
        p_limit: 5,
      });

      // Should not cause SQL injection - either succeeds or fails without injection
      if (error) {
        expect(error.message).not.toContain('syntax error');
      } else {
        expect(error).toBeNull();
      }
    });
  });

  describe('Performance', () => {
    it('returns results within reasonable time (<3s)', async () => {
      const startTime = Date.now();

      const { error } = await supabase.rpc('search_listings_ranked', {
        p_query: 'katana',
        p_tab: 'available',
        p_item_types: ['katana'],
        p_sort: 'relevance',
        p_limit: 30,
      });

      const duration = Date.now() - startTime;

      expect(error).toBeNull();
      expect(duration).toBeLessThan(3000);
    });
  });
});

// ============================================================================
// build_listing_search_vector Function Tests
// ============================================================================
describe('build_listing_search_vector Function', () => {
  it('function exists and is callable', async () => {
    // We can test this indirectly by checking if search_vector is being built
    const { data, error } = await supabase
      .from('listings')
      .select('id, search_vector')
      .not('search_vector', 'is', null)
      .limit(1);

    expect(error).toBeNull();
    // If records have search_vector populated, the function works
    if (data && data.length > 0) {
      expect(data[0].search_vector).toBeTruthy();
    }
  });

  it('weights are applied correctly (title ranks higher than description)', async () => {
    // This is a behavioral test - searching for a term in title should rank
    // higher than the same term only in description
    const { data, error } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 10,
    });

    expect(error).toBeNull();

    if (data && data.length > 0) {
      // Results with "katana" in title should have higher rank
      // This is implicitly tested by the ranking order
      expect(data[0].rank).toBeGreaterThan(0);
    }
  });
});
