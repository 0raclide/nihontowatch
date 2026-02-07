require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const nihontoTypes = ['katana', 'wakizashi', 'tanto', 'tachi', 'kodachi', 'naginata', 'yari', 'ken', 'sword'];
  const juyoCerts = ['Juyo', 'juyo'];

  const { data, error } = await supabase.from('listings')
    .select('id, title, smith, school, item_type, artisan_matched_at')
    .in('cert_type', juyoCerts)
    .or(nihontoTypes.map(t => 'item_type.ilike.' + t).join(','))
    .is('artisan_id', null)
    .order('id')
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found', data.length, 'Juyo swords missing artisan_id\n');
  console.log('Sample (first 15):');
  data.slice(0, 15).forEach(l => {
    const matched = l.artisan_matched_at ? 'PROCESSED' : 'NEVER_RUN';
    console.log('  ID:', l.id, '|', (l.smith || 'NO_SMITH').substring(0,25).padEnd(25), '|', (l.school || '').substring(0,15).padEnd(15), '|', matched);
  });

  const processed = data.filter(l => l.artisan_matched_at).length;
  const neverRun = data.filter(l => !l.artisan_matched_at).length;
  console.log('\nStatus breakdown:');
  console.log('  Already processed (no match found):', processed);
  console.log('  Never processed:', neverRun);

  const ids = data.map(l => l.id);
  console.log('\nListing IDs:', ids.join(','));
}
check();
