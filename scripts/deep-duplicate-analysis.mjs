import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepAnalysis() {
  console.log("=== COMPREHENSIVE DUPLICATE ANALYSIS ===\n");
  
  // Get all available listings with images
  const { data: allListings, error } = await supabase
    .from('listings')
    .select('id, url, dealer_id, title, images, nagasa_cm, smith')
    .eq('is_available', true);
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Total available listings: ${allListings.length}\n`);
  
  // Find true duplicates by comparing image sets
  console.log("Finding duplicates by image fingerprinting...\n");
  
  // Create image set fingerprints
  const imageFingerprints = new Map();
  const trueDuplicates = [];
  
  for (const listing of allListings) {
    const images = Array.isArray(listing.images) ? listing.images : [];
    if (images.length === 0) continue;
    
    // Sort and join images as fingerprint
    const fingerprint = images.slice().sort().join('|');
    
    if (imageFingerprints.has(fingerprint)) {
      const existing = imageFingerprints.get(fingerprint);
      trueDuplicates.push({
        original: existing,
        duplicate: listing,
        imageCount: images.length
      });
    } else {
      imageFingerprints.set(fingerprint, listing);
    }
  }
  
  console.log(`Found ${trueDuplicates.length} TRUE DUPLICATES (identical image sets)\n`);
  console.log("=".repeat(70));
  
  // Group by dealer
  const byDealer = {};
  for (const dup of trueDuplicates) {
    const dealerId = dup.original.dealer_id;
    if (!byDealer[dealerId]) byDealer[dealerId] = [];
    byDealer[dealerId].push(dup);
  }
  
  // Get dealer names
  const { data: dealers } = await supabase
    .from('dealers')
    .select('id, name, domain')
    .in('id', Object.keys(byDealer).map(Number));
  
  const dealerMap = {};
  for (const d of dealers || []) {
    dealerMap[d.id] = d;
  }
  
  for (const [dealerId, dups] of Object.entries(byDealer)) {
    const dealer = dealerMap[dealerId] || { name: 'Unknown', domain: 'unknown' };
    console.log(`\n### ${dealer.name} (${dealer.domain}) - ${dups.length} duplicate pairs ###`);
    
    for (const dup of dups) {
      console.log(`\nOriginal ID ${dup.original.id}:`);
      console.log(`  URL: ${dup.original.url}`);
      console.log(`  Title: ${dup.original.title}`);
      console.log(`Duplicate ID ${dup.duplicate.id}:`);
      console.log(`  URL: ${dup.duplicate.url}`);
      console.log(`  Title: ${dup.duplicate.title}`);
      console.log(`  Shared Images: ${dup.imageCount}`);
    }
  }
  
  console.log("\n\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total available listings: ${allListings.length}`);
  console.log(`True duplicates found: ${trueDuplicates.length}`);
  console.log(`Affected dealers: ${Object.keys(byDealer).length}`);
  console.log(`Duplicate rate: ${(trueDuplicates.length / allListings.length * 100).toFixed(2)}%`);
}

deepAnalysis().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
