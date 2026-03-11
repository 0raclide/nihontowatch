/**
 * Market Transparency — Model Comparison
 *
 * Compares predictive power of different artisan rating systems for price:
 *   - elite_factor (designation-based Bayesian shrinkage, 0–1.88)
 *   - toko_taikan (Toko Taikan rating, 450–3500)
 *   - hawley (Hawley rating, 50–400)
 *   - fujishiro (qualitative grade: saijo/jojo/jo/chujo/chu)
 *   - cert_ordinal (paper level)
 *   - item_type (katana/wakizashi/tanto/etc.)
 *
 * Tests single-feature, two-feature, and multi-feature models.
 *
 * Run with: npx tsx scripts/market-model-comparison.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Main Supabase (listings)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Yuhinkai Supabase (artisan_makers)
const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';
if (!yuhinkaiUrl || !yuhinkaiKey) {
  console.error('Yuhinkai credentials not configured. Set YUHINKAI_SUPABASE_URL + YUHINKAI_SUPABASE_KEY');
  process.exit(1);
}
const yuhinkai = createClient(yuhinkaiUrl, yuhinkaiKey);

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
  return Math.sqrt(dx2 * dy2) === 0 ? 0 : num / Math.sqrt(dx2 * dy2);
}

// OLS: y = a + b*x
function ols1(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
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
  const r2 = ssyy === 0 ? 0 : (ssxy ** 2) / (ssxx * ssyy);
  return { a, b, r2 };
}

// Multiple OLS via normal equations: y = X*β, returns β and R²
// X is n×p matrix (each row is a data point, each column a feature)
function olsMulti(X: number[][], y: number[]): { beta: number[]; r2: number; adjR2: number; residuals: number[] } {
  const n = y.length;
  const p = X[0].length;

  // Add intercept column
  const Xa = X.map(row => [1, ...row]);
  const pp = p + 1;

  // X'X
  const XtX: number[][] = Array.from({ length: pp }, () => Array(pp).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < pp; j++) {
      for (let k = 0; k < pp; k++) {
        XtX[j][k] += Xa[i][j] * Xa[i][k];
      }
    }
  }

  // X'y
  const Xty: number[] = Array(pp).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < pp; j++) {
      Xty[j] += Xa[i][j] * y[i];
    }
  }

  // Solve via Gauss-Jordan elimination
  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < pp; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < pp; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue; // Singular
    for (let j = col; j <= pp; j++) aug[col][j] /= pivot;
    for (let row = 0; row < pp; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= pp; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  const beta = aug.map(row => row[pp]);

  // Compute R²
  const my = y.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0, ssTot = 0;
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let j = 0; j < pp; j++) pred += Xa[i][j] * beta[j];
    const res = y[i] - pred;
    residuals.push(res);
    ssRes += res * res;
    ssTot += (y[i] - my) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - p - 1);

  return { beta, r2, adjR2, residuals };
}

const TO_JPY: Record<string, number> = { JPY: 1, USD: 150, EUR: 163, GBP: 190, AUD: 98, CAD: 110, CHF: 170 };

const CERT_ORDINAL: Record<string, number> = {
  'none': 0, 'Registration': 0, 'Kicho': 1, 'Kanteisho': 1,
  'Tokubetsu Kicho': 2, 'Koshu Tokubetsu Kicho': 2,
  'Hozon': 3, 'Hozon Tosogu': 3,
  'Tokubetsu Hozon': 4, 'Tokubetsu Hozon Tosogu': 4, 'Tokubetsu Kicho Tosogu': 4,
  'Juyo': 5, 'Juyo Bijutsuhin': 5, 'juyo_bijutsuhin': 5,
  'Tokuju': 6,
};

const CERT_LABEL: Record<number, string> = {
  0: 'None/Reg', 1: 'Kicho', 2: 'TokuKicho', 3: 'Hozon', 4: 'TokuHozon', 5: 'Juyo', 6: 'Tokuju',
};

// Fujishiro to numeric (higher = better)
const FUJISHIRO_ORDINAL: Record<string, number> = {
  'Chu saku': 1,
  'Chu-jo saku': 2,
  'Jo saku': 3,
  'Jo-jo saku': 4,
  'Sai-jo saku': 5,
};

const BLADE_TYPES = new Set(['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken']);
const TOSOGU_TYPES = new Set(['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'fuchi-kashira']);

// Item type ordinal (by typical price within cert)
const ITEM_TYPE_ORD: Record<string, number> = {
  'tanto': 1, 'wakizashi': 2, 'katana': 3, 'tachi': 4,
  'naginata': 3, 'yari': 2, 'ken': 3,
  'menuki': 1, 'kozuka': 2, 'kogai': 2, 'fuchi': 2, 'kashira': 2, 'fuchi-kashira': 3, 'tsuba': 3,
};

// ── Data fetch ───────────────────────────────────────────────────

interface Row {
  price_jpy: number;
  log_price: number;
  elite_factor: number;
  toko_taikan: number | null;
  hawley: number | null;
  fujishiro: string | null;
  fujishiro_ord: number | null;
  cert_ordinal: number;
  cert_type: string;
  item_type: string;
  item_type_ord: number;
  item_category: 'blade' | 'tosogu' | 'other';
  artisan_id: string;
}

async function fetchData(): Promise<Row[]> {
  // 1. Fetch listings
  console.log('  Fetching listings...');
  const PAGE = 1000;
  let allListings: Record<string, unknown>[] = [];
  let offset = 0;
  const select = 'price_value, price_currency, artisan_elite_factor, artisan_id, artisan_confidence, cert_type, item_type, is_available, is_sold, admin_hidden';
  while (true) {
    const { data, error } = await supabase.from('listings').select(select).range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allListings = allListings.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`    ${fmt(allListings.length)} listings fetched`);

  // 2. Collect unique artisan IDs that need Yuhinkai lookup
  const artisanIds = new Set<string>();
  for (const r of allListings) {
    if (r.artisan_id && r.artisan_id !== 'UNKNOWN' && !(r.artisan_id as string).startsWith('NS-')) {
      artisanIds.add(r.artisan_id as string);
    }
  }
  console.log(`    ${fmt(artisanIds.size)} unique artisan IDs to look up`);

  // 3. Fetch Yuhinkai ratings in batches
  console.log('  Fetching Yuhinkai ratings...');
  const artisanRatings: Record<string, { toko_taikan: number | null; hawley: number | null; fujishiro: string | null }> = {};
  const idArray = [...artisanIds];
  const BATCH = 500;
  for (let i = 0; i < idArray.length; i += BATCH) {
    const batch = idArray.slice(i, i + BATCH);
    const { data, error } = await yuhinkai
      .from('artisan_makers')
      .select('maker_id, toko_taikan, hawley, fujishiro')
      .in('maker_id', batch);
    if (error) { console.warn(`    Yuhinkai batch error: ${error.message}`); continue; }
    for (const d of data || []) {
      artisanRatings[d.maker_id] = {
        toko_taikan: d.toko_taikan,
        hawley: d.hawley,
        fujishiro: d.fujishiro,
      };
    }
  }

  // Also fetch school-level ratings for NS-* codes
  const schoolIds = new Set<string>();
  for (const r of allListings) {
    if (r.artisan_id && (r.artisan_id as string).startsWith('NS-')) {
      schoolIds.add(r.artisan_id as string);
    }
  }
  if (schoolIds.size > 0) {
    const { data } = await yuhinkai
      .from('artisan_schools')
      .select('school_id, toko_taikan, hawley, fujishiro')
      .in('school_id', [...schoolIds]);
    for (const d of data || []) {
      artisanRatings[d.school_id] = {
        toko_taikan: d.toko_taikan,
        hawley: d.hawley,
        fujishiro: d.fujishiro,
      };
    }
  }

  const withRatings = Object.values(artisanRatings).filter(r => r.toko_taikan != null).length;
  const withHawley = Object.values(artisanRatings).filter(r => r.hawley != null).length;
  const withFujishiro = Object.values(artisanRatings).filter(r => r.fujishiro != null).length;
  console.log(`    Ratings found: ${withRatings} toko_taikan, ${withHawley} hawley, ${withFujishiro} fujishiro`);

  // 4. Join and build rows
  const rows: Row[] = [];
  for (const r of allListings) {
    if (r.admin_hidden) continue;
    if (!r.is_available && !r.is_sold) continue;
    if (!r.price_value || (r.price_value as number) <= 0) continue;
    if (r.artisan_elite_factor == null) continue;

    const cert = (r.cert_type as string) || 'none';
    const certOrd = CERT_ORDINAL[cert];
    if (certOrd === undefined) continue;

    const priceJpy = (r.price_value as number) * (TO_JPY[(r.price_currency as string) || 'JPY'] || 1);
    if (priceJpy < 5000) continue;

    const itemType = (r.item_type as string) || 'unknown';
    let itemCat: 'blade' | 'tosogu' | 'other' = 'other';
    if (BLADE_TYPES.has(itemType)) itemCat = 'blade';
    else if (TOSOGU_TYPES.has(itemType)) itemCat = 'tosogu';

    const artisanId = (r.artisan_id as string) || 'NONE';
    const ratings = artisanRatings[artisanId];

    rows.push({
      price_jpy: priceJpy,
      log_price: Math.log10(priceJpy),
      elite_factor: r.artisan_elite_factor as number,
      toko_taikan: ratings?.toko_taikan ?? null,
      hawley: ratings?.hawley ?? null,
      fujishiro: ratings?.fujishiro ?? null,
      fujishiro_ord: ratings?.fujishiro ? (FUJISHIRO_ORDINAL[ratings.fujishiro] ?? null) : null,
      cert_ordinal: certOrd,
      cert_type: cert,
      item_type: itemType,
      item_type_ord: ITEM_TYPE_ORD[itemType] ?? 0,
      item_category: itemCat,
      artisan_id: artisanId,
    });
  }

  return rows;
}

// ── Analysis functions ───────────────────────────────────────────

function heading(title: string) {
  console.log(`\n${'═'.repeat(75)}`);
  console.log(title);
  console.log(`${'─'.repeat(75)}`);
}

function reportSingleFeature(name: string, xs: number[], ys: number[], n: number) {
  if (n < 5) { console.log(`    ${name.padEnd(22)} n=${String(n).padStart(5)}  (too few)`); return; }
  const r = pearsonR(xs, ys);
  const { r2 } = ols1(xs, ys);
  console.log(`    ${name.padEnd(22)} n=${String(n).padStart(5)}  r=${r.toFixed(3)}  R²=${r2.toFixed(3)}`);
}

// ── 1. Coverage comparison ───────────────────────────────────────

function analysisCoverage(rows: Row[]) {
  heading('1. COVERAGE — How many listings have each rating?');

  for (const cat of ['blade', 'tosogu', 'all'] as const) {
    const subset = cat === 'all' ? rows : rows.filter(r => r.item_category === cat);
    const total = subset.length;
    const withEf = subset.filter(r => r.elite_factor > 0).length;
    const withTt = subset.filter(r => r.toko_taikan != null).length;
    const withHw = subset.filter(r => r.hawley != null).length;
    const withFj = subset.filter(r => r.fujishiro_ord != null).length;
    const withAny = subset.filter(r => r.elite_factor > 0 || r.toko_taikan != null || r.hawley != null).length;

    console.log(`\n  [${cat.toUpperCase()}] (n=${fmt(total)} priced)`);
    console.log(`    elite_factor > 0:   ${fmt(withEf).padStart(6)} (${((withEf / total) * 100).toFixed(1)}%)`);
    console.log(`    toko_taikan:        ${fmt(withTt).padStart(6)} (${((withTt / total) * 100).toFixed(1)}%)`);
    console.log(`    hawley:             ${fmt(withHw).padStart(6)} (${((withHw / total) * 100).toFixed(1)}%)`);
    console.log(`    fujishiro:          ${fmt(withFj).padStart(6)} (${((withFj / total) * 100).toFixed(1)}%)`);
    console.log(`    any artisan rating: ${fmt(withAny).padStart(6)} (${((withAny / total) * 100).toFixed(1)}%)`);
  }
}

// ── 2. Single-feature R² shootout ────────────────────────────────

function analysisSingleFeature(rows: Row[]) {
  heading('2. SINGLE-FEATURE R² — Which feature best predicts log₁₀(price)?');

  for (const cat of ['blade', 'tosogu'] as const) {
    const subset = cat === 'blade'
      ? rows.filter(r => r.item_category === 'blade')
      : rows.filter(r => r.item_category === 'tosogu');

    console.log(`\n  [${cat.toUpperCase()}]`);

    // cert_ordinal (all rows)
    reportSingleFeature('cert_ordinal', subset.map(r => r.cert_ordinal), subset.map(r => r.log_price), subset.length);

    // item_type_ord (all rows)
    reportSingleFeature('item_type_ord', subset.map(r => r.item_type_ord), subset.map(r => r.log_price), subset.length);

    // elite_factor (only where > 0)
    const ef = subset.filter(r => r.elite_factor > 0);
    reportSingleFeature('elite_factor (>0)', ef.map(r => r.elite_factor), ef.map(r => r.log_price), ef.length);

    // toko_taikan
    const tt = subset.filter(r => r.toko_taikan != null);
    reportSingleFeature('toko_taikan', tt.map(r => r.toko_taikan!), tt.map(r => r.log_price), tt.length);

    // log(toko_taikan) — may linearize better
    const ttLog = tt.filter(r => r.toko_taikan! > 0);
    reportSingleFeature('log₁₀(toko_taikan)', ttLog.map(r => Math.log10(r.toko_taikan!)), ttLog.map(r => r.log_price), ttLog.length);

    // hawley
    const hw = subset.filter(r => r.hawley != null);
    reportSingleFeature('hawley', hw.map(r => r.hawley!), hw.map(r => r.log_price), hw.length);

    // fujishiro ordinal
    const fj = subset.filter(r => r.fujishiro_ord != null);
    reportSingleFeature('fujishiro_ord', fj.map(r => r.fujishiro_ord!), fj.map(r => r.log_price), fj.length);
  }
}

// ── 3. Toko Taikan ladder breakdown ──────────────────────────────

function analysisTaikanLadder(rows: Row[]) {
  heading('3. TOKO TAIKAN LADDER — Price by TT Rating Bucket');

  const ttRows = rows.filter(r => r.toko_taikan != null && r.item_category === 'blade');
  if (ttRows.length < 10) { console.log('  Insufficient data'); return; }

  const buckets = [
    { label: '< 750', min: 0, max: 750 },
    { label: '750-999', min: 750, max: 1000 },
    { label: '1000-1499', min: 1000, max: 1500 },
    { label: '1500-1999', min: 1500, max: 2000 },
    { label: '2000-2499', min: 2000, max: 2500 },
    { label: '2500+', min: 2500, max: Infinity },
  ];

  // Overall
  console.log(`\n  [BLADE] All certs (n=${ttRows.length}):`);
  for (const b of buckets) {
    const prices = ttRows.filter(r => r.toko_taikan! >= b.min && r.toko_taikan! < b.max).map(r => r.price_jpy);
    if (prices.length < 2) continue;
    console.log(
      `    TT ${b.label.padEnd(12)} n=${String(prices.length).padStart(4)}  ` +
      `P25=${fmtK(percentile(prices, 25)).padStart(8)}  Med=${fmtK(median(prices)).padStart(8)}  P75=${fmtK(percentile(prices, 75)).padStart(8)}`
    );
  }

  // Per cert tier
  for (const certOrd of [3, 4, 5]) {
    const certSubset = ttRows.filter(r => r.cert_ordinal === certOrd);
    if (certSubset.length < 10) continue;
    console.log(`\n  [BLADE] ${CERT_LABEL[certOrd]} only (n=${certSubset.length}):`);
    for (const b of buckets) {
      const prices = certSubset.filter(r => r.toko_taikan! >= b.min && r.toko_taikan! < b.max).map(r => r.price_jpy);
      if (prices.length < 2) continue;
      console.log(
        `    TT ${b.label.padEnd(12)} n=${String(prices.length).padStart(4)}  ` +
        `P25=${fmtK(percentile(prices, 25)).padStart(8)}  Med=${fmtK(median(prices)).padStart(8)}  P75=${fmtK(percentile(prices, 75)).padStart(8)}`
      );
    }
  }
}

// ── 4. Multi-feature model comparison ────────────────────────────

function analysisModelComparison(rows: Row[]) {
  heading('4. MODEL COMPARISON — Multi-feature OLS on log₁₀(price)');
  heading('   (Adjusted R² penalizes overfitting; higher = better)');

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);
    console.log(`\n  [${ cat.toUpperCase()}]`);

    // --- Models using ALL data (cert + item_type available for everyone) ---
    const allY = base.map(r => r.log_price);

    // M0: cert only
    const m0 = olsMulti(base.map(r => [r.cert_ordinal]), allY);
    console.log(`    M0  cert                           n=${fmt(base.length).padStart(5)}  R²=${m0.r2.toFixed(3)}  adjR²=${m0.adjR2.toFixed(3)}`);

    // M1: cert + item_type
    const m1 = olsMulti(base.map(r => [r.cert_ordinal, r.item_type_ord]), allY);
    console.log(`    M1  cert + item_type               n=${fmt(base.length).padStart(5)}  R²=${m1.r2.toFixed(3)}  adjR²=${m1.adjR2.toFixed(3)}`);

    // --- Models requiring elite_factor > 0 ---
    const efRows = base.filter(r => r.elite_factor > 0);
    const efY = efRows.map(r => r.log_price);

    if (efRows.length >= 20) {
      const m2 = olsMulti(efRows.map(r => [r.cert_ordinal, r.elite_factor]), efY);
      console.log(`    M2  cert + EF                      n=${fmt(efRows.length).padStart(5)}  R²=${m2.r2.toFixed(3)}  adjR²=${m2.adjR2.toFixed(3)}`);

      const m3 = olsMulti(efRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor]), efY);
      console.log(`    M3  cert + item_type + EF          n=${fmt(efRows.length).padStart(5)}  R²=${m3.r2.toFixed(3)}  adjR²=${m3.adjR2.toFixed(3)}`);

      // With interaction: cert × EF
      const m3i = olsMulti(efRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor]), efY);
      console.log(`    M3i cert + item + EF + cert×EF     n=${fmt(efRows.length).padStart(5)}  R²=${m3i.r2.toFixed(3)}  adjR²=${m3i.adjR2.toFixed(3)}`);
    }

    // --- Models requiring toko_taikan ---
    const ttRows = base.filter(r => r.toko_taikan != null);
    const ttY = ttRows.map(r => r.log_price);

    if (ttRows.length >= 20) {
      const m4 = olsMulti(ttRows.map(r => [r.cert_ordinal, Math.log10(r.toko_taikan!)]), ttY);
      console.log(`    M4  cert + log(TT)                 n=${fmt(ttRows.length).padStart(5)}  R²=${m4.r2.toFixed(3)}  adjR²=${m4.adjR2.toFixed(3)}`);

      const m5 = olsMulti(ttRows.map(r => [r.cert_ordinal, r.item_type_ord, Math.log10(r.toko_taikan!)]), ttY);
      console.log(`    M5  cert + item_type + log(TT)     n=${fmt(ttRows.length).padStart(5)}  R²=${m5.r2.toFixed(3)}  adjR²=${m5.adjR2.toFixed(3)}`);

      // With interaction
      const m5i = olsMulti(ttRows.map(r => [r.cert_ordinal, r.item_type_ord, Math.log10(r.toko_taikan!), r.cert_ordinal * Math.log10(r.toko_taikan!)]), ttY);
      console.log(`    M5i cert + item + log(TT) + cert×TT n=${fmt(ttRows.length).padStart(5)}  R²=${m5i.r2.toFixed(3)}  adjR²=${m5i.adjR2.toFixed(3)}`);
    }

    // --- Models with BOTH EF and TT ---
    const bothRows = base.filter(r => r.elite_factor > 0 && r.toko_taikan != null);
    const bothY = bothRows.map(r => r.log_price);

    if (bothRows.length >= 20) {
      const m6 = olsMulti(bothRows.map(r => [r.cert_ordinal, r.elite_factor, Math.log10(r.toko_taikan!)]), bothY);
      console.log(`    M6  cert + EF + log(TT)            n=${fmt(bothRows.length).padStart(5)}  R²=${m6.r2.toFixed(3)}  adjR²=${m6.adjR2.toFixed(3)}`);

      const m7 = olsMulti(bothRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, Math.log10(r.toko_taikan!)]), bothY);
      console.log(`    M7  cert + item + EF + log(TT)     n=${fmt(bothRows.length).padStart(5)}  R²=${m7.r2.toFixed(3)}  adjR²=${m7.adjR2.toFixed(3)}`);

      // Kitchen sink with interactions
      const m8 = olsMulti(bothRows.map(r => [
        r.cert_ordinal, r.item_type_ord, r.elite_factor, Math.log10(r.toko_taikan!),
        r.cert_ordinal * r.elite_factor, r.cert_ordinal * Math.log10(r.toko_taikan!)
      ]), bothY);
      console.log(`    M8  full + interactions             n=${fmt(bothRows.length).padStart(5)}  R²=${m8.r2.toFixed(3)}  adjR²=${m8.adjR2.toFixed(3)}`);
    }

    // --- Hawley comparison (where available) ---
    const hwRows = base.filter(r => r.hawley != null);
    const hwY = hwRows.map(r => r.log_price);
    if (hwRows.length >= 20) {
      const mHw = olsMulti(hwRows.map(r => [r.cert_ordinal, r.item_type_ord, r.hawley!]), hwY);
      console.log(`    M-hw cert + item + hawley          n=${fmt(hwRows.length).padStart(5)}  R²=${mHw.r2.toFixed(3)}  adjR²=${mHw.adjR2.toFixed(3)}`);
    }

    // --- Fujishiro comparison (where available) ---
    const fjRows = base.filter(r => r.fujishiro_ord != null);
    const fjY = fjRows.map(r => r.log_price);
    if (fjRows.length >= 20) {
      const mFj = olsMulti(fjRows.map(r => [r.cert_ordinal, r.item_type_ord, r.fujishiro_ord!]), fjY);
      console.log(`    M-fj cert + item + fujishiro       n=${fmt(fjRows.length).padStart(5)}  R²=${mFj.r2.toFixed(3)}  adjR²=${mFj.adjR2.toFixed(3)}`);
    }
  }
}

// ── 5. Within-cert: EF vs TT head-to-head ────────────────────────

function analysisHeadToHead(rows: Row[]) {
  heading('5. HEAD-TO-HEAD — EF vs TT within cert tiers (blades only)');

  const blades = rows.filter(r => r.item_category === 'blade');

  for (const certOrd of [0, 3, 4, 5]) {
    const certRows = blades.filter(r => r.cert_ordinal === certOrd);
    if (certRows.length < 10) continue;

    console.log(`\n  ${CERT_LABEL[certOrd]} (n=${certRows.length} total):`);

    // EF
    const ef = certRows.filter(r => r.elite_factor > 0);
    if (ef.length >= 5) {
      const r = pearsonR(ef.map(r => r.elite_factor), ef.map(r => r.log_price));
      const { r2 } = ols1(ef.map(r => r.elite_factor), ef.map(r => r.log_price));
      console.log(`    elite_factor   n=${String(ef.length).padStart(4)}  r=${r.toFixed(3)}  R²=${r2.toFixed(3)}`);
    }

    // TT
    const tt = certRows.filter(r => r.toko_taikan != null);
    if (tt.length >= 5) {
      const r = pearsonR(tt.map(r => Math.log10(r.toko_taikan!)), tt.map(r => r.log_price));
      const { r2 } = ols1(tt.map(r => Math.log10(r.toko_taikan!)), tt.map(r => r.log_price));
      console.log(`    log(TT)        n=${String(tt.length).padStart(4)}  r=${r.toFixed(3)}  R²=${r2.toFixed(3)}`);
    }

    // Hawley
    const hw = certRows.filter(r => r.hawley != null);
    if (hw.length >= 5) {
      const r = pearsonR(hw.map(r => r.hawley!), hw.map(r => r.log_price));
      const { r2 } = ols1(hw.map(r => r.hawley!), hw.map(r => r.log_price));
      console.log(`    hawley         n=${String(hw.length).padStart(4)}  r=${r.toFixed(3)}  R²=${r2.toFixed(3)}`);
    }

    // Both EF + TT
    const both = certRows.filter(r => r.elite_factor > 0 && r.toko_taikan != null);
    if (both.length >= 10) {
      const m = olsMulti(both.map(r => [r.elite_factor, Math.log10(r.toko_taikan!)]), both.map(r => r.log_price));
      console.log(`    EF + log(TT)   n=${String(both.length).padStart(4)}  R²=${m.r2.toFixed(3)}  adjR²=${m.adjR2.toFixed(3)}`);
    }
  }
}

// ── 6. Correlation between rating systems ────────────────────────

function analysisRatingCorrelations(rows: Row[]) {
  heading('6. INTER-RATING CORRELATIONS — How redundant are the features?');

  const blades = rows.filter(r => r.item_category === 'blade');

  // EF vs TT
  const efTt = blades.filter(r => r.elite_factor > 0 && r.toko_taikan != null);
  if (efTt.length >= 5) {
    const r = pearsonR(efTt.map(r => r.elite_factor), efTt.map(r => r.toko_taikan!));
    console.log(`\n  EF vs TT:          r=${r.toFixed(3)} (n=${efTt.length})`);
  }

  // EF vs Hawley
  const efHw = blades.filter(r => r.elite_factor > 0 && r.hawley != null);
  if (efHw.length >= 5) {
    const r = pearsonR(efHw.map(r => r.elite_factor), efHw.map(r => r.hawley!));
    console.log(`  EF vs Hawley:      r=${r.toFixed(3)} (n=${efHw.length})`);
  }

  // TT vs Hawley
  const ttHw = blades.filter(r => r.toko_taikan != null && r.hawley != null);
  if (ttHw.length >= 5) {
    const r = pearsonR(ttHw.map(r => r.toko_taikan!), ttHw.map(r => r.hawley!));
    console.log(`  TT vs Hawley:      r=${r.toFixed(3)} (n=${ttHw.length})`);
  }

  // TT vs Fujishiro
  const ttFj = blades.filter(r => r.toko_taikan != null && r.fujishiro_ord != null);
  if (ttFj.length >= 5) {
    const r = pearsonR(ttFj.map(r => r.toko_taikan!), ttFj.map(r => r.fujishiro_ord!));
    console.log(`  TT vs Fujishiro:   r=${r.toFixed(3)} (n=${ttFj.length})`);
  }

  // EF vs Fujishiro
  const efFj = blades.filter(r => r.elite_factor > 0 && r.fujishiro_ord != null);
  if (efFj.length >= 5) {
    const r = pearsonR(efFj.map(r => r.elite_factor), efFj.map(r => r.fujishiro_ord!));
    console.log(`  EF vs Fujishiro:   r=${r.toFixed(3)} (n=${efFj.length})`);
  }
}

// ── 7. Best model coefficients (for implementation) ──────────────

function analysisBestModel(rows: Row[]) {
  heading('7. BEST MODEL COEFFICIENTS — For implementation');

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);

    console.log(`\n  [${cat.toUpperCase()}]`);

    // Model A: cert + item_type (works for ALL listings)
    const mA = olsMulti(base.map(r => [r.cert_ordinal, r.item_type_ord]), base.map(r => r.log_price));
    console.log(`\n    Model A (universal): log₁₀(price) = ${mA.beta[0].toFixed(3)} + ${mA.beta[1].toFixed(3)}×cert + ${mA.beta[2].toFixed(3)}×item_type`);
    console.log(`      adjR² = ${mA.adjR2.toFixed(3)}, n = ${base.length}`);
    console.log(`      Predicted medians:`);
    for (const certOrd of [0, 3, 4, 5]) {
      const pred = 10 ** (mA.beta[0] + mA.beta[1] * certOrd + mA.beta[2] * 3);
      console.log(`        ${CERT_LABEL[certOrd]?.padEnd(12)} katana: ${fmtK(pred)}`);
    }

    // Model B: cert + item_type + EF (for artisan-matched listings)
    const efRows = base.filter(r => r.elite_factor > 0);
    if (efRows.length >= 20) {
      const mB = olsMulti(
        efRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor]),
        efRows.map(r => r.log_price)
      );
      console.log(`\n    Model B (EF-enhanced): log₁₀(P) = ${mB.beta[0].toFixed(3)} + ${mB.beta[1].toFixed(3)}×cert + ${mB.beta[2].toFixed(3)}×item + ${mB.beta[3].toFixed(3)}×EF + ${mB.beta[4].toFixed(3)}×cert×EF`);
      console.log(`      adjR² = ${mB.adjR2.toFixed(3)}, n = ${efRows.length}`);
    }

    // Model C: cert + item_type + log(TT) (for TT-rated listings)
    const ttRows = base.filter(r => r.toko_taikan != null);
    if (ttRows.length >= 20) {
      const mC = olsMulti(
        ttRows.map(r => [r.cert_ordinal, r.item_type_ord, Math.log10(r.toko_taikan!), r.cert_ordinal * Math.log10(r.toko_taikan!)]),
        ttRows.map(r => r.log_price)
      );
      console.log(`\n    Model C (TT-enhanced): log₁₀(P) = ${mC.beta[0].toFixed(3)} + ${mC.beta[1].toFixed(3)}×cert + ${mC.beta[2].toFixed(3)}×item + ${mC.beta[3].toFixed(3)}×log(TT) + ${mC.beta[4].toFixed(3)}×cert×log(TT)`);
      console.log(`      adjR² = ${mC.adjR2.toFixed(3)}, n = ${ttRows.length}`);
    }

    // Model D: cert + item_type + EF + log(TT) (for both)
    const bothRows = base.filter(r => r.elite_factor > 0 && r.toko_taikan != null);
    if (bothRows.length >= 20) {
      const mD = olsMulti(
        bothRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, Math.log10(r.toko_taikan!),
          r.cert_ordinal * r.elite_factor, r.cert_ordinal * Math.log10(r.toko_taikan!)]),
        bothRows.map(r => r.log_price)
      );
      console.log(`\n    Model D (full): log₁₀(P) = ${mD.beta[0].toFixed(3)} + ${mD.beta[1].toFixed(3)}×cert + ${mD.beta[2].toFixed(3)}×item + ${mD.beta[3].toFixed(3)}×EF + ${mD.beta[4].toFixed(3)}×log(TT) + ${mD.beta[5].toFixed(3)}×cert×EF + ${mD.beta[6].toFixed(3)}×cert×log(TT)`);
      console.log(`      adjR² = ${mD.adjR2.toFixed(3)}, n = ${bothRows.length}`);
    }
  }
}

// ── 8. Residual analysis for best model ──────────────────────────

function analysisResiduals(rows: Row[]) {
  heading('8. RESIDUAL ANALYSIS — How accurate are predictions?');

  for (const cat of ['blade'] as const) {
    const base = rows.filter(r => r.item_category === cat && r.elite_factor > 0);
    if (base.length < 20) continue;

    // Fit M3i: cert + item + EF + cert×EF
    const m = olsMulti(
      base.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor]),
      base.map(r => r.log_price)
    );

    // Residual stats
    const absRes = m.residuals.map(Math.abs);
    const meanAbsErr = absRes.reduce((a, b) => a + b, 0) / absRes.length;
    const medAbsErr = median(absRes);

    // What does MAE in log₁₀ space mean in price space?
    // MAE of 0.3 in log₁₀ means predictions are off by a factor of 10^0.3 ≈ 2x
    const factor = 10 ** medAbsErr;

    console.log(`\n  [${cat.toUpperCase()}] Model: cert + item + EF + cert×EF (n=${base.length})`);
    console.log(`    Mean Abs Error (log₁₀):   ${meanAbsErr.toFixed(3)} (≈ ${(10 ** meanAbsErr).toFixed(1)}× factor)`);
    console.log(`    Median Abs Error (log₁₀):  ${medAbsErr.toFixed(3)} (≈ ${factor.toFixed(1)}× factor)`);
    console.log(`    Interpretation: 50% of predictions within ${((factor - 1) * 100).toFixed(0)}% of actual price`);

    // Percentage of predictions within 2x
    const within2x = absRes.filter(r => r <= Math.log10(2)).length;
    const within3x = absRes.filter(r => r <= Math.log10(3)).length;
    console.log(`    Within 2× of actual: ${((within2x / absRes.length) * 100).toFixed(0)}%`);
    console.log(`    Within 3× of actual: ${((within3x / absRes.length) * 100).toFixed(0)}%`);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║    MARKET PRICE MODEL — RATING SYSTEM COMPARISON                     ║');
  console.log('║    EF vs Toko Taikan vs Hawley vs Fujishiro                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');

  const rows = await fetchData();
  console.log(`\nLoaded ${fmt(rows.length)} qualified rows`);

  analysisCoverage(rows);
  analysisSingleFeature(rows);
  analysisTaikanLadder(rows);
  analysisModelComparison(rows);
  analysisHeadToHead(rows);
  analysisRatingCorrelations(rows);
  analysisBestModel(rows);
  analysisResiduals(rows);

  console.log(`\n${'═'.repeat(75)}`);
  console.log('MODEL COMPARISON COMPLETE');
  console.log(`${'═'.repeat(75)}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
