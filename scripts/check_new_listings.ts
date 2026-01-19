import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNewListings() {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get dealer baselines (earliest first_seen_at per dealer)
  const { data: baselines } = await supabase
    .from('listings')
    .select('dealer_id, first_seen_at, dealers!inner(name)')
    .order('first_seen_at', { ascending: true });

  const dealerBaselines: Record<number, { earliest: string; name: string }> = {};
  for (const row of baselines || []) {
    if (!dealerBaselines[row.dealer_id]) {
      dealerBaselines[row.dealer_id] = {
        earliest: row.first_seen_at,
        name: (row.dealers as any).name
      };
    }
  }

  // Categorize dealers
  const establishedDealers: number[] = [];
  const newDealers: number[] = [];

  for (const [dealerId, info] of Object.entries(dealerBaselines)) {
    const baselineDate = new Date(info.earliest);
    if (baselineDate < fourteenDaysAgo) {
      establishedDealers.push(Number(dealerId));
    } else {
      newDealers.push(Number(dealerId));
    }
  }

  console.log('\n=== DEALER BASELINES ===');
  console.log('Established dealers (baseline > 14 days):', establishedDealers.length);
  console.log('New dealers (baseline < 14 days):', newDealers.length);

  // Show new dealers
  if (newDealers.length > 0) {
    console.log('\nNew dealers (will NOT show badges):');
    for (const id of newDealers) {
      const info = dealerBaselines[id];
      const dateStr = info.earliest.substring(0, 10);
      console.log('  -', info.name, ': baseline', dateStr);
    }
  }

  // Find recent listings from ESTABLISHED dealers (should show badge)
  const { data: recentFromEstablished } = await supabase
    .from('listings')
    .select('id, title, first_seen_at, dealer_id, dealers!inner(name)')
    .in('dealer_id', establishedDealers)
    .gte('first_seen_at', fourteenDaysAgo.toISOString())
    .eq('is_available', true)
    .order('first_seen_at', { ascending: false })
    .limit(10);

  console.log('\n=== LISTINGS THAT SHOULD SHOW "New" BADGE ===');
  if (recentFromEstablished && recentFromEstablished.length > 0) {
    for (const listing of recentFromEstablished) {
      const days = Math.floor((now.getTime() - new Date(listing.first_seen_at).getTime()) / (24*60*60*1000));
      const dealerName = (listing.dealers as any).name;
      const titleSnippet = listing.title ? listing.title.substring(0, 50) : 'No title';
      console.log('ID', listing.id, ':', dealerName, '-', days, 'd ago');
      console.log('  Title:', titleSnippet);
      console.log('  URL: https://nihontowatch.com/listing/' + listing.id);
    }
  } else {
    console.log('No recent listings from established dealers found.');
  }

  // Find listings from NEW dealers (should NOT show badge)
  if (newDealers.length > 0) {
    const { data: fromNewDealers } = await supabase
      .from('listings')
      .select('id, title, first_seen_at, dealer_id, dealers!inner(name)')
      .in('dealer_id', newDealers)
      .eq('is_available', true)
      .order('first_seen_at', { ascending: false })
      .limit(5);

    console.log('\n=== LISTINGS THAT SHOULD NOT SHOW BADGE (new dealer) ===');
    if (fromNewDealers && fromNewDealers.length > 0) {
      for (const listing of fromNewDealers) {
        const days = Math.floor((now.getTime() - new Date(listing.first_seen_at).getTime()) / (24*60*60*1000));
        const dealerName = (listing.dealers as any).name;
        console.log('ID', listing.id, ':', dealerName, '-', days, 'd ago');
        console.log('  URL: https://nihontowatch.com/listing/' + listing.id);
      }
    }
  }
}

checkNewListings().catch(console.error);
