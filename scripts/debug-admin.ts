import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== ADMIN DEBUG ===\n');

  // 1. Check auth user
  console.log('1. Checking auth.users for christoph.hill0@gmail.com...');
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('Error listing users:', userError);
    return;
  }

  const user = users.users.find(u => u.email === 'christoph.hill0@gmail.com');

  if (!user) {
    console.log('   ❌ User NOT FOUND in auth.users');
    return;
  }

  console.log('   ✅ User found in auth.users');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Created:', user.created_at);

  // 2. Check profile
  console.log('\n2. Checking profiles table...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.log('   ❌ Profile ERROR:', profileError.message);
    console.log('   Code:', profileError.code);

    // Try to list all profiles
    console.log('\n   Listing all profiles:');
    const { data: allProfiles } = await supabase.from('profiles').select('id, email, role').limit(10);
    console.log('   ', allProfiles);
    return;
  }

  console.log('   ✅ Profile found');
  console.log('   Full profile:', JSON.stringify(profile, null, 2));
  console.log('\n   🔑 ROLE VALUE:', profile.role);
  console.log('   Is role === "admin"?', profile.role === 'admin');

  // 3. Check table schema
  console.log('\n3. Checking profiles table columns...');
  const { data: columns } = await supabase.rpc('get_table_columns', { table_name: 'profiles' }).single();
  if (columns) {
    console.log('   Columns:', columns);
  } else {
    // Direct query to check schema
    const { data: schemaData } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    if (schemaData && schemaData[0]) {
      console.log('   Available columns:', Object.keys(schemaData[0]));
    }
  }

  // 4. Test the exact query the middleware/AuthContext would use
  console.log('\n4. Testing middleware query (select role)...');
  const { data: roleData, error: roleError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (roleError) {
    console.log('   ❌ Role query ERROR:', roleError.message);
  } else {
    console.log('   ✅ Role query result:', roleData);
    console.log('   role === "admin"?', roleData?.role === 'admin');
  }

  console.log('\n=== END DEBUG ===');
}

main();
