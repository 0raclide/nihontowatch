/**
 * Setup a test admin user for automated testing
 *
 * Run with: npx tsx scripts/setup-test-admin.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as crypto from 'crypto';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test admin credentials - complex password
const TEST_ADMIN_EMAIL = 'test-admin@nihontowatch.local';
const TEST_ADMIN_PASSWORD = 'NW_T3st_Adm!n_2024_$ecure';

async function main() {
  console.log('=== SETUP TEST ADMIN USER ===\n');

  // Check if user already exists
  console.log('1. Checking if test admin exists...');
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(u => u.email === TEST_ADMIN_EMAIL);

  let userId: string;

  if (existingUser) {
    console.log('   Test admin already exists, updating password...');
    userId = existingUser.id;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: TEST_ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (updateError) {
      console.error('   Error updating user:', updateError.message);
      return;
    }
    console.log('   Password updated');
  } else {
    console.log('   Creating new test admin user...');

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      email_confirm: true, // Skip email verification
    });

    if (createError) {
      console.error('   Error creating user:', createError.message);
      return;
    }

    userId = newUser.user.id;
    console.log('   User created with ID:', userId);
  }

  // Ensure profile exists with admin role
  console.log('\n2. Setting up admin profile...');

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (existingProfile) {
    // Update to admin
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin', display_name: 'Test Admin' })
      .eq('id', userId);

    if (updateError) {
      console.error('   Error updating profile:', updateError.message);
    } else {
      console.log('   Profile updated to admin role');
    }
  } else {
    // Create profile
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: TEST_ADMIN_EMAIL,
        role: 'admin',
        display_name: 'Test Admin',
      });

    if (insertError) {
      console.error('   Error creating profile:', insertError.message);
    } else {
      console.log('   Profile created with admin role');
    }
  }

  // Verify setup
  console.log('\n3. Verifying setup...');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  console.log('   Profile:', profile);

  // Output credentials for testing
  console.log('\n=== TEST CREDENTIALS ===');
  console.log('Email:', TEST_ADMIN_EMAIL);
  console.log('Password:', TEST_ADMIN_PASSWORD);
  console.log('User ID:', userId);

  // Write to a local file for the test script to use
  const testConfig = {
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
    userId: userId,
  };

  const configPath = '.test-admin-config.json';
  require('fs').writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
  console.log(`\nConfig written to ${configPath}`);
  console.log('(This file is gitignored and should not be committed)');

  console.log('\n=== DONE ===');
}

main().catch(console.error);
