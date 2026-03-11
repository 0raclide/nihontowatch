/**
 * Market Transparency — Price Model Exploration
 *
 * Tests whether elite_factor × cert_tier predicts price in our data.
 * Hypothesis: cert levels create "ladder" steps, and within each step,
 * elite_factor (artisan prestige) explains price variation.
 *
 * Run with: npx tsx scripts/market-price-model-exploration.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers ──────────────────────────────────────────────────────

function fmt(n: number): string { return n.toLocaleString(); }
function fmtK(n: number): string {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `¥${(n / 1_000).toFixed(0)}K`;
  return `¥${n}`;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// Simple OLS: y = a + b*x, returns { a, b, r2 }
function linearRegression(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let ssxy = 0, ssxx = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (xs[i] - mx) * (ys[i] - my);
    ssxx += (xs[i] - mx) ** 2;
    ssyy += (ys[i] - my) ** 2;
  }
  const b = ssxx === 0 ? 0 : ssxy / ssxx;
  const a = my - b * mx;
  const r2 = ssyy === 0 ? 0 : (ssxy * ssxy) / (ssxx * ssyy);
  return { a, b, r2 };
}

// Rough JPY conversion
const TO_JPY: Record<string, number> = { JPY: 1, USD: 150, EUR: 163, GBP: 190, AUD: 98, CAD: 110, CHF: 170 };

function toJpy(price: number, currency: string | null): number {
  return price * (TO_JPY[currency || 'JPY'] || 1);
}

// Cert tier ordinal (ladder theory ranking)
const CERT_ORDINAL: Record<string, number> = {
  'none': 0,
  'Registration': 0,
  'Kicho': 1,
  'Tokubetsu Kicho': 2,
  'Hozon': 3,
  'Hozon Tosogu': 3,
  'Tokubetsu Hozon': 4,
  'Tokubetsu Hozon Tosogu': 4,
  'Koshu Tokubetsu Kicho': 4,
  'Juyo': 5,
  'Juyo Bijutsuhin': 5,
  'juyo_bijutsuhin': 5,
  'Tokuju': 6,
  'Kanteisho': 1,
};

const CERT_LABEL: Record<number, string> = {
  0: 'None/Reg',
  1: 'Kicho',
  2: 'TokuKicho',
  3: 'Hozon',
  4: 'TokuHozon',
  5: 'Juyo',
  6: 'Tokuju',
};

// Item type categories
const BLADE_TYPES = new Set(['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken']);
const TOSOGU_TYPES = new Set(['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'fuchi-kashira']);

// ── Data fetch ───────────────────────────────────────────────────

interface Row {
  price_jpy: number;
  log_price: number;
  elite_factor: number;
  cert_ordinal: number;
  cert_type: string;
  item_type: string;
  item_category: 'blade' | 'tosogu' | 'other';
  artisan_id: string;
  is_sold: boolean;
}

async function fetchData(): Promise<Row[]> {
  const PAGE = 1000;
  let all: Record<string, unknown>[] = [];
  let offset = 0;

  const select = 'price_value, price_currency, artisan_elite_factor, cert_type, item_type, artisan_id, artisan_confidence, is_available, is_sold, admin_hidden';

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select(select)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  const rows: Row[] = [];
  for (const r of all) {
    if (r.admin_hidden) continue;
    if (!r.is_available && !r.is_sold) continue;
    if (!r.price_value || (r.price_value as number) <= 0) continue;
    if (r.artisan_elite_factor == null) continue;

    const conf = r.artisan_confidence as string;
    // Include items with elite_factor even if artisan confidence is NONE
    // (elite_factor=0 is valid data — it means "matched but no prestigious designations")

    const cert = (r.cert_type as string) || 'none';
    const certOrd = CERT_ORDINAL[cert];
    if (certOrd === undefined) continue;

    const priceJpy = toJpy(r.price_value as number, r.price_currency as string | null);
    if (priceJpy < 5000) continue; // Filter obvious data errors (sub-¥5K)

    const itemType = (r.item_type as string) || 'unknown';
    let itemCat: 'blade' | 'tosogu' | 'other' = 'other';
    if (BLADE_TYPES.has(itemType)) itemCat = 'blade';
    else if (TOSOGU_TYPES.has(itemType)) itemCat = 'tosogu';

    rows.push({
      price_jpy: priceJpy,
      log_price: Math.log10(priceJpy),
      elite_factor: r.artisan_elite_factor as number,
      cert_ordinal: certOrd,
      cert_type: cert,
      item_type: itemType,
      item_category: itemCat,
      artisan_id: (r.artisan_id as string) || 'NONE',
      is_sold: !!r.is_sold,
    });
  }

  return rows;
}

// ── Analysis 1: Cert ladder — does cert ordinal predict price? ───

function analysisCertLadder(rows: Row[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('ANALYSIS 1: CERT LADDER — Price by Certification Tier');
  console.log(`${'─'.repeat(70)}`);

  for (const cat of ['blade', 'tosogu', 'other'] as const) {
    const subset = rows.filter(r => r.item_category === cat);
    if (subset.length < 10) continue;

    console.log(`\n  [${cat.toUpperCase()}] (n=${fmt(subset.length)})`);

    const byCert: Record<number, number[]> = {};
    for (const r of subset) {
      if (!byCert[r.cert_ordinal]) byCert[r.cert_ordinal] = [];
      byCert[r.cert_ordinal].push(r.price_jpy);
    }

    for (const [ord, prices] of Object.entries(byCert).sort((a, b) => +a[0] - +b[0])) {
      if (prices.length < 3) continue;
      const label = CERT_LABEL[+ord] || `Ord ${ord}`;
      const p25 = percentile(prices, 25);
      const p50 = median(prices);
      const p75 = percentile(prices, 75);
      console.log(
        `    ${label.padEnd(12)} n=${String(prices.length).padStart(5)}  ` +
        `P25=${fmtK(p25).padStart(8)}  Median=${fmtK(p50).padStart(8)}  P75=${fmtK(p75).padStart(8)}`
      );
    }

    // Correlation: cert_ordinal vs log_price
    const r = pearsonR(subset.map(r => r.cert_ordinal), subset.map(r => r.log_price));
    console.log(`    Correlation (cert_ordinal vs log₁₀ price): r = ${r.toFixed(3)}`);
  }
}

// ── Analysis 2: Elite factor — does prestige predict price? ──────

function analysisEliteFactor(rows: Row[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('ANALYSIS 2: ELITE FACTOR — Price by Artisan Prestige');
  console.log(`${'─'.repeat(70)}`);

  for (const cat of ['blade', 'tosogu'] as const) {
    const subset = rows.filter(r => r.item_category === cat && r.elite_factor > 0);
    if (subset.length < 10) continue;

    console.log(`\n  [${cat.toUpperCase()}] with elite_factor > 0 (n=${fmt(subset.length)})`);

    // Elite factor buckets
    const buckets = [
      { label: '0.01-0.05', min: 0.01, max: 0.05 },
      { label: '0.05-0.10', min: 0.05, max: 0.10 },
      { label: '0.10-0.20', min: 0.10, max: 0.20 },
      { label: '0.20-0.50', min: 0.20, max: 0.50 },
      { label: '0.50-1.00', min: 0.50, max: 1.00 },
      { label: '1.00+', min: 1.00, max: Infinity },
    ];

    for (const b of buckets) {
      const prices = subset.filter(r => r.elite_factor >= b.min && r.elite_factor < b.max).map(r => r.price_jpy);
      if (prices.length < 3) continue;
      console.log(
        `    EF ${b.label.padEnd(10)} n=${String(prices.length).padStart(5)}  ` +
        `P25=${fmtK(percentile(prices, 25)).padStart(8)}  Median=${fmtK(median(prices)).padStart(8)}  P75=${fmtK(percentile(prices, 75)).padStart(8)}`
      );
    }

    // Correlation: elite_factor vs log_price
    const r = pearsonR(subset.map(r => r.elite_factor), subset.map(r => r.log_price));
    console.log(`    Correlation (elite_factor vs log₁₀ price): r = ${r.toFixed(3)}`);
  }

  // Same but ALL items with elite_factor > 0
  const allEf = rows.filter(r => r.elite_factor > 0);
  if (allEf.length > 10) {
    const r = pearsonR(allEf.map(r => r.elite_factor), allEf.map(r => r.log_price));
    console.log(`\n  [ALL CATEGORIES] elite_factor > 0 (n=${fmt(allEf.length)}): r = ${r.toFixed(3)}`);
  }
}

// ── Analysis 3: Combined model — elite_factor + cert_ordinal ─────

function analysisCombinedModel(rows: Row[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('ANALYSIS 3: COMBINED MODEL — elite_factor + cert_ordinal → log₁₀(price)');
  console.log(`${'─'.repeat(70)}`);

  for (const cat of ['blade', 'tosogu'] as const) {
    const subset = rows.filter(r => r.item_category === cat);
    if (subset.length < 20) continue;

    console.log(`\n  [${cat.toUpperCase()}] (n=${fmt(subset.length)})`);

    // Simple: log_price = a + b * elite_factor
    const efOnly = linearRegression(
      subset.map(r => r.elite_factor),
      subset.map(r => r.log_price)
    );
    console.log(`    Elite factor only:  R² = ${efOnly.r2.toFixed(3)}  (log₁₀P = ${efOnly.a.toFixed(2)} + ${efOnly.b.toFixed(2)} × EF)`);

    // Simple: log_price = a + b * cert_ordinal
    const certOnly = linearRegression(
      subset.map(r => r.cert_ordinal),
      subset.map(r => r.log_price)
    );
    console.log(`    Cert ordinal only:  R² = ${certOnly.r2.toFixed(3)}  (log₁₀P = ${certOnly.a.toFixed(2)} + ${certOnly.b.toFixed(2)} × Cert)`);

    // Multiple regression approximation: use cert as categorical (per-cert intercept) + EF slope
    // For each cert tier, fit log_price = a_cert + b * elite_factor
    console.log(`    Per-cert-tier regression (log₁₀P = a + b × EF):`);
    for (let ord = 0; ord <= 6; ord++) {
      const certSubset = subset.filter(r => r.cert_ordinal === ord);
      if (certSubset.length < 5) continue;
      const reg = linearRegression(
        certSubset.map(r => r.elite_factor),
        certSubset.map(r => r.log_price)
      );
      const label = CERT_LABEL[ord] || `Ord ${ord}`;
      console.log(
        `      ${label.padEnd(12)} n=${String(certSubset.length).padStart(4)}  ` +
        `R²=${reg.r2.toFixed(3)}  a=${reg.a.toFixed(2)}  b=${reg.b.toFixed(2)}  ` +
        `(predict EF=0: ${fmtK(10 ** reg.a)}, EF=0.5: ${fmtK(10 ** (reg.a + reg.b * 0.5))}, EF=1.0: ${fmtK(10 ** (reg.a + reg.b * 1.0))})`
      );
    }

    // Pseudo-R² for two-feature model (cert + EF)
    // Residualize cert effect, then regress residuals on EF
    const certPred = subset.map(r => certOnly.a + certOnly.b * r.cert_ordinal);
    const residuals = subset.map((r, i) => r.log_price - certPred[i]);
    const efOnResid = linearRegression(
      subset.map(r => r.elite_factor),
      residuals
    );
    const combinedR2 = certOnly.r2 + (1 - certOnly.r2) * efOnResid.r2;
    console.log(`    Combined pseudo-R²: ${combinedR2.toFixed(3)} (cert R²=${certOnly.r2.toFixed(3)} + EF adds ${((1 - certOnly.r2) * efOnResid.r2).toFixed(3)})`);
  }
}

// ── Analysis 4: Within cert tier — EF vs price scatter ───────────

function analysisWithinCert(rows: Row[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('ANALYSIS 4: WITHIN-CERT SCATTER — Elite Factor vs Price');
  console.log(`${'─'.repeat(70)}`);
  console.log('  (Shows how much price variance EF explains WITHIN each cert level)');

  for (const cat of ['blade', 'tosogu'] as const) {
    console.log(`\n  [${cat.toUpperCase()}]`);
    for (const cert of ['Hozon', 'Tokubetsu Hozon', 'Juyo']) {
      const subset = rows.filter(r =>
        r.item_category === cat &&
        r.cert_type === cert &&
        r.elite_factor > 0
      );
      if (subset.length < 5) continue;

      // Split into EF tertiles
      const sorted = [...subset].sort((a, b) => a.elite_factor - b.elite_factor);
      const t1 = sorted.slice(0, Math.floor(sorted.length / 3));
      const t2 = sorted.slice(Math.floor(sorted.length / 3), Math.floor(2 * sorted.length / 3));
      const t3 = sorted.slice(Math.floor(2 * sorted.length / 3));

      const r = pearsonR(subset.map(r => r.elite_factor), subset.map(r => r.log_price));

      console.log(`    ${cert} (n=${subset.length}, r=${r.toFixed(3)}):`);
      if (t1.length >= 2) console.log(`      Low EF  (${t1[0].elite_factor.toFixed(3)}-${t1[t1.length-1].elite_factor.toFixed(3)}): median ${fmtK(median(t1.map(r => r.price_jpy)))}`);
      if (t2.length >= 2) console.log(`      Mid EF  (${t2[0].elite_factor.toFixed(3)}-${t2[t2.length-1].elite_factor.toFixed(3)}): median ${fmtK(median(t2.map(r => r.price_jpy)))}`);
      if (t3.length >= 2) console.log(`      High EF (${t3[0].elite_factor.toFixed(3)}-${t3[t3.length-1].elite_factor.toFixed(3)}): median ${fmtK(median(t3.map(r => r.price_jpy)))}`);
    }
  }
}

// ── Analysis 5: Item type effect within blades ───────────────────

function analysisItemType(rows: Row[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('ANALYSIS 5: ITEM TYPE EFFECT — Within Blades');
  console.log(`${'─'.repeat(70)}`);

  for (const cert of ['Hozon', 'Tokubetsu Hozon', 'Juyo']) {
    console.log(`\n  ${cert}:`);
    for (const type of ['katana', 'wakizashi', 'tanto', 'tachi']) {
      const subset = rows.filter(r => r.item_type === type && r.cert_type === cert);
      if (subset.length < 5) continue;
      const prices = subset.map(r => r.price_jpy);
      console.log(
        `    ${type.padEnd(12)} n=${String(subset.length).padStart(4)}  ` +
        `P25=${fmtK(percentile(prices, 25)).padStart(8)}  Median=${fmtK(median(prices)).padStart(8)}  P75=${fmtK(percentile(prices, 75)).padStart(8)}`
      );
    }
  }
}

// ── Analysis 6: Data sufficiency for the model ───────────────────

function analysisModelReadiness(rows: Row[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('ANALYSIS 6: MODEL READINESS — Sample Sizes by Segment');
  console.log(`${'─'.repeat(70)}`);

  // How many rows per item_category × cert tier with elite_factor?
  const segments: Record<string, { total: number; withEf: number; efGt0: number }> = {};

  for (const r of rows) {
    const key = `${r.item_category}|${CERT_LABEL[r.cert_ordinal] || r.cert_ordinal}`;
    if (!segments[key]) segments[key] = { total: 0, withEf: 0, efGt0: 0 };
    segments[key].total++;
    if (r.elite_factor != null) segments[key].withEf++;
    if (r.elite_factor > 0) segments[key].efGt0++;
  }

  const out = Object.entries(segments)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, { total, withEf, efGt0 }]) => {
      const [cat, cert] = key.split('|');
      return {
        category: cat,
        cert,
        total,
        with_ef: withEf,
        ef_gt_0: efGt0,
        pct_ef: ((withEf / total) * 100).toFixed(0) + '%',
      };
    });

  console.table(out);

  // Overall summary
  const totalRows = rows.length;
  const withEf = rows.filter(r => r.elite_factor != null).length;
  const efGt0 = rows.filter(r => r.elite_factor > 0).length;
  console.log(`\n  Total priced rows: ${fmt(totalRows)}`);
  console.log(`  With elite_factor (incl. 0): ${fmt(withEf)} (${((withEf / totalRows) * 100).toFixed(1)}%)`);
  console.log(`  With elite_factor > 0: ${fmt(efGt0)} (${((efGt0 / totalRows) * 100).toFixed(1)}%)`);
}

// ── Analysis 7: Log-price normality check ────────────────────────

function analysisLogNormality(rows: Row[]) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('ANALYSIS 7: LOG-PRICE DISTRIBUTION — Is log₁₀(price) ~normal?');
  console.log(`${'─'.repeat(70)}`);

  for (const cat of ['blade', 'tosogu'] as const) {
    const prices = rows.filter(r => r.item_category === cat).map(r => r.log_price);
    if (prices.length < 20) continue;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
    const std = Math.sqrt(variance);

    // Skewness
    const skew = prices.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / prices.length;
    // Kurtosis (excess)
    const kurt = prices.reduce((a, b) => a + ((b - mean) / std) ** 4, 0) / prices.length - 3;

    console.log(`\n  [${cat.toUpperCase()}] (n=${fmt(prices.length)})`);
    console.log(`    log₁₀ mean:     ${mean.toFixed(3)} (= ${fmtK(10 ** mean)})`);
    console.log(`    log₁₀ std:      ${std.toFixed(3)} (1σ range: ${fmtK(10 ** (mean - std))} – ${fmtK(10 ** (mean + std))})`);
    console.log(`    Skewness:       ${skew.toFixed(3)} (0 = symmetric)`);
    console.log(`    Excess kurtosis: ${kurt.toFixed(3)} (0 = normal)`);
    console.log(`    Percentiles:`);
    for (const p of [5, 10, 25, 50, 75, 90, 95]) {
      console.log(`      P${String(p).padStart(2)}: ${fmtK(10 ** percentile(prices, p))}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║    MARKET PRICE MODEL — EXPLORATORY ANALYSIS                        ║');
  console.log('║    Testing: elite_factor × cert_tier → price                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  console.log('\nFetching data...');
  const rows = await fetchData();
  console.log(`Loaded ${fmt(rows.length)} qualified rows (priced, non-hidden, available+sold, ≥¥5K)`);
  console.log(`  Blades:  ${fmt(rows.filter(r => r.item_category === 'blade').length)}`);
  console.log(`  Tosogu:  ${fmt(rows.filter(r => r.item_category === 'tosogu').length)}`);
  console.log(`  Other:   ${fmt(rows.filter(r => r.item_category === 'other').length)}`);

  analysisCertLadder(rows);
  analysisEliteFactor(rows);
  analysisCombinedModel(rows);
  analysisWithinCert(rows);
  analysisItemType(rows);
  analysisModelReadiness(rows);
  analysisLogNormality(rows);

  console.log(`\n${'═'.repeat(70)}`);
  console.log('EXPLORATION COMPLETE');
  console.log(`${'═'.repeat(70)}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
