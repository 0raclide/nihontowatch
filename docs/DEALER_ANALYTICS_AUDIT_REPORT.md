# Dealer Analytics Audit Report

**Date:** 2026-03-11
**Scope:** End-to-end audit of dealer analytics infrastructure against SOTA marketplace platforms

---

## Executive Summary

NihontoWatch's dealer analytics infrastructure is architecturally sound and **more sophisticated than most niche marketplace seller dashboards** — viewport-aware impressions, dwell tracking, position metadata, and CPM-based traffic valuation are enterprise-grade features. However, three categories of issues are causing the dashboard to show misleading data:

1. **Data completeness bug** — "Active Dealers" count filters out dealers without current inventory
2. **Impression pipeline age** — only 5 days old + admin suppression = near-zero data
3. **Potential FK constraint failure** — `dealer_id: 0` fallback violates foreign key on `listing_impressions`

Below is a full breakdown of each metric, verification status, identified bugs, and comparison to SOTA platforms.

---

## Part 1: Bug Analysis — What's Broken

### BUG #1: "33 Dealers" — Missing 19 Active Dealers

**Severity:** Medium (display-only, no data loss)
**Root cause:** `src/app/api/admin/dealers/analytics/route.ts:414`

```typescript
const dealersWithListings = dealerStatsArray.filter(d => d.activeListings > 0).length;
// ...
totalDealers: dealersWithListings,  // line 419
```

The "Active Dealers" summary card shows only dealers with `is_available = true` listings RIGHT NOW. Dealers with zero current inventory are excluded from the count, even though they may have significant historical traffic data.

**The dealer TABLE still shows all 52 active dealers** — the issue is only the summary card.

**Fix:** Show total active dealers (from the dealers table) alongside a second metric for "dealers with inventory."

---

### BUG #2: All Impressions at 0

**Severity:** High
**Multiple contributing causes:**

#### Cause A: Impression tracking is only 5 days old
The impression pipeline was connected on 2026-03-06 (migration 107 + fan-out wiring). The dashboard defaults to 30-day view. Only the last 5 days can possibly have impression data.

#### Cause B: Admin tracking suppressed
`ActivityTracker.tsx:239`:
```typescript
const isSuppressed = isOptedOut || isAdmin;
```
All events (impressions, clicks, views, dwell) are suppressed for admin users. When you (admin) browse the site, zero events are generated.

#### Cause C: Possible FK violation on `dealer_id = 0`
`ActivityTracker.tsx:603` defaults `dealerId` to 0 when not provided:
```typescript
dealerId: extra?.dealerId ?? 0,
```
`activity/route.ts:373` also defaults to 0:
```typescript
dealer_id: data.dealerId || 0,
```

The `listing_impressions` table has `dealer_id INTEGER NOT NULL REFERENCES dealers(id)` (migration 028). If any listing has a null `dealer_id`, the insert fails with a FK violation (error 23503).

**However**, `ListingCard.tsx:480-482` DOES pass dealerId correctly:
```typescript
viewportTracking.trackElement(element, Number(listing.id), {
  position: gridPosition,
  dealerId: listing.dealer_id ?? undefined,
});
```

So for listings with a valid `dealer_id` (the vast majority), impressions should succeed. The FK violation only affects listings where `dealer_id` is null — which should be rare in production.

#### Cause D: Migration 108 may not be applied
The RPC function `get_dealer_impression_stats` (migration 108) must be applied for the dashboard to read impression data. If this migration hasn't been applied to production, the RPC call fails silently and impressions default to 0.

**Verification needed:** Run these queries in the DB:
```sql
-- Check if any impressions exist
SELECT count(*) FROM listing_impressions;

-- Check if migration 108 RPC exists
SELECT proname FROM pg_proc WHERE proname = 'get_dealer_impression_stats';

-- Check for FK violation errors (if logging is available)
SELECT count(*) FROM listing_impressions WHERE dealer_id = 0;
```

---

### BUG #3: All Clicks at 0

**Severity:** High (but possibly working correctly)
**Root cause analysis:**

The click RPC (`get_dealer_click_stats`, migration 072) queries `activity_events`:
```sql
WHERE ae.event_type IN ('external_link_click', 'dealer_click')
```

Click tracking fires from `BrowseCTA.tsx` and `BrowseMobileCTA.tsx` when a user clicks "View on [Dealer]". The event type is `'dealer_click'`, which matches the RPC filter.

**Critical insight:** Since views (21,545) ARE appearing, the `activity_events` pipeline works. Views come from `listing_views` table (a different fan-out path), but they share the same event ingestion pipeline. If `activity_events` inserts work for `listing_detail_view` events, they should work for `dealer_click` events too.

**Most likely explanation:** Non-admin users genuinely haven't clicked through to dealer sites in the selected period. This is plausible for a niche site in early growth. Clicks require users to:
1. Open a QuickView or listing detail page
2. Click the external "View on [Dealer]" link
3. Not be an admin

The 21,545 views represent passive engagement (opening QuickView). The conversion from view → click-through may simply be zero for non-admin users in this period.

**Verification needed:**
```sql
-- Check if any click events exist in activity_events
SELECT count(*) FROM activity_events WHERE event_type = 'dealer_click';
SELECT count(*) FROM activity_events WHERE event_type = 'external_link_click';

-- Check dealer_clicks fan-out table
SELECT count(*) FROM dealer_clicks;
```

---

### BUG #4: Clicks/Listing All at 0

**Derived from BUG #3** — if total clicks = 0, clicks/listing = 0/N = 0 for all dealers.

---

## Part 2: Impressions vs Views — What's the Difference?

| Metric | Trigger | What It Means | Table |
|--------|---------|---------------|-------|
| **Impression** | Listing card appears in viewport (≥50% visible) | Passive visibility — listing was scrolled past | `listing_impressions` |
| **View** | User opens QuickView OR listing detail page | Active engagement — user chose to look at this item | `listing_views` |
| **Click** | User clicks "View on [Dealer]" external link | Purchase intent — user left NihontoWatch for dealer site | `dealer_clicks` + `activity_events` |

**Impression → View** = Click-Through Rate (CTR). Expected: 3-8% for a niche marketplace.
**View → Click** = Conversion Rate. Expected: 1-5% for an aggregator.

---

## Part 3: Admin Tracking Suppression — Design Decision

The `isSuppressed = isOptedOut || isAdmin` check is **intentionally correct** for production analytics. Admin browsing activity should NOT inflate dealer metrics — it would give dealers a false picture of their traffic.

**However**, this creates a testing blind spot. You cannot verify tracking works by browsing the site as admin.

**Recommendation:** Add an admin toggle: "Include admin activity (testing only)" that sets a localStorage flag. The ActivityTracker checks this flag and temporarily unsuppresses. The dashboard then shows a warning: "Includes admin test traffic."

---

## Part 4: SOTA Comparison

### What NihontoWatch Already Has (Strong Foundation)

| Capability | NW Status | Comparable Platforms |
|-----------|-----------|---------------------|
| Viewport-aware impressions (position metadata) | **Implemented** | GA4 only (no marketplace does this) |
| Click-through tracking with unique visitors | **Implemented** | Etsy, eBay, 1stDibs, Chrono24 |
| Dwell time per listing | **Implemented** | GA4 only (no seller dashboard exposes this) |
| Favorites per dealer | **Implemented** | Etsy (Favorites), eBay (Watchers) |
| CTR calculation (clicks/impressions) | **Implemented** (needs impression data) | Etsy Ads, eBay Promoted Listings |
| Percentile ranking | **Implemented** | Chrono24 badges (3-level) |
| Period-over-period trend | **Implemented** | Standard across all platforms |
| Inventory analytics (count, value, avg price) | **Implemented** | eBay Seller Hub, Chrono24 |
| Traffic value estimate (CPM) | **Implemented** | Unique to NW (innovative) |
| PDF export (individual dealer) | **Implemented** | Enterprise tools only |
| CSV export | **Implemented** | Etsy, eBay |
| Event batching with sendBeacon | **Implemented** | GA4 pattern |
| Dedup (unique per listing/session/day) | **Implemented** | Standard best practice |

### What's Missing vs SOTA

#### P0 — Must Have for Dealer Self-Serve Launch

| Gap | Description | SOTA Reference |
|-----|-------------|----------------|
| **Dealer self-serve portal** | Dealers cannot see their own data. This is the #1 blocker. | Every platform (Etsy, eBay, Artsy, Chrono24) |
| **Conversion funnel visualization** | Impressions → Views → Engagement → Clicks displayed as a funnel per dealer | Etsy (Visit → Favorite → Purchase), Artsy (View → Save → Inquiry) |
| **Response time equivalent** | Listing freshness / stale inventory rate — proxy for "responsiveness" | Chrono24 (3-level badge), Artsy (response time ranking) |

#### P1 — High Impact, Near-Term

| Gap | Description | SOTA Reference |
|-----|-------------|----------------|
| **Per-listing performance** | Break down metrics per listing, not just per dealer | Etsy (per-listing stats), eBay (per-listing analytics) |
| **Badge/tier system** | Tiered performance badges displayed on dealer pages | Chrono24 (4 categories × 3 levels, 90-day rolling) |
| **Demand intelligence** | "47 collectors tracking Juyo swords" — data dealers can't get elsewhere | Artsy (artist demand alerts), eBay (Terapeak demand data) |
| **Search term analytics** | Which search queries drive traffic to each dealer's listings | Etsy (search term attribution) |
| **Traffic source breakdown** | Direct vs search vs browse vs alert vs external | Etsy (5+ source categories), GA4 |

#### P2 — Differentiators

| Gap | Description | SOTA Reference |
|-----|-------------|----------------|
| **Geographic analytics** | Where collectors are (JA vs EN locale as proxy) | Artsy (global geographic reach), 1stDibs |
| **Collector intent scoring** | Multi-signal score per user-listing pair (see framework below) | HubSpot (Fit + Engagement model), Salesforce (Einstein) |
| **Anomaly detection** | Alert when listing gets unusual attention | GA4 (AI-powered anomaly detection) |
| **Cohort analysis** | How new vs returning collectors engage over time | GA4 (cohort exploration) |

#### P3 — Future / Advanced

| Gap | Description | SOTA Reference |
|-----|-------------|----------------|
| **Market intelligence** | Price index by category/cert/era over time | Chrono24 (ChronoPulse market index) |
| **Competitive benchmarking** | How dealer pricing compares to similar items | eBay (Terapeak), Chrono24 (ChronoPulse) |
| **Mobile dealer app** | Native app for dealers to check analytics | Chrono24 (Dealer app), Etsy (Seller app) |

---

## Part 5: Metrics Reliability Assessment

### Metric-by-Metric Verification

| Metric | Pipeline | Reliability | Known Issues |
|--------|----------|-------------|--------------|
| **Listing Views** | `listing_detail_view` + `quickview_open` → `listing_views` → `get_dealer_listing_views` RPC | **HIGH** — 21,545 views confirmed working | Uses `viewed_at` not `created_at` (documented, correct) |
| **Click-Throughs** | `dealer_click` → `activity_events` → `get_dealer_click_stats` RPC | **MEDIUM** — pipeline correct, data may be genuinely 0 | Reads from `activity_events` not `dealer_clicks` table; dealerByName fallback if dealer_id is null in event_data |
| **Impressions** | `listing_impression` → `listing_impressions` → `get_dealer_impression_stats` RPC | **LOW** — only 5 days of data; possible RPC/migration issue | New pipeline (2026-03-06), admin suppressed, needs DB verification |
| **CTR** | Derived: `clicks / impressions` | **LOW** — depends on both clicks and impressions working | Shows 0 when impressions = 0 (division guard) |
| **Favorites** | `user_favorites` JOIN `listings` → `get_dealer_favorite_stats` RPC | **HIGH** — simple JOIN, no pipeline dependency | Favorites can reference sold items (minor) |
| **Dwell Time** | `viewport_dwell` → `activity_events` → `get_dealer_dwell_stats` RPC | **HIGH** — fixed in migration 076 (corrected JSONB keys + JOIN path) | Migration 072 had broken version (overridden by 076) |
| **Active Listings** | Direct query `listings WHERE is_available = true` | **HIGH** — simple count query | Capped at 100,000 rows (line 164) |
| **Total Value** | Sum of `price_jpy` from active listings | **HIGH** — simple aggregation | NULL prices excluded (no price = no value contribution) |
| **Percentile Rank** | Computed in JS from sorted click array | **HIGH** — pure computation | Only meaningful when clicks > 0 |
| **Click Trend** | `get_dealer_click_stats_prev` (previous period) vs current | **MEDIUM** — correct when data exists | Shows 0% or 100% when baseline is 0 |

### Silent Failure Patterns

| Pattern | Impact | Location |
|---------|--------|----------|
| FK violation on `dealer_id = 0` | Impressions for listings without dealer_id silently dropped | `activity/route.ts:373` |
| RPC returns empty on failure | Metric defaults to 0, no error shown to user | `analytics/route.ts:192-197` (logged server-side only) |
| `count ?? 0` fallback | Any PostgREST error results in metric showing 0 | Inherited pattern from featured score system |
| ON DELETE CASCADE | Historical impressions wiped when listings deleted | `listing_impressions.listing_id FK` |
| dealerByName exact match | Click events with mismatched dealer name silently skipped | `analytics/route.ts:255-256` |

---

## Part 6: Proposed Collector Intent Score Framework

Adapted from HubSpot's dual-axis (Fit + Engagement) model and Salesforce's Einstein behavioral scoring, tailored for a niche luxury aggregator:

### Per User-Listing Pair Score

| Signal | Points | Weight Rationale |
|--------|--------|------------------|
| Listing view (>3s dwell) | +1 | Base awareness signal |
| Extended dwell (>30s) | +3 | Serious examination |
| Image pinch/zoom | +5 | Examining condition — high intent |
| Favorite/save | +8 | Explicit interest declaration |
| Repeated view (2nd session) | +10 | Return interest |
| Repeated view (3rd+ session) | +15 | Very strong buying intent |
| Setsumei translation viewed | +5 | Research-level engagement |
| AI inquiry email generated | +20 | Direct purchase intent |
| Click-through to dealer | +25 | Highest measurable intent |
| Share (LINE/X) | +3 | Seeking external opinion |
| Price alert set | +12 | Price-sensitive but committed |

### Aggregate Dealer Lead Score

Sum intent scores across ALL visitors to a dealer's listings = **Lead Pipeline Score**. This is the single number that justifies the $150/mo dealer fee — it quantifies the buying intent flowing through their inventory on the platform.

| Score Range | Tier | Label |
|-------------|------|-------|
| 0-5 | Cold | Browsers |
| 6-15 | Warm | Interested collectors |
| 16-30 | Hot | Serious buyers |
| 31+ | Very Hot | Ready to purchase |

---

## Part 7: Standard Marketplace Engagement Funnel

```
IMPRESSION (listing card visible in viewport)
    │
    │  Expected CTR: 3-8% (niche luxury)
    ▼
VIEW (QuickView opened or detail page visited)
    │
    │  Engagement rate: 5-15%
    ▼
ENGAGEMENT (favorite, dwell >30s, image zoom, share)
    │
    │  Conversion rate: 1-5%
    ▼
CLICK-THROUGH (user leaves to dealer site)
    │
    │  [Off-platform — not trackable]
    ▼
INQUIRY/PURCHASE (happens on dealer's website)
```

NihontoWatch's funnel terminates at click-through because it's an aggregator, not a transactional marketplace. This is the correct model — comparable to how Artsy's gallery analytics track through inquiry but not through final sale.

**NihontoWatch's unique advantage:** Impression and dwell data at the listing level. No other nihonto platform aggregates this. This is genuinely valuable intelligence that dealers cannot get from their own website analytics.

---

## Part 8: Immediate Action Items

### Verify (DB queries needed)

```sql
-- 1. Do any impressions exist?
SELECT count(*), min(created_at), max(created_at)
FROM listing_impressions;

-- 2. Is the impression RPC deployed?
SELECT proname FROM pg_proc
WHERE proname = 'get_dealer_impression_stats';

-- 3. Are click events reaching activity_events?
SELECT event_type, count(*)
FROM activity_events
WHERE event_type IN ('dealer_click', 'external_link_click')
GROUP BY event_type;

-- 4. What's in dealer_clicks?
SELECT count(*) FROM dealer_clicks;

-- 5. Check for FK violations (dealer_id = 0)
SELECT count(*)
FROM activity_events
WHERE event_type = 'listing_impression'
  AND (event_data->>'dealerId')::int = 0;
```

### Fix (code changes)

1. **Dashboard "Active Dealers" count** — Show `dealers.length` (all active) instead of filtering by inventory
2. **FK safety on impressions** — In `fanOutListingImpressions`, skip insert when `dealer_id` is 0 or null (instead of inserting invalid FK)
3. **Admin test mode** — Add localStorage toggle to temporarily unsuppress admin tracking for verification
4. **Impression migration check** — Verify migration 108 is applied in production

### Enhance (future work)

1. Dealer self-serve portal (P0 for B2B launch)
2. Conversion funnel visualization per dealer
3. Per-listing performance breakdown
4. Chrono24-style badge system
5. Demand intelligence ("what collectors are searching for")

---

## Appendix A: Architecture Diagram

```
Client (Browser)
    │
    ├── ListingCard visible → useViewportTracking → impression event
    ├── QuickView opened → trackQuickViewOpen → listing_detail_view event
    ├── "View on Dealer" clicked → trackDealerClick → dealer_click event
    ├── Viewport dwell tracked → trackViewportDwell → viewport_dwell event
    └── Favorite toggled → trackFavoriteAction → favorite_add event
    │
    ▼  (batched every 30s or on page hide)
ActivityTracker.queueEvent() ──[isSuppressed? skip]──▶ eventQueue
    │
    ▼  (flush)
POST /api/activity
    │
    ├── Insert ALL events → activity_events table
    │
    └── Fan-out (Promise.allSettled, best-effort):
        ├── dealer_click → dealer_clicks table
        ├── listing_detail_view + quickview_open → listing_views table
        ├── listing_impression → listing_impressions table
        ├── search → user_searches table
        └── search_click → user_searches.clicked_listing_id UPDATE
    │
    ▼  (analytics dashboard reads)
GET /api/admin/dealers/analytics
    │
    ├── get_dealer_click_stats (RPC) ← activity_events
    ├── get_dealer_listing_views (RPC) ← listing_views JOIN listings
    ├── get_dealer_impression_stats (RPC) ← listing_impressions
    ├── get_dealer_dwell_stats (RPC) ← activity_events JOIN listings
    ├── get_dealer_favorite_stats (RPC) ← user_favorites JOIN listings
    └── Direct query: listings WHERE is_available = true
```

## Appendix B: Key File Index

| Component | File | Critical Lines |
|-----------|------|---------------|
| Analytics API | `src/app/api/admin/dealers/analytics/route.ts` | 414 (dealer count filter), 357 (CTR calc) |
| Activity fan-out | `src/app/api/activity/route.ts` | 373 (dealer_id fallback to 0), 177-183 (Promise.allSettled) |
| ActivityTracker | `src/lib/tracking/ActivityTracker.tsx` | 239 (admin suppression), 603 (dealerId ?? 0) |
| ListingCard tracking | `src/components/browse/ListingCard.tsx` | 480-483 (trackElement with dealerId) |
| ViewportTrackingProvider | `src/lib/viewport/ViewportTrackingProvider.tsx` | 86-89 (impression forwarding) |
| Dashboard UI | `src/app/admin/dealers/page.tsx` | Full page |
| Click stats RPC | `supabase/migrations/072_dealer_analytics_rpc.sql` | get_dealer_click_stats |
| Dwell stats RPC (FIXED) | `supabase/migrations/076_fix_dealer_dwell_and_views_v2.sql` | Correct JSONB keys |
| Impression dedup | `supabase/migrations/107_listing_impression_dedup.sql` | Unique constraint |
| Impression stats RPC | `supabase/migrations/108_dealer_impression_stats.sql` | get_dealer_impression_stats |
| Schema (tables + FK) | `supabase/migrations/028_dealer_analytics.sql` | listing_impressions FK |

## Appendix C: SOTA Platform Comparison Sources

- **Etsy**: Seller Dashboard (visits, views, favorites, conversion, traffic sources, search terms)
- **eBay**: Seller Hub + Terapeak (sell-through rate, peer comparison, 3-year historical data)
- **1stDibs**: Inquiry-first model ($94.7M Q1 2025 GMV), response time affects ranking
- **Artsy**: Gallery Report 2025 (size-tier ranking, response rate benchmarks, demand alerts)
- **Chrono24**: 4-category × 3-level badge system (90-day rolling), ChronoPulse market index
- **GA4**: Event-based model, predictive metrics, AI anomaly detection, cohort analysis
- **HubSpot**: Dual-axis Fit + Engagement lead scoring, behavioral point system
- **Salesforce Einstein**: ML-based predictive scoring (1-99), explainable top factors
