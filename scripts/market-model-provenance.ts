/**
 * Market Price Model — Provenance Factor Analysis
 *
 * Tests whether provenance_factor adds predictive power beyond elite_factor.
 * Joins provenance_factor from Yuhinkai artisan_makers to market observations.
 *
 * Run: npx tsx scripts/market-model-provenance.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number): string { return n.toLocaleString(); }

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b) / n;
  const my = y.reduce((a, b) => a + b) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  return num / Math.sqrt(dx2 * dy2);
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

// ── OLS ────────────────────────────────────────────────────────────

interface OlsResult {
  beta: number[];
  r2: number;
  adjR2: number;
  rmse: number;
  residuals: number[];
  predictions: number[];
}

function olsMulti(X: number[][], y: number[]): OlsResult {
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

function predict(beta: number[], x: number[]): number {
  let pred = beta[0];
  for (let j = 0; j < x.length; j++) pred += beta[j + 1] * x[j];
  return pred;
}

// ── K-fold CV ──────────────────────────────────────────────────────

function kFoldCv(
  rows: Row[],
  features: (r: Row) => number[],
  k: number,
  rng: () => number,
): { rmse: number; within2x: number; within50pct: number } {
  const indices = shuffle(rows.map((_, i) => i), rng);
  const foldSize = Math.ceil(rows.length / k);
  const allResiduals: number[] = Array(rows.length).fill(0);

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = Math.min(testStart + foldSize, rows.length);
    const testIdx = new Set(indices.slice(testStart, testEnd));

    const trainRows = rows.filter((_, i) => !testIdx.has(i));
    if (trainRows.length < 10) continue;

    const trainX = trainRows.map(features);
    const trainY = trainRows.map(r => r.log_price);
    const result = olsMulti(trainX, trainY);

    for (const idx of indices.slice(testStart, testEnd)) {
      const x = features(rows[idx]);
      allResiduals[idx] = rows[idx].log_price - predict(result.beta, x);
    }
  }

  const absRes = allResiduals.map(Math.abs);
  const rmse = Math.sqrt(absRes.reduce((s, r) => s + r * r, 0) / rows.length);
  const within2x = absRes.filter(r => r <= Math.log10(2)).length / rows.length;
  const within50pct = absRes.filter(r => r <= Math.log10(1.5)).length / rows.length;

  return { rmse, within2x, within50pct };
}

// ── Data Model ─────────────────────────────────────────────────────

interface Row {
  price_jpy: number;
  log_price: number;
  elite_factor: number;
  provenance_factor: number | null;
  toko_taikan: number | null;
  log_tt: number | null;
  cert_ordinal: number;
  cert_type: string | null;
  item_type: string;
  item_type_ord: number;
  item_category: string;
  artisan_id: string | null;
  is_jp_dealer: number;
  nagasa_cm: number | null;
  log_nagasa: number | null;
}

const CERT_LABEL: Record<number, string> = {
  0: 'None/Reg', 1: 'Kicho', 2: 'TokuKicho', 3: 'Hozon', 4: 'TokuHozon', 5: 'Juyo', 6: 'Tokuju',
};

const ITEM_TYPE_ORD: Record<string, number> = {
  'tanto': 1, 'wakizashi': 2, 'katana': 3, 'tachi': 4,
  'naginata': 3, 'yari': 2, 'ken': 3,
  'menuki': 1, 'kozuka': 2, 'kogai': 2, 'fuchi': 2, 'kashira': 2, 'fuchi-kashira': 3, 'tsuba': 3,
};

// ── Fetch + Join ────────────────────────────────────────────────────

async function fetchData(): Promise<Row[]> {
  // 1. Fetch all observations
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
  console.log(`  Fetched ${fmt(all.length)} observations from market_price_observations`);

  // 2. Collect unique artisan IDs (non-null, non-school-code)
  const artisanIds = [...new Set(
    all.map(r => r.artisan_id as string | null).filter((id): id is string => !!id)
  )];
  const makerIds = artisanIds.filter(id => !id.startsWith('NS-'));
  const schoolIds = artisanIds.filter(id => id.startsWith('NS-'));
  console.log(`  Unique artisans: ${artisanIds.length} (${makerIds.length} makers, ${schoolIds.length} schools)`);

  // 3. Fetch provenance_factor from Yuhinkai
  const pfMap = new Map<string, number | null>();

  // Makers
  for (let i = 0; i < makerIds.length; i += 100) {
    const batch = makerIds.slice(i, i + 100);
    const { data, error } = await yuhinkai
      .from('artisan_makers')
      .select('maker_id, provenance_factor')
      .in('maker_id', batch);
    if (error) { console.error('  Yuhinkai maker fetch error:', error.message); continue; }
    for (const row of (data || [])) {
      pfMap.set(row.maker_id, row.provenance_factor);
    }
  }

  // Schools
  for (let i = 0; i < schoolIds.length; i += 100) {
    const batch = schoolIds.slice(i, i + 100);
    const { data, error } = await yuhinkai
      .from('artisan_schools')
      .select('school_id, provenance_factor')
      .in('school_id', batch);
    if (error) { console.error('  Yuhinkai school fetch error:', error.message); continue; }
    for (const row of (data || [])) {
      pfMap.set(row.school_id, row.provenance_factor);
    }
  }

  const withPf = [...pfMap.values()].filter(v => v != null).length;
  console.log(`  Matched ${withPf}/${artisanIds.length} artisans with provenance_factor`);

  // 4. Build rows
  return all.map(r => {
    const nagasa = r.nagasa_cm as number | null;
    const artisanId = r.artisan_id as string | null;
    return {
      price_jpy: r.price_jpy as number,
      log_price: Math.log10(r.price_jpy as number),
      elite_factor: (r.elite_factor as number) ?? 0,
      provenance_factor: artisanId ? (pfMap.get(artisanId) ?? null) : null,
      toko_taikan: r.toko_taikan as number | null,
      log_tt: r.toko_taikan ? Math.log10(r.toko_taikan as number) : null,
      cert_ordinal: (r.cert_ordinal as number) ?? 0,
      cert_type: r.cert_type as string | null,
      item_type: (r.item_type as string) || 'unknown',
      item_type_ord: ITEM_TYPE_ORD[(r.item_type as string) || 'unknown'] ?? 0,
      item_category: (r.item_category as string) || 'other',
      artisan_id: artisanId,
      is_jp_dealer: ((r.price_currency as string) || 'JPY') === 'JPY' ? 1 : 0,
      nagasa_cm: nagasa,
      log_nagasa: nagasa && nagasa > 0 ? Math.log10(nagasa) : null,
    };
  }).filter(r => r.price_jpy >= 5000);
}

// ── Analysis ───────────────────────────────────────────────────────

function heading(title: string) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(80)}`);
}

function subheading(title: string) {
  console.log(`\n  ┌─ ${title}`);
}

async function main() {
  console.log('Market Price Model — Provenance Factor Analysis');
  console.log('================================================\n');

  const rows = await fetchData();
  const blades = rows.filter(r => r.item_category === 'blade');
  const tosogu = rows.filter(r => r.item_category === 'tosogu');

  // ── Coverage ──────────────────────────────────────────────────

  heading('1. PROVENANCE FACTOR COVERAGE');

  for (const [label, subset] of [['Blade', blades], ['Tosogu', tosogu]] as const) {
    const withPf = subset.filter(r => r.provenance_factor != null);
    const withEf = subset.filter(r => r.elite_factor > 0);
    const withBoth = subset.filter(r => r.provenance_factor != null && r.elite_factor > 0);
    const pfOnly = subset.filter(r => r.provenance_factor != null && r.elite_factor === 0);
    const efOnly = subset.filter(r => r.provenance_factor == null && r.elite_factor > 0);

    console.log(`\n  ${label} (n=${fmt(subset.length)}):`);
    console.log(`    provenance_factor non-null:  ${fmt(withPf.length)} (${(100 * withPf.length / subset.length).toFixed(1)}%)`);
    console.log(`    elite_factor > 0:            ${fmt(withEf.length)} (${(100 * withEf.length / subset.length).toFixed(1)}%)`);
    console.log(`    Both PF + EF:                ${fmt(withBoth.length)} (${(100 * withBoth.length / subset.length).toFixed(1)}%)`);
    console.log(`    PF-only (EF=0):              ${fmt(pfOnly.length)}`);
    console.log(`    EF-only (no PF):             ${fmt(efOnly.length)}`);

    if (withPf.length > 0) {
      const pfVals = withPf.map(r => r.provenance_factor!);
      console.log(`    PF range: ${Math.min(...pfVals).toFixed(3)} – ${Math.max(...pfVals).toFixed(3)}`);
      console.log(`    PF median: ${median(pfVals).toFixed(3)}`);
    }
  }

  // ── Correlation ───────────────────────────────────────────────

  heading('2. PF vs EF CORRELATION');

  for (const [label, subset] of [['Blade', blades], ['Tosogu', tosogu]] as const) {
    const both = subset.filter(r => r.provenance_factor != null && r.elite_factor > 0);
    if (both.length < 10) {
      console.log(`\n  ${label}: insufficient overlap (n=${both.length})`);
      continue;
    }
    const r = pearsonR(both.map(r => r.elite_factor), both.map(r => r.provenance_factor!));
    console.log(`\n  ${label} (n=${fmt(both.length)}): r(EF, PF) = ${r.toFixed(3)}`);

    // PF vs log(price)
    const rPrice = pearsonR(both.map(r => r.provenance_factor!), both.map(r => r.log_price));
    console.log(`    r(PF, log_price) = ${rPrice.toFixed(3)}`);
    const rEfPrice = pearsonR(both.map(r => r.elite_factor), both.map(r => r.log_price));
    console.log(`    r(EF, log_price) = ${rEfPrice.toFixed(3)}`);

    // Also check PF with TT if available
    const withTT = both.filter(r => r.toko_taikan != null);
    if (withTT.length >= 10) {
      const rPfTt = pearsonR(withTT.map(r => r.provenance_factor!), withTT.map(r => Math.log10(r.toko_taikan!)));
      console.log(`    r(PF, log_TT)   = ${rPfTt.toFixed(3)} (n=${withTT.length})`);
    }
  }

  // ── Single-Feature R² ────────────────────────────────────────

  heading('3. SINGLE-FEATURE R² COMPARISON');

  for (const [label, subset] of [['Blade', blades], ['Tosogu', tosogu]] as const) {
    subheading(`${label}`);

    const tests: { name: string; filter: (r: Row) => boolean; feature: (r: Row) => number }[] = [
      { name: 'cert_ordinal', filter: () => true, feature: r => r.cert_ordinal },
      { name: 'elite_factor', filter: r => r.elite_factor > 0, feature: r => r.elite_factor },
      { name: 'provenance_factor', filter: r => r.provenance_factor != null, feature: r => r.provenance_factor! },
      { name: 'item_type_ord', filter: () => true, feature: r => r.item_type_ord },
    ];

    if (label === 'Blade') {
      tests.push(
        { name: 'log(toko_taikan)', filter: r => r.log_tt != null, feature: r => r.log_tt! },
      );
    }

    for (const t of tests) {
      const filtered = subset.filter(t.filter);
      if (filtered.length < 10) continue;
      const X = filtered.map(r => [t.feature(r)]);
      const y = filtered.map(r => r.log_price);
      const result = olsMulti(X, y);
      console.log(`    ${t.name.padEnd(20)} n=${fmt(filtered.length).padStart(5)}  R²=${result.r2.toFixed(3)}  adjR²=${result.adjR2.toFixed(3)}`);
    }
  }

  // ── Within-Cert-Tier R² (PF vs EF head-to-head) ─────────────

  heading('4. WITHIN-CERT-TIER R² (PF vs EF, blades)');

  console.log('  Cert Tier           | PF R² (n)          | EF R² (n)          | log(TT) R² (n)');
  console.log('  ' + '─'.repeat(85));

  for (const certOrd of [0, 3, 4, 5, 6]) {
    const tier = blades.filter(r => r.cert_ordinal === certOrd);
    const label = CERT_LABEL[certOrd] || `cert=${certOrd}`;

    // PF
    const pfTier = tier.filter(r => r.provenance_factor != null);
    let pfR2 = '—';
    if (pfTier.length >= 5) {
      const res = olsMulti(pfTier.map(r => [r.provenance_factor!]), pfTier.map(r => r.log_price));
      pfR2 = `${res.r2.toFixed(3)} (${pfTier.length})`;
    }

    // EF
    const efTier = tier.filter(r => r.elite_factor > 0);
    let efR2 = '—';
    if (efTier.length >= 5) {
      const res = olsMulti(efTier.map(r => [r.elite_factor]), efTier.map(r => r.log_price));
      efR2 = `${res.r2.toFixed(3)} (${efTier.length})`;
    }

    // TT
    const ttTier = tier.filter(r => r.log_tt != null);
    let ttR2 = '—';
    if (ttTier.length >= 5) {
      const res = olsMulti(ttTier.map(r => [r.log_tt!]), ttTier.map(r => r.log_price));
      ttR2 = `${res.r2.toFixed(3)} (${ttTier.length})`;
    }

    console.log(`  ${label.padEnd(21)} | ${pfR2.padEnd(18)} | ${efR2.padEnd(18)} | ${ttR2}`);
  }

  // Same for tosogu
  subheading('Tosogu');
  console.log('  Cert Tier           | PF R² (n)          | EF R² (n)');
  console.log('  ' + '─'.repeat(55));

  for (const certOrd of [0, 3, 4, 5]) {
    const tier = tosogu.filter(r => r.cert_ordinal === certOrd);
    const label = CERT_LABEL[certOrd] || `cert=${certOrd}`;

    const pfTier = tier.filter(r => r.provenance_factor != null);
    let pfR2 = '—';
    if (pfTier.length >= 5) {
      const res = olsMulti(pfTier.map(r => [r.provenance_factor!]), pfTier.map(r => r.log_price));
      pfR2 = `${res.r2.toFixed(3)} (${pfTier.length})`;
    }

    const efTier = tier.filter(r => r.elite_factor > 0);
    let efR2 = '—';
    if (efTier.length >= 5) {
      const res = olsMulti(efTier.map(r => [r.elite_factor]), efTier.map(r => r.log_price));
      efR2 = `${res.r2.toFixed(3)} (${efTier.length})`;
    }

    console.log(`  ${label.padEnd(21)} | ${pfR2.padEnd(18)} | ${efR2}`);
  }

  // ── Incremental R² (PF beyond EF) ────────────────────────────

  heading('5. INCREMENTAL R² — DOES PF ADD TO MODELS WITH EF?');

  for (const [label, subset] of [['Blade', blades], ['Tosogu', tosogu]] as const) {
    subheading(`${label}`);

    // Filter to rows that have both PF and EF
    const both = subset.filter(r => r.provenance_factor != null && r.elite_factor > 0);
    if (both.length < 20) {
      console.log(`    Insufficient overlap (n=${both.length})`);
      continue;
    }

    const y = both.map(r => r.log_price);

    // Model A: cert + item + EF + cert×EF
    const mA = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor]),
      y
    );

    // Model B: cert + item + PF
    const mPF = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.provenance_factor!]),
      y
    );

    // Model C: cert + item + EF + cert×EF + PF
    const mC = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.provenance_factor!]),
      y
    );

    // Model D: cert + item + EF + cert×EF + PF + cert×PF
    const mD = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.provenance_factor!, r.cert_ordinal * r.provenance_factor!]),
      y
    );

    // Model E: cert + item + EF + PF + cert×EF + cert×PF + EF×PF (kitchen sink)
    const mE = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.provenance_factor!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.provenance_factor!, r.elite_factor * r.provenance_factor!]),
      y
    );

    console.log(`    n = ${fmt(both.length)}`);
    console.log(`    ${'Model'.padEnd(50)} adjR²    RMSE`);
    console.log(`    ${'─'.repeat(65)}`);
    console.log(`    ${'A: cert+item+EF+cert×EF'.padEnd(50)} ${mA.adjR2.toFixed(4)}   ${mA.rmse.toFixed(4)}`);
    console.log(`    ${'B: cert+item+PF (no EF)'.padEnd(50)} ${mPF.adjR2.toFixed(4)}   ${mPF.rmse.toFixed(4)}`);
    console.log(`    ${'C: cert+item+EF+cert×EF+PF'.padEnd(50)} ${mC.adjR2.toFixed(4)}   ${mC.rmse.toFixed(4)}`);
    console.log(`    ${'D: cert+item+EF+cert×EF+PF+cert×PF'.padEnd(50)} ${mD.adjR2.toFixed(4)}   ${mD.rmse.toFixed(4)}`);
    console.log(`    ${'E: cert+item+EF+PF+cert×EF+cert×PF+EF×PF'.padEnd(50)} ${mE.adjR2.toFixed(4)}   ${mE.rmse.toFixed(4)}`);

    const delta = mC.adjR2 - mA.adjR2;
    console.log(`\n    ΔadjR² (C - A) = ${delta >= 0 ? '+' : ''}${delta.toFixed(4)} (PF added to EF model)`);
    console.log(`    ΔRMSE  (C - A) = ${(mC.rmse - mA.rmse).toFixed(4)}`);

    // PF coefficient significance check in model C
    const pfBeta = mC.beta[5]; // intercept, cert, item, EF, cert×EF, PF
    console.log(`    PF coefficient in model C: β=${pfBeta.toFixed(4)}`);

    // For blades with TT: does PF add beyond the V3 Tier 3 (cert+item+EF+TT+interactions)?
    if (label === 'Blade') {
      const withTT = both.filter(r => r.log_tt != null);
      if (withTT.length >= 30) {
        subheading('Blade with TT + EF + PF (Tier 3+ test)');
        const yTT = withTT.map(r => r.log_price);

        // Tier 3 (V3): cert + item + EF + log(TT) + cert×EF + cert×TT
        const t3 = olsMulti(
          withTT.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!]),
          yTT
        );

        // Tier 3 + PF
        const t3pf = olsMulti(
          withTT.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!, r.provenance_factor!]),
          yTT
        );

        // Tier 3 + PF + cert×PF
        const t3pfx = olsMulti(
          withTT.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!, r.provenance_factor!, r.cert_ordinal * r.provenance_factor!]),
          yTT
        );

        console.log(`    n = ${fmt(withTT.length)}`);
        console.log(`    ${'Tier 3 (cert+item+EF+TT+ixns)'.padEnd(50)} adjR²=${t3.adjR2.toFixed(4)}  RMSE=${t3.rmse.toFixed(4)}`);
        console.log(`    ${'Tier 3 + PF'.padEnd(50)} adjR²=${t3pf.adjR2.toFixed(4)}  RMSE=${t3pf.rmse.toFixed(4)}`);
        console.log(`    ${'Tier 3 + PF + cert×PF'.padEnd(50)} adjR²=${t3pfx.adjR2.toFixed(4)}  RMSE=${t3pfx.rmse.toFixed(4)}`);
        console.log(`    ΔadjR² (Tier3+PF - Tier3) = ${(t3pf.adjR2 - t3.adjR2 >= 0 ? '+' : '')}${(t3pf.adjR2 - t3.adjR2).toFixed(4)}`);
      }
    }
  }

  // ── Cross-Validated Comparison ────────────────────────────────

  heading('6. CROSS-VALIDATED COMPARISON (5-fold, seed=42)');

  const rng = seedRng(42);
  const K = 5;

  for (const [label, subset] of [['Blade', blades], ['Tosogu', tosogu]] as const) {
    subheading(`${label}`);

    const both = subset.filter(r => r.provenance_factor != null && r.elite_factor > 0);
    if (both.length < 30) {
      console.log(`    Insufficient overlap (n=${both.length})`);
      continue;
    }

    const models: { name: string; features: (r: Row) => number[] }[] = [
      { name: 'cert+item+EF+cert×EF',
        features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor] },
      { name: 'cert+item+PF (no EF)',
        features: r => [r.cert_ordinal, r.item_type_ord, r.provenance_factor!] },
      { name: 'cert+item+PF+cert×PF (no EF)',
        features: r => [r.cert_ordinal, r.item_type_ord, r.provenance_factor!, r.cert_ordinal * r.provenance_factor!] },
      { name: 'cert+item+EF+cert×EF+PF',
        features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.provenance_factor!] },
      { name: 'cert+item+EF+cert×EF+PF+cert×PF',
        features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.provenance_factor!, r.cert_ordinal * r.provenance_factor!] },
    ];

    // For blades, also test with TT
    if (label === 'Blade') {
      const withTT = both.filter(r => r.log_tt != null);
      if (withTT.length >= 30) {
        const ttModels: { name: string; features: (r: Row) => number[] }[] = [
          { name: '[TT] cert+item+EF+TT+ixns',
            features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!] },
          { name: '[TT] +PF',
            features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!, r.provenance_factor!] },
          { name: '[TT] +PF+cert×PF',
            features: r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.log_tt!, r.cert_ordinal * r.elite_factor, r.cert_ordinal * r.log_tt!, r.provenance_factor!, r.cert_ordinal * r.provenance_factor!] },
        ];

        console.log(`\n    With TT subset (n=${fmt(withTT.length)}):`);
        console.log(`    ${'Model'.padEnd(45)} cvRMSE  <2×    <50%`);
        console.log(`    ${'─'.repeat(70)}`);

        for (const m of ttModels) {
          const cv = kFoldCv(withTT, m.features, K, seedRng(42));
          console.log(`    ${m.name.padEnd(45)} ${cv.rmse.toFixed(3)}   ${(100 * cv.within2x).toFixed(0)}%    ${(100 * cv.within50pct).toFixed(0)}%`);
        }
      }
    }

    // EF-only subset CV
    console.log(`\n    EF+PF subset (n=${fmt(both.length)}):`);
    console.log(`    ${'Model'.padEnd(45)} cvRMSE  <2×    <50%`);
    console.log(`    ${'─'.repeat(70)}`);

    for (const m of models) {
      const cv = kFoldCv(both, m.features, K, seedRng(42));
      console.log(`    ${m.name.padEnd(45)} ${cv.rmse.toFixed(3)}   ${(100 * cv.within2x).toFixed(0)}%    ${(100 * cv.within50pct).toFixed(0)}%`);
    }
  }

  // ── Partial F-test (approximate) ──────────────────────────────

  heading('7. PARTIAL F-TEST (PF beyond EF)');

  for (const [label, subset] of [['Blade', blades], ['Tosogu', tosogu]] as const) {
    const both = subset.filter(r => r.provenance_factor != null && r.elite_factor > 0);
    if (both.length < 30) continue;

    const y = both.map(r => r.log_price);
    const n = both.length;

    // Restricted: cert + item + EF + cert×EF (p1 = 4 features)
    const restricted = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor]),
      y
    );

    // Full: + PF (p2 = 5 features)
    const full = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.provenance_factor!]),
      y
    );

    const ssRes_r = restricted.residuals.reduce((s, r) => s + r * r, 0);
    const ssRes_f = full.residuals.reduce((s, r) => s + r * r, 0);
    const dfExtra = 1; // one extra feature (PF)
    const dfResid = n - 5 - 1; // full model df

    const F = ((ssRes_r - ssRes_f) / dfExtra) / (ssRes_f / dfResid);

    // F(1, dfResid) critical values: ~3.84 at p=0.05, ~6.63 at p=0.01
    const sig = F > 6.63 ? '**p<0.01' : F > 3.84 ? '*p<0.05' : 'n.s.';

    console.log(`\n  ${label} (n=${fmt(n)}):`);
    console.log(`    SS_residual (restricted): ${ssRes_r.toFixed(4)}`);
    console.log(`    SS_residual (full):       ${ssRes_f.toFixed(4)}`);
    console.log(`    F-statistic:              ${F.toFixed(2)}  ${sig}`);
    console.log(`    ΔR²:                      ${(full.r2 - restricted.r2).toFixed(4)}`);
  }

  // ── Coefficient Direction Check ───────────────────────────────

  heading('8. PF COEFFICIENT DIRECTION & MAGNITUDE');

  for (const [label, subset] of [['Blade', blades], ['Tosogu', tosogu]] as const) {
    const both = subset.filter(r => r.provenance_factor != null && r.elite_factor > 0);
    if (both.length < 20) continue;

    // Model: cert + item + EF + cert×EF + PF + cert×PF
    const res = olsMulti(
      both.map(r => [r.cert_ordinal, r.item_type_ord, r.elite_factor, r.cert_ordinal * r.elite_factor, r.provenance_factor!, r.cert_ordinal * r.provenance_factor!]),
      both.map(r => r.log_price)
    );

    const names = ['intercept', 'cert', 'item_type', 'EF', 'cert×EF', 'PF', 'cert×PF'];
    console.log(`\n  ${label} (n=${fmt(both.length)}, adjR²=${res.adjR2.toFixed(4)}):`);
    for (let i = 0; i < res.beta.length; i++) {
      console.log(`    ${(names[i] || `β${i}`).padEnd(12)} = ${res.beta[i] >= 0 ? ' ' : ''}${res.beta[i].toFixed(4)}`);
    }

    // Interpret PF effect: at median cert, what does +1 PF unit do?
    const medCert = median(both.map(r => r.cert_ordinal));
    const pfEffect = res.beta[5] + res.beta[6] * medCert;
    const pfMultiplier = Math.pow(10, pfEffect);
    console.log(`\n    At median cert (${medCert.toFixed(0)}): +1 PF unit → ×${pfMultiplier.toFixed(2)} price`);
  }

  console.log('\n\nDone.');
}

main().catch(console.error);
