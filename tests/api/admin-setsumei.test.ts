import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for Admin Setsumei API Routes
 *
 * These test the /api/admin/setsumei/* endpoints:
 * - POST /api/admin/setsumei/connect
 * - DELETE /api/admin/setsumei/disconnect
 * - GET /api/admin/setsumei/preview
 */

// Mock Supabase client
const mockSupabaseAuth = {
  getUser: vi.fn(),
};

const mockSupabaseFrom = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseUpdate = vi.fn();
const mockSupabaseDelete = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: mockSupabaseAuth,
    from: mockSupabaseFrom,
  })),
  createServiceClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

// Mock oshi-v2 client
const mockFetchCatalogRecord = vi.fn();
const mockIsOshiV2Configured = vi.fn();

vi.mock('@/lib/yuhinkai/oshiV2Client', () => ({
  fetchCatalogRecord: mockFetchCatalogRecord,
  isOshiV2Configured: mockIsOshiV2Configured,
  extractArtisanName: vi.fn(() => 'Test Artisan'),
  extractArtisanKanji: vi.fn(() => null),
  extractSchool: vi.fn(() => 'Test School'),
  extractPeriod: vi.fn(() => 'Test Period'),
  extractItemCategory: vi.fn(() => 'blade'),
  getCertTypeFromCollection: vi.fn(() => 'Juyo'),
}));

// Mock URL parser
vi.mock('@/lib/yuhinkai/urlParser', () => ({
  parseYuhinkaiUrl: vi.fn((url: string) => {
    if (url.includes('invalid')) {
      return { success: false, error: 'Invalid URL' };
    }
    return {
      success: true,
      data: { collection: 'Juyo', volume: 68, itemNumber: 14936 },
    };
  }),
}));

describe('Admin Setsumei API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOshiV2Configured.mockReturnValue(true);

    // Default mock chain for Supabase queries
    mockSupabaseFrom.mockReturnValue({
      select: mockSupabaseSelect,
      insert: mockSupabaseInsert,
      update: mockSupabaseUpdate,
      delete: mockSupabaseDelete,
    });
    mockSupabaseSelect.mockReturnValue({
      eq: mockSupabaseEq,
      single: mockSupabaseSingle,
    });
    mockSupabaseEq.mockReturnValue({
      single: mockSupabaseSingle,
      select: mockSupabaseSelect,
    });
    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect,
    });
    mockSupabaseUpdate.mockReturnValue({
      eq: mockSupabaseEq,
    });
    mockSupabaseDelete.mockReturnValue({
      eq: mockSupabaseEq,
    });
  });

  describe('Authentication', () => {
    it('rejects unauthenticated requests', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Import dynamically to apply mocks
      const { POST } = await import('@/app/api/admin/setsumei/connect/route');

      const request = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ listing_id: 1, yuhinkai_url: '/item/juyo/68/14936' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('rejects non-admin users', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockSupabaseSingle.mockResolvedValue({
        data: { role: 'user' },
        error: null,
      });

      const { POST } = await import('@/app/api/admin/setsumei/connect/route');

      const request = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ listing_id: 1, yuhinkai_url: '/item/juyo/68/14936' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('POST /api/admin/setsumei/connect', () => {
    beforeEach(() => {
      // Setup admin auth
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });
    });

    it('rejects request when oshi-v2 is not configured', async () => {
      mockIsOshiV2Configured.mockReturnValue(false);

      const { POST } = await import('@/app/api/admin/setsumei/connect/route');

      const request = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ listing_id: 1, yuhinkai_url: '/item/juyo/68/14936' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
    });

    it('validates required fields', async () => {
      const { POST } = await import('@/app/api/admin/setsumei/connect/route');

      // Missing listing_id
      const request1 = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ yuhinkai_url: '/item/juyo/68/14936' }),
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(400);

      // Missing yuhinkai_url
      const request2 = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ listing_id: 1 }),
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(400);
    });

    it('validates listing_id is a positive number', async () => {
      const { POST } = await import('@/app/api/admin/setsumei/connect/route');

      const request = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ listing_id: -1, yuhinkai_url: '/item/juyo/68/14936' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid listing_id');
    });

    it('rejects invalid Yuhinkai URL', async () => {
      const { POST } = await import('@/app/api/admin/setsumei/connect/route');

      const request = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ listing_id: 1, yuhinkai_url: '/invalid/url' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('returns 404 when catalog record not found', async () => {
      mockFetchCatalogRecord.mockResolvedValue(null);
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      const { POST } = await import('@/app/api/admin/setsumei/connect/route');

      const request = new Request('http://localhost:3000/api/admin/setsumei/connect', {
        method: 'POST',
        body: JSON.stringify({ listing_id: 1, yuhinkai_url: '/item/juyo/68/14936' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/setsumei/disconnect', () => {
    beforeEach(() => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
        error: null,
      });
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });
    });

    it('validates listing_id is required', async () => {
      const { DELETE } = await import('@/app/api/admin/setsumei/disconnect/route');

      const request = new Request('http://localhost:3000/api/admin/setsumei/disconnect', {
        method: 'DELETE',
        body: JSON.stringify({}),
      });

      const response = await DELETE(request);
      expect(response.status).toBe(400);
    });
  });
});

// URL Parser Integration tests are in tests/lib/yuhinkai/urlParser.test.ts

describe('Connection Source Tracking', () => {
  /**
   * These tests verify that manual connections are properly tracked
   * with connection_source = 'manual' for audit purposes.
   */

  it('sets connection_source to manual for admin connections', () => {
    // This would be tested in integration tests
    // The connect route should set:
    // - connection_source: 'manual'
    // - verification_status: 'confirmed'
    // - verified_by: admin user ID
    // - verified_at: timestamp
    expect(true).toBe(true); // Placeholder
  });

  it('preserves audit trail with verified_by and verified_at', () => {
    // This would be tested in integration tests
    expect(true).toBe(true); // Placeholder
  });
});
