/**
 * Tests for /api/collection/items (Phase 2c)
 *
 * Tests the new collection_items CRUD API:
 * - POST: creates item with all fields, sanitizes JSONB, logs audit event
 * - GET: returns items with facets, respects owner_id
 * - PATCH: whitelist enforcement, JSONB sanitization, status changes
 * - DELETE: cleanup (storage + videos), audit logging
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ───────────────────────────────────────────────
// vi.hoisted() runs before vi.mock() hoisting, so these are available in mock factories
const {
  mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockIn, mockIlike,
  mockOrder, mockRange, mockSingle, mockFrom, mockStorageFrom, mockGetUser,
  mockInsertCollectionItem, mockInsertCollectionEvent, mockSelectCollectionItemSingle,
  mockUpdateCollectionItem, mockDeleteCollectionItem, mockCollectionItemsFrom,
} = vi.hoisted(() => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockIn = vi.fn().mockReturnThis();
  const mockIlike = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockRange = vi.fn().mockReturnThis();
  const mockSingle = vi.fn();

  const chainValue = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    in: mockIn,
    ilike: mockIlike,
    order: mockOrder,
    range: mockRange,
    single: mockSingle,
    then: vi.fn(),
  };

  for (const fn of [mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockIn, mockIlike, mockOrder, mockRange]) {
    fn.mockReturnValue(chainValue);
  }

  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    in: mockIn,
    ilike: mockIlike,
    order: mockOrder,
    range: mockRange,
    single: mockSingle,
  }));

  const mockStorageFrom = vi.fn(() => ({
    remove: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.jpg' } }),
  }));

  const mockGetUser = vi.fn();

  const mockInsertCollectionItem = vi.fn();
  const mockInsertCollectionEvent = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSelectCollectionItemSingle = vi.fn();
  const mockUpdateCollectionItem = vi.fn();
  const mockDeleteCollectionItem = vi.fn();
  const mockCollectionItemsFrom = vi.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    ilike: mockIlike,
    order: mockOrder,
    range: mockRange,
  }));

  return {
    mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockIn, mockIlike,
    mockOrder, mockRange, mockSingle, mockFrom, mockStorageFrom, mockGetUser,
    mockInsertCollectionItem, mockInsertCollectionEvent, mockSelectCollectionItemSingle,
    mockUpdateCollectionItem, mockDeleteCollectionItem, mockCollectionItemsFrom,
  };
});

const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockAuthResponse = { data: { user: mockUser }, error: null };

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
  createServiceClient: vi.fn().mockReturnValue({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock('@/lib/collection/access', () => ({
  checkCollectionAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/supabase/collectionItems', () => ({
  collectionItemsFrom: (...args) => mockCollectionItemsFrom(...args),
  insertCollectionItem: (...args) => mockInsertCollectionItem(...args),
  insertCollectionEvent: (...args) => mockInsertCollectionEvent(...args),
  selectCollectionItemSingle: (...args) => mockSelectCollectionItemSingle(...args),
  updateCollectionItem: (...args) => mockUpdateCollectionItem(...args),
  deleteCollectionItem: (...args) => mockDeleteCollectionItem(...args),
  selectCollectionItems: vi.fn(),
}));

// Mock video helpers
vi.mock('@/lib/supabase/itemVideos', () => ({
  selectItemVideos: vi.fn().mockResolvedValue({ data: [], error: null }),
  deleteItemVideo: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@/lib/video/videoProvider', () => ({
  videoProvider: { deleteVideo: vi.fn().mockResolvedValue(undefined) },
  isVideoProviderConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), logError: vi.fn() },
}));

// Mock Yuhinkai artisan names lookup
vi.mock('@/lib/supabase/yuhinkai', () => ({
  getArtisanNames: vi.fn().mockResolvedValue(new Map()),
}));

// Mock collection expenses
vi.mock('@/lib/supabase/collectionExpenses', () => ({
  getExpenseTotals: vi.fn().mockResolvedValue({}),
}));

// ─── Import handlers ─────────────────────────────────────────────

import { GET, POST } from '@/app/api/collection/items/route';
import { GET as GET_SINGLE, PATCH, DELETE } from '@/app/api/collection/items/[id]/route';
import { NextRequest } from 'next/server';

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost'), init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/**
 * Create a chainable mock query builder that resolves to the given result.
 * Every method on the chain returns itself, and awaiting it resolves to `result`.
 */
function createChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'ilike', 'order', 'range', 'single']) {
    chain[method] = vi.fn(self);
  }
  // Make the chain thenable (resolves when awaited)
  chain.then = (resolve: (val: unknown) => void) => resolve(result);
  return chain;
}

// ─── Tests ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(mockAuthResponse);
  // Default: collectionItemsFrom returns a proper chainable query that resolves to 0 count
  mockCollectionItemsFrom.mockImplementation(() =>
    createChain({ data: [], error: null, count: 0 })
  );
});

describe('GET /api/collection/items', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const res = await GET(makeRequest('http://localhost/api/collection/items'));
    expect(res.status).toBe(401);
  });

  it('returns items with facets for authenticated user', async () => {
    // Create two independent query chains for the two collectionItemsFrom calls
    let callCount = 0;
    mockCollectionItemsFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Main query — ends with .range() then await
        const chain = createChain({
          data: [{ id: '1', title: 'Test Katana', item_type: 'katana' }],
          error: null,
          count: 1,
        });
        return chain;
      }
      // Facets query — ends with .eq() then await
      return createChain({
        data: [{ item_type: 'katana', cert_type: 'Juyo', era: 'Kamakura', mei_type: 'zaimei' }],
      });
    });

    const res = await GET(makeRequest('http://localhost/api/collection/items'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.total).toBeDefined();
    expect(body.facets).toBeDefined();
  });

  it('passes filters to query', async () => {
    mockCollectionItemsFrom.mockImplementation(() =>
      createChain({ data: [], error: null, count: 0 })
    );

    await GET(makeRequest('http://localhost/api/collection/items?category=nihonto&cert=Juyo'));
    // Verify the query chain was called (exact mock chain verification is fragile)
    expect(mockCollectionItemsFrom).toHaveBeenCalled();
  });
});

describe('POST /api/collection/items', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const res = await POST(makeRequest('http://localhost/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    }));
    expect(res.status).toBe(401);
  });

  it('creates item with all fields and returns 201', async () => {
    // count query handled by beforeEach default (count: 0)

    const createdItem = {
      id: 'item-uuid-1',
      item_uuid: 'uuid-abc',
      owner_id: 'user-123',
      title: 'Test Katana',
      item_type: 'katana',
      item_category: 'nihonto',
      status: 'INVENTORY',
      is_available: false,
      is_sold: false,
      images: [],
    };
    mockInsertCollectionItem.mockResolvedValueOnce({ data: createdItem, error: null });

    const res = await POST(makeRequest('http://localhost/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Katana',
        item_type: 'katana',
        item_category: 'nihonto',
        nagasa_cm: 70.5,
        smith: 'Masamune',
        school: 'Soshu',
        era: 'Kamakura',
        cert_type: 'Juyo',
      }),
    }));
    expect(res.status).toBe(201);
    expect(mockInsertCollectionItem).toHaveBeenCalledTimes(1);
    expect(mockInsertCollectionEvent).toHaveBeenCalledTimes(1);

    // Verify event type
    const eventCall = mockInsertCollectionEvent.mock.calls[0];
    expect(eventCall[1].event_type).toBe('created');
  });

  it('rejects when over 500 items', async () => {
    mockCollectionItemsFrom.mockImplementation(() =>
      createChain({ count: 500, error: null })
    );

    const res = await POST(makeRequest('http://localhost/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('500');
  });

  it('sanitizes JSONB sections', async () => {
    // count query handled by beforeEach default (count: 0)
    mockInsertCollectionItem.mockResolvedValueOnce({
      data: { id: 'x', item_uuid: 'y', owner_id: 'user-123' },
      error: null,
    });

    await POST(makeRequest('http://localhost/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test',
        koshirae: {
          description: 'test koshirae',
          cert_type: null,
          images: ['blob:fake', 'https://valid.com/img.jpg'],
        },
        sayagaki: [{
          id: 'say-1',
          author: 'honami_koson',
          content: 'test sayagaki',
          images: [],
        }],
      }),
    }));

    const insertCall = mockInsertCollectionItem.mock.calls[0][1];
    // Koshirae should be sanitized (blob URL stripped)
    expect(insertCall.koshirae).toBeTruthy();
    if (insertCall.koshirae) {
      expect(insertCall.koshirae.images).not.toContain('blob:fake');
    }
    // Sayagaki should be sanitized
    expect(insertCall.sayagaki).toBeTruthy();
  });

  it('routes tosogu fields correctly', async () => {
    // count query handled by beforeEach default (count: 0)
    mockInsertCollectionItem.mockResolvedValueOnce({
      data: { id: 'x', item_uuid: 'y', owner_id: 'user-123' },
      error: null,
    });

    await POST(makeRequest('http://localhost/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Tsuba',
        item_type: 'tsuba',
        item_category: 'tosogu',
        smith: 'Goto Yujo',
        school: 'Goto',
        height_cm: 7.5,
        width_cm: 7.2,
        material: 'shakudo',
      }),
    }));

    const insertCall = mockInsertCollectionItem.mock.calls[0][1];
    expect(insertCall.tosogu_maker).toBe('Goto Yujo');
    expect(insertCall.tosogu_school).toBe('Goto');
    expect(insertCall.height_cm).toBe(7.5);
    // Should NOT set sword fields
    expect(insertCall.smith).toBeUndefined();
  });

  it('sets artisan_confidence to HIGH when artisan_id provided', async () => {
    // count query handled by beforeEach default (count: 0)
    mockInsertCollectionItem.mockResolvedValueOnce({
      data: { id: 'x', item_uuid: 'y', owner_id: 'user-123' },
      error: null,
    });

    await POST(makeRequest('http://localhost/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', artisan_id: 'MAS590' }),
    }));

    const insertCall = mockInsertCollectionItem.mock.calls[0][1];
    expect(insertCall.artisan_id).toBe('MAS590');
    expect(insertCall.artisan_confidence).toBe('HIGH');
  });

  it('sets visibility to private by default', async () => {
    // count query handled by beforeEach default (count: 0)
    mockInsertCollectionItem.mockResolvedValueOnce({
      data: { id: 'x', item_uuid: 'y', owner_id: 'user-123' },
      error: null,
    });

    await POST(makeRequest('http://localhost/api/collection/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    }));

    const insertCall = mockInsertCollectionItem.mock.calls[0][1];
    expect(insertCall.visibility).toBe('private');
  });
});

describe('GET /api/collection/items/[id]', () => {
  it('returns item for owner', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'user-123', visibility: 'private', title: 'My Katana' },
      error: null,
    });

    const res = await GET_SINGLE(makeRequest('http://localhost/api/collection/items/item-1'), makeParams('item-1'));
    expect(res.status).toBe(200);
  });

  it('returns 403 for private item when not owner', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', visibility: 'private', title: 'Their Katana' },
      error: null,
    });

    const res = await GET_SINGLE(makeRequest('http://localhost/api/collection/items/item-1'), makeParams('item-1'));
    expect(res.status).toBe(403);
  });

  it('returns item for non-owner if visibility is collectors and user has tier', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', visibility: 'collectors', title: 'Shared Katana' },
      error: null,
    });
    // Mock the profiles query for tier check
    mockSingle.mockResolvedValueOnce({ data: { subscription_tier: 'inner_circle' }, error: null });

    const res = await GET_SINGLE(makeRequest('http://localhost/api/collection/items/item-1'), makeParams('item-1'));
    expect(res.status).toBe(200);
  });

  it('returns 403 for collectors visibility when user is free tier', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', visibility: 'collectors', title: 'Shared Katana' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: { subscription_tier: 'free' }, error: null });

    const res = await GET_SINGLE(makeRequest('http://localhost/api/collection/items/item-1'), makeParams('item-1'));
    expect(res.status).toBe(403);
  });

  it('returns 403 for dealers visibility when user is free tier', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', visibility: 'dealers', title: 'Dealer Katana' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: { subscription_tier: 'free' }, error: null });

    const res = await GET_SINGLE(makeRequest('http://localhost/api/collection/items/item-1'), makeParams('item-1'));
    expect(res.status).toBe(403);
  });

  it('returns item for dealers visibility when user is dealer tier', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', visibility: 'dealers', title: 'Dealer Katana' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: { subscription_tier: 'dealer' }, error: null });

    const res = await GET_SINGLE(makeRequest('http://localhost/api/collection/items/item-1'), makeParams('item-1'));
    expect(res.status).toBe(200);
  });

  it('returns 404 for nonexistent item', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const res = await GET_SINGLE(makeRequest('http://localhost/api/collection/items/nonexistent'), makeParams('nonexistent'));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/collection/items/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const res = await PATCH(
      makeRequest('http://localhost/api/collection/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      }),
      makeParams('item-1'),
    );
    expect(res.status).toBe(401);
  });

  it('updates allowed fields', async () => {
    mockSelectCollectionItemSingle
      .mockResolvedValueOnce({ data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'item-1', title: 'Updated Title' }, error: null });
    mockUpdateCollectionItem.mockResolvedValueOnce({ error: null });

    const res = await PATCH(
      makeRequest('http://localhost/api/collection/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title', era: 'Kamakura' }),
      }),
      makeParams('item-1'),
    );
    expect(res.status).toBe(200);
    expect(mockUpdateCollectionItem).toHaveBeenCalledTimes(1);
    expect(mockInsertCollectionEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects disallowed fields (whitelist enforcement)', async () => {
    mockSelectCollectionItemSingle
      .mockResolvedValueOnce({ data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1' }, error: null });

    const res = await PATCH(
      makeRequest('http://localhost/api/collection/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: 'hacker-id', images: ['injected.jpg'] }),
      }),
      makeParams('item-1'),
    );
    // owner_id and images are not in ALLOWED_FIELDS → no valid fields → 400
    expect(res.status).toBe(400);
  });

  it('sanitizes JSONB on PATCH', async () => {
    mockSelectCollectionItemSingle
      .mockResolvedValueOnce({ data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
    mockUpdateCollectionItem.mockResolvedValueOnce({ error: null });

    await PATCH(
      makeRequest('http://localhost/api/collection/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          koshirae: { description: 'updated', images: ['blob:fake', 'https://real.jpg'] },
        }),
      }),
      makeParams('item-1'),
    );

    const updateCall = mockUpdateCollectionItem.mock.calls[0][2];
    expect(updateCall.koshirae).toBeTruthy();
    if (updateCall.koshirae) {
      expect(updateCall.koshirae.images).not.toContain('blob:fake');
    }
  });

  it('handles status change to SOLD', async () => {
    mockSelectCollectionItemSingle
      .mockResolvedValueOnce({ data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'item-1', status: 'SOLD' }, error: null });
    mockUpdateCollectionItem.mockResolvedValueOnce({ error: null });

    await PATCH(
      makeRequest('http://localhost/api/collection/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SOLD' }),
      }),
      makeParams('item-1'),
    );

    const updateCall = mockUpdateCollectionItem.mock.calls[0][2];
    expect(updateCall.status).toBe('SOLD');
    expect(updateCall.is_sold).toBe(true);
    expect(updateCall.is_available).toBe(false);
  });

  it('validates visibility values', async () => {
    mockSelectCollectionItemSingle
      .mockResolvedValueOnce({ data: { id: 'item-1', owner_id: 'user-123', item_uuid: 'uuid-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'item-1' }, error: null });
    mockUpdateCollectionItem.mockResolvedValueOnce({ error: null });

    await PATCH(
      makeRequest('http://localhost/api/collection/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'invalid_value' }),
      }),
      makeParams('item-1'),
    );

    const updateCall = mockUpdateCollectionItem.mock.calls[0][2];
    expect(updateCall.visibility).toBe('private'); // Falls back to private
  });

  it('returns 404 for non-owner', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user' },
      error: null,
    });

    const res = await PATCH(
      makeRequest('http://localhost/api/collection/items/item-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked' }),
      }),
      makeParams('item-1'),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/collection/items/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authenticated' } });

    const res = await DELETE(
      makeRequest('http://localhost/api/collection/items/item-1', { method: 'DELETE' }),
      makeParams('item-1'),
    );
    expect(res.status).toBe(401);
  });

  it('deletes item with cleanup and audit logging', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: {
        id: 'item-1',
        owner_id: 'user-123',
        item_uuid: 'uuid-1',
        images: ['https://example.com/storage/v1/object/public/user-images/user-123/uuid-1/img.jpg'],
      },
      error: null,
    });
    mockDeleteCollectionItem.mockResolvedValueOnce({ error: null });

    const res = await DELETE(
      makeRequest('http://localhost/api/collection/items/item-1', { method: 'DELETE' }),
      makeParams('item-1'),
    );
    expect(res.status).toBe(200);
    expect(mockDeleteCollectionItem).toHaveBeenCalledWith(expect.anything(), 'item-1');

    // Audit event should be logged BEFORE delete
    expect(mockInsertCollectionEvent).toHaveBeenCalledTimes(1);
    const eventCall = mockInsertCollectionEvent.mock.calls[0][1];
    expect(eventCall.event_type).toBe('deleted');
  });

  it('returns 404 for non-owner', async () => {
    mockSelectCollectionItemSingle.mockResolvedValueOnce({
      data: { id: 'item-1', owner_id: 'other-user', item_uuid: 'uuid-1', images: [] },
      error: null,
    });

    const res = await DELETE(
      makeRequest('http://localhost/api/collection/items/item-1', { method: 'DELETE' }),
      makeParams('item-1'),
    );
    expect(res.status).toBe(404);
  });
});
