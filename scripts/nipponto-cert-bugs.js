const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateCertBugs() {
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('domain', 'nipponto.co.jp')
    .single();

  console.log('NIPPONTO CERTIFICATION EXTRACTION BUGS');
  console.log('='.repeat(80));
  console.log('\nFinding NULL cert items with cert paper format...\n');

  const { data: nullCerts } = await supabase
    .from('listings')
    .select('id, url, title, raw_page_text, item_type')
    .eq('dealer_id', dealer.id)
    .is('page_exists', true)
    .is('cert_type', null)
    .limit(100);

  const bugged = [];

  nullCerts?.forEach(l => {
    if (!l.raw_page_text) return;

    const text = l.raw_page_text;

    // Check for cert paper format
    const hasCertPaper = text.includes('鑑定書(Paper)') ||
                         text.includes('鑑定書付') ||
                         text.includes('鑑定書附');

    // Check for specific cert types in paper format
    const patterns = [
      { name: 'Juyo', regex: /重要刀剣鑑定書/g },
      { name: 'Tokubetsu Hozon', regex: /特別保存刀剣鑑定書/g },
      { name: 'Hozon', regex: /保存刀剣鑑定書/g },
      { name: 'Tokubetsu Juyo', regex: /特別重要刀剣鑑定書/g },
      { name: 'Koshu Tokubetsu Kicho', regex: /甲種特別貴重刀剣鑑定書/g },
      // English variants
      { name: 'NBTHK Juyo', regex: /NBTHK\s+Juyo\s+Tou?ken/gi },
      { name: 'NBTHK Tokubetsu Hozon', regex: /NBTHK\s+Tokubetsu\s+Hozon/gi },
      { name: 'NBTHK Hozon', regex: /NBTHK\s+Hozon\s+Tou?ken/gi },
    ];

    let foundCert = null;
    patterns.forEach(p => {
      const matches = text.match(p.regex);
      if (matches && matches.length > 0) {
        foundCert = {
          name: p.name,
          count: matches.length,
          pattern: p.regex.toString()
        };
      }
    });

    if (hasCertPaper || foundCert) {
      // Extract context around cert mention
      const lines = text.split('\n');
      const certContext = [];

      lines.forEach((line, idx) => {
        if (line.includes('鑑定書') ||
            line.includes('NBTHK') ||
            (foundCert && foundCert.name.toLowerCase().split(' ').some(w => line.toLowerCase().includes(w)))) {
          certContext.push({
            lineNum: idx,
            line: line.trim().substring(0, 120)
          });
        }
      });

      bugged.push({
        id: l.id,
        url: l.url,
        title: l.title,
        item: l.item_type,
        hasCertPaper,
        foundCert,
        certContext: certContext.slice(0, 10)
      });
    }
  });

  console.log(`Found ${bugged.length} items with cert paper format but NULL cert_type:\n`);

  bugged.forEach((item, idx) => {
    console.log(`\n[${idx + 1}] ${item.url}`);
    console.log(`    Title: ${item.title}`);
    console.log(`    Item: ${item.item}`);
    console.log(`    ID: ${item.id}`);

    if (item.foundCert) {
      console.log(`    \n    FOUND CERT: ${item.foundCert.name} (${item.foundCert.count} matches)`);
      console.log(`    Pattern: ${item.foundCert.pattern}`);
    }

    if (item.certContext.length > 0) {
      console.log(`\n    Cert-related lines:`);
      item.certContext.forEach(ctx => {
        console.log(`      [${ctx.lineNum}] ${ctx.line}`);
      });
    }

    console.log('');
  });

  // Summary by cert type found
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY OF MISSED CERTIFICATIONS\n');

  const certTypeCounts = {};
  bugged.forEach(item => {
    if (item.foundCert) {
      const cert = item.foundCert.name;
      certTypeCounts[cert] = (certTypeCounts[cert] || 0) + 1;
    }
  });

  Object.entries(certTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cert, count]) => {
      console.log(`  ${cert.padEnd(30)} ${count} items`);
    });

  console.log(`\n  No cert pattern match         ${bugged.filter(i => !i.foundCert).length} items`);

  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS\n');
  console.log('1. Check encoding: Some cert words may be garbled by EUC-JP decoding');
  console.log('2. Check standalone pattern: Items might have cert in title (already checked first)');
  console.log('3. Manual review needed: View URLs above to see actual HTML patterns');
  console.log('4. Most NULL certs are tosogu without papers (expected)');
}

investigateCertBugs().catch(console.error);
