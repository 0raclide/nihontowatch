#!/usr/bin/env node
/**
 * Certificate Detection Feasibility Test
 *
 * Tests our ability to:
 * 1. Identify certificate images among dealer photos
 * 2. Extract certification IDs from those images
 *
 * Usage: node scripts/certificate-detection-test.mjs [--sample N] [--dealer DOMAIN]
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
const sampleSize = args.includes('--sample') ? parseInt(args[args.indexOf('--sample') + 1]) : 20;
const dealerFilter = args.includes('--dealer') ? args[args.indexOf('--dealer') + 1] : null;

// Output directory
const OUTPUT_DIR = 'certificate-detection-results';
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);

/**
 * Stage 1: Quick heuristic filters (no API calls)
 */
async function quickFilters(imageUrl) {
  try {
    // Fetch image metadata (HEAD request)
    const response = await fetch(imageUrl, { method: 'HEAD', timeout: 5000 });
    const contentType = response.headers.get('content-type');

    if (!contentType?.includes('image')) {
      return { pass: false, reason: 'not_image' };
    }

    return { pass: true, reason: 'passed_quick_filters' };
  } catch (e) {
    return { pass: false, reason: 'fetch_failed' };
  }
}

/**
 * Stage 2: LLM-based certificate detection and extraction
 * Using Claude's vision capabilities
 */
async function detectAndExtractCertificate(imageUrl) {
  try {
    // Fetch image as base64
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mediaType = response.headers.get('content-type') || 'image/jpeg';

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Analyze this image. Is this a Japanese sword certification document (NBTHK paper/certificate)?

Look for these indicators:
- Rectangular document/paper
- Japanese vertical text
- Red circular seal (印)
- Words like 重要刀剣, 特別保存, 保存刀剣, 鑑定書
- Session number (第X回) and item number (第X号)

Respond in JSON format:
{
  "is_certificate": true/false,
  "confidence": 0.0-1.0,
  "cert_type": "juyo" | "tokubetsu_juyo" | "tokubetsu_hozon" | "hozon" | "nthk" | "other" | null,
  "session_number": number or null,
  "item_number": number or null,
  "full_cert_id": "e.g. Juyo-45-123" or null,
  "visible_text": "key text you can read",
  "reasoning": "brief explanation"
}

If this is clearly a sword photo (blade, handle, fittings) and NOT a certificate, just return:
{"is_certificate": false, "confidence": 0.95, "reasoning": "This is a photo of [what you see]"}`
          }
        ]
      }]
    });

    // Parse response
    const text = result.content[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { is_certificate: false, confidence: 0, reasoning: 'Failed to parse response' };
  } catch (e) {
    return { is_certificate: false, confidence: 0, error: e.message };
  }
}

/**
 * Process a single listing
 */
async function processListing(listing) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Listing ${listing.id}: ${listing.title?.slice(0, 50)}...`);
  console.log(`Cert type in DB: ${listing.cert_type || 'none'}`);
  console.log(`Images: ${listing.images?.length || 0}`);

  const results = {
    listing_id: listing.id,
    title: listing.title,
    cert_type_db: listing.cert_type,
    dealer: listing.url?.match(/https?:\/\/([^/]+)/)?.[1],
    image_count: listing.images?.length || 0,
    images_analyzed: [],
    certificate_found: false,
    extracted_cert_id: null,
  };

  if (!listing.images || listing.images.length === 0) {
    results.error = 'no_images';
    return results;
  }

  // Analyze each image (up to first 10)
  const imagesToCheck = listing.images.slice(0, 10);

  for (let i = 0; i < imagesToCheck.length; i++) {
    const imgUrl = imagesToCheck[i];
    console.log(`  [${i + 1}/${imagesToCheck.length}] Checking image...`);

    // Quick filter
    const quickResult = await quickFilters(imgUrl);
    if (!quickResult.pass) {
      results.images_analyzed.push({
        url: imgUrl,
        stage: 'quick_filter',
        result: quickResult.reason,
      });
      continue;
    }

    // LLM detection
    const detection = await detectAndExtractCertificate(imgUrl);

    results.images_analyzed.push({
      url: imgUrl,
      stage: 'llm_detection',
      ...detection,
    });

    if (detection.is_certificate && detection.confidence > 0.7) {
      console.log(`    ✅ CERTIFICATE FOUND! Confidence: ${detection.confidence}`);
      console.log(`    Type: ${detection.cert_type}`);
      console.log(`    ID: ${detection.full_cert_id || 'Not extracted'}`);

      results.certificate_found = true;
      results.extracted_cert_id = detection.full_cert_id;
      results.cert_type_detected = detection.cert_type;
      results.cert_image_url = imgUrl;
      break; // Found certificate, stop searching
    } else {
      console.log(`    ❌ Not a certificate (${detection.reasoning?.slice(0, 50) || 'unknown'})`);
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

/**
 * Main
 */
async function main() {
  console.log('🔍 Certificate Detection Feasibility Test');
  console.log('='.repeat(60));
  console.log(`Sample size: ${sampleSize}`);
  if (dealerFilter) console.log(`Dealer filter: ${dealerFilter}`);
  console.log('');

  // Query listings with certifications
  let query = supabase
    .from('listings')
    .select('id, url, title, images, cert_type, cert_organization')
    .not('images', 'is', null)
    .in('cert_type', ['Juyo', 'TokuJuyo', 'TokuHozon', 'Hozon', 'TokuKicho'])
    .order('id', { ascending: false })
    .limit(sampleSize);

  if (dealerFilter) {
    query = query.ilike('url', `%${dealerFilter}%`);
  }

  const { data: listings, error } = await query;

  if (error) {
    console.error('Database error:', error);
    process.exit(1);
  }

  console.log(`Found ${listings.length} listings to test\n`);

  const results = [];

  for (const listing of listings) {
    const result = await processListing(listing);
    results.push(result);

    // Delay between listings
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const withCert = results.filter(r => r.certificate_found);
  const withCertId = results.filter(r => r.extracted_cert_id);

  console.log(`Listings analyzed: ${results.length}`);
  console.log(`Certificates found: ${withCert.length} (${(withCert.length / results.length * 100).toFixed(1)}%)`);
  console.log(`Cert IDs extracted: ${withCertId.length} (${(withCertId.length / results.length * 100).toFixed(1)}%)`);

  console.log('\nExtracted IDs:');
  withCertId.forEach(r => {
    console.log(`  ${r.listing_id}: ${r.extracted_cert_id} (${r.cert_type_detected})`);
  });

  // Save results
  const outputFile = `${OUTPUT_DIR}/test-results-${Date.now()}.json`;
  writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);

  // Detailed metrics
  const metrics = {
    total_listings: results.length,
    certificates_found: withCert.length,
    cert_ids_extracted: withCertId.length,
    detection_rate: (withCert.length / results.length * 100).toFixed(1) + '%',
    extraction_rate: (withCertId.length / results.length * 100).toFixed(1) + '%',
    by_cert_type: {},
    by_dealer: {},
  };

  results.forEach(r => {
    // By cert type
    const ct = r.cert_type_db || 'unknown';
    if (!metrics.by_cert_type[ct]) metrics.by_cert_type[ct] = { total: 0, found: 0, extracted: 0 };
    metrics.by_cert_type[ct].total++;
    if (r.certificate_found) metrics.by_cert_type[ct].found++;
    if (r.extracted_cert_id) metrics.by_cert_type[ct].extracted++;

    // By dealer
    const dealer = r.dealer || 'unknown';
    if (!metrics.by_dealer[dealer]) metrics.by_dealer[dealer] = { total: 0, found: 0, extracted: 0 };
    metrics.by_dealer[dealer].total++;
    if (r.certificate_found) metrics.by_dealer[dealer].found++;
    if (r.extracted_cert_id) metrics.by_dealer[dealer].extracted++;
  });

  console.log('\nBy cert type:');
  Object.entries(metrics.by_cert_type).forEach(([type, data]) => {
    console.log(`  ${type}: ${data.found}/${data.total} found, ${data.extracted}/${data.total} extracted`);
  });

  console.log('\nBy dealer:');
  Object.entries(metrics.by_dealer).forEach(([dealer, data]) => {
    console.log(`  ${dealer}: ${data.found}/${data.total} found, ${data.extracted}/${data.total} extracted`);
  });

  writeFileSync(`${OUTPUT_DIR}/metrics-${Date.now()}.json`, JSON.stringify(metrics, null, 2));
}

main().catch(console.error);
