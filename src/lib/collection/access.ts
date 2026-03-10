/**
 * Collection access verification
 *
 * Checks that the authenticated user has the `collection_access` feature.
 * Call after verifying authentication (supabase.auth.getUser()).
 *
 * Required tiers: inner_circle, dealer, admin, or trial mode active.
 */

import { NextResponse } from 'next/server';
import { canAccessFeature, type SubscriptionTier } from '@/types/subscription';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if a user has collection_access.
 * Returns null if the user is authorized, or a 403 NextResponse if not.
 */
export async function checkCollectionAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<NextResponse | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_status, role')
    .eq('id', userId)
    .single() as { data: { subscription_tier: string; subscription_status: string; role: string } | null };

  // Admins always have access
  if (profile?.role === 'admin') return null;

  const tier = (profile?.subscription_tier ?? 'free') as SubscriptionTier;
  const isActive = profile?.subscription_status === 'active';
  const effectiveTier = isActive ? tier : 'free';

  if (!canAccessFeature(effectiveTier, 'collection_access')) {
    return NextResponse.json(
      { error: 'Collection access requires an eligible subscription' },
      { status: 403 }
    );
  }

  return null;
}
