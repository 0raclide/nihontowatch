# Artisan Tooltip & Verification System

**Status:** ✅ Live in Production
**Admin Only:** Yes
**Purpose:** QA tool for verifying artisan ID matches on listings

---

## Admin Tool Consolidation (2026-02-26)

Artisan admin tools were consolidated from 3 overlapping surfaces into a single unified panel:

| Before | After |
|--------|-------|
| **ArtisanTooltip** in QuickView (floating portal with search, verify, cert editing) | **Removed from QuickView** — only on browse grid ListingCards |
| **AdminArtisanWidget** (collapsible search panel in QuickView) | **Deleted** — merged into AdminEditView |
| **AdminEditView** (mobile-only admin panel) | **Now the single admin surface** for both desktop + mobile |

**What changed:**
- `AdminArtisanWidget.tsx` deleted (339 lines). Only consumer was QuickViewContent.
- ArtisanTooltip removed from QuickView (2 instances: "Set ID" for unmatched + pen icon next to artist name). Stays on browse grid ListingCards for quick inline QA.
- New `ArtisanDetailsPanel` component extracts the artisan details display (elite bar, cert counts, candidates, profile link).
- AdminEditView enhanced: auto-opens search for unmatched/UNKNOWN, tracks method/candidates in state (prevents stale data after reassignment), metadata fields collapsed by default.
- Shared `ArtisanCandidate` type extracted to `src/types/artisan.ts`.

**Key files changed:** `AdminEditView.tsx`, `QuickViewContent.tsx`, `ArtisanTooltip.tsx`, `src/types/artisan.ts`
**New files:** `src/components/admin/ArtisanDetailsPanel.tsx`, `tests/components/admin/AdminEditView.test.tsx`, `tests/components/admin/ArtisanDetailsPanel.test.tsx`
**Tests:** 31 new tests (17 ArtisanDetailsPanel, 8 AdminEditView integration, 6 QuickViewContent regression)

---

## Overview

The artisan tooltip feature allows admins to click on artisan ID badges (e.g., "MAS590", "OWA009") on **browse grid listing cards** to view detailed artisan information from the Yuhinkai database. Admins can then verify if the match is correct or incorrect, which is saved to the database for QA tracking.

In **QuickView**, artisan management (search, verify, reassign, details) is handled by **AdminEditView** (accessed via the pen icon in the action bar). See `docs/HANDOFF_ADMIN_FIELD_EDITING.md` for AdminEditView documentation.

---

## How It Works

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARTISAN MATCHING FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. MATCHING (runs in Oshi-scrapper)                                   │
│     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
│     │   Listing    │ ───► │   Artisan    │ ───► │  Yuhinkai    │      │
│     │   (smith,    │      │   Matcher    │      │   Database   │      │
│     │   school)    │      │   Module     │      │ (smith_      │      │
│     └──────────────┘      └──────────────┘      │  entities)   │      │
│                                  │              └──────────────┘      │
│                                  ▼                                     │
│     ┌──────────────────────────────────────────────────────────┐      │
│     │  Stores in nihontowatch.listings:                        │      │
│     │  - artisan_id (e.g., "MAS590")                          │      │
│     │  - artisan_confidence (HIGH/MEDIUM/LOW)                  │      │
│     │  - artisan_method (exact_kanji, consensus_unanimous)     │      │
│     │  - artisan_candidates (top 3 alternatives)               │      │
│     └──────────────────────────────────────────────────────────┘      │
│                                                                         │
│  2. DISPLAY (nihontowatch frontend)                                    │
│     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
│     │  ListingCard │ ───► │   Artisan    │ ───► │  Badge with  │      │
│     │  (browse     │      │   Tooltip    │      │  confidence  │      │
│     │   page)      │      │  Component   │      │  color       │      │
│     └──────────────┘      └──────────────┘      └──────────────┘      │
│                                                                         │
│  3. VERIFICATION (admin QA)                                            │
│     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
│     │  Admin       │      │  /api/       │      │  Saves to    │      │
│     │  clicks      │ ───► │  artisan/    │ ───► │  Yuhinkai    │      │
│     │  badge       │      │  [code]      │      │  database    │      │
│     └──────────────┘      └──────────────┘      └──────────────┘      │
│            │                                                            │
│            ▼                                                            │
│     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
│     │  Tooltip     │      │  /api/       │      │  Saves to    │      │
│     │  shows       │ ───► │  listing/    │ ───► │ nihontowatch │      │
│     │  details +   │      │  [id]/       │      │  .listings   │      │
│     │  verify btns │      │  verify-     │      │ (verified,   │      │
│     └──────────────┘      │  artisan     │      │  verified_at,│      │
│                           └──────────────┘      │  verified_by)│      │
│                                                  └──────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Confidence Levels

| Level | Color | Badge Class | Meaning |
|-------|-------|-------------|---------|
| HIGH | Green | `text-artisan-high` | Exact kanji match or LLM consensus (unanimous) |
| MEDIUM | Yellow | `text-artisan-medium` | Romaji match or school fallback |
| LOW | Gray | `text-artisan-low` | LLM disagreement or weak match |

---

## Database Schema

### nihontowatch.listings (verification columns)

```sql
-- Added by migration 049_artisan_verification.sql
artisan_verified TEXT          -- 'correct', 'incorrect', or NULL
artisan_verified_at TIMESTAMPTZ
artisan_verified_by TEXT       -- Admin user ID

-- Index for filtering verified/unverified listings
CREATE INDEX idx_listings_artisan_verified ON listings(artisan_verified)
  WHERE artisan_verified IS NOT NULL;
```

### Yuhinkai (oshi-v2) artisan_makers

The tooltip fetches details from the Yuhinkai database via `getArtisan()`:

```sql
maker_id         -- Artisan code (e.g., "MAS590", "OWA009")
name_kanji       -- Japanese name (e.g., "正宗")
name_romaji      -- Romanized name (e.g., "Masamune")
legacy_school_text -- School affiliation (e.g., "Soshu")
province         -- Province (e.g., "Sagami")
era              -- Era (e.g., "Kamakura")
period           -- Specific period
domain           -- 'sword' | 'tosogu' | 'both'
juyo_count       -- Number of Juyo works
tokuju_count     -- Number of Tokubetsu Juyo works
total_items      -- Total items in registry
elite_count      -- Number of elite works (Kokuho + Gyobutsu + JuBun + Tokuju)
elite_factor     -- Bayesian elite factor: (elite_count + 1) / (total_items + 10)
```

For school codes (NS-*), queries `artisan_schools` instead.

---

## API Endpoints

### GET /api/artisan/[code]

Fetches artisan details from Yuhinkai database.

**Request:**
```
GET /api/artisan/MAS590
```

**Response:**
```json
{
  "artisan": {
    "code": "MAS590",
    "name_romaji": "Masamune",
    "name_kanji": "正宗",
    "school": "Soshu",
    "province": "Sagami",
    "era": "Kamakura",
    "period": "late Kamakura",
    "juyo_count": 127,
    "tokuju_count": 24,
    "total_items": 185,
    "elite_count": 26,
    "elite_factor": 0.1385,
    "is_school_code": false
  }
}
```

**Caching:** 1 hour at edge (`s-maxage=3600, stale-while-revalidate=86400`)

**Error States:**
- `404` - Artisan not found in Yuhinkai database
- `404` - Yuhinkai database not configured (missing env vars)
- `400` - Invalid code (< 2 characters)

### POST /api/listing/[id]/verify-artisan

Saves verification status for admin QA.

**Request:**
```json
{
  "verified": "correct"  // or "incorrect" or null (to reset)
}
```

**Response:**
```json
{
  "success": true,
  "listing": {
    "id": 1099,
    "artisan_id": "HAN5",
    "artisan_verified": "correct",
    "artisan_verified_at": "2026-02-07T10:30:00Z",
    "artisan_verified_by": "user_abc123"
  }
}
```

**Auth:** Admin only (verified via Supabase auth)

---

## Components

### ArtisanTooltip (`src/components/artisan/ArtisanTooltip.tsx`)

Portal-based tooltip that follows the GlossaryTerm pattern.

**Props:**
```typescript
interface ArtisanTooltipProps {
  listingId: number;          // For verification API call
  artisanId: string;          // The artisan code (e.g., "MAS590")
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  method?: string;            // How match was made
  candidates?: Array<{ code: string; score: number; name?: string }>;
  verified?: 'correct' | 'incorrect' | null;
  onVerify?: (status: 'correct' | 'incorrect' | null) => void;
  children: React.ReactNode;  // The badge element
}
```

**Features:**
- Click to open (not hover)
- Portal-based rendering (avoids z-index issues)
- Viewport-aware positioning (above or below badge)
- Close on: click outside, Escape key, scroll
- Verification buttons with toggle behavior

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  MAS590                    [HIGH ●]     │  ← Header
├─────────────────────────────────────────┤
│  正宗  Masamune                         │  ← Name
│  School:   Soshu                        │
│  Province: Sagami                       │
│  Era:      Kamakura                     │
├─────────────────────────────────────────┤
│  ELITE FACTOR                   13.8%   │  ← Elite Factor
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░  │     (gold progress bar)
│  26 elite works / 185 total             │
├─────────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐                 │  ← Stats
│  │127 │  │ 24 │  │185 │                 │
│  │Juyo│  │Toku│  │Tot │                 │
│  └────┘  └────┘  └────┘                 │
├─────────────────────────────────────────┤
│  Match: exact_kanji                     │  ← Method
│  Candidates: MAS591, MAS012             │  ← Alternatives
├─────────────────────────────────────────┤
│  [✓ Correct]         [✗ Incorrect]      │  ← Verification
└─────────────────────────────────────────┘
```

### ListingCard Integration

The artisan badge in `ListingCard.tsx` is wrapped with the tooltip:

```tsx
<ArtisanTooltip
  listingId={listing.id}
  artisanId={listing.artisan_id}
  confidence={listing.artisan_confidence}
  method={listing.artisan_method}
  candidates={listing.artisan_candidates}
  verified={listing.artisan_verified}
>
  <span
    className={`text-[9px] ... ${confidenceClass}`}
    data-artisan-tooltip
  >
    {listing.artisan_id}
  </span>
</ArtisanTooltip>
```

**Click Propagation:** The badge uses `data-artisan-tooltip` attribute and `e.stopPropagation()` to prevent QuickView from opening when clicking the badge.

---

## Environment Variables

The artisan API needs access to the Yuhinkai (oshi-v2) Supabase database:

```bash
# Option 1: YUHINKAI_* naming
YUHINKAI_SUPABASE_URL=https://xxx.supabase.co
YUHINKAI_SUPABASE_KEY=xxx

# Option 2: OSHI_V2_* naming (legacy, also supported)
OSHI_V2_SUPABASE_URL=https://xxx.supabase.co
OSHI_V2_SUPABASE_ANON_KEY=xxx
```

The code supports both naming conventions for backwards compatibility.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/artisan/ArtisanTooltip.tsx` | Tooltip on browse grid ListingCards (verify, search, cert editing) |
| `src/components/admin/ArtisanDetailsPanel.tsx` | Artisan details display (elite bar, cert counts, candidates, profile link) |
| `src/components/listing/AdminEditView.tsx` | Unified admin panel (cert + artisan + fields + status + hide) |
| `src/components/admin/ArtisanSearchPanel.tsx` | Shared search panel (used by ArtisanTooltip + AdminEditView) |
| `src/app/api/artisan/[code]/route.ts` | Fetches artisan details from Yuhinkai |
| `src/app/api/listing/[id]/verify-artisan/route.ts` | Saves verification status |
| `src/lib/supabase/yuhinkai.ts` | Supabase client for Yuhinkai database |
| `src/components/browse/ListingCard.tsx` | Badge display and tooltip integration |
| `src/app/api/browse/route.ts` | Includes artisan fields in listing response |
| `src/types/artisan.ts` | Shared `ArtisanCandidate` type |
| `supabase/migrations/049_artisan_verification.sql` | Verification columns |
| `src/app/globals.css` | CSS variables for confidence colors |

---

## Testing

### Manual Testing

1. Log in as admin
2. Go to `/browse`
3. Find a listing with an artisan badge (colored code like "MAS590")
4. Click the badge - tooltip should open
5. Verify "Correct" and "Incorrect" buttons work
6. Click the same button again to reset
7. Confirm QuickView does NOT open when clicking the badge

### Database Verification

```sql
-- Check verified artisans
SELECT id, artisan_id, artisan_verified, artisan_verified_at
FROM listings
WHERE artisan_verified IS NOT NULL
ORDER BY artisan_verified_at DESC;
```

### Playwright Test

Located at `/tmp/test-artisan.spec.ts`:

```typescript
test('artisan tooltip opens on click', async ({ page }) => {
  await page.goto('http://localhost:3000/browse');
  const artisanBadge = page.locator('[data-artisan-tooltip]').first();
  await artisanBadge.click();
  const tooltip = page.locator('text=Correct');
  expect(await tooltip.isVisible()).toBe(true);
});
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Artisan not in Yuhinkai | Shows available data from listings table only |
| School codes (NS-*) | Shows "School Entry" indicator |
| Yuhinkai DB not configured | Returns 404 with message |
| Already verified | Shows filled button for current status |
| Click verified button again | Resets to unverified (null) |
| Loading state | Shows spinner while fetching |
| Error state | Shows "Could not load details" |

---

## Admin Artisan Correction

When an admin marks a match as "Incorrect", they can search for the correct artisan and fix the record.

### Correction Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADMIN CORRECTION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Admin clicks "Incorrect" button                                    │
│     └── Search box appears below verification buttons                   │
│                                                                         │
│  2. Admin types name/code/school                                       │
│     └── Debounced search (300ms) queries /api/artisan/search           │
│                                                                         │
│  3. Results displayed (sorted by Juyo/Tokuju count)                    │
│     └── Shows: code, name (kanji/romaji), school, province, stats      │
│                                                                         │
│  4. Admin clicks correct artisan                                       │
│     └── POST /api/listing/[id]/fix-artisan                             │
│                                                                         │
│  5. Two database writes:                                                │
│     a) Updates listings table (artisan_id, method=ADMIN_CORRECTION)    │
│     b) Inserts to artisan_corrections table (for pipeline re-apply)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Corrections Table Schema

```sql
-- Created by migration 051_artisan_corrections.sql
CREATE TABLE artisan_corrections (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id),
    corrected_artisan_id TEXT NOT NULL,     -- The correct code
    original_artisan_id TEXT,               -- What pipeline matched (NULL if none)
    corrected_by TEXT NOT NULL,             -- Admin user ID
    corrected_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,                             -- Optional context
    UNIQUE(listing_id)                      -- One correction per listing
);
```

### API Endpoints

#### GET /api/artisan/search

Searches Yuhinkai database for smiths and tosogu makers.

**Request:**
```
GET /api/artisan/search?q=masamune&type=all&limit=10
```

**Response:**
```json
{
  "results": [
    {
      "code": "MAS590",
      "type": "smith",
      "name_romaji": "Masamune",
      "name_kanji": "正宗",
      "school": "Soshu",
      "province": "Sagami",
      "era": "Kamakura",
      "juyo_count": 127,
      "tokuju_count": 24
    }
  ],
  "query": "masamune",
  "total": 1
}
```

#### POST /api/listing/[id]/fix-artisan

Updates the artisan on a listing after admin correction.

**Request:**
```json
{
  "artisan_id": "MAS590",
  "confidence": "HIGH",
  "notes": "Original match was for wrong Masamune generation"
}
```

**Response:**
```json
{
  "success": true,
  "listingId": 1099,
  "previousArtisanId": "MAS123",
  "artisanId": "MAS590",
  "confidence": "HIGH"
}
```

### Re-Applying Corrections After Pipeline Re-Run

The `artisan_corrections` table stores corrections separately from the listings table. After Oshi-scrapper runs artisan matching, it should re-apply corrections:

**Python (Oshi-scrapper) - Suggested Implementation:**

```python
async def reapply_artisan_corrections(supabase_client):
    """
    Re-apply admin corrections after artisan matching pipeline run.
    Call this AFTER the matching pipeline completes.
    """
    # Get all corrections
    result = await supabase_client.table('artisan_corrections').select('*').execute()
    corrections = result.data

    for correction in corrections:
        # Update the listing with the corrected artisan_id
        await supabase_client.table('listings').update({
            'artisan_id': correction['corrected_artisan_id'],
            'artisan_confidence': 'HIGH',
            'artisan_method': 'ADMIN_CORRECTION',
            'artisan_verified': 'correct',
            'artisan_verified_at': correction['corrected_at'],
            'artisan_verified_by': correction['corrected_by'],
        }).eq('id', correction['listing_id']).execute()

    return len(corrections)
```

**Alternative: Skip Corrected Listings During Matching:**

```python
# In artisan_matcher pipeline, skip listings that have corrections
corrected_listings = await supabase.table('artisan_corrections').select('listing_id').execute()
corrected_ids = {c['listing_id'] for c in corrected_listings.data}

for listing in listings_to_match:
    if listing['id'] in corrected_ids:
        continue  # Skip - has admin correction
    # ... run matching logic
```

### Key Files

| File | Purpose |
|------|---------|
| `src/components/listing/AdminEditView.tsx` | Primary admin correction surface (QuickView) |
| `src/components/artisan/ArtisanTooltip.tsx` | Tooltip with search UI for correction (browse grid only) |
| `src/components/admin/ArtisanSearchPanel.tsx` | Shared search panel (used by both surfaces) |
| `src/app/api/artisan/search/route.ts` | Search endpoint for Yuhinkai database |
| `src/app/api/listing/[id]/fix-artisan/route.ts` | Applies correction to listing |
| `supabase/migrations/051_artisan_corrections.sql` | Corrections table schema |

---

## Related Documentation

- [SYNC_ELITE_FACTOR_API.md](./SYNC_ELITE_FACTOR_API.md) - Webhook API for syncing elite_factor from Yuhinkai
- [YUHINKAI_REGISTRY_VISION.md](./YUHINKAI_REGISTRY_VISION.md) - Strategic vision for Yuhinkai as canonical registry
- [YUHINKAI_ENRICHMENT.md](./YUHINKAI_ENRICHMENT.md) - Setsumei enrichment feature
- Oshi-scrapper `artisan_matcher/` - Artisan matching module
