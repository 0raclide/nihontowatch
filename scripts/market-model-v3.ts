/**
 * Market Price Model V3 — SOTA Techniques
 *
 * Advances over V2:
 *   1. K-fold cross-validation (honest out-of-sample evaluation)
 *   2. Quantile regression via IRLS (price bands for UI)
 *   3. Huber robust regression (outlier-resilient coefficients)
 *   4. Dealer country fixed effect (JP vs international pricing)
 *   5. Nagasa as feature (blade length → price)
 *   6. Hierarchical artisan shrinkage (Empirical Bayes)
 *   7. WLS with per-cert-tier variance (calibrated intervals)
 *
 * Run: npx tsx scripts/market-model-v3.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number): string { return n.toLocaleString(); }
function fmtK(n: number): string {
  if (n >= 1_000_000_000) return `¥${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `¥${(n / 1_000).toFixed(0)}K`;
  return `¥${n}`;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mad(arr: number[]): number {
  const med = median(arr);
  return median(arr.map(x => Math.abs(x - med)));
}

function percentile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Seeded PRNG (xoshiro128** — deterministic for reproducibility)
function seedRng(seed: number): () => number {
  let s = [seed, seed ^ 0xdeadbeef, seed ^ 0xcafebabe, seed ^ 0x12345678];
  function rotl(x: number, k: number) { return (x << k) | (x >>> (32 - k)); }
  return () => {
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9);
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = rotl(s[3], 11);
    return (result >>> 0) / 4294967296;
  };
}

// ── Linear Algebra ─────────────────────────────────────────────────

interface OlsResult {
  beta: number[];
  r2: number;
  adjR2: number;
  rmse: number;
  residuals: number[];
  predictions: number[];
}

/** OLS via Gauss-Jordan with partial pivoting */
function olsMulti(X: number[][], y: number[], weights?: number[]): OlsResult {
  const n = y.length;
  const p = X[0].length;
  const Xa = X.map(row => [1, ...row]);
  const pp = p + 1;

  // Apply weights if provided (for WLS)
  const w = weights || Array(n).fill(1);

  const XtWX: number[][] = Array.from({ length: pp }, () => Array(pp).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < pp; j++)
      for (let k = 0; k < pp; k++)
        XtWX[j][k] += w[i] * Xa[i][j] * Xa[i][k];

  const XtWy: number[] = Array(pp).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < pp; j++)
      XtWy[j] += w[i] * Xa[i][j] * y[i];

  const aug: number[][] = XtWX.map((row, i) => [...row, XtWy[i]]);
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
  const predictions: number[] = [];
  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let j = 0; j < pp; j++) pred += Xa[i][j] * beta[j];
    predictions.push(pred);
    const res = y[i] - pred;
    residuals.push(res);
    ssRes += res * res;
    ssTot += (y[i] - my) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - p - 1);
  const rmse = Math.sqrt(ssRes / n);
  return { beta, r2, adjR2, rmse, residuals, predictions };
}

/** Predict using beta coefficients */
function predict(beta: number[], x: number[]): number {
  let pred = beta[0]; // intercept
  for (let j = 0; j < x.length; j++) pred += beta[j + 1] * x[j];
  return pred;
}

// ── Huber Robust Regression (IRLS) ─────────────────────────────────

function huberRegression(X: number[][], y: number[], maxIter = 30, tol = 1e-6): OlsResult {
  // Initial OLS
  let result = olsMulti(X, y);

  for (let iter = 0; iter < maxIter; iter++) {
    // Estimate scale via MAD
    const scale = mad(result.residuals) / 0.6745;
    if (scale < 1e-10) break;

    const delta = 1.345 * scale; // 95% asymptotic efficiency at normal

    // Compute Huber weights
    const weights = result.residuals.map(r => {
      const absR = Math.abs(r);
      return absR <= delta ? 1.0 : delta / absR;
    });

    const prev = result.beta;
    result = olsMulti(X, y, weights);

    // Check convergence
    const maxChange = Math.max(...result.beta.map((b, i) => Math.abs(b - prev[i])));
    if (maxChange < tol) break;
  }

  return result;
}

// ── Quantile Regression (IRLS with pinball loss) ───────────────────

function quantileRegression(X: number[][], y: number[], tau: number, maxIter = 50, tol = 1e-6): OlsResult {
  const eps = 1e-6; // smoothing parameter to avoid division by zero

  // Initialize with OLS
  let result = olsMulti(X, y);

  for (let iter = 0; iter < maxIter; iter++) {
    // Compute asymmetric weights (pinball loss → IRLS)
    const weights = result.residuals.map(r => {
      const absR = Math.max(Math.abs(r), eps);
      return r > 0 ? tau / absR : (1 - tau) / absR;
    });

    const prev = result.beta;
    result = olsMulti(X, y, weights);

    // Check convergence
    const maxChange = Math.max(...result.beta.map((b, i) => Math.abs(b - prev[i])));
    if (maxChange < tol) break;
  }

  return result;
}

// ── Data Model ─────────────────────────────────────────────────────

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
  dealer_country: string | null;
  price_currency: string;
  is_jp_dealer: number; // 1 = JPY currency (proxy for JP dealer), 0 = USD/EUR/AUD
  nagasa_cm: number | null;
  log_nagasa: number | null;
  source: string;
  was_sold: boolean;
}

const CERT_LABEL: Record<number, string> = {
  0: 'None/Reg', 1: 'Kicho', 2: 'TokuKicho', 3: 'Hozon', 4: 'TokuHozon', 5: 'Juyo', 6: 'Tokuju',
};

const ITEM_TYPE_ORD: Record<string, number> = {
  'tanto': 1, 'wakizashi': 2, 'katana': 3, 'tachi': 4,
  'naginata': 3, 'yari': 2, 'ken': 3,
  'menuki': 1, 'kozuka': 2, 'kogai': 2, 'fuchi': 2, 'kashira': 2, 'fuchi-kashira': 3, 'tsuba': 3,
};

// ── Data Fetch ─────────────────────────────────────────────────────

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

  return all.map(r => {
    const nagasa = r.nagasa_cm as number | null;
    const country = (r.dealer_country as string) || 'JP';
    return {
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
      dealer_country: country,
      price_currency: (r.price_currency as string) || 'JPY',
      // Use currency as proxy for dealer origin (dealer_country is NULL in observations)
      is_jp_dealer: ((r.price_currency as string) || 'JPY') === 'JPY' ? 1 : 0,
      nagasa_cm: nagasa,
      log_nagasa: nagasa && nagasa > 0 ? Math.log10(nagasa) : null,
      source: r.source as string,
      was_sold: !!r.was_sold,
    };
  }).filter(r => r.price_jpy >= 5000);
}

// ── Cross-Validation Infrastructure ────────────────────────────────

interface CvResult {
  label: string;
  n: number;
  inSampleR2: number;
  inSampleAdjR2: number;
  inSampleRmse: number;
  cvRmse: number;
  cvMae: number;
  cvMedianAE: number;
  within2x: number;   // % of predictions within factor of 2
  within50pct: number; // % within 50%
}

type FeatureExtractor = (r: Row) => number[];
type RowFilter = (r: Row) => boolean;

interface ModelSpec {
  label: string;
  filter: RowFilter;
  features: FeatureExtractor;
  method?: 'ols' | 'huber' | 'wls';
}

function kFoldCv(
  rows: Row[],
  features: FeatureExtractor,
  k: number,
  rng: () => number,
  method: 'ols' | 'huber' | 'wls' = 'ols',
  varianceGroups?: (r: Row) => number // for WLS
): { rmse: number; mae: number; medianAE: number; within2x: number; within50pct: number; residuals: number[] } {
  const indices = shuffle(rows.map((_, i) => i), rng);
  const foldSize = Math.ceil(rows.length / k);
  const allResiduals: number[] = Array(rows.length).fill(0);

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = Math.min(testStart + foldSize, rows.length);
    const testIdx = new Set(indices.slice(testStart, testEnd));

    const trainRows = rows.filter((_, i) => !testIdx.has(i));
    const testRows = rows.filter((_, i) => testIdx.has(i));

    if (trainRows.length < 10 || testRows.length === 0) continue;

    const trainX = trainRows.map(features);
    const trainY = trainRows.map(r => r.log_price);

    let result: OlsResult;
    if (method === 'huber') {
      result = huberRegression(trainX, trainY);
    } else if (method === 'wls' && varianceGroups) {
      // Estimate per-group variance from initial OLS
      const initResult = olsMulti(trainX, trainY);
      const groups: Record<number, number[]> = {};
      for (let i = 0; i < trainRows.length; i++) {
        const g = varianceGroups(trainRows[i]);
        if (!groups[g]) groups[g] = [];
        groups[g].push(initResult.residuals[i] ** 2);
      }
      const groupVar: Record<number, number> = {};
      for (const [g, sqRes] of Object.entries(groups)) {
        groupVar[+g] = sqRes.reduce((a, b) => a + b, 0) / sqRes.length;
      }
      const weights = trainRows.map(r => {
        const v = groupVar[varianceGroups(r)] || 1;
        return 1 / Math.max(v, 0.001);
      });
      result = olsMulti(trainX, trainY, weights);
    } else {
      result = olsMulti(trainX, trainY);
    }

    // Predict on test set
    for (const idx of indices.slice(testStart, testEnd)) {
      const x = features(rows[idx]);
      const pred = predict(result.beta, x);
      allResiduals[idx] = rows[idx].log_price - pred;
    }
  }

  const absRes = allResiduals.map(Math.abs);
  const rmse = Math.sqrt(absRes.reduce((s, r) => s + r * r, 0) / rows.length);
  const mae = absRes.reduce((s, r) => s + r, 0) / rows.length;
  const medianAE = median(absRes);
  const within2x = absRes.filter(r => r <= Math.log10(2)).length / rows.length;
  const within50pct = absRes.filter(r => r <= Math.log10(1.5)).length / rows.length;

  return { rmse, mae, medianAE, within2x, within50pct, residuals: allResiduals };
}

// ── Hierarchical Artisan Shrinkage (Empirical Bayes) ───────────────

function hierarchicalModel(
  rows: Row[],
  features: FeatureExtractor,
  getGroup: (r: Row) => string | null
): { beta: number[]; artisanIntercepts: Map<string, number>; r2: number; adjR2: number; rmse: number } {
  const X = rows.map(features);
  const y = rows.map(r => r.log_price);

  // Step 1: Fit global OLS
  const globalResult = olsMulti(X, y);

  // Step 2: Compute residuals by group
  const groupResiduals: Record<string, number[]> = {};
  for (let i = 0; i < rows.length; i++) {
    const g = getGroup(rows[i]);
    if (g) {
      if (!groupResiduals[g]) groupResiduals[g] = [];
      groupResiduals[g].push(globalResult.residuals[i]);
    }
  }

  // Step 3: Empirical Bayes shrinkage
  // Global residual variance
  const globalVar = globalResult.residuals.reduce((s, r) => s + r * r, 0) / rows.length;

  const artisanIntercepts = new Map<string, number>();
  for (const [group, residuals] of Object.entries(groupResiduals)) {
    const n = residuals.length;
    const groupMean = residuals.reduce((a, b) => a + b, 0) / n;
    const groupVar = n > 1
      ? residuals.reduce((s, r) => s + (r - groupMean) ** 2, 0) / (n - 1)
      : globalVar;

    // Shrinkage factor: how much to trust this group's own data vs global prior
    // λ = σ²_between / (σ²_between + σ²_within/n)
    // Approximate σ²_between from variance of group means
    const shrinkage = n / (n + globalVar / Math.max(groupVar, 0.001));

    artisanIntercepts.set(group, shrinkage * groupMean);
  }

  // Step 4: Compute adjusted predictions and metrics
  const my = y.reduce((a, b) => a + b, 0) / rows.length;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < rows.length; i++) {
    const g = getGroup(rows[i]);
    const adjustment = g ? (artisanIntercepts.get(g) || 0) : 0;
    const pred = globalResult.predictions[i] + adjustment;
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  const effectiveP = X[0].length + artisanIntercepts.size * 0.5; // shrunk parameters count less
  const r2 = 1 - ssRes / ssTot;
  const adjR2 = 1 - (1 - r2) * (rows.length - 1) / (rows.length - effectiveP - 1);
  const rmse = Math.sqrt(ssRes / rows.length);

  return { beta: globalResult.beta, artisanIntercepts, r2, adjR2, rmse };
}

/** K-fold CV for hierarchical model */
function kFoldCvHierarchical(
  rows: Row[],
  features: FeatureExtractor,
  getGroup: (r: Row) => string | null,
  k: number,
  rng: () => number
): { rmse: number; mae: number; medianAE: number; within2x: number; within50pct: number } {
  const indices = shuffle(rows.map((_, i) => i), rng);
  const foldSize = Math.ceil(rows.length / k);
  const allResiduals: number[] = Array(rows.length).fill(0);

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = Math.min(testStart + foldSize, rows.length);
    const testIdx = new Set(indices.slice(testStart, testEnd));

    const trainRows = rows.filter((_, i) => !testIdx.has(i));
    const testRows = rows.filter((_, i) => testIdx.has(i));

    if (trainRows.length < 10 || testRows.length === 0) continue;

    const model = hierarchicalModel(trainRows, features, getGroup);

    for (const idx of indices.slice(testStart, testEnd)) {
      const x = features(rows[idx]);
      const basePred = predict(model.beta, x);
      const g = getGroup(rows[idx]);
      const adjustment = g ? (model.artisanIntercepts.get(g) || 0) : 0;
      allResiduals[idx] = rows[idx].log_price - (basePred + adjustment);
    }
  }

  const absRes = allResiduals.map(Math.abs);
  const rmse = Math.sqrt(absRes.reduce((s, r) => s + r * r, 0) / rows.length);
  const mae = absRes.reduce((s, r) => s + r, 0) / rows.length;
  const medianAE = median(absRes);
  const within2x = absRes.filter(r => r <= Math.log10(2)).length / rows.length;
  const within50pct = absRes.filter(r => r <= Math.log10(1.5)).length / rows.length;

  return { rmse, mae, medianAE, within2x, within50pct };
}

// ── Analysis Sections ──────────────────────────────────────────────

function heading(title: string) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(80)}`);
}

function subheading(title: string) {
  console.log(`\n  ┌─ ${title}`);
}

/**
 * Section 1: Cross-validated model comparison
 * The core improvement over V2 — honest out-of-sample metrics
 */
function sectionCvComparison(rows: Row[]) {
  heading('1. CROSS-VALIDATED MODEL COMPARISON (5-fold, seed=42)');

  const rng = seedRng(42);
  const K = 5;

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);
    subheading(`${cat.toUpperCase()} (n=${fmt(base.length)})`);

    const models: ModelSpec[] = [
      // Baseline (from V2)
      { label: 'M1  cert + item', filter: () => true,
        features: r => [r.cert_ordinal, r.item_type_ord] },

      // +dealer country
      { label: 'M1d cert + item + dealer_country', filter: () => true,
        features: r => [r.cert_ordinal, r.item_type_ord, r.is_jp_dealer] },

      // +nagasa (blades only)
      ...(cat === 'blade' ? [
        { label: 'M1n cert + item + log(nagasa)', filter: (r: Row) => r.log_nagasa != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_nagasa!] },
        { label: 'M1nd cert+item+nagasa+dealer', filter: (r: Row) => r.log_nagasa != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_nagasa!, r.is_jp_dealer] },
      ] : []),

      // EF models
      { label: 'M3i cert+item+EF+cert×EF', filter: r => r.elite_factor > 0,
        features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor] },
      { label: 'M3id +dealer', filter: r => r.elite_factor > 0,
        features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.is_jp_dealer] },

      // TT models (blades only meaningful)
      ...(cat === 'blade' ? [
        { label: 'M5i cert+item+logTT+cert×TT', filter: (r: Row) => r.log_tt != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!] },
        { label: 'M5id +dealer', filter: (r: Row) => r.log_tt != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!, r.is_jp_dealer] },
        { label: 'M5in +nagasa', filter: (r: Row) => r.log_tt != null && r.log_nagasa != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!, r.log_nagasa!] },
        { label: 'M5ind +nagasa+dealer', filter: (r: Row) => r.log_tt != null && r.log_nagasa != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!, r.log_nagasa!, r.is_jp_dealer] },
      ] : []),

      // Full model (EF + TT)
      ...(cat === 'blade' ? [
        { label: 'M8  cert+item+EF+logTT+ixns', filter: (r: Row) => r.elite_factor > 0 && r.log_tt != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!,
            r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!] },
        { label: 'M8d +dealer', filter: (r: Row) => r.elite_factor > 0 && r.log_tt != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!,
            r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!, r.is_jp_dealer] },
        { label: 'M8dn +dealer+nagasa', filter: (r: Row) => r.elite_factor > 0 && r.log_tt != null && r.log_nagasa != null,
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!,
            r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!, r.is_jp_dealer, r.log_nagasa!] },
      ] : []),
    ];

    // Huber variants of key models
    const huberModels: ModelSpec[] = [
      { label: 'M1-H  cert+item [Huber]', filter: () => true, method: 'huber',
        features: r => [r.cert_ordinal, r.item_type_ord] },
      { label: 'M3i-H cert+item+EF+ixn [Huber]', filter: r => r.elite_factor > 0, method: 'huber',
        features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor] },
      ...(cat === 'blade' ? [
        { label: 'M5i-H cert+item+TT+ixn [Huber]', filter: (r: Row) => r.log_tt != null, method: 'huber',
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!] },
        { label: 'M8-H  full+ixns [Huber]', filter: (r: Row) => r.elite_factor > 0 && r.log_tt != null, method: 'huber',
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!,
            r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!] },
      ] : []),
    ];

    // WLS variants
    const wlsModels: ModelSpec[] = [
      { label: 'M1-W  cert+item [WLS by cert]', filter: () => true, method: 'wls',
        features: r => [r.cert_ordinal, r.item_type_ord] },
      ...(cat === 'blade' ? [
        { label: 'M5i-W cert+item+TT+ixn [WLS]', filter: (r: Row) => r.log_tt != null, method: 'wls',
          features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!] },
      ] : []),
    ];

    const allModels = [...models, ...huberModels, ...wlsModels];

    // Table header
    console.log(`  ${'Model'.padEnd(40)} ${'n'.padStart(5)} ${'inR²'.padStart(6)} ${'cvRMSE'.padStart(7)} ${'cvMAE'.padStart(6)} ${'cvMdAE'.padStart(7)} ${'<2×'.padStart(5)} ${'<50%'.padStart(5)}`);
    console.log(`  ${'─'.repeat(40)} ${'─'.repeat(5)} ${'─'.repeat(6)} ${'─'.repeat(7)} ${'─'.repeat(6)} ${'─'.repeat(7)} ${'─'.repeat(5)} ${'─'.repeat(5)}`);

    for (const spec of allModels) {
      const subset = base.filter(spec.filter);
      if (subset.length < 30) continue;

      // In-sample metrics
      const inSample = spec.method === 'huber'
        ? huberRegression(subset.map(spec.features), subset.map(r => r.log_price))
        : olsMulti(subset.map(spec.features), subset.map(r => r.log_price));

      // Cross-validated metrics
      const cv = kFoldCv(
        subset, spec.features, K, rng,
        (spec.method as 'ols' | 'huber' | 'wls') || 'ols',
        spec.method === 'wls' ? (r => r.cert_ordinal) : undefined
      );

      console.log(
        `  ${spec.label.padEnd(40)} ${fmt(subset.length).padStart(5)} ` +
        `${inSample.adjR2.toFixed(3).padStart(6)} ` +
        `${cv.rmse.toFixed(3).padStart(7)} ` +
        `${cv.mae.toFixed(3).padStart(6)} ` +
        `${cv.medianAE.toFixed(3).padStart(7)} ` +
        `${(cv.within2x * 100).toFixed(0).padStart(4)}% ` +
        `${(cv.within50pct * 100).toFixed(0).padStart(4)}%`
      );
    }
  }
}

/**
 * Section 2: Huber vs OLS comparison (informational only)
 *
 * Huber was REJECTED for production use because it downweights the 20
 * private sale observations — which are ground-truth confirmed transactions.
 * This section is kept for reference to show the coefficient distortion.
 */
function sectionHuberComparison(rows: Row[]) {
  heading('2. HUBER vs OLS — Coefficient Comparison (Huber rejected for production)');

  const blades = rows.filter(r => r.item_category === 'blade');

  const configs = [
    { label: 'M1 (cert + item)', filter: (_r: Row) => true,
      features: (r: Row) => [r.cert_ordinal, r.item_type_ord],
      names: ['intercept', 'cert', 'item'] },
    { label: 'M5i (cert+item+logTT+cert×TT)', filter: (r: Row) => r.log_tt != null,
      features: (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!],
      names: ['intercept', 'cert', 'item', 'log(TT)', 'cert×log(TT)'] },
  ];

  for (const { label, filter, features, names } of configs) {
    const subset = blades.filter(filter);
    if (subset.length < 20) continue;

    const X = subset.map(features);
    const y = subset.map(r => r.log_price);

    const ols = olsMulti(X, y);
    const huber = huberRegression(X, y);

    subheading(`${label} (n=${fmt(subset.length)})`);
    console.log(`  ${'Coeff'.padEnd(14)} ${'OLS'.padStart(10)} ${'Huber'.padStart(10)} ${'Δ%'.padStart(8)}`);
    for (let i = 0; i < names.length; i++) {
      const pctChange = ols.beta[i] !== 0 ? ((huber.beta[i] - ols.beta[i]) / Math.abs(ols.beta[i]) * 100) : 0;
      console.log(`  ${names[i].padEnd(14)} ${ols.beta[i].toFixed(4).padStart(10)} ${huber.beta[i].toFixed(4).padStart(10)} ${pctChange.toFixed(1).padStart(7)}%`);
    }
    console.log(`  ${'RMSE'.padEnd(14)} ${ols.rmse.toFixed(4).padStart(10)} ${huber.rmse.toFixed(4).padStart(10)}`);
    console.log(`  ${'adjR²'.padEnd(14)} ${ols.adjR2.toFixed(4).padStart(10)} ${huber.adjR2.toFixed(4).padStart(10)}`);
  }
}

/**
 * Section 3: Quantile regression — price bands
 * THE product feature: predict P10, P25, P50, P75, P90
 */
function sectionQuantileRegression(rows: Row[]) {
  heading('3. QUANTILE REGRESSION — Price Bands');

  const blades = rows.filter(r => r.item_category === 'blade');
  const taus = [0.10, 0.25, 0.50, 0.75, 0.90];

  // Fit quantile models for M5i (best coverage + good accuracy)
  const ttBlades = blades.filter(r => r.log_tt != null);
  if (ttBlades.length < 30) {
    console.log('  Insufficient TT data for blades.');
    return;
  }

  const featuresFn = (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!];
  const X = ttBlades.map(featuresFn);
  const y = ttBlades.map(r => r.log_price);

  subheading(`M5i Quantile Regression (n=${fmt(ttBlades.length)})`);

  // Fit each quantile
  const qModels: { tau: number; result: OlsResult }[] = [];
  for (const tau of taus) {
    const result = quantileRegression(X, y, tau);
    qModels.push({ tau, result });
  }

  // Show coefficients at each quantile
  const names = ['intercept', 'cert', 'item', 'log(TT)', 'cert×log(TT)'];
  console.log(`\n  Coefficients by quantile:`);
  console.log(`  ${'Coeff'.padEnd(14)} ${taus.map(t => `τ=${t.toFixed(2)}`.padStart(10)).join(' ')}`);
  console.log(`  ${'─'.repeat(14)} ${taus.map(() => '─'.repeat(10)).join(' ')}`);

  for (let i = 0; i < names.length; i++) {
    console.log(`  ${names[i].padEnd(14)} ${qModels.map(q => q.result.beta[i].toFixed(4).padStart(10)).join(' ')}`);
  }

  // Sample predictions — show the price fan
  console.log(`\n  Sample Price Bands (katana, item_type_ord=3):`);
  console.log(`  ${'Cert'.padEnd(10)} ${'TT'.padStart(5)} ${taus.map(t => `P${(t * 100).toFixed(0)}`.padStart(10)).join(' ')}   ${'Band Width'.padStart(12)}`);
  console.log(`  ${'─'.repeat(10)} ${'─'.repeat(5)} ${taus.map(() => '─'.repeat(10)).join(' ')}   ${'─'.repeat(12)}`);

  const scenarios: { cert: number; certLabel: string; tt: number }[] = [
    { cert: 3, certLabel: 'Hozon', tt: 500 },
    { cert: 3, certLabel: 'Hozon', tt: 1000 },
    { cert: 4, certLabel: 'TokuHozon', tt: 500 },
    { cert: 4, certLabel: 'TokuHozon', tt: 1500 },
    { cert: 4, certLabel: 'TokuHozon', tt: 2500 },
    { cert: 5, certLabel: 'Juyo', tt: 1000 },
    { cert: 5, certLabel: 'Juyo', tt: 2000 },
    { cert: 5, certLabel: 'Juyo', tt: 3000 },
    { cert: 6, certLabel: 'Tokuju', tt: 2000 },
    { cert: 6, certLabel: 'Tokuju', tt: 3000 },
  ];

  for (const s of scenarios) {
    const logTt = Math.log10(s.tt);
    const x = [s.cert, 3, logTt, s.cert * logTt];
    const preds = qModels.map(q => 10 ** predict(q.result.beta, x));
    const bandWidth = preds[4] / preds[0]; // P90/P10 ratio

    console.log(
      `  ${s.certLabel.padEnd(10)} ${String(s.tt).padStart(5)} ` +
      `${preds.map(p => fmtK(p).padStart(10)).join(' ')}   ` +
      `${bandWidth.toFixed(1).padStart(11)}×`
    );
  }

  // Also fit quantiles for the universal model (M1)
  subheading(`M1 Quantile Regression — Universal (n=${fmt(blades.length)})`);
  const X1 = blades.map(r => [r.cert_ordinal, r.item_type_ord]);
  const y1 = blades.map(r => r.log_price);

  console.log(`\n  Price Bands by Cert × Type (katana):`);
  console.log(`  ${'Cert'.padEnd(10)} ${taus.map(t => `P${(t * 100).toFixed(0)}`.padStart(10)).join(' ')}   ${'Band'.padStart(8)}`);
  console.log(`  ${'─'.repeat(10)} ${taus.map(() => '─'.repeat(10)).join(' ')}   ${'─'.repeat(8)}`);

  const q1Models = taus.map(tau => ({ tau, result: quantileRegression(X1, y1, tau) }));

  for (const certOrd of [0, 3, 4, 5, 6]) {
    const x = [certOrd, 3]; // katana
    const preds = q1Models.map(q => 10 ** predict(q.result.beta, x));
    const bandWidth = preds[4] / preds[0];

    console.log(
      `  ${(CERT_LABEL[certOrd] || 'Unk').padEnd(10)} ` +
      `${preds.map(p => fmtK(p).padStart(10)).join(' ')}   ` +
      `${bandWidth.toFixed(1).padStart(7)}×`
    );
  }

  // Tosogu quantile bands
  const tosogu = rows.filter(r => r.item_category === 'tosogu');
  if (tosogu.length >= 30) {
    subheading(`M1 Quantile Regression — Tosogu (n=${fmt(tosogu.length)})`);
    const Xt = tosogu.map(r => [r.cert_ordinal, r.item_type_ord]);
    const yt = tosogu.map(r => r.log_price);
    const qtModels = taus.map(tau => ({ tau, result: quantileRegression(Xt, yt, tau) }));

    console.log(`\n  Price Bands by Cert (tsuba):`);
    console.log(`  ${'Cert'.padEnd(10)} ${taus.map(t => `P${(t * 100).toFixed(0)}`.padStart(10)).join(' ')}   ${'Band'.padStart(8)}`);
    console.log(`  ${'─'.repeat(10)} ${taus.map(() => '─'.repeat(10)).join(' ')}   ${'─'.repeat(8)}`);

    for (const certOrd of [0, 3, 4, 5]) {
      const x = [certOrd, 3]; // tsuba
      const preds = qtModels.map(q => 10 ** predict(q.result.beta, x));
      const bandWidth = preds[4] / preds[0];

      console.log(
        `  ${(CERT_LABEL[certOrd] || 'Unk').padEnd(10)} ` +
        `${preds.map(p => fmtK(p).padStart(10)).join(' ')}   ` +
        `${bandWidth.toFixed(1).padStart(7)}×`
      );
    }
  }
}

/**
 * Section 4: Dealer country effect
 */
function sectionDealerEffect(rows: Row[]) {
  heading('4. DEALER COUNTRY EFFECT (JP vs International)');

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);
    const jp = base.filter(r => r.is_jp_dealer === 1);
    const intl = base.filter(r => r.is_jp_dealer === 0);

    if (jp.length < 10 || intl.length < 10) continue;

    subheading(`${cat.toUpperCase()} — JP: n=${fmt(jp.length)}, Intl: n=${fmt(intl.length)}`);

    // Compare medians by cert tier
    console.log(`  ${'Cert'.padEnd(12)} ${'JP Med'.padStart(10)} ${'Intl Med'.padStart(10)} ${'Δ%'.padStart(8)} ${'JP n'.padStart(5)} ${'Intl n'.padStart(6)}`);
    for (const certOrd of [0, 3, 4, 5]) {
      const jpCert = jp.filter(r => r.cert_ordinal === certOrd);
      const intlCert = intl.filter(r => r.cert_ordinal === certOrd);
      if (jpCert.length < 3 || intlCert.length < 3) continue;

      const jpMed = median(jpCert.map(r => r.price_jpy));
      const intlMed = median(intlCert.map(r => r.price_jpy));
      const delta = ((intlMed / jpMed) - 1) * 100;

      console.log(
        `  ${(CERT_LABEL[certOrd] || 'Unk').padEnd(12)} ` +
        `${fmtK(jpMed).padStart(10)} ${fmtK(intlMed).padStart(10)} ` +
        `${(delta > 0 ? '+' : '') + delta.toFixed(0) + '%'}`.padStart(8) +
        ` ${String(jpCert.length).padStart(5)} ${String(intlCert.length).padStart(6)}`
      );
    }

    // OLS coefficient for dealer_country
    const X = base.map(r => [r.cert_ordinal, r.item_type_ord, r.is_jp_dealer]);
    const y = base.map(r => r.log_price);
    const result = olsMulti(X, y);
    const jpEffect = result.beta[3]; // coefficient on is_jp_dealer
    const jpMultiplier = 10 ** jpEffect;
    console.log(`\n  OLS JP dealer coefficient: ${jpEffect.toFixed(4)} (×${jpMultiplier.toFixed(2)} multiplier)`);
    console.log(`  Interpretation: JP dealers price ${jpEffect > 0 ? 'higher' : 'lower'} by ~${Math.abs((jpMultiplier - 1) * 100).toFixed(0)}% vs international`);
  }
}

/**
 * Section 5: Nagasa effect (blades only)
 */
function sectionNagasaEffect(rows: Row[]) {
  heading('5. NAGASA (BLADE LENGTH) EFFECT');

  const blades = rows.filter(r => r.item_category === 'blade' && r.log_nagasa != null);
  if (blades.length < 30) {
    console.log('  Insufficient nagasa data.');
    return;
  }

  subheading(`Blades with nagasa (n=${fmt(blades.length)})`);

  // Marginal R² of nagasa
  const r = (() => {
    const xs = blades.map(r => r.log_nagasa!);
    const ys = blades.map(r => r.log_price);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    return num / Math.sqrt(dx2 * dy2);
  })();
  console.log(`  Marginal correlation (log(nagasa) vs log(price)): r=${r.toFixed(3)}, R²=${(r ** 2).toFixed(3)}`);

  // Within cert tier
  for (const certOrd of [0, 3, 4, 5]) {
    const certBlades = blades.filter(r => r.cert_ordinal === certOrd);
    if (certBlades.length < 10) continue;
    const xs = certBlades.map(r => r.log_nagasa!);
    const ys = certBlades.map(r => r.log_price);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    const rCert = dx2 * dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
    console.log(`    within ${CERT_LABEL[certOrd]?.padEnd(10)}: r=${rCert.toFixed(3)} (n=${certBlades.length})`);
  }

  // Incremental R² when adding nagasa to M5i
  const ttNagasa = blades.filter(r => r.log_tt != null);
  if (ttNagasa.length >= 30) {
    const y = ttNagasa.map(r => r.log_price);
    const m5i = olsMulti(ttNagasa.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!]), y);
    const m5in = olsMulti(ttNagasa.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!, r.log_nagasa!]), y);
    console.log(`\n  Incremental R² from nagasa (M5i → M5in):`);
    console.log(`    Without nagasa: adjR²=${m5i.adjR2.toFixed(4)} (n=${ttNagasa.length})`);
    console.log(`    With nagasa:    adjR²=${m5in.adjR2.toFixed(4)} (Δ=${(m5in.adjR2 - m5i.adjR2).toFixed(4)})`);
  }
}

/**
 * Section 6: Hierarchical artisan shrinkage
 */
function sectionHierarchical(rows: Row[]) {
  heading('6. HIERARCHICAL ARTISAN SHRINKAGE (Empirical Bayes)');

  const rng = seedRng(42);
  const K = 5;

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);
    // Need artisan_id for grouping
    const withArtisan = base.filter(r => r.artisan_id != null);
    const uniqueArtisans = new Set(withArtisan.map(r => r.artisan_id));

    if (withArtisan.length < 50) continue;

    subheading(`${cat.toUpperCase()} — ${fmt(withArtisan.length)} rows, ${uniqueArtisans.size} artisans`);

    // Group stats
    const groupSizes: number[] = [];
    const groupMap: Record<string, number> = {};
    for (const r of withArtisan) {
      groupMap[r.artisan_id!] = (groupMap[r.artisan_id!] || 0) + 1;
    }
    for (const count of Object.values(groupMap)) groupSizes.push(count);
    console.log(`  Artisan group sizes: min=${Math.min(...groupSizes)}, median=${median(groupSizes).toFixed(0)}, max=${Math.max(...groupSizes)}`);
    console.log(`  Groups with 1 item: ${groupSizes.filter(n => n === 1).length} (${(groupSizes.filter(n => n === 1).length / groupSizes.length * 100).toFixed(0)}%)`);
    console.log(`  Groups with ≥5 items: ${groupSizes.filter(n => n >= 5).length}`);

    // Compare: flat OLS vs hierarchical, using all data with artisan
    const features = (r: Row) => [r.cert_ordinal, r.item_type_ord];
    const getGroup = (r: Row) => r.artisan_id;

    // In-sample comparison
    const flat = olsMulti(withArtisan.map(features), withArtisan.map(r => r.log_price));
    const hier = hierarchicalModel(withArtisan, features, getGroup);

    console.log(`\n  In-sample comparison (cert + item features):`);
    console.log(`    Flat OLS:    adjR²=${flat.adjR2.toFixed(4)}, RMSE=${flat.rmse.toFixed(4)}`);
    console.log(`    Hierarchical: R²=${hier.r2.toFixed(4)}, RMSE=${hier.rmse.toFixed(4)} (${hier.artisanIntercepts.size} artisan intercepts)`);

    // Show top/bottom artisan intercepts
    const sorted = [...hier.artisanIntercepts.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`\n  Top 5 artisan premiums (positive intercept = priced above model):`);
    for (const [id, intercept] of sorted.slice(0, 5)) {
      const mult = 10 ** intercept;
      const n = groupMap[id] || 0;
      console.log(`    ${id.padEnd(12)} intercept=${intercept.toFixed(3)} (×${mult.toFixed(2)}) n=${n}`);
    }
    console.log(`  Bottom 5 (priced below model):`);
    for (const [id, intercept] of sorted.slice(-5)) {
      const mult = 10 ** intercept;
      const n = groupMap[id] || 0;
      console.log(`    ${id.padEnd(12)} intercept=${intercept.toFixed(3)} (×${mult.toFixed(2)}) n=${n}`);
    }

    // Cross-validated comparison
    console.log(`\n  Cross-validated comparison (5-fold):`);
    const cvFlat = kFoldCv(withArtisan, features, K, rng);
    const cvHier = kFoldCvHierarchical(withArtisan, features, getGroup, K, rng);
    console.log(`    Flat OLS:     cvRMSE=${cvFlat.rmse.toFixed(4)}, cvMAE=${cvFlat.mae.toFixed(4)}, <2×=${(cvFlat.within2x * 100).toFixed(0)}%`);
    console.log(`    Hierarchical: cvRMSE=${cvHier.rmse.toFixed(4)}, cvMAE=${cvHier.mae.toFixed(4)}, <2×=${(cvHier.within2x * 100).toFixed(0)}%`);

    // Also try with richer features where available
    if (cat === 'blade') {
      const withTT = withArtisan.filter(r => r.log_tt != null);
      if (withTT.length >= 50) {
        const richFeatures = (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!];
        const flatRich = olsMulti(withTT.map(richFeatures), withTT.map(r => r.log_price));
        const hierRich = hierarchicalModel(withTT, richFeatures, getGroup);

        console.log(`\n  With TT features (n=${fmt(withTT.length)}):`);
        console.log(`    Flat OLS:    adjR²=${flatRich.adjR2.toFixed(4)}, RMSE=${flatRich.rmse.toFixed(4)}`);
        console.log(`    Hierarchical: R²=${hierRich.r2.toFixed(4)}, RMSE=${hierRich.rmse.toFixed(4)}`);

        const cvFlatR = kFoldCv(withTT, richFeatures, K, rng);
        const cvHierR = kFoldCvHierarchical(withTT, richFeatures, getGroup, K, rng);
        console.log(`    CV Flat:      cvRMSE=${cvFlatR.rmse.toFixed(4)}, <2×=${(cvFlatR.within2x * 100).toFixed(0)}%`);
        console.log(`    CV Hier:      cvRMSE=${cvHierR.rmse.toFixed(4)}, <2×=${(cvHierR.within2x * 100).toFixed(0)}%`);
      }
    }
  }
}

/**
 * Section 7: Per-tier variance analysis (for calibrated intervals)
 */
function sectionVarianceAnalysis(rows: Row[]) {
  heading('7. PER-CERT-TIER VARIANCE (Heteroscedasticity Analysis)');

  for (const cat of ['blade', 'tosogu'] as const) {
    const base = rows.filter(r => r.item_category === cat);
    if (base.length < 30) continue;

    subheading(`${cat.toUpperCase()} (n=${fmt(base.length)})`);

    // Fit base model
    const X = base.map(r => [r.cert_ordinal, r.item_type_ord]);
    const y = base.map(r => r.log_price);
    const result = olsMulti(X, y);

    // Compute residual variance by cert tier
    console.log(`  ${'Cert'.padEnd(12)} ${'n'.padStart(5)} ${'σ²(resid)'.padStart(10)} ${'σ(resid)'.padStart(9)} ${'95% band'.padStart(12)} ${'Coverage'.padStart(9)}`);
    console.log(`  ${'─'.repeat(12)} ${'─'.repeat(5)} ${'─'.repeat(10)} ${'─'.repeat(9)} ${'─'.repeat(12)} ${'─'.repeat(9)}`);

    for (const certOrd of [0, 1, 2, 3, 4, 5, 6]) {
      const certIdx: number[] = [];
      for (let i = 0; i < base.length; i++) {
        if (base[i].cert_ordinal === certOrd) certIdx.push(i);
      }
      if (certIdx.length < 3) continue;

      const certResiduals = certIdx.map(i => result.residuals[i]);
      const variance = certResiduals.reduce((s, r) => s + r * r, 0) / certResiduals.length;
      const sd = Math.sqrt(variance);

      // Check coverage of ±1.96σ interval
      const covered = certResiduals.filter(r => Math.abs(r) <= 1.96 * sd).length;
      const coverage = covered / certIdx.length;

      // Express band as price multiplier
      const bandFactor = 10 ** (1.96 * sd);

      console.log(
        `  ${(CERT_LABEL[certOrd] || `Ord ${certOrd}`).padEnd(12)} ` +
        `${String(certIdx.length).padStart(5)} ` +
        `${variance.toFixed(4).padStart(10)} ` +
        `${sd.toFixed(4).padStart(9)} ` +
        `${('÷' + bandFactor.toFixed(1) + '–×' + bandFactor.toFixed(1)).padStart(12)} ` +
        `${(coverage * 100).toFixed(0).padStart(8)}%`
      );
    }

    // Overall vs per-tier variance ratio
    const globalVar = result.residuals.reduce((s, r) => s + r * r, 0) / base.length;

    // Breusch-Pagan-like test (informal)
    const certTierVars: Record<number, number> = {};
    for (const certOrd of [0, 3, 4, 5, 6]) {
      const certRes = [];
      for (let i = 0; i < base.length; i++) {
        if (base[i].cert_ordinal === certOrd) certRes.push(result.residuals[i]);
      }
      if (certRes.length >= 3) {
        certTierVars[certOrd] = certRes.reduce((s, r) => s + r * r, 0) / certRes.length;
      }
    }

    const varValues = Object.values(certTierVars);
    const varRange = Math.max(...varValues) / Math.min(...varValues);
    console.log(`\n  Global σ²: ${globalVar.toFixed(4)}`);
    console.log(`  Variance ratio (max/min across cert tiers): ${varRange.toFixed(1)}×`);
    console.log(`  ${varRange > 3 ? '⚠ Strong heteroscedasticity — WLS or quantile regression recommended' : '✓ Mild heteroscedasticity'}`);
  }
}

/**
 * Section 8: Asking vs Sold price comparison
 */
function sectionAskingVsSold(rows: Row[]) {
  heading('8. ASKING vs SOLD PRICE ANALYSIS');

  const sold = rows.filter(r => r.was_sold);
  const asking = rows.filter(r => !r.was_sold);

  console.log(`  Asking prices: ${fmt(asking.length)}`);
  console.log(`  Sold prices:   ${fmt(sold.length)}`);

  if (sold.length < 20) {
    console.log('  ⚠ Insufficient sold data for reliable comparison.');
    console.log('  Note: 20 private observations are marked as sold.');
  }

  for (const cat of ['blade', 'tosogu'] as const) {
    const catSold = sold.filter(r => r.item_category === cat);
    const catAsking = asking.filter(r => r.item_category === cat);

    if (catSold.length < 5) continue;

    subheading(`${cat.toUpperCase()} — Sold: ${fmt(catSold.length)}, Asking: ${fmt(catAsking.length)}`);

    // Compare distributions
    console.log(`  Sold prices:   P25=${fmtK(percentile(catSold.map(r => r.price_jpy), 25))}, Med=${fmtK(median(catSold.map(r => r.price_jpy)))}, P75=${fmtK(percentile(catSold.map(r => r.price_jpy), 75))}`);
    console.log(`  Asking prices: P25=${fmtK(percentile(catAsking.map(r => r.price_jpy), 25))}, Med=${fmtK(median(catAsking.map(r => r.price_jpy)))}, P75=${fmtK(percentile(catAsking.map(r => r.price_jpy), 75))}`);

    // Same cert tier comparison
    for (const certOrd of [3, 4, 5]) {
      const certSold = catSold.filter(r => r.cert_ordinal === certOrd);
      const certAsking = catAsking.filter(r => r.cert_ordinal === certOrd);
      if (certSold.length < 3 || certAsking.length < 3) continue;

      const soldMed = median(certSold.map(r => r.price_jpy));
      const askMed = median(certAsking.map(r => r.price_jpy));
      const ratio = soldMed / askMed;
      console.log(`    ${CERT_LABEL[certOrd]}: sold/asking ratio = ${ratio.toFixed(2)} (sold med=${fmtK(soldMed)}, asking med=${fmtK(askMed)}, sold n=${certSold.length})`);
    }
  }
}

/**
 * Section 9: Best model coefficients for implementation
 *
 * Uses OLS (NOT Huber). The 20 private sale observations are ground-truth
 * confirmed transactions — the most reliable data in the set. Huber
 * downweights them as "outliers", suppressing the model's ability to
 * predict high-end prices correctly. The scraped asking prices are the
 * noisy ones (inflated, never negotiated).
 */
function sectionBestModelOutput(rows: Row[]) {
  heading('9. BEST MODEL COEFFICIENTS — OLS (for implementation)');
  console.log('  NOTE: Using OLS, not Huber. Private observations are ground-truth.');
  console.log('  Huber downweights them, suppressing high-end accuracy.\n');

  const blades = rows.filter(r => r.item_category === 'blade');
  const tosogu = rows.filter(r => r.item_category === 'tosogu');

  // Tier 1 — Universal (cert + item + dealer_country)
  subheading('Tier 1 — Universal');
  for (const [cat, subset] of [['blade', blades], ['tosogu', tosogu]] as const) {
    const X = subset.map(r => [r.cert_ordinal, r.item_type_ord, r.is_jp_dealer]);
    const y = subset.map(r => r.log_price);
    const result = olsMulti(X, y);

    console.log(`\n  [${cat.toUpperCase()}] (n=${fmt(subset.length)})`);
    console.log(`  OLS: log₁₀(P) = ${result.beta[0].toFixed(4)} + ${result.beta[1].toFixed(4)}×cert + ${result.beta[2].toFixed(4)}×item + ${result.beta[3].toFixed(4)}×jp_dealer`);
    console.log(`       adjR²=${result.adjR2.toFixed(4)}, RMSE=${result.rmse.toFixed(4)}`);
  }

  // Tier 1N — Nagasa-Enhanced (blades)
  subheading('Tier 1N — Nagasa-Enhanced (blades)');
  const nagasaBlades = blades.filter(r => r.log_nagasa != null);
  if (nagasaBlades.length >= 30) {
    const X = nagasaBlades.map(r => [r.cert_ordinal, r.item_type_ord, r.log_nagasa!, r.is_jp_dealer]);
    const y = nagasaBlades.map(r => r.log_price);
    const result = olsMulti(X, y);

    console.log(`  [BLADE] (n=${fmt(nagasaBlades.length)})`);
    console.log(`  OLS: log₁₀(P) = ${result.beta[0].toFixed(4)} + ${result.beta[1].toFixed(4)}×cert + ${result.beta[2].toFixed(4)}×item + ${result.beta[3].toFixed(4)}×log(nagasa) + ${result.beta[4].toFixed(4)}×jp_dealer`);
    console.log(`       adjR²=${result.adjR2.toFixed(4)}, RMSE=${result.rmse.toFixed(4)}`);
  }

  // Tier 2 — TT-Enhanced (blades)
  subheading('Tier 2 — TT-Enhanced (blades)');
  const ttBlades = blades.filter(r => r.log_tt != null);
  if (ttBlades.length >= 30) {
    const X = ttBlades.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!, r.is_jp_dealer]);
    const y = ttBlades.map(r => r.log_price);
    const result = olsMulti(X, y);

    console.log(`  [BLADE] (n=${fmt(ttBlades.length)})`);
    console.log(`  OLS: log₁₀(P) = ${result.beta[0].toFixed(4)} + ${result.beta[1].toFixed(4)}×cert + ${result.beta[2].toFixed(4)}×item + ${result.beta[3].toFixed(4)}×log(TT) + ${result.beta[4].toFixed(4)}×cert×log(TT) + ${result.beta[5].toFixed(4)}×jp_dealer`);
    console.log(`       adjR²=${result.adjR2.toFixed(4)}, RMSE=${result.rmse.toFixed(4)}`);
  }

  // Tier 2N — TT + Nagasa (CV winner)
  subheading('Tier 2N — TT + Nagasa (CV winner)');
  const ttNagasaBlades = blades.filter(r => r.log_tt != null && r.log_nagasa != null);
  if (ttNagasaBlades.length >= 30) {
    const X = ttNagasaBlades.map(r => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!, r.log_nagasa!, r.is_jp_dealer]);
    const y = ttNagasaBlades.map(r => r.log_price);
    const result = olsMulti(X, y);

    console.log(`  [BLADE] (n=${fmt(ttNagasaBlades.length)})`);
    console.log(`  OLS: log₁₀(P) = ${result.beta[0].toFixed(4)} + ${result.beta[1].toFixed(4)}×cert + ${result.beta[2].toFixed(4)}×item + ${result.beta[3].toFixed(4)}×log(TT) + ${result.beta[4].toFixed(4)}×cert×log(TT) + ${result.beta[5].toFixed(4)}×log(nagasa) + ${result.beta[6].toFixed(4)}×jp_dealer`);
    console.log(`       adjR²=${result.adjR2.toFixed(4)}, RMSE=${result.rmse.toFixed(4)}`);
  }

  // Tier 3 — Full Model (blades with EF + TT)
  subheading('Tier 3 — Full Model (blades)');
  const bothBlades = blades.filter(r => r.elite_factor > 0 && r.log_tt != null);
  if (bothBlades.length >= 30) {
    const X = bothBlades.map(r => [
      r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!,
      r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!, r.is_jp_dealer
    ]);
    const y = bothBlades.map(r => r.log_price);
    const result = olsMulti(X, y);

    console.log(`  [BLADE] (n=${fmt(bothBlades.length)})`);
    console.log(`  OLS: log₁₀(P) = ${result.beta[0].toFixed(4)} + ${result.beta[1].toFixed(4)}×cert + ${result.beta[2].toFixed(4)}×item + ${result.beta[3].toFixed(4)}×EF + ${result.beta[4].toFixed(4)}×log(TT) + ${result.beta[5].toFixed(4)}×cert×EF + ${result.beta[6].toFixed(4)}×cert×log(TT) + ${result.beta[7].toFixed(4)}×jp_dealer`);
    console.log(`       adjR²=${result.adjR2.toFixed(4)}, RMSE=${result.rmse.toFixed(4)}`);
  }

  // Tier 4 — EF-Only (tosogu / blades without TT)
  subheading('Tier 4 — EF-Only');
  for (const [cat, subset] of [['blade', blades], ['tosogu', tosogu]] as const) {
    const ef = subset.filter(r => r.elite_factor > 0);
    if (ef.length < 20) continue;
    const X = ef.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.is_jp_dealer]);
    const y = ef.map(r => r.log_price);
    const result = olsMulti(X, y);

    console.log(`  [${cat.toUpperCase()}] (n=${fmt(ef.length)})`);
    console.log(`  OLS: log₁₀(P) = ${result.beta[0].toFixed(4)} + ${result.beta[1].toFixed(4)}×cert + ${result.beta[2].toFixed(4)}×item + ${result.beta[3].toFixed(4)}×EF + ${result.beta[4].toFixed(4)}×cert×EF + ${result.beta[5].toFixed(4)}×jp_dealer`);
    console.log(`       adjR²=${result.adjR2.toFixed(4)}, RMSE=${result.rmse.toFixed(4)}`);
  }
}

/**
 * Section 10: Quantile prediction examples with full fan
 */
function sectionPredictionExamples(rows: Row[]) {
  heading('10. SAMPLE PREDICTIONS WITH QUANTILE FAN');

  const blades = rows.filter(r => r.item_category === 'blade');
  const taus = [0.10, 0.25, 0.50, 0.75, 0.90];

  // Fit quantile models for M5i with dealer effect
  const ttBlades = blades.filter(r => r.log_tt != null);
  if (ttBlades.length < 30) return;

  const features = (r: Row) => [r.cert_ordinal, r.item_type_ord, r.log_tt!, r.cert_ordinal * r.log_tt!, r.is_jp_dealer];
  const X = ttBlades.map(features);
  const y = ttBlades.map(r => r.log_price);

  const qModels = taus.map(tau => quantileRegression(X, y, tau));

  console.log(`\n  Model: M5i + dealer_country (Quantile, n=${fmt(ttBlades.length)})`);
  console.log(`  Scenario: JP dealer, katana (item_type_ord=3)\n`);

  const scenarios = [
    { label: 'Hozon, TT=500 (low-rank smith)', cert: 3, tt: 500 },
    { label: 'Hozon, TT=1000 (mid smith)', cert: 3, tt: 1000 },
    { label: 'TokuHozon, TT=1000', cert: 4, tt: 1000 },
    { label: 'TokuHozon, TT=2000 (famous smith)', cert: 4, tt: 2000 },
    { label: 'TokuHozon, TT=3000 (Rai Kunimitsu)', cert: 4, tt: 3000 },
    { label: 'Juyo, TT=1000', cert: 5, tt: 1000 },
    { label: 'Juyo, TT=2000', cert: 5, tt: 2000 },
    { label: 'Juyo, TT=3000 (Masamune-class)', cert: 5, tt: 3000 },
    { label: 'Tokuju, TT=2000', cert: 6, tt: 2000 },
    { label: 'Tokuju, TT=3000', cert: 6, tt: 3000 },
  ];

  for (const s of scenarios) {
    const logTt = Math.log10(s.tt);
    const x = [s.cert, 3, logTt, s.cert * logTt, 1]; // JP dealer, katana
    const preds = qModels.map(q => 10 ** predict(q.beta, x));

    console.log(`  ${s.label}`);
    console.log(`    P10: ${fmtK(preds[0]).padStart(10)}  P25: ${fmtK(preds[1]).padStart(10)}  P50: ${fmtK(preds[2]).padStart(10)}  P75: ${fmtK(preds[3]).padStart(10)}  P90: ${fmtK(preds[4]).padStart(10)}`);
    console.log(`    Band: ${fmtK(preds[0])} – ${fmtK(preds[4])} (${(preds[4] / preds[0]).toFixed(1)}× spread)`);
    console.log('');
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║    MARKET PRICE MODEL V3 — SOTA Techniques                                      ║');
  console.log('║    Quantile Regression • Huber Robust • Hierarchical Shrinkage • Cross-Validation ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');

  console.log('\nFetching from market_price_observations...');
  const rows = await fetchData();
  console.log(`Loaded ${fmt(rows.length)} rows (${rows.filter(r => r.source !== 'scraped').length} private)`);
  console.log(`  Blades: ${fmt(rows.filter(r => r.item_category === 'blade').length)}`);
  console.log(`  Tosogu: ${fmt(rows.filter(r => r.item_category === 'tosogu').length)}`);
  console.log(`  JP dealers: ${fmt(rows.filter(r => r.is_jp_dealer === 1).length)}`);
  console.log(`  Intl dealers: ${fmt(rows.filter(r => r.is_jp_dealer === 0).length)}`);
  console.log(`  With nagasa: ${fmt(rows.filter(r => r.nagasa_cm != null).length)}`);
  console.log(`  Sold: ${fmt(rows.filter(r => r.was_sold).length)}`);

  sectionCvComparison(rows);
  sectionHuberComparison(rows);
  sectionQuantileRegression(rows);
  sectionDealerEffect(rows);
  sectionNagasaEffect(rows);
  sectionHierarchical(rows);
  sectionVarianceAnalysis(rows);
  sectionAskingVsSold(rows);
  sectionBestModelOutput(rows);
  sectionPredictionExamples(rows);

  console.log(`\n${'═'.repeat(80)}`);
  console.log('MODEL V3 COMPLETE');
  console.log(`${'═'.repeat(80)}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
