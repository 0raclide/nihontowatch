# AI Email Drafting System

## Overview

The Inquiry Email System helps English-speaking collectors compose culturally-appropriate Japanese business emails to contact Japanese sword dealers. It uses AI to generate formal Japanese emails with proper keigo (honorific language), seasonal greetings, and collector etiquette.

**Status**: ✅ Implemented (Core functionality complete)

## User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User clicks "Inquire" button on QuickView or Listing Detail │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. If not logged in → LoginModal → return to inquiry           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. InquiryModal opens with form:                               │
│     - Buyer Name (required)                                     │
│     - Buyer Country (required)                                  │
│     - Message (required) - freeform text describing intent      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. AI generates email via OpenRouter API:                      │
│     - Japanese email body with proper keigo                     │
│     - Japanese subject line                                     │
│     - English translation (for buyer reference)                 │
│     - Seasonal greetings based on current month                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. User sees generated email with copy buttons:                │
│     - Dealer email address (if known)                           │
│     - Subject line (Japanese)                                   │
│     - Email body (Japanese)                                     │
│     - English translation (collapsible, for reference)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. User manually sends email via their email client            │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  QuickViewContent.tsx ──────┐                                   │
│  ListingDetailClient.tsx ───┼──► InquiryModal.tsx               │
│                             │         │                         │
│                             │         ├── InquiryForm.tsx       │
│                             │         ├── InquiryResult.tsx     │
│                             │         └── CopyButton.tsx        │
│                             │                                   │
│                             └──► useInquiry.ts (hook)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ POST /api/inquiry/generate
┌─────────────────────────────────────────────────────────────────┐
│                        API ROUTE                                │
├─────────────────────────────────────────────────────────────────┤
│  route.ts                                                       │
│    │                                                            │
│    ├── Auth check (Supabase)                                    │
│    ├── Input validation (validation.ts)                         │
│    ├── Fetch listing + dealer data (Supabase)                   │
│    ├── Build prompt (prompts.ts + seasonal.ts)                  │
│    ├── Call OpenRouter API (Gemini model)                       │
│    ├── Parse JSON response (with newline fix)                   │
│    └── Log to inquiry_history (analytics)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OPENROUTER API                              │
├─────────────────────────────────────────────────────────────────┤
│  Model: google/gemini-2.0-flash-001                             │
│  Max tokens: 3000                                               │
│  Temperature: 0.7                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

```
src/
├── app/api/inquiry/
│   └── generate/
│       └── route.ts              # API endpoint
├── lib/inquiry/
│   ├── index.ts                  # Module exports
│   ├── types.ts                  # Type definitions
│   ├── validation.ts             # Input validation
│   ├── prompts.ts                # AI system/user prompts
│   └── seasonal.ts               # Seasonal greeting logic
├── hooks/
│   └── useInquiry.ts             # React hook for API calls
├── components/inquiry/
│   ├── InquiryModal.tsx          # Main modal component
│   ├── InquiryForm.tsx           # Form step
│   ├── InquiryResult.tsx         # Result display step
│   └── CopyButton.tsx            # Reusable copy button
└── components/listing/
    ├── QuickViewContent.tsx      # Inquire button integration
    └── ListingDetailClient.tsx   # Inquire button integration

tests/
├── api/inquiry/
│   └── generate.test.ts          # API unit tests (28 tests)
└── components/inquiry/
    └── InquiryModal.test.tsx     # Component tests

scripts/
└── test-inquiry-api.mjs          # Local OpenRouter testing script
```

## Database Schema

### dealers table (existing, extended)

```sql
-- Added columns for contact information
ALTER TABLE dealers ADD COLUMN contact_email TEXT;
ALTER TABLE dealers ADD COLUMN contact_page_url TEXT;
ALTER TABLE dealers ADD COLUMN sales_policy_url TEXT;
ALTER TABLE dealers ADD COLUMN ships_international BOOLEAN;
ALTER TABLE dealers ADD COLUMN accepts_wire_transfer BOOLEAN;
ALTER TABLE dealers ADD COLUMN accepts_paypal BOOLEAN;
ALTER TABLE dealers ADD COLUMN accepts_credit_card BOOLEAN;
ALTER TABLE dealers ADD COLUMN requires_deposit BOOLEAN;
ALTER TABLE dealers ADD COLUMN deposit_percentage NUMERIC(5,2);
ALTER TABLE dealers ADD COLUMN english_support BOOLEAN;
```

### inquiry_history table (new)

```sql
CREATE TABLE inquiry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    intent TEXT NOT NULL,           -- Default 'other' for freeform messages
    buyer_country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## AI Prompt System

### System Prompt Highlights

The system prompt (`src/lib/inquiry/prompts.ts`) instructs the AI to:

1. **Use proper keigo (敬語)**
   - 尊敬語 (sonkeigo) for dealer
   - 謙譲語 (kenjougo) for buyer
   - 丁寧語 (teineigo) for general politeness

2. **Follow Japanese email structure**
   - Subject line with item reference
   - Addressee (店名 御中)
   - Formal opening (拝啓)
   - Seasonal greeting (時候の挨拶)
   - Self-introduction
   - Apology for sudden contact
   - Main content
   - Closing thanks
   - Formal closing (敬具)
   - Signature

3. **Apply collector etiquette**
   - **Tax-free pricing**: Politely ask about 輸出価格 (export price) when buyer shows purchase intent. Japanese dealers save 10% consumption tax on exports.
   - **Serious collector positioning**: Present buyer as genuine collector
   - **Patience and respect**: Express willingness to follow dealer's process

4. **Preserve technical terms**
   - Sword types: 刀, 脇差, 短刀, 太刀
   - Tosogu: 鍔, 目貫, 小柄, 笄
   - Certifications: 重要, 特別重要, 保存, 特別保存
   - Measurements: 長さ, 反り, 元幅

### Seasonal Greetings

The system automatically selects appropriate seasonal greetings based on the current month:

| Month | Japanese | Meaning |
|-------|----------|---------|
| Jan | 新春の候 | Season of the New Year |
| Feb | 余寒の候 | Season of lingering cold |
| Mar | 早春の候 | Season of early spring |
| Apr | 陽春の候 | Season of warm spring |
| May | 新緑の候 | Season of fresh greenery |
| Jun | 初夏の候 | Season of early summer |
| Jul | 盛夏の候 | Season of midsummer |
| Aug | 残暑の候 | Season of lingering summer heat |
| Sep | 初秋の候 | Season of early autumn |
| Oct | 秋冷の候 | Season of autumn chill |
| Nov | 晩秋の候 | Season of late autumn |
| Dec | 師走の候 | Season of year-end |

## API Reference

### POST /api/inquiry/generate

**Authentication**: Required

**Request Body**:
```json
{
  "listingId": 12345,
  "buyerName": "John Smith",
  "buyerCountry": "United States",
  "message": "I am interested in purchasing this sword. Can you tell me about its condition?"
}
```

**Response (Success)**:
```json
{
  "subject_ja": "【お問い合わせ】備前長船祐定 刀について",
  "subject_en": "Inquiry: Bizen Osafune Sukesada Katana",
  "email_ja": "拝啓\n\n新春の候...",
  "email_en": "Dear Sir/Madam,\n\nIn this season...",
  "dealer_email": "info@aoijapan.com",
  "dealer_name": "Aoi Art",
  "dealer_domain": "aoijapan.com",
  "dealer_policies": {
    "ships_international": true,
    "accepts_wire_transfer": true,
    "accepts_paypal": true,
    "requires_deposit": true,
    "deposit_percentage": 30,
    "english_support": true
  }
}
```

**Error Responses**:
- `401` - Authentication required
- `400` - Validation error (missing/invalid fields)
- `404` - Listing not found
- `500` - Server error (API key missing, AI service error, parse error)

## Known Issues & Solutions

### 1. Claude Literal Newlines Bug

**Problem**: Claude (anthropic/claude-3.5-sonnet) returns JSON with literal newlines inside string values instead of escaped `\n` sequences, which is invalid JSON.

**Example of invalid response**:
```json
{
  "email_ja": "拝啓
新春の候..."
}
```

**Solution**: The `fixJsonNewlines()` function walks through the JSON string, tracks whether we're inside a quoted string, and escapes any literal newlines:

```typescript
function fixJsonNewlines(jsonStr: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    // ... track string boundaries, escape newlines
  }
  return result;
}
```

### 2. Model Selection

**Current**: Using `google/gemini-2.0-flash-001` (same as translate API)

**Reason**: More reliable JSON formatting than Claude. Both models produce high-quality Japanese emails.

**Future**: Could switch to Claude with the newline fix in place, or use different models for different use cases.

## Testing

### Unit Tests (28 tests)

```bash
npm test -- tests/api/inquiry/generate.test.ts
```

Tests cover:
- Authentication (401 when not logged in)
- Input validation (missing/invalid fields)
- Listing lookup (404 for non-existent)
- OpenRouter integration (model calls, prompt content)
- Response format (all required fields)
- History tracking (inquiry logged)
- Seasonal greetings (included in prompt)
- Error handling (API failures, malformed responses)

### Local API Testing

```bash
node scripts/test-inquiry-api.mjs
```

Tests OpenRouter directly with both Gemini and Claude models, showing raw responses and parsing results.

### Component Tests

```bash
npm test -- tests/components/inquiry
```

Tests InquiryModal flow, form validation, result display.

## What's Implemented ✅

1. **API Route** (`/api/inquiry/generate`)
   - Authentication check
   - Input validation
   - Listing + dealer data fetch
   - OpenRouter AI call
   - JSON response parsing with newline fix
   - Inquiry history logging

2. **React Hook** (`useInquiry`)
   - API call abstraction
   - Loading/error state management

3. **UI Components**
   - InquiryModal with two-step flow
   - InquiryForm with name/country/message fields
   - InquiryResult with copy buttons
   - CopyButton with toast feedback

4. **Integration**
   - Inquire button in QuickViewContent
   - Inquire button in ListingDetailClient
   - Login redirect for unauthenticated users

5. **AI Prompts**
   - Comprehensive system prompt with keigo rules
   - Collector etiquette (tax-free pricing, etc.)
   - Seasonal greeting system
   - Technical term preservation

6. **Database**
   - Dealer contact columns added
   - inquiry_history table for analytics

7. **Tests**
   - 28 unit tests for API
   - Component tests for modal
   - Local testing script

## What's Pending 🔲

1. **Dealer Contact Data Population**
   - Schema is ready, but most dealers don't have contact data yet
   - See [DEALER_CONTACT_RESEARCH.md](./DEALER_CONTACT_RESEARCH.md) for research spec
   - See [DEALER_CONTACT_DATA.md](./DEALER_CONTACT_DATA.md) for collected data

2. **E2E Tests**
   - Playwright test for full inquiry flow
   - Test with different listing types (sword vs tosogu)

3. **Analytics Dashboard**
   - Admin view of inquiry_history
   - Metrics: inquiries per dealer, popular countries, conversion tracking

4. **Rate Limiting**
   - Prevent abuse of AI API
   - Consider per-user daily limits

5. **Response Translation Feature** (Future)
   - Paste dealer's Japanese reply
   - Get English translation
   - Help with follow-up correspondence

## Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-xxx   # OpenRouter API key (same as translate)

# Already configured
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

## Usage Examples

### Basic Purchase Inquiry

**User Input**:
- Name: Christopher Hill
- Country: Switzerland
- Message: "I am interested in purchasing this item. Before I make up my mind I would like to see normal daylight photos of the sword."

**Generated Email** (Japanese):
```
拝啓

新春の候、貴社ますますご清祥のこととお慶び申し上げます。

突然のご連絡失礼いたします。スイス在住の日本刀収集家のクリストファー・ヒルと申します。

貴社ウェブサイトにて、重要刀 則成（古一文字）の太刀を拝見させていただき、大変興味を持ちました。

つきましては、ご購入を前向きに検討させていただきたく、自然光での画像を拝見することは可能でしょうか。

ご多忙のところ誠に恐れ入りますが、ご連絡いただけますようお願い申し上げます。

敬具

クリストファー・ヒル
スイス
```

### Question About Condition

**User Input**:
- Message: "Is there any active rust on the blade? Has it been recently polished?"

**Result**: AI generates polite inquiry asking about 錆 (sabi/rust) and 研ぎ (togi/polishing) status.

## Related Documentation

- [DEALER_CONTACT_RESEARCH.md](./DEALER_CONTACT_RESEARCH.md) - Research spec for dealer data
- [DEALER_CONTACT_DATA.md](./DEALER_CONTACT_DATA.md) - Collected dealer contact info
- [QUICKVIEW_METADATA.md](./QUICKVIEW_METADATA.md) - QuickView system (where Inquire button lives)
- [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) - Auth system used by inquiry
