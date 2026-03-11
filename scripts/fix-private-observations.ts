/**
 * Fix artisan codes on private observations — use the top-tier (highest TT) for each name.
 * Then verify all 14 rows.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);
const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';
const yuhinkai = createClient(yuhinkaiUrl, yuhinkaiKey);

async function getArtisan(code: string) {
  const { data } = await yuhinkai
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, toko_taikan, hawley, fujishiro, elite_factor')
    .eq('maker_id', code)
    .single();
  return data;
}

// Find the highest TT artisan for a given name_romaji (exact match)
async function findTopByName(name: string) {
  const { data } = await yuhinkai
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, toko_taikan, hawley, fujishiro, elite_factor')
    .eq('name_romaji', name)
    .not('toko_taikan', 'is', null)
    .order('toko_taikan', { ascending: false })
    .limit(3);
  return data || [];
}

const FUJISHIRO_ORD: Record<string, number> = {
  'Chu saku': 1, 'Chu-jo saku': 2, 'Jo saku': 3, 'Jo-jo saku': 4, 'Sai-jo saku': 5,
};

async function main() {
  // 1. Look up MAS590 specifically
  console.log('1. Looking up MAS590 (Masamune)...');
  const mas590 = await getArtisan('MAS590');
  console.log('  MAS590:', mas590);

  // 2. Verify all current artisan assignments by finding the highest TT for each name
  console.log('\n2. Finding highest-TT artisan for each name...\n');
  const names = ['Masamune', 'Mitsutada', 'Norishige', 'Yukimitsu', 'Sukezane', 'Yoshifusa', 'Yoshimitsu'];
  const corrections: Record<string, { maker_id: string; name_romaji: string; toko_taikan: number | null; hawley: number | null; fujishiro: string | null; elite_factor: number | null }> = {};

  for (const name of names) {
    const top = await findTopByName(name);
    if (top.length > 0) {
      console.log(`  ${name}:`);
      for (const t of top) {
        console.log(`    ${t.maker_id} — ${t.name_kanji} TT=${t.toko_taikan} HW=${t.hawley} FJ=${t.fujishiro} EF=${t.elite_factor}`);
      }
      corrections[name] = top[0]; // highest TT
    }
  }

  // Override Masamune to MAS590 per user instruction
  if (mas590) {
    corrections['Masamune'] = mas590;
    console.log(`\n  Masamune override → MAS590 (TT=${mas590.toko_taikan}, EF=${mas590.elite_factor})`);
  }

  console.log('\n3. Final artisan map:');
  for (const [name, a] of Object.entries(corrections)) {
    console.log(`  ${name.padEnd(14)} → ${a.maker_id} (TT=${a.toko_taikan}, HW=${a.hawley}, FJ=${a.fujishiro}, EF=${a.elite_factor})`);
  }

  // 3. Update all 14 private observations
  console.log('\n4. Updating rows...');

  const { data: rows } = await supabase
    .from('market_price_observations')
    .select('id, artisan_id, artisan_name')
    .eq('source', 'private_sale')
    .order('id');

  if (!rows || rows.length === 0) {
    console.log('  No private_sale rows found!');
    return;
  }

  // Map old artisan_id → name for correction lookup
  const oldIdToName: Record<string, string> = {
    'MAS1568': 'Masamune',
    'MIT281': 'Mitsutada',
    'NOR303': 'Norishige',
    'YUK252': 'Yukimitsu',
    'SUK460': 'Sukezane',
    'YOS38': 'Yoshifusa',
    'YOS412': 'Yoshimitsu',
  };

  let updated = 0;
  for (const row of rows) {
    const name = oldIdToName[row.artisan_id] || row.artisan_name;
    const correct = corrections[name];
    if (!correct) {
      console.log(`  Row ${row.id}: no correction for ${name}, skipping`);
      continue;
    }

    const { error } = await supabase
      .from('market_price_observations')
      .update({
        artisan_id: correct.maker_id,
        artisan_name: correct.name_romaji,
        elite_factor: correct.elite_factor,
        toko_taikan: correct.toko_taikan,
        hawley: correct.hawley,
        fujishiro: correct.fujishiro,
        fujishiro_ord: correct.fujishiro ? (FUJISHIRO_ORD[correct.fujishiro] ?? null) : null,
      })
      .eq('id', row.id);

    if (error) {
      console.log(`  Row ${row.id}: ERROR ${error.message}`);
    } else {
      const changed = row.artisan_id !== correct.maker_id ? ' (CHANGED)' : '';
      console.log(`  Row ${row.id}: ${name} → ${correct.maker_id} TT=${correct.toko_taikan}${changed}`);
      updated++;
    }
  }

  console.log(`\n  ${updated}/${rows.length} rows updated`);

  // 4. Verify final state
  console.log('\n5. Final verification:');
  const { data: final } = await supabase
    .from('market_price_observations')
    .select('id, artisan_id, artisan_name, cert_type, cert_ordinal, item_type, price_jpy, toko_taikan, elite_factor, hawley, was_sold')
    .eq('source', 'private_sale')
    .order('price_jpy', { ascending: false });

  console.table(final);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
