#!/usr/bin/env node
/**
 * Test certificate extraction from Eirakudo composites by SLICING them
 * into smaller chunks that fit within API limits (8000px max)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SLICE_HEIGHT = 4000; // Safe height per slice
const sampleSize = parseInt(process.argv[2]) || 4;

async function sliceAndAnalyze(imageUrl, certTypeExpected) {
  try {
    console.log(`  Fetching image...`);
    const response = await fetch(imageUrl, { timeout: 30000 });
    if (!response.ok) return { error: 'fetch_failed' };

    const buffer = Buffer.from(await response.arrayBuffer());

    // Get image dimensions
    const metadata = await sharp(buffer).metadata();
    console.log(`  Dimensions: ${metadata.width}x${metadata.height} (aspect ratio ${(metadata.height/metadata.width).toFixed(1)})`);

    const numSlices = Math.ceil(metadata.height / SLICE_HEIGHT);
    console.log(`  Slicing into ${numSlices} chunks of ${SLICE_HEIGHT}px each`);

    const certificates = [];

    // Analyze each slice
    for (let i = 0; i < numSlices; i++) {
      const top = i * SLICE_HEIGHT;
      const height = Math.min(SLICE_HEIGHT, metadata.height - top);

      console.log(`  [Slice ${i + 1}/${numSlices}] y=${top} to ${top + height}`);

      // Extract slice
      const sliceBuffer = await sharp(buffer)
        .extract({ left: 0, top, width: metadata.width, height })
        .jpeg({ quality: 85 })
        .toBuffer();

      const base64 = sliceBuffer.toString('base64');

      // Analyze slice for certificates
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            {
              type: 'text',
              text: `Is there a Japanese sword certification document (NBTHK paper) in this image section?

Look for: paper document, Japanese text, red seal (印), words like 重要刀剣, 特別保存, 保存刀剣

If YES, extract:
- cert_type: "juyo" (重要刀剣), "tokubetsu_hozon" (特別保存), "hozon" (保存刀剣)
- session_number: from 第X回 (e.g., 第四十七回 = 47)
- document_number: any visible ID

If NO certificate visible, just say so.

JSON response:
{"has_cert": true/false, "cert_type": null, "session": null, "doc_num": null, "text_seen": ""}`
            }
          ]
        }]
      });

      const text = result.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.has_cert) {
          console.log(`    ✅ CERT FOUND: ${parsed.cert_type}, Session: ${parsed.session || 'N/A'}`);
          certificates.push({ ...parsed, slice: i, y_position: top });
        } else {
          console.log(`    ❌ No certificate in this slice`);
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    return {
      dimensions: `${metadata.width}x${metadata.height}`,
      slices: numSlices,
      certificates,
      highest_cert: certificates.length > 0
        ? certificates.reduce((best, c) => {
            const order = { juyo: 4, tokubetsu_juyo: 5, tokubetsu_hozon: 3, hozon: 2, other: 1 };
            return (order[c.cert_type] || 0) > (order[best.cert_type] || 0) ? c : best;
          }, certificates[0])
        : null
    };
  } catch (e) {
    return { error: e.message?.slice(0, 200) };
  }
}

async function main() {
  console.log('🔪 Testing Eirakudo Composite SLICING for Certificate Extraction');
  console.log('='.repeat(70));
  console.log(`Sample size: ${sampleSize}, Slice height: ${SLICE_HEIGHT}px\n`);

  // Get Eirakudo Juyo listings with composites
  const { data: listings } = await supabase
    .from('listings')
    .select('id, url, title, images, cert_type')
    .ilike('url', '%eirakudo%')
    .eq('cert_type', 'Juyo')  // Focus on Juyo for this test
    .not('images', 'is', null)
    .limit(20);

  const withComposites = listings.filter(l =>
    l.images?.some(img => img.includes('_z'))
  );

  console.log(`Found ${withComposites.length} Eirakudo Juyo listings with composites\n`);

  const results = [];

  for (let i = 0; i < Math.min(withComposites.length, sampleSize); i++) {
    const listing = withComposites[i];
    const composite = listing.images.find(img => img.includes('_z'));

    console.log(`\n[${i + 1}/${sampleSize}] Listing ${listing.id}: ${listing.title?.slice(0, 40)}...`);
    console.log(`  URL: ${listing.url}`);
    console.log(`  DB cert_type: ${listing.cert_type}`);

    const analysis = await sliceAndAnalyze(composite, listing.cert_type);

    if (analysis.error) {
      console.log(`  ❌ Error: ${analysis.error}`);
    } else {
      console.log(`  \n  RESULT: Found ${analysis.certificates.length} certificate(s)`);
      if (analysis.highest_cert) {
        console.log(`  Highest: ${analysis.highest_cert.cert_type}, Session: ${analysis.highest_cert.session || 'N/A'}`);
      }
    }

    results.push({
      listing_id: listing.id,
      db_cert_type: listing.cert_type,
      title: listing.title,
      url: listing.url,
      analysis
    });
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => !r.analysis.error);
  const foundJuyo = results.filter(r =>
    r.analysis.certificates?.some(c => c.cert_type === 'juyo')
  );
  const foundAny = results.filter(r =>
    r.analysis.certificates?.length > 0
  );
  const withSession = results.filter(r =>
    r.analysis.certificates?.some(c => c.session)
  );

  console.log(`Tested: ${results.length}`);
  console.log(`Successful: ${successful.length}/${results.length}`);
  console.log(`Found ANY cert: ${foundAny.length}/${results.length}`);
  console.log(`Found JUYO cert: ${foundJuyo.length}/${results.length}`);
  console.log(`With session number: ${withSession.length}/${results.length}`);

  writeFileSync('certificate-detection-results/eirakudo-sliced-test.json',
    JSON.stringify(results, null, 2));
  console.log('\nResults saved.');
}

main().catch(console.error);
