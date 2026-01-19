require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  console.log('Current time:', now.toISOString());
  console.log('14 days ago:', fourteenDaysAgo.toISOString());

  // Get unique dealer IDs
  const dealerIds = [1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 38, 39];

  console.log('\n=== DEALER BASELINES ===');

  const established = [];
  const newDealers = [];

  for (const dealerId of dealerIds) {
    // Get earliest first_seen_at for this dealer
    const { data } = await supabase
      .from('listings')
      .select('first_seen_at, dealers(name)')
      .eq('dealer_id', dealerId)
      .order('first_seen_at', { ascending: true })
      .limit(1)
      .single();

    if (data) {
      const baseline = new Date(data.first_seen_at);
      const daysOld = Math.floor((now - baseline) / (24 * 60 * 60 * 1000));
      const isEstablished = baseline < fourteenDaysAgo;
      const status = isEstablished ? 'ESTABLISHED' : 'NEW';

      console.log(`${data.dealers?.name}: ${data.first_seen_at.substring(0, 10)} (${daysOld}d) - ${status}`);

      if (isEstablished) {
        established.push({ id: dealerId, name: data.dealers?.name });
      } else {
        newDealers.push({ id: dealerId, name: data.dealers?.name, baseline: data.first_seen_at });
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Established dealers:', established.length);
  console.log('New dealers (no badges):', newDealers.length);

  if (newDealers.length > 0) {
    console.log('\nNew dealers that should NOT show badges:');
    for (const d of newDealers) {
      console.log(`  - ${d.name} (baseline: ${d.baseline.substring(0, 10)})`);

      // Get a sample listing from this dealer
      const { data: sample } = await supabase
        .from('listings')
        .select('id')
        .eq('dealer_id', d.id)
        .eq('is_available', true)
        .limit(1)
        .single();

      if (sample) {
        console.log(`    Test URL: https://nihontowatch.com/listing/${sample.id}`);
      }
    }
  }

  // Find recent listings from established dealers
  console.log('\n=== RECENT LISTINGS FROM ESTABLISHED DEALERS (should show badge) ===');
  const establishedIds = established.map(d => d.id);

  const { data: recentEstablished } = await supabase
    .from('listings')
    .select('id, first_seen_at, dealers(name)')
    .in('dealer_id', establishedIds)
    .gte('first_seen_at', fourteenDaysAgo.toISOString())
    .eq('is_available', true)
    .order('first_seen_at', { ascending: false })
    .limit(5);

  for (const l of recentEstablished || []) {
    const days = Math.floor((now - new Date(l.first_seen_at)) / (24 * 60 * 60 * 1000));
    console.log(`ID ${l.id}: ${l.dealers?.name} - ${days}d ago`);
    console.log(`  https://nihontowatch.com/listing/${l.id}`);
  }
}

main().catch(console.error);
