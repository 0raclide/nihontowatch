require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Check listing 31363
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, dealer_id, first_seen_at, title, dealers(id, name)')
    .eq('id', 31363)
    .single();

  if (listingError) {
    console.log('Error fetching listing 31363:', listingError.message);
  } else {
    console.log('Listing 31363:');
    console.log('  Dealer ID:', listing.dealer_id);
    console.log('  Dealer Name:', listing.dealers?.name);
    console.log('  First Seen:', listing.first_seen_at);
    console.log('  Title:', listing.title?.substring(0, 60));
  }

  // Get actual total count
  const { count } = await supabase.from('listings').select('*', { count: 'exact', head: true });
  console.log('\nTotal listings in DB:', count);

  // Sample across the full range of IDs
  const { data: highIdSample } = await supabase
    .from('listings')
    .select('id, dealer_id, dealers(name)')
    .order('id', { ascending: false })
    .limit(20);

  console.log('\nRecent listings (high IDs):');
  const seenDealers = new Set();
  for (const l of highIdSample || []) {
    if (!seenDealers.has(l.dealer_id)) {
      seenDealers.add(l.dealer_id);
      console.log('  ID', l.id, '- Dealer:', l.dealers?.name, '(ID', l.dealer_id + ')');
    }
  }

  // Get ALL unique dealer_ids
  const allDealerIds = new Map();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data: page } = await supabase
      .from('listings')
      .select('dealer_id, dealers(name)')
      .range(offset, offset + pageSize - 1);

    if (!page || page.length === 0) break;

    for (const l of page) {
      if (!allDealerIds.has(l.dealer_id)) {
        allDealerIds.set(l.dealer_id, l.dealers?.name || 'Unknown');
      }
    }

    offset += pageSize;
    if (page.length < pageSize) break;
  }

  console.log('\nALL unique dealers with listings:');
  const sorted = Array.from(allDealerIds.entries()).sort((a, b) => a[0] - b[0]);
  for (const [id, name] of sorted) {
    // Get count for this dealer
    const { count: dealerCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('dealer_id', id);
    console.log('  ID', id, ':', name, '-', dealerCount, 'listings');
  }
}

main().catch(console.error);
