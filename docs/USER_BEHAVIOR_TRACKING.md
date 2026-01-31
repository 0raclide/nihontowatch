# User Behavior Tracking & Interest Signals

## Overview

This document covers Nihontowatch's user behavior tracking system, the signals we collect, gaps in current implementation, and recommendations for building interest-based recommendations optimized for **time spent in app**.

**Goal:** Track implicit user interest to power personalized recommendations for anonymous and authenticated users.

**North Star Metric:** Time spent using the app (session duration, return visits)

**Last Updated:** January 31, 2026

---

## Table of Contents

1. [Current Implementation](#current-implementation)
2. [Visitor Identification](#visitor-identification)
3. [Signal Inventory](#signal-inventory)
4. [Gaps & Missing Signals](#gaps--missing-signals)
5. [Most Valuable Signals](#most-valuable-signals)
6. [Interest Scoring Model](#interest-scoring-model)
7. [Privacy & Compliance](#privacy--compliance)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Technical Reference](#technical-reference)
10. [Database Schema](#database-schema)
11. [Querying Activity Data](#querying-activity-data)
12. [Admin Dashboard (Plausible-lite)](#admin-dashboard-plausible-lite)

---

## Current Implementation

### Architecture

```
User Actions (browse, search, click, favorite)
        │
        ▼
React Hooks & Context
├── ActivityTrackerProvider (wraps app)
├── useActivityTracker() (manual event tracking)
└── useListingViewTracker() (duration tracking)
        │
        ▼
Event Queue (batched)
├── 30-second flush interval
├── 50-event max batch size
└── sendBeacon on page unload
        │
        ▼
API: /api/activity (POST)
├── Rate limited (30 req/min per session)
├── Validates timestamps (1-min skew allowed)
└── Fails silently for missing tables
        │
        ▼
Supabase Tables
├── activity_events (raw events)
├── user_sessions (session metadata)
└── user_activity (admin dashboard summary)
        │
        ▼
Admin Dashboards
├── /admin/visitors (Plausible-lite - visitor analytics)
├── /admin/analytics (high-level stats)
└── /admin/activity (detailed log + CSV export)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/tracking/ActivityTracker.tsx` | Main provider, auth integration, privacy, all tracking methods |
| `src/lib/activity/sessionManager.ts` | Session lifecycle, visibility handling |
| `src/lib/activity/types.ts` | Event type definitions |
| `src/lib/activity/visitorId.ts` | Persistent visitor ID generation and storage |
| `src/lib/viewport/useViewportTracking.ts` | IntersectionObserver-based dwell tracking |
| `src/lib/viewport/usePinchZoomTracking.ts` | Mobile pinch-to-zoom gesture detection |
| `src/lib/viewport/interestScore.ts` | Interest score calculation from signals |
| `src/lib/viewport/constants.ts` | Tracking thresholds and weights |
| `src/hooks/useActivityTracker.ts` | Standalone tracking hook |
| `src/components/activity/ActivityProvider.tsx` | Auto page-view tracking |
| `src/components/listing/QuickView.tsx` | Panel toggle + pinch zoom integration |
| `src/app/api/activity/route.ts` | Batch event ingestion, IP extraction |
| `src/app/api/activity/session/route.ts` | Session create/end |
| `src/app/api/admin/visitors/route.ts` | Visitor statistics API (Plausible-lite) |
| `src/app/api/admin/visitors/geo/route.ts` | IP geolocation batch lookup |
| `src/app/admin/visitors/page.tsx` | Plausible-lite dashboard UI |

### Currently Tracked Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `page_view` | Route change | path, referrer, searchParams |
| `listing_view` | Listing detail exit | listingId, durationMs, scrollDepth*, imageViews* |
| `search` | Search submit | query, resultCount, filters |
| `filter_change` | Filter toggle | filters, changedFilter, oldValue, newValue |
| `favorite_add/remove` | Favorite action | listingId |
| `alert_create/delete` | Alert action | alertId, alertType, criteria |
| `external_link_click` | "View on dealer" button click in QuickView | url, listingId, dealerName |
| `quickview_open` | User clicks listing card to open QuickView | listingId, dealerName, source |
| `viewport_dwell` | Listing card visible for >1.5s in browse grid | listingId, dwellMs, intersectionRatio, isRevisit |
| `quickview_panel_toggle` | User collapses/expands QuickView panel | listingId, action (collapse/expand), dwellMs |
| `image_pinch_zoom` | User pinch-zooms on mobile | listingId, imageIndex, zoomScale, durationMs |

*Fields defined but not actively populated in UI

### Session Metadata Captured

| Field | Description |
|-------|-------------|
| `session_id` | Unique per browser tab (`sess_[timestamp]_[random]`) |
| `user_id` | From auth context (null for anonymous) |
| `started_at` / `ended_at` | Session boundaries |
| `total_duration_ms` | Calculated on session end |
| `page_views` | Count of page_view events |
| `user_agent` | Browser/device info |
| `screen_width/height` | Viewport dimensions |
| `timezone` | User's timezone |
| `language` | Browser language |

---

## Visitor Identification

### Overview

Anonymous visitor tracking uses a **localStorage-based visitor ID** combined with **server-side IP capture**. This approach was chosen over cookies because:

1. **No consent banner required** - localStorage analytics typically fall outside GDPR cookie consent requirements
2. **Simpler implementation** - No cookie management or expiration handling
3. **Privacy-friendly** - Data not sent with every request, only when explicitly tracked
4. **IP captured server-side** - Provides secondary identifier without client-side complexity

### How It Works

```
User visits site
       │
       ▼
Check localStorage for visitor_id
       │
       ├─ Found → Use existing ID
       │
       └─ Not found → Generate new ID (vis_[timestamp]_[random])
                      Store in localStorage
       │
       ▼
Include visitor_id in all activity events
       │
       ▼
API extracts IP from request headers
       │
       ▼
Both stored in activity_events table
```

### Visitor ID Format

```
vis_mkjoszll_38b3b28886aa
│   │        │
│   │        └─ 12 random characters (crypto.randomUUID or Math.random)
│   └─ Base36 timestamp
└─ Prefix
```

### IP Address Extraction

The API route extracts client IP from headers in this priority order:

1. `x-forwarded-for` (first IP in comma-separated list)
2. `x-real-ip`
3. `x-vercel-forwarded-for` (Vercel-specific)

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/activity/visitorId.ts` | Visitor ID generation and persistence |
| `src/app/api/activity/route.ts` | IP extraction, stores both in DB |

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `nihontowatch_visitor_id` | Persistent visitor identifier |
| `nihontowatch_visitor_created` | Timestamp when visitor ID was created |
| `nihontowatch_tracking_opt_out` | User opt-out flag |

### Identifying Unique Users

With these two signals, you can identify users:

| Scenario | Identification Method |
|----------|----------------------|
| Same browser, same device | `visitor_id` (persistent) |
| Different browser, same network | `ip_address` (may match) |
| Cleared localStorage | `ip_address` as fallback |
| VPN/mobile network | `visitor_id` (IP changes, visitor_id stable) |
| Multiple users, same device | Cannot distinguish (edge case) |

---

## Signal Inventory

### Explicit Signals (User-Initiated Actions)

| Signal | Interest Indicator | Weight |
|--------|-------------------|--------|
| **Favorite** | Strong positive intent | Very High |
| **Alert Create** | Purchase consideration | Very High |
| **External Link Click** | Ready to buy | Very High |
| **Search Query** | Stated interest | High |
| **Filter Selection** | Category preference | Medium |

### Implicit Signals (Behavioral)

| Signal | Interest Indicator | Weight | Status |
|--------|-------------------|--------|--------|
| **Listing View Duration** | Engagement depth | High | ✅ Tracked (detail page only) |
| **Viewport Dwell Time** | Browse-level interest | High | ✅ **IMPLEMENTED** |
| **QuickView Panel Toggle** | Wants more image space | High | ✅ **IMPLEMENTED** |
| **Image Pinch-Zoom** | Inspecting details | Very High | ✅ **IMPLEMENTED** |
| **Return to Same Listing** | Persistent interest | Very High | Not tracked |
| **Scroll Depth** | Content consumption | Medium | Defined but not populated |
| **Scroll Velocity** | Browsing vs. reading | Medium | Not implemented |
| **Session Frequency** | Habit formation | High | Partial (session count) |
| **Time of Day** | Usage patterns | Low | Available via timestamp |

---

## Gaps & Missing Signals

### ✅ RESOLVED: Browse Grid Viewport Tracking

**Status:** Implemented via `viewport_dwell` events using IntersectionObserver.

Now tracks:
- Which listings enter the viewport
- How long each listing is visible (dwell time)
- Whether user scrolled back to re-view (isRevisit flag)
- Viewport intersection ratio

### ✅ RESOLVED: Image Interaction Tracking (Partial)

**Status:** Pinch-zoom tracking implemented via `image_pinch_zoom` events.

Now tracks:
- Pinch-to-zoom gestures on mobile
- Zoom scale achieved
- Duration of zoom interaction

**Still missing:**
- Number of images viewed in gallery
- Time spent on each image
- Image swipe patterns

### ✅ RESOLVED: Cross-Session Identity (Anonymous)

**Status:** Implemented via persistent `visitor_id` in localStorage + IP capture.

Now supports:
- Linking multiple sessions from same anonymous user
- Tracking return visits without login
- Building preference history over time

See [Visitor Identification](#visitor-identification) section for details.

### Remaining Gaps

#### Scroll Behavior Patterns

- Scroll velocity (fast = browsing, slow = reading)
- Scroll direction changes (hesitation = interest)
- Scroll-to-top events (re-browsing)

#### Image Gallery Depth

- Which images in a gallery were viewed
- Time spent on each image
- Completion rate (viewed all images)

---

## Most Valuable Signals

Ranked by predictive power for **time-in-app optimization**:

### Tier 1: Highest Value (Implement First)

| Signal | Why It Matters | Implementation Complexity |
|--------|----------------|--------------------------|
| **Viewport Dwell Time (Browse Grid)** | Captures interest without requiring click. Most users browse without clicking. | Medium - IntersectionObserver |
| **Return Visits to Same Listing** | Strong purchase consideration signal | Low - Query existing data |
| **Session Return Frequency** | Predicts retention, habit formation | Low - Aggregate existing sessions |

### Tier 2: High Value

| Signal | Why It Matters | Implementation Complexity |
|--------|----------------|--------------------------|
| **Image Gallery Depth** | Visual inspection = serious interest | Low - Track swipe/click events |
| **Scroll Depth on Detail** | How much content consumed | Low - Scroll listener |
| **Filter Combination Patterns** | Reveals preference clusters | Medium - Pattern mining |

### Tier 3: Supporting Signals

| Signal | Why It Matters | Implementation Complexity |
|--------|----------------|--------------------------|
| **Scroll Velocity** | Distinguishes browsing from reading | Medium - Debounced scroll tracking |
| **Time of Day Patterns** | Personalization opportunities | Low - Already captured |
| **Device Type Usage** | Mobile vs desktop behavior differs | Low - Already captured |

---

## Interest Scoring Model

### Proposed Scoring Formula

```typescript
interface ListingEngagement {
  listingId: number;

  // Explicit signals (high confidence)
  favorited: boolean;           // +50 points
  alertCreated: boolean;        // +40 points
  externalLinkClicked: boolean; // +30 points

  // Implicit signals (inferred)
  viewportDwellMs: number;      // +1 point per 2 seconds (max 20)
  detailViewDurationMs: number; // +1 point per 5 seconds (max 15)
  returnVisits: number;         // +10 points each (max 30)
  imageViews: number;           // +2 points each (max 10)
  scrollDepth: number;          // +5 points if >75%
}

function calculateInterestScore(e: ListingEngagement): number {
  let score = 0;

  // Explicit signals (high weight)
  if (e.favorited) score += 50;
  if (e.alertCreated) score += 40;
  if (e.externalLinkClicked) score += 30;

  // Viewport dwell (browse grid)
  score += Math.min(20, Math.floor(e.viewportDwellMs / 2000));

  // Detail page engagement
  score += Math.min(15, Math.floor(e.detailViewDurationMs / 5000));

  // Return visits (very strong signal)
  score += Math.min(30, e.returnVisits * 10);

  // Image interaction
  score += Math.min(10, e.imageViews * 2);

  // Scroll depth
  if (e.scrollDepth > 0.75) score += 5;

  return Math.min(100, score); // Cap at 100
}
```

### Interest Tiers

| Score Range | Tier | Description |
|-------------|------|-------------|
| 0-10 | Glanced | Saw but didn't engage |
| 11-30 | Browsed | Some interest, worth tracking |
| 31-60 | Interested | Active consideration |
| 61-80 | Highly Interested | Strong purchase intent |
| 81-100 | Ready to Buy | Immediate recommendation priority |

### Using Scores for Recommendations

1. **Similar Items**: Find listings with high scores from similar users
2. **Personalized Sort**: Boost items similar to user's high-score listings
3. **Email Digest**: Include top-scored unseen listings
4. **Homepage Widget**: "Based on your browsing" section

---

## Privacy & Compliance

### Current Privacy Implementation

| Feature | Status |
|---------|--------|
| Opt-out mechanism | ✅ Implemented (`localStorage` flag) |
| No cookies | ✅ Correct - uses `localStorage` only |
| No fingerprinting | ✅ Correct - only captures non-invasive data |
| Anonymous by default | ✅ Correct - userId null until login |
| Persistent visitor ID | ✅ localStorage-based (not cookies) |
| IP address capture | ✅ Server-side extraction |
| Data retention | ⚠️ Not implemented (needs policy) |

### Why localStorage Over Cookies

| Aspect | Cookies | localStorage (Our Choice) |
|--------|---------|---------------------------|
| GDPR consent banner | Required for tracking | Generally not required |
| Sent with requests | Yes (privacy concern) | No (explicit only) |
| Cross-site tracking | Possible | Not possible |
| User control | Browser settings | Easy to clear |
| Implementation | Complex (expiry, flags) | Simple |

### GDPR Considerations

1. **localStorage-based tracking** is generally consent-free under GDPR because:
   - Data not automatically sent to server
   - No cross-site tracking capability
   - User can clear at any time
   - First-party analytics only

2. **IP address capture** considerations:
   - IP is PII under GDPR
   - Justified under legitimate interest for fraud prevention/analytics
   - Consider hashing after 30 days for data minimization

3. **For logged-in users**: Covered by account terms of service

4. **Recommended additions**:
   - Add privacy notice explaining tracking
   - Add data export endpoint (GDPR Article 15)
   - Implement data deletion endpoint (GDPR Article 17)
   - Define retention period (recommend: 90 days for IP, indefinite for hashed visitor_id)
   - Hash IP addresses after analysis period

### localStorage Keys Used

| Key | Purpose |
|-----|---------|
| `nihontowatch_visitor_id` | Persistent anonymous visitor identifier |
| `nihontowatch_visitor_created` | When visitor ID was first created |
| `nihontowatch_tracking_opt_out` | User opt-out flag |

---

## Implementation Roadmap

### Phase 1: Viewport Tracking (Highest Impact)

**Goal:** Track which listings users pause on in browse grid

**Technical Approach:**
```typescript
// Use IntersectionObserver for efficient viewport detection
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        startDwellTimer(entry.target.dataset.listingId);
      } else {
        const dwellMs = stopDwellTimer(entry.target.dataset.listingId);
        if (dwellMs > 1500) { // Minimum 1.5s to count as "viewed"
          trackViewportDwell(entry.target.dataset.listingId, dwellMs);
        }
      }
    });
  },
  { threshold: [0.5] }
);
```

**New Event Type:**
```typescript
interface ViewportDwellEvent extends BaseActivityEvent {
  type: 'viewport_dwell';
  listingId: number;
  dwellMs: number;
  intersectionRatio: number;
  viewportPosition: 'top' | 'middle' | 'bottom';
}
```

**Estimated Effort:** 2-3 days

### Phase 2: Return Visit Tracking

**Goal:** Identify when users view same listing multiple times

**Approach:**
- Store viewed listings in sessionStorage
- Track re-views within session
- Query activity_events for cross-session re-views (authenticated users)

**New Event Type:**
```typescript
interface ListingReturnEvent extends BaseActivityEvent {
  type: 'listing_return';
  listingId: number;
  previousViewCount: number;
  daysSinceLastView: number;
}
```

**Estimated Effort:** 1-2 days

### Phase 3: Image Interaction Tracking

**Goal:** Track image gallery engagement

**Events to Add:**
- `image_view`: Which image index was viewed
- `image_zoom`: User zoomed/pinched
- `gallery_complete`: User viewed all images

**Estimated Effort:** 1-2 days

### Phase 4: Scroll Behavior

**Goal:** Track scroll patterns for interest inference

**Events to Add:**
- `scroll_depth`: Periodic scroll position updates
- `scroll_reversal`: User scrolled back up

**Estimated Effort:** 1-2 days

### Phase 5: Recommendation Engine

**Goal:** Use signals to power recommendations

**Components:**
1. Interest score calculator (runs on event ingestion)
2. Similar items finder (collaborative filtering)
3. Homepage "For You" widget
4. Email digest generator

**Estimated Effort:** 1-2 weeks

---

## Technical Reference

### Adding a New Event Type

1. **Add type to `src/lib/activity/types.ts`:**
```typescript
export type ActivityEventType =
  | 'page_view'
  | ... existing ...
  | 'viewport_dwell'; // Add new type

export interface ViewportDwellEvent extends BaseActivityEvent {
  type: 'viewport_dwell';
  listingId: number;
  dwellMs: number;
}

export type ActivityEvent = ... | ViewportDwellEvent;
```

2. **Add tracking method to `ActivityTracker.tsx`:**
```typescript
const trackViewportDwell = useCallback(
  (listingId: number, dwellMs: number) => {
    if (isOptedOut) return;

    const event: ViewportDwellEvent = {
      ...createBaseEvent(),
      type: 'viewport_dwell',
      listingId,
      dwellMs,
    };

    queueEvent(event);
  },
  [createBaseEvent, queueEvent, isOptedOut]
);
```

3. **Update `ActivityTracker` interface and return value**

4. **Create hook for component usage:**
```typescript
export function useViewportDwellTracker(listingId: number) {
  // Implementation using IntersectionObserver
}
```

### Database Schema for Interest Scores

```sql
-- Store computed interest scores for fast queries
CREATE TABLE listing_interest_scores (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,

  -- Raw signal counts
  viewport_dwell_ms INTEGER DEFAULT 0,
  detail_view_ms INTEGER DEFAULT 0,
  return_visits INTEGER DEFAULT 0,
  image_views INTEGER DEFAULT 0,
  scroll_depth REAL DEFAULT 0,

  -- Explicit actions
  favorited BOOLEAN DEFAULT FALSE,
  alert_created BOOLEAN DEFAULT FALSE,
  external_clicked BOOLEAN DEFAULT FALSE,

  -- Computed score
  interest_score INTEGER DEFAULT 0,

  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(session_id, listing_id)
);

-- Index for recommendation queries
CREATE INDEX idx_interest_scores_user ON listing_interest_scores(user_id, interest_score DESC);
CREATE INDEX idx_interest_scores_session ON listing_interest_scores(session_id, interest_score DESC);
```

### Querying for Recommendations

```sql
-- Get user's top interests (authenticated)
SELECT listing_id, interest_score
FROM listing_interest_scores
WHERE user_id = $1
ORDER BY interest_score DESC
LIMIT 20;

-- Get similar users (collaborative filtering)
SELECT DISTINCT lis2.user_id
FROM listing_interest_scores lis1
JOIN listing_interest_scores lis2 ON lis1.listing_id = lis2.listing_id
WHERE lis1.user_id = $1
  AND lis2.user_id != $1
  AND lis1.interest_score > 30
  AND lis2.interest_score > 30
GROUP BY lis2.user_id
HAVING COUNT(*) >= 3;
```

---

## Metrics to Track

### Success Metrics (Time-in-App Optimization)

| Metric | Definition | Target |
|--------|------------|--------|
| **Avg Session Duration** | Mean time per session | +20% in 90 days |
| **Sessions per User per Week** | Return frequency | +15% in 90 days |
| **Pages per Session** | Browsing depth | +10% in 90 days |
| **Bounce Rate** | Single page sessions | -10% in 90 days |
| **7-Day Retention** | Users returning within 7 days | +25% in 90 days |

### Signal Quality Metrics

| Metric | Definition | Threshold |
|--------|------------|-----------|
| **Events per Session** | Activity volume | >10 avg |
| **Viewport Dwell Coverage** | % of viewed listings tracked | >80% |
| **Interest Score Distribution** | Healthy spread across tiers | No >50% in single tier |

---

## Database Schema

### activity_events Table

The main table storing all tracked events:

```sql
CREATE TABLE activity_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_id TEXT,                    -- Persistent anonymous identifier
  ip_address TEXT,                    -- Client IP for secondary identification
  event_type TEXT NOT NULL,
  event_data JSONB,                   -- Event-specific payload
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_activity_events_session_id ON activity_events(session_id);
CREATE INDEX idx_activity_events_user_id ON activity_events(user_id);
CREATE INDEX idx_activity_events_visitor_id ON activity_events(visitor_id);
CREATE INDEX idx_activity_events_ip_address ON activity_events(ip_address);
CREATE INDEX idx_activity_events_event_type ON activity_events(event_type);
CREATE INDEX idx_activity_events_created_at ON activity_events(created_at);
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `session_id` | TEXT | Session identifier (per browser tab) |
| `user_id` | UUID | Auth user ID (null for anonymous) |
| `visitor_id` | TEXT | Persistent visitor ID from localStorage (e.g., `vis_mkjoszll_38b3b28886aa`) |
| `ip_address` | TEXT | Client IP extracted from request headers |
| `event_type` | TEXT | Event type (page_view, external_link_click, etc.) |
| `event_data` | JSONB | Event-specific data (listingId, url, filters, etc.) |
| `created_at` | TIMESTAMPTZ | When the event occurred |

### Event Data Examples

**external_link_click:**
```json
{
  "url": "https://aoijapan.com/katana/12345",
  "listingId": 12345,
  "dealerName": "Aoi Art"
}
```

**quickview_open:**
```json
{
  "listingId": 12345,
  "dealerName": "Aoi Art",
  "source": "listing_card"
}
```

> **Note:** Prior to 2026-01-31, card clicks were incorrectly tracked as `external_link_click` instead of `quickview_open`. See [DEALER_ANALYTICS_TRACKING_FIX.md](./DEALER_ANALYTICS_TRACKING_FIX.md) for details.

**viewport_dwell:**
```json
{
  "listingId": 67890,
  "dwellMs": 3500,
  "intersectionRatio": 0.85,
  "isRevisit": false
}
```

**quickview_panel_toggle:**
```json
{
  "listingId": 11111,
  "action": "collapse",
  "dwellMs": 8000
}
```

**image_pinch_zoom:**
```json
{
  "listingId": 22222,
  "imageIndex": 2,
  "zoomScale": 2.5,
  "durationMs": 4200
}
```

---

## Querying Activity Data

### Basic Queries

**Recent events with visitor info:**
```sql
SELECT
  visitor_id,
  ip_address,
  event_type,
  event_data,
  created_at
FROM activity_events
ORDER BY created_at DESC
LIMIT 50;
```

**Events by type (last 24 hours):**
```sql
SELECT
  event_type,
  COUNT(*) as count
FROM activity_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY count DESC;
```

**Unique visitors (last 7 days):**
```sql
SELECT COUNT(DISTINCT visitor_id) as unique_visitors
FROM activity_events
WHERE created_at > NOW() - INTERVAL '7 days'
  AND visitor_id IS NOT NULL;
```

### Engagement Analysis

**Top clicked dealers:**
```sql
SELECT
  event_data->>'dealerName' as dealer,
  COUNT(*) as clicks
FROM activity_events
WHERE event_type = 'external_link_click'
  AND event_data->>'dealerName' IS NOT NULL
GROUP BY event_data->>'dealerName'
ORDER BY clicks DESC
LIMIT 10;
```

**Most viewed listings (by viewport dwell):**
```sql
SELECT
  (event_data->>'listingId')::int as listing_id,
  COUNT(*) as view_count,
  AVG((event_data->>'dwellMs')::int) as avg_dwell_ms
FROM activity_events
WHERE event_type = 'viewport_dwell'
GROUP BY event_data->>'listingId'
ORDER BY view_count DESC
LIMIT 20;
```

**Visitor engagement summary:**
```sql
SELECT
  visitor_id,
  COUNT(*) as total_events,
  COUNT(DISTINCT session_id) as sessions,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen,
  COUNT(*) FILTER (WHERE event_type = 'external_link_click') as link_clicks,
  COUNT(*) FILTER (WHERE event_type = 'viewport_dwell') as dwell_events
FROM activity_events
WHERE visitor_id IS NOT NULL
GROUP BY visitor_id
ORDER BY total_events DESC
LIMIT 20;
```

### Activity by Hour (for usage patterns)

```sql
SELECT
  EXTRACT(HOUR FROM created_at) as hour_utc,
  COUNT(*) as events
FROM activity_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_utc;
```

### Node.js Query Script

A query script is available at `scripts/query-activity.mjs`:

```bash
node scripts/query-activity.mjs
```

This outputs:
- Total events and breakdown by type
- Top dealers by click count
- Activity by hour
- Unique visitor/session counts

---

## Admin Dashboard (Plausible-lite)

A privacy-respecting analytics dashboard inspired by Plausible, available at `/admin/visitors`.

### Features

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Visitor tracking started recently                            │
│   13 of 1,253 events (1.0%) have visitor tracking.              │
│   Tracking began 2h ago.                                        │
├─────────────────────────────────────────────────────────────────┤
│  Tracked Visitors    Unique IPs    Sessions    Total Events     │
│        2                 1            430          1,253         │
│  Unique visitor IDs  Distinct IPs  Browser tabs  All actions    │
├─────────────────────────────────────────────────────────────────┤
│  [████████░░░░] Visitors Over Time (bar chart)                  │
├──────────────────┬──────────────────┬────────────────────────────┤
│  Locations       │  Top Dealers     │  Event Types               │
│  🇨🇭 Switzerland  │  Aoi Art    66   │  Filter Changes   441      │
│  🇯🇵 Japan        │  Iida Koendo 34  │  Page Views       310      │
│  🇺🇸 USA          │  Eirakudo   32   │  Dealer Clicks    232      │
├──────────────────┴──────────────────┴────────────────────────────┤
│  Recent Visitors (table with location, events, last seen)       │
└─────────────────────────────────────────────────────────────────┘
```

### Honest Metrics Philosophy

The dashboard is designed to be **honest about data quality**:

| Metric | What It Shows | Why It's Honest |
|--------|---------------|-----------------|
| **Tracked Visitors** | Unique `visitor_id` values | Only counts events with proper tracking |
| **Unique IPs** | Distinct IP addresses | Secondary signal, shown separately |
| **Sessions** | Unique `session_id` values | Context only - not conflated with visitors |
| **Tracking Coverage** | % of events with `visitor_id` | Warns when coverage is incomplete |

### API Endpoints

**GET `/api/admin/visitors?range=7d`**

Returns aggregated visitor statistics:
```typescript
{
  trackedVisitors: number;      // Unique visitor_ids
  totalSessions: number;        // Unique session_ids
  uniqueIPs: string[];          // For geo lookup
  totalEvents: number;
  eventsWithTracking: number;   // Events with visitor_id
  eventsWithoutTracking: number;
  trackingStartDate: string;    // When tracking began
  visitorsByDay: [...];         // Time series
  topEventTypes: [...];
  topDealers: [...];
  visitors: [...];              // Top visitors list
  activeNow: number;            // Real-time (last 5 min)
}
```

**POST `/api/admin/visitors/geo`**

Batch IP geolocation lookup:
```typescript
// Request
{ ips: ["1.2.3.4", "5.6.7.8"] }

// Response
{
  geoData: {
    "1.2.3.4": { country: "Japan", countryCode: "JP", city: "Tokyo", ... }
  },
  countrySummary: [
    { country: "Japan", countryCode: "JP", count: 5, percentage: 50 }
  ]
}
```

### Time Ranges

- `24h` - Last 24 hours
- `7d` - Last 7 days (default)
- `30d` - Last 30 days
- `90d` - Last 90 days

### Geolocation

IP addresses are looked up via [ip-api.com](http://ip-api.com) (free tier):
- Batch requests (up to 100 IPs per request)
- Returns country, region, city, ISP, timezone
- Country flags displayed using Unicode regional indicators

---

## Appendix: Research Sources

- [Intersection Observer API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Implicit Feedback in E-Commerce Recommendations](https://link.springer.com/article/10.1007/s42979-023-01752-x)
- [Privacy-Friendly Analytics: GDPR 2025](https://secureprivacy.ai/blog/privacy-friendly-analytics)
- [Snowplow Mobile Screen Engagement](https://snowplow.io/blog/mobile-screen-engagement)
- [Zillow: Explicit & Implicit Signals](https://www.zillow.com/tech/utilizing-both-explicit-implicit-signals/)
