/**
 * Inquiry Generation API Unit Tests
 *
 * Tests the /api/inquiry/generate endpoint's logic by mocking Supabase and OpenRouter.
 * Verifies that:
 * - Authentication is required
 * - Input validation works correctly
 * - Listing and dealer data is fetched properly
 * - OpenRouter API is called with correct prompts
 * - Generated emails are returned correctly
 * - Error handling works gracefully
 *
 * Uses vitest with mocking - no live server required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS SETUP
// =============================================================================

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
  insertCalls: Array<{ data: Record<string, unknown> }>;
  eqCalls: Array<{ column: string; value: unknown }>;
  fromCalls: Array<{ table: string }>;
}

let supabaseTracker: SupabaseTracker;
let mockListingData: Record<string, unknown> | null = null;
let mockAuthUser: { id: string; email: string } | null = null;
let mockInsertError: Error | null = null;

// Create mock query builder for Supabase
function createMockQueryBuilder(tableName: string) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  builder.select = vi.fn((columns: string) => {
    supabaseTracker.selectCalls.push({ columns });
    return builder;
  });

  builder.insert = vi.fn((data: Record<string, unknown>) => {
    supabaseTracker.insertCalls.push({ data });
    return Promise.resolve({
      data: null,
      error: mockInsertError,
    });
  });

  builder.eq = vi.fn((column: string, value: unknown) => {
    supabaseTracker.eqCalls.push({ column, value });
    return builder;
  });

  builder.single = vi.fn(() => {
    if (tableName === 'listings') {
      return Promise.resolve({
        data: mockListingData,
        error: mockListingData ? null : { message: 'Not found' },
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  // For non-blocking insert (fire and forget)
  builder.then = vi.fn((resolve: (value: unknown) => void) => {
    resolve({ data: null, error: mockInsertError });
    return builder;
  });

  builder.catch = vi.fn(() => builder);

  return builder;
}

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn((table: string) => {
    supabaseTracker.fromCalls.push({ table });
    return createMockQueryBuilder(table);
  }),
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: mockAuthUser },
        error: mockAuthUser ? null : { message: 'Not authenticated' },
      })
    ),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
  createServiceClient: vi.fn(() => mockSupabaseClient),
}));

// Mock fetch for OpenRouter API calls
const originalFetch = global.fetch;
let mockFetchResponse: Response | null = null;
let fetchCalls: Array<{ url: string; options: RequestInit }> = [];

// Helper to create mock NextRequest
function createMockRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/inquiry/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Valid generated email response from OpenRouter
const VALID_AI_RESPONSE = {
  subject_ja: '【お問い合わせ】備前長船祐定 刀について',
  subject_en: 'Inquiry: Bizen Osafune Sukesada Katana',
  email_ja: `拝啓

新春の候、貴社ますますご清栄のこととお慶び申し上げます。

突然のご連絡失礼いたします。
アメリカ在住のJohn Smithと申します。

貴店のウェブサイトで拝見いたしました備前長船祐定の刀について、購入を検討しております。

お忙しいところ恐れ入りますが、ご回答いただけますと幸いです。

何卒よろしくお願い申し上げます。

敬具

John Smith
United States`,
  email_en: `Dear Sir/Madam,

In this season of the new year, I hope your business continues to prosper.

I apologize for this sudden contact.
My name is John Smith, residing in the United States.

I am interested in purchasing the Bizen Osafune Sukesada katana that I saw on your website.

I apologize for the inconvenience, but I would be grateful if you could reply.

Thank you very much for your consideration.

Respectfully,

John Smith
United States`,
};

// Valid test input matching current API schema
const VALID_INPUT = {
  listingId: 123,
  buyerName: 'John Smith',
  buyerCountry: 'United States',
  message: 'I am interested in purchasing this sword. Can you tell me more about its condition?',
};

// Reset all mocks before each test
beforeEach(() => {
  supabaseTracker = {
    selectCalls: [],
    insertCalls: [],
    eqCalls: [],
    fromCalls: [],
  };
  mockListingData = null;
  mockAuthUser = null;
  mockInsertError = null;
  fetchCalls = [];
  mockFetchResponse = null;

  vi.clearAllMocks();

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
          content: JSON.stringify(VALID_AI_RESPONSE),
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
  vi.unstubAllEnvs();
});

// Import the route handler after mocks are set up
import { POST } from '@/app/api/inquiry/generate/route';

// =============================================================================
// AUTHENTICATION TESTS
// =============================================================================

describe('Inquiry API - Authentication', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuthUser = null;

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Authentication required');
  });

  it('proceeds when authenticated', async () => {
    mockAuthUser = { id: 'user-123', email: 'test@example.com' };
    mockListingData = {
      id: 123,
      title: 'Test Katana',
      url: 'https://example.com/listing/123',
      price_value: 1000000,
      price_currency: 'JPY',
      item_type: 'katana',
      cert_type: null,
      smith: null,
      tosogu_maker: null,
      school: null,
      tosogu_school: null,
      era: null,
      dealers: {
        id: 1,
        name: 'Test Dealer',
        domain: 'test-dealer.com',
        contact_email: 'info@test-dealer.com',
        ships_international: true,
        accepts_wire_transfer: true,
        accepts_paypal: false,
        accepts_credit_card: false,
        requires_deposit: true,
        deposit_percentage: 30,
        english_support: false,
      },
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    expect(response.status).toBe(200);
  });
});

// =============================================================================
// INPUT VALIDATION TESTS
// =============================================================================

describe('Inquiry API - Input Validation', () => {
  beforeEach(() => {
    mockAuthUser = { id: 'user-123', email: 'test@example.com' };
  });

  it('returns 400 for missing listingId', async () => {
    const request = createMockRequest({
      buyerName: 'John Smith',
      buyerCountry: 'United States',
      message: 'I am interested in this sword.',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('listingId');
  });

  it('returns 400 for invalid listingId type', async () => {
    const request = createMockRequest({
      listingId: 'not-a-number',
      buyerName: 'John Smith',
      buyerCountry: 'United States',
      message: 'I am interested in this sword.',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('listingId');
  });

  it('returns 400 for missing message', async () => {
    const request = createMockRequest({
      listingId: 123,
      buyerName: 'John Smith',
      buyerCountry: 'United States',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('message');
  });

  it('returns 400 for empty message', async () => {
    const request = createMockRequest({
      listingId: 123,
      buyerName: 'John Smith',
      buyerCountry: 'United States',
      message: '   ',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('message');
  });

  it('returns 400 for missing buyerName', async () => {
    const request = createMockRequest({
      listingId: 123,
      buyerCountry: 'United States',
      message: 'I am interested in this sword.',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('buyerName');
  });

  it('returns 400 for empty buyerName', async () => {
    const request = createMockRequest({
      listingId: 123,
      buyerName: '   ',
      buyerCountry: 'United States',
      message: 'I am interested in this sword.',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('buyerName');
  });

  it('returns 400 for missing buyerCountry', async () => {
    const request = createMockRequest({
      listingId: 123,
      buyerName: 'John Smith',
      message: 'I am interested in this sword.',
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('buyerCountry');
  });

  it('accepts valid input with all required fields', async () => {
    mockListingData = {
      id: 123,
      title: 'Test',
      url: 'https://test.com',
      price_value: null,
      price_currency: null,
      item_type: 'katana',
      cert_type: null,
      smith: null,
      tosogu_maker: null,
      school: null,
      tosogu_school: null,
      era: null,
      dealers: {
        id: 1,
        name: 'Test',
        domain: 'test.com',
        contact_email: null,
        ships_international: null,
        accepts_wire_transfer: null,
        accepts_paypal: null,
        accepts_credit_card: null,
        requires_deposit: null,
        deposit_percentage: null,
        english_support: null,
      },
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    expect(response.status).toBe(200);
  });
});

// =============================================================================
// LISTING LOOKUP TESTS
// =============================================================================

describe('Inquiry API - Listing Lookup', () => {
  beforeEach(() => {
    mockAuthUser = { id: 'user-123', email: 'test@example.com' };
  });

  it('returns 404 for non-existent listing', async () => {
    mockListingData = null;

    const request = createMockRequest({
      ...VALID_INPUT,
      listingId: 999999,
    });
    const response = await POST(request as never);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('Listing not found');
  });

  it('fetches listing with dealer information', async () => {
    mockListingData = {
      id: 123,
      title: 'Test Katana',
      url: 'https://example.com/listing/123',
      price_value: 1000000,
      price_currency: 'JPY',
      item_type: 'katana',
      cert_type: 'Juyo',
      smith: 'Sukesada',
      tosogu_maker: null,
      school: 'Bizen',
      tosogu_school: null,
      era: 'Muromachi',
      dealers: {
        id: 1,
        name: 'Aoi Art',
        domain: 'aoijapan.com',
        contact_email: 'info@aoijapan.com',
        ships_international: true,
        accepts_wire_transfer: true,
        accepts_paypal: true,
        accepts_credit_card: false,
        requires_deposit: true,
        deposit_percentage: 30,
        english_support: true,
      },
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    await POST(request as never);

    // Should have queried listings table
    expect(supabaseTracker.fromCalls.some(c => c.table === 'listings')).toBe(true);

    // Should have included dealer join in select
    const selectCall = supabaseTracker.selectCalls[0];
    expect(selectCall.columns).toContain('dealers');
  });
});

// =============================================================================
// OPENROUTER API TESTS
// =============================================================================

describe('Inquiry API - OpenRouter Integration', () => {
  beforeEach(() => {
    mockAuthUser = { id: 'user-123', email: 'test@example.com' };
    mockListingData = {
      id: 123,
      title: '備前長船祐定 刀',
      url: 'https://example.com/listing/123',
      price_value: 2500000,
      price_currency: 'JPY',
      item_type: 'katana',
      cert_type: 'Juyo',
      smith: '祐定',
      tosogu_maker: null,
      school: '備前',
      tosogu_school: null,
      era: '室町',
      dealers: {
        id: 1,
        name: 'Aoi Art',
        domain: 'aoijapan.com',
        contact_email: 'info@aoijapan.com',
        ships_international: true,
        accepts_wire_transfer: true,
        accepts_paypal: true,
        accepts_credit_card: false,
        requires_deposit: true,
        deposit_percentage: 30,
        english_support: true,
      },
    };
  });

  it('returns error when OPENROUTER_API_KEY is not configured', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain('API key');
  });

  it('calls OpenRouter with correct model', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    expect(openRouterCall).toBeDefined();

    const body = JSON.parse(openRouterCall!.options.body as string);
    expect(body.model).toBeDefined();
  });

  it('includes item details in prompt', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user');

    expect(userMessage.content).toContain('備前長船祐定');
    expect(userMessage.content).toContain('Juyo');
    expect(userMessage.content).toContain('2,500,000');
  });

  it('includes buyer information in prompt', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user');

    expect(userMessage.content).toContain('John Smith');
    expect(userMessage.content).toContain('United States');
  });

  it('includes message in prompt', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({
      ...VALID_INPUT,
      message: 'Is there any active rust? Has it been recently polished?',
    });
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user');

    expect(userMessage.content).toContain('active rust');
    expect(userMessage.content).toContain('recently polished');
  });

  it('includes dealer policies in prompt when available', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user');

    expect(userMessage.content).toContain('Ships internationally');
    expect(userMessage.content).toContain('deposit');
  });

  it('handles OpenRouter API failure gracefully', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    mockFetchResponse = new Response('Internal Server Error', {
      status: 500,
    });

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('handles malformed AI response gracefully', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    mockFetchResponse = new Response(JSON.stringify({
      choices: [{
        message: {
          content: 'This is not valid JSON',
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });
});

// =============================================================================
// RESPONSE FORMAT TESTS
// =============================================================================

describe('Inquiry API - Response Format', () => {
  beforeEach(() => {
    mockAuthUser = { id: 'user-123', email: 'test@example.com' };
    mockListingData = {
      id: 123,
      title: 'Test Katana',
      url: 'https://example.com/listing/123',
      price_value: 1000000,
      price_currency: 'JPY',
      item_type: 'katana',
      cert_type: null,
      smith: null,
      tosogu_maker: null,
      school: null,
      tosogu_school: null,
      era: null,
      dealers: {
        id: 1,
        name: 'Test Dealer',
        domain: 'test-dealer.com',
        contact_email: 'info@test-dealer.com',
        ships_international: true,
        accepts_wire_transfer: true,
        accepts_paypal: false,
        accepts_credit_card: false,
        requires_deposit: true,
        deposit_percentage: 30,
        english_support: false,
      },
    };
  });

  it('returns complete email data structure', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    const json = await response.json();

    // Check all required fields
    expect(json.email_ja).toBeDefined();
    expect(json.email_en).toBeDefined();
    expect(json.subject_ja).toBeDefined();
    expect(json.subject_en).toBeDefined();
    expect(json.dealer_email).toBeDefined();
    expect(json.dealer_name).toBeDefined();
    expect(json.dealer_domain).toBeDefined();
  });

  it('includes dealer email when available', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    const json = await response.json();
    expect(json.dealer_email).toBe('info@test-dealer.com');
    expect(json.dealer_name).toBe('Test Dealer');
    expect(json.dealer_domain).toBe('test-dealer.com');
  });

  it('returns null for dealer_email when not available', async () => {
    mockListingData = {
      ...mockListingData,
      dealers: {
        ...(mockListingData as Record<string, unknown>).dealers as Record<string, unknown>,
        contact_email: null,
      },
    };

    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    const json = await response.json();
    expect(json.dealer_email).toBeNull();
  });

  it('includes dealer policies in response', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    const json = await response.json();
    expect(json.dealer_policies).toBeDefined();
    expect(json.dealer_policies.ships_international).toBe(true);
    expect(json.dealer_policies.requires_deposit).toBe(true);
    expect(json.dealer_policies.deposit_percentage).toBe(30);
  });
});

// =============================================================================
// INQUIRY HISTORY TRACKING TESTS
// =============================================================================

describe('Inquiry API - History Tracking', () => {
  beforeEach(() => {
    mockAuthUser = { id: 'user-123', email: 'test@example.com' };
    mockListingData = {
      id: 123,
      title: 'Test Katana',
      url: 'https://example.com/listing/123',
      price_value: 1000000,
      price_currency: 'JPY',
      item_type: 'katana',
      cert_type: null,
      smith: null,
      tosogu_maker: null,
      school: null,
      tosogu_school: null,
      era: null,
      dealers: {
        id: 1,
        name: 'Test Dealer',
        domain: 'test-dealer.com',
        contact_email: null,
        ships_international: null,
        accepts_wire_transfer: null,
        accepts_paypal: null,
        accepts_credit_card: null,
        requires_deposit: null,
        deposit_percentage: null,
        english_support: null,
      },
    };
  });

  it('logs inquiry to history table', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    await POST(request as never);

    // Should have attempted to insert into inquiry_history
    // Note: Uses type assertion 'inquiry_history' as 'dealers' due to missing types
    const historyInsert = supabaseTracker.fromCalls.find(c => c.table === 'inquiry_history');
    expect(historyInsert).toBeDefined();
  });

  it('includes correct data in history record', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest({
      ...VALID_INPUT,
      buyerCountry: 'Germany',
    });
    await POST(request as never);

    // Check insert was called with correct data
    const insertCall = supabaseTracker.insertCalls.find(c =>
      c.data && 'user_id' in c.data
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.data.intent).toBe('other'); // Default intent since form is freeform
    expect(insertCall?.data.user_id).toBe('user-123');
    expect(insertCall?.data.listing_id).toBe(123);
    expect(insertCall?.data.dealer_id).toBe(1);
    expect(insertCall?.data.buyer_country).toBe('Germany');
  });

  it('still returns success even if history logging fails', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');
    mockInsertError = new Error('Database insert failed');

    const request = createMockRequest(VALID_INPUT);
    const response = await POST(request as never);

    // Should still return 200 - history logging is non-blocking
    expect(response.status).toBe(200);
  });
});

// =============================================================================
// SEASONAL GREETING TESTS
// =============================================================================

describe('Inquiry API - Seasonal Greetings', () => {
  beforeEach(() => {
    mockAuthUser = { id: 'user-123', email: 'test@example.com' };
    mockListingData = {
      id: 123,
      title: 'Test',
      url: 'https://test.com',
      price_value: null,
      price_currency: null,
      item_type: 'katana',
      cert_type: null,
      smith: null,
      tosogu_maker: null,
      school: null,
      tosogu_school: null,
      era: null,
      dealers: {
        id: 1,
        name: 'Test',
        domain: 'test.com',
        contact_email: null,
        ships_international: null,
        accepts_wire_transfer: null,
        accepts_paypal: null,
        accepts_credit_card: null,
        requires_deposit: null,
        deposit_percentage: null,
        english_support: null,
      },
    };
  });

  it('includes seasonal context in prompt', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');

    const request = createMockRequest(VALID_INPUT);
    await POST(request as never);

    const openRouterCall = fetchCalls.find(c => c.url.includes('openrouter'));
    const body = JSON.parse(openRouterCall!.options.body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === 'user');

    // Should include seasonal context
    expect(userMessage.content).toMatch(/season|候/);
  });
});
