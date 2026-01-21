#!/usr/bin/env node
/**
 * Comprehensive OCR Validation Across All Problematic Dealers
 *
 * Tests the 4x super-resolution + GPT-4o pipeline on:
 * - Eirakudo (composite images)
 * - Kusanaginosya (single-image galleries)
 * - Iida Koendo (mixed cert types)
 * - Nipponto
 * - Katanahanbai
 * - Aoi Art (baseline comparison)
 * - Token-net (should already work - control group)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import sharp from 'sharp';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Dealers to test with their URL patterns
const DEALERS = [
  { name: 'Eirakudo', pattern: '%eirakudo%', expected_issue: 'composite images' },
  { name: 'Kusanaginosya', pattern: '%kusanagi%', expected_issue: 'single-image galleries' },
  { name: 'Iida Koendo', pattern: '%iida-koendo%', expected_issue: 'mixed cert photos' },
  { name: 'Nipponto', pattern: '%nipponto%', expected_issue: 'missing Juyo photos' },
  { name: 'Katanahanbai', pattern: '%katanahanbai%', expected_issue: 'certs often missing' },
  { name: 'Aoi Art', pattern: '%aoijapan%', expected_issue: 'baseline - should work' },
  { name: 'Token-net', pattern: '%token-net%', expected_issue: 'control - 100% expected' },
  { name: 'Ginza Seikodo', pattern: '%ginza-seikodo%', expected_issue: 'unknown' },
  { name: 'Samurai Nippon', pattern: '%samurai-nippon%', expected_issue: 'inconsistent' },
];

const SAMPLES_PER_DEALER = 3;
const UPSCALE_FACTOR = 4;

async function getTestCases() {
  console.log('📊 Fetching test cases from database...\n');

  const testCases = [];

  for (const dealer of DEALERS) {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, url, title, images, cert_type, dealer_id')
      .ilike('url', dealer.pattern)
      .in('cert_type', ['Juyo', 'Tokubetsu Juyo', 'Juyo Tosogu', 'Tokubetsu Juyo Tosogu'])
      .not('images', 'is', null)
      .limit(SAMPLES_PER_DEALER);

    if (error) {
      console.log(`  ❌ ${dealer.name}: Query error - ${error.message}`);
      continue;
    }

    if (!listings || listings.length === 0) {
      console.log(`  ⚠️  ${dealer.name}: No Juyo/Tokuju listings found`);
      continue;
    }

    console.log(`  ✓ ${dealer.name}: Found ${listings.length} test cases`);

    for (const listing of listings) {
      testCases.push({
        dealer: dealer.name,
        expected_issue: dealer.expected_issue,
        listing_id: listing.id,
        url: listing.url,
        title: listing.title,
        cert_type: listing.cert_type,
        images: listing.images || []
      });
    }
  }

  console.log(`\nTotal test cases: ${testCases.length}\n`);
  return testCases;
}

function selectBestImage(images, dealer) {
  if (!images || images.length === 0) return null;

  // For Eirakudo, look for _z composite images
  if (dealer === 'Eirakudo') {
    const composite = images.find(img => img.includes('_z.') || img.includes('_z'));
    if (composite) return { url: composite, type: 'composite' };
  }

  // For others, look for certificate indicators in URL
  const certPatterns = [
    /paper/i, /cert/i, /kan\d*\.gif/i, /setsumei/i, /juyo/i,
    /nbthk/i, /origami/i, /shinsa/i
  ];

  for (const img of images) {
    for (const pattern of certPatterns) {
      if (pattern.test(img)) {
        return { url: img, type: 'certificate_url' };
      }
    }
  }

  // Fallback: try first few images (certificates often early in gallery)
  return { url: images[0], type: 'first_image' };
}

async function processImage(imageUrl, isComposite = false) {
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  let buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();

  // For composites or very tall images, extract top portion
  if (isComposite || metadata.height > 5000) {
    const extractHeight = Math.min(3500, metadata.height);
    buffer = await sharp(buffer)
      .extract({ left: 0, top: 0, width: metadata.width, height: extractHeight })
      .toBuffer();
  }

  // Get current dimensions
  const currentMeta = await sharp(buffer).metadata();

  // Apply 4x super-resolution
  const upscaled = await sharp(buffer)
    .resize(
      currentMeta.width * UPSCALE_FACTOR,
      currentMeta.height * UPSCALE_FACTOR,
      { kernel: 'lanczos3', fastShrinkOnLoad: false }
    )
    .sharpen({ sigma: 1.5 })
    .normalize()
    .jpeg({ quality: 95 })
    .toBuffer();

  return {
    buffer: upscaled,
    originalDimensions: `${metadata.width}x${metadata.height}`,
    processedDimensions: `${currentMeta.width * UPSCALE_FACTOR}x${currentMeta.height * UPSCALE_FACTOR}`
  };
}

async function ocrImage(buffer) {
  const base64 = buffer.toString('base64');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` }
          },
          {
            type: 'text',
            text: `Analyze this image for Japanese sword/tosogu certification documents.

Extract ANY certification information visible:

1. CERTIFICATION TYPE (look for exact phrases):
   - 重要刀剣 or 重要刀装具 = "juyo"
   - 特別重要刀剣 or 特別重要刀装具 = "tokubetsu_juyo"
   - 特別保存刀剣 or 特別保存刀装具 = "tokubetsu_hozon"
   - 保存刀剣 or 保存刀装具 = "hozon"

2. SESSION NUMBER: Look for 第X回 pattern
   - 第四十六回 = 46
   - 第三十七回 = 37
   Convert kanji to number.

3. SETSUMEI TEXT: The descriptive paragraph about the item

4. DATE: 年月日 format

Output ONLY valid JSON:
{
  "has_certificate": true/false,
  "cert_type": "juyo"|"tokubetsu_juyo"|"tokubetsu_hozon"|"hozon"|null,
  "session_number": number or null,
  "session_text": "exact text like 第四十六回" or null,
  "setsumei_excerpt": "first 150 chars of description" or null,
  "date": "date text" or null,
  "confidence": "high"|"medium"|"low",
  "readable": true/false,
  "notes": "any issues"
}`
          }
        ]
      }],
      max_tokens: 1200,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { error: 'json_parse_failed', raw: text.slice(0, 300) };
    }
  }
  return { error: 'no_json', raw: text.slice(0, 300) };
}

async function processTestCase(testCase, index, total) {
  const prefix = `[${index + 1}/${total}]`;
  console.log(`\n${prefix} ${testCase.dealer} - Listing ${testCase.listing_id}`);
  console.log(`    Title: ${testCase.title.slice(0, 50)}...`);
  console.log(`    DB cert: ${testCase.cert_type}`);

  const result = {
    dealer: testCase.dealer,
    listing_id: testCase.listing_id,
    title: testCase.title,
    db_cert_type: testCase.cert_type,
    expected_issue: testCase.expected_issue
  };

  try {
    // Select best image
    const imageInfo = selectBestImage(testCase.images, testCase.dealer);
    if (!imageInfo) {
      console.log(`    ❌ No images available`);
      result.error = 'no_images';
      return result;
    }

    console.log(`    Image: ${imageInfo.type} - ${imageInfo.url.slice(-40)}`);

    // Process with super-resolution
    const isComposite = imageInfo.type === 'composite' || testCase.dealer === 'Eirakudo';
    const processed = await processImage(imageInfo.url, isComposite);
    console.log(`    Processed: ${processed.originalDimensions} → ${processed.processedDimensions}`);

    // OCR
    const ocrResult = await ocrImage(processed.buffer);

    result.ocr = ocrResult;
    result.image_url = imageInfo.url;
    result.image_type = imageInfo.type;

    // Evaluate success
    const hasValidCert = ocrResult.has_certificate && ocrResult.cert_type;
    const hasSession = ocrResult.session_number !== null && ocrResult.session_number !== undefined;
    const hasSetsumei = ocrResult.setsumei_excerpt && ocrResult.setsumei_excerpt.length > 20;

    result.success = {
      cert_detected: ocrResult.has_certificate || false,
      cert_type_extracted: hasValidCert,
      session_extracted: hasSession,
      setsumei_extracted: hasSetsumei,
      fully_successful: hasValidCert && hasSession
    };

    const status = result.success.fully_successful ? '✅' :
                   result.success.cert_type_extracted ? '⚠️ ' : '❌';

    console.log(`    ${status} cert=${ocrResult.cert_type || 'N/A'}, session=${ocrResult.session_number || 'N/A'}, setsumei=${hasSetsumei ? 'yes' : 'no'}`);

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    result.error = error.message;
  }

  return result;
}

async function main() {
  console.log('🔬 Comprehensive OCR Validation Across Problematic Dealers');
  console.log('='.repeat(70));
  console.log('Method: 4x Lanczos super-resolution + GPT-4o OCR');
  console.log('='.repeat(70));

  const testCases = await getTestCases();

  if (testCases.length === 0) {
    console.log('No test cases found!');
    return;
  }

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const result = await processTestCase(testCases[i], i, testCases.length);
    results.push(result);

    // Rate limiting
    await new Promise(r => setTimeout(r, 2500));
  }

  // Per-dealer summary
  console.log('\n' + '='.repeat(70));
  console.log('PER-DEALER RESULTS');
  console.log('='.repeat(70));

  const dealerStats = {};

  for (const r of results) {
    if (!dealerStats[r.dealer]) {
      dealerStats[r.dealer] = {
        total: 0,
        cert_detected: 0,
        cert_type_extracted: 0,
        session_extracted: 0,
        fully_successful: 0,
        errors: 0
      };
    }

    const stats = dealerStats[r.dealer];
    stats.total++;

    if (r.error) {
      stats.errors++;
    } else if (r.success) {
      if (r.success.cert_detected) stats.cert_detected++;
      if (r.success.cert_type_extracted) stats.cert_type_extracted++;
      if (r.success.session_extracted) stats.session_extracted++;
      if (r.success.fully_successful) stats.fully_successful++;
    }
  }

  console.log('\nDealer                | Total | Cert Type | Session | Full Success');
  console.log('-'.repeat(70));

  for (const [dealer, stats] of Object.entries(dealerStats)) {
    const certRate = stats.total > 0 ? Math.round(stats.cert_type_extracted / stats.total * 100) : 0;
    const sessionRate = stats.total > 0 ? Math.round(stats.session_extracted / stats.total * 100) : 0;
    const fullRate = stats.total > 0 ? Math.round(stats.fully_successful / stats.total * 100) : 0;

    console.log(
      `${dealer.padEnd(21)} | ${String(stats.total).padStart(5)} | ${String(certRate + '%').padStart(9)} | ${String(sessionRate + '%').padStart(7)} | ${String(fullRate + '%').padStart(12)}`
    );
  }

  // Overall summary
  const totalTests = results.length;
  const totalFullSuccess = results.filter(r => r.success?.fully_successful).length;
  const totalCertType = results.filter(r => r.success?.cert_type_extracted).length;
  const totalSession = results.filter(r => r.success?.session_extracted).length;
  const totalErrors = results.filter(r => r.error).length;

  console.log('-'.repeat(70));
  console.log(
    `${'TOTAL'.padEnd(21)} | ${String(totalTests).padStart(5)} | ${String(Math.round(totalCertType/totalTests*100) + '%').padStart(9)} | ${String(Math.round(totalSession/totalTests*100) + '%').padStart(7)} | ${String(Math.round(totalFullSuccess/totalTests*100) + '%').padStart(12)}`
  );

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total test cases: ${totalTests}`);
  console.log(`Errors (404, timeout): ${totalErrors}`);
  console.log(`Certificate type extracted: ${totalCertType}/${totalTests - totalErrors} (${Math.round(totalCertType/(totalTests-totalErrors)*100)}%)`);
  console.log(`Session number extracted: ${totalSession}/${totalTests - totalErrors} (${Math.round(totalSession/(totalTests-totalErrors)*100)}%)`);
  console.log(`Fully successful (cert + session): ${totalFullSuccess}/${totalTests - totalErrors} (${Math.round(totalFullSuccess/(totalTests-totalErrors)*100)}%)`);

  // Save detailed results
  const outPath = 'certificate-detection-results/comprehensive-validation.json';
  mkdirSync('certificate-detection-results', { recursive: true });
  writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    method: '4x Lanczos super-resolution + GPT-4o OCR',
    dealer_stats: dealerStats,
    results
  }, null, 2));
  console.log(`\nDetailed results saved to: ${outPath}`);
}

main().catch(console.error);
