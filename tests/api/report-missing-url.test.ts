import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for POST /api/admin/report-missing-url
 *
 * Admin-only endpoint that flags a dealer URL as missing from the database
 * by inserting into discovered_urls with high priority.
 */

// Mock Supabase client
const mockSupabaseAuth = {
  getUser: vi.fn(),
};

const mockSupabaseFrom = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseUpsert = vi.fn();

const mockServiceFrom = vi.fn();
const mockServiceSelect = vi.fn();
const mockServiceEq = vi.fn();
const mockServiceUpsert = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: mockSupabaseAuth,
    from: mockSupabaseFrom,
  })),
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

// Helper: create NextRequest with JSON body
function createRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
  } as unknown as import('next/server').NextRequest;
}

function createBadJsonRequest() {
  return {
    json: async () => { throw new Error('invalid json'); },
  } as unknown as import('next/server').NextRequest;
}

// Dynamically import the route after mocks are set up
async function getRouteHandler() {
  const mod = await import('@/app/api/admin/report-missing-url/route');
  return mod.POST;
}

describe('POST /api/admin/report-missing-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated admin user
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-123', email: 'admin@test.com' } },
    });

    // Default: admin profile
    mockSupabaseFrom.mockReturnValue({
      select: mockSupabaseSelect,
    });
    mockSupabaseSelect.mockReturnValue({
      eq: mockSupabaseEq,
    });
    mockSupabaseEq.mockReturnValue({
      single: mockSupabaseSingle,
    });
    mockSupabaseSingle.mockResolvedValue({
      data: { role: 'admin' },
    });

    // Service client: dealer lookup
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'dealers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { id: 1, name: 'Aoi Art', domain: 'aoijapan.com' },
                { id: 2, name: 'Choshuya', domain: 'choshuya.co.jp' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'discovered_urls') {
        return {
          upsert: mockServiceUpsert.mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn(), upsert: vi.fn() };
    });
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const POST = await getRouteHandler();
    const res = await POST(createRequest({ url: 'https://aoijapan.com/item/123' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    mockSupabaseSingle.mockResolvedValue({
      data: { role: 'user' },
    });

    const POST = await getRouteHandler();
    const res = await POST(createRequest({ url: 'https://aoijapan.com/item/123' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing URL', async () => {
    const POST = await getRouteHandler();
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('url is required');
  });

  it('returns 400 for invalid URL format', async () => {
    const POST = await getRouteHandler();
    const res = await POST(createRequest({ url: 'not a url' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid URL format');
  });

  it('returns 400 for invalid JSON body', async () => {
    const POST = await getRouteHandler();
    const res = await POST(createBadJsonRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid JSON body');
  });

  it('returns 400 when dealer cannot be identified from URL', async () => {
    // Override dealer lookup to return no matches for unknown domain
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'dealers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                { id: 1, name: 'Aoi Art', domain: 'aoijapan.com' },
              ],
              error: null,
            }),
          }),
        };
      }
      return { upsert: vi.fn() };
    });

    const POST = await getRouteHandler();
    const res = await POST(createRequest({ url: 'https://unknowndealer.com/item/1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Could not identify dealer');
  });

  it('succeeds for valid dealer URL and returns dealer name', async () => {
    const POST = await getRouteHandler();
    const res = await POST(createRequest({ url: 'https://aoijapan.com/items/katana-123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dealer_name).toBe('Aoi Art');
    expect(body.url).toBe('https://aoijapan.com/items/katana-123');
  });

  it('handles URL without protocol', async () => {
    const POST = await getRouteHandler();
    const res = await POST(createRequest({ url: 'aoijapan.com/items/katana-123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.url).toBe('https://aoijapan.com/items/katana-123');
  });

  it('calls upsert on discovered_urls with high priority', async () => {
    const POST = await getRouteHandler();
    await POST(createRequest({ url: 'https://aoijapan.com/items/katana-123' }));

    expect(mockServiceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://aoijapan.com/items/katana-123',
        dealer_id: 1,
        is_scraped: false,
        scrape_priority: 10,
      }),
      { onConflict: 'url' }
    );
  });
});
