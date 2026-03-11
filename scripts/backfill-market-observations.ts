/**
 * Backfill market_price_observations from existing listings + Yuhinkai ratings.
 *
 * Joins listings (priced, non-hidden, available or sold) with artisan_makers
 * to pre-compute all model features. Uses service role key for writes.
 *
 * Run with: npx tsx scripts/backfill-market-observations.ts [--dry-run] [--limit N]
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Main Supabase — service role for writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Yuhinkai (read-only)
const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';
if (!yuhinkaiUrl || !yuhinkaiKey) {
  console.error('Yuhinkai credentials not configured.');
  process.exit(1);
}
const yuhinkai = createClient(yuhinkaiUrl, yuhinkaiKey);

// ── Constants ────────────────────────────────────────────────────

const TO_JPY: Record<string, number> = { JPY: 1, USD: 150, EUR: 163, GBP: 190, AUD: 98, CAD: 110, CHF: 170 };

const CERT_ORDINAL: Record<string, number> = {
  'none': 0, 'Registration': 0, 'Kicho': 1, 'Kanteisho': 1,
  'Tokubetsu Kicho': 2, 'Koshu Tokubetsu Kicho': 2,
  'Hozon': 3, 'Hozon Tosogu': 3,
  'Tokubetsu Hozon': 4, 'Tokubetsu Hozon Tosogu': 4, 'Tokubetsu Kicho Tosogu': 4,
  'Juyo': 5, 'Juyo Bijutsuhin': 5, 'juyo_bijutsuhin': 5,
  'Tokuju': 6,
};

const FUJISHIRO_ORD: Record<string, number> = {
  'Chu saku': 1, 'Chu-jo saku': 2, 'Jo saku': 3, 'Jo-jo saku': 4, 'Sai-jo saku': 5,
};

const BLADE_TYPES = new Set(['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken']);
const TOSOGU_TYPES = new Set(['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'fuchi-kashira']);

function itemCategory(type: string): string {
  if (BLADE_TYPES.has(type)) return 'blade';
  if (TOSOGU_TYPES.has(type)) return 'tosogu';
  if (type === 'koshirae') return 'koshirae';
  return 'other';
}

// ── CLI args ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  BACKFILL market_price_observations                  ║');
  console.log(`║  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}${limit < Infinity ? `, limit=${limit}` : ''}`.padEnd(54) + '║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  // 1. Fetch all priced listings
  console.log('\n1. Fetching listings...');
  const PAGE = 1000;
  let allListings: Record<string, unknown>[] = [];
  let offset = 0;
  const select = [
    'id', 'url', 'price_value', 'price_currency',
    'artisan_id', 'artisan_elite_factor', 'artisan_confidence',
    'cert_type', 'item_type',
    'nagasa_cm',
    'dealer_id', 'is_available', 'is_sold', 'admin_hidden',
    'first_seen_at',
  ].join(', ');

  while (true) {
    const { data, error } = await supabase.from('listings').select(select).range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allListings = allListings.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`  ${allListings.length.toLocaleString()} total listings`);

  // Filter to priced, non-hidden
  const qualified = allListings.filter(r =>
    !r.admin_hidden &&
    (r.is_available || r.is_sold) &&
    r.price_value && (r.price_value as number) > 0
  );
  console.log(`  ${qualified.length.toLocaleString()} qualified (priced, non-hidden, available+sold)`);

  // 2. Fetch artisan ratings from Yuhinkai
  console.log('\n2. Fetching Yuhinkai ratings...');
  const artisanIds = new Set<string>();
  const schoolIds = new Set<string>();
  for (const r of qualified) {
    const aid = r.artisan_id as string;
    if (!aid || aid === 'UNKNOWN') continue;
    if (aid.startsWith('NS-')) schoolIds.add(aid);
    else artisanIds.add(aid);
  }

  type ArtisanRating = { toko_taikan: number | null; hawley: number | null; fujishiro: string | null; name_romaji: string | null };
  const ratings: Record<string, ArtisanRating> = {};

  // Fetch makers
  const makerIds = [...artisanIds];
  for (let i = 0; i < makerIds.length; i += 500) {
    const batch = makerIds.slice(i, i + 500);
    const { data } = await yuhinkai
      .from('artisan_makers')
      .select('maker_id, toko_taikan, hawley, fujishiro, name_romaji')
      .in('maker_id', batch);
    for (const d of data || []) {
      ratings[d.maker_id] = { toko_taikan: d.toko_taikan, hawley: d.hawley, fujishiro: d.fujishiro, name_romaji: d.name_romaji };
    }
  }

  // Fetch schools
  if (schoolIds.size > 0) {
    const { data } = await yuhinkai
      .from('artisan_schools')
      .select('school_id, toko_taikan, hawley, fujishiro, name_romaji')
      .in('school_id', [...schoolIds]);
    for (const d of data || []) {
      ratings[d.school_id] = { toko_taikan: d.toko_taikan, hawley: d.hawley, fujishiro: d.fujishiro, name_romaji: d.name_romaji };
    }
  }

  const withTT = Object.values(ratings).filter(r => r.toko_taikan != null).length;
  const withHW = Object.values(ratings).filter(r => r.hawley != null).length;
  console.log(`  ${Object.keys(ratings).length} artisans loaded (${withTT} with TT, ${withHW} with hawley)`);

  // 3. Fetch dealer names
  console.log('\n3. Fetching dealers...');
  const { data: dealers } = await supabase.from('dealers').select('id, name, country');
  const dealerMap: Record<number, { name: string; country: string }> = {};
  for (const d of dealers || []) {
    dealerMap[d.id] = { name: d.name, country: d.country || 'JP' };
  }

  // 4. Build observation rows
  console.log('\n4. Building observation rows...');
  type ObsRow = Record<string, unknown>;
  const rows: ObsRow[] = [];

  for (const r of qualified) {
    if (rows.length >= limit) break;

    const priceVal = r.price_value as number;
    const currency = (r.price_currency as string) || 'JPY';
    const rate = TO_JPY[currency] || 1;
    const priceJpy = priceVal * rate;
    if (priceJpy < 5000) continue; // Filter data errors

    const cert = (r.cert_type as string) || 'none';
    const certOrd = CERT_ORDINAL[cert] ?? null;

    const itemType = (r.item_type as string) || 'unknown';
    const iCat = itemCategory(itemType);

    const artisanId = (r.artisan_id as string) || null;
    const artRating = artisanId ? ratings[artisanId] : null;

    const dealerId = r.dealer_id as number;
    const dealer = dealerMap[dealerId];

    rows.push({
      source: 'scraped',
      listing_id: r.id,
      listing_url: r.url,
      price_value: priceVal,
      price_currency: currency,
      price_jpy: priceJpy,
      observed_at: r.first_seen_at || new Date().toISOString(),
      was_sold: !!r.is_sold,
      item_type: itemType,
      item_category: iCat,
      cert_type: cert === 'none' ? null : cert,
      cert_ordinal: certOrd,
      artisan_id: artisanId !== 'UNKNOWN' ? artisanId : null,
      artisan_name: artRating?.name_romaji || null,
      elite_factor: r.artisan_elite_factor as number ?? null,
      toko_taikan: artRating?.toko_taikan ?? null,
      hawley: artRating?.hawley ?? null,
      fujishiro: artRating?.fujishiro ?? null,
      fujishiro_ord: artRating?.fujishiro ? (FUJISHIRO_ORD[artRating.fujishiro] ?? null) : null,
      nagasa_cm: r.nagasa_cm || null,
      dealer_id: dealerId,
      dealer_name: dealer?.name || null,
      dealer_country: dealer?.country || null,
    });
  }

  console.log(`  ${rows.length.toLocaleString()} observation rows built`);

  // Stats
  const stats = {
    total: rows.length,
    withTT: rows.filter(r => r.toko_taikan != null).length,
    withHawley: rows.filter(r => r.hawley != null).length,
    withEF: rows.filter(r => r.elite_factor != null && (r.elite_factor as number) > 0).length,
    withFujishiro: rows.filter(r => r.fujishiro_ord != null).length,
    blades: rows.filter(r => r.item_category === 'blade').length,
    tosogu: rows.filter(r => r.item_category === 'tosogu').length,
    sold: rows.filter(r => r.was_sold).length,
  };
  console.log(`  Blades: ${stats.blades}, Tosogu: ${stats.tosogu}, Sold: ${stats.sold}`);
  console.log(`  With TT: ${stats.withTT}, Hawley: ${stats.withHawley}, EF>0: ${stats.withEF}, Fujishiro: ${stats.withFujishiro}`);

  if (dryRun) {
    console.log('\n  DRY RUN — no writes. Sample rows:');
    for (const row of rows.slice(0, 3)) {
      console.log('   ', JSON.stringify(row, null, 2).split('\n').slice(0, 10).join('\n    '));
    }
    return;
  }

  // 5. Upsert in batches
  console.log('\n5. Upserting...');
  const BATCH = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('market_price_observations')
      .insert(batch);

    if (error) {
      console.error(`  Batch ${i / BATCH + 1} error: ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
    }

    if ((i / BATCH + 1) % 5 === 0) {
      console.log(`  ${inserted.toLocaleString()} / ${rows.length.toLocaleString()} upserted...`);
    }
  }

  console.log(`\n  Done: ${inserted.toLocaleString()} upserted, ${errors} batch errors`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
