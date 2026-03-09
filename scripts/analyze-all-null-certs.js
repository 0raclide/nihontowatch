const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeAllNullCerts() {
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('domain', 'nipponto.co.jp')
    .single();

  // Get ALL null cert items
  const { data: nullCerts } = await supabase
    .from('listings')
    .select('id, url, title, raw_page_text')
    .eq('dealer_id', dealer.id)
    .is('page_exists', true)
    .is('cert_type', null);

  console.log(`Analyzing ${nullCerts?.length} NULL cert listings...\n`);

  const patterns = {
    // Japanese patterns with 鑑定書
    'Tokubetsu Kicho (JP)': /特別貴重刀剣鑑定書/,
    'Tokubetsu Hozon (JP)': /特別保存刀剣鑑定書/,
    'Hozon (JP)': /保存刀剣鑑定書/,
    'Juyo (JP)': /重要刀剣鑑定書/,
    'Tokubetsu Kicho Tosogu (JP)': /特別貴重刀装具鑑定書/,
    'Tokubetsu Hozon Tosogu (JP)': /特別保存刀装具鑑定書/,
    'Hozon Tosogu (JP)': /保存刀装具鑑定書/,
    'Juyo Tosogu (JP)': /重要刀装具鑑定書/,

    // English EXISTING patterns (with space)
    'NBTHK Tokubetsu Hozon': /NBTHK Tokubetsu Hozon/,
    'NBTHK Hozon Token': /NBTHK Hozon Token/,
    'NBTHK Hozon Touken': /NBTHK Hozon Touken/,
    'NBTHK Juyo Token': /NBTHK Juyo Token/,
    'NBTHK Juyo Touken': /NBTHK Juyo Touken/,

    // English MISSING patterns (no space - CamelCase)
    'NBTHK TokubetsuKicho': /NBTHK TokubetsuKicho/,
    'NBTHK TokubetsuHozon': /NBTHK TokubetsuHozon/,
    'NBTHK HozonToken': /NBTHK HozonToken/,
    'NBTHK HozonTouken': /NBTHK HozonTouken/,
  };

  const found = {};
  Object.keys(patterns).forEach(k => {
    found[k] = [];
  });

  nullCerts?.forEach(l => {
    if (!l.raw_page_text) return;

    Object.entries(patterns).forEach(([name, regex]) => {
      if (regex.test(l.raw_page_text)) {
        found[name].push({
          id: l.id,
          url: l.url,
          title: l.title.substring(0, 80)
        });
      }
    });
  });

  console.log('CERT PATTERNS FOUND IN NULL CERT LISTINGS:\n');
  console.log('='.repeat(80));

  Object.entries(found)
    .filter(([_, items]) => items.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([name, items]) => {
      console.log(`\n${name}: ${items.length} items`);

      items.slice(0, 3).forEach(item => {
        console.log(`  - ${item.url}`);
        console.log(`    "${item.title}"`);
      });

      if (items.length > 3) {
        console.log(`  ... and ${items.length - 3} more`);
      }
    });

  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY\n');

  const jpPatterns = Object.keys(found).filter(k => k.includes('(JP)'));
  const enExisting = Object.keys(found).filter(k => k.includes('NBTHK') && !k.includes('Camel'));
  const enMissing = ['NBTHK TokubetsuKicho', 'NBTHK TokubetsuHozon', 'NBTHK HozonToken', 'NBTHK HozonTouken'];

  const jpTotal = jpPatterns.reduce((sum, k) => sum + found[k].length, 0);
  const enExistingTotal = enExisting.reduce((sum, k) => sum + found[k].length, 0);
  const enMissingTotal = enMissing.reduce((sum, k) => sum + found[k].length, 0);

  console.log(`Japanese cert patterns (should work): ${jpTotal} items`);
  console.log(`English patterns (already in scraper): ${enExistingTotal} items`);
  console.log(`English patterns (MISSING from scraper): ${enMissingTotal} items`);

  console.log('\n\nMISSING PATTERNS TO ADD:');
  enMissing.forEach(pattern => {
    if (found[pattern] && found[pattern].length > 0) {
      console.log(`  - "${pattern}" (${found[pattern].length} items)`);
    }
  });

  console.log('\n\nRECOMMENDATION:');
  console.log('The scraper needs to add English patterns without spaces:');
  console.log('  - NBTHK TokubetsuKicho (currently missing)');
  console.log('  - Check if other variations exist');
}

analyzeAllNullCerts().catch(console.error);
