import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyDealer } from '@/lib/dealer/auth';
import type { DealerAuthResult } from '@/lib/dealer/auth';

// =============================================================================
// Dealer Auth — Golden Tests
//
// verifyDealer() is the auth gate for ALL dealer API routes.
// It checks: user exists → profile has dealer tier + dealer_id.
// Admins with dealer_id also pass.
// =============================================================================

// Helper to create a mock Supabase client
function createMockSupabase({
  user = null as { id: string; email?: string } | null,
  profile = null as { role: string; subscription_tier: string; dealer_id: number | null } | null,
}: {
  user?: { id: string; email?: string } | null;
  profile?: { role: string; subscription_tier: string; dealer_id: number | null } | null;
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: profile,
            error: null,
          }),
        }),
      }),
    }),
  } as any;
}

describe('verifyDealer', () => {
  // -------------------------------------------------------------------------
  // No user → unauthorized
  // -------------------------------------------------------------------------

  it('returns unauthorized when no user session', async () => {
    const supabase = createMockSupabase({ user: null });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({ isDealer: false, error: 'unauthorized' });
  });

  // -------------------------------------------------------------------------
  // Dealer with correct setup → success
  // -------------------------------------------------------------------------

  it('returns success for dealer tier with dealer_id', async () => {
    const supabase = createMockSupabase({
      user: { id: 'user-1', email: 'dealer@example.com' },
      profile: { role: 'user', subscription_tier: 'dealer', dealer_id: 42 },
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({
      isDealer: true,
      user: { id: 'user-1', email: 'dealer@example.com' },
      dealerId: 42,
    });
  });

  // -------------------------------------------------------------------------
  // Dealer tier but no dealer_id → forbidden
  // -------------------------------------------------------------------------

  it('returns forbidden for dealer tier without dealer_id', async () => {
    const supabase = createMockSupabase({
      user: { id: 'user-2' },
      profile: { role: 'user', subscription_tier: 'dealer', dealer_id: null },
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({ isDealer: false, error: 'forbidden' });
  });

  // -------------------------------------------------------------------------
  // Non-dealer tiers → forbidden
  // -------------------------------------------------------------------------

  it('returns forbidden for free tier user', async () => {
    const supabase = createMockSupabase({
      user: { id: 'user-3' },
      profile: { role: 'user', subscription_tier: 'free', dealer_id: null },
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({ isDealer: false, error: 'forbidden' });
  });

  it('returns forbidden for free tier user', async () => {
    const supabase = createMockSupabase({
      user: { id: 'user-4' },
      profile: { role: 'user', subscription_tier: 'free', dealer_id: null },
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({ isDealer: false, error: 'forbidden' });
  });

  it('returns forbidden for inner_circle tier user', async () => {
    const supabase = createMockSupabase({
      user: { id: 'user-6' },
      profile: { role: 'user', subscription_tier: 'inner_circle', dealer_id: null },
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({ isDealer: false, error: 'forbidden' });
  });

  // -------------------------------------------------------------------------
  // Admin with dealer_id → success (for testing/support)
  // -------------------------------------------------------------------------

  it('allows admin with dealer_id to act as dealer', async () => {
    const supabase = createMockSupabase({
      user: { id: 'admin-1', email: 'admin@nihontowatch.com' },
      profile: { role: 'admin', subscription_tier: 'inner_circle', dealer_id: 99 },
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({
      isDealer: true,
      user: { id: 'admin-1', email: 'admin@nihontowatch.com' },
      dealerId: 99,
    });
  });

  // -------------------------------------------------------------------------
  // Admin without dealer_id → forbidden (can't act without a dealer context)
  // -------------------------------------------------------------------------

  it('returns forbidden for admin without dealer_id', async () => {
    const supabase = createMockSupabase({
      user: { id: 'admin-2' },
      profile: { role: 'admin', subscription_tier: 'inner_circle', dealer_id: null },
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({ isDealer: false, error: 'forbidden' });
  });

  // -------------------------------------------------------------------------
  // Edge: no profile row → forbidden
  // -------------------------------------------------------------------------

  it('returns forbidden when profile query returns null', async () => {
    const supabase = createMockSupabase({
      user: { id: 'user-orphan' },
      profile: null,
    });
    const result = await verifyDealer(supabase);
    expect(result).toEqual({ isDealer: false, error: 'forbidden' });
  });

  // -------------------------------------------------------------------------
  // Type narrowing — isDealer guard
  // -------------------------------------------------------------------------

  it('narrows type to access dealerId after isDealer check', async () => {
    const supabase = createMockSupabase({
      user: { id: 'user-1', email: 'dealer@example.com' },
      profile: { role: 'user', subscription_tier: 'dealer', dealer_id: 42 },
    });
    const result: DealerAuthResult = await verifyDealer(supabase);
    if (result.isDealer) {
      // TypeScript should narrow to the success type
      expect(result.dealerId).toBe(42);
      expect(result.user.id).toBe('user-1');
    } else {
      // Should not reach here
      expect.unreachable('Expected dealer auth to succeed');
    }
  });
});
