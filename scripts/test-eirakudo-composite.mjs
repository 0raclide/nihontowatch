#!/usr/bin/env node
/**
 * Test certificate extraction from Eirakudo's composite _z.jpg images
 * These are tall images (aspect ratio 15-25:1) that contain all details including certificates
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const sampleSize = parseInt(process.argv[2]) || 5;

async function analyzeComposite(imageUrl, certTypeExpected) {
  try {
    console.log(`  Fetching ${imageUrl.split('/').pop()}...`);
    const response = await fetch(imageUrl, { timeout: 30000 });
    if (!response.ok) return { error: 'fetch_failed', status: response.status };

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const sizeKB = Math.round(buffer.byteLength / 1024);
    console.log(`  Image size: ${sizeKB}KB`);

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          {
            type: 'text',
            text: `This is a tall composite image from a Japanese sword dealer (Eirakudo). It contains multiple sections stitched together vertically: product photos, detail shots, and certification documents.

TASK: Find ALL certification documents (NBTHK papers) in this image and extract their details.

Look for sections that show:
- Paper documents with Japanese text
- Red circular seals (印)
- Words like 重要刀剣, 特別保存, 保存刀剣

For EACH certificate found, extract:
1. cert_type: "juyo"|"tokubetsu_juyo"|"tokubetsu_hozon"|"hozon" based on:
   - 重要刀剣 or 重要刀装具 = juyo
   - 特別重要 = tokubetsu_juyo
   - 特別保存 = tokubetsu_hozon
   - 保存刀剣 or 保存刀装具 = hozon

2. session_number: from 第X回 pattern (e.g., 第四十七回 = 47)

3. Any document numbers visible

Expected certification level based on title: ${certTypeExpected}

Respond with JSON:
{
  "certificates_found": [
    {
      "cert_type": "juyo|tokubetsu_hozon|hozon|other",
      "session_number": number or null,
      "session_raw": "exact text like 第四十七回",
      "document_number": "string or null",
      "key_text": "important visible text",
      "approximate_position": "top|middle|bottom of composite"
    }
  ],
  "total_certificates": number,
  "highest_cert_found": "juyo|tokubetsu_hozon|hozon|none",
  "notes": "any observations"
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
    return { error: 'parse_failed', raw: text.slice(0, 500) };
  } catch (e) {
    return { error: e.message?.slice(0, 200) || 'unknown' };
  }
}

async function main() {
  console.log('🔍 Testing Eirakudo Composite Image Certificate Extraction');
  console.log('='.repeat(70));
  console.log(`Sample size: ${sampleSize}\n`);

  // Get Eirakudo listings with certs
  const { data: listings } = await supabase
    .from('listings')
    .select('id, url, title, images, cert_type')
    .ilike('url', '%eirakudo%')
    .not('cert_type', 'is', null)
    .not('images', 'is', null)
    .limit(50);

  // Filter to those with _z.jpg composites
  const withComposites = listings.filter(l =>
    l.images?.some(img => img.includes('_z'))
  );

  console.log(`Found ${withComposites.length} Eirakudo listings with composite images\n`);

  // Sample across cert types
  const byType = {};
  withComposites.forEach(l => {
    if (!byType[l.cert_type]) byType[l.cert_type] = [];
    byType[l.cert_type].push(l);
  });

  console.log('By cert type:', Object.entries(byType).map(([t, l]) => `${t}:${l.length}`).join(', '));
  console.log('');

  // Take samples
  const toTest = [];
  for (const [type, items] of Object.entries(byType)) {
    toTest.push(...items.slice(0, Math.ceil(sampleSize / Object.keys(byType).length)));
  }

  const results = [];

  for (let i = 0; i < Math.min(toTest.length, sampleSize); i++) {
    const listing = toTest[i];
    const composite = listing.images.find(img => img.includes('_z'));

    console.log(`[${i + 1}/${sampleSize}] Listing ${listing.id}: ${listing.title?.slice(0, 40)}...`);
    console.log(`  DB cert_type: ${listing.cert_type}`);
    console.log(`  Composite: ${composite?.split('/').pop()}`);

    const analysis = await analyzeComposite(composite, listing.cert_type);

    if (analysis.error) {
      console.log(`  ❌ Error: ${analysis.error}`);
    } else {
      console.log(`  Found ${analysis.total_certificates} certificate(s)`);
      console.log(`  Highest: ${analysis.highest_cert_found}`);

      if (analysis.certificates_found) {
        analysis.certificates_found.forEach((cert, j) => {
          console.log(`    [${j + 1}] ${cert.cert_type}: Session ${cert.session_number || 'N/A'}, Doc# ${cert.document_number || 'N/A'}`);
          if (cert.session_raw) console.log(`        Raw: ${cert.session_raw}`);
        });
      }

      // Check if highest matches DB
      const matches = analysis.highest_cert_found?.toLowerCase() === listing.cert_type?.toLowerCase() ||
                     (listing.cert_type === 'TokuHozon' && analysis.highest_cert_found === 'tokubetsu_hozon');
      console.log(`  DB Match: ${matches ? '✅' : '⚠️'} (DB: ${listing.cert_type}, Found: ${analysis.highest_cert_found})`);
    }

    results.push({
      listing_id: listing.id,
      db_cert_type: listing.cert_type,
      composite_url: composite,
      analysis
    });

    console.log('');
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => !r.analysis.error);
  const withJuyo = results.filter(r =>
    r.analysis.certificates_found?.some(c => c.cert_type === 'juyo')
  );
  const withSession = results.filter(r =>
    r.analysis.certificates_found?.some(c => c.session_number)
  );
  const dbMatches = results.filter(r => {
    const highest = r.analysis.highest_cert_found?.toLowerCase();
    const db = r.db_cert_type?.toLowerCase();
    return highest === db || (db === 'tokuhozon' && highest === 'tokubetsu_hozon');
  });

  console.log(`Tested: ${results.length}`);
  console.log(`Successful analysis: ${successful.length}/${results.length}`);
  console.log(`Found Juyo certs: ${withJuyo.length}/${results.length}`);
  console.log(`Extracted session numbers: ${withSession.length}/${results.length}`);
  console.log(`DB cert_type matches: ${dbMatches.length}/${results.length}`);

  // Save
  writeFileSync('certificate-detection-results/eirakudo-composite-test.json',
    JSON.stringify(results, null, 2));
  console.log('\nResults saved to certificate-detection-results/eirakudo-composite-test.json');
}

main().catch(console.error);
