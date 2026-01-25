/**
 * Debug script to test if the browse API consistently returns isAdmin: true
 * for an authenticated admin user.
 *
 * Run: npx ts-node scripts/debug-admin-api.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length && !process.env[key.trim()]) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

// Load test config
const testConfig = JSON.parse(readFileSync('.test-admin-config.json', 'utf-8'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function main() {
  console.log('=== Admin API Debug Script ===\n');

  // Create Supabase client and sign in
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log(`Signing in as ${testConfig.email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testConfig.email,
    password: testConfig.password,
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log(`Signed in as user: ${authData.user?.id}`);
  const session = authData.session;

  // Check user's profile
  console.log('\n--- Checking Profile ---');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, subscription_tier')
    .eq('id', authData.user!.id)
    .single();

  if (profileError) {
    console.error('Profile error:', profileError);
  } else {
    console.log('Profile:', profile);
    console.log(`Role: ${profile?.role}, Expected isAdmin: ${profile?.role === 'admin'}`);
  }

  // Make multiple API calls with the session
  console.log('\n--- Testing Browse API ---');

  const baseUrl = 'http://localhost:3000';
  const endpoints = [
    '/api/browse?limit=1',
    '/api/browse?limit=1&category=nihonto',
    '/api/browse?limit=1&category=tosogu',
    '/api/browse?limit=1&certifications=Juyo',
  ];

  for (const endpoint of endpoints) {
    console.log(`\nFetching: ${endpoint}`);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Cookie': `sb-access-token=${session?.access_token}; sb-refresh-token=${session?.refresh_token}`,
        },
      });

      const json = await response.json();
      console.log(`  isAdmin: ${json.isAdmin}`);
      console.log(`  _debug: ${JSON.stringify(json._debug || 'not present')}`);

      if (json.isAdmin !== true) {
        console.log('  ❌ ISSUE: isAdmin should be true!');
      } else {
        console.log('  ✅ OK');
      }
    } catch (error) {
      console.error(`  Error:`, error);
    }
  }

  // Sign out
  await supabase.auth.signOut();
  console.log('\n=== Done ===');
}

main().catch(console.error);
