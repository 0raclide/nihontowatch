/**
 * Insert Masamune tanto observations.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  // MAS590 ratings from earlier lookup:
  // TT=2500, HW=400, FJ=Sai-jo saku (ord=5), EF=1.63

  const observations = [
    {
      source: 'private_sale',
      price_value: 400_000,
      price_currency: 'USD',
      price_jpy: 400_000 * 150, // ¥60M
      was_sold: true,
      item_type: 'tanto',
      item_category: 'blade',
      cert_type: null,
      cert_ordinal: 0,
      artisan_id: 'MAS590',
      artisan_name: 'Masamune',
      elite_factor: 1.63,
      toko_taikan: 2500,
      hawley: 400,
      fujishiro: 'Sai-jo saku',
      fujishiro_ord: 5,
      notes: 'Masamune tanto mumei, sold',
      added_by: 'chris_manual',
    },
    {
      source: 'private_sale',
      price_value: 600_000,
      price_currency: 'USD',
      price_jpy: 600_000 * 150, // ¥90M
      was_sold: false,
      item_type: 'tanto',
      item_category: 'blade',
      cert_type: 'Tokuju',
      cert_ordinal: 6,
      artisan_id: 'MAS590',
      artisan_name: 'Masamune',
      elite_factor: 1.63,
      toko_taikan: 2500,
      hawley: 400,
      fujishiro: 'Sai-jo saku',
      fujishiro_ord: 5,
      notes: 'Tokuju Masamune tanto, current asking price',
      added_by: 'chris_manual',
    },
  ];

  const { data, error } = await supabase
    .from('market_price_observations')
    .insert(observations)
    .select('id, artisan_name, cert_type, item_type, price_jpy, was_sold, notes');

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('Inserted:');
  console.table(data);

  // Quick count
  const { count } = await supabase
    .from('market_price_observations')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'private_sale');
  console.log(`\nTotal private observations: ${count}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
