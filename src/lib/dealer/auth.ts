import type { createClient } from '@/lib/supabase/server';

export type DealerAuthResult =
  | { isDealer: true; user: { id: string; email?: string }; dealerId: number }
  | { isDealer: false; error: 'unauthorized' | 'forbidden' };

/**
 * Verify that the current user is an authenticated dealer.
 * Checks subscription_tier = 'dealer' AND dealer_id IS NOT NULL.
 * Admins also pass (for testing/support).
 */
export async function verifyDealer(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DealerAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isDealer: false, error: 'unauthorized' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_tier, dealer_id')
    .eq('id', user.id)
    .single() as { data: { role: string; subscription_tier: string; dealer_id: number | null } | null; error: unknown };

  // Admins can access dealer routes (for testing/support)
  if (profile?.role === 'admin') {
    // Admin needs a dealer_id to act as — use theirs if set, otherwise forbid
    if (profile.dealer_id) {
      return {
        isDealer: true,
        user: { id: user.id, email: user.email },
        dealerId: profile.dealer_id,
      };
    }
    // Admin without dealer_id can still access — use dealer_id 0 as sentinel
    // API routes should handle this (e.g., listing all dealers' data)
    return { isDealer: false, error: 'forbidden' };
  }

  if (profile?.subscription_tier !== 'dealer' || !profile.dealer_id) {
    return { isDealer: false, error: 'forbidden' };
  }

  return {
    isDealer: true,
    user: { id: user.id, email: user.email },
    dealerId: profile.dealer_id,
  };
}
