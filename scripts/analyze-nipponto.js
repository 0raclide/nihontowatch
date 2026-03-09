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

  // Get specific examples for each cert type
  const queries = [
    { cert: 'JUYO', label: 'JUYO' },
    { cert: 'TOKUBETSU_HOZON', label: 'TOKUHO' },
    { cert: 'HOZON', label: 'HOZON' },
    { cert: null, label: 'NULL' }
  ];

  for (const q of queries) {
    const query = supabase
      .from('listings')
      .select('id, url, title, cert_type, raw_page_text')
      .eq('dealer_id', dealer.id)
      .is('page_exists', true)
      .limit(2);

    if (q.cert === null) {
      query.is('cert_type', null);
    } else {
      query.eq('cert_type', q.cert);
    }

    const { data } = await query;

    console.log('\n' + '='.repeat(80));
    console.log(`CERT TYPE: ${q.label}`);
    console.log('='.repeat(80));

    data?.forEach((l, idx) => {
      console.log(`\n--- Sample ${idx + 1} ---`);
      console.log('URL:', l.url);
      console.log('Title:', l.title);
      console.log('Cert:', l.cert_type);

      // Extract relevant portions of raw_page_text
      if (l.raw_page_text) {
        const text = l.raw_page_text;

        // Look for cert-related sections
        const certMatches = text.match(/(鑑定書|認定書|証書|Paper|NBTHK|NTHK|重要|特別保存|保存|Juyo|Tokubetsu).{0,100}/gi);

        if (certMatches && certMatches.length > 0) {
          console.log('\nCert-related text snippets:');
          certMatches.slice(0, 5).forEach(m => {
            console.log('  -', m.substring(0, 150));
          });
        }

        // Look for navigation links
        const navMatches = text.match(/(重要刀剣|特別保存|保存刀剣|Juyo|Tokubetsu).{0,50}(href|link|class)/gi);
        if (navMatches) {
          console.log('\nPossible navigation elements:');
          navMatches.slice(0, 3).forEach(m => {
            console.log('  -', m);
          });
        }
      }
    });
  }
}

getDetailedSamples().catch(console.error);
