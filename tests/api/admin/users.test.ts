/**
 * Admin Users API Unit Tests
 *
 * CRITICAL: Tests the /api/admin/users endpoint which manages user roles.
 * This is a critical security boundary - admin role changes must be handled correctly.
 *
 * Tests:
 * 1. GET endpoint - List users with role transformation
 * 2. PATCH endpoint - Update user roles
 * 3. Role transformation logic (role column → is_admin boolean)
 * 4. Authentication and authorization
 * 5. Edge cases and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Next.js cookies before importing the route handler
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

import { GET, PATCH } from '@/app/api/admin/users/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(
  params: Record<string, string> = {},
  method: 'GET' | 'PATCH' = 'GET',
  body?: Record<string, unknown>
): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/users');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const request = new NextRequest(url, {
    method,
    ...(body && {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  });

  return request;
}

function createMockQueryBuilder(
  data: unknown[] | null = [],
  count: number | null = 0,
  error: { message: string; code?: string } | null = null
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.or = vi.fn(() => chain());
  builder.order = vi.fn(() => chain());
  builder.range = vi.fn(() => chain());
  builder.update = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: data?.[0] ?? null, error }));

  builder.then = vi.fn((resolve: (result: { data: unknown[] | null; error: typeof error; count: number | null }) => void) => {
    resolve({ data, error, count });
  });

  Object.defineProperty(builder, 'data', { get: () => data });
  Object.defineProperty(builder, 'error', { get: () => error });
  Object.defineProperty(builder, 'count', { get: () => count });

  return builder;
}

function setupAdminAuth(userId = 'admin-123') {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email: 'admin@example.com' } },
    error: null,
  });
}

function setupNonAdminAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'user@example.com' } },
    error: null,
  });
}

function setupNoAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      setupNoAuth();

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 for non-admin users', async () => {
      setupNonAdminAuth();

      const profileBuilder = createMockQueryBuilder([{ role: 'user' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'user' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('allows admin users to access the endpoint', async () => {
      setupAdminAuth();

      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const usersBuilder = createMockQueryBuilder([], 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          // First call for auth check
          if (profileBuilder.single.mock.calls.length === 0) {
            return profileBuilder;
          }
          // Second call for users list
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  // ===========================================================================
  // ROLE TRANSFORMATION TESTS (CRITICAL)
  // ===========================================================================

  describe('role transformation', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it('transforms role="admin" to is_admin=true', async () => {
      let callCount = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;

          // First call: auth check
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }

          // Second call: users list
          const usersBuilder = createMockQueryBuilder([
            {
              id: 'user-1',
              email: 'admin@example.com',
              display_name: 'Admin User',
              role: 'admin',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ], 1);
          return usersBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.users).toHaveLength(1);
      expect(json.users[0].is_admin).toBe(true);
      expect(json.users[0]).not.toHaveProperty('role');
    });

    it('transforms role="user" to is_admin=false', async () => {
      let callCount = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;

          // First call: auth check
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }

          // Second call: users list
          const usersBuilder = createMockQueryBuilder([
            {
              id: 'user-2',
              email: 'user@example.com',
              display_name: 'Regular User',
              role: 'user',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ], 1);
          return usersBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.users).toHaveLength(1);
      expect(json.users[0].is_admin).toBe(false);
      expect(json.users[0]).not.toHaveProperty('role');
    });

    it('transforms multiple users with mixed roles correctly', async () => {
      let callCount = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;

          // First call: auth check
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }

          // Second call: users list
          const usersBuilder = createMockQueryBuilder([
            {
              id: 'user-1',
              email: 'admin@example.com',
              display_name: 'Admin User',
              role: 'admin',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'user-2',
              email: 'user@example.com',
              display_name: 'Regular User',
              role: 'user',
              created_at: '2024-01-02T00:00:00Z',
              updated_at: '2024-01-02T00:00:00Z',
            },
            {
              id: 'user-3',
              email: 'admin2@example.com',
              display_name: 'Another Admin',
              role: 'admin',
              created_at: '2024-01-03T00:00:00Z',
              updated_at: '2024-01-03T00:00:00Z',
            },
          ], 3);
          return usersBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.users).toHaveLength(3);
      expect(json.users[0].is_admin).toBe(true);
      expect(json.users[1].is_admin).toBe(false);
      expect(json.users[2].is_admin).toBe(true);
    });
  });

  // ===========================================================================
  // PAGINATION TESTS
  // ===========================================================================

  describe('pagination', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it('defaults to page 1 and limit 20', async () => {
      let callCount = 0;
      const usersBuilder = createMockQueryBuilder([], 100);
      usersBuilder.range = vi.fn(() => usersBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.page).toBe(1);
      expect(json.totalPages).toBe(5); // 100 / 20 = 5
      expect(usersBuilder.range).toHaveBeenCalledWith(0, 19); // First 20 items
    });

    it('respects page parameter', async () => {
      let callCount = 0;
      const usersBuilder = createMockQueryBuilder([], 100);
      usersBuilder.range = vi.fn(() => usersBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest({ page: '3' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.page).toBe(3);
      expect(usersBuilder.range).toHaveBeenCalledWith(40, 59); // Third page (20-item chunks)
    });

    it('respects limit parameter (max 100)', async () => {
      let callCount = 0;
      const usersBuilder = createMockQueryBuilder([], 200);
      usersBuilder.range = vi.fn(() => usersBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest({ limit: '50' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(usersBuilder.range).toHaveBeenCalledWith(0, 49); // First 50 items
    });

    it('caps limit at 100 even if higher requested', async () => {
      let callCount = 0;
      const usersBuilder = createMockQueryBuilder([], 200);
      usersBuilder.range = vi.fn(() => usersBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest({ limit: '500' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(usersBuilder.range).toHaveBeenCalledWith(0, 99); // Max 100 items
    });
  });

  // ===========================================================================
  // SEARCH TESTS
  // ===========================================================================

  describe('search', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it('applies search filter when provided', async () => {
      let callCount = 0;
      const usersBuilder = createMockQueryBuilder([], 0);
      usersBuilder.or = vi.fn(() => usersBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest({ search: 'john' });
      await GET(request);

      expect(usersBuilder.or).toHaveBeenCalledWith(
        'email.ilike.%john%,display_name.ilike.%john%'
      );
    });

    it('does not apply search filter when empty', async () => {
      let callCount = 0;
      const usersBuilder = createMockQueryBuilder([], 0);
      usersBuilder.or = vi.fn(() => usersBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest();
      await GET(request);

      expect(usersBuilder.or).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(() => {
      setupAdminAuth();
    });

    it('returns 500 when database query fails', async () => {
      let callCount = 0;
      const usersBuilder = createMockQueryBuilder(null, null, {
        message: 'Database error',
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          callCount++;
          if (callCount === 1) {
            const authBuilder = createMockQueryBuilder([{ role: 'admin' }]);
            authBuilder.single = vi.fn(() =>
              Promise.resolve({ data: { role: 'admin' }, error: null })
            );
            return authBuilder;
          }
          return usersBuilder;
        }
        return usersBuilder;
      });

      const request = createMockRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Database error');
    });
  });
});

// =============================================================================
// PATCH TESTS (UPDATE USER ROLE)
// =============================================================================

describe('PATCH /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      setupNoAuth();

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-123',
        isAdmin: true,
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 for non-admin users', async () => {
      setupNonAdminAuth();

      const profileBuilder = createMockQueryBuilder([{ role: 'user' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'user' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-123',
        isAdmin: true,
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });
  });

  // ===========================================================================
  // VALIDATION TESTS
  // ===========================================================================

  describe('validation', () => {
    beforeEach(() => {
      setupAdminAuth();
      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );
      mockSupabaseClient.from.mockReturnValue(profileBuilder);
    });

    it('requires userId parameter', async () => {
      const request = createMockRequest({}, 'PATCH', {
        isAdmin: true,
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('userId and isAdmin are required');
    });

    it('requires isAdmin parameter', async () => {
      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-123',
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('userId and isAdmin are required');
    });

    it('requires isAdmin to be a boolean', async () => {
      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-123',
        isAdmin: 'yes',
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('userId and isAdmin are required');
    });

    it('prevents admin from removing their own admin status', async () => {
      setupAdminAuth('admin-123');

      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );
      mockSupabaseClient.from.mockReturnValue(profileBuilder);

      const request = createMockRequest({}, 'PATCH', {
        userId: 'admin-123',
        isAdmin: false,
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Cannot remove your own admin status');
    });

    it('allows admin to promote other users', async () => {
      setupAdminAuth('admin-123');

      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const updateBuilder = createMockQueryBuilder(null, null, null);
      updateBuilder.update = vi.fn(() => updateBuilder);
      updateBuilder.eq = vi.fn(() => updateBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          // First call is auth check
          if (profileBuilder.single.mock.calls.length === 0) {
            return profileBuilder;
          }
          // Second call is the update
          return updateBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-456',
        isAdmin: true,
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ===========================================================================
  // ROLE UPDATE TESTS (CRITICAL)
  // ===========================================================================

  describe('role updates', () => {
    beforeEach(() => {
      setupAdminAuth('admin-123');
    });

    it('updates role to "admin" when isAdmin is true', async () => {
      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const updateBuilder = createMockQueryBuilder(null, null, null);
      updateBuilder.update = vi.fn(() => updateBuilder);
      updateBuilder.eq = vi.fn(() => updateBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          if (profileBuilder.single.mock.calls.length === 0) {
            return profileBuilder;
          }
          return updateBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-456',
        isAdmin: true,
      });
      await PATCH(request);

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
        })
      );
    });

    it('updates role to "user" when isAdmin is false', async () => {
      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const updateBuilder = createMockQueryBuilder(null, null, null);
      updateBuilder.update = vi.fn(() => updateBuilder);
      updateBuilder.eq = vi.fn(() => updateBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          if (profileBuilder.single.mock.calls.length === 0) {
            return profileBuilder;
          }
          return updateBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-456',
        isAdmin: false,
      });
      await PATCH(request);

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
        })
      );
    });

    it('updates updated_at timestamp', async () => {
      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const updateBuilder = createMockQueryBuilder(null, null, null);
      updateBuilder.update = vi.fn(() => updateBuilder);
      updateBuilder.eq = vi.fn(() => updateBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          if (profileBuilder.single.mock.calls.length === 0) {
            return profileBuilder;
          }
          return updateBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-456',
        isAdmin: true,
      });
      await PATCH(request);

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        })
      );
    });

    it('targets the correct user ID', async () => {
      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const updateBuilder = createMockQueryBuilder(null, null, null);
      updateBuilder.update = vi.fn(() => updateBuilder);
      updateBuilder.eq = vi.fn(() => updateBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          if (profileBuilder.single.mock.calls.length === 0) {
            return profileBuilder;
          }
          return updateBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-789',
        isAdmin: true,
      });
      await PATCH(request);

      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'user-789');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(() => {
      setupAdminAuth('admin-123');
    });

    it('returns 500 when update fails', async () => {
      const profileBuilder = createMockQueryBuilder([{ role: 'admin' }]);
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const updateBuilder = createMockQueryBuilder(null, null, {
        message: 'Update failed',
      });
      updateBuilder.update = vi.fn(() => updateBuilder);
      updateBuilder.eq = vi.fn(() => updateBuilder);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          if (profileBuilder.single.mock.calls.length === 0) {
            return profileBuilder;
          }
          return updateBuilder;
        }
        return createMockQueryBuilder();
      });

      const request = createMockRequest({}, 'PATCH', {
        userId: 'user-456',
        isAdmin: true,
      });
      const response = await PATCH(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Update failed');
    });
  });
});
