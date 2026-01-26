/**
 * Check Daniel's profile in the database
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'found' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'found' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDaniel() {
  console.log('🔍 Checking Daniel\'s profile...\n');

  // Find Daniel by searching for users with email containing 'daniel'
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, created_at, updated_at')
    .ilike('email', '%daniel%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error querying profiles:', error);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('❌ No users found with "daniel" in email');
    console.log('\n🔍 Searching all recent users...\n');

    const { data: allProfiles, error: allError } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (allError) {
      console.error('❌ Error querying all profiles:', allError);
      return;
    }

    console.log('Recent users (by updated_at):');
    allProfiles?.forEach((p, i) => {
      console.log(`${i + 1}. ${p.email} - role: ${p.role} - updated: ${p.updated_at}`);
    });
    return;
  }

  console.log(`✅ Found ${profiles.length} user(s) with "daniel" in email:\n`);
  profiles.forEach((profile) => {
    console.log('-----------------------------------');
    console.log(`Email: ${profile.email}`);
    console.log(`Display Name: ${profile.display_name || '(none)'}`);
    console.log(`Role: ${profile.role}`);
    console.log(`ID: ${profile.id}`);
    console.log(`Created: ${profile.created_at}`);
    console.log(`Updated: ${profile.updated_at}`);
    console.log('-----------------------------------\n');
  });

  // Check if there's an is_admin column (shouldn't exist)
  console.log('🔍 Checking for is_admin column...\n');
  const { data: withIsAdmin, error: isAdminError } = await supabase
    .from('profiles')
    .select('id, email, role, is_admin')
    .ilike('email', '%daniel%')
    .limit(1);

  if (isAdminError) {
    console.log('❌ is_admin column does NOT exist (expected!)');
    console.log('Error:', isAdminError.message);
  } else {
    console.log('⚠️  is_admin column EXISTS (unexpected!)');
    console.log('Value:', withIsAdmin);
  }
}

checkDaniel()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
