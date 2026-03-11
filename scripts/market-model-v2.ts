/**
 * Market Transparency — Model Comparison V2
 *
 * Runs against market_price_observations table (includes private sale data).
 * Compares: elite_factor, toko_taikan, hawley, fujishiro, cert, item_type.
 *
 * Run with: npx tsx scripts/market-model-v2.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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

function olsMulti(X: number[][], y: number[]): { beta: number[]; r2: number; adjR2: number; rmse: number; residuals: number[] } {
  const n = y.length;
  const p = X[0].length;
  const Xa = X.map(row => [1, ...row]);
  const pp = p + 1;

  const XtX: number[][] = Array.from({ length: pp }, () => Array(pp).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < pp; j++)
      for (let k = 0; k < pp; k++)
        XtX[j][k] += Xa[i][j] * Xa[i][k];

  const Xty: number[] = Array(pp).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < pp; j++)
      Xty[j] += Xa[i][j] * y[i];

  const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < pp; col++) {
    let maxRow = col;
    for (let row = col + 1; row < pp; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = col; j <= pp; j++) aug[col][j] /= pivot;
    for (let row = 0; row < pp; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= pp; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  const beta = aug.map(row => row[pp]);

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
  const rmse = Math.sqrt(ssRes / n);
  return { beta, r2, adjR2, rmse, residuals };
}

const CERT_LABEL: Record<number, string> = {
  0: 'None/Reg', 1: 'Kicho', 2: 'TokuKicho', 3: 'Hozon', 4: 'TokuHozon', 5: 'Juyo', 6: 'Tokuju',
};

const ITEM_TYPE_ORD: Record<string, number> = {
  'tanto': 1, 'wakizashi': 2, 'katana': 3, 'tachi': 4,
  'naginata': 3, 'yari': 2, 'ken': 3,
  'menuki': 1, 'kozuka': 2, 'kogai': 2, 'fuchi': 2, 'kashira': 2, 'fuchi-kashira': 3, 'tsuba': 3,
};

// ── Data fetch from market_price_observations ────────────────────

interface Row {
  price_jpy: number;
  log_price: number;
  elite_factor: number;
  toko_taikan: number | null;
  log_tt: number | null;
  hawley: number | null;
  fujishiro_ord: number | null;
  cert_ordinal: number;
  cert_type: string | null;
  item_type: string;
  item_type_ord: number;
  item_category: string;
  artisan_id: string | null;
  source: string;
  was_sold: boolean;
}

async function fetchData(): Promise<Row[]> {
  const PAGE = 1000;
  let all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('market_price_observations')
      .select('*')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return all.map(r => ({
    price_jpy: r.price_jpy as number,
    log_price: Math.log10(r.price_jpy as number),
    elite_factor: (r.elite_factor as number) ?? 0,
    toko_taikan: r.toko_taikan as number | null,
    log_tt: r.toko_taikan ? Math.log10(r.toko_taikan as number) : null,
    hawley: r.hawley as number | null,
    fujishiro_ord: r.fujishiro_ord as number | null,
    cert_ordinal: (r.cert_ordinal as number) ?? 0,
    cert_type: r.cert_type as string | null,
    item_type: (r.item_type as string) || 'unknown',
    item_type_ord: ITEM_TYPE_ORD[(r.item_type as string) || 'unknown'] ?? 0,
    item_category: (r.item_category as string) || 'other',
    artisan_id: r.artisan_id as string | null,
    source: r.source as string,
    was_sold: !!r.was_sold,
  })).filter(r => r.price_jpy >= 5000);
}

// ── Analyses ─────────────────────────────────────────────────────

function heading(title: string) {
  console.log(`\n${'═'.repeat(78)}`);
  console.log(title);
  console.log(`${'─'.repeat(78)}`);
}

function reportModel(label: string, n: number, r2: number, adjR2: number, rmse: number) {
  const factor = 10 ** rmse;
  console.log(`    ${label.padEnd(44)} n=${fmt(n).padStart(5)}  R²=${r2.toFixed(3)}  adjR²=${adjR2.toFixed(3)}  RMSE=${rmse.toFixed(3)} (${factor.toFixed(1)}×)`);
}

function analysisCertLadder(rows: Row[]) {
  heading('1. CERT LADDER — with private sale data');

  for (const cat of ['blade', 'tosogu'] as const) {
    const subset = rows.filter(r => r.item_category === cat);
    if (subset.length < 10) continue;
    console.log(`\n  [${cat.toUpperCase()}] (n=${fmt(subset.length)})`);

    const byCert: Record<number, number[]> = {};
    for (const r of subset) {
      if (!byCert[r.cert_ordinal]) byCert[r.cert_ordinal] = [];
      byCert[r.cert_ordinal].push(r.price_jpy);
    }
    for (const [ord, prices] of Object.entries(byCert).sort((a, b) => +a[0] - +b[0])) {
      if (prices.length < 2) continue;
      const label = CERT_LABEL[+ord] || `Ord ${ord}`;
      console.log(
        `    ${label.padEnd(12)} n=${String(prices.length).padStart(5)}  ` +
        `P25=${fmtK(percentile(prices, 25)).padStart(8)}  Med=${fmtK(median(prices)).padStart(8)}  P75=${fmtK(percentile(prices, 75)).padStart(8)}  Max=${fmtK(Math.max(...prices)).padStart(8)}`
      );
    }
  }
}

function analysisSingleFeature(rows: Row[]) {
  heading('2. SINGLE-FEATURE R² SHOOTOUT');

  for (const cat of ['blade', 'tosogu'] as const) {
    const subset = rows.filter(r => r.item_category === cat);
    console.log(`\n  [${cat.toUpperCase()}] (n=${fmt(subset.length)})`);

    // cert
    const rCert = pearsonR(subset.map(r => r.cert_ordinal), subset.map(r => r.log_price));
    console.log(`    cert_ordinal           n=${fmt(subset.length).padStart(5)}  r=${rCert.toFixed(3)}  R²=${(rCert ** 2).toFixed(3)}`);

    // item_type
    const rItem = pearsonR(subset.map(r => r.item_type_ord), subset.map(r => r.log_price));
    console.log(`    item_type_ord          n=${fmt(subset.length).padStart(5)}  r=${rItem.toFixed(3)}  R²=${(rItem ** 2).toFixed(3)}`);

    // elite_factor >0
    const ef = subset.filter(r => r.elite_factor > 0);
    if (ef.length >= 5) {
      const r = pearsonR(ef.map(r => r.elite_factor), ef.map(r => r.log_price));
      console.log(`    elite_factor (>0)      n=${fmt(ef.length).padStart(5)}  r=${r.toFixed(3)}  R²=${(r ** 2).toFixed(3)}`);
    }

    // log(TT)
    const tt = subset.filter(r => r.log_tt != null);
    if (tt.length >= 5) {
      const r = pearsonR(tt.map(r => r.log_tt!), tt.map(r => r.log_price));
      console.log(`    log₁₀(toko_taikan)     n=${fmt(tt.length).padStart(5)}  r=${r.toFixed(3)}  R²=${(r ** 2).toFixed(3)}`);
    }

    // hawley
    const hw = subset.filter(r => r.hawley != null);
    if (hw.length >= 5) {
      const r = pearsonR(hw.map(r => r.hawley!), hw.map(r => r.log_price));
      console.log(`    hawley                 n=${fmt(hw.length).padStart(5)}  r=${r.toFixed(3)}  R²=${(r ** 2).toFixed(3)}`);
    }

    // fujishiro
    const fj = subset.filter(r => r.fujishiro_ord != null);
    if (fj.length >= 5) {
      const r = pearsonR(fj.map(r => r.fujishiro_ord!), fj.map(r => r.log_price));
      console.log(`    fujishiro_ord          n=${fmt(fj.length).padStart(5)}  r=${r.toFixed(3)}  R²=${(r ** 2).toFixed(3)}`);
    }
  }
}

function analysisModelComparison(rows: Row[]) {
  heading('3. MODEL COMPARISON — Multi-feature OLS on log₁₀(price)');

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);
    console.log(`\n  [${cat.toUpperCase()}]`);
    const allY = base.map(r => r.log_price);

    // M0: cert only
    const m0 = olsMulti(base.map(r => [r.cert_ordinal]), allY);
    reportModel('M0  cert', base.length, m0.r2, m0.adjR2, m0.rmse);

    // M1: cert + item_type
    const m1 = olsMulti(base.map(r => [r.cert_ordinal, r.item_type_ord]), allY);
    reportModel('M1  cert + item_type', base.length, m1.r2, m1.adjR2, m1.rmse);

    // M2: cert + EF
    const efRows = base.filter(r => r.elite_factor > 0);
    if (efRows.length >= 20) {
      const efY = efRows.map(r => r.log_price);
      const m2 = olsMulti(efRows.map(r => [r.cert_ordinal, r.elite_factor]), efY);
      reportModel('M2  cert + EF', efRows.length, m2.r2, m2.adjR2, m2.rmse);

      const m3 = olsMulti(efRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor]), efY);
      reportModel('M3  cert + item + EF', efRows.length, m3.r2, m3.adjR2, m3.rmse);

      const m3i = olsMulti(efRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor]), efY);
      reportModel('M3i cert + item + EF + cert×EF', efRows.length, m3i.r2, m3i.adjR2, m3i.rmse);
    }

    // M4-M5: TT models
    const ttRows = base.filter(r => r.log_tt != null);
    if (ttRows.length >= 20) {
      const ttY = ttRows.map(r => r.log_price);
      const m4 = olsMulti(ttRows.map(r => [r.cert_ordinal, r.log_tt!]), ttY);
      reportModel('M4  cert + log(TT)', ttRows.length, m4.r2, m4.adjR2, m4.rmse);

      const m5 = olsMulti(ttRows.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!]), ttY);
      reportModel('M5  cert + item + log(TT)', ttRows.length, m5.r2, m5.adjR2, m5.rmse);

      const m5i = olsMulti(ttRows.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!]), ttY);
      reportModel('M5i cert + item + log(TT) + cert×TT', ttRows.length, m5i.r2, m5i.adjR2, m5i.rmse);
    }

    // M6-M8: Combined EF + TT
    const bothRows = base.filter(r => r.elite_factor > 0 && r.log_tt != null);
    if (bothRows.length >= 20) {
      const bothY = bothRows.map(r => r.log_price);

      const m6 = olsMulti(bothRows.map(r => [r.cert_ordinal, r.elite_factor, r.log_tt!]), bothY);
      reportModel('M6  cert + EF + log(TT)', bothRows.length, m6.r2, m6.adjR2, m6.rmse);

      const m7 = olsMulti(bothRows.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!]), bothY);
      reportModel('M7  cert + item + EF + log(TT)', bothRows.length, m7.r2, m7.adjR2, m7.rmse);

      const m8 = olsMulti(bothRows.map(r => [
        r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!,
        r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!
      ]), bothY);
      reportModel('M8  full + interactions', bothRows.length, m8.r2, m8.adjR2, m8.rmse);
    }

    // Hawley model
    const hwRows = base.filter(r => r.hawley != null);
    if (hwRows.length >= 20) {
      const hwY = hwRows.map(r => r.log_price);
      const mHw = olsMulti(hwRows.map(r => [r.cert_ordinal, r.item_type_ord, r.hawley!]), hwY);
      reportModel('M-hw cert + item + hawley', hwRows.length, mHw.r2, mHw.adjR2, mHw.rmse);

      // hawley + log(TT)
      const hwTt = base.filter(r => r.hawley != null && r.log_tt != null);
      if (hwTt.length >= 20) {
        const mHwTt = olsMulti(hwTt.map(r => [r.cert_ordinal, r.item_type_ord, r.hawley!, r.log_tt!]), hwTt.map(r => r.log_price));
        reportModel('M-hw+tt cert + item + hawley + log(TT)', hwTt.length, mHwTt.r2, mHwTt.adjR2, mHwTt.rmse);
      }
    }

    // Fujishiro model
    const fjRows = base.filter(r => r.fujishiro_ord != null);
    if (fjRows.length >= 20) {
      const fjY = fjRows.map(r => r.log_price);
      const mFj = olsMulti(fjRows.map(r => [r.cert_ordinal, r.item_type_ord, r.fujishiro_ord!]), fjY);
      reportModel('M-fj cert + item + fujishiro', fjRows.length, mFj.r2, mFj.adjR2, mFj.rmse);
    }

    // Kitchen sink: cert + item + EF + log(TT) + hawley
    const ksRows = base.filter(r => r.elite_factor > 0 && r.log_tt != null && r.hawley != null);
    if (ksRows.length >= 20) {
      const ksY = ksRows.map(r => r.log_price);
      const mKs = olsMulti(ksRows.map(r => [
        r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.hawley!,
        r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!
      ]), ksY);
      reportModel('M-ks cert+item+EF+TT+hw+interactions', ksRows.length, mKs.r2, mKs.adjR2, mKs.rmse);
    }
  }
}

function analysisHeadToHead(rows: Row[]) {
  heading('4. HEAD-TO-HEAD WITHIN CERT TIERS (blades)');

  const blades = rows.filter(r => r.item_category === 'blade');

  for (const certOrd of [0, 3, 4, 5, 6]) {
    const certRows = blades.filter(r => r.cert_ordinal === certOrd);
    if (certRows.length < 5) continue;

    console.log(`\n  ${CERT_LABEL[certOrd]} (n=${certRows.length}):`);

    const ef = certRows.filter(r => r.elite_factor > 0);
    if (ef.length >= 5) {
      const r = pearsonR(ef.map(r => r.elite_factor), ef.map(r => r.log_price));
      console.log(`    elite_factor   n=${String(ef.length).padStart(4)}  r=${r.toFixed(3)}  R²=${(r ** 2).toFixed(3)}`);
    }

    const tt = certRows.filter(r => r.log_tt != null);
    if (tt.length >= 5) {
      const r = pearsonR(tt.map(r => r.log_tt!), tt.map(r => r.log_price));
      console.log(`    log(TT)        n=${String(tt.length).padStart(4)}  r=${r.toFixed(3)}  R²=${(r ** 2).toFixed(3)}`);
    }

    const hw = certRows.filter(r => r.hawley != null);
    if (hw.length >= 5) {
      const r = pearsonR(hw.map(r => r.hawley!), hw.map(r => r.log_price));
      console.log(`    hawley         n=${String(hw.length).padStart(4)}  r=${r.toFixed(3)}  R²=${(r ** 2).toFixed(3)}`);
    }

    const both = certRows.filter(r => r.elite_factor > 0 && r.log_tt != null);
    if (both.length >= 8) {
      const m = olsMulti(both.map(r => [r.elite_factor, r.log_tt!]), both.map(r => r.log_price));
      console.log(`    EF + log(TT)   n=${String(both.length).padStart(4)}  R²=${m.r2.toFixed(3)}  adjR²=${m.adjR2.toFixed(3)}`);
    }
  }
}

function analysisResiduals(rows: Row[]) {
  heading('5. RESIDUAL ANALYSIS — Prediction Accuracy');

  const blades = rows.filter(r => r.item_category === 'blade');

  const configs = [
    { label: 'M1 (cert + item)', filter: (_r: Row) => true, features: (r: Row) => [r.cert_ordinal, r.item_type_ord] },
    { label: 'M3i (cert + item + EF + cert×EF)', filter: (r: Row) => r.elite_factor > 0, features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor] },
    { label: 'M5i (cert + item + log(TT) + cert×TT)', filter: (r: Row) => r.log_tt != null, features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!] },
    { label: 'M8 (full + interactions)', filter: (r: Row) => r.elite_factor > 0 && r.log_tt != null, features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!] },
  ];

  console.log(`\n  [BLADE]`);

  for (const { label, filter, features } of configs) {
    const subset = blades.filter(filter);
    if (subset.length < 20) continue;

    const m = olsMulti(subset.map(features), subset.map(r => r.log_price));
    const absRes = m.residuals.map(Math.abs);
    const medAbsErr = median(absRes);
    const factor = 10 ** medAbsErr;
    const within2x = absRes.filter(r => r <= Math.log10(2)).length;
    const within50pct = absRes.filter(r => r <= Math.log10(1.5)).length;

    console.log(`\n    ${label}`);
    console.log(`      n=${fmt(subset.length)}  adjR²=${m.adjR2.toFixed(3)}  RMSE=${m.rmse.toFixed(3)}`);
    console.log(`      Median abs error: ${medAbsErr.toFixed(3)} (≈${factor.toFixed(1)}× factor → 50% within ${((factor - 1) * 100).toFixed(0)}%)`);
    console.log(`      Within ±50%: ${((within50pct / subset.length) * 100).toFixed(0)}%`);
    console.log(`      Within ±2×:  ${((within2x / subset.length) * 100).toFixed(0)}%`);
  }
}

function analysisBestModelCoefficients(rows: Row[]) {
  heading('6. BEST MODEL COEFFICIENTS');

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);
    console.log(`\n  [${cat.toUpperCase()}]`);

    // Universal model (all listings)
    const m1 = olsMulti(base.map(r => [r.cert_ordinal, r.item_type_ord]), base.map(r => r.log_price));
    console.log(`\n    Model A (universal): log₁₀(P) = ${m1.beta[0].toFixed(3)} + ${m1.beta[1].toFixed(3)}×cert + ${m1.beta[2].toFixed(3)}×item`);
    console.log(`      adjR²=${m1.adjR2.toFixed(3)}, n=${base.length}`);

    // TT-enhanced (best coverage for blades)
    const ttRows = base.filter(r => r.log_tt != null);
    if (ttRows.length >= 20) {
      const m = olsMulti(ttRows.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!]), ttRows.map(r => r.log_price));
      console.log(`\n    Model B (TT-enhanced): log₁₀(P) = ${m.beta[0].toFixed(3)} + ${m.beta[1].toFixed(3)}×cert + ${m.beta[2].toFixed(3)}×item + ${m.beta[3].toFixed(3)}×log(TT) + ${m.beta[4].toFixed(3)}×cert×log(TT)`);
      console.log(`      adjR²=${m.adjR2.toFixed(3)}, n=${ttRows.length}`);

      // Show predictions for sample artisans
      console.log(`      Sample predictions (katana, item_type_ord=3):`);
      for (const certOrd of [3, 4, 5, 6]) {
        for (const tt of [500, 1000, 2000, 3000]) {
          const logTt = Math.log10(tt);
          const pred = 10 ** (m.beta[0] + m.beta[1] * certOrd + m.beta[2] * 3 + m.beta[3] * logTt + m.beta[4] * certOrd * logTt);
          if (certOrd === 3 && tt > 1000) continue; // Unlikely combo
          if (certOrd === 6 && tt < 1000) continue;  // Unlikely combo
          console.log(`        ${CERT_LABEL[certOrd]?.padEnd(10)} TT=${String(tt).padStart(4)} → ${fmtK(pred)}`);
        }
      }
    }

    // Full model (EF + TT)
    const bothRows = base.filter(r => r.elite_factor > 0 && r.log_tt != null);
    if (bothRows.length >= 20) {
      const m = olsMulti(bothRows.map(r => [
        r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!,
        r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!
      ]), bothRows.map(r => r.log_price));
      console.log(`\n    Model C (full): log₁₀(P) = ${m.beta[0].toFixed(3)} + ${m.beta[1].toFixed(3)}×cert + ${m.beta[2].toFixed(3)}×item + ${m.beta[3].toFixed(3)}×EF + ${m.beta[4].toFixed(3)}×log(TT) + ${m.beta[5].toFixed(3)}×cert×EF + ${m.beta[6].toFixed(3)}×cert×log(TT)`);
      console.log(`      adjR²=${m.adjR2.toFixed(3)}, n=${bothRows.length}`);
    }
  }
}

function analysisPrivateImpact(rows: Row[]) {
  heading('7. PRIVATE DATA IMPACT — Before vs After');

  const scraped = rows.filter(r => r.source === 'scraped');
  const all = rows;

  for (const cat of ['blade'] as const) {
    const scrapedCat = scraped.filter(r => r.item_category === cat);
    const allCat = all.filter(r => r.item_category === cat);

    console.log(`\n  [${cat.toUpperCase()}]`);
    console.log(`    Scraped only: n=${fmt(scrapedCat.length)}, max price=${fmtK(Math.max(...scrapedCat.map(r => r.price_jpy)))}`);
    console.log(`    All sources:  n=${fmt(allCat.length)}, max price=${fmtK(Math.max(...allCat.map(r => r.price_jpy)))}`);

    // Compare cert ladder medians
    for (const certOrd of [4, 5, 6]) {
      const sc = scrapedCat.filter(r => r.cert_ordinal === certOrd);
      const al = allCat.filter(r => r.cert_ordinal === certOrd);
      if (sc.length < 2) continue;
      console.log(`    ${CERT_LABEL[certOrd]}: scraped med=${fmtK(median(sc.map(r => r.price_jpy)))} (n=${sc.length}) → all med=${fmtK(median(al.map(r => r.price_jpy)))} (n=${al.length})`);
    }

    // Compare M5i R² before and after
    const ttScraped = scrapedCat.filter(r => r.log_tt != null);
    const ttAll = allCat.filter(r => r.log_tt != null);
    if (ttScraped.length >= 20 && ttAll.length >= 20) {
      const mBefore = olsMulti(ttScraped.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!]), ttScraped.map(r => r.log_price));
      const mAfter = olsMulti(ttAll.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!]), ttAll.map(r => r.log_price));
      console.log(`\n    M5i (cert+item+log(TT)+cert×TT):`);
      console.log(`      Before: adjR²=${mBefore.adjR2.toFixed(3)} RMSE=${mBefore.rmse.toFixed(3)} (n=${ttScraped.length})`);
      console.log(`      After:  adjR²=${mAfter.adjR2.toFixed(3)} RMSE=${mAfter.rmse.toFixed(3)} (n=${ttAll.length})`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║    MARKET PRICE MODEL V2 — With Private Sale Data                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  console.log('\nFetching from market_price_observations...');
  const rows = await fetchData();
  console.log(`Loaded ${fmt(rows.length)} rows (${rows.filter(r => r.source !== 'scraped').length} private)`);
  console.log(`  Blades: ${fmt(rows.filter(r => r.item_category === 'blade').length)}`);
  console.log(`  Tosogu: ${fmt(rows.filter(r => r.item_category === 'tosogu').length)}`);

  analysisCertLadder(rows);
  analysisSingleFeature(rows);
  analysisModelComparison(rows);
  analysisHeadToHead(rows);
  analysisResiduals(rows);
  analysisBestModelCoefficients(rows);
  analysisPrivateImpact(rows);

  console.log(`\n${'═'.repeat(78)}`);
  console.log('MODEL V2 COMPLETE');
  console.log(`${'═'.repeat(78)}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
