/**
 * AI Prompt Templates for Inquiry Email Generation
 *
 * These prompts guide Claude to generate culturally-appropriate
 * Japanese business emails for nihonto collectors.
 */

import type { InquiryContext } from './types';
import { getGreetingContext } from './seasonal';

// =============================================================================
// System Prompt
// =============================================================================

/**
 * System prompt that establishes Claude's role and constraints
 */
export const SYSTEM_PROMPT = `You are an expert translator and cultural consultant specializing in Japanese business communication and nihonto (Japanese sword) culture.

Your task is to generate culturally-appropriate Japanese business emails that Western collectors can send to Japanese sword dealers.

## CRITICAL REQUIREMENTS

### 1. Language & Honorifics (Keigo)
- Use proper 敬語 (keigo) throughout the email
- Use 尊敬語 (sonkeigo/respectful language) when referring to the dealer
- Use 謙譲語 (kenjougo/humble language) when referring to the buyer
- Use 丁寧語 (teineigo/polite language) for general politeness

### 2. Email Structure
Japanese business emails follow a strict structure:
1. **Subject line (件名)**: Clear, specific, includes item reference
2. **Addressee**: [店名] 御中 (to the shop) or ご担当者様 (person in charge)
3. **Opening greeting**: Formal 拝啓 or appropriate opening
4. **Seasonal greeting (時候の挨拶)**: Required in formal correspondence
5. **Self-introduction**: Name, country, brief collector background
6. **Apology for sudden contact**: 突然のご連絡失礼いたします
7. **Main content**: The actual inquiry, clearly stated
8. **Closing thanks**: Express gratitude for their time
9. **Formal closing**: 敬具 or 何卒よろしくお願い申し上げます
10. **Signature**: Name, country, (email if relevant)

### 3. Tone
- Humble and respectful throughout
- Show appreciation for the dealer's time
- Demonstrate basic knowledge of nihonto culture
- Never be demanding or presumptuous
- Express genuine interest in the craft

### 4. Technical Terms
Preserve these terms in the Japanese email (do not translate to English):
- Sword types: 刀 (katana), 脇差 (wakizashi), 短刀 (tanto), 太刀 (tachi)
- Tosogu: 鍔 (tsuba), 目貫 (menuki), 小柄 (kozuka), 笄 (kogai)
- Certifications: 重要 (Juyo), 特別重要 (Tokuju), 保存 (Hozon), 特別保存 (TokuHozon)
- Measurements: 長さ (nagasa), 反り (sori), 元幅 (motohaba)
- Signatures: 銘 (mei), 無銘 (mumei)

### 5. Output Format
Return ONLY a valid JSON object with these exact keys:
{
  "subject_ja": "Japanese subject line",
  "subject_en": "English translation of subject",
  "email_ja": "Complete Japanese email body",
  "email_en": "English translation of the email body"
}

Do not include any text before or after the JSON object.
Do not include markdown code fences.`;

// =============================================================================
// User Prompt Builder
// =============================================================================

/**
 * Build the user prompt with all context
 *
 * @param context - Full inquiry context
 * @returns Formatted user prompt string
 */
export function buildUserPrompt(context: InquiryContext): string {
  const { listing, dealer, buyer, message } = context;

  // Build item description
  const itemParts: string[] = [
    `Title: ${listing.title}`,
    `URL: ${listing.url}`,
  ];

  if (listing.item_type) {
    itemParts.push(`Type: ${listing.item_type}`);
  }
  if (listing.cert_type) {
    itemParts.push(`Certification: ${listing.cert_type}`);
  }
  if (listing.smith) {
    itemParts.push(`Smith: ${listing.smith}`);
  }
  if (listing.tosogu_maker) {
    itemParts.push(`Maker: ${listing.tosogu_maker}`);
  }
  if (listing.school || listing.tosogu_school) {
    itemParts.push(`School: ${listing.school || listing.tosogu_school}`);
  }
  if (listing.era) {
    itemParts.push(`Era: ${listing.era}`);
  }
  if (listing.price_value) {
    const currency = listing.price_currency || 'JPY';
    const formatted = listing.price_value.toLocaleString();
    itemParts.push(`Price: ${formatted} ${currency}`);
  }

  const itemDescription = itemParts.join('\n');

  // Build dealer info
  const dealerInfo = `Dealer: ${dealer.name}\nWebsite: ${dealer.domain}`;

  // Build policy context if available
  const policyParts: string[] = [];
  if (dealer.ships_international === true) {
    policyParts.push('Ships internationally: Yes');
  } else if (dealer.ships_international === false) {
    policyParts.push('Ships internationally: No (Japan domestic only)');
  }
  if (dealer.english_support === true) {
    policyParts.push('English support: Available');
  }
  if (dealer.requires_deposit === true) {
    const depositInfo = dealer.deposit_percentage
      ? `Requires deposit: Yes (${dealer.deposit_percentage}%)`
      : 'Requires deposit: Yes';
    policyParts.push(depositInfo);
  }
  if (dealer.accepts_wire_transfer === true) {
    policyParts.push('Accepts: Bank wire transfer');
  }
  if (dealer.accepts_paypal === true) {
    policyParts.push('Accepts: PayPal');
  }

  const policySection = policyParts.length > 0
    ? `\n\n## KNOWN DEALER POLICIES\n${policyParts.join('\n')}`
    : '';

  // Get seasonal greeting context
  const seasonalContext = getGreetingContext();

  return `Generate a formal Japanese business email with the following context:

## SEASONAL CONTEXT
${seasonalContext}

## ITEM INFORMATION
${itemDescription}

## DEALER INFORMATION
${dealerInfo}${policySection}

## BUYER INFORMATION
Name: ${buyer.name}
Country: ${buyer.country}

## BUYER'S MESSAGE (translate this intent into a polite Japanese business email)
${message}

Please generate a culturally-appropriate Japanese business email that:
1. Uses proper keigo throughout
2. Includes an appropriate seasonal greeting
3. Introduces the buyer politely
4. Clearly communicates the buyer's message/request
5. Thanks the dealer for their time
6. Uses proper formal closings

Return the result as a JSON object with: subject_ja, subject_en, email_ja, email_en`;
}
