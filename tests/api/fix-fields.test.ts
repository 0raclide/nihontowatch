import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for POST /api/listing/[id]/fix-fields
 *
 * Admin endpoint to correct arbitrary fields on listings.
 * Auto-locks changed fields in admin_locked_fields JSONB.
 * Recomputes featured_score after update.
 */

// Mock Supabase clients
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn() },
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

// Mock featured score recompute
vi.mock('@/lib/featured/scoring', () => ({
  recomputeScoreForListing: vi.fn(async () => {}),
}));

// Helper to create a NextRequest with route params
function createRequest(listingId: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/listing/${listingId}/fix-fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/listing/[id]/fix-fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default Supabase mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('updates fields and returns success with locked fields list', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: null },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('42', { fields: { smith: 'Gojo Kuninaga', province: 'Yamashiro' } }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.listingId).toBe(42);
    expect(data.updatedFields).toContain('smith');
    expect(data.updatedFields).toContain('province');
    expect(data.lockedFields).toEqual({ smith: true, province: true });
  });

  it('auto-locks edited fields in admin_locked_fields JSONB', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: null },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    await POST(
      createRequest('42', { fields: { era: 'Koto' } }) as any,
      createParams('42') as any,
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        era: 'Koto',
        admin_locked_fields: { era: true },
      }),
    );
  });

  it('merges new locks with existing locks (does not clobber)', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: { smith: true, school: true } },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('42', { fields: { province: 'Bizen' } }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lockedFields).toEqual({ smith: true, school: true, province: true });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_locked_fields: { smith: true, school: true, province: true },
      }),
    );
  });

  it('converts empty strings to null for string fields', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: null },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    await POST(
      createRequest('42', { fields: { smith: '' } }) as any,
      createParams('42') as any,
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        smith: null,
      }),
    );
  });

  it('parses numeric strings to numbers (nagasa_cm, price_value)', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: null },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    await POST(
      createRequest('42', { fields: { nagasa_cm: '72.5', price_value: '1500000' } }) as any,
      createParams('42') as any,
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        nagasa_cm: 72.5,
        price_value: 1500000,
      }),
    );
  });

  it('rejects invalid numeric values (returns 400)', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: null },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('42', { fields: { nagasa_cm: 'not-a-number' } }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/Invalid numeric value/i);
  });

  it('rejects empty fields object (returns 400)', async () => {
    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('42', { fields: {} }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/required/i);
  });

  it('rejects missing fields key (returns 400)', async () => {
    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('42', { smith: 'Gojo' }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/required/i);
  });

  it('returns 404 for non-existent listing', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('9999', { fields: { smith: 'Gojo' } }) as any,
      createParams('9999') as any,
    );

    expect(response.status).toBe(404);
  });

  it('rejects unauthenticated requests (401)', async () => {
    const { verifyAdmin } = await import('@/lib/admin/auth');
    (verifyAdmin as any).mockResolvedValueOnce({
      isAdmin: false,
      error: 'unauthorized',
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('42', { fields: { smith: 'Gojo' } }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(401);
  });

  it('rejects non-admin users (403)', async () => {
    const { verifyAdmin } = await import('@/lib/admin/auth');
    (verifyAdmin as any).mockResolvedValueOnce({
      isAdmin: false,
      error: 'forbidden',
    });

    const { POST } = await import('@/app/api/listing/[id]/fix-fields/route');
    const response = await POST(
      createRequest('42', { fields: { smith: 'Gojo' } }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(403);
  });
});
