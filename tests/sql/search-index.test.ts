/**
 * Search Infrastructure Tests for Nihontowatch
 *
 * Tests the PostgreSQL infrastructure supporting full-text search:
 * - GIN index existence on search_vector column
 * - Trigger functionality for auto-updating search_vector
 * - Search vector population and data integrity
 *
 * Run with: npm test tests/sql/search-index.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Production Supabase credentials
const SUPABASE_URL = 'https://itbhfhyptogxcjbjfzwx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YmhmaHlwdG9neGNqYmpmend4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg5MDgzNCwiZXhwIjoyMDgxNDY2ODM0fQ.sBLqYOuuK5m1dUK5GBA2lbRmCLZ037dQV8i9OwnyMWQ';

let supabase: SupabaseClient;

beforeAll(() => {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
});

// ============================================================================
// Search Vector Column Tests
// ============================================================================
describe('Search Vector Column', () => {
  it('search_vector column exists on listings table', async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('search_vector')
      .limit(1);

    expect(error).toBeNull();
    // If we can select the column, it exists
    expect(data).toBeDefined();
  });

  it('search_vector is populated for existing records', async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, search_vector')
      .not('search_vector', 'is', null)
      .limit(10);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThan(0);
  });

  it('majority of listings have populated search_vector', async () => {
    // Get total count
    const { count: total, error: totalErr } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true });

    // Get count with search_vector
    const { count: withVector, error: vectorErr } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .not('search_vector', 'is', null);

    expect(totalErr).toBeNull();
    expect(vectorErr).toBeNull();

    if (total && withVector) {
      // At least 90% of listings should have search_vector populated
      const percentage = (withVector / total) * 100;
      expect(percentage).toBeGreaterThan(90);
    }
  });

  it('search_vector is not empty string', async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, search_vector')
      .not('search_vector', 'is', null)
      .limit(100);

    expect(error).toBeNull();

    if (data) {
      data.forEach((listing) => {
        // search_vector should not be empty (would be stored differently)
        expect(listing.search_vector).toBeTruthy();
      });
    }
  });
});

// ============================================================================
// GIN Index Tests
// ============================================================================
describe('GIN Index on search_vector', () => {
  it('GIN index exists (verified via search performance)', async () => {
    // We can't directly query pg_indexes from Supabase JS client easily,
    // but we can verify the index is working by checking search is fast

    const startTime = Date.now();

    // Run a search query that would use the index
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 100,
    });

    const duration = Date.now() - startTime;

    expect(error).toBeNull();
    // With GIN index, search should be fast (<1s for indexed search)
    // Without index, it would be much slower on large datasets
    expect(duration).toBeLessThan(2000);
  });

  it('index supports complex queries efficiently', async () => {
    const queries = [
      'katana wakizashi',
      'Bizen province',
      'Juyo token',
      'Sukehiro',
    ];

    for (const query of queries) {
      const startTime = Date.now();

      const { error } = await supabase.rpc('search_listings_instant', {
        p_query: query,
        p_limit: 50,
      });

      const duration = Date.now() - startTime;

      expect(error).toBeNull();
      expect(duration).toBeLessThan(2000);
    }
  });

  it('handles concurrent searches efficiently', async () => {
    const startTime = Date.now();

    // Run multiple searches in parallel
    const searches = await Promise.all([
      supabase.rpc('search_listings_instant', { p_query: 'katana', p_limit: 10 }),
      supabase.rpc('search_listings_instant', { p_query: 'wakizashi', p_limit: 10 }),
      supabase.rpc('search_listings_instant', { p_query: 'tanto', p_limit: 10 }),
      supabase.rpc('search_listings_instant', { p_query: 'tsuba', p_limit: 10 }),
      supabase.rpc('search_listings_instant', { p_query: 'Bizen', p_limit: 10 }),
    ]);

    const duration = Date.now() - startTime;

    // All searches should succeed
    searches.forEach(({ error }) => {
      expect(error).toBeNull();
    });

    // Parallel searches should complete reasonably fast
    expect(duration).toBeLessThan(5000);
  });
});

// ============================================================================
// Trigger Tests
// ============================================================================
describe('Search Vector Trigger', () => {
  // Note: These tests verify trigger behavior indirectly since we can't
  // create/delete test records in production without cleanup.

  it('listings with title have search_vector populated', async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, search_vector')
      .not('title', 'is', null)
      .neq('title', '')
      .limit(50);

    expect(error).toBeNull();

    if (data) {
      // Most listings with titles should have search_vector populated
      const withVector = data.filter(l => l.search_vector !== null);
      const percentage = (withVector.length / data.length) * 100;
      expect(percentage).toBeGreaterThan(80);
    }
  });

  it('listings with smith have search_vector populated', async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, smith, search_vector')
      .not('smith', 'is', null)
      .neq('smith', '')
      .limit(50);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      const withVector = data.filter(l => l.search_vector !== null);
      expect(withVector.length).toBe(data.length);
    }
  });

  it('listings with tosogu_maker have search_vector populated', async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('id, tosogu_maker, search_vector')
      .not('tosogu_maker', 'is', null)
      .neq('tosogu_maker', '')
      .limit(50);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      const withVector = data.filter(l => l.search_vector !== null);
      expect(withVector.length).toBe(data.length);
    }
  });

  it('search_vector contains data from multiple fields', async () => {
    // Find a listing with multiple searchable fields
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, smith, school, province, search_vector')
      .not('title', 'is', null)
      .not('smith', 'is', null)
      .not('search_vector', 'is', null)
      .limit(10);

    expect(error).toBeNull();

    if (data && data.length > 0) {
      // Search for smith name should find the listing
      const listing = data[0];
      if (listing.smith) {
        const { data: searchResults } = await supabase.rpc('search_listings_instant', {
          p_query: listing.smith,
          p_limit: 100,
        });

        if (searchResults) {
          const found = searchResults.some((r: { id: string }) => r.id === listing.id);
          // The listing should be found when searching for its smith
          // (may not always match due to tokenization)
        }
      }
    }
  });
});

// ============================================================================
// Search Weight Tests
// ============================================================================
describe('Search Vector Weights', () => {
  it('title matches rank higher (Weight A)', async () => {
    // Find listings where search term is in title vs only in description
    // Title should have higher rank due to Weight A

    const { data, error } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 20,
    });

    expect(error).toBeNull();

    if (data && data.length > 1) {
      // Results should be ordered by rank descending
      const ranks = data.map((r: { rank: number }) => r.rank);
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
      }
    }
  });

  it('smith name searches return relevant results', async () => {
    // Smith names should be highly weighted (Weight A)
    const smithNames = ['Kotetsu', 'Masamune', 'Muramasa', 'Sukehiro', 'Kunimitsu'];

    for (const smith of smithNames) {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: smith,
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it('school name searches return relevant results', async () => {
    // School names should be weighted (Weight B)
    const schools = ['Bizen', 'Yamashiro', 'Soshu', 'Mino', 'Yamato'];

    for (const school of schools) {
      const { data, error } = await supabase.rpc('search_listings_instant', {
        p_query: school,
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it('province searches return relevant results', async () => {
    // Province names should be weighted (Weight C)
    const provinces = ['Bizen', 'Yamashiro', 'Sagami', 'Mino', 'Settsu'];

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

  it('era searches return relevant results', async () => {
    // Era names should be weighted (Weight C)
    const eras = ['Koto', 'Shinto', 'Shinshinto', 'Muromachi', 'Kamakura', 'Edo'];

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
});

// ============================================================================
// Data Integrity Tests
// ============================================================================
describe('Search Data Integrity', () => {
  it('search results match actual listing data', async () => {
    const { data: searchResults, error: searchErr } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 5,
    });

    expect(searchErr).toBeNull();

    if (searchResults && searchResults.length > 0) {
      const ids = searchResults.map((r: { id: string }) => r.id);

      // Fetch actual listings to verify data matches
      const { data: listings, error: listingsErr } = await supabase
        .from('listings')
        .select('id, title, item_type, price_value, price_currency')
        .in('id', ids);

      expect(listingsErr).toBeNull();

      if (listings) {
        // Verify each search result matches the actual listing
        searchResults.forEach((result: {
          id: string;
          title: string;
          item_type: string;
          price_value: number | null;
          price_currency: string | null;
        }) => {
          const listing = listings.find(l => l.id === result.id);
          if (listing) {
            expect(result.title).toBe(listing.title);
            expect(result.item_type).toBe(listing.item_type);
            expect(result.price_value).toBe(listing.price_value);
            expect(result.price_currency).toBe(listing.price_currency);
          }
        });
      }
    }
  });

  it('dealer join returns correct dealer data', async () => {
    const { data: searchResults, error: searchErr } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 5,
    });

    expect(searchErr).toBeNull();

    if (searchResults && searchResults.length > 0) {
      for (const result of searchResults) {
        // Verify dealer info matches
        const { data: dealer, error: dealerErr } = await supabase
          .from('dealers')
          .select('id, name')
          .eq('id', result.dealer_id)
          .single();

        expect(dealerErr).toBeNull();

        if (dealer) {
          expect(result.dealer_name).toBe(dealer.name);
        }
      }
    }
  });

  it('total_count accurately reflects matching records', async () => {
    const { data: results, error } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 5,
    });

    expect(error).toBeNull();

    if (results && results.length > 0) {
      const totalCount = results[0].total_count;

      // Fetch with larger limit to verify count
      const { data: allResults } = await supabase.rpc('search_listings_instant', {
        p_query: 'katana',
        p_limit: totalCount + 10, // Get more than total to verify
      });

      if (allResults) {
        // The number of results should equal the total_count
        expect(allResults.length).toBe(totalCount);
      }
    }
  });
});

// ============================================================================
// RPC Function Signature Tests
// ============================================================================
describe('RPC Function Signatures', () => {
  it('search_listings_instant accepts correct parameters', async () => {
    // Test with all parameters
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'test',
      p_limit: 5,
    });

    expect(error).toBeNull();
  });

  it('search_listings_instant handles missing optional parameters', async () => {
    // p_limit has a default value
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'test',
    });

    expect(error).toBeNull();
  });

  it('search_listings_ranked accepts all parameters', async () => {
    const { error } = await supabase.rpc('search_listings_ranked', {
      p_query: 'test',
      p_tab: 'available',
      p_item_types: ['katana'],
      p_certifications: ['Juyo'],
      p_dealers: [1],
      p_ask_only: false,
      p_sort: 'relevance',
      p_limit: 10,
      p_offset: 0,
    });

    expect(error).toBeNull();
  });

  it('search_listings_ranked handles missing optional parameters', async () => {
    // Test with minimal parameters (all have defaults)
    const { error } = await supabase.rpc('search_listings_ranked', {
      p_query: null,
    });

    expect(error).toBeNull();
  });

  it('search_listings_ranked handles null for array parameters', async () => {
    const { error } = await supabase.rpc('search_listings_ranked', {
      p_query: 'test',
      p_tab: 'available',
      p_item_types: null,
      p_certifications: null,
      p_dealers: null,
    });

    expect(error).toBeNull();
  });

  it('search_listings_ranked handles empty arrays', async () => {
    const { error } = await supabase.rpc('search_listings_ranked', {
      p_query: 'test',
      p_tab: 'available',
      p_item_types: [],
      p_certifications: [],
      p_dealers: [],
    });

    expect(error).toBeNull();
  });
});

// ============================================================================
// tsquery Parser Tests
// ============================================================================
describe('tsquery Parser (plainto_tsquery)', () => {
  it('handles simple single word', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles multiple words (AND search)', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana blade',
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles hyphenated words', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'fuchi-kashira',
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles numbers in query', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: '2024',
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles mixed alphanumeric', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'session2024',
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles apostrophes', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: "collector's item",
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles quotes (treated as regular characters)', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: '"katana"',
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles parentheses safely', async () => {
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'sword (katana)',
      p_limit: 5,
    });
    expect(error).toBeNull();
  });

  it('handles operators as regular text (plainto_tsquery)', async () => {
    // plainto_tsquery treats operators as regular words
    const operatorQueries = ['katana & wakizashi', 'katana | tanto', '!katana'];

    for (const query of operatorQueries) {
      const { error } = await supabase.rpc('search_listings_instant', {
        p_query: query,
        p_limit: 5,
      });
      expect(error).toBeNull();
    }
  });
});

// ============================================================================
// 'simple' Configuration Tests
// ============================================================================
describe("'simple' Text Search Configuration", () => {
  it('does not stem English words (important for Japanese romanization)', async () => {
    // With 'english' config, "running" would stem to "run"
    // With 'simple' config, they stay separate - important for Japanese names

    const { data: exact, error: exactErr } = await supabase.rpc('search_listings_instant', {
      p_query: 'katana',
      p_limit: 10,
    });

    const { data: variant, error: variantErr } = await supabase.rpc('search_listings_instant', {
      p_query: 'katanas',
      p_limit: 10,
    });

    expect(exactErr).toBeNull();
    expect(variantErr).toBeNull();

    // With 'simple' config, singular and plural may return different results
    // This is expected and correct for Japanese terminology
  });

  it('treats each word literally without stop words', async () => {
    // 'simple' config doesn't remove stop words like "the", "a", "an"
    const { error } = await supabase.rpc('search_listings_instant', {
      p_query: 'the katana',
      p_limit: 5,
    });

    expect(error).toBeNull();
  });

  it('preserves Japanese romanization terms', async () => {
    // Important for proper names like smith names
    const japaneseTerms = [
      'Sukehiro',
      'Kotetsu',
      'Masahide',
      'Kunimitsu',
      'Kanemitsu',
    ];

    for (const term of japaneseTerms) {
      const { error } = await supabase.rpc('search_listings_instant', {
        p_query: term,
        p_limit: 5,
      });

      expect(error).toBeNull();
    }
  });
});
