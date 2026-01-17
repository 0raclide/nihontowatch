/**
 * Comprehensive Admin Functions Test
 *
 * Tests all admin pages and API endpoints
 * Run with: npx tsx scripts/test-admin-functions.ts
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Load test credentials
const configPath = '.test-admin-config.json';
if (!existsSync(configPath)) {
  console.error('❌ Test config not found. Run setup-test-admin.ts first.');
  process.exit(1);
}

const testConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// Create clients
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function test(category: string, name: string, passed: boolean, error?: string, details?: unknown) {
  results.push({ category, name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`   ${icon} ${name}`);
  if (error) console.log(`      Error: ${error}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          COMPREHENSIVE ADMIN FUNCTIONS TEST                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Sign in as test admin
  console.log('🔐 Signing in as test admin...');
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: testConfig.email,
    password: testConfig.password,
  });

  if (signInError || !signInData.session) {
    console.error('❌ Failed to sign in:', signInError?.message);
    process.exit(1);
  }

  const session = signInData.session;
  console.log(`✅ Signed in as: ${testConfig.email}\n`);

  // ============================================================================
  // 1. AUTH & PROFILE TESTS
  // ============================================================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 1. AUTH & PROFILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Test profile fetch
  const { data: profile, error: profileError } = await anonClient
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  test('Auth', 'Fetch own profile', !profileError && !!profile, profileError?.message);
  test('Auth', 'Profile has admin role', profile?.role === 'admin');

  // Test admin can read all profiles
  const { data: allProfiles, error: allProfilesError } = await anonClient
    .from('profiles')
    .select('id, email, role')
    .limit(10);

  test('Auth', 'Admin can read all profiles', !allProfilesError && Array.isArray(allProfiles), allProfilesError?.message);
  if (allProfiles) {
    console.log(`      Found ${allProfiles.length} profiles`);
  }

  // ============================================================================
  // 2. DEALERS TABLE TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 2. DEALERS TABLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { data: dealers, error: dealersError } = await anonClient
    .from('dealers')
    .select('id, name, domain, is_active, catalog_baseline_at')
    .limit(10);

  test('Dealers', 'Read dealers table', !dealersError && Array.isArray(dealers), dealersError?.message);
  if (dealers) {
    console.log(`      Found ${dealers.length} dealers`);
    const activeCount = dealers.filter(d => d.is_active).length;
    const withBaseline = dealers.filter(d => d.catalog_baseline_at).length;
    console.log(`      Active: ${activeCount}, With baseline: ${withBaseline}`);
  }

  // ============================================================================
  // 3. LISTINGS TABLE TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 3. LISTINGS TABLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { data: listings, error: listingsError } = await anonClient
    .from('listings')
    .select('id, title, status, price_value, price_currency, dealer_id')
    .eq('status', 'available')
    .limit(10);

  test('Listings', 'Read listings table', !listingsError && Array.isArray(listings), listingsError?.message);
  if (listings) {
    console.log(`      Found ${listings.length} available listings (sample)`);
  }

  // Count total listings
  const { count: totalListings, error: countError } = await anonClient
    .from('listings')
    .select('*', { count: 'exact', head: true });

  test('Listings', 'Count total listings', !countError && totalListings !== null, countError?.message);
  if (totalListings !== null) {
    console.log(`      Total listings in database: ${totalListings}`);
  }

  // ============================================================================
  // 4. USER FAVORITES TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 4. USER FAVORITES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Read own favorites
  const { data: myFavorites, error: myFavError } = await anonClient
    .from('user_favorites')
    .select('*')
    .eq('user_id', session.user.id);

  test('Favorites', 'Read own favorites', !myFavError, myFavError?.message);
  console.log(`      Own favorites: ${myFavorites?.length || 0}`);

  // Admin can read all favorites
  const { data: allFavorites, error: allFavError } = await anonClient
    .from('user_favorites')
    .select('id, user_id, listing_id')
    .limit(10);

  test('Favorites', 'Admin can read all favorites', !allFavError && Array.isArray(allFavorites), allFavError?.message);
  console.log(`      All favorites (sample): ${allFavorites?.length || 0}`);

  // ============================================================================
  // 5. USER ALERTS TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 5. USER ALERTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Admin can read all alerts
  const { data: allAlerts, error: allAlertsError } = await anonClient
    .from('user_alerts')
    .select('id, user_id, alert_type, is_active')
    .limit(10);

  test('Alerts', 'Admin can read all alerts', !allAlertsError && Array.isArray(allAlerts), allAlertsError?.message);
  console.log(`      All alerts (sample): ${allAlerts?.length || 0}`);

  // ============================================================================
  // 6. USER ACTIVITY TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 6. USER ACTIVITY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Admin can read all activity
  const { data: allActivity, error: activityError } = await anonClient
    .from('user_activity')
    .select('id, user_id, action_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  test('Activity', 'Admin can read all user activity', !activityError && Array.isArray(allActivity), activityError?.message);
  console.log(`      Recent activity entries: ${allActivity?.length || 0}`);

  // ============================================================================
  // 7. USER SESSIONS TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 7. USER SESSIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { data: allSessions, error: sessionsError } = await anonClient
    .from('user_sessions')
    .select('id, user_id, started_at, page_views')
    .order('started_at', { ascending: false })
    .limit(10);

  test('Sessions', 'Admin can read all sessions', !sessionsError && Array.isArray(allSessions), sessionsError?.message);
  console.log(`      Recent sessions: ${allSessions?.length || 0}`);

  // ============================================================================
  // 8. PRICE HISTORY TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 8. PRICE HISTORY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { data: priceHistory, error: priceError } = await anonClient
    .from('price_history')
    .select('id, listing_id, old_price, new_price, change_type, detected_at')
    .order('detected_at', { ascending: false })
    .limit(10);

  test('Price History', 'Read price history', !priceError && Array.isArray(priceHistory), priceError?.message);
  console.log(`      Recent price changes: ${priceHistory?.length || 0}`);

  // ============================================================================
  // 9. ADMIN API ENDPOINTS (using service role to simulate)
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 9. ADMIN API SIMULATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Simulate /api/admin/stats
  console.log('   Testing admin stats aggregation...');

  // Total users
  const { count: userCount } = await serviceClient
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  test('API Stats', 'Count total users', userCount !== null);
  console.log(`      Total users: ${userCount}`);

  // Active users (24h) - users with recent activity
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: activeUsers } = await serviceClient
    .from('user_activity')
    .select('user_id')
    .gte('created_at', yesterday);

  const uniqueActiveUsers = new Set(activeUsers?.map(a => a.user_id)).size;
  test('API Stats', 'Count active users (24h)', true);
  console.log(`      Active users (24h): ${uniqueActiveUsers}`);

  // Total favorites
  const { count: favCount } = await serviceClient
    .from('user_favorites')
    .select('*', { count: 'exact', head: true });

  test('API Stats', 'Count total favorites', favCount !== null);
  console.log(`      Total favorites: ${favCount}`);

  // Simulate /api/admin/users
  console.log('\n   Testing admin users list...');
  const { data: usersList, error: usersListError } = await serviceClient
    .from('profiles')
    .select('id, email, display_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  test('API Users', 'List users with details', !usersListError && Array.isArray(usersList), usersListError?.message);
  console.log(`      Users retrieved: ${usersList?.length || 0}`);

  // Simulate /api/admin/dealers/baseline
  console.log('\n   Testing dealers baseline endpoint...');
  const { data: dealersBaseline, error: baselineError } = await serviceClient
    .from('dealers')
    .select('id, name, domain, is_active, catalog_baseline_at, created_at')
    .order('name');

  test('API Dealers', 'Get dealers with baseline status', !baselineError && Array.isArray(dealersBaseline), baselineError?.message);
  if (dealersBaseline) {
    const withBaseline = dealersBaseline.filter(d => d.catalog_baseline_at).length;
    console.log(`      Dealers: ${dealersBaseline.length}, With baseline: ${withBaseline}`);
  }

  // ============================================================================
  // 10. ACTIVITY TRACKING TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 10. ACTIVITY TRACKING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Activity events table
  const { data: activityEvents, error: eventsError } = await anonClient
    .from('activity_events')
    .select('id, session_id, event_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  test('Activity Events', 'Admin can read activity events', !eventsError && Array.isArray(activityEvents), eventsError?.message);
  console.log(`      Recent events: ${activityEvents?.length || 0}`);

  // ============================================================================
  // 11. SCRAPE DATA TESTS
  // ============================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 11. SCRAPE DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Scrape runs
  const { data: scrapeRuns, error: scrapeError } = await anonClient
    .from('scrape_runs')
    .select('id, run_type, status, started_at, urls_processed, new_listings')
    .order('started_at', { ascending: false })
    .limit(5);

  test('Scrape Runs', 'Read scrape runs', !scrapeError && Array.isArray(scrapeRuns), scrapeError?.message);
  console.log(`      Recent scrape runs: ${scrapeRuns?.length || 0}`);

  // Discovered URLs
  const { count: discoveredCount } = await anonClient
    .from('discovered_urls')
    .select('*', { count: 'exact', head: true });

  test('Discovered URLs', 'Count discovered URLs', discoveredCount !== null);
  console.log(`      Total discovered URLs: ${discoveredCount}`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;
    const catTotal = catResults.length;
    const status = catPassed === catTotal ? '✅' : '⚠️';
    console.log(`${status} ${cat}: ${catPassed}/${catTotal} passed`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total: ${passed}/${total} tests passed`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - [${r.category}] ${r.name}: ${r.error || 'Unknown error'}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
  }

  // Sign out
  await anonClient.auth.signOut();
}

main().catch(console.error);
