require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FIELDS = 'id, url, title, title_en, price_value, price_currency, images, stored_images, item_type, smith, school, cert_type, status, is_available, first_seen_at, last_scraped_at, dealer_id, tosogu_maker, tosogu_school, nagasa_cm, mei_type';

function extractMediaIds(images) {
  return (images || []).map(url => {
    const match = url.match(/a74e70_([a-f0-9]+)/);
    return match ? match[1] : url;
  }).sort();
}

async function main() {
  console.log('='.repeat(100));
  console.log('PART 1: Compare listings 50174, 50175, 50176');
  console.log('='.repeat(100));

  const { data: trio, error: trioErr } = await supabase
    .from('listings')
    .select(FIELDS)
    .in('id', [50174, 50175, 50176]);

  if (trioErr) {
    console.error('Error fetching trio:', trioErr.message);
    return;
  }

  if (!trio || trio.length === 0) {
    console.log('No listings found with those IDs.');
    return;
  }

  const fields = ['id', 'url', 'title', 'title_en', 'price_value', 'price_currency', 'item_type', 'smith', 'school', 'tosogu_maker', 'tosogu_school', 'cert_type', 'mei_type', 'nagasa_cm', 'status', 'is_available', 'first_seen_at', 'last_scraped_at', 'dealer_id'];
  
  for (const field of fields) {
    console.log('\n  ' + field + ':');
    trio.forEach(l => {
      let val = l[field];
      if (val === null || val === undefined) val = '(null)';
      else if (typeof val === 'string' && val.length > 80) val = val.substring(0, 80) + '...';
      else val = String(val);
      console.log('    [' + l.id + '] ' + val);
    });
  }

  console.log('\n  images:');
  trio.forEach(l => {
    const imgs = l.images || [];
    console.log('    [' + l.id + '] (' + imgs.length + ' images)');
    imgs.forEach((img, i) => console.log('      ' + i + ': ' + img));
  });

  console.log('\n  Media ID comparison (ignoring resize params):');
  trio.forEach(l => {
    console.log('    [' + l.id + '] ' + extractMediaIds(l.images).join(', '));
  });

  console.log('\n  Decoded URLs:');
  trio.forEach(l => {
    console.log('    [' + l.id + '] ' + decodeURIComponent(l.url));
  });

  // -------------------------------------------------------
  console.log('\n\n' + '='.repeat(100));
  console.log('PART 2: Find ALL Choshuya duplicates (both dealer IDs 9 and 62)');
  console.log('='.repeat(100));

  // Find both Choshuya dealers
  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name, domain')
    .ilike('name', '%choshuya%');

  console.log('\nChoshuya dealers:');
  dealers.forEach(d => console.log('  id=' + d.id + ' name="' + d.name + '" domain=' + d.domain));

  const dealerIds = dealers.map(d => d.id);

  // Fetch ALL available listings from both Choshuya dealers
  const { data: allListings, error: allErr } = await supabase
    .from('listings')
    .select('id, url, title, title_en, price_value, price_currency, images, item_type, smith, school, cert_type, status, is_available, first_seen_at, last_scraped_at, dealer_id')
    .in('dealer_id', dealerIds)
    .eq('is_available', true)
    .order('id', { ascending: true });

  if (allErr) {
    console.error('Error fetching listings:', allErr.message);
    return;
  }

  console.log('Total available Choshuya listings (both dealers): ' + allListings.length);
  
  // Count per dealer
  const perDealer = {};
  allListings.forEach(l => {
    perDealer[l.dealer_id] = (perDealer[l.dealer_id] || 0) + 1;
  });
  Object.entries(perDealer).forEach(([did, count]) => {
    const d = dealers.find(x => x.id === Number(did));
    console.log('  Dealer ' + did + ' (' + (d ? d.name : '?') + '): ' + count + ' listings');
  });

  // Group by first image media ID (loosest useful match)
  const imageGroups = {};
  for (const listing of allListings) {
    const ids = extractMediaIds(listing.images);
    if (ids.length === 0) continue;
    const key = ids[0]; // First image media ID
    if (!imageGroups[key]) imageGroups[key] = [];
    imageGroups[key].push(listing);
  }

  const dupeGroups = Object.entries(imageGroups)
    .filter(([_, listings]) => listings.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('\nDuplicate groups (same first image media ID): ' + dupeGroups.length);
  
  let totalDuplicateListings = 0;

  for (const [key, listings] of dupeGroups) {
    totalDuplicateListings += listings.length - 1; // count the extras
    console.log('\n' + '-'.repeat(80));
    console.log('GROUP: ' + listings.length + ' listings | First image media ID: ' + key);
    
    for (const l of listings) {
      const title = (l.title_en || l.title || '(no title)').substring(0, 70);
      console.log('  [' + l.id + '] (dealer ' + l.dealer_id + ') ' + title);
      console.log('         URL: ' + decodeURIComponent(l.url).substring(0, 100));
      console.log('         Price: ' + l.price_value + ' ' + l.price_currency + ' | Type: ' + l.item_type + ' | Cert: ' + (l.cert_type || 'none'));
      console.log('         Images: ' + (l.images || []).length + ' | First seen: ' + l.first_seen_at);
    }

    const urls = new Set(listings.map(l => l.url));
    const dealerSet = new Set(listings.map(l => l.dealer_id));
    if (urls.size < listings.length) {
      console.log('  >>> HAS URL DUPLICATES');
    }
    if (dealerSet.size > 1) {
      console.log('  >>> CROSS-DEALER duplicates (IDs: ' + [...dealerSet].join(', ') + ')');
    }
    console.log('  >>> ' + urls.size + ' unique URLs across ' + dealerSet.size + ' dealer(s)');
  }

  // Also try grouping by ALL image media IDs (stricter)
  console.log('\n\n' + '='.repeat(100));
  console.log('PART 2b: Strict duplicates (ALL image media IDs match)');
  console.log('='.repeat(100));

  const strictGroups = {};
  for (const listing of allListings) {
    const key = JSON.stringify(extractMediaIds(listing.images));
    if (!strictGroups[key]) strictGroups[key] = [];
    strictGroups[key].push(listing);
  }

  const strictDupes = Object.entries(strictGroups)
    .filter(([_, ls]) => ls.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('Strict duplicate groups (all images match): ' + strictDupes.length);

  for (const [key, listings] of strictDupes) {
    console.log('\n' + '-'.repeat(80));
    console.log('GROUP: ' + listings.length + ' listings | Media IDs: ' + key);
    for (const l of listings) {
      console.log('  [' + l.id + '] ' + (l.title_en || '').substring(0, 60) + ' | ' + decodeURIComponent(l.url).substring(0, 80));
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  console.log('Total available Choshuya listings: ' + allListings.length);
  console.log('Duplicate groups (first image match): ' + dupeGroups.length);
  console.log('Extra duplicate listings to clean up: ' + totalDuplicateListings);
  console.log('Strict duplicate groups (all images match): ' + strictDupes.length);
  
  if (dupeGroups.length > 0) {
    console.log('\nListing IDs that appear to be duplicates (keeping lowest ID, flagging higher IDs):');
    const toRemove = [];
    for (const [_, listings] of dupeGroups) {
      const sorted = listings.sort((a, b) => a.id - b.id);
      // Keep the first, flag the rest
      for (let i = 1; i < sorted.length; i++) {
        toRemove.push({ keep: sorted[0].id, remove: sorted[i].id, url: sorted[i].url });
      }
    }
    toRemove.forEach(r => {
      console.log('  KEEP [' + r.keep + '] DUPE [' + r.remove + '] ' + decodeURIComponent(r.url).substring(0, 80));
    });
  }
}

main().catch(console.error);
