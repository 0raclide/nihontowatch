/**
 * Tests for POST /api/collection/items/reorder
 *
 * Tests batch sort_order updates:
 * - Auth required
 * - Validates input shape
 * - Verifies ownership
 * - Batch updates sort_order
 * - Enforces max 500 items limit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ───────────────────────────────────────────────
const {
  mockSelect, mockUpdate, mockEq, mockIn, mockFrom,
  mockGetUser, mockCollectionItemsFrom,
} = vi.hoisted(() => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockIn = vi.fn().mockReturnThis();

  const chainValue = {
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    in: mockIn,
  };

  for (const fn of [mockSelect, mockUpdate, mockEq, mockIn]) {
    fn.mockReturnValue(chainValue);
  }

  const mockFrom = vi.fn(() => chainValue);
  const mockGetUser = vi.fn();
  const mockCollectionItemsFrom = vi.fn(() => chainValue);

  return {
    mockSelect, mockUpdate, mockEq, mockIn, mockFrom,
    mockGetUser, mockCollectionItemsFrom,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/supabase/collectionItems', () => ({
  collectionItemsFrom: mockCollectionItemsFrom,
}));

vi.mock('@/lib/collection/access', () => ({
  checkCollectionAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), logError: vi.fn() },
}));

// ─── Import route after mocks ───────────────────────────────────
import { POST } from '@/app/api/collection/items/reorder/route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/collection/items/reorder', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const TEST_USER = { id: 'user-123', email: 'test@test.com' };

describe('POST /api/collection/items/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER }, error: null });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } });
    const res = await POST(makeRequest({ items: [{ id: '1', sort_order: 1 }] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when items array is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('items array is required');
  });

  it('returns 400 when items array is empty', async () => {
    const res = await POST(makeRequest({ items: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when items exceed 500 limit', async () => {
    const bigArray = Array.from({ length: 501 }, (_, i) => ({ id: `id-${i}`, sort_order: i }));
    const res = await POST(makeRequest({ items: bigArray }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Maximum 500');
  });

  it('returns 400 when item shape is invalid (missing sort_order)', async () => {
    const res = await POST(makeRequest({ items: [{ id: 'abc' }] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sort_order');
  });

  it('returns 403 when items do not belong to user', async () => {
    // Ownership check returns empty — no items match
    mockCollectionItemsFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const res = await POST(makeRequest({ items: [{ id: 'foreign-id', sort_order: 1 }] }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('do not belong to you');
  });

  it('successfully updates sort_order for owned items', async () => {
    const items = [
      { id: 'item-a', sort_order: 1 },
      { id: 'item-b', sort_order: 2 },
    ];

    // First call = ownership check (returns owned ids)
    // Subsequent calls = batch updates
    let callCount = 0;
    mockCollectionItemsFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Ownership verification
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'item-a' }, { id: 'item-b' }],
                error: null,
              }),
            }),
          }),
        };
      }
      // Batch updates
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    });

    const res = await POST(makeRequest({ items }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(2);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/collection/items/reorder', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
