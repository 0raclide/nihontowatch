import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for /api/dealer/listings/intelligence/criteria
 *
 * Validates auth checks, ownership verification, and response shape.
 */

const mockVerifyDealer = vi.fn();
const mockListingQuery = vi.fn();
const mockSearchesQuery = vi.fn();
const mockSelectCollectionItemSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'listings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: mockListingQuery,
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'saved_searches') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: mockSearchesQuery,
            })),
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  })),
}));

vi.mock('@/lib/dealer/auth', () => ({
  verifyDealer: (...args: unknown[]) => mockVerifyDealer(...args),
}));

vi.mock('@/lib/supabase/collectionItems', () => ({
  selectCollectionItemSingle: (...args: unknown[]) => mockSelectCollectionItemSingle(...args),
}));

// Dynamic import after mocks are set up
const { GET } = await import('@/app/api/dealer/listings/intelligence/criteria/route');

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/dealer/listings/intelligence/criteria');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/dealer/listings/intelligence/criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated users', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: false, error: 'unauthorized' });
    const res = await GET(makeRequest({ listingId: '1' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-dealer users', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: false, error: 'forbidden' });
    const res = await GET(makeRequest({ listingId: '1' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when neither listingId nor collectionItemId provided', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: true, user: { id: 'u1' }, dealerId: 5 });
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid listingId', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: true, user: { id: 'u1' }, dealerId: 5 });
    const res = await GET(makeRequest({ listingId: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when listing not found', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: true, user: { id: 'u1' }, dealerId: 5 });
    mockListingQuery.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const res = await GET(makeRequest({ listingId: '999' }));
    expect(res.status).toBe(404);
  });

  it('returns criteria summary for a valid listing', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: true, user: { id: 'u1' }, dealerId: 5 });
    mockListingQuery.mockResolvedValue({
      data: { id: 1, dealer_id: 5, item_type: 'katana', item_category: 'nihonto', cert_type: 'Juyo', price_value: 500000, school: 'Bizen', tosogu_school: null, source: 'dealer' },
      error: null,
    });
    mockSearchesQuery.mockResolvedValue({
      data: [
        { id: 's1', user_id: 'u2', search_criteria: { itemTypes: ['katana'] } },
        { id: 's2', user_id: 'u3', search_criteria: { certifications: ['Juyo'] } },
      ],
      error: null,
    });

    const res = await GET(makeRequest({ listingId: '1' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalCollectors).toBe(2);
    expect(body.facets).toBeDefined();
    expect(body.facets.itemTypes).toBeInstanceOf(Array);
    expect(body.facets.certifications).toBeInstanceOf(Array);
    expect(body.facets.schools).toBeInstanceOf(Array);
    expect(body.facets.priceRanges).toBeInstanceOf(Array);
  });
});
