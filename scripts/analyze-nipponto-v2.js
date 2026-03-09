const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getDetailedSamples() {
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('domain', 'nipponto.co.jp')
    .single();

  // Get all listings first, then filter in JS
  const { data: allListings } = await supabase
    .from('listings')
    .select('id, url, title, cert_type, cert_session, raw_page_text')
    .eq('dealer_id', dealer.id)
    .is('page_exists', true)
    .order('id', { ascending: false })
    .limit(200);

  console.log(`Total listings retrieved: ${allListings?.length}`);

  // Group by cert type
  const byCert = {
    JUYO: [],
    TOKUBETSU_HOZON: [],
    HOZON: [],
    NULL: []
  };

  allListings?.forEach(l => {
    const cert = l.cert_type || 'NULL';
    if (byCert[cert]) {
      byCert[cert].push(l);
    } else if (cert.includes('Juyo')) {
      byCert.JUYO.push(l);
    } else if (cert.includes('Tokubetsu')) {
      byCert.TOKUBETSU_HOZON.push(l);
    } else if (cert.includes('Hozon')) {
      byCert.HOZON.push(l);
    } else {
      byCert.NULL.push(l);
    }
  });

  console.log('\nCounts by cert type:');
  Object.entries(byCert).forEach(([cert, items]) => {
    console.log(`  ${cert}: ${items.length}`);
  });

  // Analyze each cert type
  for (const [certLabel, listings] of Object.entries(byCert)) {
    console.log('\n' + '='.repeat(80));
    console.log(`CERT TYPE: ${certLabel} (${listings.length} total)`);
    console.log('='.repeat(80));

    listings.slice(0, 2).forEach((l, idx) => {
      console.log(`\n--- Sample ${idx + 1} ---`);
      console.log('URL:', l.url);
      console.log('Title:', l.title);
      console.log('Cert:', l.cert_type, l.cert_session || '');

      // Extract relevant portions of raw_page_text
      if (l.raw_page_text) {
        const text = l.raw_page_text;

        // Look for cert-related sections more specifically
        const lines = text.split('\n');
        const certLines = lines.filter(line =>
          line.includes('鑑定書') ||
          line.includes('Paper') ||
          line.includes('重要刀剣') ||
          line.includes('特別保存') ||
          line.includes('保存刀剣') ||
          (line.includes('NBTHK') && line.length < 100) ||
          (line.includes('Hozon') && line.length < 100) ||
          (line.includes('Tokubetsu') && line.length < 100) ||
          (line.includes('Juyo') && line.length < 100)
        );

        if (certLines.length > 0) {
          console.log('\nCert-related lines from page:');
          certLines.slice(0, 10).forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              console.log('  |', trimmed.substring(0, 120));
            }
          });
        }

        // Check for navigation patterns
        const hasJuyoNav = text.includes('重要刀剣一覧') || text.includes('jyuyo.htm');
        const hasTokuhoNav = text.includes('特別保存一覧') || text.includes('tokubetsu');
        const hasHozonNav = text.includes('保存刀剣一覧') || text.includes('hozon');

        if (hasJuyoNav || hasTokuhoNav || hasHozonNav) {
          console.log('\nNavigation elements detected:');
          if (hasJuyoNav) console.log('  - Juyo nav link present');
          if (hasTokuhoNav) console.log('  - Tokubetsu Hozon nav link present');
          if (hasHozonNav) console.log('  - Hozon nav link present');
        }
      }
    });
  }
}

getDetailedSamples().catch(console.error);
