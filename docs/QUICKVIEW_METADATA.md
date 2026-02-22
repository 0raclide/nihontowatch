# QuickView Metadata & Translation System

Complete documentation for the enhanced QuickView metadata display and automatic translation system.

---

## Overview

The QuickView feature displays detailed item information in a modal/sheet overlay. This system provides:

1. **Rich Metadata Display** - Type-aware metadata for swords vs tosogu
2. **Automatic Translation** - Japanese descriptions translated to English via OpenRouter
3. **Mobile Parity** - Full metadata in expanded mobile sheet
4. **Collapsed Quick Info** - Key measurement in mobile collapsed pill

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        QuickView System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ QuickView   │───▶│ QuickView    │───▶│ MetadataGrid    │   │
│  │ (Container) │    │ Content      │    │ (Type-aware)    │   │
│  └─────────────┘    └──────────────┘    └─────────────────┘   │
│         │                  │                     │             │
│         │                  │            ┌────────┴────────┐   │
│         │                  │            ▼                 ▼   │
│         │                  │     ┌──────────┐     ┌──────────┐│
│         │                  │     │ Sword    │     │ Tosogu   ││
│         │                  │     │ Fields   │     │ Fields   ││
│         │                  │     └──────────┘     └──────────┘│
│         │                  │                                   │
│         │                  ▼                                   │
│         │         ┌──────────────────┐                        │
│         │         │ Translated       │                        │
│         │         │ Description      │───────┐                │
│         │         └──────────────────┘       │                │
│         │                                    ▼                │
│         │                          ┌─────────────────┐        │
│         │                          │ /api/translate  │        │
│         │                          │ (OpenRouter)    │        │
│         │                          └─────────────────┘        │
│         │                                    │                │
│         ▼                                    ▼                │
│  ┌─────────────────┐               ┌─────────────────┐        │
│  │ QuickView       │               │ Supabase        │        │
│  │ MobileSheet     │               │ (Cache)         │        │
│  └─────────────────┘               └─────────────────┘        │
│         │                                                      │
│         ▼                                                      │
│  ┌─────────────────┐                                          │
│  │ QuickMeasurement│                                          │
│  │ (Collapsed Pill)│                                          │
│  └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### MetadataGrid

**Location:** `src/components/listing/MetadataGrid.tsx`

Type-aware metadata display that automatically shows appropriate fields based on item type.

#### Props

```typescript
interface MetadataGridProps {
  listing: Listing;
  variant?: 'full' | 'compact';
  className?: string;
  showAttribution?: boolean;
  showMeasurements?: boolean;
}
```

#### Sword Fields (Blades)

| Field | Label | Unit | Example | Status |
|-------|-------|------|---------|--------|
| `smith` | Smith | - | Sukehiro | ✅ Available |
| `school` | School | - | Settsu | ✅ Available |
| `era` | Era | - | Edo | ✅ Available |
| `province` | Province | - | Osaka | ✅ Available |
| `mei_type` | Signature | - | Mei | ✅ Available |
| `nagasa_cm` | Nagasa | cm | 71.2 | ✅ Available |
| `sori_cm` | Sori | cm | 1.8 | ✅ Available |
| `motohaba_cm` | Motohaba | cm | 3.2 | ✅ Available |
| `sakihaba_cm` | Sakihaba | cm | 2.3 | ✅ Available |
| `kasane_cm` | Kasane | cm | 0.72 | ✅ Available |
| `weight_g` | Weight | g | 820 | ✅ Available |
| `nakago_cm` | Nakago | cm | 21.5 | ❌ Not in DB |

#### Tosogu Fields (Fittings)

| Field | Label | Unit | Example | Status |
|-------|-------|------|---------|--------|
| `tosogu_maker` | Maker | - | Goto Ichijo | ✅ Available |
| `tosogu_school` | School | - | Goto | ✅ Available |
| `era` | Era | - | Edo | ✅ Available |
| `mei_type` | Signature | - | Mei | ✅ Available |
| `height_cm` | Height | cm | 7.5 | ❌ Not in DB |
| `width_cm` | Width | cm | 7.2 | ❌ Not in DB |
| `thickness_mm` | Thickness | mm | 5.2 | ❌ Not in DB |
| `material` | Material | - | Iron with gold inlay | ❌ Not in DB |

> **Note:** Tosogu measurement fields (`height_cm`, `width_cm`, `thickness_mm`, `material`) and sword `nakago_cm` are defined in the Oshi-scrapper data model but not yet added to the production database. The UI gracefully handles missing fields by hiding them.

#### Certification Display

Certifications are displayed with tier-based styling:

| Tier | Certifications | Style |
|------|----------------|-------|
| Premier | Juyo, Tokubetsu Juyo | Gold background |
| High | Tokubetsu Hozon | Amber background |
| Standard | Hozon, NTHK | Gray background |

```typescript
const CERT_CONFIG = {
  'Juyo': { label: 'Juyo', shortLabel: 'Juyo', tier: 'premier' },
  'Tokubetsu Juyo': { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  'Tokubetsu Hozon': { label: 'Tokubetsu Hozon', shortLabel: 'TokuHo', tier: 'high' },
  'Hozon': { label: 'Hozon', shortLabel: 'Hozon', tier: 'standard' },
  // ... tosogu variants
};
```

#### Helper Functions

```typescript
// Get artisan info based on item type and locale
// JA locale: returns original kanji names directly
// EN locale: romanizes Japanese names via title_en extraction, filters out untranslatable names
getArtisanInfo(listing: Listing, locale: string = 'en'): {
  artisan: string | null;   // smith or tosogu_maker (locale-aware)
  school: string | null;    // school or tosogu_school (locale-aware)
  artisanLabel: string;     // "Smith" or "Maker"
  era: string | null;
  isEnriched: boolean;
}

// Get certification display info
getCertInfo(certType: string): {
  label: string;
  shortLabel: string;
  tier: 'premier' | 'high' | 'standard';
} | null
```

---

### TranslatedDescription

**Location:** `src/components/listing/TranslatedDescription.tsx`

Displays listing descriptions with automatic Japanese-to-English translation.

#### Props

```typescript
interface TranslatedDescriptionProps {
  listing: Listing;
  className?: string;
  maxLines?: number;  // Default: 6
}
```

#### Behavior (Locale-Aware)

The component is locale-aware via `useLocale()`:

**EN locale (default):**
1. **Check for cached translation** - If `description_en` exists, display immediately
2. **Detect Japanese text** - Uses regex: `/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/`
3. **Trigger translation** - Calls `/api/translate` if Japanese detected
4. **Show loading state** - Skeleton animation while translating
5. **Toggle original** - "Show original" / "Show translation" button

**JA locale:**
1. **Show original Japanese description** by default (`showOriginal = true`)
2. **Skip auto-translate** - Never calls `/api/translate`
3. **Toggle to English** - "翻訳を表示" / "原文を表示" toggle (only if `description_en` exists)

All hardcoded strings localized via `t()`: "Description" → "説明", "Show original" → "原文を表示", "Read more" → "続きを読む", etc.

#### States

| State | EN Display | JA Display |
|-------|------------|------------|
| Loading | Animated skeleton lines | N/A (no fetch) |
| Translated | English text with "Show original" | Japanese text with "翻訳を表示" |
| No Japanese | Original text (no toggle) | Original text (no toggle) |
| Error | Original text with "(Translation unavailable)" | Original text with "（翻訳なし）" |
| No description | Component returns null | Component returns null |

---

### QuickMeasurement

**Location:** `src/components/listing/QuickMeasurement.tsx`

Compact measurement display for mobile collapsed pill.

#### Props

```typescript
interface QuickMeasurementProps {
  listing: Listing;
  className?: string;
}
```

#### Output by Type

| Item Type | Format | Example |
|-----------|--------|---------|
| Sword (blade) | `{nagasa}cm` | 71.2cm |
| Tosogu (fitting) | `{height}×{width}cm` | 7.5×7.2cm |
| No measurements | Returns null | - |

---

## Translation API

**Endpoint:** `POST /api/translate`

### Request

```typescript
{
  listingId: number
}
```

### Response

```typescript
// Success - fresh translation
{
  translation: string,
  cached: false
}

// Success - cached translation
{
  translation: string,
  cached: true
}

// No description
{
  translation: null,
  cached: true,
  reason: 'no_description'
}

// No Japanese text
{
  translation: string,  // Original text
  cached: false,
  reason: 'no_japanese'
}

// Error
{
  translation: string,  // Original text as fallback
  cached: false,
  error: 'Translation failed'
}
```

### Translation Flow

```
Request: { listingId: 123 }
    │
    ▼
┌──────────────────────────────┐
│ Fetch listing from Supabase  │
│ SELECT id, description,      │
│        description_en,       │
│        item_type             │
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ Check if description exists  │──▶ No ──▶ Return { translation: null }
└──────────────────────────────┘
    │ Yes
    ▼
┌──────────────────────────────┐
│ Check if description_en      │──▶ Yes ──▶ Return cached
│ already exists               │
└──────────────────────────────┘
    │ No
    ▼
┌──────────────────────────────┐
│ Check for Japanese text      │──▶ No ──▶ Store original as translation
│ (regex detection)            │
└──────────────────────────────┘
    │ Yes
    ▼
┌──────────────────────────────┐
│ Call OpenRouter API          │
│ Model: gemini-2.0-flash-001  │
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ Cache in description_en      │
└──────────────────────────────┘
    │
    ▼
Return { translation, cached: false }
```

### OpenRouter Configuration

```typescript
{
  model: 'google/gemini-2.0-flash-001',
  messages: [{
    role: 'user',
    content: `Translate this Japanese ${itemContext} dealer description to English.
Preserve technical terms in romaji (mei, mumei, nagasa, sori, shakudo, etc.).
Keep formatting and line breaks.
Only output the translation, no explanations or preamble.

${description}`
  }],
  max_tokens: 2000,
  temperature: 0.3
}
```

### Item Context Detection

The API determines item context for better translation quality:

```typescript
const itemContext = listing.item_type?.includes('tsuba') ||
  listing.item_type?.includes('menuki') ||
  listing.item_type?.includes('kozuka') ||
  listing.item_type?.includes('kogai') ||
  listing.item_type?.includes('fuchi') ||
  listing.item_type?.includes('kashira')
  ? 'sword fitting (tosogu)'
  : 'Japanese sword (nihonto)';
```

---

## Database Schema

### Required Column

```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_en TEXT;
```

### Fields Used by QuickView

```sql
-- Attribution (all available)
smith, school, tosogu_maker, tosogu_school,
era, province, mei_type,
cert_type, cert_session, cert_organization,

-- Sword Measurements (available)
nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm,
kasane_cm, weight_g,

-- NOT YET IN DATABASE (defined in Oshi-scrapper but not migrated):
-- nakago_cm, height_cm, width_cm, thickness_mm, material

-- Description
description, description_en
```

### Missing Columns (Future Migration)

These columns are defined in the Oshi-scrapper data model but need to be added to production:

```sql
-- Run this when ready to add tosogu measurements
ALTER TABLE listings ADD COLUMN IF NOT EXISTS nakago_cm NUMERIC;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS height_cm NUMERIC;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS width_cm NUMERIC;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS thickness_mm NUMERIC;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS material TEXT;
```

---

## Mobile UX

### Collapsed State

```
┌────────────────────────────────────────────────────┐
│  ¥6,000,000  │  71.2cm  │  [↑]  │  ❤  │  3/8     │
└────────────────────────────────────────────────────┘
     Price      Measurement  Expand  Fav   Images
```

- **Price** - Left aligned, prominent
- **Measurement** - QuickMeasurement component (nagasa or dimensions)
- **Expand** - Chevron with subtle bounce animation
- **Favorite** - Heart button (stops event propagation)
- **Image Count** - Current/total indicator

### Expanded State

```
┌──────────────────────────────────────────┐
│  ──────  (drag handle)               [X] │
├──────────────────────────────────────────┤
│  ¥6,000,000                          [❤] │
│  ┌────────┐  ┌──────────┐                │
│  │ KATANA │  │  JUYO    │                │
│  └────────┘  └──────────┘                │
│                                          │
│  Sukehiro (2nd gen)                      │
│  🏢 Aoi Art  ·  3 days                   │
├──────────────────────────────────────────┤
│  ATTRIBUTION                             │
│  School    Settsu   │  Era      Edo      │
│  Province  Osaka    │  Signature Mei     │
│  Papers    Juyo #42 (NBTHK)              │
├──────────────────────────────────────────┤
│  MEASUREMENTS                            │
│  Nagasa   71.2cm  │  Sori     1.8cm      │
│  Motohaba  3.2cm  │  Sakihaba 2.3cm      │
│  Kasane   0.72cm  │  Weight   820g       │
├──────────────────────────────────────────┤
│  DESCRIPTION                             │
│  "This exceptional katana by the         │
│   second generation Sukehiro..."         │
│   [Show original Japanese]               │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │       See Full Listing     →       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Gestures

| Gesture | Action |
|---------|--------|
| Swipe up on collapsed | Expand sheet |
| Swipe down on expanded | Collapse sheet |
| Tap collapsed bar | Expand sheet |
| Tap X button | Close QuickView |
| Tap image area | Toggle expand/collapse |

### Scroll Handling

The expanded sheet has a scrollable content area that:
- Stops touch event propagation to prevent sheet gestures
- Uses `overscroll-contain` to prevent body scroll
- Has `data-testid="mobile-sheet-scroll-content"` for testing

---

## Environment Variables

```bash
# Required for translation
OPENROUTER_API_KEY=sk-or-v1-xxx

# Existing Supabase config
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## Testing

### Test Files

| File | Coverage |
|------|----------|
| `tests/quickview-regression.spec.ts` | Metadata display, mobile sheet |
| `tests/translation-api.spec.ts` | Translation API endpoints |
| `tests/lib/listing-data-localization.test.ts` | `getArtisanInfo()` locale awareness (16 tests) |
| `tests/components/listing/MetadataGrid-locale.test.tsx` | MetadataGrid locale rendering (13 tests) |
| `tests/components/listing/TranslatedTitle.test.tsx` | TranslatedTitle locale behavior (9 tests) |
| `tests/components/listing/TranslatedDescription.test.tsx` | TranslatedDescription locale behavior (13 tests) |
| `tests/components/listing/listing-data-locale.test.tsx` | ListingCard locale-aware title + artisan kanji (6 tests) |

### Key Test Cases

#### Metadata Display
- Sword metadata shows nagasa, sori, motohaba, etc.
- Tosogu metadata shows height, width, material
- Missing measurements hide gracefully
- Certification badges display with correct tier styling

#### Mobile Sheet
- Collapsed pill shows QuickMeasurement
- Expanded sheet has full metadata parity
- Content area scrolls independently
- Gestures work correctly

#### Translation API
- Returns error for missing listingId
- Returns error for invalid listingId type
- Returns 404 for non-existent listing
- Returns cached translation if available
- Handles concurrent requests gracefully

### Running Tests

```bash
# All QuickView tests
npx playwright test tests/quickview-regression.spec.ts

# Translation API tests
npx playwright test tests/translation-api.spec.ts

# Specific test
npx playwright test -g "sword metadata displays correctly"
```

---

## Error Handling

### Translation Errors

| Error | Handling |
|-------|----------|
| OpenRouter API failure | Return original description |
| Empty translation response | Return original description |
| Network timeout | Return original description |
| Missing API key | Return original description with console error |

### Graceful Degradation

The system degrades gracefully at each level:

1. **No description_en column** - Translation API will fail but browse works
2. **No OPENROUTER_API_KEY** - Shows original Japanese description
3. **Translation fails** - Shows original with "(Translation unavailable)"
4. **No description** - Section hidden entirely
5. **No measurements** - Section hidden entirely

---

## Performance Considerations

### Translation Caching

- Translations cached in `description_en` column
- Subsequent views instant (no API call)
- Non-Japanese descriptions auto-cached as-is

### API Efficiency

- Browse API fetches description in initial query
- Translation triggered only when QuickView opens
- One translation per listing (cached forever)

### Mobile Optimization

- MetadataGrid uses minimal DOM
- MeasurementItem only renders if value exists
- Translation loading shows skeleton (not spinner)

---

## File Reference

| File | Purpose |
|------|---------|
| `src/components/listing/MetadataGrid.tsx` | Type-aware metadata display |
| `src/components/listing/TranslatedDescription.tsx` | Translation UI with toggle |
| `src/components/listing/QuickMeasurement.tsx` | Compact measurement for mobile |
| `src/components/listing/QuickViewContent.tsx` | Desktop QuickView content |
| `src/components/listing/QuickViewMobileSheet.tsx` | Mobile bottom sheet |
| `src/app/api/translate/route.ts` | OpenRouter translation endpoint |
| `src/app/api/browse/route.ts` | Browse API (fetches metadata) |
| `src/types/index.ts` | Listing type with description_en |
| `tests/quickview-regression.spec.ts` | QuickView tests |
| `tests/translation-api.spec.ts` | Translation API tests |

---

## Changelog

### 2026-02-22
- **Listing data localization** — all listing data (titles, descriptions, artisan names) locale-aware
- `getArtisanInfo()` accepts `locale` parameter — JA returns kanji, EN romanizes
- TranslatedTitle locale-aware — JA shows original title, EN shows `title_en`
- TranslatedDescription locale-aware — JA defaults to original, toggle labels localized
- ListingCard `cleanedTitle` uses `title_en` for EN locale
- QuickViewContent shows `artisan_name_kanji` for JA locale
- `mei_type` localized via `td('meiType', ...)` — "Signed"/"在銘", "Unsigned"/"無銘"
- 7 new i18n keys added (`listing.showOriginal`, `listing.showTranslation`, etc.)
- 57 new tests across 5 test files

### 2026-01-18
- Initial implementation
- MetadataGrid component with sword/tosogu support
- TranslatedDescription with OpenRouter integration
- QuickMeasurement for mobile collapsed pill
- Enhanced mobile sheet with full metadata parity
- Translation caching in description_en column
