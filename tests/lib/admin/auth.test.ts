/**
 * Admin Auth Utility Tests
 *
 * Tests the verifyAdmin function from @/lib/admin/auth.
 * Verifies authentication and authorization logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Next.js cookies before importing
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Import after mocks are set up
import { verifyAdmin } from '@/lib/admin/auth';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockProfileBuilder(role: string | null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.single = vi.fn(() =>
    Promise.resolve({
      data: role ? { role } : null,
      error: role ? null : { message: 'Not found' },
    })
  );

  return builder;
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('verifyAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // UNAUTHENTICATED USER TESTS
  // ===========================================================================

  describe('unauthenticated user', () => {
    it('returns unauthorized for no user session', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(false);
      if (!result.isAdmin) {
        expect(result.error).toBe('unauthorized');
      }
    });

    it('returns unauthorized for auth error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      });

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(false);
      if (!result.isAdmin) {
        expect(result.error).toBe('unauthorized');
      }
    });
  });

  // ===========================================================================
  // NON-ADMIN USER TESTS
  // ===========================================================================

  describe('non-admin user', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'user@example.com' } },
        error: null,
      });
    });

    it('returns forbidden for user role', async () => {
      const profileBuilder = createMockProfileBuilder('user');
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(false);
      if (!result.isAdmin) {
        expect(result.error).toBe('forbidden');
      }
    });

    it('returns forbidden for null role', async () => {
      const profileBuilder = createMockProfileBuilder(null);
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(false);
      if (!result.isAdmin) {
        expect(result.error).toBe('forbidden');
      }
    });

    it('returns forbidden for empty role', async () => {
      const builder: Record<string, ReturnType<typeof vi.fn>> = {};
      const chain = () => builder;

      builder.select = vi.fn(() => chain());
      builder.eq = vi.fn(() => chain());
      builder.single = vi.fn(() =>
        Promise.resolve({ data: { role: '' }, error: null })
      );

      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(false);
    });

    it('returns forbidden for unknown role', async () => {
      const profileBuilder = createMockProfileBuilder('moderator');
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(false);
      if (!result.isAdmin) {
        expect(result.error).toBe('forbidden');
      }
    });
  });

  // ===========================================================================
  // ADMIN USER TESTS
  // ===========================================================================

  describe('admin user', () => {
    it('returns isAdmin true for admin role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123', email: 'admin@example.com' } },
        error: null,
      });

      const profileBuilder = createMockProfileBuilder('admin');
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(true);
      if (result.isAdmin) {
        expect(result.user.id).toBe('admin-123');
        expect(result.user.email).toBe('admin@example.com');
      }
    });

    it('returns user object with id and email', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-456', email: 'super@admin.com' } },
        error: null,
      });

      const profileBuilder = createMockProfileBuilder('admin');
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(true);
      if (result.isAdmin) {
        expect(result.user).toEqual({
          id: 'admin-456',
          email: 'super@admin.com',
        });
      }
    });

    it('queries profiles table with correct user ID', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-789' } },
        error: null,
      });

      const profileBuilder = createMockProfileBuilder('admin');
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      await verifyAdmin(mockSupabaseClient as never);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(profileBuilder.select).toHaveBeenCalledWith('role');
      expect(profileBuilder.eq).toHaveBeenCalledWith('id', 'user-789');
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles missing email in user object', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-no-email' } }, // No email property
        error: null,
      });

      const profileBuilder = createMockProfileBuilder('admin');
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      expect(result.isAdmin).toBe(true);
      if (result.isAdmin) {
        expect(result.user.id).toBe('admin-no-email');
        expect(result.user.email).toBeUndefined();
      }
    });

    it('is case-sensitive for admin role', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Test uppercase ADMIN
      const profileBuilder = createMockProfileBuilder('ADMIN');
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const result = await verifyAdmin(mockSupabaseClient as never);

      // Should NOT be admin because it's case sensitive
      expect(result.isAdmin).toBe(false);
    });
  });
});
