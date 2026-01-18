#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Look for image URLs with certificate-related keywords
const keywords = ['paper', 'cert', 'nbthk', 'shinsa', 'kanteisho', 'nthk', 'hozon', 'juyo', 'tokubetsu'];

const { data: listings } = await supabase
  .from('listings')
  .select('id, url, images')
  .not('images', 'is', null)
  .limit(2000);

let found = [];
for (const listing of listings) {
  if (!listing.images) continue;
  for (const img of listing.images) {
    const lower = img.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        found.push({
          listing_id: listing.id,
          dealer: listing.url.match(/https?:\/\/([^\/]+)/)?.[1],
          img: img.split('/').pop(),
          full_url: img,
          keyword: kw
        });
        break;
      }
    }
  }
}

console.log('Found', found.length, 'images with certificate keywords');
console.log('\nBy keyword:');
const byKeyword = {};
found.forEach(f => {
  byKeyword[f.keyword] = (byKeyword[f.keyword] || 0) + 1;
});
console.log(byKeyword);

console.log('\nBy dealer:');
const byDealer = {};
found.forEach(f => {
  byDealer[f.dealer] = (byDealer[f.dealer] || 0) + 1;
});
Object.entries(byDealer).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => {
  console.log(' ', d, ':', c);
});

console.log('\nExamples:');
found.slice(0, 20).forEach(f => {
  console.log(' ', f.listing_id, '|', f.keyword, '|', f.img);
});

// Output full URLs for first 5
console.log('\nSample URLs for testing:');
found.slice(0, 5).forEach(f => {
  console.log(f.full_url);
});
