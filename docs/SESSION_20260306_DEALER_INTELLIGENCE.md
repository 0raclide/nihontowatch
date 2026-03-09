# Dealer Per-Listing Intelligence

**Date:** 2026-03-06
**Status:** Deployed to production
**Commit:** `9d6902a`

## What It Does

Gives dealers visibility into how their listings perform and would perform in the public feed. Four intelligence signals per listing, surfaced in two places:

### Card Indicators (at a glance)
A subtle row between attribution and price on each listing card:
- **Completeness dots** — 6 gold/empty dots showing how many criteria are filled
- **Heat dot** — colored circle (Hot/Active/Quiet) based on 30-day engagement
- **Interested count** — bell icon + number of collectors with matching alerts

### QuickView Panel (detailed breakdown)
A new section between description and CTA when a dealer taps a listing:
- **Completeness checklist** — 6 criteria with checkmarks and improvement tips
- **Feed preview** — quality score, freshness multiplier, rank percentile bucket
- **Engagement metrics** — views, favorites, clicks (30-day) with heat label
- **Interested collectors** — count with explanation

---

## Testing Guide

### Prerequisites

1. **Admin account** with `profiles.role = 'admin'` and `profiles.dealer_id` set to a real dealer ID
2. Deployed build at `https://nihontowatch.com` (version `9d6902a` or later)
3. The dealer must have `source = 'dealer'` listings in the database

### Step 1: Verify Deployment

```bash
curl -s https://nihontowatch.com/api/health | python3 -m json.tool
```

Check that `version` matches `9d6902a` (or later) and `status` is `healthy`.

### Step 2: Access Dealer Portal

1. Go to `https://nihontowatch.com/dealer`
2. Sign in with your admin account (must have `dealer_id` set)
3. You should see the dealer portal with tabs: **Inventory | For Sale | On Hold | Sold**

### Step 3: Test Card Indicators

**What to look for on each listing card:**

1. **Completeness dots** — Between the attribution/certification row and the price:
   - 6 tiny dots, gold = filled, outline = unfilled
   - Count text like "4/6" next to dots
   - Should appear instantly (computed client-side)

2. **Heat dot** — Only visible after API data loads (~1s):
   - **Hot** (red dot) — listing has significant engagement
   - **Active** (amber dot) — some engagement
   - **Quiet** (gray dot) — little engagement
   - Only shows for **For Sale** and **Sold** tabs (not Inventory)

3. **Interested count** — Bell icon + number:
   - Shows count of active saved searches matching this listing
   - Hidden when count is 0
   - Loads async with heat data

**Test scenarios:**
- [ ] Switch to **Inventory** tab — heat dot should NOT appear (no engagement data for unlisted items)
- [ ] Switch to **For Sale** tab — heat dot should appear after ~1s
- [ ] Switch to **Sold** tab — heat dot should appear
- [ ] Card with no images — completeness should show < 6/6
- [ ] Card with all fields — completeness should show 6/6

### Step 4: Test QuickView Intelligence Panel

1. Tap any listing card to open QuickView
2. Scroll down past the description — the **Intelligence panel** appears

**Sections to verify:**

#### 4a: Completeness
- [ ] Gold progress bar showing X/6
- [ ] 6-row checklist: Photos, Price, Attribution, Measurements, Description, Certification
- [ ] Filled items show green checkmark
- [ ] Unfilled items show X icon + tip text in muted color
- [ ] Tip text is localized (switch to JA to verify)

#### 4b: Feed Preview
- [ ] Shows Quality score (number), Freshness multiplier (e.g., "x1.2"), and rank pill
- [ ] Rank pill: Top 10% (gold), Top 25% (green), Top 50% (blue), Below average (gray)
- [ ] On **Inventory** tab: shows "Estimated score when listed" label
- [ ] On **For Sale** tab: shows live score

#### 4c: Engagement
- [ ] Shows Views, Favorites, Clicks counts
- [ ] Heat pill with label (Hot/Active/Quiet)
- [ ] On **Inventory** tab: shows "Tracked when listed" instead of metrics
- [ ] On **Sold** tab: section labeled "Performance Summary"

#### 4d: Interested Collectors
- [ ] Shows bell icon + "{N} collectors interested" if count > 0
- [ ] Hidden on **Sold** tab
- [ ] Hidden when count is 0

### Step 5: Test Loading States

1. Open QuickView on any card:
   - [ ] Skeleton loading animation appears briefly (gray pulsing bars)
   - [ ] Replaced by actual data within 1-2 seconds
2. If API fails (e.g., network issue):
   - [ ] Panel gracefully disappears (no error shown)
   - [ ] Card indicators still show completeness (client-computed)

### Step 6: Test Localization

1. Switch to Japanese locale (click language toggle)
2. Verify on card indicators:
   - [ ] Heat labels: 注目 (Hot), 好調 (Active), 静か (Quiet)
3. Open QuickView and verify:
   - [ ] Section headers: 完成度, 表示プレビュー, 反応（30日間）
   - [ ] Tip text in Japanese (e.g., "写真を追加すると注目度が上がります")
   - [ ] Rank buckets: 上位10%, 上位25%, etc.
   - [ ] Interested: "{count}人が注目中"

### Step 7: Verify No Public Leakage

1. Log out or open incognito
2. Go to `https://nihontowatch.com` (public browse)
3. Verify:
   - [ ] No intelligence indicators on any listing cards
   - [ ] QuickView shows no intelligence panel
   - [ ] `/api/dealer/listings/intelligence` returns 401

---

## Architecture

### Data Flow

```
DealerPageClient
  ├─ listings fetch (/api/dealer/listings)
  ├─ client-side: computeListingCompleteness() → inject into DisplayItem.dealer.intelligence
  └─ async fetch: /api/dealer/listings/intelligence?listingIds=...
      ├─ computeQuality() + computeFreshness() (pure functions)
      ├─ get_batch_listing_engagement() (SQL RPC, 30-day window)
      ├─ count_matching_saved_searches() (SQL RPC)
      └─ getScorePercentiles() (cached hourly)
      → merge heatTrend + interestedCollectors into DisplayItems
```

### Files

| File | Purpose |
|------|---------|
| `src/lib/dealer/intelligence.ts` | Types + pure functions: `computeListingCompleteness`, `heatToTrend`, `scoreToRankBucket` |
| `src/components/dealer/DealerCardIndicators.tsx` | Card indicator row (completeness dots, heat, interested) |
| `src/components/listing/quickview-slots/DealerIntelligence.tsx` | QuickView intelligence panel (4 sections) |
| `src/app/api/dealer/listings/intelligence/route.ts` | Batch intelligence API |
| `supabase/migrations/102_dealer_intelligence_rpc.sql` | `get_batch_listing_engagement()` + `count_matching_saved_searches()` RPCs |
| `src/types/displayItem.ts` | `DealerExtension.intelligence` type |
| `src/app/dealer/DealerPageClient.tsx` | Client-side completeness + async API fetch |

### Completeness Criteria (6 items)

| # | Key | Filled when | EN tip | JA tip |
|---|-----|-------------|--------|--------|
| 1 | images | >= 1 image | Add photos for better visibility | 写真を追加すると注目度が上がります |
| 2 | price | price_value > 0 | Add a price or mark as inquiry | 価格または応談を設定してください |
| 3 | attribution | smith or tosogu_maker | Add smith or maker attribution | 刀工名・作者名を追加してください |
| 4 | measurements | nagasa or tosogu dims | Add measurements | 寸法を追加してください |
| 5 | description | > 50 chars | Add a description | 説明文を追加してください |
| 6 | certification | cert_type not null | Add certification if applicable | 鑑定書があれば追加してください |

### Heat Thresholds

| Trend | Heat Score | Meaning |
|-------|-----------|---------|
| Hot | >= 40 | 3+ favorites or active clicks |
| Active (Warm) | >= 10 | Some engagement |
| Quiet (Cool) | < 10 | Little engagement |

### Rank Buckets

Percentile-based from all available listings with `featured_score > 0`:
- **Top 10%** — score >= p10 threshold
- **Top 25%** — score >= p25
- **Top 50%** — score >= p50
- **Below average** — score < p50

Percentiles cached in-memory, refreshed hourly.

---

## Design Decisions

1. **6-item completeness, not 8** — The internal `scoring.ts` uses 8 factors (including era, school, HIGH confidence). Dealers see 6 actionable things they can control.

2. **Client-side completeness, API for the rest** — Completeness renders instantly from listing data already on the page. Heat + interested collectors require DB queries and load async. No loading spinner — indicators just appear.

3. **Single batch API** — One request with all listing IDs. SQL RPCs process arrays, returning per-listing results in one round trip. Capped at 100 IDs.

4. **Percentile buckets, not raw ranks** — "Top 25%" is more meaningful and stable than "#42 of 3,847". Raw numbers fluctuate constantly; buckets are stable.

5. **No price comparisons** — Culturally inappropriate in the nihonto market. Every sword is unique. No pricing suggestions.

---

## Tests

| File | Count | What |
|------|-------|------|
| `tests/lib/dealer/intelligence.test.ts` | 18 | Completeness, heat, rank bucket pure functions |
| `tests/components/dealer/DealerCardIndicators.test.tsx` | 10 | Dots, heat colors, interested count visibility |
| `tests/components/dealer/DealerIntelligence.test.tsx` | 6 | Skeleton, sections, tab variants, API failure |

Run all: `npx vitest run tests/lib/dealer/intelligence.test.ts tests/components/dealer/`
