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

  it('allows inner_circle tier', async () => {
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'inner_circle', subscription_status: 'active', role: 'user' }),
      'user-1'
    );
    expect(res).toBeNull();
  });

  it('denies free tier (below inner_circle)', async () => {
    // Free tier cannot access collection even with active status
    const res = await checkCollectionAccess(
      mockSupabase({ subscription_tier: 'free', subscription_status: 'active', role: 'user' }),
      'user-1'
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

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
