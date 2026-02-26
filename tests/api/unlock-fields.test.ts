import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for POST /api/listing/[id]/unlock-fields
 *
 * Admin endpoint to remove fields from admin_locked_fields JSONB.
 * Does NOT change field values — the next scraper run will overwrite them.
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

// Helper to create a NextRequest with route params
function createRequest(listingId: string, body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/listing/${listingId}/unlock-fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/listing/[id]/unlock-fields', () => {
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

  it('removes specified fields from admin_locked_fields', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: { smith: true, province: true, era: true } },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('42', { fields: ['smith', 'province'] }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.unlockedFields).toEqual(['smith', 'province']);
    expect(data.lockedFields).toEqual({ era: true });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_locked_fields: { era: true },
      }),
    );
  });

  it('preserves unrelated locked fields when unlocking one', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: { smith: true, school: true, nagasa_cm: true } },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('42', { fields: ['school'] }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lockedFields).toEqual({ smith: true, nagasa_cm: true });
  });

  it('returns empty object when unlocking the last locked field', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: { smith: true } },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('42', { fields: ['smith'] }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lockedFields).toEqual({});

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_locked_fields: {},
      }),
    );
  });

  it('handles unlocking when field was not locked (no-op, still 200)', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 42, admin_locked_fields: { smith: true } },
      error: null,
    });

    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('42', { fields: ['province'] }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    // smith still locked, province was never locked — no error
    expect(data.lockedFields).toEqual({ smith: true });
  });

  it('rejects empty fields array (400)', async () => {
    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('42', { fields: [] }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/required/i);
  });

  it('rejects non-array fields value (400)', async () => {
    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('42', { fields: 'smith' }) as any,
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

    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('9999', { fields: ['smith'] }) as any,
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

    const { POST } = await import('@/app/api/listing/[id]/unlock-fields/route');
    const response = await POST(
      createRequest('42', { fields: ['smith'] }) as any,
      createParams('42') as any,
    );

    expect(response.status).toBe(401);
  });
});
