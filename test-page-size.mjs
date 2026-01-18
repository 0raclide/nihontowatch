#!/usr/bin/env node

// Test script to verify API returns 100 items
// Run with: node test-page-size.mjs

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testAPI() {
  console.log(`\nTesting API at: ${BASE_URL}/api/browse\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/browse?tab=available`);
    const data = await response.json();

    console.log('=== API Response Summary ===');
    console.log(`  listings.length: ${data.listings?.length ?? 'undefined'}`);
    console.log(`  total: ${data.total}`);
    console.log(`  page: ${data.page}`);
    console.log(`  totalPages: ${data.totalPages}`);
    console.log('');

    if (data.listings?.length === 100) {
      console.log('✅ SUCCESS: API returns 100 items');
    } else if (data.listings?.length === 30) {
      console.log('❌ FAIL: API still returns 30 items (old default)');
      console.log('   → Try restarting the dev server: npm run dev');
    } else if (data.listings?.length < 100) {
      console.log(`⚠️  API returns ${data.listings?.length} items`);
      console.log(`   → This might be correct if total items < 100`);
      console.log(`   → Total in database: ${data.total}`);
    }

    // Also check if there are enough items in the database
    if (data.total < 100) {
      console.log(`\nNote: Database only has ${data.total} total items.`);
      console.log('The page size of 100 is correct, but fewer items exist.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure the dev server is running: npm run dev');
  }
}

testAPI();
