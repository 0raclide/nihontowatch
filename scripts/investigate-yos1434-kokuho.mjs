import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hjhrnhtvmtbecyjzqpyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHJuaHR2bXRiZWN5anpxcHlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE5NDIzNCwiZXhwIjoyMDgyNzcwMjM0fQ.z2PL1Ks7M3nhysvkMoD9z5rqZhRC62jkSDY0ncUOJNs'
);

const CODE = 'YOS1434';

console.log('='.repeat(80));
console.log(`INVESTIGATING ${CODE} (Go Yoshihiro) — Kokuho Count Discrepancy`);
console.log('='.repeat(80));

// 1. artisan_makers stored counts
console.log('\n--- 1. artisan_makers stored counts ---');
const { data: maker, error: makerErr } = await supabase
  .from('artisan_makers')
  .select('maker_id, name_romaji, name_kanji, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, total_items, elite_count, elite_factor, stats_computed_at')
  .eq('maker_id', CODE)
  .single();

if (makerErr) console.error('Error:', makerErr);
else {
  console.log(JSON.stringify(maker, null, 2));
  console.log(`\n  Stored kokuho_count: ${maker.kokuho_count}`);
}

// 2. gold_values for YOS1434
console.log('\n--- 2. gold_values records for YOS1434 ---');
const { data: goldRows, error: goldErr } = await supabase
  .from('gold_values')
  .select('object_uuid, gold_smith_id, gold_maker_id, gold_collections, gold_form_type, gold_mei_status, gold_nagasa, gold_artisan, gold_artisan_kanji, gold_artisan_code_v5')
  .or(`gold_smith_id.eq.${CODE},gold_maker_id.eq.${CODE}`);

if (goldErr) {
  console.error('Error querying gold_values:', goldErr);
} else {
  console.log(`Total gold_values rows: ${goldRows.length}`);
  for (const row of goldRows) {
    console.log(`\n  UUID: ${row.object_uuid}`);
    console.log(`    smith_id: ${row.gold_smith_id}, maker_id: ${row.gold_maker_id}`);
    console.log(`    collections: ${JSON.stringify(row.gold_collections)}`);
    console.log(`    form: ${row.gold_form_type}, mei: ${row.gold_mei_status}`);
    console.log(`    nagasa: ${row.gold_nagasa}`);
    console.log(`    artisan: ${row.gold_artisan} / ${row.gold_artisan_kanji} / v5: ${row.gold_artisan_code_v5}`);
  }
  
  const kokuhoFromGold = goldRows.filter(r => r.gold_collections?.includes('Kokuho'));
  const uniqueKokuhoUuids = [...new Set(kokuhoFromGold.map(r => r.object_uuid))];
  console.log(`\nRows with 'Kokuho' in gold_collections: ${kokuhoFromGold.length}`);
  console.log(`Distinct object_uuids with Kokuho: ${uniqueKokuhoUuids.length}`);
  for (const uuid of uniqueKokuhoUuids) console.log(`  - ${uuid}`);
  
  const allCollections = new Set();
  for (const row of goldRows) {
    if (row.gold_collections) for (const c of row.gold_collections) allCollections.add(c);
  }
  console.log(`\nAll distinct collections: ${[...allCollections].join(', ')}`);
}

// 3. catalog_records with Kokuho for YOS1434 objects
if (goldRows?.length > 0) {
  const allUuids = [...new Set(goldRows.map(r => r.object_uuid))];
  
  console.log('\n--- 3. Kokuho catalog_records for YOS1434 objects ---');
  const { data: kokuhoRecs, error: crErr } = await supabase
    .from('catalog_records')
    .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
    .in('object_uuid', allUuids)
    .eq('collection', 'Kokuho');
  
  if (crErr) console.error('Error:', crErr);
  else {
    console.log(`Kokuho catalog_records: ${kokuhoRecs.length}`);
    for (const rec of kokuhoRecs) {
      const m = rec.metadata || {};
      console.log(`\n  UUID: ${rec.uuid}`);
      console.log(`    object_uuid: ${rec.object_uuid}`);
      console.log(`    collection: ${rec.collection}, vol=${rec.volume}, item=${rec.item_number}`);
      console.log(`    artisan_code_v5: ${rec.artisan_code_v5}`);
      console.log(`    metadata title: ${m.title || m.item_title || '(none)'}`);
      console.log(`    metadata smith: ${m.smith || m.smith_name_kanji || m.attribution || '(none)'}`);
    }
    
    const uniqueKokuhoObjs = [...new Set(kokuhoRecs.map(r => r.object_uuid))];
    console.log(`\nDistinct Kokuho objects: ${uniqueKokuhoObjs.length}`);
  }
  
  // 4. ALL catalog_records for YOS1434 objects
  console.log('\n--- 4. ALL catalog_records for YOS1434 objects ---');
  const { data: allRecs, error: allErr } = await supabase
    .from('catalog_records')
    .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
    .in('object_uuid', allUuids)
    .order('object_uuid')
    .order('collection');
  
  if (allErr) console.error('Error:', allErr);
  else {
    console.log(`Total catalog_records: ${allRecs.length}`);
    const grouped = {};
    for (const rec of allRecs) {
      if (!grouped[rec.object_uuid]) grouped[rec.object_uuid] = [];
      grouped[rec.object_uuid].push(rec);
    }
    
    for (const [uuid, recs] of Object.entries(grouped)) {
      const goldRow = goldRows.find(g => g.object_uuid === uuid);
      console.log(`\n  Object: ${uuid}`);
      console.log(`    gold_collections: ${JSON.stringify(goldRow?.gold_collections)}`);
      for (const rec of recs) {
        const m = rec.metadata || {};
        const title = m.title || m.item_title || '';
        console.log(`    - [${rec.collection}] vol=${rec.volume} item=${rec.item_number} | ${title} | v5: ${rec.artisan_code_v5}`);
      }
    }
  }
}

// 5. Direct search: ALL Kokuho catalog_records for Yoshihiro
console.log('\n--- 5. Direct search: ALL Kokuho records with artisan_code_v5=YOS1434 or metadata matching ---');
const { data: directKokuho, error: dkErr } = await supabase
  .from('catalog_records')
  .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
  .eq('collection', 'Kokuho')
  .eq('artisan_code_v5', 'YOS1434');

if (dkErr) console.error('Error:', dkErr);
else {
  console.log(`Kokuho records with artisan_code_v5=YOS1434: ${directKokuho.length}`);
  for (const rec of directKokuho) {
    const m = rec.metadata || {};
    console.log(`\n  record_uuid: ${rec.uuid}`);
    console.log(`    object_uuid: ${rec.object_uuid}`);
    console.log(`    vol=${rec.volume} item=${rec.item_number}`);
    console.log(`    metadata: ${JSON.stringify(m).substring(0, 200)}`);
  }
}

// Also try broader search via gold_values artisan name
console.log('\n--- 5b. Broader: Kokuho catalog_records for any Yoshihiro variant ---');
const { data: broadKokuho, error: bkErr } = await supabase
  .from('catalog_records')
  .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
  .eq('collection', 'Kokuho')
  .or('artisan_code_v5.like.YOS%');

if (bkErr) console.error('Error:', bkErr);
else {
  console.log(`Kokuho records with artisan_code_v5 starting with YOS: ${broadKokuho.length}`);
  for (const rec of broadKokuho) {
    const m = rec.metadata || {};
    console.log(`  object_uuid: ${rec.object_uuid} | v5: ${rec.artisan_code_v5} | vol=${rec.volume} item=${rec.item_number} | ${(m.title || m.item_title || '').substring(0, 80)}`);
  }
}

// 6. gold_values for those Kokuho UUIDs — check who is smith_id
if (directKokuho?.length > 0 || broadKokuho?.length > 0) {
  const allKokuhoUuids = [...new Set([
    ...(directKokuho || []).map(r => r.object_uuid),
    ...(broadKokuho || []).map(r => r.object_uuid)
  ])];
  
  console.log('\n--- 6. gold_values for Yoshihiro-related Kokuho objects ---');
  const { data: gvKokuho, error: gvErr } = await supabase
    .from('gold_values')
    .select('object_uuid, gold_smith_id, gold_collections, gold_artisan, gold_artisan_kanji, gold_artisan_code_v5')
    .in('object_uuid', allKokuhoUuids);
  
  if (gvErr) console.error('Error:', gvErr);
  else {
    for (const row of gvKokuho) {
      console.log(`  UUID: ${row.object_uuid}`);
      console.log(`    gold_smith_id: ${row.gold_smith_id}`);
      console.log(`    gold_collections: ${JSON.stringify(row.gold_collections)}`);
      console.log(`    artisan: ${row.gold_artisan} / ${row.gold_artisan_kanji} / v5: ${row.gold_artisan_code_v5}`);
      console.log('');
    }
  }
}

// 7. Check if any Kokuho-attributed Yoshihiro objects might have gold_smith_id pointing elsewhere
console.log('\n--- 7. All Kokuho catalog_records (full list to check for Yoshihiro names in metadata) ---');
const { data: allKokuho, error: akErr } = await supabase
  .from('catalog_records')
  .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
  .eq('collection', 'Kokuho');

if (akErr) console.error('Error:', akErr);
else {
  console.log(`Total Kokuho catalog_records: ${allKokuho.length}`);
  // Search for Yoshihiro in metadata
  const yoshihiroRecs = allKokuho.filter(r => {
    const mStr = JSON.stringify(r.metadata || {}).toLowerCase();
    return mStr.includes('yoshihiro') || mStr.includes('義弘');
  });
  console.log(`Kokuho records with 'yoshihiro' or '義弘' in metadata: ${yoshihiroRecs.length}`);
  for (const rec of yoshihiroRecs) {
    const m = rec.metadata || {};
    console.log(`\n  object_uuid: ${rec.object_uuid}`);
    console.log(`    vol=${rec.volume} item=${rec.item_number} | v5: ${rec.artisan_code_v5}`);
    // Show relevant metadata fields
    for (const [k, v] of Object.entries(m)) {
      const vs = String(v);
      if (vs.toLowerCase().includes('yoshihiro') || vs.includes('義弘')) {
        console.log(`    metadata.${k}: ${vs.substring(0, 200)}`);
      }
    }
    // Also show title
    console.log(`    metadata.title: ${m.title || m.item_title || '(none)'}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('INVESTIGATION COMPLETE');
console.log('='.repeat(80));
