import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hjhrnhtvmtbecyjzqpyr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHJuaHR2bXRiZWN5anpxcHlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE5NDIzNCwiZXhwIjoyMDgyNzcwMjM0fQ.z2PL1Ks7M3nhysvkMoD9z5rqZhRC62jkSDY0ncUOJNs'
);

// Check stats_computed_at for YOS1434
const { data: maker } = await supabase
  .from('artisan_makers')
  .select('maker_id, kokuho_count, stats_computed_at')
  .eq('maker_id', 'YOS1434')
  .single();

console.log('YOS1434 stats_computed_at:', maker.stats_computed_at);
console.log('YOS1434 kokuho_count:', maker.kokuho_count);

// Check when f7b9244a gold_values was created/synthesized
const { data: gv } = await supabase
  .from('gold_values')
  .select('object_uuid, gold_smith_id, synthesized_at, computed_at, gold_collections')
  .eq('object_uuid', 'f7b9244a-ec51-4fc5-b44f-e3106f08ea81')
  .single();

console.log('\nf7b9244a gold_values:');
console.log('  synthesized_at:', gv.synthesized_at);
console.log('  computed_at:', gv.computed_at);
console.log('  gold_smith_id:', gv.gold_smith_id);
console.log('  gold_collections:', JSON.stringify(gv.gold_collections));

// Check when the catalog_record for f7b9244a was created
const { data: cr } = await supabase
  .from('catalog_records')
  .select('uuid, object_uuid, collection, created_at, updated_at, imported_at')
  .eq('object_uuid', 'f7b9244a-ec51-4fc5-b44f-e3106f08ea81');

console.log('\nf7b9244a catalog_records:');
for (const r of cr) {
  console.log(`  [${r.collection}] created: ${r.created_at} | updated: ${r.updated_at} | imported: ${r.imported_at}`);
}

// Also check 6dec5fc0 (Tomita-Go) for comparison
const { data: gv2 } = await supabase
  .from('gold_values')
  .select('object_uuid, gold_smith_id, synthesized_at, computed_at')
  .eq('object_uuid', '6dec5fc0-3934-4f85-9b43-7b3eb85d362b')
  .single();

console.log('\n6dec5fc0 (Tomita-Go) gold_values:');
console.log('  synthesized_at:', gv2.synthesized_at);
console.log('  computed_at:', gv2.computed_at);
console.log('  gold_smith_id:', gv2.gold_smith_id);

// Check a98e8999 (Inaba-Go wrongly attributed to YAS537)
const { data: gv3 } = await supabase
  .from('gold_values')
  .select('object_uuid, gold_smith_id, synthesized_at, computed_at, gold_collections')
  .eq('object_uuid', 'a98e8999-82ef-4aef-90e1-2dbb2c20a906')
  .single();

console.log('\na98e8999 (Inaba-Go, gold_smith_id=YAS537) gold_values:');
console.log('  synthesized_at:', gv3.synthesized_at);
console.log('  computed_at:', gv3.computed_at);
console.log('  gold_smith_id:', gv3.gold_smith_id);

// Check if there's an RPC or scheduled function that recomputes stats
// Let's also check YAS537 (currently gets this Kokuho credit)
const { data: yas537 } = await supabase
  .from('artisan_makers')
  .select('maker_id, name_romaji, kokuho_count, stats_computed_at')
  .eq('maker_id', 'YAS537')
  .single();

console.log('\nYAS537 (Yasutsuna):');
console.log('  kokuho_count:', yas537.kokuho_count);
console.log('  stats_computed_at:', yas537.stats_computed_at);

// Check YAS125 too
const { data: yas125 } = await supabase
  .from('artisan_makers')
  .select('maker_id, name_romaji, kokuho_count, stats_computed_at')
  .eq('maker_id', 'YAS125')
  .single();

console.log('\nYAS125 (Yasuie):');
console.log('  kokuho_count:', yas125.kokuho_count);
console.log('  stats_computed_at:', yas125.stats_computed_at);

// What was computed at 2026-02-28T17:10:12? Let's check if there's a function
// Also check: the gold_values artisan_code_v5 for f7b9244a
const { data: gvFull } = await supabase
  .from('gold_values')
  .select('gold_smith_id, gold_artisan_code_v5, gold_artisan, gold_artisan_kanji')
  .eq('object_uuid', 'f7b9244a-ec51-4fc5-b44f-e3106f08ea81')
  .single();

console.log('\nf7b9244a artisan attribution in gold_values:');
console.log('  gold_smith_id:', gvFull.gold_smith_id);
console.log('  gold_artisan_code_v5:', gvFull.gold_artisan_code_v5);
console.log('  gold_artisan:', gvFull.gold_artisan);
console.log('  gold_artisan_kanji:', gvFull.gold_artisan_kanji);

// KEY QUESTION: gold_smith_id=YOS1434 but gold_artisan_code_v5=YAS125
// The stats SQL uses gold_smith_id, so it SHOULD count this as YOS1434
// Let me check if perhaps migration 435 was run at a time when gold_smith_id was different
