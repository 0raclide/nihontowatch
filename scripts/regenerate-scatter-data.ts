/**
 * Regenerate scatter-data.ts for the methodology page.
 * Queries artisan_makers from Yuhinkai for designation_factor + toko_taikan.
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

// Notable artisans to label (l=1) in the scatter plot
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

async function main() {
  console.log('Fetching artisan_makers with designation_factor > 0 AND toko_taikan IS NOT NULL...');

  const allRows: Array<{
    maker_id: string;
    name_romaji: string;
    domain: string;
    designation_factor: number;
    toko_taikan: number;
  }> = [];

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('artisan_makers')
      .select('maker_id, name_romaji, domain, designation_factor, toko_taikan')
      .gt('designation_factor', 0)
      .not('toko_taikan', 'is', null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Query error:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Fetched ${allRows.length} artisans with both designation_factor > 0 and toko_taikan`);

  // Map to scatter data format
  const points = allRows
    .map((r) => ({
      n: r.name_romaji || r.maker_id,
      id: r.maker_id,
      d: (r.domain === 'tosogu' ? 't' : 's') as 's' | 't',
      ef: Number((r.designation_factor || 0).toFixed(4)),
      tt: r.toko_taikan,
      l: NOTABLE.has(r.maker_id) ? 1 : 0,
    }))
    // Sort: labeled first (by ef desc), then unlabeled (by ef desc)
    .sort((a, b) => {
      if (a.l !== b.l) return b.l - a.l;
      return b.ef - a.ef;
    });

  // Compute stats
  const swords = points.filter((p) => p.d === 's');
  const tosogu = points.filter((p) => p.d === 't');
  const maxEf = Math.max(...points.map((p) => p.ef));
  const maxTt = Math.max(...points.map((p) => p.tt));
  const minTt = Math.min(...points.map((p) => p.tt));

  console.log(`Swords: ${swords.length}`);
  console.log(`Tosogu: ${tosogu.length}`);
  console.log(`EF range: 0 – ${maxEf}`);
  console.log(`Toko Taikan range: ${minTt} – ${maxTt}`);

  // Top 10 by ef
  console.log('\nTop 10 by designation_factor:');
  [...points].sort((a, b) => b.ef - a.ef).slice(0, 10).forEach((p, i) =>
    console.log(`  ${i + 1}. ${p.n} (${p.id}): ef=${p.ef}, tt=${p.tt}`)
  );

  // Top 10 by toko_taikan
  console.log('\nTop 10 by toko_taikan:');
  [...points].sort((a, b) => b.tt - a.tt).slice(0, 10).forEach((p, i) =>
    console.log(`  ${i + 1}. ${p.n} (${p.id}): ef=${p.ef}, tt=${p.tt}`)
  );

  // Generate TypeScript file
  const today = new Date().toISOString().slice(0, 10);
  const lines = points.map(
    (p) => `{n:${JSON.stringify(p.n)},id:${JSON.stringify(p.id)},d:${JSON.stringify(p.d)},ef:${p.ef},tt:${p.tt},l:${p.l}}`
  );

  const output = `// Auto-generated scatter data for methodology figures
// Source: artisan_makers (designation_factor > 0 AND toko_taikan IS NOT NULL)
// Generated: ${today}

export type P = { n: string; id: string; d: 's' | 't'; ef: number; tt: number; l: number };

export const D: P[] = [
${lines.join(',\n')}
];
`;

  const outPath = path.join(__dirname, '../src/app/eliteranking/scatter-data.ts');
  fs.writeFileSync(outPath, output, 'utf-8');
  console.log(`\nWrote ${points.length} points to ${outPath}`);
}

main().catch(console.error);
