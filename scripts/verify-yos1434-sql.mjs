import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hjhrnhtvmtbecyjzqpyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHJuaHR2bXRiZWN5anpxcHlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE5NDIzNCwiZXhwIjoyMDgyNzcwMjM0fQ.z2PL1Ks7M3nhysvkMoD9z5rqZhRC62jkSDY0ncUOJNs'
);

const CODE = 'YOS1434';

// Reproduce the stat computation logic for YOS1434 step by step

// Step 1: all_artisan_objects for YOS1434
console.log('--- Step 1: gold_values objects for YOS1434 ---');
const { data: gvRows } = await supabase
  .from('gold_values')
  .select('object_uuid, gold_smith_id, gold_maker_id')
  .or(`gold_smith_id.eq.${CODE},gold_maker_id.eq.${CODE}`);

const objectUuids = [...new Set(gvRows.map(r => r.object_uuid))];
console.log(`Objects from gold_values: ${objectUuids.length}`);

// Step 2: catalog_records for these objects, excluding JE_Koto and metadata_v2
console.log('\n--- Step 2: catalog_records for YOS1434 objects (excluding JE_Koto) ---');
const { data: crRows } = await supabase
  .from('catalog_records')
  .select('object_uuid, collection')
  .in('object_uuid', objectUuids)
  .not('collection', 'in', '("JE_Koto","metadata_v2")');

// Group by object_uuid
const crByUuid = {};
for (const r of crRows) {
  if (!crByUuid[r.object_uuid]) crByUuid[r.object_uuid] = [];
  crByUuid[r.object_uuid].push(r.collection);
}

console.log(`Objects with non-JE_Koto catalog_records: ${Object.keys(crByUuid).length}`);

// Step 3: Best designation per object (mimicking the SQL DISTINCT ON with priority ordering)
const PRIORITY = { 'Kokuho': 1, 'Tokuju': 2, 'JuBun': 3, 'Jubi': 4, 'IMP_Koto': 5, 'IMP_Shin': 5, 'Juyo': 6 };
const BEST_MAP = { 'Kokuho': 'Kokuho', 'Tokuju': 'Tokuju', 'JuBun': 'JuBun', 'Jubi': 'Jubi', 'IMP_Koto': 'Gyobutsu', 'IMP_Shin': 'Gyobutsu', 'Juyo': 'Juyo' };

console.log('\n--- Step 3: Best designation per object ---');
const bestPerObject = {};
for (const [uuid, collections] of Object.entries(crByUuid)) {
  // Sort by priority, pick first
  const sorted = collections.sort((a, b) => (PRIORITY[a] || 99) - (PRIORITY[b] || 99));
  const bestCollection = sorted[0];
  const best = BEST_MAP[bestCollection] || null;
  bestPerObject[uuid] = best;
}

// Step 4: Count by designation
const counts = { Kokuho: 0, JuBun: 0, Jubi: 0, Gyobutsu: 0, Tokuju: 0, Juyo: 0 };
for (const [uuid, best] of Object.entries(bestPerObject)) {
  if (best && counts.hasOwnProperty(best)) {
    counts[best]++;
  }
}

console.log('\nComputed counts for YOS1434:');
console.log(JSON.stringify(counts, null, 2));

// Show which objects are Kokuho
const kokuhoObjects = Object.entries(bestPerObject).filter(([_, b]) => b === 'Kokuho').map(([u]) => u);
console.log(`\nKokuho objects (${kokuhoObjects.length}):`);
for (const uuid of kokuhoObjects) {
  const gvRow = gvRows.find(r => r.object_uuid === uuid);
  console.log(`  ${uuid} | gold_smith_id: ${gvRow?.gold_smith_id} | collections: ${crByUuid[uuid].join(', ')}`);
}

// Compare with stored
console.log('\nStored kokuho_count: 1');
console.log(`Computed kokuho_count: ${counts.Kokuho}`);
if (counts.Kokuho !== 1) {
  console.log('\n*** DISCREPANCY DETECTED ***');
} else {
  console.log('\nNo discrepancy — stored value matches computed value.');
  console.log('The second Kokuho object (Inaba-Go) is attributed to YAS537 in gold_values, not YOS1434.');
}

// Check specifically: is f7b9244a in the gold_values results?
const f7found = gvRows.find(r => r.object_uuid === 'f7b9244a-ec51-4fc5-b44f-e3106f08ea81');
console.log(`\nObject f7b9244a in gold_values for YOS1434: ${f7found ? 'YES (gold_smith_id=' + f7found.gold_smith_id + ')' : 'NO'}`);
if (f7found) {
  console.log(`  catalog_records collections: ${crByUuid['f7b9244a-ec51-4fc5-b44f-e3106f08ea81']?.join(', ') || 'NONE'}`);
  console.log(`  Best designation: ${bestPerObject['f7b9244a-ec51-4fc5-b44f-e3106f08ea81'] || 'NONE'}`);
}
