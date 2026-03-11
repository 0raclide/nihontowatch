/**
 * Market Transparency — Phase 0: Data Audit
 *
 * Runs 10 diagnostic queries against prod Supabase to understand
 * what price/artisan/cert data we actually have. Read-only.
 *
 * Run with: npx tsx scripts/market-data-audit.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function pct(part: number, total: number): string {
  if (total === 0) return '0.0%';
  return (part / total * 100).toFixed(1) + '%';
}

function printTable(rows: Record<string, unknown>[], title?: string) {
  if (title) console.log(`\n${'═'.repeat(60)}\n${title}\n${'─'.repeat(60)}`);
  if (rows.length === 0) { console.log('  (no rows)'); return; }
  console.table(rows);
}

// ── Paginated fetch (Supabase default limit = 1000) ─────────────

async function fetchAll(
  table: string,
  select: string,
  filters?: (q: ReturnType<ReturnType<typeof supabase.from>['select']>) => ReturnType<ReturnType<typeof supabase.from>['select']>
) {
  const PAGE = 1000;
  let all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filters) query = filters(query) as typeof query;
    const { data, error } = await query;
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Query 1: Price coverage by status ────────────────────────────

async function q1_priceCoverage() {
  const rows = await fetchAll('listings', 'status, price_value, is_available, is_sold, admin_hidden');

  const buckets: Record<string, { total: number; withPrice: number }> = {};
  for (const r of rows) {
    if (r.admin_hidden) continue;
    const key = r.is_available ? 'available' : r.is_sold ? 'sold' : String(r.status);
    if (!buckets[key]) buckets[key] = { total: 0, withPrice: 0 };
    buckets[key].total++;
    if (r.price_value != null && (r.price_value as number) > 0) buckets[key].withPrice++;
  }

  const out = Object.entries(buckets)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([status, { total, withPrice }]) => ({
      status,
      total: fmt(total),
      with_price: fmt(withPrice),
      coverage: pct(withPrice, total),
    }));

  printTable(out, 'Q1 — Price Coverage by Status');
}

// ── Query 2: Artisan ID coverage by confidence level ─────────────

async function q2_artisanCoverage() {
  const rows = await fetchAll(
    'listings',
    'artisan_id, artisan_confidence, is_available, admin_hidden',
    (q) => q.eq('is_available', true)
  );

  let total = 0;
  let matched = 0;
  const byConf: Record<string, number> = {};

  for (const r of rows) {
    if (r.admin_hidden) continue;
    total++;
    const conf = r.artisan_confidence as string | null;
    if (r.artisan_id && r.artisan_id !== 'UNKNOWN') {
      matched++;
      const key = conf || 'NULL';
      byConf[key] = (byConf[key] || 0) + 1;
    }
  }

  console.log(`\n${'═'.repeat(60)}\nQ2 — Artisan ID Coverage (available only)\n${'─'.repeat(60)}`);
  console.log(`  Total available: ${fmt(total)}`);
  console.log(`  With artisan:    ${fmt(matched)} (${pct(matched, total)})`);
  console.log(`  Unmatched:       ${fmt(total - matched)} (${pct(total - matched, total)})`);
  console.log(`  By confidence:`);
  for (const [conf, n] of Object.entries(byConf).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${conf.padEnd(12)} ${fmt(n).padStart(6)}  (${pct(n, matched)})`);
  }
}

// ── Query 3: Certification distribution ──────────────────────────

async function q3_certDistribution() {
  const rows = await fetchAll(
    'listings',
    'cert_type, is_available, is_sold, admin_hidden'
  );

  const avail: Record<string, number> = {};
  const sold: Record<string, number> = {};

  for (const r of rows) {
    if (r.admin_hidden) continue;
    const cert = (r.cert_type as string) || 'none';
    if (r.is_available) {
      avail[cert] = (avail[cert] || 0) + 1;
    } else if (r.is_sold) {
      sold[cert] = (sold[cert] || 0) + 1;
    }
  }

  const allCerts = [...new Set([...Object.keys(avail), ...Object.keys(sold)])];
  const out = allCerts
    .sort((a, b) => ((avail[b] || 0) + (sold[b] || 0)) - ((avail[a] || 0) + (sold[a] || 0)))
    .map((cert) => ({
      cert_type: cert,
      available: fmt(avail[cert] || 0),
      sold: fmt(sold[cert] || 0),
      total: fmt((avail[cert] || 0) + (sold[cert] || 0)),
    }));

  printTable(out, 'Q3 — Certification Distribution');
}

// ── Query 4: Artisan × cert_type combo viability ─────────────────

async function q4_artisanCertCombos() {
  // Only available + priced + matched artisan + certified
  const rows = await fetchAll(
    'listings',
    'artisan_id, artisan_confidence, cert_type, price_value, is_available, admin_hidden',
    (q) => q.eq('is_available', true)
  );

  // Count unique artisan×cert combos with price
  const combos: Record<string, { count: number; prices: number[] }> = {};
  let qualifiedRows = 0;

  for (const r of rows) {
    if (r.admin_hidden) continue;
    if (!r.artisan_id || r.artisan_id === 'UNKNOWN') continue;
    if (!r.cert_type) continue;
    if (!r.price_value || (r.price_value as number) <= 0) continue;
    // Only HIGH/MEDIUM confidence
    const conf = r.artisan_confidence as string;
    if (conf !== 'HIGH' && conf !== 'MEDIUM') continue;

    qualifiedRows++;
    const key = `${r.artisan_id}|${r.cert_type}`;
    if (!combos[key]) combos[key] = { count: 0, prices: [] };
    combos[key].count++;
    combos[key].prices.push(r.price_value as number);
  }

  // Bucket by combo size
  const buckets: Record<string, number> = { '1': 0, '2': 0, '3-4': 0, '5-9': 0, '10-19': 0, '20+': 0 };
  for (const c of Object.values(combos)) {
    if (c.count === 1) buckets['1']++;
    else if (c.count === 2) buckets['2']++;
    else if (c.count <= 4) buckets['3-4']++;
    else if (c.count <= 9) buckets['5-9']++;
    else if (c.count <= 19) buckets['10-19']++;
    else buckets['20+']++;
  }

  console.log(`\n${'═'.repeat(60)}\nQ4 — Artisan × Cert Combo Viability (available, priced, HIGH/MEDIUM)\n${'─'.repeat(60)}`);
  console.log(`  Qualified rows:   ${fmt(qualifiedRows)}`);
  console.log(`  Unique combos:    ${fmt(Object.keys(combos).length)}`);
  console.log(`  Combo size distribution:`);
  for (const [bucket, n] of Object.entries(buckets)) {
    console.log(`    ${bucket.padEnd(8)} combos: ${fmt(n)}`);
  }

  // Top 15 combos by count
  const topCombos = Object.entries(combos)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([key, { count, prices }]) => {
      const [artisan, cert] = key.split('|');
      const sorted = prices.sort((a, b) => a - b);
      return {
        artisan,
        cert,
        count,
        min: fmt(sorted[0]),
        median: fmt(sorted[Math.floor(sorted.length / 2)]),
        max: fmt(sorted[sorted.length - 1]),
      };
    });

  printTable(topCombos, 'Q4b — Top 15 Artisan×Cert Combos');
}

// ── Query 5: Coarser fallback — item_type × cert_type ────────────

async function q5_itemTypeCert() {
  const rows = await fetchAll(
    'listings',
    'item_type, cert_type, price_value, is_available, admin_hidden',
    (q) => q.eq('is_available', true)
  );

  const combos: Record<string, { count: number; priced: number }> = {};

  for (const r of rows) {
    if (r.admin_hidden) continue;
    const type = (r.item_type as string) || 'unknown';
    const cert = (r.cert_type as string) || 'none';
    const key = `${type}|${cert}`;
    if (!combos[key]) combos[key] = { count: 0, priced: 0 };
    combos[key].count++;
    if (r.price_value && (r.price_value as number) > 0) combos[key].priced++;
  }

  const out = Object.entries(combos)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 25)
    .map(([key, { count, priced }]) => {
      const [type, cert] = key.split('|');
      return { item_type: type, cert_type: cert, total: fmt(count), priced: fmt(priced), price_pct: pct(priced, count) };
    });

  printTable(out, 'Q5 — Item Type × Cert Type (available, top 25)');
}

// ── Query 6: Price range distribution (log buckets) ──────────────

async function q6_priceDistribution() {
  const rows = await fetchAll(
    'listings',
    'price_value, price_currency, is_available, admin_hidden',
    (q) => q.eq('is_available', true)
  );

  // Rough JPY conversion for bucketing
  const toJpy: Record<string, number> = { JPY: 1, USD: 150, EUR: 163, GBP: 190, AUD: 98, CAD: 110, CHF: 170 };

  const buckets: Record<string, number> = {
    '< ¥50K': 0,
    '¥50K-100K': 0,
    '¥100K-250K': 0,
    '¥250K-500K': 0,
    '¥500K-1M': 0,
    '¥1M-2.5M': 0,
    '¥2.5M-5M': 0,
    '¥5M-10M': 0,
    '¥10M+': 0,
    'no price': 0,
  };

  for (const r of rows) {
    if (r.admin_hidden) continue;
    const price = r.price_value as number | null;
    if (!price || price <= 0) { buckets['no price']++; continue; }

    const curr = (r.price_currency as string) || 'JPY';
    const rate = toJpy[curr] || 1;
    const jpy = price * rate;

    if (jpy < 50_000) buckets['< ¥50K']++;
    else if (jpy < 100_000) buckets['¥50K-100K']++;
    else if (jpy < 250_000) buckets['¥100K-250K']++;
    else if (jpy < 500_000) buckets['¥250K-500K']++;
    else if (jpy < 1_000_000) buckets['¥500K-1M']++;
    else if (jpy < 2_500_000) buckets['¥1M-2.5M']++;
    else if (jpy < 5_000_000) buckets['¥2.5M-5M']++;
    else if (jpy < 10_000_000) buckets['¥5M-10M']++;
    else buckets['¥10M+']++;
  }

  const out = Object.entries(buckets).map(([range, n]) => ({
    range,
    count: fmt(n),
  }));

  printTable(out, 'Q6 — Price Distribution (available, est. JPY)');
}

// ── Query 7: Currency distribution ───────────────────────────────

async function q7_currencyDistribution() {
  const rows = await fetchAll(
    'listings',
    'price_currency, price_value, is_available, admin_hidden',
    (q) => q.eq('is_available', true)
  );

  const byC: Record<string, { total: number; priced: number }> = {};
  for (const r of rows) {
    if (r.admin_hidden) continue;
    const curr = (r.price_currency as string) || 'NULL';
    if (!byC[curr]) byC[curr] = { total: 0, priced: 0 };
    byC[curr].total++;
    if (r.price_value && (r.price_value as number) > 0) byC[curr].priced++;
  }

  const out = Object.entries(byC)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([currency, { total, priced }]) => ({
      currency,
      total: fmt(total),
      priced: fmt(priced),
    }));

  printTable(out, 'Q7 — Currency Distribution (available)');
}

// ── Query 8: Estimated listing date coverage ─────────────────────

async function q8_dateCoverage() {
  const rows = await fetchAll(
    'listings',
    'first_seen_at, is_available, is_sold, admin_hidden'
  );

  let availTotal = 0, availDated = 0;
  let soldTotal = 0, soldDated = 0;

  // Year distribution for sold items
  const soldByYear: Record<string, number> = {};

  for (const r of rows) {
    if (r.admin_hidden) continue;
    if (r.is_available) {
      availTotal++;
      if (r.first_seen_at) availDated++;
    } else if (r.is_sold) {
      soldTotal++;
      if (r.first_seen_at) {
        soldDated++;
        const year = String(r.first_seen_at).substring(0, 4);
        soldByYear[year] = (soldByYear[year] || 0) + 1;
      }
    }
  }

  console.log(`\n${'═'.repeat(60)}\nQ8 — Date Coverage (first_seen_at)\n${'─'.repeat(60)}`);
  console.log(`  Available: ${fmt(availDated)}/${fmt(availTotal)} (${pct(availDated, availTotal)})`);
  console.log(`  Sold:      ${fmt(soldDated)}/${fmt(soldTotal)} (${pct(soldDated, soldTotal)})`);
  console.log(`  Sold by year:`);
  for (const [year, n] of Object.entries(soldByYear).sort()) {
    console.log(`    ${year}: ${fmt(n)}`);
  }
}

// ── Query 9: price_history depth ─────────────────────────────────

async function q9_priceHistory() {
  // Fetch price_history — may be large
  const rows = await fetchAll('price_history', 'id, listing_id, change_type');

  const byType: Record<string, number> = {};
  const listingIds = new Set<number>();

  for (const r of rows) {
    const type = (r.change_type as string) || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
    listingIds.add(r.listing_id as number);
  }

  console.log(`\n${'═'.repeat(60)}\nQ9 — Price History Depth\n${'─'.repeat(60)}`);
  console.log(`  Total records:     ${fmt(rows.length)}`);
  console.log(`  Unique listings:   ${fmt(listingIds.size)}`);
  console.log(`  By change type:`);
  for (const [type, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(20)} ${fmt(n)}`);
  }
}

// ── Query 10: Top artisans by available priced inventory ─────────

async function q10_topArtisans() {
  const rows = await fetchAll(
    'listings',
    'artisan_id, artisan_confidence, price_value, cert_type, is_available, admin_hidden',
    (q) => q.eq('is_available', true)
  );

  const artisans: Record<string, { count: number; priced: number; certs: Set<string> }> = {};

  for (const r of rows) {
    if (r.admin_hidden) continue;
    if (!r.artisan_id || r.artisan_id === 'UNKNOWN') continue;
    const conf = r.artisan_confidence as string;
    if (conf !== 'HIGH' && conf !== 'MEDIUM') continue;

    const id = r.artisan_id as string;
    if (!artisans[id]) artisans[id] = { count: 0, priced: 0, certs: new Set() };
    artisans[id].count++;
    if (r.price_value && (r.price_value as number) > 0) artisans[id].priced++;
    if (r.cert_type) artisans[id].certs.add(r.cert_type as string);
  }

  const out = Object.entries(artisans)
    .sort((a, b) => b[1].priced - a[1].priced)
    .slice(0, 30)
    .map(([id, { count, priced, certs }]) => ({
      artisan_id: id,
      available: count,
      priced,
      certs: [...certs].sort().join(', '),
    }));

  printTable(out, 'Q10 — Top 30 Artisans by Priced Available Inventory (HIGH/MEDIUM only)');
}

// ── Also include sold data for Q4 equivalent ─────────────────────

async function q4s_artisanCertCombosSold() {
  // Same as Q4 but for sold items — this is the comp data pool
  const rows = await fetchAll(
    'listings',
    'artisan_id, artisan_confidence, cert_type, price_value, is_sold, admin_hidden',
    (q) => q.eq('is_sold', true)
  );

  const combos: Record<string, { count: number; prices: number[] }> = {};
  let qualifiedRows = 0;

  for (const r of rows) {
    if (r.admin_hidden) continue;
    if (!r.artisan_id || r.artisan_id === 'UNKNOWN') continue;
    if (!r.cert_type) continue;
    if (!r.price_value || (r.price_value as number) <= 0) continue;
    const conf = r.artisan_confidence as string;
    if (conf !== 'HIGH' && conf !== 'MEDIUM') continue;

    qualifiedRows++;
    const key = `${r.artisan_id}|${r.cert_type}`;
    if (!combos[key]) combos[key] = { count: 0, prices: [] };
    combos[key].count++;
    combos[key].prices.push(r.price_value as number);
  }

  const buckets: Record<string, number> = { '1': 0, '2': 0, '3-4': 0, '5-9': 0, '10-19': 0, '20+': 0 };
  for (const c of Object.values(combos)) {
    if (c.count === 1) buckets['1']++;
    else if (c.count === 2) buckets['2']++;
    else if (c.count <= 4) buckets['3-4']++;
    else if (c.count <= 9) buckets['5-9']++;
    else if (c.count <= 19) buckets['10-19']++;
    else buckets['20+']++;
  }

  console.log(`\n${'═'.repeat(60)}\nQ4-SOLD — Artisan × Cert Combo Viability (SOLD, priced, HIGH/MEDIUM)\n${'─'.repeat(60)}`);
  console.log(`  Qualified rows:   ${fmt(qualifiedRows)}`);
  console.log(`  Unique combos:    ${fmt(Object.keys(combos).length)}`);
  console.log(`  Combo size distribution:`);
  for (const [bucket, n] of Object.entries(buckets)) {
    console.log(`    ${bucket.padEnd(8)} combos: ${fmt(n)}`);
  }

  // Top 15
  const topCombos = Object.entries(combos)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([key, { count, prices }]) => {
      const [artisan, cert] = key.split('|');
      const sorted = prices.sort((a, b) => a - b);
      return {
        artisan,
        cert,
        count,
        min: fmt(sorted[0]),
        median: fmt(sorted[Math.floor(sorted.length / 2)]),
        max: fmt(sorted[sorted.length - 1]),
      };
    });

  printTable(topCombos, 'Q4-SOLD — Top 15 Artisan×Cert Combos (Sold)');
}

// ── Combined: available + sold pool ──────────────────────────────

async function qCombined_artisanCertPool() {
  // All listings (available + sold) with artisan + cert + price
  const rows = await fetchAll(
    'listings',
    'artisan_id, artisan_confidence, cert_type, price_value, is_available, is_sold, admin_hidden'
  );

  const combos: Record<string, { count: number; prices: number[] }> = {};
  let qualifiedRows = 0;

  for (const r of rows) {
    if (r.admin_hidden) continue;
    if (!r.is_available && !r.is_sold) continue;
    if (!r.artisan_id || r.artisan_id === 'UNKNOWN') continue;
    if (!r.cert_type) continue;
    if (!r.price_value || (r.price_value as number) <= 0) continue;
    const conf = r.artisan_confidence as string;
    if (conf !== 'HIGH' && conf !== 'MEDIUM') continue;

    qualifiedRows++;
    const key = `${r.artisan_id}|${r.cert_type}`;
    if (!combos[key]) combos[key] = { count: 0, prices: [] };
    combos[key].count++;
    combos[key].prices.push(r.price_value as number);
  }

  const buckets: Record<string, number> = { '1': 0, '2': 0, '3-4': 0, '5-9': 0, '10-19': 0, '20+': 0 };
  for (const c of Object.values(combos)) {
    if (c.count === 1) buckets['1']++;
    else if (c.count === 2) buckets['2']++;
    else if (c.count <= 4) buckets['3-4']++;
    else if (c.count <= 9) buckets['5-9']++;
    else if (c.count <= 19) buckets['10-19']++;
    else buckets['20+']++;
  }

  // Combos with ≥3 data points are "viable" for price estimation
  const viable3 = Object.values(combos).filter(c => c.count >= 3).length;
  const viable5 = Object.values(combos).filter(c => c.count >= 5).length;
  const viable10 = Object.values(combos).filter(c => c.count >= 10).length;

  console.log(`\n${'═'.repeat(60)}\nQ-COMBINED — Artisan × Cert Pool (available + sold, priced, HIGH/MEDIUM)\n${'─'.repeat(60)}`);
  console.log(`  Qualified rows:     ${fmt(qualifiedRows)}`);
  console.log(`  Unique combos:      ${fmt(Object.keys(combos).length)}`);
  console.log(`  Viable (≥3 comps):  ${fmt(viable3)}`);
  console.log(`  Viable (≥5 comps):  ${fmt(viable5)}`);
  console.log(`  Viable (≥10 comps): ${fmt(viable10)}`);
  console.log(`  Combo size distribution:`);
  for (const [bucket, n] of Object.entries(buckets)) {
    console.log(`    ${bucket.padEnd(8)} combos: ${fmt(n)}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    MARKET TRANSPARENCY — PHASE 0: DATA AUDIT           ║');
  console.log('║    Read-only diagnostic against prod Supabase           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Supabase:  ${supabaseUrl.replace(/https:\/\//, '').replace(/\.supabase\.co/, '')}`);

  await q1_priceCoverage();
  await q2_artisanCoverage();
  await q3_certDistribution();
  await q4_artisanCertCombos();
  await q4s_artisanCertCombosSold();
  await qCombined_artisanCertPool();
  await q5_itemTypeCert();
  await q6_priceDistribution();
  await q7_currencyDistribution();
  await q8_dateCoverage();
  await q9_priceHistory();
  await q10_topArtisans();

  console.log(`\n${'═'.repeat(60)}`);
  console.log('AUDIT COMPLETE');
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
