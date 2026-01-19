const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Total listings
  const { count: totalListings } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true });

  console.log('Total listings in database:', totalListings);

  // Get all listings dealer_ids
  const { data: listings } = await supabase
    .from('listings')
    .select('dealer_id');

  const dealerCounts = {};
  for (const l of listings || []) {
    dealerCounts[l.dealer_id] = (dealerCounts[l.dealer_id] || 0) + 1;
  }

  console.log('\nUnique dealers with listings:', Object.keys(dealerCounts).length);

  // Get dealer names
  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name, is_active');

  const dealerMap = {};
  for (const d of dealers) {
    dealerMap[d.id] = d;
  }

  console.log('\n=== LISTINGS BY DEALER ===');
  const sorted = Object.entries(dealerCounts).sort((a, b) => b[1] - a[1]);
  for (const [id, count] of sorted) {
    const dealer = dealerMap[id];
    console.log(`${dealer?.name || 'Unknown'} (ID ${id}): ${count} listings`);
  }

  // Dealers with no listings
  console.log('\n=== DEALERS WITH NO LISTINGS ===');
  for (const d of dealers) {
    if (!dealerCounts[d.id] && d.is_active) {
      console.log(`${d.name} (ID ${d.id})`);
    }
  }
}

main().catch(console.error);
