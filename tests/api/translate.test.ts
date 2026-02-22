/**
 * Translate API Unit Tests
 *
 * Tests the /api/translate endpoint's logic by mocking Supabase and OpenRouter.
 * Verifies that:
 * - Service client is used (not anon client) for database updates
 * - Cached translations are returned without calling OpenRouter
 * - New translations are fetched and cached properly
 * - Error handling works correctly
 * - Edge cases are handled (no Japanese, empty content, etc.)
 * - Bidirectional translation: JP→EN and EN→JP
 *
 * Uses vitest with mocking - no live server required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// Track Supabase operations
interface SupabaseTracker {
  selectCalls: Array<{ columns: string }>;
  updateCalls: Array<{ data: Record<string, unknown> }>;
  eqCalls: Array<{ column: string; value: unknown }>;
}

let supabaseTracker: SupabaseTracker;
let mockListingData: Record<string, unknown> | null = null;
let mockUpdateError: Error | null = null;

// Create mock query builder for Supabase
function createMockQueryBuilder() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  builder.select = vi.fn((columns: string) => {
    supabaseTracker.selectCalls.push({ columns });
    return builder;
  });

  builder.update = vi.fn((data: Record<string, unknown>) => {
    supabaseTracker.updateCalls.push({ data });
    return builder;
  });

  builder.eq = vi.fn((column: string, value: unknown) => {
    supabaseTracker.eqCalls.push({ column, value });
    // Return result based on whether this is a select or update
    if (supabaseTracker.updateCalls.length > 0) {
      // This is an update operation
      return Promise.resolve({
        data: null,
        error: mockUpdateError,
      });
    }
    // This is a select operation - return single() chainable
    return builder;
  });

  builder.single = vi.fn(() => {
    return Promise.resolve({
      data: mockListingData,
      error: mockListingData ? null : { message: 'Not found' },
    });
  });

  return builder;
}

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

// Track which client was used
let usedServiceClient = false;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => {
    usedServiceClient = false;
    return Promise.resolve(mockSupabaseClient);
  }),
  createServiceClient: vi.fn(() => {
    usedServiceClient = true;
    return mockSupabaseClient;
  }),
}));

// Mock fetch for OpenRouter API calls
const originalFetch = global.fetch;
let mockFetchResponse: Response | null = null;
let fetchCalls: Array<{ url: string; options: RequestInit }> = [];

// Helper to create mock NextRequest
function createMockRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Reset all mocks before each test
beforeEach(() => {
  supabaseTracker = {
    selectCalls: [],
    updateCalls: [],
    eqCalls: [],
  };
  mockListingData = null;
  mockUpdateError = null;
  usedServiceClient = false;
  fetchCalls = [];
  mockFetchResponse = null;

  vi.clearAllMocks();

  // Reset rate limiter state between tests
  _resetRateLimitForTesting();

  // Set up default Supabase mock
  mockSupabaseClient.from.mockImplementation(() => createMockQueryBuilder());

  // Mock global fetch
  global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    fetchCalls.push({ url: urlStr, options: options || {} });

    if (mockFetchResponse) {
      return mockFetchResponse;
    }

    // Default mock response for OpenRouter
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: 'Translated text from OpenRouter',
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

// Import the route handler after mocks are set up
import { POST, _resetRateLimitForTesting } from '@/app/api/translate/route';

// =============================================================================
// SERVICE CLIENT USAGE TESTS
// =============================================================================

describe('Translate API - Service Client Usage', () => {
  it('uses createServiceClient instead of createClient', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀 katana',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    // Set up environment variable
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    expect(usedServiceClient).toBe(true);
  });
});

// =============================================================================
// INPUT VALIDATION TESTS
// =============================================================================

describe('Translate API - Input Validation', () => {
  it('returns 400 for missing listingId', async () => {
    const request = createMockRequest({});
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid listingId');
  });

  it('returns 400 for non-numeric listingId', async () => {
    const request = createMockRequest({ listingId: 'not-a-number' });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid listingId');
  });

  it('returns 400 for invalid type parameter', async () => {
    const request = createMockRequest({ listingId: 123, type: 'invalid' });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid type. Must be "description" or "title"');
  });

  it('accepts valid type "title"', async () => {
    mockListingData = {
      id: 123,
      title: 'English title only',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
  });

  it('accepts valid type "description"', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: 'English description only',
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'description' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
  });

  it('defaults to description when type is not specified', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123 });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.reason).toBe('no_description');
  });
});

// =============================================================================
// LISTING LOOKUP TESTS
// =============================================================================

describe('Translate API - Listing Lookup', () => {
  it('returns 404 for non-existent listing', async () => {
    mockListingData = null;

    const request = createMockRequest({ listingId: 999999 });
    const response = await POST(request as never);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Listing not found');
  });

  it('queries correct fields from listings table', async () => {
    mockListingData = {
      id: 123,
      title: 'Test',
      title_en: 'Test',
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    expect(supabaseTracker.selectCalls.length).toBeGreaterThan(0);
    const selectCall = supabaseTracker.selectCalls[0];
    expect(selectCall.columns).toContain('title');
    expect(selectCall.columns).toContain('title_en');
    expect(selectCall.columns).toContain('title_ja');
    expect(selectCall.columns).toContain('description');
    expect(selectCall.columns).toContain('description_en');
    expect(selectCall.columns).toContain('description_ja');
    expect(selectCall.columns).toContain('item_type');
  });
});

// =============================================================================
// CACHING TESTS (JP→EN)
// =============================================================================

describe('Translate API - Caching Behavior (JP→EN)', () => {
  it('returns cached title_en without calling OpenRouter', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: 'Cached Japanese Sword',
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('Cached Japanese Sword');
    expect(json.cached).toBe(true);

    // Should NOT have called OpenRouter
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(0);
  });

  it('returns cached description_en without calling OpenRouter', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: '日本刀の説明',
      description_en: 'Cached sword description',
      description_ja: null,
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123, type: 'description' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('Cached sword description');
    expect(json.cached).toBe(true);

    // Should NOT have called OpenRouter
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(0);
  });

  it('stores new JP→EN translation in database after OpenRouter call', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.cached).toBe(false);

    // Should have called OpenRouter
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(1);

    // Should have attempted to update the database with title_en
    expect(supabaseTracker.updateCalls.length).toBe(1);
    expect(supabaseTracker.updateCalls[0].data).toHaveProperty('title_en');
  });
});

// =============================================================================
// EN→JP TRANSLATION TESTS (Bidirectional)
// =============================================================================

describe('Translate API - EN→JP Translation', () => {
  it('translates English-only title to Japanese via OpenRouter', async () => {
    mockListingData = {
      id: 123,
      title: 'Antique Katana Blade',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('Translated text from OpenRouter');
    expect(json.cached).toBe(false);

    // Should have called OpenRouter (EN→JP direction)
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(1);

    // Should cache to title_ja column
    expect(supabaseTracker.updateCalls.length).toBe(1);
    expect(supabaseTracker.updateCalls[0].data).toHaveProperty('title_ja');
  });

  it('translates English-only description to Japanese via OpenRouter', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: 'A fine katana blade by Masamune with excellent hamon.',
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'description' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('Translated text from OpenRouter');
    expect(json.cached).toBe(false);

    // Should cache to description_ja column
    expect(supabaseTracker.updateCalls.length).toBe(1);
    expect(supabaseTracker.updateCalls[0].data).toHaveProperty('description_ja');
  });

  it('returns cached title_ja without calling OpenRouter', async () => {
    mockListingData = {
      id: 123,
      title: 'Antique Katana Blade',
      title_en: null,
      title_ja: '骨董刀身',
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('骨董刀身');
    expect(json.cached).toBe(true);

    // Should NOT have called OpenRouter
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(0);
  });

  it('returns cached description_ja without calling OpenRouter', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: 'Fine katana blade.',
      description_en: null,
      description_ja: '素晴らしい刀身。',
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123, type: 'description' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('素晴らしい刀身。');
    expect(json.cached).toBe(true);

    // Should NOT have called OpenRouter
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(0);
  });

  it('sends EN→JP prompt for English title', async () => {
    mockListingData = {
      id: 123,
      title: 'Katana by Masamune - Mumei',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    expect(openRouterCall).toBeDefined();

    const body = JSON.parse(openRouterCall!.options.body as string);
    // EN→JP prompt should mention translating to Japanese
    expect(body.messages[0].content).toContain('to natural Japanese');
    expect(body.messages[0].content).toContain('kanji');
  });

  it('sends EN→JP prompt for English description', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: 'A beautiful katana blade with fine temper.',
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'description' });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    expect(openRouterCall).toBeDefined();

    const body = JSON.parse(openRouterCall!.options.body as string);
    // EN→JP description prompt should mention Japanese dealer style
    expect(body.messages[0].content).toContain('to natural Japanese');
    expect(body.messages[0].content).toContain('銘');
  });
});

// =============================================================================
// EMPTY CONTENT TESTS
// =============================================================================

describe('Translate API - Empty Content', () => {
  it('returns null for missing title', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: 'Some description',
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBeNull();
    expect(json.cached).toBe(true);
    expect(json.reason).toBe('no_title');
  });

  it('returns null for missing description', async () => {
    mockListingData = {
      id: 123,
      title: 'Some title',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    const request = createMockRequest({ listingId: 123, type: 'description' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBeNull();
    expect(json.cached).toBe(true);
    expect(json.reason).toBe('no_description');
  });
});

// =============================================================================
// OPENROUTER API TESTS
// =============================================================================

describe('Translate API - OpenRouter Integration', () => {
  it('returns original text when OPENROUTER_API_KEY is not configured', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    // Ensure no API key
    vi.stubEnv('OPENROUTER_API_KEY', '');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('日本刀');
    expect(json.error).toBe('Translation service unavailable');
  });

  it('handles OpenRouter API failure gracefully', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    // Mock API failure
    mockFetchResponse = new Response('Internal Server Error', {
      status: 500,
    });

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('日本刀'); // Returns original on failure
    expect(json.error).toBe('Translation failed');
  });

  it('handles empty translation response', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    // Mock empty response
    mockFetchResponse = new Response(JSON.stringify({
      choices: [{
        message: {
          content: '',
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('日本刀'); // Returns original on empty
    expect(json.error).toBe('Empty translation');
  });

  it('sends correct JP→EN prompt for sword items', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    expect(openRouterCall).toBeDefined();

    const body = JSON.parse(openRouterCall!.options.body as string);
    expect(body.messages[0].content).toContain('Japanese sword');
    expect(body.messages[0].content).toContain('nihonto');
    // JP→EN prompt should mention translating to English
    expect(body.messages[0].content).toContain('to English');
  });

  it('sends correct JP→EN prompt for tosogu items', async () => {
    mockListingData = {
      id: 123,
      title: '鍔',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'tsuba',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    expect(openRouterCall).toBeDefined();

    const body = JSON.parse(openRouterCall!.options.body as string);
    expect(body.messages[0].content).toContain('sword fitting');
    expect(body.messages[0].content).toContain('tosogu');
  });

  it('uses lower max_tokens for title translation', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    expect(body.max_tokens).toBe(200);
  });

  it('uses higher max_tokens for description translation', async () => {
    mockListingData = {
      id: 123,
      title: null,
      title_en: null,
      title_ja: null,
      description: '日本刀の説明文',
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'description' });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    expect(body.max_tokens).toBe(2000);
  });

  it('uses gemini-3-flash-preview model', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    expect(body.model).toBe('google/gemini-3-flash-preview');
  });
});

// =============================================================================
// DATABASE UPDATE ERROR HANDLING
// =============================================================================

describe('Translate API - Database Update Errors', () => {
  it('still returns translation even if caching fails', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };
    mockUpdateError = new Error('Database update failed');

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    // Should still return 200 with the translation
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.translation).toBe('Translated text from OpenRouter');
    expect(json.cached).toBe(false);
  });
});

// =============================================================================
// JAPANESE CHARACTER DETECTION TESTS
// =============================================================================

describe('Translate API - Japanese Character Detection', () => {
  it('detects hiragana characters', async () => {
    mockListingData = {
      id: 123,
      title: 'かたな',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    // Should have called OpenRouter (Japanese detected → JP→EN)
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(1);
  });

  it('detects katakana characters', async () => {
    mockListingData = {
      id: 123,
      title: 'カタナ',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    // Should have called OpenRouter (Japanese detected → JP→EN)
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(1);
  });

  it('detects kanji characters', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    // Should have called OpenRouter (Japanese detected → JP→EN)
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(1);
  });

  it('detects mixed Japanese and English', async () => {
    mockListingData = {
      id: 123,
      title: 'Katana 日本刀 Blade',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    await POST(request as never);

    // Should have called OpenRouter (Japanese detected → JP→EN)
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(1);
  });

  it('English-only text triggers EN→JP translation (not no_japanese)', async () => {
    mockListingData = {
      id: 123,
      title: 'Katana by Masamune',
      title_en: null,
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({ listingId: 123, type: 'title' });
    const response = await POST(request as never);

    const json = await response.json();
    // Should NOT return 'no_japanese' — now triggers EN→JP translation
    expect(json.reason).toBeUndefined();
    expect(json.cached).toBe(false);

    // Should have called OpenRouter for EN→JP
    const openRouterCalls = fetchCalls.filter(c => c.url.includes('openrouter'));
    expect(openRouterCalls.length).toBe(1);
  });
});

// =============================================================================
// RATE LIMITING TESTS
// =============================================================================

describe('Translate API - Rate Limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockListingData = {
      id: 123,
      title: '日本刀',
      title_en: 'Cached',
      title_ja: null,
      description: null,
      description_en: null,
      description_ja: null,
      item_type: 'katana',
    };

    // Send 11 requests from the same IP (limit is 10/min)
    // Use x-forwarded-for to set a consistent test IP
    const responses: Response[] = [];
    for (let i = 0; i < 11; i++) {
      const request = new Request('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify({ listingId: 123, type: 'title' }),
      });
      responses.push(await POST(request as never));
    }

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).toBe(200);
    }

    // 11th should be rate limited
    expect(responses[10].status).toBe(429);
    const json = await responses[10].json();
    expect(json.code).toBe('RATE_LIMITED');
  });
});

// =============================================================================
// TOSOGU ITEM TYPE DETECTION
// =============================================================================

describe('Translate API - Tosogu Detection', () => {
  const tosoguTypes = ['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira'];

  tosoguTypes.forEach(itemType => {
    it(`detects ${itemType} as tosogu`, async () => {
      mockListingData = {
        id: 123,
        title: '鍔',
        title_en: null,
        title_ja: null,
        description: null,
        description_en: null,
        description_ja: null,
        item_type: itemType,
      };

      vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

      const request = createMockRequest({ listingId: 123, type: 'title' });
      await POST(request as never);

      const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
      const body = JSON.parse(openRouterCall!.options.body as string);
      expect(body.messages[0].content).toContain('tosogu');
    });
  });
});
