/**
 * Market Data Fusion — Merge Oshi-Jussi price database with NW observations.
 *
 * Chain: Jussi master_id → uuid_mapping → gold_values.gold_smith_id → artisan_makers ratings
 *
 * Run: npx tsx scripts/market-data-fusion.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';
if (!yuhinkaiUrl || !yuhinkaiKey) {
  console.error('Yuhinkai credentials not configured.');
  process.exit(1);
}
const yuhinkai = createClient(yuhinkaiUrl, yuhinkaiKey);

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

const BLADE_TYPES = new Set(['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken']);

function normalizeBladeType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'katana') return 'katana';
  if (lower === 'wakizashi') return 'wakizashi';
  if (lower === 'tanto' || lower === 'tantō') return 'tanto';
  if (lower === 'tachi' || lower === 'tachi (mounted)') return 'tachi';
  if (lower === 'naginata' || lower.includes('naginata')) return 'naginata';
  if (lower === 'yari') return 'yari';
  if (lower === 'ken') return 'ken';
  return lower;
}

// ── CSV Parser (simple — handles quoted fields) ───────────────────

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
  console.log('Market Data Fusion — Oshi-Jussi + NW Observations');
  console.log('==================================================\n');

  // ── Step 1: Load Jussi price data ────────────────────────────

  console.log('STEP 1: Load Jussi price database');
  const jussiCSV = fs.readFileSync(
    '/Users/christopherhill/Desktop/Claude_project/Oshi-Jussi/data/price_database_normalized.csv',
    'utf-8'
  );
  const jussiRows = parseCSV(jussiCSV);
  console.log(`  Loaded ${jussiRows.length} Jussi price records`);

  // Basic stats
  const withPrice = jussiRows.filter(r => parseFloat(r.price_jpy) > 0);
  const withNagasa = jussiRows.filter(r => parseFloat(r.nagasa_cm) > 0);
  const withMasterId = jussiRows.filter(r => r.master_id && r.master_id !== '');
  console.log(`  With price_jpy > 0:   ${withPrice.length}`);
  console.log(`  With nagasa_cm:       ${withNagasa.length}`);
  console.log(`  With master_id:       ${withMasterId.length}`);

  // Blade type distribution
  const bladeTypeCounts: Record<string, number> = {};
  for (const r of jussiRows) {
    const bt = r.blade_type || 'unknown';
    bladeTypeCounts[bt] = (bladeTypeCounts[bt] || 0) + 1;
  }
  console.log(`\n  Blade type distribution:`);
  for (const [bt, count] of Object.entries(bladeTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${bt.padEnd(20)} ${count}`);
  }

  // Cert distribution
  const certCounts: Record<string, number> = {};
  for (const r of jussiRows) {
    const cert = r.certification || '(none)';
    certCounts[cert] = (certCounts[cert] || 0) + 1;
  }
  console.log(`\n  Certification distribution:`);
  for (const [cert, count] of Object.entries(certCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cert.padEnd(25)} ${count}`);
  }

  // ── Step 2: Load UUID mapping ────────────────────────────────

  console.log('\nSTEP 2: Load UUID mapping (master_id → object_uuid)');
  const uuidCSV = fs.readFileSync(
    '/Users/christopherhill/Desktop/Claude_project/Oshi-Jussi/data/import/uuid_mapping.csv',
    'utf-8'
  );
  const uuidRows = parseCSV(uuidCSV);
  const uuidMap = new Map<string, string>();
  for (const r of uuidRows) {
    if (r.master_id && r.object_uuid) {
      uuidMap.set(r.master_id, r.object_uuid);
    }
  }
  console.log(`  Loaded ${uuidMap.size} master_id → object_uuid mappings`);

  // How many Jussi price records have UUID mappings?
  let jussiWithUuid = 0;
  for (const r of withMasterId) {
    // master_id in CSV might have .0 suffix from float conversion
    const mid = r.master_id.replace(/\.0$/, '');
    if (uuidMap.has(mid)) jussiWithUuid++;
  }
  console.log(`  Jussi price records with UUID mapping: ${jussiWithUuid}/${withMasterId.length}`);

  // ── Step 3: Query gold_values for artisan IDs ────────────────

  console.log('\nSTEP 3: Query Yuhinkai gold_values for artisan IDs');

  // Collect UUIDs we need
  const neededUuids: string[] = [];
  const midToUuid = new Map<string, string>();
  for (const r of withMasterId) {
    const mid = r.master_id.replace(/\.0$/, '');
    const uuid = uuidMap.get(mid);
    if (uuid) {
      neededUuids.push(uuid);
      midToUuid.set(mid, uuid);
    }
  }

  // Batch query gold_values
  const uuidToArtisan = new Map<string, { smith_id: string | null; maker_id: string | null }>();
  const BATCH = 100;
  let fetched = 0;
  for (let i = 0; i < neededUuids.length; i += BATCH) {
    const batch = neededUuids.slice(i, i + BATCH);
    const { data, error } = await yuhinkai
      .from('gold_values')
      .select('object_uuid, gold_smith_id, gold_maker_id')
      .in('object_uuid', batch);
    if (error) { console.error(`  gold_values batch error:`, error.message); continue; }
    for (const row of (data || [])) {
      uuidToArtisan.set(row.object_uuid, {
        smith_id: row.gold_smith_id,
        maker_id: row.gold_maker_id,
      });
      fetched++;
    }
  }
  console.log(`  Fetched ${fetched} gold_values rows`);

  // How many have artisan IDs?
  let withSmithId = 0, withMakerId = 0, withEither = 0;
  for (const v of uuidToArtisan.values()) {
    if (v.smith_id) withSmithId++;
    if (v.maker_id) withMakerId++;
    if (v.smith_id || v.maker_id) withEither++;
  }
  console.log(`  With gold_smith_id: ${withSmithId}`);
  console.log(`  With gold_maker_id: ${withMakerId}`);
  console.log(`  With either:        ${withEither}`);

  // ── Step 4: Fetch artisan ratings ────────────────────────────

  console.log('\nSTEP 4: Fetch artisan ratings from artisan_makers');

  // Collect unique artisan codes
  const artisanCodes = new Set<string>();
  for (const v of uuidToArtisan.values()) {
    if (v.smith_id) artisanCodes.add(v.smith_id);
    if (v.maker_id) artisanCodes.add(v.maker_id);
  }
  const makerCodes = [...artisanCodes].filter(c => !c.startsWith('NS-'));
  const schoolCodes = [...artisanCodes].filter(c => c.startsWith('NS-'));
  console.log(`  Unique artisan codes: ${artisanCodes.size} (${makerCodes.length} makers, ${schoolCodes.length} schools)`);

  interface ArtisanRating {
    elite_factor: number;
    toko_taikan: number | null;
    hawley: number | null;
    fujishiro: string | null;
    fujishiro_ord: number | null;
    name_romaji: string | null;
  }

  const FUJISHIRO_ORD: Record<string, number> = {
    'Chu saku': 1, 'Chu-jo saku': 2, 'Jo saku': 3, 'Jo-jo saku': 4, 'Sai-jo saku': 5,
  };

  const artisanRatings = new Map<string, ArtisanRating>();

  for (let i = 0; i < makerCodes.length; i += BATCH) {
    const batch = makerCodes.slice(i, i + BATCH);
    const { data, error } = await yuhinkai
      .from('artisan_makers')
      .select('maker_id, name_romaji, elite_factor, toko_taikan, hawley, fujishiro')
      .in('maker_id', batch);
    if (error) { console.error(`  artisan_makers error:`, error.message); continue; }
    for (const row of (data || [])) {
      artisanRatings.set(row.maker_id, {
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
    const { data, error } = await yuhinkai
      .from('artisan_schools')
      .select('school_id, name_romaji, elite_factor')
      .in('school_id', batch);
    if (error) { console.error(`  artisan_schools error:`, error.message); continue; }
    for (const row of (data || [])) {
      artisanRatings.set(row.school_id, {
        elite_factor: row.elite_factor || 0,
        toko_taikan: null,
        hawley: null,
        fujishiro: null,
        fujishiro_ord: null,
        name_romaji: row.name_romaji,
      });
    }
  }
  console.log(`  Fetched ratings for ${artisanRatings.size} artisans`);

  // ── Step 5: Check URL overlap with NW observations ───────────

  console.log('\nSTEP 5: Check URL overlap with NW observations');

  // Fetch NW listing URLs
  const PAGE = 1000;
  const nwUrls = new Set<string>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('market_price_observations')
      .select('listing_url')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (r.listing_url) nwUrls.add(r.listing_url);
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`  NW observation URLs loaded: ${nwUrls.size}`);

  // Check Jussi URLs against NW
  let urlOverlap = 0;
  const overlappingUrls: string[] = [];
  for (const r of jussiRows) {
    const urls = (r.urls || '').split(',').map(u => u.trim()).filter(Boolean);
    for (const url of urls) {
      // Strip web.archive.org wrapper if present
      const cleanUrl = url.replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, '');
      if (nwUrls.has(url) || nwUrls.has(cleanUrl)) {
        urlOverlap++;
        if (overlappingUrls.length < 5) overlappingUrls.push(`  Jussi #${r.id}: ${url.slice(0, 80)}`);
        break; // count each Jussi row once
      }
    }
  }
  console.log(`  URL overlap: ${urlOverlap} Jussi records have matching NW URLs`);
  if (overlappingUrls.length > 0) {
    console.log(`  Sample overlaps:`);
    for (const s of overlappingUrls) console.log(`    ${s}`);
  }

  // ── Step 6: Build fused records ──────────────────────────────

  console.log('\nSTEP 6: Build fused Jussi records');

  interface FusedRecord {
    source: 'jussi';
    price_jpy: number;
    blade_type: string;
    blade_type_normalized: string;
    item_category: string;
    cert_text: string;
    cert_ordinal: number;
    nagasa_cm: number | null;
    smith_name: string;
    artisan_id: string | null;
    artisan_name_resolved: string | null;
    elite_factor: number;
    toko_taikan: number | null;
    hawley: number | null;
    fujishiro_ord: number | null;
    dealer: string;
    has_uuid_link: boolean;
    has_artisan_link: boolean;
  }

  const fused: FusedRecord[] = [];
  let noPrice = 0, linkSuccess = 0, linkFail = 0, noMasterId = 0;

  for (const r of jussiRows) {
    const priceJpy = parseFloat(r.price_jpy);
    if (!priceJpy || priceJpy < 5000) { noPrice++; continue; }

    const mid = (r.master_id || '').replace(/\.0$/, '');
    const uuid = mid ? midToUuid.get(mid) : undefined;
    const goldEntry = uuid ? uuidToArtisan.get(uuid) : undefined;
    const artisanId = goldEntry?.smith_id || goldEntry?.maker_id || null;
    const rating = artisanId ? artisanRatings.get(artisanId) : undefined;

    const btNorm = normalizeBladeType(r.blade_type || '');
    const certOrd = CERT_ORDINAL[r.certification || ''] ?? 0;

    if (!mid) noMasterId++;
    else if (artisanId) linkSuccess++;
    else linkFail++;

    const nagasa = parseFloat(r.nagasa_cm);

    fused.push({
      source: 'jussi',
      price_jpy: priceJpy,
      blade_type: r.blade_type || '',
      blade_type_normalized: btNorm,
      item_category: BLADE_TYPES.has(btNorm) ? 'blade' : 'other',
      cert_text: r.certification || '',
      cert_ordinal: certOrd,
      nagasa_cm: nagasa > 0 ? nagasa : null,
      smith_name: r.smith_normalized || r.smith || '',
      artisan_id: artisanId,
      artisan_name_resolved: rating?.name_romaji || null,
      elite_factor: rating?.elite_factor || 0,
      toko_taikan: rating?.toko_taikan ?? null,
      hawley: rating?.hawley ?? null,
      fujishiro_ord: rating?.fujishiro_ord ?? null,
      dealer: r.dealer_primary || '',
      has_uuid_link: !!uuid,
      has_artisan_link: !!artisanId,
    });
  }

  console.log(`  Built ${fused.length} fused records (filtered ${noPrice} with no/low price)`);
  console.log(`  Artisan linkage: ${linkSuccess} linked, ${linkFail} UUID but no artisan, ${noMasterId} no master_id`);

  // Coverage stats
  const fusedBlades = fused.filter(r => r.item_category === 'blade');
  const withEF = fusedBlades.filter(r => r.elite_factor > 0);
  const withTT = fusedBlades.filter(r => r.toko_taikan != null);
  const withNag = fusedBlades.filter(r => r.nagasa_cm != null);
  console.log(`\n  Fused blade records: ${fusedBlades.length}`);
  console.log(`    With elite_factor > 0: ${withEF.length} (${(100 * withEF.length / fusedBlades.length).toFixed(1)}%)`);
  console.log(`    With toko_taikan:      ${withTT.length} (${(100 * withTT.length / fusedBlades.length).toFixed(1)}%)`);
  console.log(`    With nagasa:           ${withNag.length} (${(100 * withNag.length / fusedBlades.length).toFixed(1)}%)`);

  // ── Step 7: SPOT CHECKS ──────────────────────────────────────

  console.log('\n' + '═'.repeat(80));
  console.log('  SPOT CHECKS — Verify linkage quality');
  console.log('─'.repeat(80));

  // Show 15 random records with successful artisan linkage
  const linked = fused.filter(r => r.has_artisan_link);
  const spotIndices = [0, 10, 50, 100, 200, 300, 500, 700, 1000, 1200, 1500, 1800, 2000, 2500, 3000]
    .filter(i => i < linked.length);

  console.log(`\n  Linked records sample (${linked.length} total):`);
  console.log(`  ${'Smith (Jussi)'.padEnd(22)} ${'Artisan ID'.padEnd(12)} ${'Name (Yuhinkai)'.padEnd(22)} ${'Cert'.padEnd(15)} ${'Price JPY'.padEnd(12)} EF     TT`);
  console.log(`  ${'─'.repeat(110)}`);

  for (const idx of spotIndices) {
    const r = linked[idx];
    console.log(
      `  ${r.smith_name.padEnd(22).slice(0, 22)} ${(r.artisan_id || '').padEnd(12)} ${(r.artisan_name_resolved || '').padEnd(22).slice(0, 22)} ${r.cert_text.padEnd(15).slice(0, 15)} ¥${r.price_jpy.toLocaleString().padEnd(11)} ${(r.elite_factor || 0).toFixed(2).padEnd(6)} ${r.toko_taikan ?? '—'}`
    );
  }

  // Show records where Jussi smith name doesn't match Yuhinkai name (potential mislinks)
  console.log(`\n  Potential mislinks (smith name ≠ resolved name):`);
  let mismatches = 0;
  for (const r of linked) {
    if (!r.artisan_name_resolved) continue;
    const jussiSmith = r.smith_name.toLowerCase().replace(/[^a-z]/g, '');
    const yuhinkaiName = r.artisan_name_resolved.toLowerCase().replace(/[^a-z]/g, '');
    // Simple: check if either contains the other (handles "Kunimitsu" vs "Shintōgo Kunimitsu")
    if (!jussiSmith.includes(yuhinkaiName) && !yuhinkaiName.includes(jussiSmith)) {
      if (mismatches < 15) {
        console.log(`    Jussi: "${r.smith_name}" → Yuhinkai: "${r.artisan_name_resolved}" (${r.artisan_id}) — cert=${r.cert_text}, ¥${r.price_jpy.toLocaleString()}`);
      }
      mismatches++;
    }
  }
  console.log(`  Total potential mislinks: ${mismatches}/${linked.length}`);

  // Show unlinked records with high prices (these might be important smiths we're missing)
  const unlinkedHighPrice = fused
    .filter(r => !r.has_artisan_link && r.price_jpy >= 5_000_000)
    .sort((a, b) => b.price_jpy - a.price_jpy);
  console.log(`\n  High-value unlinked records (≥¥5M, no artisan ID):`);
  console.log(`  ${'Smith'.padEnd(22)} ${'Blade'.padEnd(12)} ${'Cert'.padEnd(15)} ${'Price JPY'.padEnd(12)} Dealer`);
  console.log(`  ${'─'.repeat(80)}`);
  for (const r of unlinkedHighPrice.slice(0, 15)) {
    console.log(
      `  ${r.smith_name.padEnd(22).slice(0, 22)} ${r.blade_type.padEnd(12)} ${r.cert_text.padEnd(15).slice(0, 15)} ¥${r.price_jpy.toLocaleString().padEnd(11)} ${r.dealer}`
    );
  }

  // ── Step 8: Summary ──────────────────────────────────────────

  console.log('\n' + '═'.repeat(80));
  console.log('  FUSION SUMMARY');
  console.log('─'.repeat(80));
  console.log(`  NW observations:     5,898 rows`);
  console.log(`  Jussi (usable):      ${fused.length} rows`);
  console.log(`  URL overlap:         ${urlOverlap} (would be deduplicated)`);
  console.log(`  Net new from Jussi:  ~${fused.length - urlOverlap} rows`);
  console.log(`  Combined total:      ~${5898 + fused.length - urlOverlap} rows`);
  console.log(`\n  Jussi artisan linkage rate: ${(100 * linkSuccess / fused.length).toFixed(1)}% (${linkSuccess}/${fused.length})`);
  console.log(`  Jussi blade count:   ${fusedBlades.length}`);
  console.log(`  Jussi EF coverage:   ${withEF.length} (${(100 * withEF.length / fusedBlades.length).toFixed(1)}%)`);
  console.log(`  Jussi TT coverage:   ${withTT.length} (${(100 * withTT.length / fusedBlades.length).toFixed(1)}%)`);

  console.log('\nDone.');
}

main().catch(console.error);
