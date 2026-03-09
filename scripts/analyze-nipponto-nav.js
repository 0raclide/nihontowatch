const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeNavPattern() {
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('domain', 'nipponto.co.jp')
    .single();

  // Get NULL cert listings to check for nav false positives
  const { data: nullListings } = await supabase
    .from('listings')
    .select('id, url, title, cert_type, raw_page_text')
    .eq('dealer_id', dealer.id)
    .is('page_exists', true)
    .is('cert_type', null)
    .limit(30);

  console.log(`Analyzing ${nullListings?.length} NULL cert listings\n`);

  nullListings?.forEach((l, idx) => {
    if (!l.raw_page_text) return;

    const text = l.raw_page_text;

    // Find all instances of 重要刀剣
    const juyoMatches = [];
    const lines = text.split('\n');

    lines.forEach((line, lineIdx) => {
      if (line.includes('重要刀剣')) {
        juyoMatches.push({
          lineIdx,
          line: line.trim(),
          context: lines.slice(Math.max(0, lineIdx - 1), lineIdx + 2).map(l => l.trim())
        });
      }
    });

    if (juyoMatches.length > 0) {
      console.log(`\n[${ idx + 1}] ${l.url}`);
      console.log(`Title: ${l.title}`);
      console.log(`重要刀剣 appears ${juyoMatches.length} times:`);

      juyoMatches.forEach((match, i) => {
        console.log(`\n  Match ${i + 1} (line ${match.lineIdx}):`);
        console.log(`    "${match.line}"`);

        // Check if it's in navigation context
        const isNav = match.line.includes('一覧') ||
                      match.line.includes('href') ||
                      match.line.includes('jyuyo') ||
                      match.context.some(c => c.includes('href') || c.includes('一覧'));

        console.log(`    Is Navigation: ${isNav ? 'YES' : 'NO'}`);

        if (match.context.length > 1) {
          console.log(`    Context:`);
          match.context.forEach(c => {
            if (c && c !== match.line) {
              console.log(`      "${c.substring(0, 100)}"`);
            }
          });
        }
      });

      // Check for actual cert paper mention
      const hasCertPaper = text.includes('重要刀剣鑑定書') ||
                           (text.includes('重要刀剣') && text.includes('鑑定書'));
      console.log(`  Has cert paper mention: ${hasCertPaper ? 'YES' : 'NO'}`);
    }
  });

  // Now check certified listings to see the true pattern
  console.log('\n\n' + '='.repeat(80));
  console.log('TRUE JUYO EXAMPLES (for comparison)');
  console.log('='.repeat(80));

  const { data: juyoListings } = await supabase
    .from('listings')
    .select('id, url, title, cert_type, raw_page_text')
    .eq('dealer_id', dealer.id)
    .eq('cert_type', 'Juyo')
    .limit(5);

  juyoListings?.forEach((l, idx) => {
    if (!l.raw_page_text) return;

    const text = l.raw_page_text;
    const lines = text.split('\n');

    // Find cert paper section
    const certLines = lines.filter(line =>
      line.includes('鑑定書') &&
      (line.includes('重要') || line.includes('Juyo'))
    );

    console.log(`\n[${idx + 1}] ${l.url}`);
    console.log(`Title: ${l.title}`);
    console.log(`Cert paper lines:`);
    certLines.forEach(line => {
      console.log(`  "${line.trim()}"`);
    });
  });
}

analyzeNavPattern().catch(console.error);
