/**
 * Server-side Subscription Utilities
 *
 * Helpers for checking subscription tier on the server.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { SubscriptionTier, SubscriptionStatus } from '@/types/subscription';
import { isTrialModeActive } from '@/types/subscription';

/**
 * 72 hours in milliseconds - data delay for free tier
 */
export const DATA_DELAY_MS = 72 * 60 * 60 * 1000;

/**
 * Get subscription info for the current user (from auth session)
 * Returns free tier for anonymous users or users without active subscriptions
 */
export async function getUserSubscription(): Promise<{
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  userId: string | null;
  isDelayed: boolean;
  isAdmin: boolean;
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Subscription] Auth check:', user?.id || 'no user', authError?.message || 'no error');

    if (!user) {
      console.log('[Subscription] No user found, returning free tier');
      return {
        tier: 'free',
        status: 'inactive',
        userId: null,
        isDelayed: isTrialModeActive() ? false : true,
        isAdmin: false,
      };
    }

    // Get user's subscription and role from profile
    // Try service client first (bypasses RLS), fall back to auth client
    let profile: {
      subscription_tier: SubscriptionTier | null;
      subscription_status: SubscriptionStatus | null;
      role: string | null;
    } | null = null;

    const serviceClient = createServiceClient();
    const { data: serviceProfile, error: serviceError } = await serviceClient
      .from('profiles')
      .select('subscription_tier, subscription_status, role')
      .eq('id', user.id)
      .single() as {
        data: {
          subscription_tier: SubscriptionTier | null;
          subscription_status: SubscriptionStatus | null;
          role: string | null;
        } | null;
        error: { message: string } | null;
      };

    if (serviceProfile) {
      profile = serviceProfile;
      console.log('[Subscription] Got profile via service client');
    } else {
      console.log('[Subscription] Service client failed:', serviceError?.message || 'unknown error');
      // Fall back to authenticated client (uses user's session/RLS)
      const { data: authProfile, error: authProfileError } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, role')
        .eq('id', user.id)
        .single() as {
          data: {
            subscription_tier: SubscriptionTier | null;
            subscription_status: SubscriptionStatus | null;
            role: string | null;
          } | null;
          error: { message: string } | null;
        };

      if (authProfile) {
        profile = authProfile;
        console.log('[Subscription] Got profile via auth client');
      } else {
        console.log('[Subscription] Auth client also failed:', authProfileError?.message || 'unknown error');
      }
    }

    // Admins get full access (connoisseur tier)
    const isAdmin = profile?.role === 'admin';
    console.log('[Subscription] User:', user.id, 'Role:', profile?.role, 'IsAdmin:', isAdmin);
    if (isAdmin) {
      console.log('[Subscription] Admin detected, granting full access');
      return {
        tier: 'connoisseur',
        status: 'active',
        userId: user.id,
        isDelayed: false,
        isAdmin: true,
      };
    }

    const tier = profile?.subscription_tier ?? 'free';
    const status = profile?.subscription_status ?? 'inactive';

    // Effective tier: only active subscriptions get premium features
    const effectiveTier = status === 'active' ? tier : 'free';

    return {
      tier: effectiveTier,
      status,
      userId: user.id,
      isDelayed: isTrialModeActive() ? false : effectiveTier === 'free',
      isAdmin: false,
    };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return {
      tier: 'free',
      status: 'inactive',
      userId: null,
      isDelayed: isTrialModeActive() ? false : true,
      isAdmin: false,
    };
  }
}

/**
 * Get the cutoff date for free tier data delay
 * Returns an ISO string 72 hours in the past
 */
export function getDataDelayCutoff(): string {
  return new Date(Date.now() - DATA_DELAY_MS).toISOString();
}
