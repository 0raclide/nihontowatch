#!/usr/bin/env node
/**
 * CRITICAL VALIDATION: Certificate Detection Plan
 *
 * Tests the HARD questions:
 * 1. Does Juyo extraction work on non-specialist dealers?
 * 2. Can we validate extracted data against listing titles?
 * 3. What's the FALSE POSITIVE rate on non-certificate images?
 * 4. Does position-based scanning actually find certificates?
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const OUTPUT_DIR = 'certificate-detection-results';
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);

// Test mode from args
const testMode = process.argv[2] || 'all';
const sampleSize = parseInt(process.argv[3]) || 5;

/**
 * Analyze image for certificate with detailed extraction
 */
async function analyzeImage(imageUrl, expectCert = null) {
  try {
    const response = await fetch(imageUrl, { timeout: 15000 });
    if (!response.ok) return { error: 'fetch_failed', status: response.status };

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image')) {
      return { error: 'not_image', contentType };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    let mediaType = contentType.split(';')[0].trim();
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      mediaType = 'image/jpeg';
    }

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: `Analyze this image carefully.

FIRST: Is this a Japanese sword certification document/paper (NBTHK, NTHK, or similar)?
- Look for: paper document, Japanese text, red seal (印), official formatting
- NOT a certificate: sword blade, fittings, koshirae, shirasaya, person, box

If it IS a certificate, extract EXACTLY what you see:
1. cert_type: Look for these EXACT phrases:
   - "重要刀剣" or "重要刀装具" = juyo
   - "特別重要" = tokubetsu_juyo
   - "特別保存" = tokubetsu_hozon
   - "保存刀剣" or "保存刀装具" = hozon

2. session_number: Look for "第X回" pattern. Extract the NUMBER only.
   Examples: "第四十七回" = 47, "第二十三回" = 23

3. item_number: Sometimes shows as "第X号" or a document number at top

4. smith_name: The main attribution (smith name or 無銘 if unsigned)

Respond ONLY with JSON:
{
  "is_certificate": true/false,
  "confidence": 0.0-1.0,
  "what_i_see": "brief description of image content",
  "cert_type": "juyo"|"tokubetsu_juyo"|"tokubetsu_hozon"|"hozon"|"nthk"|"other"|null,
  "session_number": number or null,
  "session_raw": "exact text seen for session, e.g. 第四十七回",
  "item_number": number or string or null,
  "smith_name": "string or null",
  "key_text_seen": "important Japanese text you can read"
}`
          }
        ]
      }]
    });

    const text = result.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: 'parse_failed', raw: text.slice(0, 300) };
  } catch (e) {
    return { error: e.message?.slice(0, 150) || 'unknown' };
  }
}

/**
 * Extract session number from listing title for validation
 */
function extractSessionFromTitle(title) {
  if (!title) return null;

  // Look for patterns like "Juyo 45", "45th Juyo", "第45回", etc.
  const patterns = [
    /(\d+)(?:th|st|nd|rd)?\s*(?:juyo|重要)/i,
    /juyo[^0-9]*(\d+)/i,
    /第(\d+)回/,
    /the\s*(\d+)(?:th|st|nd|rd)?\s*juyo/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return parseInt(match[1]);
  }
  return null;
}

/**
 * TEST 1: Juyo extraction on NON-specialist dealers
 */
async function testJuyoAcrossDealers() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 1: Juyo Session Extraction Across Different Dealers');
  console.log('='.repeat(70));
  console.log('Goal: Verify 100% Juyo extraction works beyond token-net.com\n');

  // Get Juyo items from various dealers (excluding token-net)
  const { data: juyoListings } = await supabase
    .from('listings')
    .select('id, url, title, images, cert_type')
    .eq('cert_type', 'Juyo')
    .not('images', 'is', null)
    .not('url', 'ilike', '%token-net%')
    .limit(50);

  // Group by dealer and take samples
  const byDealer = {};
  juyoListings?.forEach(l => {
    const domain = l.url.match(/https?:\/\/([^\/]+)/)?.[1];
    if (!byDealer[domain]) byDealer[domain] = [];
    byDealer[domain].push(l);
  });

  console.log('Juyo items by dealer (non-token-net):');
  Object.entries(byDealer).forEach(([d, items]) => {
    console.log(`  ${d}: ${items.length} Juyo items`);
  });
  console.log('');

  const results = [];
  let totalTested = 0;
  let certFound = 0;
  let sessionExtracted = 0;
  let sessionValidated = 0;

  for (const [dealer, listings] of Object.entries(byDealer)) {
    const toTest = listings.slice(0, sampleSize);

    for (const listing of toTest) {
      totalTested++;
      console.log(`[${totalTested}] ${dealer} - Listing ${listing.id}`);
      console.log(`    Title: ${listing.title?.slice(0, 50)}...`);

      const titleSession = extractSessionFromTitle(listing.title);
      if (titleSession) {
        console.log(`    Title claims: Juyo Session ${titleSession}`);
      }

      // Scan images using our proposed strategy
      const scanPositions = [0, 1, 2, -1, -2, -3, -4, -5]; // First 3 + last 5
      let foundCert = null;

      for (const pos of scanPositions) {
        const idx = pos >= 0 ? pos : listing.images.length + pos;
        if (idx < 0 || idx >= listing.images.length) continue;

        const imgUrl = listing.images[idx];
        const analysis = await analyzeImage(imgUrl);

        if (analysis.is_certificate && analysis.confidence >= 0.8) {
          foundCert = { ...analysis, position: idx, url: imgUrl };
          break;
        }

        await new Promise(r => setTimeout(r, 300));
      }

      if (foundCert) {
        certFound++;
        console.log(`    ✅ Cert found at position ${foundCert.position}`);
        console.log(`       Type: ${foundCert.cert_type}, Session: ${foundCert.session_number || 'NOT EXTRACTED'}`);

        if (foundCert.session_number) {
          sessionExtracted++;
          if (titleSession && foundCert.session_number === titleSession) {
            sessionValidated++;
            console.log(`       ✅ VALIDATED: Extracted ${foundCert.session_number} matches title!`);
          } else if (titleSession) {
            console.log(`       ⚠️  MISMATCH: Extracted ${foundCert.session_number}, title says ${titleSession}`);
          } else {
            console.log(`       ⚠️  Cannot validate (no session in title)`);
          }
        }
      } else {
        console.log(`    ❌ No certificate found in ${listing.images.length} images`);
      }

      results.push({
        listing_id: listing.id,
        dealer,
        title: listing.title,
        title_session: titleSession,
        cert_found: !!foundCert,
        extracted_session: foundCert?.session_number,
        validated: titleSession && foundCert?.session_number === titleSession,
        position: foundCert?.position,
        cert_type_detected: foundCert?.cert_type,
      });

      console.log('');
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('-'.repeat(70));
  console.log('TEST 1 RESULTS:');
  console.log(`  Juyo listings tested: ${totalTested}`);
  console.log(`  Certificates found: ${certFound}/${totalTested} (${(certFound/totalTested*100).toFixed(0)}%)`);
  console.log(`  Sessions extracted: ${sessionExtracted}/${totalTested} (${(sessionExtracted/totalTested*100).toFixed(0)}%)`);
  console.log(`  Sessions validated against title: ${sessionValidated}/${sessionExtracted} (${sessionExtracted ? (sessionValidated/sessionExtracted*100).toFixed(0) : 0}%)`);

  return { test: 'juyo_across_dealers', results, summary: { totalTested, certFound, sessionExtracted, sessionValidated } };
}

/**
 * TEST 2: False positive rate on non-certificate images
 */
async function testFalsePositives() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 2: False Positive Rate on Non-Certificate Images');
  console.log('='.repeat(70));
  console.log('Goal: Ensure sword/fitting photos are NOT flagged as certificates\n');

  // Get listings WITHOUT certificates
  const { data: uncertifiedListings } = await supabase
    .from('listings')
    .select('id, url, title, images')
    .is('cert_type', null)
    .not('images', 'is', null)
    .limit(30);

  const results = [];
  let totalImages = 0;
  let falsePositives = 0;

  // Test first image of each (should be product photo, not cert)
  for (let i = 0; i < Math.min(uncertifiedListings.length, sampleSize * 3); i++) {
    const listing = uncertifiedListings[i];
    if (!listing.images || listing.images.length === 0) continue;

    const imgUrl = listing.images[0]; // First image = main product photo
    console.log(`[${i + 1}] Testing: ${imgUrl.split('/').pop()}`);

    const analysis = await analyzeImage(imgUrl);
    totalImages++;

    if (analysis.is_certificate && analysis.confidence >= 0.7) {
      falsePositives++;
      console.log(`  ⚠️  FALSE POSITIVE: Detected as certificate (conf: ${analysis.confidence})`);
      console.log(`     Saw: ${analysis.what_i_see}`);
    } else {
      console.log(`  ✅ Correctly identified as: ${analysis.what_i_see?.slice(0, 50) || 'non-certificate'}`);
    }

    results.push({
      listing_id: listing.id,
      image: imgUrl.split('/').pop(),
      detected_as_cert: analysis.is_certificate && analysis.confidence >= 0.7,
      confidence: analysis.confidence,
      what_seen: analysis.what_i_see,
    });

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('-'.repeat(70));
  console.log('TEST 2 RESULTS:');
  console.log(`  Images tested: ${totalImages}`);
  console.log(`  False positives: ${falsePositives}/${totalImages} (${(falsePositives/totalImages*100).toFixed(1)}%)`);

  return { test: 'false_positives', results, summary: { totalImages, falsePositives, rate: (falsePositives/totalImages*100).toFixed(1) + '%' } };
}

/**
 * TEST 3: Blind detection (no prior knowledge of cert_type)
 */
async function testBlindDetection() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 3: Blind Certificate Detection');
  console.log('='.repeat(70));
  console.log('Goal: Can we find certificates WITHOUT knowing cert_type beforehand?\n');

  // Get mix of certified and uncertified listings
  const { data: mixedListings } = await supabase
    .from('listings')
    .select('id, url, title, images, cert_type')
    .not('images', 'is', null)
    .order('id', { ascending: false })
    .limit(100);

  // Shuffle and take sample
  const shuffled = mixedListings.sort(() => Math.random() - 0.5).slice(0, sampleSize * 2);

  const results = [];
  let truePositives = 0;  // Has cert, we found it
  let trueNegatives = 0;  // No cert, we didn't find one
  let falsePositives = 0; // No cert, but we found one
  let falseNegatives = 0; // Has cert, we didn't find it

  for (let i = 0; i < shuffled.length; i++) {
    const listing = shuffled[i];
    const hasCert = !!listing.cert_type;

    console.log(`[${i + 1}] Listing ${listing.id} (DB cert: ${listing.cert_type || 'none'})`);

    // Blind scan - check first 3 and last 3 images
    const scanPositions = [0, 1, 2, -1, -2, -3];
    let foundCert = false;

    for (const pos of scanPositions) {
      const idx = pos >= 0 ? pos : listing.images.length + pos;
      if (idx < 0 || idx >= listing.images.length) continue;

      const analysis = await analyzeImage(listing.images[idx]);

      if (analysis.is_certificate && analysis.confidence >= 0.8) {
        foundCert = true;
        console.log(`    Found cert at position ${idx}: ${analysis.cert_type}`);
        break;
      }

      await new Promise(r => setTimeout(r, 200));
    }

    if (hasCert && foundCert) {
      truePositives++;
      console.log(`    ✅ TRUE POSITIVE`);
    } else if (!hasCert && !foundCert) {
      trueNegatives++;
      console.log(`    ✅ TRUE NEGATIVE`);
    } else if (!hasCert && foundCert) {
      falsePositives++;
      console.log(`    ⚠️  FALSE POSITIVE`);
    } else {
      falseNegatives++;
      console.log(`    ❌ FALSE NEGATIVE (missed certificate)`);
    }

    results.push({
      listing_id: listing.id,
      has_cert_in_db: hasCert,
      cert_detected: foundCert,
      correct: (hasCert === foundCert),
    });

    console.log('');
    await new Promise(r => setTimeout(r, 300));
  }

  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const accuracy = (truePositives + trueNegatives) / shuffled.length;

  console.log('-'.repeat(70));
  console.log('TEST 3 RESULTS:');
  console.log(`  True Positives: ${truePositives}`);
  console.log(`  True Negatives: ${trueNegatives}`);
  console.log(`  False Positives: ${falsePositives}`);
  console.log(`  False Negatives: ${falseNegatives}`);
  console.log(`  Precision: ${(precision*100).toFixed(1)}%`);
  console.log(`  Recall: ${(recall*100).toFixed(1)}%`);
  console.log(`  Accuracy: ${(accuracy*100).toFixed(1)}%`);

  return {
    test: 'blind_detection',
    results,
    summary: { truePositives, trueNegatives, falsePositives, falseNegatives, precision, recall, accuracy }
  };
}

/**
 * TEST 4: Position-based scanning efficiency
 */
async function testPositionStrategy() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 4: Position-Based Scanning Efficiency');
  console.log('='.repeat(70));
  console.log('Goal: Verify our dealer-specific position strategy works\n');

  const dealerPositions = {
    'eirakudo.shop': { expected: 'first', scan: [0, 1] },
    'www.kusanaginosya.com': { expected: 'first', scan: [0, 1] },
    'www.aoijapan.com': { expected: 'early', scan: [0, 1, 2, 3, 4] },
    'www.token-net.com': { expected: 'late', scan: [-1, -2, -3, -4, -5] },
  };

  const results = [];

  for (const [dealer, config] of Object.entries(dealerPositions)) {
    console.log(`\nTesting ${dealer} (expected: ${config.expected})...`);

    const { data: listings } = await supabase
      .from('listings')
      .select('id, url, title, images, cert_type')
      .ilike('url', `%${dealer}%`)
      .not('cert_type', 'is', null)
      .not('images', 'is', null)
      .limit(sampleSize);

    let found = 0;
    let foundWithStrategy = 0;

    for (const listing of listings || []) {
      // Full scan to find actual position
      let actualPosition = -1;
      for (let i = 0; i < listing.images.length; i++) {
        const analysis = await analyzeImage(listing.images[i]);
        if (analysis.is_certificate && analysis.confidence >= 0.8) {
          actualPosition = i;
          found++;
          break;
        }
        await new Promise(r => setTimeout(r, 200));
      }

      // Would our strategy have found it?
      if (actualPosition >= 0) {
        const strategyPositions = config.scan.map(p => p >= 0 ? p : listing.images.length + p);
        if (strategyPositions.includes(actualPosition)) {
          foundWithStrategy++;
          console.log(`  Listing ${listing.id}: Found at ${actualPosition} ✅ (in strategy range)`);
        } else {
          console.log(`  Listing ${listing.id}: Found at ${actualPosition} ❌ (outside strategy: ${strategyPositions.join(',')})`);
        }
      }
    }

    results.push({
      dealer,
      expected_position: config.expected,
      strategy: config.scan,
      certs_found: found,
      strategy_would_find: foundWithStrategy,
      efficiency: found > 0 ? (foundWithStrategy/found*100).toFixed(0) + '%' : 'N/A',
    });
  }

  console.log('-'.repeat(70));
  console.log('TEST 4 RESULTS:');
  results.forEach(r => {
    console.log(`  ${r.dealer}: ${r.efficiency} efficient (${r.strategy_would_find}/${r.certs_found})`);
  });

  return { test: 'position_strategy', results };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       CRITICAL VALIDATION: Certificate Detection Plan              ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\nTest mode: ${testMode}, Sample size: ${sampleSize}`);

  const allResults = {};

  if (testMode === 'all' || testMode === 'juyo') {
    allResults.juyo = await testJuyoAcrossDealers();
  }

  if (testMode === 'all' || testMode === 'fp') {
    allResults.falsePositives = await testFalsePositives();
  }

  if (testMode === 'all' || testMode === 'blind') {
    allResults.blind = await testBlindDetection();
  }

  if (testMode === 'all' || testMode === 'position') {
    allResults.position = await testPositionStrategy();
  }

  // Save all results
  const outputFile = `${OUTPUT_DIR}/critical-validation-${Date.now()}.json`;
  writeFileSync(outputFile, JSON.stringify(allResults, null, 2));

  console.log('\n' + '═'.repeat(70));
  console.log('CRITICAL VALIDATION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Results saved: ${outputFile}`);
}

main().catch(console.error);
