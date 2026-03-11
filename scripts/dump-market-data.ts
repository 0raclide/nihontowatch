/**
 * Dump market_price_observations to CSV for diagnostic plotting.
 * Run: npx tsx scripts/dump-market-data.ts
 * Output: scripts/market_data.csv
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

const BLADE_TYPES = new Set(['katana', 'wakizashi', 'tanto', 'tachi', 'naginata', 'yari', 'ken']);
const TOSOGU_TYPES = new Set(['tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira', 'fuchi-kashira']);

function itemCategory(type: string): string {
  if (BLADE_TYPES.has(type)) return 'blade';
  if (TOSOGU_TYPES.has(type)) return 'tosogu';
  if (type === 'koshirae') return 'koshirae';
  return 'other';
}

const CERT_LABEL: Record<number, string> = {
  0: 'None/Reg', 1: 'Kicho', 2: 'TokuKicho', 3: 'Hozon', 4: 'TokuHozon', 5: 'Juyo', 6: 'Tokuju',
};

const ITEM_TYPE_ORD: Record<string, number> = {
  'tanto': 1, 'wakizashi': 2, 'katana': 3, 'tachi': 4,
  'naginata': 3, 'yari': 2, 'ken': 3,
  'menuki': 1, 'kozuka': 2, 'kogai': 2, 'fuchi': 2, 'kashira': 2, 'fuchi-kashira': 3, 'tsuba': 3,
};

async function main() {
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

  console.log(`Fetched ${all.length} rows`);

  const headers = [
    'price_jpy', 'log_price', 'price_currency', 'is_jp_dealer',
    'item_type', 'item_category', 'item_type_ord',
    'cert_ordinal', 'cert_label', 'cert_type',
    'elite_factor', 'toko_taikan', 'log_tt', 'hawley', 'fujishiro_ord',
    'nagasa_cm', 'log_nagasa',
    'artisan_id', 'artisan_name',
    'source', 'was_sold', 'dealer_name',
  ];

  const lines = [headers.join(',')];

  for (const r of all) {
    const priceJpy = r.price_jpy as number;
    if (priceJpy < 5000) continue;
    const itemType = (r.item_type as string) || 'unknown';
    const nagasa = r.nagasa_cm as number | null;
    const tt = r.toko_taikan as number | null;
    const currency = (r.price_currency as string) || 'JPY';
    const certOrd = (r.cert_ordinal as number) ?? 0;

    const row = [
      priceJpy,
      Math.log10(priceJpy).toFixed(4),
      currency,
      currency === 'JPY' ? 1 : 0,
      itemType,
      itemCategory(itemType),
      ITEM_TYPE_ORD[itemType] ?? 0,
      certOrd,
      CERT_LABEL[certOrd] || `ord_${certOrd}`,
      csvEscape((r.cert_type as string) || ''),
      ((r.elite_factor as number) ?? 0).toFixed(4),
      tt ?? '',
      tt ? Math.log10(tt).toFixed(4) : '',
      (r.hawley as number) ?? '',
      (r.fujishiro_ord as number) ?? '',
      nagasa ?? '',
      nagasa && nagasa > 0 ? Math.log10(nagasa).toFixed(4) : '',
      (r.artisan_id as string) || '',
      csvEscape((r.artisan_name as string) || ''),
      r.source as string,
      r.was_sold ? 1 : 0,
      csvEscape((r.dealer_name as string) || ''),
    ];
    lines.push(row.join(','));
  }

  const outPath = path.resolve(__dirname, 'market_data.csv');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Wrote ${lines.length - 1} rows to ${outPath}`);
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

main().catch(console.error);
