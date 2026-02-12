/**
 * Choshuya duplicate cleanup script.
 *
 * Executes the equivalent of migration 20260210000001 via the Supabase client:
 * 1. Collects URLs of duplicate listings (for discovered_urls cleanup)
 * 2. Reassigns foreign key references to canonical listings
 * 3. Deletes duplicate listings
 * 4. Removes duplicate URLs from discovered_urls
 * 5. Verifies the cleanup
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapping: canonical ID -> duplicate IDs to remove
const DEDUP_MAP = {
  31057: [35098],
  31059: [34681],
  31061: [34540, 34868, 34996],
  31065: [35234],
  31066: [35066],
  31070: [34401],
  31082: [35215],
  31086: [35235],
  31088: [35244],
  31093: [34229, 34604],
  31098: [35016],
  31100: [34586],
  31104: [34619, 34921],
  31109: [34718, 35172],
  31125: [35159, 35177],
  31143: [35178],
  34221: [34302],
  34228: [34445],
  34268: [35088, 35198],
  34336: [35109],
  34369: [34940, 34965],
  34425: [34987],
  34446: [35002],
  34473: [35192],
  34522: [34962],
  34549: [34551],
  34923: [35227],
  35023: [35097],
  50174: [50175, 50176],
};

// All duplicate IDs (flat list)
const ALL_DUPE_IDS = Object.values(DEDUP_MAP).flat();

async function tableExists(tableName) {
  // Try a minimal query; if the table doesn't exist the RPC will error
  try {
    const { error } = await supabase.from(tableName).select('id').limit(0);
    return !error;
  } catch {
    return false;
  }
}

async function reassignTable(tableName) {
  let moved = 0;
  for (const [keepId, dupeIds] of Object.entries(DEDUP_MAP)) {
    const { data, error } = await supabase
      .from(tableName)
      .update({ listing_id: Number(keepId) })
      .in('listing_id', dupeIds)
      .select('id');

    if (error) {
      // Might get unique constraint violations if canonical already has an entry
      // for the same user — that's OK, we'll just delete orphaned dupes
      if (error.code === '23505') {
        // Delete instead of update for conflicting rows
        await supabase.from(tableName).delete().in('listing_id', dupeIds);
        console.log(`  ${tableName}: deleted conflicting rows for keep=${keepId}`);
      } else {
        console.error(`  ${tableName}: error reassigning to ${keepId}:`, error.message);
      }
    } else if (data && data.length > 0) {
      moved += data.length;
    }
  }
  return moved;
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');

  if (DRY_RUN) {
    console.log('=== DRY RUN MODE (no changes will be made) ===\n');
  }

  console.log(`Duplicate groups: ${Object.keys(DEDUP_MAP).length}`);
  console.log(`Total duplicate IDs to remove: ${ALL_DUPE_IDS.length}\n`);

  // Step 0: Verify duplicates still exist
  console.log('STEP 0: Verifying duplicates exist...');
  const { data: existing, error: existErr } = await supabase
    .from('listings')
    .select('id, url, title, is_available')
    .in('id', ALL_DUPE_IDS);

  if (existErr) {
    console.error('Error checking duplicates:', existErr.message);
    return;
  }

  const existingIds = new Set(existing.map(l => l.id));
  const missingIds = ALL_DUPE_IDS.filter(id => !existingIds.has(id));

  console.log(`  Found ${existing.length}/${ALL_DUPE_IDS.length} duplicate listings in DB`);
  if (missingIds.length > 0) {
    console.log(`  Already removed: ${missingIds.join(', ')}`);
  }

  if (existing.length === 0) {
    console.log('\nAll duplicates already cleaned up. Nothing to do.');
    return;
  }

  // Also verify canonical listings exist
  const canonicalIds = Object.keys(DEDUP_MAP).map(Number);
  const { data: canonicals } = await supabase
    .from('listings')
    .select('id')
    .in('id', canonicalIds);

  const missingCanonicals = canonicalIds.filter(
    id => !canonicals.find(c => c.id === id)
  );
  if (missingCanonicals.length > 0) {
    console.error(`\nERROR: Missing canonical listings: ${missingCanonicals.join(', ')}`);
    console.error('Cannot proceed — the "keep" listings must exist.');
    return;
  }
  console.log(`  All ${canonicals.length} canonical listings verified.\n`);

  if (DRY_RUN) {
    console.log('DRY RUN — would remove these listings:');
    for (const l of existing) {
      console.log(`  [${l.id}] ${(l.title || '').substring(0, 60)} | available=${l.is_available}`);
    }
    return;
  }

  // Step 1: Collect URLs of duplicates (for discovered_urls cleanup later)
  console.log('STEP 1: Collecting duplicate URLs...');
  const dupeUrls = existing.map(l => l.url).filter(Boolean);
  console.log(`  Collected ${dupeUrls.length} URLs\n`);

  // Step 2: Reassign foreign key references
  console.log('STEP 2: Reassigning foreign key references...');

  const tables = ['price_history', 'status_history', 'user_favorites', 'user_alerts', 'dealer_clicks'];
  for (const table of tables) {
    const exists = await tableExists(table);
    if (!exists) {
      console.log(`  ${table}: table not found, skipping`);
      continue;
    }
    const moved = await reassignTable(table);
    console.log(`  ${table}: reassigned ${moved} rows`);
  }
  console.log();

  // Step 3: Delete duplicate listings
  console.log('STEP 3: Deleting duplicate listings...');
  const idsToDelete = ALL_DUPE_IDS.filter(id => existingIds.has(id));

  // Delete in batches to avoid hitting limits
  const BATCH_SIZE = 20;
  let totalDeleted = 0;
  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
    const { error: delErr } = await supabase
      .from('listings')
      .delete()
      .in('id', batch);

    if (delErr) {
      console.error(`  Error deleting batch ${i}-${i + batch.length}:`, delErr.message);
      // Try individual deletes to find the problematic one
      for (const id of batch) {
        const { error: singleErr } = await supabase
          .from('listings')
          .delete()
          .eq('id', id);
        if (singleErr) {
          console.error(`    Failed to delete ID ${id}:`, singleErr.message);
        } else {
          totalDeleted++;
        }
      }
    } else {
      totalDeleted += batch.length;
    }
  }
  console.log(`  Deleted ${totalDeleted}/${idsToDelete.length} listings\n`);

  // Step 4: Clean discovered_urls
  console.log('STEP 4: Cleaning discovered_urls...');
  if (dupeUrls.length > 0) {
    let dupeUrlsRemoved = 0;
    for (let i = 0; i < dupeUrls.length; i += BATCH_SIZE) {
      const batch = dupeUrls.slice(i, i + BATCH_SIZE);
      const { data: delData, error: duErr } = await supabase
        .from('discovered_urls')
        .delete()
        .in('url', batch)
        .select('id');

      if (duErr) {
        console.error(`  Error cleaning discovered_urls batch:`, duErr.message);
      } else {
        dupeUrlsRemoved += (delData || []).length;
      }
    }
    console.log(`  Removed ${dupeUrlsRemoved} discovered_urls entries\n`);
  }

  // Step 5: Verify
  console.log('STEP 5: Verification...');
  const { data: remaining } = await supabase
    .from('listings')
    .select('id')
    .in('id', ALL_DUPE_IDS);

  const remainingCount = (remaining || []).length;
  if (remainingCount > 0) {
    console.error(`  WARNING: ${remainingCount} duplicate listings still remain!`);
    console.error(`  IDs: ${remaining.map(r => r.id).join(', ')}`);
  } else {
    console.log(`  All ${totalDeleted} duplicate listings successfully removed`);
  }

  // Check Choshuya listing count
  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', 9)
    .eq('is_available', true);

  console.log(`  Total available Choshuya listings: ${count}`);
  console.log('\nDone! Run "node scripts/check_dupes.js" to verify zero duplicate groups.');
}

main().catch(console.error);
