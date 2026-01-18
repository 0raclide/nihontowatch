#!/usr/bin/env node
/**
 * Test with UPSCALED slices for better text readability
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

// Smaller slices, upscaled 2x for better OCR
const SLICE_HEIGHT = 2500;
const UPSCALE = 2;

async function analyzeSlice(buffer, sliceNum) {
  const base64 = buffer.toString('base64');

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        {
          type: 'text',
          text: `This is a section from a Japanese sword dealer's composite image.

Look carefully for ANY certification documents (NBTHK/NTHK papers). These have:
- Rectangular paper/document format
- Japanese vertical text
- Red circular seal (印)
- Official formatting

If you see a certificate, extract EXACTLY what you can read:

1. CERTIFICATE TYPE - look for these exact phrases:
   - 重要刀剣 or 重要刀装具 = "juyo" (most important!)
   - 特別保存刀剣 = "tokubetsu_hozon"
   - 保存刀剣 or 保存刀装具 = "hozon"

2. SESSION NUMBER - format: 第X回
   - 第四十七回 = session 47
   - 第二十三回 = session 23
   Convert to Arabic numeral.

3. ANY NUMBERS you see on the document

JSON only:
{
  "has_certificate": true/false,
  "cert_type": "juyo"|"tokubetsu_hozon"|"hozon"|null,
  "session_number": number or null,
  "session_text_seen": "exact Japanese text for session",
  "other_numbers": "any numbers visible",
  "key_text_visible": "important text you can read"
}`
        }
      ]
    }]
  });

  const text = result.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'parse_failed' };
}

async function processComposite(imageUrl) {
  console.log(`  Fetching...`);
  const response = await fetch(imageUrl, { timeout: 30000 });
  const buffer = Buffer.from(await response.arrayBuffer());

  const metadata = await sharp(buffer).metadata();
  console.log(`  Original: ${metadata.width}x${metadata.height}`);

  // Focus on first 3 slices where certificates typically are (based on previous test)
  const certificates = [];

  for (let i = 0; i < 3; i++) {
    const top = i * SLICE_HEIGHT;
    if (top >= metadata.height) break;
    const height = Math.min(SLICE_HEIGHT, metadata.height - top);

    console.log(`  [Slice ${i + 1}] y=${top}-${top + height}, upscaling ${UPSCALE}x...`);

    // Extract and upscale
    const sliceBuffer = await sharp(buffer)
      .extract({ left: 0, top, width: metadata.width, height })
      .resize(metadata.width * UPSCALE, height * UPSCALE, { kernel: 'lanczos3' })
      .jpeg({ quality: 90 })
      .toBuffer();

    const sliceMeta = await sharp(sliceBuffer).metadata();
    console.log(`    Slice size: ${sliceMeta.width}x${sliceMeta.height}`);

    const analysis = await analyzeSlice(sliceBuffer, i);

    if (analysis.has_certificate) {
      console.log(`    ✅ CERT: ${analysis.cert_type}, Session: ${analysis.session_number || 'N/A'}`);
      if (analysis.session_text_seen) console.log(`       Session text: ${analysis.session_text_seen}`);
      if (analysis.key_text_visible) console.log(`       Key text: ${analysis.key_text_visible?.slice(0, 60)}`);
      certificates.push({ slice: i, ...analysis });
    } else {
      console.log(`    ❌ No cert`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return { dimensions: `${metadata.width}x${metadata.height}`, certificates };
}

async function main() {
  console.log('🔬 Testing UPSCALED Eirakudo Slices');
  console.log('='.repeat(60));

  // Get one Juyo listing
  const { data: listings } = await supabase
    .from('listings')
    .select('id, url, title, images, cert_type')
    .ilike('url', '%eirakudo%')
    .eq('cert_type', 'Juyo')
    .not('images', 'is', null)
    .limit(5);

  const listing = listings.find(l => l.images?.some(img => img.includes('_z')));
  if (!listing) {
    console.log('No suitable listing found');
    return;
  }

  const composite = listing.images.find(img => img.includes('_z'));
  console.log(`\nListing ${listing.id}: ${listing.title}`);
  console.log(`URL: ${listing.url}`);
  console.log(`DB cert_type: ${listing.cert_type}`);
  console.log(`Composite: ${composite}\n`);

  const result = await processComposite(composite);

  console.log('\n' + '='.repeat(60));
  console.log('RESULT');
  console.log('='.repeat(60));
  console.log(`Certificates found: ${result.certificates.length}`);
  result.certificates.forEach((c, i) => {
    console.log(`  [${i + 1}] Type: ${c.cert_type}, Session: ${c.session_number}`);
  });

  const hasJuyo = result.certificates.some(c => c.cert_type === 'juyo');
  console.log(`\nJuyo cert found: ${hasJuyo ? '✅ YES' : '❌ NO'}`);
}

main().catch(console.error);
