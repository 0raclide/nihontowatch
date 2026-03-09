/**
 * Analyze impression-to-view curves to determine if we can reliably
 * predict estimated views from browse position and listing attributes.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

async function getTableCounts() {
  console.log('\n=== TABLE SIZES (last 30 days) ===\n');

  const { count: impressionCount } = await supabase
    .from('listing_impressions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', THIRTY_DAYS_AGO);

  const { count: viewCount } = await supabase
    .from('listing_views')
    .select('*', { count: 'exact', head: true })
    .gte('viewed_at', THIRTY_DAYS_AGO);

  const { count: totalImpressions } = await supabase
    .from('listing_impressions')
    .select('*', { count: 'exact', head: true });

  const { count: totalViews } = await supabase
    .from('listing_views')
    .select('*', { count: 'exact', head: true });

  console.log(`listing_impressions: ${totalImpressions} total, ${impressionCount} last 30d`);
  console.log(`listing_views: ${totalViews} total, ${viewCount} last 30d`);

  return { impressionCount, viewCount };
}

async function getImpressionsByPosition() {
  console.log('\n=== IMPRESSIONS BY POSITION BUCKET (last 30 days) ===\n');

  // Fetch impressions with position data
  const buckets: Record<string, number> = {};
  let offset = 0;
  const BATCH = 1000;
  let total = 0;

  while (true) {
    const { data, error } = await supabase
      .from('listing_impressions')
      .select('position')
      .gte('created_at', THIRTY_DAYS_AGO)
      .not('position', 'is', null)
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error('Error fetching impressions:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const pos = row.position;
      let bucket: string;
      if (pos <= 10) bucket = '1-10';
      else if (pos <= 20) bucket = '11-20';
      else if (pos <= 30) bucket = '21-30';
      else if (pos <= 50) bucket = '31-50';
      else if (pos <= 100) bucket = '51-100';
      else if (pos <= 200) bucket = '101-200';
      else bucket = '200+';
      buckets[bucket] = (buckets[bucket] || 0) + 1;
      total++;
    }

    offset += BATCH;
    if (data.length < BATCH) break;
  }

  const order = ['1-10', '11-20', '21-30', '31-50', '51-100', '101-200', '200+'];
  for (const b of order) {
    const count = buckets[b] || 0;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
    console.log(`  Position ${b.padEnd(8)}: ${String(count).padStart(7)} impressions (${pct}%)`);
  }
  console.log(`  Total with position: ${total}`);

  return { buckets, total };
}

async function getViewsByReferrer() {
  console.log('\n=== VIEWS BY REFERRER (last 30 days) ===\n');

  const referrers: Record<string, number> = {};
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listing_views')
      .select('referrer')
      .gte('viewed_at', THIRTY_DAYS_AGO)
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error('Error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      const ref = row.referrer || 'null';
      referrers[ref] = (referrers[ref] || 0) + 1;
    }

    offset += BATCH;
    if (data.length < BATCH) break;
  }

  for (const [ref, count] of Object.entries(referrers).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ref.padEnd(12)}: ${count}`);
  }
}

async function getViewsPerListing() {
  console.log('\n=== VIEW DISTRIBUTION PER LISTING (last 30 days) ===\n');

  // Get view counts per listing
  const viewCounts: Record<number, number> = {};
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listing_views')
      .select('listing_id')
      .gte('viewed_at', THIRTY_DAYS_AGO)
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error('Error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      viewCounts[row.listing_id] = (viewCounts[row.listing_id] || 0) + 1;
    }

    offset += BATCH;
    if (data.length < BATCH) break;
  }

  const counts = Object.values(viewCounts);
  if (counts.length === 0) {
    console.log('  No view data found');
    return {};
  }

  counts.sort((a, b) => b - a);

  console.log(`  Listings with views: ${counts.length}`);
  console.log(`  Max views: ${counts[0]}`);
  console.log(`  Median views: ${counts[Math.floor(counts.length / 2)]}`);
  console.log(`  Mean views: ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)}`);
  console.log(`  P90: ${counts[Math.floor(counts.length * 0.1)]}`);
  console.log(`  P75: ${counts[Math.floor(counts.length * 0.25)]}`);
  console.log(`  P25: ${counts[Math.floor(counts.length * 0.75)]}`);

  // Distribution buckets
  const distBuckets: Record<string, number> = {
    '1 view': 0, '2-3 views': 0, '4-5 views': 0,
    '6-10 views': 0, '11-20 views': 0, '21-50 views': 0, '50+ views': 0
  };
  for (const c of counts) {
    if (c === 1) distBuckets['1 view']++;
    else if (c <= 3) distBuckets['2-3 views']++;
    else if (c <= 5) distBuckets['4-5 views']++;
    else if (c <= 10) distBuckets['6-10 views']++;
    else if (c <= 20) distBuckets['11-20 views']++;
    else if (c <= 50) distBuckets['21-50 views']++;
    else distBuckets['50+ views']++;
  }

  console.log('\n  Distribution:');
  for (const [bucket, count] of Object.entries(distBuckets)) {
    const pct = ((count / counts.length) * 100).toFixed(1);
    console.log(`    ${bucket.padEnd(14)}: ${String(count).padStart(5)} listings (${pct}%)`);
  }

  return viewCounts;
}

async function getViewsByFeaturedScoreDecile() {
  console.log('\n=== VIEWS BY FEATURED SCORE DECILE (last 30 days) ===\n');

  // Get all available listings with their featured scores
  const listings: { id: number; featured_score: number }[] = [];
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, featured_score')
      .eq('is_available', true)
      .eq('admin_hidden', false)
      .not('featured_score', 'is', null)
      .gt('featured_score', 0)
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error('Error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    listings.push(...data);
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  console.log(`  Available listings with score > 0: ${listings.length}`);

  // Sort by score descending (= browse rank)
  listings.sort((a, b) => b.featured_score - a.featured_score);

  // Get view counts
  const viewCounts: Record<number, number> = {};
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('listing_views')
      .select('listing_id')
      .gte('viewed_at', THIRTY_DAYS_AGO)
      .range(offset, offset + BATCH - 1);

    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      viewCounts[row.listing_id] = (viewCounts[row.listing_id] || 0) + 1;
    }
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  // Break into deciles by rank position
  const decileSize = Math.ceil(listings.length / 10);
  for (let d = 0; d < 10; d++) {
    const start = d * decileSize;
    const end = Math.min(start + decileSize, listings.length);
    const slice = listings.slice(start, end);

    let totalViews = 0;
    let withViews = 0;
    for (const l of slice) {
      const v = viewCounts[l.id] || 0;
      totalViews += v;
      if (v > 0) withViews++;
    }

    const avgScore = slice.reduce((s, l) => s + l.featured_score, 0) / slice.length;
    const avgViews = totalViews / slice.length;
    const viewRate = ((withViews / slice.length) * 100).toFixed(0);

    console.log(
      `  Decile ${d + 1} (rank ${start + 1}-${end}, avg score ${avgScore.toFixed(0)}):` +
      ` ${avgViews.toFixed(1)} avg views, ${viewRate}% have views, ${totalViews} total`
    );
  }
}

async function getViewsByCertType() {
  console.log('\n=== VIEWS BY CERT TYPE (last 30 days) ===\n');

  // Get listing cert types
  const listingCerts: Record<number, string | null> = {};
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, cert_type')
      .eq('is_available', true)
      .range(offset, offset + BATCH - 1);

    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      listingCerts[row.id] = row.cert_type;
    }
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  // Get views
  const viewsByListing: Record<number, number> = {};
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('listing_views')
      .select('listing_id')
      .gte('viewed_at', THIRTY_DAYS_AGO)
      .range(offset, offset + BATCH - 1);

    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      viewsByListing[row.listing_id] = (viewsByListing[row.listing_id] || 0) + 1;
    }
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  // Aggregate by cert type
  const certStats: Record<string, { listings: number; views: number; withViews: number }> = {};

  for (const [idStr, cert] of Object.entries(listingCerts)) {
    const id = Number(idStr);
    const key = cert || 'No cert';
    if (!certStats[key]) certStats[key] = { listings: 0, views: 0, withViews: 0 };
    certStats[key].listings++;
    const v = viewsByListing[id] || 0;
    certStats[key].views += v;
    if (v > 0) certStats[key].withViews++;
  }

  const sorted = Object.entries(certStats).sort((a, b) => {
    const avgA = a[1].views / a[1].listings;
    const avgB = b[1].views / b[1].listings;
    return avgB - avgA;
  });

  for (const [cert, stats] of sorted) {
    const avg = (stats.views / stats.listings).toFixed(2);
    const rate = ((stats.withViews / stats.listings) * 100).toFixed(0);
    console.log(
      `  ${cert.padEnd(22)}: ${avg} avg views, ` +
      `${rate}% have views (${stats.listings} listings, ${stats.views} total views)`
    );
  }
}

async function getViewsByItemType() {
  console.log('\n=== VIEWS BY ITEM TYPE (last 30 days) ===\n');

  const listingTypes: Record<number, string> = {};
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, item_type')
      .eq('is_available', true)
      .range(offset, offset + BATCH - 1);

    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      listingTypes[row.id] = row.item_type || 'unknown';
    }
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  const viewsByListing: Record<number, number> = {};
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('listing_views')
      .select('listing_id')
      .gte('viewed_at', THIRTY_DAYS_AGO)
      .range(offset, offset + BATCH - 1);

    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      viewsByListing[row.listing_id] = (viewsByListing[row.listing_id] || 0) + 1;
    }
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  const typeStats: Record<string, { listings: number; views: number }> = {};

  for (const [idStr, type] of Object.entries(listingTypes)) {
    const id = Number(idStr);
    if (!typeStats[type]) typeStats[type] = { listings: 0, views: 0 };
    typeStats[type].listings++;
    typeStats[type].views += viewsByListing[id] || 0;
  }

  const sorted = Object.entries(typeStats).sort((a, b) => {
    return (b[1].views / b[1].listings) - (a[1].views / a[1].listings);
  });

  for (const [type, stats] of sorted) {
    const avg = (stats.views / stats.listings).toFixed(2);
    console.log(`  ${type.padEnd(18)}: ${avg} avg views (${stats.listings} listings)`);
  }
}

async function getDailyTrafficPattern() {
  console.log('\n=== DAILY TRAFFIC (last 14 days) ===\n');

  const dailyCounts: Record<string, number> = {};
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listing_views')
      .select('viewed_at')
      .gte('viewed_at', fourteenDaysAgo)
      .range(offset, offset + BATCH - 1);

    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const day = row.viewed_at.split('T')[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  const days = Object.keys(dailyCounts).sort();
  for (const day of days) {
    const count = dailyCounts[day];
    const bar = '█'.repeat(Math.ceil(count / 5));
    console.log(`  ${day}: ${String(count).padStart(5)} views ${bar}`);
  }

  if (days.length > 0) {
    const counts = days.map(d => dailyCounts[d]);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    console.log(`\n  Average: ${avg.toFixed(0)}/day, Min: ${min}, Max: ${max}`);
  }
}

async function getPositionVsViews() {
  console.log('\n=== POSITION vs VIEWS (impression-view join, last 30 days) ===\n');

  // Get all impressions with position in last 30 days, grouped by listing
  const impressionsByListing: Record<number, { count: number; avgPos: number; positions: number[] }> = {};
  let offset = 0;
  const BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listing_impressions')
      .select('listing_id, position')
      .gte('created_at', THIRTY_DAYS_AGO)
      .not('position', 'is', null)
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error('Error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (!impressionsByListing[row.listing_id]) {
        impressionsByListing[row.listing_id] = { count: 0, avgPos: 0, positions: [] };
      }
      impressionsByListing[row.listing_id].count++;
      impressionsByListing[row.listing_id].positions.push(row.position);
    }

    offset += BATCH;
    if (data.length < BATCH) break;
  }

  // Compute avg position per listing
  for (const entry of Object.values(impressionsByListing)) {
    entry.avgPos = entry.positions.reduce((a, b) => a + b, 0) / entry.positions.length;
  }

  // Get views per listing
  const viewsByListing: Record<number, number> = {};
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('listing_views')
      .select('listing_id')
      .gte('viewed_at', THIRTY_DAYS_AGO)
      .range(offset, offset + BATCH - 1);

    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      viewsByListing[row.listing_id] = (viewsByListing[row.listing_id] || 0) + 1;
    }
    offset += BATCH;
    if (data.length < BATCH) break;
  }

  // Join: bucket by avg position, compute avg views and CTR
  const posBuckets = [
    { label: '1-5', min: 0, max: 5 },
    { label: '6-10', min: 5, max: 10 },
    { label: '11-20', min: 10, max: 20 },
    { label: '21-50', min: 20, max: 50 },
    { label: '51-100', min: 50, max: 100 },
    { label: '101-200', min: 100, max: 200 },
    { label: '200+', min: 200, max: Infinity },
  ];

  const listingsWithImpressions = Object.keys(impressionsByListing).length;
  console.log(`  Listings with impression data: ${listingsWithImpressions}`);
  console.log(`  Listings with view data: ${Object.keys(viewsByListing).length}`);
  console.log('');

  for (const bucket of posBuckets) {
    const inBucket = Object.entries(impressionsByListing)
      .filter(([, v]) => v.avgPos >= bucket.min && v.avgPos < bucket.max);

    if (inBucket.length === 0) continue;

    let totalImps = 0;
    let totalViews = 0;
    for (const [idStr, imp] of inBucket) {
      totalImps += imp.count;
      totalViews += viewsByListing[Number(idStr)] || 0;
    }

    const avgImps = totalImps / inBucket.length;
    const avgViews = totalViews / inBucket.length;
    const ctr = totalImps > 0 ? ((totalViews / totalImps) * 100).toFixed(2) : 'N/A';

    console.log(
      `  Pos ${bucket.label.padEnd(8)}: ${inBucket.length} listings, ` +
      `${avgImps.toFixed(1)} avg imps, ${avgViews.toFixed(1)} avg views, CTR ${ctr}%`
    );
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   VIEW PREDICTION CURVE ANALYSIS                 ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  await getTableCounts();
  await getDailyTrafficPattern();
  await getViewsByReferrer();
  await getViewsPerListing();
  await getImpressionsByPosition();
  await getPositionVsViews();
  await getViewsByFeaturedScoreDecile();
  await getViewsByCertType();
  await getViewsByItemType();

  console.log('\n=== DONE ===');
}

main().catch(console.error);
