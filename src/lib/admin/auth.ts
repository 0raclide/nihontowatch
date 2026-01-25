/**
 * Admin Authentication Utilities
 *
 * Provides shared authentication helpers for admin API routes.
 * Verifies that the current user has admin privileges.
 *
 * @module lib/admin/auth
 *
 * Usage:
 *   import { verifyAdmin } from '@/lib/admin/auth';
 *
 *   const authResult = await verifyAdmin(supabase);
 *   if (!authResult.isAdmin) {
 *     return authResult.error === 'unauthorized'
 *       ? apiUnauthorized()
 *       : apiForbidden();
 *   }
 *   // User is verified admin, proceed with authResult.user
 */

import type { createClient } from '@/lib/supabase/server';

/**
 * Result of admin verification
 */
export type AdminAuthResult =
  | { isAdmin: true; user: { id: string; email?: string } }
  | { isAdmin: false; error: 'unauthorized' | 'forbidden' };

/**
 * Verify that the current user has admin privileges.
 *
 * Checks:
 * 1. User is authenticated
 * 2. User has 'admin' role in profiles table
 *
 * @param supabase - Supabase client instance
 * @returns AdminAuthResult with either isAdmin: true and user, or isAdmin: false with error type
 *
 * @example
 * const authResult = await verifyAdmin(supabase);
 * if (!authResult.isAdmin) {
 *   return authResult.error === 'unauthorized'
 *     ? apiUnauthorized()
 *     : apiForbidden();
 * }
 * // Use authResult.user.id
 */
export async function verifyAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AdminAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, error: 'unauthorized' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (profile?.role !== 'admin') {
    return { isAdmin: false, error: 'forbidden' };
  }

  return {
    isAdmin: true,
    user: { id: user.id, email: user.email },
  };
}
