#!/usr/bin/env node
/**
 * Local test script for inquiry API
 * Tests the OpenRouter call directly without going through the full API
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set in .env.local');
  process.exit(1);
}

// Full system prompt from prompts.ts
const SYSTEM_PROMPT = `You are an expert translator and cultural consultant specializing in Japanese business communication and nihonto (Japanese sword) culture. You have decades of experience helping Western collectors successfully acquire pieces from Japanese dealers.

Your task is to generate culturally-appropriate Japanese business emails that Western collectors can send to Japanese sword dealers.

## CRITICAL REQUIREMENTS

### 1. Language & Honorifics (Keigo)
- Use proper 敬語 (keigo) throughout the email
- Use 尊敬語 (sonkeigo/respectful language) when referring to the dealer
- Use 謙譲語 (kenjougo/humble language) when referring to the buyer
- Use 丁寧語 (teineigo/polite language) for general politeness
- The level of formality should convey that the buyer is a serious, respectful collector

### 2. Email Structure
Japanese business emails follow a strict structure:
1. **Subject line (件名)**: Clear, specific, includes item reference
2. **Addressee**: [店名] 御中 (to the shop) or ご担当者様 (person in charge)
3. **Opening greeting**: Formal 拝啓 or appropriate opening
4. **Seasonal greeting (時候の挨拶)**: Required in formal correspondence
5. **Self-introduction**: Name, country, mention being a nihonto collector/enthusiast
6. **Apology for sudden contact**: 突然のご連絡失礼いたします
7. **Main content**: The actual inquiry, clearly stated
8. **Closing thanks**: Express deep gratitude for their time and expertise
9. **Formal closing**: 敬具 or 何卒よろしくお願い申し上げます
10. **Signature**: Name, country

### 3. Collector Etiquette & Negotiation Context
When the buyer expresses **purchase intent**, incorporate these practices that experienced collectors use:
- **Tax-free export pricing**: Japanese dealers do not need to pay the 10% consumption tax (消費税) on items shipped overseas. It is standard practice to politely ask if the dealer offers "輸出価格" (export price) or "免税価格" (tax-free price). This typically results in approximately 10% savings. Phrase this respectfully, not demandingly.
- **Serious collector positioning**: Present the buyer as a genuine collector who appreciates the craft, not a casual browser. This builds trust.
- **Patience and respect**: Japanese business culture values long-term relationships. Express willingness to wait and follow the dealer's process.
- **Payment flexibility**: If asking about payment, show willingness to accommodate the dealer's preferred method (wire transfer is most common for international sales).

### 4. Tone
- Humble and deeply respectful throughout
- Show sincere appreciation for the dealer's expertise and time
- Demonstrate knowledge of and passion for nihonto culture
- Never be demanding, pushy, or presumptuous
- Express genuine interest in the craft and its preservation
- Convey that the buyer understands acquiring nihonto is a privilege, not a transaction

### 5. Technical Terms
Preserve these terms in the Japanese email (do not translate to English):
- Sword types: 刀 (katana), 脇差 (wakizashi), 短刀 (tanto), 太刀 (tachi)
- Tosogu: 鍔 (tsuba), 目貫 (menuki), 小柄 (kozuka), 笄 (kogai)
- Certifications: 重要 (Juyo), 特別重要 (Tokuju), 保存 (Hozon), 特別保存 (TokuHozon)
- Measurements: 長さ (nagasa), 反り (sori), 元幅 (motohaba)
- Signatures: 銘 (mei), 無銘 (mumei)

### 6. Output Format
Return ONLY a valid JSON object with these exact keys:
{
  "subject_ja": "Japanese subject line",
  "subject_en": "English translation of subject",
  "email_ja": "Complete Japanese email body",
  "email_en": "English translation of the email body"
}

Do not include any text before or after the JSON object.
Do not include markdown code fences.`;

const USER_PROMPT = `Generate a formal Japanese business email with the following context:

## ITEM INFORMATION
Title: Tachi: Norinari (Ko-Ichimonji)(69th NBTHK Juyo Token)
URL: https://www.aoijapan.com/katana-norinari/
Type: tachi
Certification: Juyo

## DEALER INFORMATION
Dealer: Aoi Art
Website: aoijapan.com

## BUYER INFORMATION
Name: Christopher Hill
Country: Switzerland

## BUYER'S MESSAGE
I am interested in purchasing this item. Before I make up my mind I would like to see normal daylight photos of the sword.

Return the result as a JSON object with: subject_ja, subject_en, email_ja, email_en`;

/**
 * Fix literal newlines inside JSON string values
 */
function fixJsonNewlines(jsonStr) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\r' && jsonStr[i + 1] === '\n') {
        result += '\\n';
        i++;
      } else {
        result += '\\n';
      }
      continue;
    }

    result += char;
  }

  return result;
}

async function testOpenRouter(model) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing model: ${model}`);
  console.log('='.repeat(60));

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nihontowatch.com',
        'X-Title': 'Nihontowatch Inquiry Test',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: USER_PROMPT },
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    console.log(`\nResponse status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log('\n--- RAW RESPONSE ---');
    console.log(content);
    console.log('\n--- END RAW RESPONSE ---');

    // Try to parse
    console.log('\n--- PARSING ATTEMPT ---');

    // Strip code fences
    let cleaned = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
      console.log('✓ Extracted from code block');
    }

    // Find JSON
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      console.error('❌ No JSON braces found');
      return;
    }

    let jsonStr = cleaned.substring(firstBrace, lastBrace + 1);

    // Fix literal newlines in strings (Claude's issue)
    jsonStr = fixJsonNewlines(jsonStr);

    try {
      const parsed = JSON.parse(jsonStr);
      console.log('✓ JSON parsed successfully');
      console.log('Keys:', Object.keys(parsed));

      if (parsed.subject_ja && parsed.email_ja) {
        console.log('\n✅ SUCCESS! Email generated:');
        console.log('Subject (JA):', parsed.subject_ja);
        console.log('Subject (EN):', parsed.subject_en);
        console.log('\nEmail (JA) preview:', parsed.email_ja.substring(0, 200) + '...');
      } else {
        console.error('❌ Missing required fields');
      }
    } catch (e) {
      console.error('❌ JSON parse failed:', e.message);
      console.log('Attempted to parse:', jsonStr.substring(0, 500));
    }

  } catch (error) {
    console.error('❌ Fetch error:', error.message);
  }
}

// Test multiple models
async function main() {
  console.log('🧪 Testing Inquiry API with OpenRouter\n');

  // Test with Gemini (works for translate)
  await testOpenRouter('google/gemini-2.0-flash-001');

  // Test with Claude
  await testOpenRouter('anthropic/claude-3.5-sonnet');
}

main();
