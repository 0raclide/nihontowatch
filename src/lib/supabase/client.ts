import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Environment variables with empty string fallbacks for type safety
// The || '' ensures we always have a string type for createBrowserClient
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Runtime validation - warn if not configured (browser only)
if (typeof window !== 'undefined') {
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
}

/**
 * Create a new Supabase client for use in Client Components
 *
 * Note: We create a fresh client each call to avoid stale state issues.
 * The @supabase/ssr package handles session persistence via cookies automatically.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
