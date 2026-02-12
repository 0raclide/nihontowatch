/**
 * Choshuya duplicate cleanup v2 — comprehensive pass using improved media ID extraction.
 * Found by scripts/check_dupes_improved.js.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DEDUP_MAP = {
  31064: [34790, 34983, 35267],
  31078: [34764, 34902, 35170],
  31060: [34414, 34520],
  31071: [34239, 34906],
  31073: [34347, 34549],
  31079: [34560, 35256],
  31094: [34621, 35211],
  31095: [34510, 34705],
  31099: [34221, 34460],
  31117: [34372, 34522],
  31123: [34473, 34779],
  31145: [34562, 35201],
  31057: [35173],
  31058: [34708],
  31063: [34369],
  31066: [34446],
  31068: [34268],
  31070: [34233],
  31076: [35138],
  31077: [35299],
  31084: [34433],
  31090: [35147],
  31091: [35046],
  31097: [35189],
  31098: [35208],
  31100: [35226],
  31101: [35056],
  31102: [35102],
  31104: [34915],
  31107: [35060],
  31110: [35114],
  31113: [35212],
  31115: [35089],
  31116: [34825],
  31126: [35131],
  31128: [35271],
  31129: [35167],
  31130: [34336],
  31133: [35093],
  31140: [35168],
  31142: [35186],
  31155: [34919],
  32444: [34953],
  32445: [34616],
  32446: [35225],
  32447: [35270],
  32448: [35007],
  32449: [34509],
  32451: [34298],
  32466: [35155],
  32467: [35075],
  32468: [34714],
  32469: [34341],
  32470: [34505],
  32471: [34330],
  32473: [34888],
  32474: [34647],
  32475: [34339],
  32489: [34518],
  32493: [34248],
  32495: [35252],
  32496: [35166],
  34735: [35149],
  34878: [35077],
};

const ALL_DUPE_IDS = Object.values(DEDUP_MAP).flat();

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  if (DRY_RUN) console.log('=== DRY RUN ===\n');

  console.log('Duplicate groups: ' + Object.keys(DEDUP_MAP).length);
  console.log('Total duplicate IDs: ' + ALL_DUPE_IDS.length);

  // Verify dupes exist
  const { data: existing } = await supabase
    .from('listings')
    .select('id, url')
    .in('id', ALL_DUPE_IDS);

  const existingIds = new Set((existing || []).map(l => l.id));
  const idsToProcess = ALL_DUPE_IDS.filter(id => existingIds.has(id));
  console.log('Found in DB: ' + idsToProcess.length + '/' + ALL_DUPE_IDS.length);

  if (idsToProcess.length === 0) {
    console.log('Nothing to clean.');
    return;
  }

  // Verify canonical listings exist
  const canonicalIds = Object.keys(DEDUP_MAP).map(Number);
  const { data: canonicals } = await supabase.from('listings').select('id').in('id', canonicalIds);
  const missingCanonicals = canonicalIds.filter(id => !(canonicals || []).find(c => c.id === id));
  if (missingCanonicals.length > 0) {
    console.error('Missing canonical listings: ' + missingCanonicals.join(', '));
    return;
  }
  console.log('All ' + canonicals.length + ' canonical listings verified.\n');

  if (DRY_RUN) return;

  // Collect URLs
  const dupeUrls = (existing || []).map(l => l.url).filter(Boolean);

  // Reassign FKs
  console.log('Reassigning foreign keys...');
  const tables = ['price_history', 'status_history', 'user_favorites', 'user_alerts', 'dealer_clicks'];
  for (const table of tables) {
    let moved = 0;
    for (const [keepId, dupeIds] of Object.entries(DEDUP_MAP)) {
      const activeIds = dupeIds.filter(id => existingIds.has(id));
      if (activeIds.length === 0) continue;
      const { data, error } = await supabase
        .from(table)
        .update({ listing_id: Number(keepId) })
        .in('listing_id', activeIds)
        .select('id');
      if (error && error.code === '23505') {
        await supabase.from(table).delete().in('listing_id', activeIds);
      } else if (data) {
        moved += data.length;
      }
    }
    console.log('  ' + table + ': ' + moved + ' rows');
  }

  // Delete listings
  console.log('\nDeleting ' + idsToProcess.length + ' listings...');
  const BATCH = 20;
  let deleted = 0;
  for (let i = 0; i < idsToProcess.length; i += BATCH) {
    const batch = idsToProcess.slice(i, i + BATCH);
    const { error } = await supabase.from('listings').delete().in('id', batch);
    if (error) {
      console.error('  Batch error:', error.message);
      for (const id of batch) {
        const { error: e2 } = await supabase.from('listings').delete().eq('id', id);
        if (!e2) deleted++;
        else console.error('  Failed ID ' + id + ':', e2.message);
      }
    } else {
      deleted += batch.length;
    }
  }
  console.log('  Deleted: ' + deleted);

  // Clean discovered_urls
  console.log('\nCleaning discovered_urls...');
  let duRemoved = 0;
  for (let i = 0; i < dupeUrls.length; i += BATCH) {
    const batch = dupeUrls.slice(i, i + BATCH);
    const { data } = await supabase.from('discovered_urls').delete().in('url', batch).select('id');
    duRemoved += (data || []).length;
  }
  console.log('  Removed: ' + duRemoved);

  // Verify
  const { data: remaining } = await supabase.from('listings').select('id').in('id', ALL_DUPE_IDS);
  console.log('\nRemaining duplicates: ' + (remaining || []).length + ' (should be 0)');

  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', 9)
    .eq('is_available', true);
  console.log('Total available Choshuya: ' + count);
}

main().catch(console.error);
