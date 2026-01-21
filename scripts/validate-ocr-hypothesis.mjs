#!/usr/bin/env node
/**
 * Validate OCR Hypothesis: Can super-resolution + better prompting extract
 * readable text from Eirakudo composite images?
 *
 * Test: Take known failing cases, apply 4x upscale, use focused OCR prompt
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import sharp from 'sharp';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

// Test cases: Known Juyo items where cert detection failed to read details
const TEST_CASES = [
  {
    listing_id: 738,
    title: '真景 刀 重要刀剣',
    composite_url: 'https://eirakudo.shop/images/165762sanekage_z.jpeg',
    db_cert_type: 'Juyo',
    previous_result: 'Detected hozon, could not read details'
  },
  {
    listing_id: 578,
    title: '銘 弘次 太刀 重要刀剣',
    composite_url: 'https://eirakudo.shop/images/hirotsugu_z.jpg',
    db_cert_type: 'Juyo',
    previous_result: 'Detected cert, could not read type or session'
  },
  {
    listing_id: 1098,
    title: '来国光 刀 重要刀剣',
    composite_url: 'https://eirakudo.shop/images/422693raikuni_z.jpeg',
    db_cert_type: 'Juyo',
    previous_result: 'Detected cert, could not read details'
  }
];

// Configuration for super-resolution
const CERT_REGION = {
  // Certificate typically in top 3500px of composite
  top: 0,
  height: 3500
};
const UPSCALE_FACTOR = 4;  // 4x upscale

async function downloadAndSlice(url) {
  console.log(`    Downloading...`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 30000
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  console.log(`    Original: ${metadata.width}x${metadata.height}`);

  // Extract certificate region (top portion)
  const extractHeight = Math.min(CERT_REGION.height, metadata.height);
  console.log(`    Extracting top ${extractHeight}px...`);

  const slice = await sharp(buffer)
    .extract({
      left: 0,
      top: CERT_REGION.top,
      width: metadata.width,
      height: extractHeight
    })
    .toBuffer();

  return { slice, originalWidth: metadata.width, extractHeight };
}

async function superResolve(buffer, originalWidth, height) {
  // Apply 4x upscale with Lanczos resampling (best for text)
  const targetWidth = originalWidth * UPSCALE_FACTOR;
  const targetHeight = height * UPSCALE_FACTOR;

  console.log(`    Upscaling ${UPSCALE_FACTOR}x to ${targetWidth}x${targetHeight}...`);

  const upscaled = await sharp(buffer)
    .resize(targetWidth, targetHeight, {
      kernel: 'lanczos3',
      fastShrinkOnLoad: false
    })
    // Enhance contrast for text readability
    .sharpen({ sigma: 1.5 })
    .normalize()
    .jpeg({ quality: 95 })
    .toBuffer();

  return upscaled;
}

async function ocrWithClaude(buffer, testCase) {
  const base64 = buffer.toString('base64');

  // Use OpenRouter for GPT-4o (better Japanese OCR than Claude)
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
            image_url: {
              url: `data:image/jpeg;base64,${base64}`
            }
          },
          {
            type: 'text',
            text: `This is an UPSCALED image from a Japanese sword dealer showing certification documents.

CRITICAL TASK: Extract the EXACT Japanese text from the certification document(s) visible.

Look for:
1. The certification body header (日本美術刀剣保存協会)
2. The certification type:
   - 重要刀剣 = Juyo Token (Important Sword)
   - 重要刀装具 = Juyo Tosogu (Important Fittings)
   - 特別重要刀剣 = Tokubetsu Juyo (Especially Important)
   - 保存刀剣 = Hozon Token (Worthy of Preservation)
   - 特別保存刀剣 = Tokubetsu Hozon

3. The session number (第X回) - this is CRUCIAL
   Examples: 第四十六回, 第三十七回, 第48回

4. The date (年月日 format)

5. The setsumei (説明) - the descriptive text about the sword

OUTPUT ONLY valid JSON:
{
  "cert_header": "exact header text if visible",
  "cert_type_japanese": "exact cert type in Japanese",
  "cert_type_english": "juyo|tokuju|hozon|tokuhozon|unknown",
  "session_text": "exact session text like 第四十六回",
  "session_number": 46,
  "date_text": "date if visible",
  "setsumei_excerpt": "first 200 chars of descriptive text if visible",
  "confidence": "high|medium|low",
  "notes": "any issues reading the text"
}`
          }
        ]
      }],
      max_tokens: 1500,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { error: 'json_parse_failed', raw: text };
    }
  }
  return { error: 'no_json', raw: text };
}

async function processTestCase(testCase) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Listing ${testCase.listing_id}: ${testCase.title}`);
  console.log(`DB cert_type: ${testCase.db_cert_type}`);
  console.log(`Previous result: ${testCase.previous_result}`);
  console.log(`${'='.repeat(70)}`);

  try {
    // Step 1: Download and slice
    console.log('\n  [1/3] Download & Extract Certificate Region');
    const { slice, originalWidth, extractHeight } = await downloadAndSlice(testCase.composite_url);

    // Step 2: Super-resolution
    console.log('\n  [2/3] Super-Resolution');
    const upscaled = await superResolve(slice, originalWidth, extractHeight);

    // Save upscaled image for inspection
    const outDir = 'certificate-detection-results/upscaled';
    mkdirSync(outDir, { recursive: true });
    const outPath = `${outDir}/listing_${testCase.listing_id}_4x.jpg`;
    writeFileSync(outPath, upscaled);
    console.log(`    Saved to: ${outPath}`);

    // Step 3: OCR
    console.log('\n  [3/3] OCR with GPT-4o');
    const ocrResult = await ocrWithClaude(upscaled, testCase);

    console.log('\n  OCR Result:');
    console.log(JSON.stringify(ocrResult, null, 2));

    return {
      listing_id: testCase.listing_id,
      title: testCase.title,
      db_cert_type: testCase.db_cert_type,
      previous_result: testCase.previous_result,
      upscaled_path: outPath,
      ocr_result: ocrResult,
      success: ocrResult.cert_type_english && ocrResult.cert_type_english !== 'unknown'
    };

  } catch (error) {
    console.log(`\n  ❌ Error: ${error.message}`);
    return {
      listing_id: testCase.listing_id,
      error: error.message,
      success: false
    };
  }
}

async function main() {
  console.log('🔬 OCR Hypothesis Validation');
  console.log('Testing: 4x super-resolution + GPT-4o OCR on Eirakudo composites');
  console.log(`Test cases: ${TEST_CASES.length} known failing Juyo listings\n`);

  const results = [];

  for (const testCase of TEST_CASES) {
    const result = await processTestCase(testCase);
    results.push(result);

    // Rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  console.log(`\nSuccess rate: ${successful.length}/${results.length} (${Math.round(successful.length/results.length*100)}%)`);

  console.log('\nPer-case results:');
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const certType = r.ocr_result?.cert_type_english || 'N/A';
    const session = r.ocr_result?.session_number || 'N/A';
    console.log(`  ${status} Listing ${r.listing_id}: cert=${certType}, session=${session}`);
  }

  // Save results
  const outPath = 'certificate-detection-results/ocr-hypothesis-validation.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to: ${outPath}`);

  // Conclusion
  console.log('\n' + '='.repeat(70));
  if (successful.length === results.length) {
    console.log('✅ HYPOTHESIS VALIDATED: Super-resolution + better OCR works!');
  } else if (successful.length > 0) {
    console.log(`⚠️  PARTIAL SUCCESS: ${successful.length}/${results.length} cases improved`);
  } else {
    console.log('❌ HYPOTHESIS NOT VALIDATED: Super-resolution alone is insufficient');
  }
  console.log('='.repeat(70));
}

main().catch(console.error);
