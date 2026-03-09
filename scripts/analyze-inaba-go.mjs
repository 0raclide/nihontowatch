/**
 * Deep analysis of Inaba-Go (稲葉江) data quality issue in Yuhinkai Supabase.
 * Investigates potential duplicate object_uuids and conflicting artisan attributions.
 */

import { createClient } from '@supabase/supabase-js';

const YUHINKAI_URL = 'https://hjhrnhtvmtbecyjzqpyr.supabase.co';
const YUHINKAI_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHJuaHR2bXRiZWN5anpxcHlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE5NDIzNCwiZXhwIjoyMDgyNzcwMjM0fQ.z2PL1Ks7M3nhysvkMoD9z5rqZhRC62jkSDY0ncUOJNs';

const supabase = createClient(YUHINKAI_URL, YUHINKAI_KEY);

function printSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log('  ' + title);
  console.log('='.repeat(80));
}

function printSubSection(title) {
  console.log('\n' + '-'.repeat(60));
  console.log('  ' + title);
  console.log('-'.repeat(60));
}

function printRow(row, indent) {
  indent = indent || '  ';
  for (const [key, value] of Object.entries(row)) {
    const display = Array.isArray(value) ? JSON.stringify(value) : value;
    console.log(indent + key + ': ' + display);
  }
}

async function main() {
  // =========================================================================
  // 1. ALL gold_values rows mentioning YOS1434
  // =========================================================================
  printSection('1. ALL gold_values rows WHERE gold_smith_id = YOS1434 OR gold_maker_id = YOS1434');

  const { data: gvYos, error: gvYosErr } = await supabase
    .from('gold_values')
    .select('object_uuid, gold_smith_id, gold_maker_id, gold_artisan, gold_artisan_kanji, gold_artisan_code_v5, gold_mei, gold_mei_kanji, gold_form, gold_form_kanji, collections, synthesized_at')
    .or('gold_smith_id.eq.YOS1434,gold_maker_id.eq.YOS1434');

  if (gvYosErr) {
    console.error('Error:', gvYosErr);
  } else {
    console.log('\nTotal rows: ' + gvYos.length);
    const kokuhoCount = gvYos.filter(r => r.collections && r.collections.includes('Kokuho')).length;
    console.log('Kokuho count: ' + kokuhoCount);
    
    for (const row of gvYos) {
      console.log('\n  --- object_uuid: ' + row.object_uuid + ' ---');
      printRow(row, '    ');
    }
  }

  // =========================================================================
  // 2. Catalog records for the 3 known object_uuids (partial match)
  // =========================================================================
  printSection('2. Catalog records for the 3 known object_uuids');

  const uuidPrefixes = [
    { prefix: 'a98e8999', label: 'Suspected misattributed to YAS537' },
    { prefix: 'f7b9244a', label: 'Attributed to YOS1434' },
    { prefix: '6dec5fc0', label: 'Tomita-Go (correctly attributed)' },
  ];

  for (const { prefix, label } of uuidPrefixes) {
    printSubSection('UUID prefix: ' + prefix + ' (' + label + ')');

    const { data: catRows, error: catErr } = await supabase
      .from('catalog_records')
      .select('object_uuid, collection, item, title, smith_name, school_name, province_name, era_name, artisan_code_v5')
      .like('object_uuid', prefix + '%');

    if (catErr) {
      console.error('Error:', catErr);
    } else if (catRows.length === 0) {
      console.log('  No catalog records found with this prefix.');
      
      // Try broader search
      const { data: broader, error: broaderErr } = await supabase
        .from('catalog_records')
        .select('object_uuid, collection, item, title, smith_name')
        .like('object_uuid', prefix.substring(0, 6) + '%');
      
      if (!broaderErr && broader && broader.length > 0) {
        console.log('  Broader search (' + prefix.substring(0, 6) + '%) found ' + broader.length + ' rows:');
        for (const r of broader) {
          console.log('    uuid=' + r.object_uuid + ' collection=' + r.collection + ' title=' + r.title);
        }
      } else {
        console.log('  Broader search also found nothing.');
      }
    } else {
      console.log('  Found ' + catRows.length + ' catalog records:');
      for (const row of catRows) {
        console.log('\n    --- collection: ' + row.collection + ', item: ' + row.item + ' ---');
        printRow(row, '      ');
      }
    }
  }

  // =========================================================================
  // 3. Gold_values row for a98e8999 (the misattributed one)
  // =========================================================================
  printSection('3. Gold_values for a98e8999 (suspected misattributed)');

  const { data: gvMis, error: gvMisErr } = await supabase
    .from('gold_values')
    .select('*')
    .like('object_uuid', 'a98e8999%');

  if (gvMisErr) {
    console.error('Error:', gvMisErr);
  } else if (gvMis.length === 0) {
    console.log('  No gold_values found with prefix a98e8999.');
    
    // Try broader
    const { data: broader } = await supabase
      .from('gold_values')
      .select('object_uuid, gold_smith_id, gold_artisan, gold_artisan_kanji, collections')
      .like('object_uuid', 'a98e89%');
    
    if (broader && broader.length > 0) {
      console.log('  Broader search (a98e89%) found ' + broader.length + ' rows:');
      for (const r of broader) {
        console.log('    uuid=' + r.object_uuid + ' smith=' + r.gold_smith_id + ' artisan=' + r.gold_artisan);
      }
    } else {
      console.log('  Broader search also found nothing.');
    }
  } else {
    console.log('  Found ' + gvMis.length + ' gold_values rows:');
    for (const row of gvMis) {
      console.log('\n  Full row (non-null fields):');
      for (const [key, value] of Object.entries(row)) {
        if (value !== null) {
          const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
          console.log('    ' + key + ': ' + display);
        }
      }
    }
  }

  // =========================================================================
  // 4. Search for ALL Inaba-Go references in catalog_records
  // =========================================================================
  printSection('4. ALL catalog_records where title contains 稲葉 (Inaba)');

  const { data: inaba, error: inabaErr } = await supabase
    .from('catalog_records')
    .select('object_uuid, collection, item, title, smith_name, school_name, province_name, era_name, artisan_code_v5')
    .like('title', '%稲葉%');

  if (inabaErr) {
    console.error('Error:', inabaErr);
  } else {
    console.log('\nTotal catalog_records mentioning 稲葉: ' + inaba.length);
    
    // Group by object_uuid
    const byUuid = {};
    for (const row of inaba) {
      if (!byUuid[row.object_uuid]) byUuid[row.object_uuid] = [];
      byUuid[row.object_uuid].push(row);
    }
    
    console.log('Distinct object_uuids: ' + Object.keys(byUuid).length);
    
    for (const [uuid, rows] of Object.entries(byUuid)) {
      console.log('\n  === object_uuid: ' + uuid + ' (' + rows.length + ' catalog records) ===');
      for (const row of rows) {
        console.log('    collection: ' + row.collection + ' | item: ' + row.item);
        console.log('    title: ' + row.title);
        console.log('    smith: ' + row.smith_name + ' | school: ' + row.school_name + ' | province: ' + row.province_name + ' | era: ' + row.era_name);
        console.log('    artisan_code_v5: ' + row.artisan_code_v5);
        console.log('');
      }
    }
  }

  // Also search gold_values for Inaba references
  printSubSection('Gold_values where gold_artisan or gold_artisan_kanji contains Inaba/稲葉');
  
  const { data: inabaGv, error: inabaGvErr } = await supabase
    .from('gold_values')
    .select('object_uuid, gold_smith_id, gold_artisan, gold_artisan_kanji, gold_form, gold_form_kanji, collections')
    .or('gold_artisan.ilike.%inaba%,gold_artisan_kanji.ilike.%稲葉%');

  if (inabaGvErr) {
    console.error('Error:', inabaGvErr);
  } else {
    console.log('Found ' + ((inabaGv && inabaGv.length) || 0) + ' gold_values with Inaba reference');
    for (const row of (inabaGv || [])) {
      console.log('  uuid=' + row.object_uuid + ' smith=' + row.gold_smith_id + ' artisan=' + row.gold_artisan + ' collections=' + JSON.stringify(row.collections));
    }
  }

  // =========================================================================
  // 5. YAS537 (Yasutsuna) impact analysis
  // =========================================================================
  printSection('5. YAS537 (Yasutsuna) impact analysis');

  // 5a. artisan_makers for YAS537
  printSubSection('5a. artisan_makers for YAS537');
  
  const { data: yas537, error: yas537Err } = await supabase
    .from('artisan_makers')
    .select('maker_id, name_kanji, name_romaji, school_text, province_text, era_text, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, elite_factor, elite_count, designation_factor')
    .eq('maker_id', 'YAS537');

  if (yas537Err) {
    console.error('Error:', yas537Err);
  } else {
    for (const row of yas537) {
      printRow(row, '  ');
    }
  }

  // 5b. All gold_values for YAS537
  printSubSection('5b. All gold_values WHERE gold_smith_id = YAS537');
  
  const { data: gvYas, error: gvYasErr } = await supabase
    .from('gold_values')
    .select('object_uuid, gold_smith_id, gold_artisan, gold_artisan_kanji, gold_form, gold_form_kanji, gold_mei, gold_mei_kanji, collections, synthesized_at')
    .or('gold_smith_id.eq.YAS537,gold_maker_id.eq.YAS537');

  if (gvYasErr) {
    console.error('Error:', gvYasErr);
  } else {
    console.log('Total rows for YAS537: ' + gvYas.length);
    const yasByCollection = {};
    for (const row of gvYas) {
      for (const col of (row.collections || [])) {
        yasByCollection[col] = (yasByCollection[col] || 0) + 1;
      }
    }
    console.log('Collection breakdown: ' + JSON.stringify(yasByCollection, null, 2));
    
    // Show Kokuho ones in detail
    const kokuhoYas = gvYas.filter(r => r.collections && r.collections.includes('Kokuho'));
    console.log('\nKokuho objects attributed to YAS537: ' + kokuhoYas.length);
    for (const row of kokuhoYas) {
      console.log('\n  --- ' + row.object_uuid + ' ---');
      console.log('    artisan: ' + row.gold_artisan + ' (' + row.gold_artisan_kanji + ')');
      console.log('    form: ' + row.gold_form + ' (' + row.gold_form_kanji + ')');
      console.log('    mei: ' + row.gold_mei + ' (' + row.gold_mei_kanji + ')');
      console.log('    collections: ' + JSON.stringify(row.collections));
    }
  }

  // =========================================================================
  // 6. Are the 3 objects truly the same physical sword?
  // =========================================================================
  printSection('6. Cross-reference: Are these the same physical sword?');

  // Get all Inaba catalog records with ALL columns
  const { data: allInaba } = await supabase
    .from('catalog_records')
    .select('*')
    .like('title', '%稲葉%');

  if (allInaba && allInaba.length > 0) {
    const grouped = {};
    for (const row of allInaba) {
      if (!grouped[row.object_uuid]) grouped[row.object_uuid] = [];
      grouped[row.object_uuid].push(row);
    }

    console.log('\nDistinct objects with 稲葉 in title: ' + Object.keys(grouped).length);
    
    for (const [uuid, rows] of Object.entries(grouped)) {
      console.log('\n  ================================================================');
      console.log('  OBJECT: ' + uuid);
      console.log('  Collections: ' + rows.map(r => r.collection).join(', '));
      console.log('  ================================================================');
      
      for (const row of rows) {
        console.log('\n    [' + row.collection + '] item #' + row.item);
        console.log('    title: ' + row.title);
        console.log('    smith_name: ' + row.smith_name);
        console.log('    school_name: ' + row.school_name);
        console.log('    province_name: ' + row.province_name);
        console.log('    era_name: ' + row.era_name);
        console.log('    artisan_code_v5: ' + row.artisan_code_v5);
        
        // Show all non-null additional fields
        const skipKeys = new Set(['object_uuid', 'collection', 'item', 'title', 'smith_name', 'school_name', 
            'province_name', 'era_name', 'artisan_code_v5', 'id', 'created_at', 'updated_at']);
        const detailKeys = Object.keys(row).filter(k => !skipKeys.has(k) && row[k] !== null);
        if (detailKeys.length > 0) {
          console.log('    --- additional non-null fields ---');
          for (const k of detailKeys) {
            const v = typeof row[k] === 'object' ? JSON.stringify(row[k]) : row[k];
            console.log('    ' + k + ': ' + v);
          }
        }
      }
    }

    // Check gold_values for each
    printSubSection('Gold_values synthesis for each Inaba object');
    
    for (const uuid of Object.keys(grouped)) {
      const { data: gv } = await supabase
        .from('gold_values')
        .select('object_uuid, gold_smith_id, gold_maker_id, gold_artisan, gold_artisan_kanji, gold_artisan_code_v5, gold_form, gold_form_kanji, gold_mei, gold_mei_kanji, collections')
        .eq('object_uuid', uuid);

      if (gv && gv.length > 0) {
        for (const row of gv) {
          console.log('\n  ' + uuid + ':');
          console.log('    gold_smith_id: ' + row.gold_smith_id);
          console.log('    gold_artisan: ' + row.gold_artisan + ' (' + row.gold_artisan_kanji + ')');
          console.log('    gold_form: ' + row.gold_form + ' (' + row.gold_form_kanji + ')');
          console.log('    gold_mei: ' + row.gold_mei + ' (' + row.gold_mei_kanji + ')');
          console.log('    collections: ' + JSON.stringify(row.collections));
          console.log('    gold_artisan_code_v5: ' + row.gold_artisan_code_v5);
        }
      } else {
        console.log('\n  ' + uuid + ': NO gold_values row found');
      }
    }
  }

  // =========================================================================
  // BONUS: All Kokuho objects attributed to YOS1434 (Go Yoshihiro)
  // =========================================================================
  printSection('BONUS: All Kokuho objects attributed to YOS1434 (Go Yoshihiro)');
  
  const { data: gvYosKokuho } = await supabase
    .from('gold_values')
    .select('object_uuid, gold_artisan, gold_artisan_kanji, gold_form, gold_form_kanji, gold_mei, gold_mei_kanji, collections')
    .eq('gold_smith_id', 'YOS1434')
    .contains('collections', ['Kokuho']);

  if (gvYosKokuho) {
    console.log('Kokuho objects attributed to YOS1434: ' + gvYosKokuho.length);
    for (const row of gvYosKokuho) {
      console.log('\n  ' + row.object_uuid + ':');
      console.log('    artisan: ' + row.gold_artisan + ' (' + row.gold_artisan_kanji + ')');
      console.log('    form: ' + row.gold_form + ' (' + row.gold_form_kanji + ')');
      console.log('    mei: ' + row.gold_mei + ' (' + row.gold_mei_kanji + ')');
      console.log('    collections: ' + JSON.stringify(row.collections));
    }
  }

  // Also check artisan_makers for YOS1434
  printSubSection('artisan_makers for YOS1434');
  
  const { data: yos1434 } = await supabase
    .from('artisan_makers')
    .select('maker_id, name_kanji, name_romaji, school_text, province_text, era_text, kokuho_count, jubun_count, jubi_count, gyobutsu_count, tokuju_count, juyo_count, elite_factor, elite_count, designation_factor')
    .eq('maker_id', 'YOS1434');

  if (yos1434) {
    for (const row of yos1434) {
      printRow(row, '  ');
    }
  }

  // =========================================================================
  // BONUS 2: linked_records for Inaba objects
  // =========================================================================
  printSection('BONUS 2: linked_records for Inaba objects');

  if (allInaba) {
    const uuids = [...new Set(allInaba.map(r => r.object_uuid))];
    
    for (const uuid of uuids) {
      const { data: linked } = await supabase
        .from('linked_records')
        .select('*')
        .or('source_uuid.eq.' + uuid + ',target_uuid.eq.' + uuid);

      if (linked && linked.length > 0) {
        console.log('\n  Links for ' + uuid + ': ' + linked.length);
        for (const row of linked) {
          console.log('    ' + row.source_uuid + ' --[' + row.link_type + ']--> ' + row.target_uuid + ' (confidence: ' + row.confidence + ')');
        }
      } else {
        console.log('\n  ' + uuid + ': No linked_records found');
      }
    }
  }

  // =========================================================================
  // BONUS 3: Search for 江 (Go) in title to find other Go swords
  // =========================================================================
  printSection('BONUS 3: Catalog records where title contains 名物 AND 江 (famous Go swords)');

  const { data: goSwords } = await supabase
    .from('catalog_records')
    .select('object_uuid, collection, item, title, smith_name, artisan_code_v5')
    .like('title', '%名物%')
    .like('smith_name', '%義弘%');

  if (goSwords && goSwords.length > 0) {
    console.log('Found ' + goSwords.length + ' records:');
    const goGrouped = {};
    for (const r of goSwords) {
      if (!goGrouped[r.object_uuid]) goGrouped[r.object_uuid] = [];
      goGrouped[r.object_uuid].push(r);
    }
    for (const [uuid, rows] of Object.entries(goGrouped)) {
      console.log('\n  ' + uuid + ' (' + rows.map(r => r.collection).join(', ') + '):');
      console.log('    title: ' + rows[0].title);
      console.log('    smith: ' + rows[0].smith_name);
      console.log('    artisan_code_v5: ' + rows[0].artisan_code_v5);
    }
  } else {
    console.log('No results found.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
