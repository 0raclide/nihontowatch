import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for POST /api/listing/[id]/fix-cert
 *
 * Admin endpoint to correct cert_type on listings.
 * Sets cert_admin_locked = true and creates audit trail in cert_corrections.
 */

// Mock Supabase clients
const mockSupabaseAuth = { getUser: vi.fn() };
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: mockSupabaseAuth,
    from: mockFrom,
  })),
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock admin auth
vi.mock('@/lib/admin/auth', () => ({
  verifyAdmin: vi.fn(async () => ({
    isAdmin: true,
    user: { id: 'admin-001', email: 'admin@test.com' },
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

// Helper to create a NextRequest with route params
function createRequest(listingId: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/listing/${listingId}/fix-cert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/listing/[id]/fix-cert', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default Supabase mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      upsert: mockUpsert,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('updates cert_type and returns success', async () => {
    // Listing exists
    mockSingle.mockResolvedValue({
      data: { id: 42, cert_type: 'Hozon' },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('42', { cert_type: 'Juyo' }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.certType).toBe('Juyo');
    expect(data.previousCertType).toBe('Hozon');

    // Verify update was called with cert_admin_locked
    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        cert_type: 'Juyo',
        cert_admin_locked: true,
      }),
    );
  });

  it('allows null cert_type (clear designation)', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, cert_type: 'Tokuju' },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('42', { cert_type: null }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.certType).toBeNull();
  });

  it('rejects invalid cert_type values', async () => {
    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('42', { cert_type: 'InvalidCert' }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/Invalid cert_type/i);
  });

  it('rejects invalid listing ID', async () => {
    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('abc', { cert_type: 'Juyo' }) as any,
      createParams('abc') as any,
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 for non-existent listing', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('9999', { cert_type: 'Juyo' }) as any,
      createParams('9999') as any,
    );

    expect(response.status).toBe(404);
  });

  it('upserts audit record into cert_corrections', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, cert_type: 'Hozon' },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    await POST(
      createRequest('42', { cert_type: 'Tokuju', notes: 'Confirmed via shinsa paper' }) as any,
      createParams('42') as any,
    );

    // cert_corrections upsert should be called
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        listing_id: 42,
        original_cert: 'Hozon',
        corrected_cert: 'Tokuju',
        corrected_by: 'admin-001',
        notes: 'Confirmed via shinsa paper',
      }),
      expect.objectContaining({
        onConflict: 'listing_id',
      }),
    );
  });

  it('still returns success when audit insert fails (non-blocking)', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, cert_type: 'Hozon' },
      error: null,
    });
    mockUpsert.mockResolvedValue({
      error: { message: 'constraint violation' },
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('42', { cert_type: 'Juyo' }) as any,
      createParams('42') as any,
    );

    // Should still return 200 — audit failure is logged but not blocking
    expect(response.status).toBe(200);
  });

  it('rejects unauthenticated requests', async () => {
    const { verifyAdmin } = await import('@/lib/admin/auth');
    (verifyAdmin as any).mockResolvedValueOnce({
      isAdmin: false,
      error: 'unauthorized',
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('42', { cert_type: 'Juyo' }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const { verifyAdmin } = await import('@/lib/admin/auth');
    (verifyAdmin as any).mockResolvedValueOnce({
      isAdmin: false,
      error: 'forbidden',
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');
    const response = await POST(
      createRequest('42', { cert_type: 'Juyo' }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(403);
  });

  it('accepts all valid cert_type values', async () => {
    const validCerts = [
      'Tokuju', 'tokubetsu_juyo',
      'Juyo', 'juyo',
      'Juyo Bijutsuhin', 'JuyoBijutsuhin', 'juyo_bijutsuhin',
      'TokuHozon', 'tokubetsu_hozon',
      'TokuKicho',
      'Hozon', 'hozon',
      'nbthk', 'nthk',
    ];

    const { POST } = await import('@/app/api/listing/[id]/fix-cert/route');

    for (const cert of validCerts) {
      mockSingle.mockResolvedValue({
        data: { id: 42, cert_type: null },
        error: null,
      });
      mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockUpsert.mockResolvedValue({ error: null });

      const response = await POST(
        createRequest('42', { cert_type: cert }) as any,
        createParams('42') as any,
      );

      expect(response.status).toBe(200);
    }
  });
});
