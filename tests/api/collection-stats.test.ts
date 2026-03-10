/**
 * Tests for /api/collection/stats (Phase 6c)
 *
 * Tests the collection stats aggregation:
 * - Auth check
 * - Visibility breakdown
 * - Type/cert distribution
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockCollectionItemsFrom } = vi.hoisted(() => {
  const mockGetUser = vi.fn();

  // Mock a chainable query builder that resolves to mock data
  const mockCollectionItemsFrom = vi.fn();

  return { mockGetUser, mockCollectionItemsFrom };
});

// Track calls to serviceClient.from()
let serviceFromCalls: Array<{ table: string; selectArgs: any; eqCalls: Array<{ col: string; val: any }> }> = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
  createServiceClient: vi.fn().mockReturnValue({
    from: vi.fn((table: string) => {
      const record: any = { table, selectArgs: null, eqCalls: [] };
      serviceFromCalls.push(record);
      const chain = {
        select: vi.fn((...args: any[]) => {
          record.selectArgs = args;
          return chain;
        }),
        eq: vi.fn((col: string, val: any) => {
          record.eqCalls.push({ col, val });
          // Return a resolved count for listings queries
          if (table === 'listings' && record.eqCalls.length >= 2) {
            return Promise.resolve({ count: 0 });
          }
          return chain;
        }),
      };
      return chain;
    }),
  }),
}));

vi.mock('@/lib/collection/access', () => ({
  checkCollectionAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/supabase/collectionItems', () => ({
  collectionItemsFrom: (...args: any[]) => mockCollectionItemsFrom(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
  },
}));

const mockUser = { id: 'user-123', email: 'test@example.com' };

import { GET } from '@/app/api/collection/stats/route';

beforeEach(() => {
  vi.clearAllMocks();
  serviceFromCalls = [];
  mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
});

function mockCollectionItems(items: Array<{ visibility: string; item_type: string | null; cert_type: string | null }>) {
  // Mock the chainable collection items query
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: items, error: null }),
  };
  mockCollectionItemsFrom.mockReturnValueOnce(chain);
}

describe('GET /api/collection/stats', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('computes visibility breakdown correctly', async () => {
    mockCollectionItems([
      { visibility: 'private', item_type: 'KATANA', cert_type: 'juyo' },
      { visibility: 'private', item_type: 'KATANA', cert_type: 'hozon' },
      { visibility: 'collectors', item_type: 'TSUBA', cert_type: 'hozon' },
      { visibility: 'dealers', item_type: 'WAKIZASHI', cert_type: null },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.total_items).toBe(4);
    expect(data.by_visibility).toEqual({ private: 2, collectors: 1, dealers: 1 });
  });

  it('computes type and cert distributions', async () => {
    mockCollectionItems([
      { visibility: 'private', item_type: 'KATANA', cert_type: 'juyo' },
      { visibility: 'private', item_type: 'KATANA', cert_type: 'hozon' },
      { visibility: 'private', item_type: 'TSUBA', cert_type: 'hozon' },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.by_type).toEqual({ KATANA: 2, TSUBA: 1 });
    expect(data.by_cert).toEqual({ juyo: 1, hozon: 2 });
  });

  it('handles empty collection', async () => {
    mockCollectionItems([]);

    const res = await GET();
    const data = await res.json();

    expect(data.total_items).toBe(0);
    expect(data.by_visibility).toEqual({ private: 0, collectors: 0, dealers: 0 });
    expect(data.by_type).toEqual({});
    expect(data.by_cert).toEqual({});
  });

  it('handles items with null type and cert', async () => {
    mockCollectionItems([
      { visibility: 'private', item_type: null, cert_type: null },
      { visibility: 'collectors', item_type: 'KATANA', cert_type: null },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.total_items).toBe(2);
    expect(data.by_type).toEqual({ KATANA: 1 }); // null item_type excluded
    expect(data.by_cert).toEqual({}); // null cert_type excluded
  });
});
