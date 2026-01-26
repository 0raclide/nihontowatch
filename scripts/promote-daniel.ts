/**
 * Manually promote Daniel to admin
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function promoteDaniel() {
  console.log('🔍 Finding Daniel...\n');

  // Find Daniel
  const { data: daniel, error: findError } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, is_admin')
    .ilike('email', '%daniel%')
    .single();

  if (findError || !daniel) {
    console.error('❌ Could not find Daniel:', findError);
    return;
  }

  console.log('✅ Found Daniel:');
  console.log(`  Email: ${daniel.email}`);
  console.log(`  Current role: ${daniel.role}`);
  console.log(`  Current is_admin: ${daniel.is_admin}`);
  console.log(`\n🚀 Promoting to admin...\n`);

  // Promote Daniel - update only role (is_admin is auto-computed)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      role: 'admin',
      updated_at: new Date().toISOString(),
    })
    .eq('id', daniel.id);

  if (updateError) {
    console.error('❌ Failed to promote:', updateError);
    return;
  }

  console.log('✅ Update successful!\n');

  // Verify the update
  const { data: updated, error: verifyError } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, is_admin, updated_at')
    .eq('id', daniel.id)
    .single();

  if (verifyError || !updated) {
    console.error('❌ Could not verify update:', verifyError);
    return;
  }

  console.log('✅ VERIFIED - Daniel is now:');
  console.log(`  Email: ${updated.email}`);
  console.log(`  role: ${updated.role}`);
  console.log(`  is_admin: ${updated.is_admin}`);
  console.log(`  updated_at: ${updated.updated_at}`);
  console.log('\n🎉 Daniel has been promoted to admin!');
}

promoteDaniel()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
