import { describe, it, expect, afterEach, vi } from 'vitest';
import { checkCollectionAccess } from '@/lib/collection/access';

/** Build a mock Supabase client that returns the given profile row. */
function mockSupabase(data: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data }),
        }),
      }),
    }),
  } as any;
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_TRIAL_MODE;
});

describe('checkCollectionAccess', () => {
  it('denies free tier', async () => {
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'free', subscription_status: 'active', role: 'user' }),
      'user-1'
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('allows yuhinkai + active', async () => {
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'yuhinkai', subscription_status: 'active', role: 'user' }),
      'user-1'
    );
    expect(res).toBeNull();
  });

  it('denies yuhinkai + inactive', async () => {
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'yuhinkai', subscription_status: 'inactive', role: 'user' }),
      'user-1'
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('allows dealer + active', async () => {
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'dealer', subscription_status: 'active', role: 'user' }),
      'user-1'
    );
    expect(res).toBeNull();
  });

  it('allows admin regardless of tier/status', async () => {
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'free', subscription_status: 'inactive', role: 'admin' }),
      'user-1'
    );
    expect(res).toBeNull();
  });

  it.each(['enthusiast', 'collector', 'inner_circle'] as const)(
    'allows %s tier (rank >= yuhinkai)',
    async (tier) => {
      const res = await checkCollectionAccess(
        mockSupabase({ subscription_tier: tier, subscription_status: 'active', role: 'user' }),
        'user-1'
      );
      expect(res).toBeNull();
    }
  );

  it('denies when profile not found', async () => {
    const res = await checkCollectionAccess(mockSupabase(null), 'user-1');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('allows free tier when trial mode is active', async () => {
    process.env.NEXT_PUBLIC_TRIAL_MODE = 'true';
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'free', subscription_status: 'active', role: 'user' }),
      'user-1'
    );
    expect(res).toBeNull();
  });
});
