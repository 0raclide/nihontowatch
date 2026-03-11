/**
 * Insert Oshi-Jussi price records into market_price_observations.
 *
 * Chain: Jussi master_id → uuid_mapping → gold_values.gold_smith_id → artisan_makers ratings
 * Deduplicates against existing NW URLs.
 *
 * Run: npx tsx scripts/insert-jussi-observations.ts [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Service role for writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';
if (!yuhinkaiUrl || !yuhinkaiKey) {
  console.error('Yuhinkai credentials not configured.');
  process.exit(1);
}
const yuhinkai = createClient(yuhinkaiUrl, yuhinkaiKey);

const DRY_RUN = process.argv.includes('--dry-run');

// ── Constants ─────────────────────────────────────────────────────

const CERT_ORDINAL: Record<string, number> = {
  '': 0,
  'Registration': 0,
  'Kicho': 1,
  'Kanteisho': 1,
  'Tokubetsu Kicho': 2,
  'Koshu Tokubetsu Kicho': 2,
  'Hozon': 3,
  'Hozon Tosogu': 3,
  'Tokubetsu Hozon': 4,
  'Tokubetsu Hozon Tosogu': 4,
  'Juyo': 5,
  'Juyo Bijutsuhin': 5,
  'Tokubetsu Juyo': 6,
  'Tokuju': 6,
};

// Map Jussi cert text → standard cert_type used in NW
const CERT_TYPE_MAP: Record<string, string | null> = {
  '': null,
  'Registration': 'Registration',
  'Kicho': 'Kicho',
  'Kanteisho': 'Kanteisho',
  'Tokubetsu Kicho': 'Tokubetsu Kicho',
  'Koshu Tokubetsu Kicho': 'Tokubetsu Kicho',
  'Hozon': 'Hozon',
  'Hozon Tosogu': 'Hozon',
  'Tokubetsu Hozon': 'Tokubetsu Hozon',
  'Tokubetsu Hozon Tosogu': 'Tokubetsu Hozon',
  'Juyo': 'Juyo',
  'Juyo Bijutsuhin': 'Juyo Bijutsuhin',
  'Tokubetsu Juyo': 'Tokuju',
  'Tokuju': 'Tokuju',
  'NTHK': 'NTHK',
  'Tanobe': null, // Tanobe sayagaki — not a formal cert
};

const BLADE_TYPES = new Set(['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken']);

function normalizeBladeType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'katana') return 'katana';
  if (lower === 'wakizashi') return 'wakizashi';
  if (lower === 'tanto' || lower === 'tantō') return 'tanto';
  if (lower === 'tachi' || lower === 'tachi (mounted)') return 'tachi';
  if (lower.includes('naginata')) return 'naginata';
  if (lower === 'yari') return 'yari';
  if (lower === 'ken') return 'ken';
  if (lower === 'kodachi') return 'wakizashi'; // kodachi ≈ short sword
  if (lower === 'naoshi') return 'katana'; // naoshi = retempered/reforged
  if (lower === 'nagamaki') return 'naginata';
  return lower;
}

function itemCategory(type: string): string {
  if (BLADE_TYPES.has(type)) return 'blade';
  return 'other';
}

const FUJISHIRO_ORD: Record<string, number> = {
  'Chu saku': 1, 'Chu-jo saku': 2, 'Jo saku': 3, 'Jo-jo saku': 4, 'Sai-jo saku': 5,
};

// ── CSV Parser ────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => row[h] = vals[i] || '');
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(`Insert Jussi Observations into market_price_observations ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(70) + '\n');

  // ── Load Jussi CSVs ──────────────────────────────────────────

  console.log('Loading Jussi data...');
  const normCSV = fs.readFileSync(
    '/Users/christopherhill/Desktop/Claude_project/Oshi-Jussi/data/price_database_normalized.csv', 'utf-8'
  );
  const normRows = parseCSV(normCSV);

  const origCSV = fs.readFileSync(
    '/Users/christopherhill/Desktop/Claude_project/Oshi-Jussi/data/price_database.csv', 'utf-8'
  );
  const origRows = parseCSV(origCSV);

  // Build is_sold lookup from original CSV
  const isSoldMap = new Map<string, boolean>();
  for (const r of origRows) {
    isSoldMap.set(r.id, r.is_sold === 'True');
  }
  console.log(`  Normalized: ${normRows.length}, Original: ${origRows.length}`);

  // ── Load UUID mapping ────────────────────────────────────────

  console.log('Loading UUID mapping...');
  const uuidCSV = fs.readFileSync(
    '/Users/christopherhill/Desktop/Claude_project/Oshi-Jussi/data/import/uuid_mapping.csv', 'utf-8'
  );
  const uuidRows = parseCSV(uuidCSV);
  const uuidMap = new Map<string, string>();
  for (const r of uuidRows) {
    if (r.master_id && r.object_uuid) uuidMap.set(r.master_id, r.object_uuid);
  }
  console.log(`  ${uuidMap.size} mappings`);

  // ── Query gold_values for artisan IDs ────────────────────────

  console.log('Querying gold_values for artisan IDs...');
  const neededUuids: string[] = [];
  const midToUuid = new Map<string, string>();
  for (const r of normRows) {
    const mid = (r.master_id || '').replace(/\.0$/, '');
    if (!mid) continue;
    const uuid = uuidMap.get(mid);
    if (uuid) {
      neededUuids.push(uuid);
      midToUuid.set(mid, uuid);
    }
  }

  const uuidToArtisan = new Map<string, string>();
  const BATCH = 100;
  for (let i = 0; i < neededUuids.length; i += BATCH) {
    const batch = neededUuids.slice(i, i + BATCH);
    const { data, error } = await yuhinkai
      .from('gold_values')
      .select('object_uuid, gold_smith_id, gold_maker_id')
      .in('object_uuid', batch);
    if (error) { console.error(`  Error:`, error.message); continue; }
    for (const row of (data || [])) {
      const artId = row.gold_smith_id || row.gold_maker_id;
      if (artId) uuidToArtisan.set(row.object_uuid, artId);
    }
  }
  console.log(`  ${uuidToArtisan.size} artisan IDs resolved`);

  // ── Fetch artisan ratings ────────────────────────────────────

  console.log('Fetching artisan ratings...');
  const artisanCodes = new Set<string>(uuidToArtisan.values());
  const makerCodes = [...artisanCodes].filter(c => !c.startsWith('NS-'));
  const schoolCodes = [...artisanCodes].filter(c => c.startsWith('NS-'));

  interface Rating {
    elite_factor: number;
    toko_taikan: number | null;
    hawley: number | null;
    fujishiro: string | null;
    fujishiro_ord: number | null;
    name_romaji: string | null;
  }

  const ratings = new Map<string, Rating>();

  for (let i = 0; i < makerCodes.length; i += BATCH) {
    const batch = makerCodes.slice(i, i + BATCH);
    const { data } = await yuhinkai
      .from('artisan_makers')
      .select('maker_id, name_romaji, elite_factor, toko_taikan, hawley, fujishiro')
      .in('maker_id', batch);
    for (const row of (data || [])) {
      ratings.set(row.maker_id, {
        elite_factor: row.elite_factor || 0,
        toko_taikan: row.toko_taikan,
        hawley: row.hawley,
        fujishiro: row.fujishiro,
        fujishiro_ord: row.fujishiro ? (FUJISHIRO_ORD[row.fujishiro] ?? null) : null,
        name_romaji: row.name_romaji,
      });
    }
  }
  for (let i = 0; i < schoolCodes.length; i += BATCH) {
    const batch = schoolCodes.slice(i, i + BATCH);
    const { data } = await yuhinkai
      .from('artisan_schools')
      .select('school_id, name_romaji, elite_factor')
      .in('school_id', batch);
    for (const row of (data || [])) {
      ratings.set(row.school_id, {
        elite_factor: row.elite_factor || 0,
        toko_taikan: null, hawley: null, fujishiro: null, fujishiro_ord: null,
        name_romaji: row.name_romaji,
      });
    }
  }
  console.log(`  ${ratings.size} artisan ratings fetched`);

  // ── Load existing NW URLs for dedup ──────────────────────────

  console.log('Loading existing NW observation URLs for dedup...');
  const nwUrls = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('market_price_observations')
      .select('listing_url')
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (r.listing_url) nwUrls.add(r.listing_url);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  ${nwUrls.size} existing URLs`);

  // ── Build insert rows ────────────────────────────────────────

  console.log('\nBuilding insert rows...');

  // Use Record so we can conditionally omit observed_at (let DB default to now())
  type InsertRow = Record<string, unknown>;

  const inserts: InsertRow[] = [];
  let skippedNoPrice = 0, skippedDedup = 0, skippedOther = 0;

  for (const r of normRows) {
    const priceJpy = parseFloat(r.price_jpy);
    if (!priceJpy || priceJpy < 5000) { skippedNoPrice++; continue; }

    // Dedup: check if any URL already exists in NW
    const urls = (r.urls || '').split(',').map(u => u.trim()).filter(Boolean);
    const primaryUrl = urls[0] || null;
    let isDuplicate = false;
    for (const url of urls) {
      const cleanUrl = url.replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, '');
      if (nwUrls.has(url) || nwUrls.has(cleanUrl)) { isDuplicate = true; break; }
    }
    if (isDuplicate) { skippedDedup++; continue; }

    // Blade type
    const btNorm = normalizeBladeType(r.blade_type || '');
    const category = itemCategory(btNorm);
    if (category !== 'blade') { skippedOther++; continue; } // Jussi data is blades only

    // Certification
    const certText = r.certification || '';
    const certOrd = CERT_ORDINAL[certText] ?? 0;
    const certType = CERT_TYPE_MAP[certText] ?? null;

    // Artisan linkage
    const mid = (r.master_id || '').replace(/\.0$/, '');
    const uuid = mid ? midToUuid.get(mid) : undefined;
    const artisanId = uuid ? uuidToArtisan.get(uuid) ?? null : null;
    const rating = artisanId ? ratings.get(artisanId) : undefined;

    // Smith name: prefer Yuhinkai resolved name, fall back to Jussi normalized
    const artisanName = rating?.name_romaji || r.smith_normalized || r.smith || null;

    // Nagasa
    const nagasa = parseFloat(r.nagasa_cm);

    // is_sold from original CSV
    const wasSold = isSoldMap.get(r.id) ?? false;

    // observed_at from listing_date (may be empty)
    const listingDate = r.listing_date || null;

    // Price currency and value
    const priceCurrency = r.price_currency || 'JPY';
    const priceValue = parseFloat(r.price_value) || priceJpy;

    const row: InsertRow = {
      source: 'jussi',
      listing_url: primaryUrl,
      price_value: priceValue,
      price_currency: priceCurrency,
      price_jpy: priceJpy,
      was_sold: wasSold,
      item_type: btNorm,
      item_category: category,
      cert_type: certType,
      cert_ordinal: certOrd,
      artisan_id: artisanId,
      artisan_name: artisanName,
      elite_factor: rating ? rating.elite_factor : (artisanId ? 0 : null),
      toko_taikan: rating?.toko_taikan ?? null,
      hawley: rating?.hawley ?? null,
      fujishiro: rating?.fujishiro ?? null,
      fujishiro_ord: rating?.fujishiro_ord ?? null,
      nagasa_cm: nagasa > 0 ? nagasa : null,
      observed_at: listingDate || new Date().toISOString(),
      dealer_name: r.dealer_primary || null,
      notes: r.juyo_session ? `juyo_session=${r.juyo_session}` : null,
      added_by: 'jussi_fusion',
    };
    inserts.push(row);
  }

  console.log(`  Ready to insert: ${inserts.length}`);
  console.log(`  Skipped: ${skippedNoPrice} no price, ${skippedDedup} dedup, ${skippedOther} non-blade`);

  // Quick sanity stats
  const withArtisan = inserts.filter(r => r.artisan_id);
  const withEF = inserts.filter(r => r.elite_factor != null && (r.elite_factor as number) > 0);
  const withTT = inserts.filter(r => r.toko_taikan != null);
  const sold = inserts.filter(r => r.was_sold);
  console.log(`  With artisan_id: ${withArtisan.length} (${(100 * withArtisan.length / inserts.length).toFixed(1)}%)`);
  console.log(`  With EF > 0:     ${withEF.length} (${(100 * withEF.length / inserts.length).toFixed(1)}%)`);
  console.log(`  With TT:         ${withTT.length} (${(100 * withTT.length / inserts.length).toFixed(1)}%)`);
  console.log(`  Sold:            ${sold.length} (${(100 * sold.length / inserts.length).toFixed(1)}%)`);

  // Price distribution
  const prices = inserts.map(r => r.price_jpy as number).sort((a, b) => a - b);
  console.log(`  Price range: ¥${prices[0].toLocaleString()} – ¥${prices[prices.length - 1].toLocaleString()}`);
  console.log(`  Median price: ¥${prices[Math.floor(prices.length / 2)].toLocaleString()}`);

  // Cert distribution
  const certDist: Record<string, number> = {};
  for (const r of inserts) {
    const label = (r.cert_type as string) || '(none)';
    certDist[label] = (certDist[label] || 0) + 1;
  }
  console.log(`  Cert distribution:`);
  for (const [cert, count] of Object.entries(certDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cert.padEnd(20)} ${count}`);
  }

  if (DRY_RUN) {
    console.log('\n  DRY RUN — no rows inserted. Remove --dry-run to execute.');

    // Show 5 sample rows
    console.log('\n  Sample rows:');
    for (const r of inserts.slice(0, 5)) {
      console.log(`    ${((r.artisan_name as string) || '?').padEnd(20)} ${((r.item_type as string) || '').padEnd(10)} ${((r.cert_type as string) || 'none').padEnd(15)} ¥${(r.price_jpy as number).toLocaleString().padEnd(12)} EF=${r.elite_factor ?? '—'} TT=${r.toko_taikan ?? '—'} ${r.was_sold ? 'SOLD' : ''}`);
    }
    return;
  }

  // ── Insert in batches ────────────────────────────────────────

  console.log('\nInserting...');
  const INSERT_BATCH = 50;
  let inserted = 0, errors = 0;

  for (let i = 0; i < inserts.length; i += INSERT_BATCH) {
    const batch = inserts.slice(i, i + INSERT_BATCH);
    const { error } = await supabase
      .from('market_price_observations')
      .insert(batch);
    if (error) {
      console.error(`  Batch ${i}–${i + batch.length} error: ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\n  Inserted: ${inserted} rows`);
  if (errors) console.log(`  Errors: ${errors} batches`);

  // Verify final count
  const { count } = await supabase
    .from('market_price_observations')
    .select('*', { count: 'exact', head: true });
  console.log(`  Total observations now: ${count}`);

  console.log('\nDone.');
}

main().catch(console.error);
