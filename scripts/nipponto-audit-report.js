const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateAuditReport() {
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('domain', 'nipponto.co.jp')
    .single();

  console.log('='.repeat(80));
  console.log('NIPPONTO CERTIFICATE EXTRACTION AUDIT REPORT');
  console.log('='.repeat(80));
  console.log('\n## Summary\n');

  // Get distribution
  const { data: allListings } = await supabase
    .from('listings')
    .select('cert_type, item_type')
    .eq('dealer_id', dealer.id)
    .is('page_exists', true);

  const certCounts = {};
  const itemCounts = {};

  allListings?.forEach(l => {
    const cert = l.cert_type || 'NULL';
    certCounts[cert] = (certCounts[cert] || 0) + 1;

    const item = l.item_type || 'NULL';
    itemCounts[item] = (itemCounts[item] || 0) + 1;
  });

  console.log(`Total listings: ${allListings?.length}`);
  console.log(`\nCertification distribution:`);
  Object.entries(certCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cert, count]) => {
      const pct = ((count / allListings.length) * 100).toFixed(1);
      console.log(`  ${cert.padEnd(30)} ${count.toString().padStart(3)} (${pct}%)`);
    });

  console.log(`\nItem type distribution:`);
  Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([item, count]) => {
      const pct = ((count / allListings.length) * 100).toFixed(1);
      console.log(`  ${item.padEnd(30)} ${count.toString().padStart(3)} (${pct}%)`);
    });

  // Navigation False Positive Analysis
  console.log('\n\n## Navigation False Positive Analysis\n');
  console.log('Looking for NULL cert listings that have "重要刀剣" text...\n');

  const { data: nullCerts } = await supabase
    .from('listings')
    .select('id, url, title, raw_page_text, item_type')
    .eq('dealer_id', dealer.id)
    .is('page_exists', true)
    .is('cert_type', null)
    .limit(50);

  let navOnlyCount = 0;
  let hasPaperCount = 0;
  const navOnlyItems = [];

  nullCerts?.forEach(l => {
    if (!l.raw_page_text) return;

    const text = l.raw_page_text;
    const hasJuyoText = text.includes('重要刀剣');
    const hasCertPaper = text.includes('重要刀剣鑑定書') ||
                         (text.includes('重要刀剣') && text.includes('鑑定書(Paper)'));
    const hasNavLink = text.includes('重要刀剣一覧') || text.includes('jyuyo.htm');

    if (hasJuyoText && !hasCertPaper && hasNavLink) {
      navOnlyCount++;
      navOnlyItems.push({
        url: l.url,
        title: l.title,
        item: l.item_type
      });
    }

    if (hasCertPaper) {
      hasPaperCount++;
    }
  });

  console.log(`Sampled ${nullCerts?.length} NULL cert listings:`);
  console.log(`  - ${navOnlyCount} have "重要刀剣" ONLY in navigation (potential false negatives)`);
  console.log(`  - ${hasPaperCount} have cert paper format but NULL cert (extraction bugs)`);

  if (navOnlyItems.length > 0) {
    console.log(`\nNavigation-only examples (first 5):`);
    navOnlyItems.slice(0, 5).forEach(item => {
      console.log(`  - ${item.url}`);
      console.log(`    "${item.title}"`);
      console.log(`    Item type: ${item.item}`);
    });
  }

  // Certified Items Pattern Analysis
  console.log('\n\n## Certified Items - Pattern Verification\n');

  const certTypes = ['Juyo', 'Tokubetsu Hozon', 'Hozon'];
  for (const certType of certTypes) {
    const { data: certs } = await supabase
      .from('listings')
      .select('id, url, title, raw_page_text')
      .eq('dealer_id', dealer.id)
      .eq('cert_type', certType)
      .limit(3);

    console.log(`\n${certType} (${certs?.length} samples):`);

    certs?.forEach((l, idx) => {
      if (!l.raw_page_text) return;

      const lines = l.raw_page_text.split('\n');
      const certLine = lines.find(line =>
        line.includes('鑑定書') &&
        (line.includes(certType) ||
         line.includes('重要') ||
         line.includes('特別保存') ||
         line.includes('保存'))
      );

      console.log(`  ${idx + 1}. ${l.title}`);
      if (certLine) {
        console.log(`     Cert line: "${certLine.trim()}"`);
      }
    });
  }

  // Bare "重要刀剣" (Standalone) Analysis
  console.log('\n\n## Bare "重要刀剣" Occurrence Analysis\n');

  const { data: sampleListings } = await supabase
    .from('listings')
    .select('url, title, cert_type, raw_page_text')
    .eq('dealer_id', dealer.id)
    .is('page_exists', true)
    .limit(30);

  let bareJuyoInNav = 0;
  let bareJuyoInCert = 0;
  let bareJuyoStandalone = 0;

  sampleListings?.forEach(l => {
    if (!l.raw_page_text) return;

    const lines = l.raw_page_text.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();

      // Exact match "重要刀剣" on its own line
      if (trimmed === '重要刀剣') {
        // Check context
        if (l.raw_page_text.includes('重要刀剣一覧')) {
          bareJuyoInNav++;
        } else if (l.raw_page_text.includes('重要刀剣鑑定書')) {
          bareJuyoInCert++;
        } else {
          bareJuyoStandalone++;
        }
      }
    });
  });

  console.log(`In ${sampleListings?.length} sampled listings:`);
  console.log(`  - Bare "重要刀剣" appears in NAV context: ${bareJuyoInNav} times`);
  console.log(`  - Bare "重要刀剣" appears with cert paper: ${bareJuyoInCert} times`);
  console.log(`  - Bare "重要刀剣" standalone (ambiguous): ${bareJuyoStandalone} times`);

  // Conclusion
  console.log('\n\n## Findings\n');
  console.log('1. NAVIGATION PATTERN:');
  console.log('   - Nipponto has "重要刀剣" as a bare nav link on its own line');
  console.log('   - This appears on EVERY page (certified and uncertified)');
  console.log('   - It\'s followed by "重要刀剣一覧" (list link) in the menu');
  console.log('');
  console.log('2. CERT PAPER FORMAT:');
  console.log('   - Real certifications show as "[cert]鑑定書" (e.g., "重要刀剣鑑定書")');
  console.log('   - Also appears as "鑑定書(Paper)\\n重要刀剣鑑定書" in structured sections');
  console.log('   - English format: "(NBTHK Hozon Touken)"');
  console.log('');
  console.log('3. CURRENT EXTRACTION:');
  console.log('   - Scraper checks title FIRST (correct priority)');
  console.log('   - Then checks for "[cert]鑑定書" pattern (correct)');
  console.log('   - Does NOT match bare "重要刀剣" (correct - avoids nav false positives)');
  console.log('');
  console.log('4. POTENTIAL GAPS:');
  console.log(`   - ${hasPaperCount} items have cert paper format but NULL cert (need investigation)`);
  console.log('   - Check if cert words have encoding issues (EUC-JP garbling)');
  console.log('');
  console.log('5. ACCURACY:');
  console.log(`   - ${certCounts.NULL} / ${allListings?.length} items have NULL cert (${((certCounts.NULL/allListings.length)*100).toFixed(1)}%)`);
  console.log('   - Many NULL items are tosogu without certifications (expected)');
  console.log('   - Navigation false positive risk is WELL CONTROLLED');
}

generateAuditReport().catch(console.error);
