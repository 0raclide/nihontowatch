const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSpecificItem() {
  // Item #6 from the report - has 特別貴重刀剣鑑定書
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('id', 69057)
    .single();

  console.log('URL:', data.url);
  console.log('Title:', data.title);
  console.log('Cert Type:', data.cert_type);
  console.log('\nSearching raw_page_text for cert patterns...\n');

  const text = data.raw_page_text;

  // Check each pattern from scraper
  const patterns = [
    { jp: '特別貴重刀剣', en: 'Tokubetsu Kicho' },
    { jp: '特別保存刀剣', en: 'Tokubetsu Hozon' },
    { jp: '重要刀剣', en: 'Juyo' },
    { jp: '保存刀剣', en: 'Hozon' },
  ];

  patterns.forEach(p => {
    const hasBare = text.includes(p.jp);
    const hasPaper = text.includes(p.jp + '鑑定書');

    console.log(`${p.jp.padEnd(15)} - Bare: ${hasBare ? 'YES' : 'NO'}  | With 鑑定書: ${hasPaper ? 'YES' : 'NO'}`);

    if (hasPaper) {
      // Find the line
      const lines = text.split('\n');
      const certLine = lines.find(l => l.includes(p.jp + '鑑定書'));
      console.log(`    Line: "${certLine?.trim().substring(0, 80)}"`);
    }
  });

  // Check for NBTHK English patterns
  console.log('\nNBTHK English patterns:');
  const enPatterns = [
    'NBTHK TokubetsuKicho',
    'NBTHK Tokubetsu Hozon',
    'NBTHK Hozon',
    'NBTHK Juyo'
  ];

  enPatterns.forEach(p => {
    if (text.includes(p)) {
      console.log(`  FOUND: ${p}`);
      const lines = text.split('\n');
      const line = lines.find(l => l.includes(p));
      console.log(`    Line: "${line?.trim().substring(0, 80)}"`);
    }
  });

  // Check for variations with spaces
  console.log('\nChecking pattern with space variations:');
  const spacePatterns = [
    'TokubetsuKicho Touken',
    'Tokubetsu Kicho Touken',
    'TokubetsuKicho Token',
  ];

  spacePatterns.forEach(p => {
    if (text.includes(p)) {
      console.log(`  FOUND: "${p}"`);
    }
  });

  // Show all lines containing cert-related text
  console.log('\nAll cert-related lines:');
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('鑑定書') || line.includes('NBTHK') || line.includes('Kicho')) {
      console.log(`  [${idx}] ${line.trim().substring(0, 100)}`);
    }
  });
}

checkSpecificItem().catch(console.error);
