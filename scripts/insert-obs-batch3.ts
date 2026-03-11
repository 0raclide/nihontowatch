import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);
const yuhinkai = createClient(
  process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '',
  process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || ''
);

const FUJISHIRO_ORD: Record<string, number> = {
  'Chu saku': 1, 'Chu-jo saku': 2, 'Jo saku': 3, 'Jo-jo saku': 4, 'Sai-jo saku': 5,
};

async function getArtisan(code: string) {
  const { data } = await yuhinkai
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, toko_taikan, hawley, fujishiro, elite_factor')
    .eq('maker_id', code)
    .single();
  return data;
}

async function findTop(name: string) {
  const { data } = await yuhinkai
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, toko_taikan, hawley, fujishiro, elite_factor')
    .eq('name_romaji', name)
    .not('toko_taikan', 'is', null)
    .order('toko_taikan', { ascending: false })
    .limit(5);
  return data || [];
}

async function main() {
  // 1. Fix row 5895: Rai Kunimitsu → KUN539
  console.log('1. Fixing row 5895 (Kunimitsu → KUN539)...');
  const kun539 = await getArtisan('KUN539');
  console.log(`   KUN539: ${kun539?.name_kanji} TT=${kun539?.toko_taikan} HW=${kun539?.hawley} FJ=${kun539?.fujishiro} EF=${kun539?.elite_factor}`);

  const { error: fixErr } = await supabase
    .from('market_price_observations')
    .update({
      artisan_id: 'KUN539',
      elite_factor: kun539?.elite_factor,
      toko_taikan: kun539?.toko_taikan,
      hawley: kun539?.hawley,
      fujishiro: kun539?.fujishiro,
      fujishiro_ord: kun539?.fujishiro ? (FUJISHIRO_ORD[kun539.fujishiro] ?? null) : null,
    })
    .eq('id', 5895);
  if (fixErr) console.error('   Fix error:', fixErr.message);
  else console.log('   Fixed.');

  // 2. Look up Nagamitsu (Osafune)
  console.log('\n2. Looking up Nagamitsu...');
  const nagamitsu = await findTop('Nagamitsu');
  for (const r of nagamitsu) console.log(`   ${r.maker_id} — ${r.name_kanji} TT=${r.toko_taikan} HW=${r.hawley} FJ=${r.fujishiro} EF=${r.elite_factor}`);
  const nag = nagamitsu[0];
  if (!nag) { console.error('Nagamitsu not found'); process.exit(1); }
  console.log(`   Using: ${nag.maker_id} (${nag.name_kanji}, TT=${nag.toko_taikan})`);

  // 3. Insert new observations
  // KUN539 = Shintogo Kunimitsu (already looked up)
  const observations = [
    {
      source: 'private_sale',
      price_value: 20_000_000,
      price_currency: 'JPY',
      price_jpy: 20_000_000,
      was_sold: true,
      item_type: 'tanto',
      item_category: 'blade',
      cert_type: 'Juyo',
      cert_ordinal: 5,
      artisan_id: 'KUN539',
      artisan_name: kun539?.name_romaji,
      elite_factor: kun539?.elite_factor,
      toko_taikan: kun539?.toko_taikan,
      hawley: kun539?.hawley,
      fujishiro: kun539?.fujishiro,
      fujishiro_ord: kun539?.fujishiro ? (FUJISHIRO_ORD[kun539.fujishiro] ?? null) : null,
      notes: 'Shintogo Kunimitsu zaimei tanto, Juyo, sold',
      added_by: 'chris_manual',
    },
    {
      source: 'private_sale',
      price_value: 50_000_000,
      price_currency: 'JPY',
      price_jpy: 50_000_000,
      was_sold: true,
      item_type: 'katana',
      item_category: 'blade',
      cert_type: 'Tokuju',
      cert_ordinal: 6,
      artisan_id: nag.maker_id,
      artisan_name: nag.name_romaji,
      elite_factor: nag.elite_factor,
      toko_taikan: nag.toko_taikan,
      hawley: nag.hawley,
      fujishiro: nag.fujishiro,
      fujishiro_ord: nag.fujishiro ? (FUJISHIRO_ORD[nag.fujishiro] ?? null) : null,
      notes: 'Tokuju Osafune Nagamitsu, sold',
      added_by: 'chris_manual',
    },
  ];

  console.log('\n3. Inserting...');
  const { data, error } = await supabase
    .from('market_price_observations')
    .insert(observations)
    .select('id, artisan_id, artisan_name, cert_type, item_type, price_jpy, toko_taikan, elite_factor, was_sold, notes');

  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.table(data);

  const { count } = await supabase
    .from('market_price_observations')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'private_sale');
  console.log(`\nTotal private observations: ${count}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
