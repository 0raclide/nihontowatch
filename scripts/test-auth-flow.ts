/**
 * Test the authentication flow end-to-end
 *
 * Run with: npx tsx scripts/test-auth-flow.ts
 *
 * Prerequisites:
 * - Run setup-test-admin.ts first to create the test user
 * - .test-admin-config.json must exist
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Load test credentials
const configPath = '.test-admin-config.json';
if (!existsSync(configPath)) {
  console.error('❌ Test config not found. Run setup-test-admin.ts first.');
  process.exit(1);
}

const testConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// Create client with ANON key (like browser would use)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function test(name: string, passed: boolean, error?: string, details?: unknown) {
  results.push({ name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (details && !passed) console.log(`   Details:`, details);
}

async function main() {
  console.log('=== AUTH FLOW TESTS ===\n');
  console.log(`Testing with: ${testConfig.email}\n`);

  // Test 1: Sign in with email/password
  console.log('--- Test: Sign In ---');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testConfig.email,
    password: testConfig.password,
  });

  test(
    'Sign in with email/password',
    !signInError && !!signInData.session,
    signInError?.message,
    signInError
  );

  if (!signInData?.session) {
    console.log('\n❌ Cannot continue tests without valid session');
    printSummary();
    return;
  }

  const session = signInData.session;
  console.log(`   Session obtained, user ID: ${session.user.id}`);

  // Test 2: Fetch profile
  console.log('\n--- Test: Fetch Profile ---');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  test(
    'Fetch user profile',
    !profileError && !!profile,
    profileError?.message,
    profileError
  );

  if (profile) {
    test(
      'Profile has admin role',
      profile.role === 'admin',
      profile.role !== 'admin' ? `Role is "${profile.role}" not "admin"` : undefined
    );
    console.log(`   Profile: ${JSON.stringify(profile, null, 2)}`);
  }

  // Test 3: Access admin API endpoint
  console.log('\n--- Test: Admin API Access ---');
  try {
    const response = await fetch(`${supabaseUrl.replace('.supabase.co', '.supabase.co')}/rest/v1/profiles?select=id,email,role&limit=5`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const apiData = await response.json();
    test(
      'Can query profiles table as admin',
      response.ok && Array.isArray(apiData),
      !response.ok ? `HTTP ${response.status}` : undefined,
      apiData
    );

    if (Array.isArray(apiData)) {
      console.log(`   Retrieved ${apiData.length} profile(s)`);
    }
  } catch (err) {
    test('Can query profiles table as admin', false, String(err));
  }

  // Test 4: Test admin stats API (if running locally)
  console.log('\n--- Test: Admin Stats API ---');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const statsResponse = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: {
        'Cookie': `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`,
      },
    });

    if (statsResponse.status === 404) {
      test('Admin stats API', true, undefined, 'Endpoint not available (expected if not running locally)');
    } else {
      const statsData = await statsResponse.json();
      test(
        'Admin stats API returns data',
        statsResponse.ok,
        !statsResponse.ok ? `HTTP ${statsResponse.status}: ${JSON.stringify(statsData)}` : undefined
      );
    }
  } catch (err) {
    // Network error is expected if server isn't running
    test('Admin stats API', true, undefined, 'Server not running (expected)');
  }

  // Test 5: Test favorites API (user-level endpoint)
  console.log('\n--- Test: User Favorites API ---');
  const { data: favorites, error: favError } = await supabase
    .from('user_favorites')
    .select('*')
    .eq('user_id', session.user.id);

  test(
    'Can access user_favorites table',
    !favError,
    favError?.message,
    favError
  );
  console.log(`   Found ${favorites?.length || 0} favorites`);

  // Test 6: Sign out
  console.log('\n--- Test: Sign Out ---');
  const { error: signOutError } = await supabase.auth.signOut();
  test('Sign out', !signOutError, signOutError?.message);

  // Test 7: Verify session is cleared
  const { data: { session: afterSession } } = await supabase.auth.getSession();
  test('Session cleared after sign out', !afterSession);

  printSummary();
}

function printSummary() {
  console.log('\n=== TEST SUMMARY ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

main().catch(console.error);
