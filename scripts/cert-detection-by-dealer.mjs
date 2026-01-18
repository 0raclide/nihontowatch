#!/usr/bin/env node
/**
 * Certificate Detection Test - Per Dealer
 * Tests ALL images in listings (not just first 10)
 *
 * Usage: node scripts/cert-detection-by-dealer.mjs <dealer_domain> [--sample N]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

// Parse .env.local
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Parse args
const args = process.argv.slice(2);
const dealer = args[0];
const sampleSize = args.includes('--sample') ? parseInt(args[args.indexOf('--sample') + 1]) : 10;

if (!dealer) {
  console.error('Usage: node cert-detection-by-dealer.mjs <dealer_domain> [--sample N]');
  process.exit(1);
}

const OUTPUT_DIR = 'certificate-detection-results';
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);

/**
 * Analyze image for certificate
 */
async function analyzeImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, { timeout: 15000 });
    if (!response.ok) return { error: 'fetch_failed', status: response.status };

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image')) {
      return { error: 'not_image', contentType };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Normalize content type
    let mediaType = contentType.split(';')[0].trim();
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      mediaType = 'image/jpeg'; // Default fallback
    }

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Is this image a Japanese sword certification document (NBTHK/NTHK paper)?

Look for:
- Paper/document (not a sword blade, fittings, or koshirae)
- Japanese text (especially vertical)
- Red circular seal (印)
- Words: 重要刀剣, 特別保存, 保存刀剣, 鑑定書

If YES (certificate), extract:
- cert_type: "juyo"|"tokubetsu_juyo"|"tokubetsu_hozon"|"hozon"|"nthk"|"other"
- session_number: from 第X回 (null if not visible)
- item_number: from 第X号 or document number (null if not visible)
- smith_name: main attribution text

Respond ONLY with JSON:
{"is_cert":true/false,"confidence":0.0-1.0,"cert_type":null,"session":null,"item":null,"smith":null,"reason":"brief"}`
          }
        ]
      }]
    });

    const text = result.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: 'parse_failed', raw: text.slice(0, 200) };
  } catch (e) {
    return { error: e.message?.slice(0, 100) || 'unknown' };
  }
}

/**
 * Process a listing - check ALL images
 */
async function processListing(listing) {
  const results = {
    listing_id: listing.id,
    title: listing.title?.slice(0, 60),
    db_cert_type: listing.cert_type,
    image_count: listing.images?.length || 0,
    cert_found: false,
    cert_image_index: null,
    cert_data: null,
    all_analyses: [],
  };

  if (!listing.images || listing.images.length === 0) {
    results.error = 'no_images';
    return results;
  }

  // Check ALL images
  for (let i = 0; i < listing.images.length; i++) {
    const imgUrl = listing.images[i];
    const analysis = await analyzeImage(imgUrl);

    results.all_analyses.push({
      index: i,
      filename: imgUrl.split('/').pop(),
      ...analysis
    });

    if (analysis.is_cert && analysis.confidence >= 0.7) {
      results.cert_found = true;
      results.cert_image_index = i;
      results.cert_data = analysis;
      // Continue checking remaining images for additional cert pages
    }

    // Small delay between images
    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

async function main() {
  console.log(`\n🔍 Certificate Detection Test: ${dealer}`);
  console.log('='.repeat(60));

  // Get listings with certs from this dealer
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, url, title, images, cert_type')
    .ilike('url', `%${dealer}%`)
    .not('cert_type', 'is', null)
    .not('images', 'is', null)
    .order('id', { ascending: false })
    .limit(sampleSize);

  if (error) {
    console.error('DB Error:', error);
    process.exit(1);
  }

  console.log(`Found ${listings.length} certified listings to test\n`);

  const results = [];
  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    console.log(`[${i + 1}/${listings.length}] Listing ${listing.id}: ${listing.title?.slice(0, 40)}...`);
    console.log(`  Images: ${listing.images?.length}, DB cert: ${listing.cert_type}`);

    const result = await processListing(listing);
    results.push(result);

    if (result.cert_found) {
      console.log(`  ✅ CERT FOUND at image ${result.cert_image_index}`);
      console.log(`     Type: ${result.cert_data?.cert_type}, Session: ${result.cert_data?.session || 'N/A'}`);
      if (result.cert_data?.smith) console.log(`     Smith: ${result.cert_data.smith}`);
    } else {
      console.log(`  ❌ No certificate found in ${result.image_count} images`);
    }
    console.log('');

    // Delay between listings
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const withCert = results.filter(r => r.cert_found);
  const withSession = results.filter(r => r.cert_data?.session);
  const withItem = results.filter(r => r.cert_data?.item);
  const withSmith = results.filter(r => r.cert_data?.smith);

  const totalImages = results.reduce((sum, r) => sum + r.image_count, 0);
  const certImages = results.reduce((sum, r) =>
    sum + r.all_analyses.filter(a => a.is_cert && a.confidence >= 0.7).length, 0);

  console.log(`Dealer: ${dealer}`);
  console.log(`Listings tested: ${results.length}`);
  console.log(`Total images analyzed: ${totalImages}`);
  console.log(`Certificate images found: ${certImages}`);
  console.log(`Listings with cert found: ${withCert.length}/${results.length} (${(withCert.length/results.length*100).toFixed(0)}%)`);
  console.log(`Session numbers extracted: ${withSession.length}/${results.length} (${(withSession.length/results.length*100).toFixed(0)}%)`);
  console.log(`Item/doc numbers extracted: ${withItem.length}/${results.length} (${(withItem.length/results.length*100).toFixed(0)}%)`);
  console.log(`Smith names extracted: ${withSmith.length}/${results.length} (${(withSmith.length/results.length*100).toFixed(0)}%)`);

  // Cert position analysis
  const positions = withCert.map(r => r.cert_image_index);
  if (positions.length > 0) {
    console.log(`\nCertificate position in gallery:`);
    console.log(`  Average: ${(positions.reduce((a,b)=>a+b,0)/positions.length).toFixed(1)}`);
    console.log(`  Min: ${Math.min(...positions)}, Max: ${Math.max(...positions)}`);
  }

  // Save results
  const outputFile = `${OUTPUT_DIR}/${dealer.replace(/\./g, '_')}-cert-test-${Date.now()}.json`;
  writeFileSync(outputFile, JSON.stringify({
    dealer,
    timestamp: new Date().toISOString(),
    summary: {
      listings_tested: results.length,
      total_images: totalImages,
      cert_images_found: certImages,
      detection_rate: (withCert.length / results.length * 100).toFixed(1) + '%',
      session_extraction_rate: (withSession.length / results.length * 100).toFixed(1) + '%',
      item_extraction_rate: (withItem.length / results.length * 100).toFixed(1) + '%',
      smith_extraction_rate: (withSmith.length / results.length * 100).toFixed(1) + '%',
    },
    results
  }, null, 2));

  console.log(`\nResults saved: ${outputFile}`);

  // Output JSON summary for agent parsing
  console.log('\n---JSON_SUMMARY_START---');
  console.log(JSON.stringify({
    dealer,
    tested: results.length,
    detected: withCert.length,
    detection_rate: (withCert.length / results.length * 100).toFixed(1),
    session_rate: (withSession.length / results.length * 100).toFixed(1),
    item_rate: (withItem.length / results.length * 100).toFixed(1),
    smith_rate: (withSmith.length / results.length * 100).toFixed(1),
  }));
  console.log('---JSON_SUMMARY_END---');
}

main().catch(console.error);
