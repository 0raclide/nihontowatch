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

async function lookup(name: string) {
  const { data } = await yuhinkai
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, toko_taikan, hawley, fujishiro, elite_factor')
    .eq('name_romaji', name)
    .not('toko_taikan', 'is', null)
    .order('toko_taikan', { ascending: false })
    .limit(3);
  return data || [];
}

async function main() {
  // Look up Rai Kunimitsu
  const kunimitsu = await lookup('Kunimitsu');
  console.log('Kunimitsu candidates:');
  for (const r of kunimitsu) console.log(`  ${r.maker_id} — ${r.name_kanji} TT=${r.toko_taikan} HW=${r.hawley} FJ=${r.fujishiro} EF=${r.elite_factor}`);

  // Rai Kunimitsu should be the top one
  const rai = kunimitsu[0];
  if (!rai) { console.error('Kunimitsu not found'); process.exit(1); }
  console.log(`\nUsing: ${rai.maker_id} (${rai.name_kanji}, TT=${rai.toko_taikan})`);

  // MAS590 from earlier
  const mas = { maker_id: 'MAS590', name_romaji: 'Masamune', toko_taikan: 2500, hawley: 400, fujishiro: 'Sai-jo saku', elite_factor: 1.63 };

  const observations = [
    {
      source: 'private_sale',
      price_value: 300_000,
      price_currency: 'USD',
      price_jpy: 300_000 * 150,
      was_sold: true,
      item_type: 'tanto',
      item_category: 'blade',
      cert_type: 'Tokuju',
      cert_ordinal: 6,
      artisan_id: rai.maker_id,
      artisan_name: rai.name_romaji,
      elite_factor: rai.elite_factor,
      toko_taikan: rai.toko_taikan,
      hawley: rai.hawley,
      fujishiro: rai.fujishiro,
      fujishiro_ord: rai.fujishiro ? (FUJISHIRO_ORD[rai.fujishiro] ?? null) : null,
      notes: 'Rai Kunimitsu zaimei tanto, Tokuju, sold',
      added_by: 'chris_manual',
    },
    {
      source: 'private_sale',
      price_value: 1_000_000,
      price_currency: 'USD',
      price_jpy: 1_000_000 * 150,
      was_sold: true,
      item_type: 'naginata',
      item_category: 'blade',
      cert_type: 'Tokuju',
      cert_ordinal: 6,
      artisan_id: mas.maker_id,
      artisan_name: mas.name_romaji,
      elite_factor: mas.elite_factor,
      toko_taikan: mas.toko_taikan,
      hawley: mas.hawley,
      fujishiro: mas.fujishiro,
      fujishiro_ord: FUJISHIRO_ORD[mas.fujishiro],
      notes: 'Masamune naginata naoshi mumei, Tokuju, sold',
      added_by: 'chris_manual',
    },
  ];

  const { data, error } = await supabase
    .from('market_price_observations')
    .insert(observations)
    .select('id, artisan_name, cert_type, item_type, price_jpy, was_sold, notes');

  if (error) { console.error('Error:', error.message); process.exit(1); }

  console.log('\nInserted:');
  console.table(data);

  const { count } = await supabase
    .from('market_price_observations')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'private_sale');
  console.log(`Total private observations: ${count}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
