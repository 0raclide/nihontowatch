/**
 * Insert private market observations into market_price_observations.
 *
 * Run with: npx tsx scripts/insert-private-observations.ts
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

const TO_JPY: Record<string, number> = { JPY: 1, USD: 150, EUR: 163 };

const FUJISHIRO_ORD: Record<string, number> = {
  'Chu saku': 1, 'Chu-jo saku': 2, 'Jo saku': 3, 'Jo-jo saku': 4, 'Sai-jo saku': 5,
};

async function lookupArtisan(searchTerm: string) {
  // Try exact name match first
  const { data: makers } = await yuhinkai
    .from('artisan_makers')
    .select('maker_id, name_romaji, name_kanji, toko_taikan, hawley, fujishiro, elite_factor')
    .ilike('name_romaji', `%${searchTerm}%`)
    .limit(5);

  return makers || [];
}

async function main() {
  // 1. Look up artisan codes
  console.log('Looking up artisan codes...\n');

  const searches = ['Masamune', 'Mitsutada', 'Norishige', 'Yukimitsu', 'Sukezane', 'Yoshifusa', 'Yoshimitsu'];
  const artisanMap: Record<string, { maker_id: string; name_romaji: string; toko_taikan: number | null; hawley: number | null; fujishiro: string | null; elite_factor: number | null }> = {};

  for (const name of searches) {
    const results = await lookupArtisan(name);
    console.log(`  ${name}:`);
    for (const r of results) {
      console.log(`    ${r.maker_id} — ${r.name_romaji} (${r.name_kanji || '?'}) TT=${r.toko_taikan} HW=${r.hawley} FJ=${r.fujishiro} EF=${r.elite_factor}`);
    }
    // Store the most notable match (highest toko_taikan or elite_factor)
    if (results.length > 0) {
      const best = results.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.toko_taikan as number) || 0) - ((a.toko_taikan as number) || 0) ||
        ((b.elite_factor as number) || 0) - ((a.elite_factor as number) || 0)
      )[0];
      artisanMap[name] = best;
    }
  }

  console.log('\nSelected artisans:');
  for (const [name, a] of Object.entries(artisanMap)) {
    console.log(`  ${name} → ${a.maker_id} (TT=${a.toko_taikan}, EF=${a.elite_factor})`);
  }

  // 2. Build observations
  type Obs = {
    source: string;
    price_value: number;
    price_currency: string;
    price_jpy: number;
    was_sold: boolean;
    item_type: string;
    item_category: string;
    cert_type: string | null;
    cert_ordinal: number;
    artisan_id: string;
    artisan_name: string;
    elite_factor: number | null;
    toko_taikan: number | null;
    hawley: number | null;
    fujishiro: string | null;
    fujishiro_ord: number | null;
    notes: string;
    added_by: string;
  };

  function makeObs(o: {
    artisan: string; price: number; currency: string; cert: string; certOrd: number;
    itemType: string; sold: boolean; notes: string;
  }): Obs {
    const a = artisanMap[o.artisan];
    if (!a) throw new Error(`Artisan not found: ${o.artisan}`);
    return {
      source: 'private_sale',
      price_value: o.price,
      price_currency: o.currency,
      price_jpy: o.price * (TO_JPY[o.currency] || 1),
      was_sold: o.sold,
      item_type: o.itemType,
      item_category: 'blade',
      cert_type: o.cert,
      cert_ordinal: o.certOrd,
      artisan_id: a.maker_id,
      artisan_name: a.name_romaji,
      elite_factor: a.elite_factor,
      toko_taikan: a.toko_taikan,
      hawley: a.hawley,
      fujishiro: a.fujishiro,
      fujishiro_ord: a.fujishiro ? (FUJISHIRO_ORD[a.fujishiro] ?? null) : null,
      notes: o.notes,
      added_by: 'chris_manual',
    };
  }

  const observations: Obs[] = [
    // 1. Juyo Masamune katana sold for 1M EUR
    makeObs({ artisan: 'Masamune', price: 1_000_000, currency: 'EUR', cert: 'Juyo', certOrd: 5,
      itemType: 'katana', sold: true, notes: 'Juyo Masamune katana, private sale' }),

    // 2. Mitsutada zaimei tachi TokuHozon 25M JPY
    makeObs({ artisan: 'Mitsutada', price: 25_000_000, currency: 'JPY', cert: 'Tokubetsu Hozon', certOrd: 4,
      itemType: 'tachi', sold: true, notes: 'Mitsutada zaimei tachi, Tokubetsu Hozon' }),

    // 3. Juyo Mitsutada zaimei tachi 55M JPY
    makeObs({ artisan: 'Mitsutada', price: 55_000_000, currency: 'JPY', cert: 'Juyo', certOrd: 5,
      itemType: 'tachi', sold: true, notes: 'Juyo Mitsutada zaimei tachi' }),

    // 4. Tokuju Norishige 30M JPY
    makeObs({ artisan: 'Norishige', price: 30_000_000, currency: 'JPY', cert: 'Tokuju', certOrd: 6,
      itemType: 'katana', sold: true, notes: 'Tokuju Norishige' }),

    // 5. Tokuju Norishige 32M JPY
    makeObs({ artisan: 'Norishige', price: 32_000_000, currency: 'JPY', cert: 'Tokuju', certOrd: 6,
      itemType: 'katana', sold: true, notes: 'Tokuju Norishige (separate transaction)' }),

    // 6. Tokuju Yukimitsu 38M JPY
    makeObs({ artisan: 'Yukimitsu', price: 38_000_000, currency: 'JPY', cert: 'Tokuju', certOrd: 6,
      itemType: 'katana', sold: true, notes: 'Tokuju Yukimitsu' }),

    // 7. Juyo Yukimitsu 130K EUR
    makeObs({ artisan: 'Yukimitsu', price: 130_000, currency: 'EUR', cert: 'Juyo', certOrd: 5,
      itemType: 'katana', sold: true, notes: 'Juyo Yukimitsu' }),

    // 8. Mitsutada zaimei kodachi TokuHozon sold 10M JPY
    makeObs({ artisan: 'Mitsutada', price: 10_000_000, currency: 'JPY', cert: 'Tokubetsu Hozon', certOrd: 4,
      itemType: 'katana', sold: true, notes: 'Mitsutada zaimei kodachi, Tokubetsu Hozon' }),

    // 9. Signed Sukezane 300K USD
    makeObs({ artisan: 'Sukezane', price: 300_000, currency: 'USD', cert: null, certOrd: 0,
      itemType: 'katana', sold: true, notes: 'Signed Sukezane' }),

    // 10. Signed Ichimonji Yoshifusa 200K USD
    makeObs({ artisan: 'Yoshifusa', price: 200_000, currency: 'USD', cert: null, certOrd: 0,
      itemType: 'katana', sold: true, notes: 'Signed Ichimonji Yoshifusa' }),

    // 11. Signed Awataguchi Yoshimitsu tanto TokuHozon 18M JPY
    makeObs({ artisan: 'Yoshimitsu', price: 18_000_000, currency: 'JPY', cert: 'Tokubetsu Hozon', certOrd: 4,
      itemType: 'tanto', sold: true, notes: 'Signed Awataguchi Yoshimitsu tanto, Tokubetsu Hozon' }),

    // 12. Juyo signed Awataguchi Yoshimitsu tanto 25M JPY
    makeObs({ artisan: 'Yoshimitsu', price: 25_000_000, currency: 'JPY', cert: 'Juyo', certOrd: 5,
      itemType: 'tanto', sold: true, notes: 'Juyo signed Awataguchi Yoshimitsu tanto' }),

    // 13. Mikazuki signed tachi Tokuju from Osafune 200M JPY
    makeObs({ artisan: 'Mitsutada', price: 200_000_000, currency: 'JPY', cert: 'Tokuju', certOrd: 6,
      itemType: 'tachi', sold: true, notes: 'Mikazuki signed tachi (Tokuju), Osafune. Famous sword.' }),

    // 14. Juyo Masamune katana asking price 180M JPY
    makeObs({ artisan: 'Masamune', price: 180_000_000, currency: 'JPY', cert: 'Juyo', certOrd: 5,
      itemType: 'katana', sold: false, notes: 'Juyo Masamune katana, asking price (online listing)' }),
  ];

  console.log(`\n3. Inserting ${observations.length} observations...`);
  for (const obs of observations) {
    console.log(`  ${obs.artisan_name} ${obs.cert_type || 'no cert'} ${obs.item_type}: ¥${(obs.price_jpy / 1_000_000).toFixed(1)}M ${obs.was_sold ? '(sold)' : '(asking)'}`);
  }

  const { data, error } = await supabase
    .from('market_price_observations')
    .insert(observations)
    .select('id, artisan_name, cert_type, price_jpy, was_sold');

  if (error) {
    console.error('\nInsert error:', error.message);
    process.exit(1);
  }

  console.log(`\nInserted ${data.length} rows:`);
  console.table(data);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
