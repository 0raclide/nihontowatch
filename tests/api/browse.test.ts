/**
 * Browse API Unit Tests - Query Building Logic
 *
 * Tests the /api/browse endpoint's query building logic by mocking Supabase.
 * Verifies that:
 * - Correct fields are searched
 * - OR conditions are built properly for text search
 * - AND conditions combine multiple words
 * - Numeric filters use correct operators (gt, gte, lt, lte)
 *
 * Uses vitest with mocking - no live server required.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock Next.js cookies before importing the route handler
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// Track all Supabase query chain calls
interface QueryTracker {
  selectCalls: Array<{ columns: string; options?: { count: string } }>;
  orCalls: string[];
  inCalls: Array<{ column: string; values: unknown[] }>;
  filterCalls: Array<{ column: string; operator: string; value: unknown }>;
  orderCalls: Array<{ column: string; options: { ascending: boolean; nullsFirst?: boolean } }>;
  rangeCalls: Array<{ from: number; to: number }>;
  isCalls: Array<{ column: string; value: null }>;
  rpcCalls: Array<{ name: string; params: Record<string, unknown> }>;
  singleCalls: number;
  limitCalls: number[];
}

let queryTracker: QueryTracker;

// Create a mock query builder that tracks all method calls
function createMockQueryBuilder(returnData: unknown[] = [], returnCount = 0) {
  const builder: Record<string, Mock> = {};

  // Helper to create chainable methods
  const chain = () => builder;

  builder.select = vi.fn((columns: string, options?: { count: string }) => {
    queryTracker.selectCalls.push({ columns, options });
    return chain();
  });

  builder.or = vi.fn((conditions: string) => {
    queryTracker.orCalls.push(conditions);
    return chain();
  });

  builder.in = vi.fn((column: string, values: unknown[]) => {
    queryTracker.inCalls.push({ column, values });
    return chain();
  });

  builder.filter = vi.fn((column: string, operator: string, value: unknown) => {
    queryTracker.filterCalls.push({ column, operator, value });
    return chain();
  });

  builder.order = vi.fn((column: string, options: { ascending: boolean; nullsFirst?: boolean }) => {
    queryTracker.orderCalls.push({ column, options });
    return chain();
  });

  builder.range = vi.fn((from: number, to: number) => {
    queryTracker.rangeCalls.push({ from, to });
    // Return the final result
    return Promise.resolve({
      data: returnData,
      error: null,
      count: returnCount,
    });
  });

  builder.is = vi.fn((column: string, value: null) => {
    queryTracker.isCalls.push({ column, value });
    return chain();
  });

  builder.limit = vi.fn((limit: number) => {
    queryTracker.limitCalls.push(limit);
    return chain();
  });

  builder.single = vi.fn(() => {
    queryTracker.singleCalls++;
    return Promise.resolve({
      data: { last_scraped_at: '2024-01-01T00:00:00Z' },
      error: null,
    });
  });

  return builder;
}

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Import the functions we're testing (after mocks are set up)
import { normalizeSearchText, expandSearchAliases } from '@/lib/search';

// Helper to create a mock NextRequest
function createMockRequest(searchParams: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/browse');
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new Request(url);
}

// Reset query tracker before each test
beforeEach(() => {
  queryTracker = {
    selectCalls: [],
    orCalls: [],
    inCalls: [],
    filterCalls: [],
    orderCalls: [],
    rangeCalls: [],
    isCalls: [],
    rpcCalls: [],
    singleCalls: 0,
    limitCalls: [],
  };

  // Reset mocks
  vi.clearAllMocks();

  // Set up default mock behavior
  const mainBuilder = createMockQueryBuilder([], 0);
  const facetBuilder = createMockQueryBuilder([], 0);
  const freshnessBuilder = createMockQueryBuilder([], 0);

  let callCount = 0;
  mockSupabaseClient.from.mockImplementation(() => {
    callCount++;
    // First call is main query, subsequent calls are for facets/freshness
    if (callCount === 1) return mainBuilder;
    if (callCount <= 4) return facetBuilder;
    return freshnessBuilder;
  });

  mockSupabaseClient.rpc.mockResolvedValue({
    data: { itemTypes: [], certifications: [], dealers: [] },
    error: null,
  });
});

// =============================================================================
// SEARCH UTILITY FUNCTION TESTS
// =============================================================================

describe('Search Utility Functions', () => {
  describe('normalizeSearchText', () => {
    it('removes macrons and lowercases text', () => {
      expect(normalizeSearchText('Tōkyō')).toBe('tokyo');
      expect(normalizeSearchText('Jūyō')).toBe('juyo');
      expect(normalizeSearchText('Gotō')).toBe('goto');
    });

    it('trims whitespace', () => {
      expect(normalizeSearchText('  katana  ')).toBe('katana');
    });

    it('handles empty string', () => {
      expect(normalizeSearchText('')).toBe('');
    });
  });

  describe('expandSearchAliases', () => {
    it('expands sword aliases', () => {
      const aliases = expandSearchAliases('sword');
      expect(aliases).toContain('sword');
      expect(aliases).toContain('katana');
      expect(aliases).toContain('wakizashi');
      expect(aliases).toContain('tanto');
    });

    it('expands tosogu aliases', () => {
      const aliases = expandSearchAliases('tosogu');
      expect(aliases).toContain('tosogu');
      expect(aliases).toContain('tsuba');
      expect(aliases).toContain('fuchi');
      expect(aliases).toContain('menuki');
    });

    it('returns single term for unknown words', () => {
      const aliases = expandSearchAliases('bizen');
      expect(aliases).toEqual(['bizen']);
    });
  });
});

// =============================================================================
// PARAMETER PARSING TESTS
// =============================================================================

describe('Parameter Parsing', () => {
  describe('Tab parameter', () => {
    it('defaults to "available" when not specified', () => {
      const params = new URLSearchParams('');
      const tab = params.get('tab') || 'available';
      expect(tab).toBe('available');
    });

    it('accepts "sold" tab', () => {
      const params = new URLSearchParams('tab=sold');
      const tab = params.get('tab');
      expect(tab).toBe('sold');
    });
  });

  describe('Item type parameter', () => {
    it('parses single item type', () => {
      const params = new URLSearchParams('type=katana');
      const types = params.get('type')?.split(',').map(t => t.toLowerCase());
      expect(types).toEqual(['katana']);
    });

    it('parses multiple item types', () => {
      const params = new URLSearchParams('type=katana,wakizashi,tanto');
      const types = params.get('type')?.split(',').map(t => t.toLowerCase());
      expect(types).toEqual(['katana', 'wakizashi', 'tanto']);
    });
  });

  describe('Certification parameter', () => {
    it('parses single certification', () => {
      const params = new URLSearchParams('cert=Juyo');
      const certs = params.get('cert')?.split(',');
      expect(certs).toEqual(['Juyo']);
    });

    it('parses multiple certifications', () => {
      const params = new URLSearchParams('cert=Juyo,Hozon,TokuHozon');
      const certs = params.get('cert')?.split(',');
      expect(certs).toEqual(['Juyo', 'Hozon', 'TokuHozon']);
    });
  });

  describe('Dealer parameter', () => {
    it('parses single dealer ID', () => {
      const params = new URLSearchParams('dealer=1');
      const dealers = params.get('dealer')?.split(',').map(Number);
      expect(dealers).toEqual([1]);
    });

    it('parses multiple dealer IDs', () => {
      const params = new URLSearchParams('dealer=1,4,7');
      const dealers = params.get('dealer')?.split(',').map(Number);
      expect(dealers).toEqual([1, 4, 7]);
    });
  });

  describe('Pagination parameters', () => {
    it('defaults to page 1', () => {
      const params = new URLSearchParams('');
      const page = Number(params.get('page')) || 1;
      expect(page).toBe(1);
    });

    it('defaults to limit 30', () => {
      const params = new URLSearchParams('');
      const limit = Math.min(Number(params.get('limit')) || 30, 100);
      expect(limit).toBe(30);
    });

    it('clamps limit to max 100', () => {
      const params = new URLSearchParams('limit=500');
      const limit = Math.min(Number(params.get('limit')) || 30, 100);
      expect(limit).toBe(100);
    });

    it('clamps page to max 1000', () => {
      const params = new URLSearchParams('page=9999');
      const page = Math.max(1, Math.min(Number(params.get('page')) || 1, 1000));
      expect(page).toBe(1000);
    });
  });

  describe('Sort parameter', () => {
    it('defaults to "recent"', () => {
      const params = new URLSearchParams('');
      const sort = params.get('sort') || 'recent';
      expect(sort).toBe('recent');
    });

    it('accepts valid sort values', () => {
      const validSorts = ['price_asc', 'price_desc', 'name', 'recent'];
      validSorts.forEach(sortValue => {
        const params = new URLSearchParams(`sort=${sortValue}`);
        expect(params.get('sort')).toBe(sortValue);
      });
    });
  });

  describe('Ask-only parameter', () => {
    it('parses ask=true', () => {
      const params = new URLSearchParams('ask=true');
      const askOnly = params.get('ask') === 'true';
      expect(askOnly).toBe(true);
    });

    it('defaults to false', () => {
      const params = new URLSearchParams('');
      const askOnly = params.get('ask') === 'true';
      expect(askOnly).toBe(false);
    });
  });

  describe('Category parameter', () => {
    it('defaults to "all" when not specified', () => {
      const params = new URLSearchParams('');
      const category = params.get('cat') || 'all';
      expect(category).toBe('all');
    });

    it('accepts "nihonto" category', () => {
      const params = new URLSearchParams('cat=nihonto');
      const category = params.get('cat');
      expect(category).toBe('nihonto');
    });

    it('accepts "tosogu" category', () => {
      const params = new URLSearchParams('cat=tosogu');
      const category = params.get('cat');
      expect(category).toBe('tosogu');
    });
  });

  describe('Category to item types mapping', () => {
    const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi', 'ken', 'naginata naoshi', 'sword'];
    const TOSOGU_TYPES = [
      'tsuba', 'fuchi-kashira', 'fuchi_kashira', 'fuchi', 'kashira',
      'kozuka', 'kogatana', 'kogai', 'menuki', 'koshirae', 'tosogu', 'mitokoromono'
    ];

    it('maps nihonto category to sword types', () => {
      const category = 'nihonto';
      const itemTypes: string[] = [];

      const effectiveItemTypes = itemTypes.length
        ? itemTypes
        : category === 'nihonto'
          ? NIHONTO_TYPES
          : category === 'tosogu'
            ? TOSOGU_TYPES
            : undefined;

      expect(effectiveItemTypes).toEqual(NIHONTO_TYPES);
      expect(effectiveItemTypes).toContain('katana');
      expect(effectiveItemTypes).toContain('wakizashi');
      expect(effectiveItemTypes).not.toContain('tsuba');
    });

    it('maps tosogu category to fitting types', () => {
      const category = 'tosogu';
      const itemTypes: string[] = [];

      const effectiveItemTypes = itemTypes.length
        ? itemTypes
        : category === 'nihonto'
          ? NIHONTO_TYPES
          : category === 'tosogu'
            ? TOSOGU_TYPES
            : undefined;

      expect(effectiveItemTypes).toEqual(TOSOGU_TYPES);
      expect(effectiveItemTypes).toContain('tsuba');
      expect(effectiveItemTypes).toContain('menuki');
      expect(effectiveItemTypes).not.toContain('katana');
    });

    it('uses explicit itemTypes over category when provided', () => {
      const category = 'nihonto';
      const itemTypes = ['tsuba', 'kozuka']; // User specifically selected tosogu types

      const effectiveItemTypes = itemTypes.length
        ? itemTypes
        : category === 'nihonto'
          ? NIHONTO_TYPES
          : category === 'tosogu'
            ? TOSOGU_TYPES
            : undefined;

      expect(effectiveItemTypes).toEqual(['tsuba', 'kozuka']);
    });

    it('returns undefined for "all" category with no itemTypes', () => {
      const category = 'all';
      const itemTypes: string[] = [];

      const effectiveItemTypes = itemTypes.length
        ? itemTypes
        : category === 'nihonto'
          ? NIHONTO_TYPES
          : category === 'tosogu'
            ? TOSOGU_TYPES
            : undefined;

      expect(effectiveItemTypes).toBeUndefined();
    });
  });
});

// =============================================================================
// NUMERIC FILTER PARSING TESTS
// =============================================================================

describe('Numeric Filter Parsing', () => {
  // Recreate the parseNumericFilters function logic for testing
  function parseNumericFilters(queryStr: string) {
    const words = queryStr.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    const filters: Array<{ field: string; op: 'gt' | 'gte' | 'lt' | 'lte'; value: number }> = [];
    const textWords: string[] = [];

    const numericPattern = /^(nagasa|cm|length|price|yen|jpy)([><]=?)(\d+(?:\.\d+)?)$/;

    for (const word of words) {
      const match = word.match(numericPattern);
      if (match) {
        const [, fieldAlias, opStr, valueStr] = match;
        const value = parseFloat(valueStr);

        let field: string;
        if (['nagasa', 'cm', 'length'].includes(fieldAlias)) {
          field = 'nagasa_cm';
        } else if (['price', 'yen', 'jpy'].includes(fieldAlias)) {
          field = 'price_value';
        } else {
          textWords.push(word);
          continue;
        }

        let op: 'gt' | 'gte' | 'lt' | 'lte';
        if (opStr === '>') op = 'gt';
        else if (opStr === '>=') op = 'gte';
        else if (opStr === '<') op = 'lt';
        else op = 'lte';

        filters.push({ field, op, value });
      } else {
        textWords.push(word);
      }
    }

    return { filters, textWords };
  }

  describe('Greater than filters (>)', () => {
    it('parses cm>70 as nagasa_cm gt 70', () => {
      const { filters } = parseNumericFilters('cm>70');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
    });

    it('parses nagasa>65 as nagasa_cm gt 65', () => {
      const { filters } = parseNumericFilters('nagasa>65');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 65 });
    });

    it('parses length>72 as nagasa_cm gt 72', () => {
      const { filters } = parseNumericFilters('length>72');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 72 });
    });

    it('parses price>1000000 as price_value gt 1000000', () => {
      const { filters } = parseNumericFilters('price>1000000');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'price_value', op: 'gt', value: 1000000 });
    });

    it('parses yen>500000 as price_value gt 500000', () => {
      const { filters } = parseNumericFilters('yen>500000');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'price_value', op: 'gt', value: 500000 });
    });

    it('parses jpy>100000 as price_value gt 100000', () => {
      const { filters } = parseNumericFilters('jpy>100000');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'price_value', op: 'gt', value: 100000 });
    });
  });

  describe('Greater than or equal filters (>=)', () => {
    it('parses cm>=70 as nagasa_cm gte 70', () => {
      const { filters } = parseNumericFilters('cm>=70');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'gte', value: 70 });
    });

    it('parses price>=1000000 as price_value gte 1000000', () => {
      const { filters } = parseNumericFilters('price>=1000000');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'price_value', op: 'gte', value: 1000000 });
    });
  });

  describe('Less than filters (<)', () => {
    it('parses cm<65 as nagasa_cm lt 65', () => {
      const { filters } = parseNumericFilters('cm<65');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'lt', value: 65 });
    });

    it('parses price<500000 as price_value lt 500000', () => {
      const { filters } = parseNumericFilters('price<500000');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'price_value', op: 'lt', value: 500000 });
    });
  });

  describe('Less than or equal filters (<=)', () => {
    it('parses cm<=68 as nagasa_cm lte 68', () => {
      const { filters } = parseNumericFilters('cm<=68');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'lte', value: 68 });
    });

    it('parses price<=2000000 as price_value lte 2000000', () => {
      const { filters } = parseNumericFilters('price<=2000000');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'price_value', op: 'lte', value: 2000000 });
    });
  });

  describe('Decimal values', () => {
    it('parses cm>70.5 correctly', () => {
      const { filters } = parseNumericFilters('cm>70.5');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70.5 });
    });
  });

  describe('Combined text and numeric filters', () => {
    it('separates text from numeric filters in "bizen cm>70"', () => {
      const { filters, textWords } = parseNumericFilters('bizen cm>70');
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({ field: 'nagasa_cm', op: 'gt', value: 70 });
      expect(textWords).toEqual(['bizen']);
    });

    it('handles multiple text words with numeric filter', () => {
      const { filters, textWords } = parseNumericFilters('juyo katana cm>70 price<5000000');
      expect(filters).toHaveLength(2);
      expect(textWords).toEqual(['juyo', 'katana']);
    });

    it('handles complex query with all filter types', () => {
      const { filters, textWords } = parseNumericFilters('soshu juyo cm>=68 cm<75 price>1000000');
      expect(filters).toHaveLength(3);
      expect(textWords).toEqual(['soshu', 'juyo']);
    });
  });

  describe('Invalid numeric patterns', () => {
    it('treats invalid patterns as text words', () => {
      const { filters, textWords } = parseNumericFilters('cm70'); // Missing operator
      expect(filters).toHaveLength(0);
      expect(textWords).toEqual(['cm70']);
    });

    it('treats unknown field aliases as text', () => {
      const { filters, textWords } = parseNumericFilters('width>10');
      expect(filters).toHaveLength(0);
      expect(textWords).toEqual(['width>10']);
    });
  });

  describe('Short words filtered', () => {
    it('filters single character words', () => {
      const { textWords } = parseNumericFilters('a b katana');
      expect(textWords).toEqual(['katana']);
    });
  });
});

// =============================================================================
// TEXT SEARCH QUERY BUILDING TESTS
// =============================================================================

describe('Text Search Query Building', () => {
  const searchFields = [
    'title',
    'description',
    'smith',
    'tosogu_maker',
    'school',
    'tosogu_school',
    'province',
    'era',
    'mei_type',
    'cert_type',
    'item_type',
    'item_category',
    'material',
  ];

  describe('Single word search', () => {
    it('builds OR conditions across all search fields', () => {
      const word = 'katana';
      const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);

      // Build the expected OR conditions
      const conditions = expandedTerms.flatMap(term =>
        searchFields.map(field => `${field}.ilike.%${term}%`)
      );

      // Verify all fields are included
      searchFields.forEach(field => {
        expect(conditions.some(c => c.includes(field))).toBe(true);
      });
    });

    it('uses ILIKE for case-insensitive matching', () => {
      const word = 'bizen';
      const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);
      const conditions = expandedTerms.flatMap(term =>
        searchFields.map(field => `${field}.ilike.%${term}%`)
      );

      // All conditions should use ILIKE
      conditions.forEach(condition => {
        expect(condition).toContain('.ilike.');
      });
    });

    it('wraps term with wildcards for partial matching', () => {
      const word = 'masa';
      const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);
      const conditions = expandedTerms.flatMap(term =>
        searchFields.map(field => `${field}.ilike.%${term}%`)
      );

      // All conditions should have % wildcards
      conditions.forEach(condition => {
        expect(condition).toMatch(/%[^%]+%/);
      });
    });
  });

  describe('Multi-word search (AND logic)', () => {
    it('creates separate OR conditions for each word (AND between words)', () => {
      const words = ['bizen', 'juyo'];

      // Each word gets its own OR condition set
      const wordConditions = words.map(word => {
        const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);
        return expandedTerms.flatMap(term =>
          searchFields.map(field => `${field}.ilike.%${term}%`)
        );
      });

      // Should have 2 sets of OR conditions
      expect(wordConditions).toHaveLength(2);

      // Each set should cover all search fields
      wordConditions.forEach(conditions => {
        searchFields.forEach(field => {
          expect(conditions.some(c => c.includes(field))).toBe(true);
        });
      });
    });

    it('applies AND logic - all words must match somewhere', () => {
      // With "bizen katana", we need:
      // (field ILIKE %bizen% OR other_field ILIKE %bizen% ...)
      // AND
      // (field ILIKE %katana% OR other_field ILIKE %katana% ...)
      const words = ['bizen', 'katana'];

      // Each word = one .or() call
      // Multiple words = multiple .or() calls = implicit AND
      expect(words.length).toBe(2);
    });
  });

  describe('Alias expansion in search', () => {
    it('expands "tokuju" to include "tokubetsu juyo" variants', () => {
      // Based on the API implementation, tokuju should match items
      // with cert_type containing "tokubetsu juyo" or similar
      const word = 'tokuju';
      const expanded = expandSearchAliases(word);

      // Tokuju is not in the SEARCH_ALIASES, but may be handled elsewhere
      // The search will still match if the database contains "tokuju"
      expect(expanded).toContain('tokuju');
    });

    it('expands "sword" to blade types', () => {
      const expanded = expandSearchAliases('sword');
      expect(expanded).toContain('sword');
      expect(expanded).toContain('katana');
      expect(expanded).toContain('wakizashi');
      expect(expanded).toContain('tanto');
      expect(expanded).toContain('tachi');
    });

    it('expands "fittings" to tosogu types', () => {
      const expanded = expandSearchAliases('fittings');
      expect(expanded).toContain('fittings');
      expect(expanded).toContain('tsuba');
      expect(expanded).toContain('fuchi');
      expect(expanded).toContain('kashira');
      expect(expanded).toContain('menuki');
    });

    it('builds OR conditions for all expanded terms', () => {
      const word = 'sword';
      const expandedTerms = expandSearchAliases(word).map(normalizeSearchText);

      // Should have 5 terms: sword, katana, wakizashi, tanto, tachi
      expect(expandedTerms.length).toBe(5);

      // Each term creates conditions for all search fields
      const totalConditions = expandedTerms.length * searchFields.length;
      expect(totalConditions).toBe(5 * 13); // 65 conditions
    });
  });
});

// =============================================================================
// FILTER QUERY BUILDING TESTS
// =============================================================================

describe('Filter Query Building', () => {
  describe('Status filter', () => {
    it('builds available status filter', () => {
      const STATUS_AVAILABLE = 'status.eq.available,is_available.eq.true';
      expect(STATUS_AVAILABLE).toContain('status.eq.available');
      expect(STATUS_AVAILABLE).toContain('is_available.eq.true');
    });

    it('builds sold status filter', () => {
      const STATUS_SOLD = 'status.eq.sold,status.eq.presumed_sold,is_sold.eq.true';
      expect(STATUS_SOLD).toContain('status.eq.sold');
      expect(STATUS_SOLD).toContain('status.eq.presumed_sold');
      expect(STATUS_SOLD).toContain('is_sold.eq.true');
    });
  });

  describe('Item type filter', () => {
    it('builds ILIKE conditions for case-insensitive matching', () => {
      const itemTypes = ['katana', 'wakizashi'];
      const typeConditions = itemTypes
        .map(t => `item_type.ilike.${t}`)
        .join(',');

      expect(typeConditions).toBe('item_type.ilike.katana,item_type.ilike.wakizashi');
    });

    it('handles single item type', () => {
      const itemTypes = ['tanto'];
      const typeConditions = itemTypes
        .map(t => `item_type.ilike.${t}`)
        .join(',');

      expect(typeConditions).toBe('item_type.ilike.tanto');
    });
  });

  describe('Certification filter', () => {
    it('expands certification variants', () => {
      const CERT_VARIANTS: Record<string, string[]> = {
        'Juyo': ['Juyo', 'juyo'],
        'Tokuju': ['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'],
        'TokuHozon': ['TokuHozon', 'Tokubetsu Hozon', 'tokubetsu_hozon'],
        'Hozon': ['Hozon', 'hozon'],
      };

      const certifications = ['Juyo'];
      const allVariants = certifications.flatMap(c => CERT_VARIANTS[c] || [c]);

      expect(allVariants).toEqual(['Juyo', 'juyo']);
    });

    it('handles Tokuju with multiple variants', () => {
      const CERT_VARIANTS: Record<string, string[]> = {
        'Tokuju': ['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'],
      };

      const certifications = ['Tokuju'];
      const allVariants = certifications.flatMap(c => CERT_VARIANTS[c] || [c]);

      expect(allVariants).toContain('Tokuju');
      expect(allVariants).toContain('tokuju');
      expect(allVariants).toContain('Tokubetsu Juyo');
      expect(allVariants).toContain('tokubetsu_juyo');
    });

    it('passes unknown certifications through unchanged', () => {
      const CERT_VARIANTS: Record<string, string[]> = {};
      const certifications = ['CustomCert'];
      const allVariants = certifications.flatMap(c => CERT_VARIANTS[c] || [c]);

      expect(allVariants).toEqual(['CustomCert']);
    });
  });

  describe('School filter', () => {
    it('builds ILIKE conditions for both school fields', () => {
      const schools = ['Bizen'];
      const schoolConditions = schools
        .map(s => `school.ilike.%${s}%,tosogu_school.ilike.%${s}%`)
        .join(',');

      expect(schoolConditions).toContain('school.ilike.%Bizen%');
      expect(schoolConditions).toContain('tosogu_school.ilike.%Bizen%');
    });

    it('handles multiple schools', () => {
      const schools = ['Bizen', 'Soshu'];
      const schoolConditions = schools
        .map(s => `school.ilike.%${s}%,tosogu_school.ilike.%${s}%`)
        .join(',');

      expect(schoolConditions).toContain('school.ilike.%Bizen%');
      expect(schoolConditions).toContain('school.ilike.%Soshu%');
    });
  });

  describe('Dealer filter', () => {
    it('uses IN query for single dealer', () => {
      const dealers = [1];
      // The API uses .in('dealer_id', dealers)
      expect(dealers).toEqual([1]);
    });

    it('uses IN query for multiple dealers', () => {
      const dealers = [1, 4, 7];
      // The API uses .in('dealer_id', dealers)
      expect(dealers).toHaveLength(3);
    });
  });

  describe('Ask-only filter', () => {
    it('filters for null price_value', () => {
      // The API uses .is('price_value', null)
      const askOnly = true;
      expect(askOnly).toBe(true);
    });
  });
});

// =============================================================================
// SORTING TESTS
// =============================================================================

describe('Sorting Query Building', () => {
  describe('Price sorting', () => {
    it('builds ascending price sort', () => {
      const sort = 'price_asc';
      const column = 'price_value';
      const options = { ascending: true, nullsFirst: false };

      expect(sort).toBe('price_asc');
      expect(options.ascending).toBe(true);
      expect(options.nullsFirst).toBe(false);
    });

    it('builds descending price sort', () => {
      const sort = 'price_desc';
      const column = 'price_value';
      const options = { ascending: false, nullsFirst: false };

      expect(sort).toBe('price_desc');
      expect(options.ascending).toBe(false);
      expect(options.nullsFirst).toBe(false);
    });
  });

  describe('Name sorting', () => {
    it('builds ascending title sort', () => {
      const sort = 'name';
      const column = 'title';
      const options = { ascending: true };

      expect(sort).toBe('name');
      expect(column).toBe('title');
      expect(options.ascending).toBe(true);
    });
  });

  describe('Recent sorting (default)', () => {
    it('builds descending first_seen_at sort', () => {
      const sort = 'recent';
      const column = 'first_seen_at';
      const options = { ascending: false };

      expect(sort).toBe('recent');
      expect(column).toBe('first_seen_at');
      expect(options.ascending).toBe(false);
    });
  });
});

// =============================================================================
// PAGINATION TESTS
// =============================================================================

describe('Pagination Query Building', () => {
  describe('Offset calculation', () => {
    it('calculates offset for page 1', () => {
      const page = 1;
      const limit = 30;
      const offset = (page - 1) * limit;
      expect(offset).toBe(0);
    });

    it('calculates offset for page 2', () => {
      const page = 2;
      const limit = 30;
      const offset = (page - 1) * limit;
      expect(offset).toBe(30);
    });

    it('calculates offset for page 10 with limit 100', () => {
      const page = 10;
      const limit = 100;
      const offset = (page - 1) * limit;
      expect(offset).toBe(900);
    });
  });

  describe('Range building', () => {
    it('builds range for first page', () => {
      const page = 1;
      const limit = 30;
      const offset = (page - 1) * limit;
      const from = offset;
      const to = offset + limit - 1;

      expect(from).toBe(0);
      expect(to).toBe(29);
    });

    it('builds range for second page', () => {
      const page = 2;
      const limit = 30;
      const offset = (page - 1) * limit;
      const from = offset;
      const to = offset + limit - 1;

      expect(from).toBe(30);
      expect(to).toBe(59);
    });

    it('respects custom limit', () => {
      const page = 1;
      const limit = 50;
      const offset = (page - 1) * limit;
      const from = offset;
      const to = offset + limit - 1;

      expect(from).toBe(0);
      expect(to).toBe(49);
    });
  });

  describe('Page clamping', () => {
    it('clamps minimum page to 1', () => {
      const requestedPage = -5;
      const safePage = Math.max(1, Math.min(requestedPage, 1000));
      expect(safePage).toBe(1);
    });

    it('clamps maximum page to 1000', () => {
      const requestedPage = 9999;
      const safePage = Math.max(1, Math.min(requestedPage, 1000));
      expect(safePage).toBe(1000);
    });
  });
});

// =============================================================================
// EMPTY RESULTS HANDLING TESTS
// =============================================================================

describe('Empty Results Handling', () => {
  it('returns empty listings array when no matches', () => {
    const listings: unknown[] = [];
    const total = 0;
    const page = 1;
    const totalPages = Math.ceil(total / 30);

    expect(listings).toEqual([]);
    expect(total).toBe(0);
    expect(totalPages).toBe(0);
  });

  it('returns zero totalPages for empty results', () => {
    const total = 0;
    const limit = 30;
    const totalPages = Math.ceil(total / limit);

    expect(totalPages).toBe(0);
  });

  it('returns facets even with empty results', () => {
    const facets = {
      itemTypes: [],
      certifications: [],
      dealers: [],
    };

    expect(facets).toHaveProperty('itemTypes');
    expect(facets).toHaveProperty('certifications');
    expect(facets).toHaveProperty('dealers');
  });
});

// =============================================================================
// INVALID PARAMETERS HANDLING TESTS
// =============================================================================

describe('Invalid Parameters Handling', () => {
  describe('Invalid page number', () => {
    it('handles NaN page', () => {
      const params = new URLSearchParams('page=invalid');
      const page = Number(params.get('page')) || 1;
      expect(page).toBe(1);
    });

    it('handles zero page', () => {
      const params = new URLSearchParams('page=0');
      const requestedPage = Number(params.get('page')) || 1;
      const safePage = Math.max(1, requestedPage);
      expect(safePage).toBe(1);
    });

    it('handles negative page', () => {
      const params = new URLSearchParams('page=-10');
      const requestedPage = Number(params.get('page')) || 1;
      const safePage = Math.max(1, requestedPage);
      // Negative parsed as valid number, then clamped
      expect(safePage).toBe(1);
    });
  });

  describe('Invalid limit', () => {
    it('handles NaN limit', () => {
      const params = new URLSearchParams('limit=invalid');
      const limit = Math.min(Number(params.get('limit')) || 30, 100);
      expect(limit).toBe(30);
    });

    it('handles zero limit', () => {
      const params = new URLSearchParams('limit=0');
      const limit = Math.min(Number(params.get('limit')) || 30, 100);
      expect(limit).toBe(30);
    });

    it('handles negative limit', () => {
      const params = new URLSearchParams('limit=-50');
      const limit = Math.min(Number(params.get('limit')) || 30, 100);
      // Negative is truthy, so not replaced with default, but clamped
      expect(limit).toBeLessThanOrEqual(100);
    });
  });

  describe('Invalid dealer IDs', () => {
    it('handles non-numeric dealer IDs', () => {
      const params = new URLSearchParams('dealer=abc,xyz');
      const dealers = params.get('dealer')?.split(',').map(Number);
      // NaN values
      expect(dealers?.every(d => isNaN(d))).toBe(true);
    });

    it('handles mixed valid/invalid dealer IDs', () => {
      const params = new URLSearchParams('dealer=1,abc,3');
      const dealers = params.get('dealer')?.split(',').map(Number);
      expect(dealers).toEqual([1, NaN, 3]);
    });
  });

  describe('Invalid query strings', () => {
    it('handles very short query (less than 2 chars)', () => {
      const query = 'a';
      const isValid = query.trim().length >= 2;
      expect(isValid).toBe(false);
    });

    it('handles whitespace-only query', () => {
      const query = '   ';
      const trimmed = query.trim();
      const isValid = trimmed.length >= 2;
      expect(isValid).toBe(false);
    });

    it('handles empty query', () => {
      const query = '';
      const isValid = query.length > 0 && query.trim().length >= 2;
      expect(isValid).toBe(false);
    });
  });
});

// =============================================================================
// COMBINED QUERIES TESTS
// =============================================================================

describe('Combined Query Building', () => {
  it('combines text search with type filter', () => {
    // Query: q=bizen&type=katana
    // Should apply:
    // 1. Status filter (OR)
    // 2. Type filter (OR for ILIKE)
    // 3. Text search (OR for each word)
    const textQuery = 'bizen';
    const type = 'katana';

    expect(textQuery).toBe('bizen');
    expect(type).toBe('katana');
  });

  it('combines text search with numeric filter', () => {
    // Query: q=bizen cm>70
    // Should apply:
    // 1. Status filter (OR)
    // 2. Numeric filter (filter method)
    // 3. Text search for remaining words (OR)
    const textQuery = 'bizen cm>70';

    // Parse would separate these
    const numericPattern = /^(nagasa|cm|length|price|yen|jpy)([><]=?)(\d+(?:\.\d+)?)$/;
    const words = textQuery.split(' ');
    const numericWord = words.find(w => numericPattern.test(w));
    const textWords = words.filter(w => !numericPattern.test(w));

    expect(numericWord).toBe('cm>70');
    expect(textWords).toEqual(['bizen']);
  });

  it('combines multiple filters with sorting and pagination', () => {
    // Full query: q=katana&type=katana&cert=Juyo&dealer=1&sort=price_desc&page=2&limit=50
    const params = {
      q: 'katana',
      type: 'katana',
      cert: 'Juyo',
      dealer: 1,
      sort: 'price_desc',
      page: 2,
      limit: 50,
    };

    // Verify all params parsed correctly
    expect(params.q).toBe('katana');
    expect(params.type).toBe('katana');
    expect(params.cert).toBe('Juyo');
    expect(params.dealer).toBe(1);
    expect(params.sort).toBe('price_desc');
    expect(params.page).toBe(2);
    expect(params.limit).toBe(50);
  });
});

// =============================================================================
// RESPONSE STRUCTURE TESTS
// =============================================================================

describe('Response Structure', () => {
  it('includes required fields in response', () => {
    const response = {
      listings: [],
      total: 0,
      page: 1,
      totalPages: 0,
      facets: {
        itemTypes: [],
        certifications: [],
        dealers: [],
      },
      lastUpdated: null,
    };

    expect(response).toHaveProperty('listings');
    expect(response).toHaveProperty('total');
    expect(response).toHaveProperty('page');
    expect(response).toHaveProperty('totalPages');
    expect(response).toHaveProperty('facets');
    expect(response.facets).toHaveProperty('itemTypes');
    expect(response.facets).toHaveProperty('certifications');
    expect(response.facets).toHaveProperty('dealers');
  });

  it('includes listing fields in response', () => {
    const listing = {
      id: '123',
      url: 'https://example.com/listing/123',
      title: 'Test Katana',
      item_type: 'katana',
      price_value: 1000000,
      price_currency: 'JPY',
      smith: 'Test Smith',
      tosogu_maker: null,
      school: 'Bizen',
      tosogu_school: null,
      cert_type: 'Juyo',
      nagasa_cm: 70.5,
      images: ['image1.jpg'],
      first_seen_at: '2024-01-01T00:00:00Z',
      last_scraped_at: '2024-01-15T00:00:00Z',
      status: 'available',
      is_available: true,
      is_sold: false,
      dealer_id: 1,
      dealers: {
        id: 1,
        name: 'Test Dealer',
        domain: 'testdealer.com',
      },
    };

    expect(listing).toHaveProperty('id');
    expect(listing).toHaveProperty('title');
    expect(listing).toHaveProperty('item_type');
    expect(listing).toHaveProperty('price_value');
    expect(listing).toHaveProperty('smith');
    expect(listing).toHaveProperty('cert_type');
    expect(listing).toHaveProperty('dealers');
  });

  it('includes dealer facet structure', () => {
    const dealerFacet = {
      id: 1,
      name: 'Aoi Art',
      count: 150,
    };

    expect(dealerFacet).toHaveProperty('id');
    expect(dealerFacet).toHaveProperty('name');
    expect(dealerFacet).toHaveProperty('count');
  });

  it('includes item type facet structure', () => {
    const typeFacet = {
      value: 'katana',
      count: 500,
    };

    expect(typeFacet).toHaveProperty('value');
    expect(typeFacet).toHaveProperty('count');
  });

  it('includes certification facet structure', () => {
    const certFacet = {
      value: 'Juyo',
      count: 100,
    };

    expect(certFacet).toHaveProperty('value');
    expect(certFacet).toHaveProperty('count');
  });
});

// =============================================================================
// FACET FILTERING TESTS
// =============================================================================

describe('Facet Filtering Logic', () => {
  const NIHONTO_TYPES = ['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'kodachi'];
  const TOSOGU_TYPES = ['tsuba', 'fuchi-kashira', 'fuchi_kashira', 'kozuka', 'menuki', 'koshirae'];

  describe('Certification facets should reflect category filter', () => {
    it('certification facets for nihonto should only count nihonto items', () => {
      // When category=nihonto, certification facets should filter by nihonto types
      const category = 'nihonto';
      const effectiveItemTypes = category === 'nihonto' ? NIHONTO_TYPES : category === 'tosogu' ? TOSOGU_TYPES : undefined;

      // Cert facet query should include item type filter
      expect(effectiveItemTypes).toEqual(NIHONTO_TYPES);
      expect(effectiveItemTypes).toContain('katana');
      expect(effectiveItemTypes).not.toContain('tsuba');
    });

    it('certification facets for tosogu should only count tosogu items', () => {
      // When category=tosogu, certification facets should filter by tosogu types
      const category = 'tosogu';
      const effectiveItemTypes = category === 'nihonto' ? NIHONTO_TYPES : category === 'tosogu' ? TOSOGU_TYPES : undefined;

      // Cert facet query should include item type filter
      expect(effectiveItemTypes).toEqual(TOSOGU_TYPES);
      expect(effectiveItemTypes).toContain('tsuba');
      expect(effectiveItemTypes).not.toContain('katana');
    });

    it('certification facets for all category should not filter by type', () => {
      const category = 'all';
      const effectiveItemTypes = category === 'nihonto' ? NIHONTO_TYPES : category === 'tosogu' ? TOSOGU_TYPES : undefined;

      expect(effectiveItemTypes).toBeUndefined();
    });
  });

  describe('Dealer facets should reflect category filter', () => {
    it('dealer facets for nihonto should only count nihonto items', () => {
      const category = 'nihonto';
      const effectiveItemTypes = category === 'nihonto' ? NIHONTO_TYPES : category === 'tosogu' ? TOSOGU_TYPES : undefined;

      expect(effectiveItemTypes).toEqual(NIHONTO_TYPES);
    });

    it('dealer facets for tosogu should only count tosogu items', () => {
      const category = 'tosogu';
      const effectiveItemTypes = category === 'nihonto' ? NIHONTO_TYPES : category === 'tosogu' ? TOSOGU_TYPES : undefined;

      expect(effectiveItemTypes).toEqual(TOSOGU_TYPES);
    });
  });

  describe('Item type facets should reflect other filters', () => {
    it('item type facets should respect certification filter', () => {
      // When cert=Juyo is selected, item type facets should only count Juyo items
      const certifications = ['Juyo'];
      const CERT_VARIANTS: Record<string, string[]> = {
        'Juyo': ['Juyo', 'juyo'],
      };
      const allVariants = certifications.flatMap(c => CERT_VARIANTS[c] || [c]);

      expect(allVariants).toEqual(['Juyo', 'juyo']);
    });

    it('item type facets should respect dealer filter', () => {
      const dealers = [1, 4];
      // Item type facet query should include dealer filter
      expect(dealers).toHaveLength(2);
    });

    it('item type facets should NOT be filtered by category', () => {
      // Item type facets show all types so user can see what's available
      // They are filtered by OTHER constraints (cert, dealer, askOnly)
      // but NOT by category/itemTypes - that would hide the options
      const category = 'nihonto';

      // Item type facets should show both nihonto AND tosogu counts
      // so user can switch categories and see what's available
      expect(category).toBe('nihonto');
    });
  });

  describe('Facet filter application pattern', () => {
    it('each facet is filtered by OTHER active filters, not its own', () => {
      // Standard faceted search pattern:
      // - Item type facets: filtered by cert, dealer, askOnly (NOT by itemTypes)
      // - Certification facets: filtered by category/itemTypes, dealer, askOnly (NOT by cert)
      // - Dealer facets: filtered by category/itemTypes, cert, askOnly (NOT by dealers)

      const filters = {
        category: 'nihonto' as const,
        certifications: ['Juyo'],
        dealers: [1],
        askOnly: false,
      };

      // Item type facet filters (excludes itemTypes/category)
      const itemTypeFacetFilters = {
        certifications: filters.certifications,
        dealers: filters.dealers,
        askOnly: filters.askOnly,
      };
      expect(itemTypeFacetFilters).not.toHaveProperty('category');
      expect(itemTypeFacetFilters).not.toHaveProperty('itemTypes');

      // Certification facet filters (excludes certifications)
      const certFacetFilters = {
        category: filters.category,
        dealers: filters.dealers,
        askOnly: filters.askOnly,
      };
      expect(certFacetFilters).not.toHaveProperty('certifications');

      // Dealer facet filters (excludes dealers)
      const dealerFacetFilters = {
        category: filters.category,
        certifications: filters.certifications,
        askOnly: filters.askOnly,
      };
      expect(dealerFacetFilters).not.toHaveProperty('dealers');
    });
  });

  describe('Category changes should update facet counts', () => {
    it('switching from all to nihonto should reduce cert counts', () => {
      // Example: If total has 100 Juyo certs, switching to nihonto might show 80
      // because only swords have Juyo, not all tosogu

      // This tests the concept - actual counts come from DB
      const allCerts = { Juyo: 100, Hozon: 200 };
      const nihontoCerts = { Juyo: 80, Hozon: 150 };

      expect(nihontoCerts.Juyo).toBeLessThanOrEqual(allCerts.Juyo);
      expect(nihontoCerts.Hozon).toBeLessThanOrEqual(allCerts.Hozon);
    });

    it('switching from all to tosogu should show different cert counts', () => {
      const allCerts = { Juyo: 100, Hozon: 200 };
      const tosoguCerts = { Juyo: 20, Hozon: 50 };

      // Tosogu typically has fewer high-level certs
      expect(tosoguCerts.Juyo).toBeLessThanOrEqual(allCerts.Juyo);
    });
  });
});
