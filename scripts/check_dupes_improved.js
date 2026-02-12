/**
 * Improved duplicate checker that uses proper Wix media ID extraction
 * (handles bad354_, ac7782_, 942188_ prefixes, not just a74e70_).
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function extractMediaId(url) {
  // Match any 6-char hex prefix + underscore + 20+ hex chars
  const m1 = url.match(/([a-f0-9]{6}_[a-f0-9]{20,})/);
  if (m1) return m1[1];
  // Standalone 32-char hex
  const m2 = url.match(/\/media\/([a-f0-9]{32})/);
  if (m2) return m2[1];
  // Strip query params for non-Wix
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

const UI_PATTERNS = [
  'w_73,h_27', 'w_50,h_27', 'w_40,h_', 'w_32,h_', '/thumb_',
  'button', 'icon', 'logo', 'banner', 'header', 'footer',
  '_fw.png', 'spacer', 'arrow', 'cart'
];

function isUiElement(url) {
  const lower = url.toLowerCase();
  return UI_PATTERNS.some(p => lower.includes(p));
}

async function main() {
  const { data: listings } = await supabase
    .from('listings')
    .select('id, url, title, title_en, images, item_type, dealer_id, price_value')
    .eq('dealer_id', 9)
    .eq('is_available', true)
    .order('id', { ascending: true });

  console.log('Total Choshuya available:', listings.length);

  // Group by first product image media ID (skip UI elements)
  const groups = {};
  for (const l of listings) {
    const productImages = (l.images || []).filter(img => !isUiElement(img));
    if (productImages.length === 0) continue;
    const key = extractMediaId(productImages[0]);
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  }

  const dupes = Object.entries(groups)
    .filter(([_, ls]) => ls.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('Duplicate groups:', dupes.length);

  let realDupes = 0;
  let falsePosGroups = 0;
  const toRemove = [];

  for (const [key, ls] of dupes) {
    const types = new Set(ls.map(l => l.item_type));
    // Different item types with same first image = false positive (Wix template)
    const isFalsePositive = types.size > 1;

    if (isFalsePositive) {
      falsePosGroups++;
    } else {
      realDupes++;
      const sorted = ls.sort((a, b) => a.id - b.id);
      for (let i = 1; i < sorted.length; i++) {
        toRemove.push({ keep: sorted[0].id, remove: sorted[i].id });
      }
    }

    console.log('\n' + (isFalsePositive ? '[FALSE POS]' : '[REAL DUPE]') + ' Group of ' + ls.length + ':');
    for (const l of ls) {
      const title = (l.title_en || l.title || '').substring(0, 55);
      console.log('  [' + l.id + '] ' + l.item_type + ' | ' + title);
      console.log('         ' + decodeURIComponent(l.url).substring(0, 90));
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Real duplicate groups:', realDupes);
  console.log('False positive groups:', falsePosGroups);
  console.log('Listings to remove:', toRemove.length);
  if (toRemove.length > 0) {
    console.log('\nKEEP/REMOVE pairs:');
    for (const r of toRemove) {
      console.log('  KEEP [' + r.keep + '] REMOVE [' + r.remove + ']');
    }
  }
}

main().catch(console.error);
