require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('listings')
    .select('id, url, title, images, stored_images, price_value, item_type, is_available')
    .eq('dealer_id', 30)
    .eq('is_available', true);

  if (error) { console.error('Error:', error); return; }

  console.log('=== SANMEI LISTINGS INTEGRITY CHECK ===\n');
  console.log('Total listings:', data.length);

  // Image stats
  const noImages = data.filter(l => !l.images || l.images.length === 0);
  const hasImages = data.filter(l => l.images && l.images.length > 0);
  const hasPUP = data.filter(l => l.images?.some(img => img.includes('_PUP')));
  const hasMalformed = data.filter(l => l.images?.some(img => img.includes('/../')));
  const hasStoredImages = data.filter(l => l.stored_images && l.stored_images.length > 0);

  console.log('\n--- IMAGE STATS ---');
  console.log('With images:', hasImages.length);
  console.log('Without images:', noImages.length);
  console.log('With blade photos (PUP):', hasPUP.length);
  console.log('With malformed URLs:', hasMalformed.length);
  console.log('With stored_images (may cause duplicates):', hasStoredImages.length);

  // Data completeness
  const noTitle = data.filter(l => !l.title);
  const noPrice = data.filter(l => !l.price_value);
  const noType = data.filter(l => !l.item_type || l.item_type === 'unknown');

  console.log('\n--- DATA COMPLETENESS ---');
  console.log('Missing title:', noTitle.length);
  console.log('Missing price:', noPrice.length);
  console.log('Missing/unknown item_type:', noType.length);

  // List problematic listings
  if (noImages.length > 0) {
    console.log('\n--- LISTINGS WITHOUT IMAGES ---');
    noImages.forEach(l => console.log('  ID:', l.id, '-', l.url));
  }

  if (hasMalformed.length > 0) {
    console.log('\n--- LISTINGS WITH MALFORMED URLs ---');
    hasMalformed.forEach(l => console.log('  ID:', l.id, '-', l.url));
  }

  if (hasStoredImages.length > 0) {
    console.log('\n--- LISTINGS WITH stored_images (potential duplicates) ---');
    hasStoredImages.forEach(l => console.log('  ID:', l.id, '-', l.stored_images?.length, 'cached images'));
  }

  // Check for duplicate images within listings
  const withDupes = data.filter(l => {
    if (!l.images) return false;
    const unique = new Set(l.images);
    return unique.size !== l.images.length;
  });

  if (withDupes.length > 0) {
    console.log('\n--- LISTINGS WITH DUPLICATE IMAGES ---');
    withDupes.forEach(l => console.log('  ID:', l.id));
  } else {
    console.log('\n--- No duplicate images found ---');
  }

  // Image count distribution
  const imgCounts = {};
  hasImages.forEach(l => {
    const count = l.images.length;
    imgCounts[count] = (imgCounts[count] || 0) + 1;
  });
  console.log('\n--- IMAGE COUNT DISTRIBUTION ---');
  Object.entries(imgCounts).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([count, num]) => {
    console.log('  ' + count + ' images:', num, 'listings');
  });

  // Sample a few listings with images
  console.log('\n--- SAMPLE LISTINGS WITH IMAGES ---');
  hasImages.slice(0, 3).forEach(l => {
    console.log('\nID:', l.id);
    console.log('Title:', l.title?.substring(0, 50) + '...');
    console.log('Images:');
    l.images.forEach((img, i) => console.log('  ' + (i+1) + '.', img.substring(img.lastIndexOf('/') + 1)));
  });
})();
