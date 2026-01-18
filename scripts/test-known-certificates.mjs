#!/usr/bin/env node
/**
 * Test certificate detection on KNOWN certificate images
 * These have "paper" in the filename - we know they're certificates
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

const OUTPUT_DIR = 'certificate-detection-results';
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);

/**
 * Analyze a known certificate image
 */
async function analyzeKnownCertificate(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mediaType = response.headers.get('content-type') || 'image/jpeg';

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
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
            text: `This is a photograph of a Japanese sword certification document (NBTHK/NTHK paper).

Please extract all information you can read:

1. **Certificate Type**: Look for these terms:
   - 重要刀剣 (Juyo Token) = Important Art Sword
   - 特別重要刀剣 (Tokubetsu Juyo) = Especially Important
   - 特別保存刀剣 (Tokubetsu Hozon) = Special Preservation
   - 保存刀剣 (Hozon Token) = Preservation
   - Also: 重要美術品, 特別貴重刀剣

2. **Session/Number**: Look for:
   - 第X回 (Session X)
   - 第X号 (Item number X)

3. **Smith/Maker name**: Usually in large characters

4. **Date**: If visible

Respond in JSON:
{
  "is_certificate": true,
  "confidence": 0.0-1.0,
  "cert_type": "juyo" | "tokubetsu_juyo" | "tokubetsu_hozon" | "hozon" | "nthk" | "other",
  "organization": "NBTHK" | "NTHK" | "other",
  "session_number": number or null,
  "item_number": number or null,
  "full_cert_id": "e.g. Juyo-45-123" or null,
  "smith_name": "string or null",
  "visible_japanese_text": "key characters you can read",
  "date_if_visible": "string or null",
  "quality_notes": "any issues with readability"
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
    return { error: 'Failed to parse', raw: text };
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  console.log('🎯 Testing Certificate Extraction on KNOWN Certificate Images');
  console.log('='.repeat(70));

  // Get listings with "paper" in image URLs (known certificates)
  const { data: listings } = await supabase
    .from('listings')
    .select('id, url, title, images, cert_type')
    .not('images', 'is', null)
    .limit(500);

  // Find actual certificate images
  const certImages = [];
  for (const listing of listings) {
    if (!listing.images) continue;
    for (const img of listing.images) {
      if (img.toLowerCase().includes('paper') || img.toLowerCase().includes('kanteisho')) {
        certImages.push({
          listing_id: listing.id,
          dealer: listing.url.match(/https?:\/\/([^\/]+)/)?.[1],
          title: listing.title,
          db_cert_type: listing.cert_type,
          image_url: img
        });
      }
    }
  }

  console.log(`Found ${certImages.length} known certificate images`);
  console.log('');

  // Test first 15
  const toTest = certImages.slice(0, 15);
  const results = [];

  for (let i = 0; i < toTest.length; i++) {
    const cert = toTest[i];
    console.log(`[${i + 1}/${toTest.length}] Testing: ${cert.image_url.split('/').pop()}`);
    console.log(`  Listing ${cert.listing_id} | DB cert_type: ${cert.db_cert_type}`);

    const analysis = await analyzeKnownCertificate(cert.image_url);
    results.push({ ...cert, analysis });

    if (analysis.full_cert_id) {
      console.log(`  ✅ Extracted ID: ${analysis.full_cert_id}`);
      console.log(`     Type: ${analysis.cert_type}, Session: ${analysis.session_number}, Item: ${analysis.item_number}`);
    } else if (analysis.cert_type) {
      console.log(`  ⚠️  Type detected: ${analysis.cert_type}, but no full ID extracted`);
      console.log(`     Session: ${analysis.session_number || 'N/A'}, Item: ${analysis.item_number || 'N/A'}`);
    } else if (analysis.error) {
      console.log(`  ❌ Error: ${analysis.error}`);
    } else {
      console.log(`  ⚠️  Limited extraction:`, JSON.stringify(analysis).slice(0, 100));
    }

    console.log('');
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const detected = results.filter(r => r.analysis?.is_certificate);
  const withCertId = results.filter(r => r.analysis?.full_cert_id);
  const withSession = results.filter(r => r.analysis?.session_number);
  const withItemNum = results.filter(r => r.analysis?.item_number);
  const withType = results.filter(r => r.analysis?.cert_type);

  console.log(`Total tested: ${results.length}`);
  console.log(`Correctly identified as certificate: ${detected.length} (${(detected.length / results.length * 100).toFixed(0)}%)`);
  console.log(`Full cert ID extracted: ${withCertId.length} (${(withCertId.length / results.length * 100).toFixed(0)}%)`);
  console.log(`Session number extracted: ${withSession.length} (${(withSession.length / results.length * 100).toFixed(0)}%)`);
  console.log(`Item number extracted: ${withItemNum.length} (${(withItemNum.length / results.length * 100).toFixed(0)}%)`);
  console.log(`Cert type identified: ${withType.length} (${(withType.length / results.length * 100).toFixed(0)}%)`);

  console.log('\nExtracted IDs:');
  withCertId.forEach(r => {
    console.log(`  ${r.listing_id}: ${r.analysis.full_cert_id} (${r.analysis.cert_type})`);
  });

  console.log('\nSession/Item pairs (partial extractions):');
  withSession.forEach(r => {
    if (!r.analysis.full_cert_id) {
      console.log(`  ${r.listing_id}: Session ${r.analysis.session_number}, Item ${r.analysis.item_number || '?'} (${r.analysis.cert_type})`);
    }
  });

  // Save results
  const outputFile = `${OUTPUT_DIR}/known-cert-test-${Date.now()}.json`;
  writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

main().catch(console.error);
