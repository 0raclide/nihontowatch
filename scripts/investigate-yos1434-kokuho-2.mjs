import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hjhrnhtvmtbecyjzqpyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHJuaHR2bXRiZWN5anpxcHlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE5NDIzNCwiZXhwIjoyMDgyNzcwMjM0fQ.z2PL1Ks7M3nhysvkMoD9z5rqZhRC62jkSDY0ncUOJNs'
);

// Investigate the second Kokuho object that mentions 義弘 but is attributed to YAS537
const SECOND_KOKUHO_UUID = 'a98e8999-82ef-4aef-90e1-2dbb2c20a906';
const KNOWN_KOKUHO_UUID = '6dec5fc0-3934-4f85-9b43-7b3eb85d362b';

console.log('='.repeat(80));
console.log('DEEP DIVE: Second Kokuho object mentioning 義弘');
console.log('='.repeat(80));

// 1. Full metadata of the second Kokuho object
console.log('\n--- 1. Full catalog_record for second Kokuho (item 660010049, v5=YAS537) ---');
const { data: rec2, error: e1 } = await supabase
  .from('catalog_records')
  .select('*')
  .eq('object_uuid', SECOND_KOKUHO_UUID)
  .eq('collection', 'Kokuho')
  .single();

if (e1) console.error('Error:', e1);
else {
  console.log(`  uuid: ${rec2.uuid}`);
  console.log(`  object_uuid: ${rec2.object_uuid}`);
  console.log(`  collection: ${rec2.collection}, vol=${rec2.volume}, item=${rec2.item_number}`);
  console.log(`  artisan_code_v5: ${rec2.artisan_code_v5}`);
  console.log('\n  Full metadata:');
  console.log(JSON.stringify(rec2.metadata, null, 2));
}

// 2. gold_values for this object
console.log('\n--- 2. gold_values for second Kokuho object ---');
const { data: gv2, error: e2 } = await supabase
  .from('gold_values')
  .select('*')
  .eq('object_uuid', SECOND_KOKUHO_UUID)
  .single();

if (e2) console.error('Error:', e2);
else {
  console.log(`  object_uuid: ${gv2.object_uuid}`);
  console.log(`  gold_smith_id: ${gv2.gold_smith_id}`);
  console.log(`  gold_artisan: ${gv2.gold_artisan}`);
  console.log(`  gold_artisan_kanji: ${gv2.gold_artisan_kanji}`);
  console.log(`  gold_artisan_code_v5: ${gv2.gold_artisan_code_v5}`);
  console.log(`  gold_collections: ${JSON.stringify(gv2.gold_collections)}`);
  console.log(`  gold_form_type: ${gv2.gold_form_type}`);
  console.log(`  gold_mei_status: ${gv2.gold_mei_status}`);
  console.log(`  gold_nagasa: ${gv2.gold_nagasa}`);
  console.log(`  gold_item_type: ${gv2.gold_item_type}`);
}

// 3. All catalog_records for this object (across collections)
console.log('\n--- 3. All catalog_records for second Kokuho object ---');
const { data: allRecs2, error: e3 } = await supabase
  .from('catalog_records')
  .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
  .eq('object_uuid', SECOND_KOKUHO_UUID);

if (e3) console.error('Error:', e3);
else {
  console.log(`Total records: ${allRecs2.length}`);
  for (const rec of allRecs2) {
    console.log(`\n  [${rec.collection}] vol=${rec.volume} item=${rec.item_number} | v5: ${rec.artisan_code_v5}`);
    // Show just the attribution-related metadata fields
    const m = rec.metadata || {};
    const relevantKeys = ['smith', 'smith_name', 'attribution', 'maker', 'artisan', 'go', 'mei', 'signature', 'description', 'title'];
    for (const key of Object.keys(m)) {
      if (relevantKeys.some(k => key.toLowerCase().includes(k)) || String(m[key]).includes('義弘') || String(m[key]).includes('yoshihiro')) {
        console.log(`    metadata.${key}: ${JSON.stringify(m[key]).substring(0, 300)}`);
      }
    }
  }
}

// 4. Who is YAS537?
console.log('\n--- 4. artisan_makers for YAS537 ---');
const { data: yas537, error: e4 } = await supabase
  .from('artisan_makers')
  .select('maker_id, name_romaji, name_kanji, kokuho_count, jubun_count, jubi_count, tokuju_count, juyo_count, total_items, legacy_school_text, province, era')
  .eq('maker_id', 'YAS537')
  .single();

if (e4) console.error('Error:', e4);
else {
  console.log(JSON.stringify(yas537, null, 2));
}

// 5. Full metadata of the KNOWN Kokuho object (for comparison)
console.log('\n--- 5. Full metadata of known Kokuho (item 660010048, Tomita-Go) ---');
const { data: rec1, error: e5 } = await supabase
  .from('catalog_records')
  .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
  .eq('object_uuid', KNOWN_KOKUHO_UUID)
  .eq('collection', 'Kokuho')
  .single();

if (e5) console.error('Error:', e5);
else {
  console.log(`  uuid: ${rec1.uuid}`);
  console.log(`  object_uuid: ${rec1.object_uuid}`);
  console.log(`  artisan_code_v5: ${rec1.artisan_code_v5}`);
  console.log('\n  Full metadata:');
  console.log(JSON.stringify(rec1.metadata, null, 2));
}

// 6. Also check: the object f7b9244a that appeared in YOS1434's gold_values with Kokuho collection but v5=YAS125
console.log('\n--- 6. Investigate f7b9244a (appeared in gold_values with gold_smith_id=YOS1434 but Kokuho record has v5=YAS125) ---');
const F7_UUID = 'f7b9244a-ec51-4fc5-b44f-e3106f08ea81';
const { data: gv_f7, error: e6 } = await supabase
  .from('gold_values')
  .select('object_uuid, gold_smith_id, gold_artisan, gold_artisan_kanji, gold_artisan_code_v5, gold_collections, gold_form_type')
  .eq('object_uuid', F7_UUID)
  .single();

if (e6) console.error('Error:', e6);
else {
  console.log(`  gold_smith_id: ${gv_f7.gold_smith_id}`);
  console.log(`  gold_artisan: ${gv_f7.gold_artisan} / ${gv_f7.gold_artisan_kanji}`);
  console.log(`  gold_artisan_code_v5: ${gv_f7.gold_artisan_code_v5}`);
  console.log(`  gold_collections: ${JSON.stringify(gv_f7.gold_collections)}`);
}

const { data: allRecs_f7, error: e7 } = await supabase
  .from('catalog_records')
  .select('uuid, object_uuid, collection, volume, item_number, metadata, artisan_code_v5')
  .eq('object_uuid', F7_UUID);

if (e7) console.error('Error:', e7);
else {
  console.log(`\n  catalog_records for f7b9244a:`);
  for (const rec of allRecs_f7) {
    const m = rec.metadata || {};
    console.log(`  [${rec.collection}] vol=${rec.volume} item=${rec.item_number} | v5: ${rec.artisan_code_v5}`);
    // Show smith-related metadata
    for (const key of Object.keys(m)) {
      if (String(m[key]).includes('義弘') || String(m[key]).includes('yoshihiro') || String(m[key]).toLowerCase().includes('go ') || key.includes('smith') || key.includes('attribution') || key.includes('go')) {
        console.log(`    metadata.${key}: ${JSON.stringify(m[key]).substring(0, 300)}`);
      }
    }
  }
}

// 7. Who is YAS125?
console.log('\n--- 7. artisan_makers for YAS125 ---');
const { data: yas125, error: e8 } = await supabase
  .from('artisan_makers')
  .select('maker_id, name_romaji, name_kanji, kokuho_count, province, era')
  .eq('maker_id', 'YAS125')
  .single();

if (e8) console.error('Error:', e8);
else {
  console.log(JSON.stringify(yas125, null, 2));
}

console.log('\n' + '='.repeat(80));
console.log('DEEP DIVE COMPLETE');
console.log('='.repeat(80));
