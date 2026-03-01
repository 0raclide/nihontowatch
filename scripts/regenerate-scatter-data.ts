/**
 * Regenerate scatter-data.ts for the methodology page.
 * Queries artisan_makers from Yuhinkai for:
 *   1. designation_factor + toko_taikan (EF vs TT scatter)
 *   2. designation_factor + fujishiro + era (EF vs Fujishiro by era)
 *
 * Usage: npx tsx scripts/regenerate-scatter-data.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const url = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL;
const key = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing YUHINKAI_SUPABASE_URL / YUHINKAI_SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

// Notable artisans to label (l=1) in the scatter plots
const NOTABLE = new Set([
  'MAS590',   // Masamune
  'KUN557',   // Kunimitsu
  'SAD543',   // Sadamune
  'NAG281',   // Nagamitsu
  'YOS463',   // Yoshimitsu
  'KUN539',   // Kunimitsu (Soshu)
  'TOM134',   // Tomonari
  'MAS1228',  // Masatsune
  'MIT281',   // Mitsutada
  'SA11',     // Sa
  'YOK001',   // Somin
  'ITA001',   // Kaneie
  'WGO042',   // Goto Ichijo
  'GOT001',   // Goto Yujo
  'SAN72',    // Sanekage
  'KAG60',    // Kagemitsu
  'YOS1434',  // Go Yoshihiro
  'KAN35',    // Kanehira
  'SUK460',   // Sukezane
]);

// Fujishiro grade → numeric rank (5 = highest)
const FUJISHIRO_RANK: Record<string, number> = {
  'Sai-jo saku': 5,
  'Jo-jo saku': 4,
  'Jo saku': 3,
  'Chu-jo saku': 2,
  'Chu saku': 1,
};

// Broad period boundaries (same as eraPeriods.ts)
const BROAD_PERIODS = [
  { name: 'Heian', startYear: 0, endYear: 1185 },
  { name: 'Kamakura', startYear: 1185, endYear: 1333 },
  { name: 'Nanbokucho', startYear: 1333, endYear: 1392 },
  { name: 'Muromachi', startYear: 1392, endYear: 1573 },
];

const STRING_FALLBACKS: Array<{ pattern: RegExp; period: string }> = [
  { pattern: /\bheian\b/i, period: 'Heian' },
  { pattern: /\bkamakura\b/i, period: 'Kamakura' },
  { pattern: /\bnanboku/i, period: 'Nanbokucho' },
  { pattern: /\bmuromachi\b/i, period: 'Muromachi' },
  { pattern: /\bkoto\b/i, period: 'Heian' },
];

function eraToBroadPeriod(era: string | null): string | null {
  if (!era) return null;
  const match = era.match(/\((\d{3,4})/);
  if (match) {
    const year = parseInt(match[1], 10);
    for (const p of BROAD_PERIODS) {
      if (year >= p.startYear && year < p.endYear) return p.name;
    }
  }
  for (const { pattern, period } of STRING_FALLBACKS) {
    if (pattern.test(era)) return period;
  }
  return null;
}

const TARGET_ERAS = new Set(['Heian', 'Kamakura', 'Nanbokucho', 'Muromachi']);

async function main() {
  // ── Dataset 1: EF vs Toko Taikan ──
  console.log('=== Dataset 1: EF vs Toko Taikan ===');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ttRows: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('artisan_makers')
      .select('maker_id, name_romaji, domain, designation_factor, toko_taikan')
      .gt('designation_factor', 0)
      .not('toko_taikan', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) { console.error('Query error:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    ttRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Fetched ${ttRows.length} artisans with designation_factor > 0 AND toko_taikan`);

  const ttPoints = ttRows
    .map((r) => ({
      n: r.name_romaji || r.maker_id,
      id: r.maker_id,
      d: (r.domain === 'tosogu' ? 't' : 's') as 's' | 't',
      ef: Number((r.designation_factor || 0).toFixed(4)),
      tt: r.toko_taikan as number,
      l: NOTABLE.has(r.maker_id) ? 1 : 0,
    }))
    .sort((a, b) => (a.l !== b.l ? b.l - a.l : b.ef - a.ef));

  console.log(`  Points: ${ttPoints.length}`);

  // ── Dataset 2: EF vs Fujishiro (by era) ──
  console.log('\n=== Dataset 2: EF vs Fujishiro (by era) ===');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fjRows: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('artisan_makers')
      .select('maker_id, name_romaji, domain, designation_factor, fujishiro, era')
      .gt('designation_factor', 0)
      .not('fujishiro', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) { console.error('Query error:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    fjRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Fetched ${fjRows.length} artisans with designation_factor > 0 AND fujishiro`);

  const fjPoints = fjRows
    .map((r) => {
      const broadPeriod = eraToBroadPeriod(r.era);
      if (!broadPeriod || !TARGET_ERAS.has(broadPeriod)) return null;
      const fj = FUJISHIRO_RANK[r.fujishiro];
      if (!fj) return null;
      return {
        n: r.name_romaji || r.maker_id,
        id: r.maker_id,
        ef: Number((r.designation_factor || 0).toFixed(4)),
        fj,
        era: broadPeriod as 'Heian' | 'Kamakura' | 'Nanbokucho' | 'Muromachi',
        l: NOTABLE.has(r.maker_id) ? 1 : 0,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => (a.l !== b.l ? b.l - a.l : b.ef - a.ef));

  // Stats
  for (const era of ['Heian', 'Kamakura', 'Nanbokucho', 'Muromachi']) {
    const eraPoints = fjPoints.filter((p) => p.era === era);
    const grades: Record<string, number> = {};
    eraPoints.forEach((p) => { grades[p.fj] = (grades[p.fj] || 0) + 1; });
    console.log(`  ${era}: ${eraPoints.length} artisans — grades: ${JSON.stringify(grades)}`);
  }

  console.log(`  Total Fujishiro points: ${fjPoints.length}`);

  // ── Generate TypeScript ──
  const today = new Date().toISOString().slice(0, 10);

  const ttLines = ttPoints.map(
    (p) => `{n:${JSON.stringify(p.n)},id:${JSON.stringify(p.id)},d:${JSON.stringify(p.d)},ef:${p.ef},tt:${p.tt},l:${p.l}}`
  );

  const fjLines = fjPoints.map(
    (p) => `{n:${JSON.stringify(p.n)},id:${JSON.stringify(p.id)},ef:${p.ef},fj:${p.fj},era:${JSON.stringify(p.era)},l:${p.l}}`
  );

  const output = `// Auto-generated scatter data for methodology figures
// Source: artisan_makers
// Generated: ${today}

// ── EF vs Toko Taikan ──
export type TT = { n: string; id: string; d: 's' | 't'; ef: number; tt: number; l: number };

export const D_TT: TT[] = [
${ttLines.join(',\n')}
];

// ── EF vs Fujishiro (by era) ──
// fj: 1=Chu saku, 2=Chu-jo saku, 3=Jo saku, 4=Jo-jo saku, 5=Sai-jo saku
export type FJ = { n: string; id: string; ef: number; fj: number; era: 'Heian' | 'Kamakura' | 'Nanbokucho' | 'Muromachi'; l: number };

export const D_FJ: FJ[] = [
${fjLines.join(',\n')}
];
`;

  const outPath = path.join(__dirname, '../src/app/eliteranking/scatter-data.ts');
  fs.writeFileSync(outPath, output, 'utf-8');
  console.log(`\nWrote ${ttPoints.length} TT + ${fjPoints.length} FJ points to ${outPath}`);
}

main().catch(console.error);
