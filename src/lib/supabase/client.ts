import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Fallbacks for build time (will be replaced with actual values at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

/**
 * Create a new Supabase client for use in Client Components
 *
 * Note: We create a fresh client each call to avoid stale state issues.
 * The @supabase/ssr package handles session persistence via cookies automatically.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
