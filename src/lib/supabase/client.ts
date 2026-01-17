import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Fallbacks for build time (will be replaced with actual values at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

/**
 * Singleton Supabase client for browser use
 * Created at module level for consistent auth state (matches oshi-v2 pattern)
 */
const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Get the Supabase client for use in Client Components
 */
export function createClient() {
  return supabase;
}
