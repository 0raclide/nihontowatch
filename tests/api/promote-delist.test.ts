/**
 * Tests for Promote/Delist transit (Phase 3)
 *
 * Tests:
 * - POST /api/collection/items/[id]/promote — promotes collection item to listing
 * - POST /api/listings/[id]/delist — delists listing back to collection item
 * - SQL RPC column parity with SHARED_COLUMNS
 * - Auth, ownership, dealer tier checks
 * - Price override behavior
 * - DELISTED status handling
 * - Dealer listings API excludes DELISTED from inventory tab
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SHARED_COLUMNS } from '@/types/itemData';
import * as fs from 'fs';
import * as path from 'path';

// ─── Mock Supabase ───────────────────────────────────────────────
const {
  mockGetUser, mockFrom, mockRpc, mockSingle, mockSelect, mockEq,
  mockSelectCollectionItemSingle,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockNeq = vi.fn().mockReturnThis();
  const mockIs = vi.fn().mockReturnThis();
  const mockNot = vi.fn().mockReturnThis();
  const mockRange = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();

  const chainValue = {
    select: mockSelect,
    eq: mockEq,
    neq: mockNeq,
    is: mockIs,
    not: mockNot,
    range: mockRange,
    order: mockOrder,
    single: mockSingle,
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  for (const fn of [mockSelect, mockEq, mockNeq, mockIs, mockNot, mockRange, mockOrder]) {
    fn.mockReturnValue(chainValue);
  }

  const mockFrom = vi.fn(() => chainValue);
  const mockRpc = vi.fn();
  const mockGetUser = vi.fn();
  const mockSelectCollectionItemSingle = vi.fn();

  return {
    mockGetUser, mockFrom, mockRpc, mockSingle, mockSelect, mockEq,
    mockSelectCollectionItemSingle,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: () => mockGetUser() },
    from: mockFrom,
    rpc: mockRpc,
  })),
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: vi.fn() },
  })),
}));

vi.mock('@/lib/supabase/collectionItems', () => ({
  selectCollectionItemSingle: (...args: unknown[]) => mockSelectCollectionItemSingle(...args),
  insertCollectionEvent: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

const { mockRecomputeScoreForListing } = vi.hoisted(() => ({
  mockRecomputeScoreForListing: vi.fn().mockResolvedValue(100),
}));

vi.mock('@/lib/featured/scoring', () => ({
  recomputeScoreForListing: mockRecomputeScoreForListing,
  getArtisanEliteStats: vi.fn().mockResolvedValue(null),
}));

const { mockVerifyDealer } = vi.hoisted(() => ({
  mockVerifyDealer: vi.fn(),
}));

vi.mock('@/lib/dealer/auth', () => ({
  verifyDealer: mockVerifyDealer,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), logError: vi.fn(), warn: vi.fn() },
}));

// Helper to create mock collection item
function makeCollectionItem(overrides = {}) {
  return {
    id: 'ci-uuid-1',
    item_uuid: 'item-uuid-1',
    owner_id: 'user-uuid-1',
    visibility: 'private',
    source_listing_id: null,
    personal_notes: 'My favorite blade',
    title: 'Test Katana',
    description: 'A fine katana',
    item_type: 'KATANA',
    item_category: 'nihonto',
    status: 'available',
    is_available: true,
    is_sold: false,
    price_value: 500000,
    price_currency: 'JPY',
    images: ['img1.jpg'],
    artisan_id: 'MAS590',
    artisan_confidence: 'HIGH',
    cert_type: 'Juyo',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-09T00:00:00Z',
    ...overrides,
  };
}

// ─── Test Setup ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// TEST 1: SHARED_COLUMNS parity — promote RPC includes all shared columns
// =============================================================================

describe('RPC column parity', () => {
  it('promote_to_listing RPC references all SHARED_COLUMNS', () => {
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/128_promote_to_listing.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    for (const col of SHARED_COLUMNS) {
      // Each shared column should appear in the SQL (in the INSERT or UPDATE)
      expect(sql).toContain(col);
    }
  });

  it('delist_to_collection RPC references all SHARED_COLUMNS', () => {
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/129_delist_to_collection.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    for (const col of SHARED_COLUMNS) {
      expect(sql).toContain(col);
    }
  });
});

// =============================================================================
// TEST 2: Promote API
// =============================================================================

describe('POST /api/collection/items/[id]/promote', () => {
  it('returns 401 when not authenticated', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: false, error: 'unauthorized' });

    const { POST } = await import('@/app/api/collection/items/[id]/promote/route');
    const request = new Request('http://localhost/api/collection/items/ci-uuid-1/promote', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(request as any, { params: Promise.resolve({ id: 'ci-uuid-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when not a dealer', async () => {
    mockVerifyDealer.mockResolvedValue({ isDealer: false, error: 'forbidden' });

    const { POST } = await import('@/app/api/collection/items/[id]/promote/route');
    const request = new Request('http://localhost/api/collection/items/ci-uuid-1/promote', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(request as any, { params: Promise.resolve({ id: 'ci-uuid-1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 when collection item not found', async () => {
    mockVerifyDealer.mockResolvedValue({
      isDealer: true,
      user: { id: 'user-uuid-1' },
      dealerId: 99,
    });
    mockSelectCollectionItemSingle.mockResolvedValue({ data: null, error: null });

    const { POST } = await import('@/app/api/collection/items/[id]/promote/route');
    const request = new Request('http://localhost/api/collection/items/ci-uuid-1/promote', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(request as any, { params: Promise.resolve({ id: 'ci-uuid-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own the collection item', async () => {
    mockVerifyDealer.mockResolvedValue({
      isDealer: true,
      user: { id: 'user-uuid-DIFFERENT' },
      dealerId: 99,
    });
    mockSelectCollectionItemSingle.mockResolvedValue({
      data: makeCollectionItem({ owner_id: 'user-uuid-1' }),
      error: null,
    });

    const { POST } = await import('@/app/api/collection/items/[id]/promote/route');
    const request = new Request('http://localhost/api/collection/items/ci-uuid-1/promote', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(request as any, { params: Promise.resolve({ id: 'ci-uuid-1' }) });
    expect(res.status).toBe(403);
  });

  it('calls RPC with correct params and returns listing_id', async () => {
    mockVerifyDealer.mockResolvedValue({
      isDealer: true,
      user: { id: 'user-uuid-1' },
      dealerId: 99,
    });
    mockSelectCollectionItemSingle.mockResolvedValue({
      data: makeCollectionItem(),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 12345, error: null });

    const { POST } = await import('@/app/api/collection/items/[id]/promote/route');
    const request = new Request('http://localhost/api/collection/items/ci-uuid-1/promote', {
      method: 'POST',
      body: JSON.stringify({ price_value: 800000, price_currency: 'JPY' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(request as any, { params: Promise.resolve({ id: 'ci-uuid-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listing_id).toBe(12345);

    expect(mockRpc).toHaveBeenCalledWith('promote_to_listing', {
      p_collection_item_id: 'ci-uuid-1',
      p_dealer_id: 99,
      p_owner_id: 'user-uuid-1',
      p_price_value: 800000,
      p_price_currency: 'JPY',
    });
  });

  it('passes null price when price_value is not a number', async () => {
    mockVerifyDealer.mockResolvedValue({
      isDealer: true,
      user: { id: 'user-uuid-1' },
      dealerId: 99,
    });
    mockSelectCollectionItemSingle.mockResolvedValue({
      data: makeCollectionItem(),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 12345, error: null });

    const { POST } = await import('@/app/api/collection/items/[id]/promote/route');
    const request = new Request('http://localhost/api/collection/items/ci-uuid-1/promote', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request as any, { params: Promise.resolve({ id: 'ci-uuid-1' }) });

    expect(mockRpc).toHaveBeenCalledWith('promote_to_listing', expect.objectContaining({
      p_price_value: null,
      p_price_currency: null,
    }));
  });

  it('calls recomputeScoreForListing with elite sync when artisan_id is set', async () => {
    mockVerifyDealer.mockResolvedValue({
      isDealer: true,
      user: { id: 'user-uuid-1' },
      dealerId: 99,
    });
    mockSelectCollectionItemSingle.mockResolvedValue({
      data: makeCollectionItem({ artisan_id: 'MAS590' }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 12345, error: null });

    const { POST } = await import('@/app/api/collection/items/[id]/promote/route');
    const request = new Request('http://localhost/api/collection/items/ci-uuid-1/promote', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request as any, { params: Promise.resolve({ id: 'ci-uuid-1' }) });

    expect(mockRecomputeScoreForListing).toHaveBeenCalledWith(
      expect.anything(),
      12345,
      { syncElite: true, artisanId: 'MAS590' }
    );
  });
});

// =============================================================================
// TEST 3: Delist API
// =============================================================================

describe('POST /api/listings/[id]/delist', () => {
  it('returns 400 for invalid listing ID', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } } });

    const { POST } = await import('@/app/api/listings/[id]/delist/route');
    const request = new Request('http://localhost/api/listings/abc/delist', { method: 'POST' });
    const res = await POST(request as any, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import('@/app/api/listings/[id]/delist/route');
    const request = new Request('http://localhost/api/listings/123/delist', { method: 'POST' });
    const res = await POST(request as any, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when listing not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } } });
    mockSingle.mockResolvedValue({ data: null, error: null });

    const { POST } = await import('@/app/api/listings/[id]/delist/route');
    const request = new Request('http://localhost/api/listings/123/delist', { method: 'POST' });
    const res = await POST(request as any, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own listing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-DIFFERENT' } } });
    mockSingle.mockResolvedValue({
      data: { id: 123, owner_id: 'user-uuid-1', source: 'dealer', status: 'AVAILABLE' },
      error: null,
    });

    const { POST } = await import('@/app/api/listings/[id]/delist/route');
    const request = new Request('http://localhost/api/listings/123/delist', { method: 'POST' });
    const res = await POST(request as any, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-dealer listings (scraped)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } } });
    mockSingle.mockResolvedValue({
      data: { id: 123, owner_id: 'user-uuid-1', source: 'scraper', status: 'AVAILABLE' },
      error: null,
    });

    const { POST } = await import('@/app/api/listings/[id]/delist/route');
    const request = new Request('http://localhost/api/listings/123/delist', { method: 'POST' });
    const res = await POST(request as any, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 if listing is already DELISTED', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } } });
    mockSingle.mockResolvedValue({
      data: { id: 123, owner_id: 'user-uuid-1', source: 'dealer', status: 'DELISTED' },
      error: null,
    });

    const { POST } = await import('@/app/api/listings/[id]/delist/route');
    const request = new Request('http://localhost/api/listings/123/delist', { method: 'POST' });
    const res = await POST(request as any, { params: Promise.resolve({ id: '123' }) });
    expect(res.status).toBe(400);
  });

  it('calls RPC and returns collection_item_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } } });
    mockSingle.mockResolvedValue({
      data: { id: 123, owner_id: 'user-uuid-1', source: 'dealer', status: 'AVAILABLE' },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 'new-collection-uuid', error: null });

    const { POST } = await import('@/app/api/listings/[id]/delist/route');
    const request = new Request('http://localhost/api/listings/123/delist', { method: 'POST' });
    const res = await POST(request as any, { params: Promise.resolve({ id: '123' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection_item_id).toBe('new-collection-uuid');

    expect(mockRpc).toHaveBeenCalledWith('delist_to_collection', {
      p_listing_id: 123,
      p_owner_id: 'user-uuid-1',
    });
  });
});

// =============================================================================
// TEST 4: Dealer listings API excludes DELISTED from inventory tab
// =============================================================================

describe('DELISTED exclusion', () => {
  it('dealer listings inventory tab excludes DELISTED status', () => {
    // Read the route source and verify the inventory case includes .neq('status', 'DELISTED')
    const routePath = path.resolve(
      __dirname,
      '../../src/app/api/dealer/listings/route.ts'
    );
    const source = fs.readFileSync(routePath, 'utf-8');

    // Find the inventory case and check it excludes DELISTED
    const inventoryBlock = source.match(/case 'inventory':[\s\S]*?break;/);
    expect(inventoryBlock).toBeTruthy();
    expect(inventoryBlock![0]).toContain("DELISTED");
  });
});

// =============================================================================
// TEST 5: SQL migration structure
// =============================================================================

describe('SQL migration structure', () => {
  it('promote RPC is SECURITY DEFINER', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/128_promote_to_listing.sql'),
      'utf-8'
    );
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('delist RPC is SECURITY DEFINER', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/129_delist_to_collection.sql'),
      'utf-8'
    );
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('promote RPC uses FOR UPDATE locking', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/128_promote_to_listing.sql'),
      'utf-8'
    );
    expect(sql).toContain('FOR UPDATE');
  });

  it('delist RPC uses FOR UPDATE locking', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/129_delist_to_collection.sql'),
      'utf-8'
    );
    expect(sql).toContain('FOR UPDATE');
  });

  it('promote RPC inserts audit event with type promoted', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/128_promote_to_listing.sql'),
      'utf-8'
    );
    expect(sql).toContain("'promoted'");
    expect(sql).toContain('collection_events');
  });

  it('delist RPC inserts audit event with type delisted', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/129_delist_to_collection.sql'),
      'utf-8'
    );
    expect(sql).toContain("'delisted'");
    expect(sql).toContain('collection_events');
  });

  it('delete RPC cleans up item_videos', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/130_delete_collection_item.sql'),
      'utf-8'
    );
    expect(sql).toContain('item_videos');
    expect(sql).toContain("'deleted'");
  });

  it('promote RPC sets is_initial_import = false for new listings', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/128_promote_to_listing.sql'),
      'utf-8'
    );
    // Verify the INSERT values include false for is_initial_import
    expect(sql).toContain('is_initial_import');
    expect(sql).toMatch(/is_initial_import.*false/s);
  });

  it('promote RPC handles re-promote path (UPDATE existing DELISTED)', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/128_promote_to_listing.sql'),
      'utf-8'
    );
    expect(sql).toContain('DELISTED');
    expect(sql).toContain('v_existing_id');
  });

  it('delist RPC sets featured_score = 0 on soft-delist', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/129_delist_to_collection.sql'),
      'utf-8'
    );
    expect(sql).toContain('featured_score = 0');
  });

  it('delete RPC removes DELISTED ghost from listings', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/130_delete_collection_item.sql'),
      'utf-8'
    );
    expect(sql).toContain("DELETE FROM listings WHERE item_uuid = v_item_uuid AND status = 'DELISTED'");
  });

  it('thickness_mm migration exists', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/127_add_thickness_mm_to_listings.sql'),
      'utf-8'
    );
    expect(sql).toContain('thickness_mm');
    expect(sql).toContain('ALTER TABLE listings');
  });
});
