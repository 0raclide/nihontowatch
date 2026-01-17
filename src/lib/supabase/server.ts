import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// Environment variables with empty string fallbacks for type safety
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate on first import (server-side)
if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.error(
    '[Supabase] NEXT_PUBLIC_SUPABASE_URL is not configured. ' +
    'Check your .env.local file or Vercel environment settings.'
  );
}
if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
  console.error(
    '[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured. ' +
    'Check your .env.local file or Vercel environment settings.'
  );
}

/**
 * Create a Supabase client for use in Server Components and Route Handlers
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase client with service role key for admin operations
 * WARNING: Only use in trusted server-side contexts
 * Logs error if SUPABASE_SERVICE_ROLE_KEY is not configured
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceRoleKey) {
    console.error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'Admin operations will fail.'
    );
  }

  return createServerClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
