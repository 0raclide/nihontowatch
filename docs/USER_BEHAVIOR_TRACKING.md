# User Behavior Tracking & Interest Signals

## Overview

This document covers Nihontowatch's user behavior tracking system, the signals we collect, gaps in current implementation, and recommendations for building interest-based recommendations optimized for **time spent in app**.

**Goal:** Track implicit user interest to power personalized recommendations for anonymous and authenticated users.

**North Star Metric:** Time spent using the app (session duration, return visits)

---

## Table of Contents

1. [Current Implementation](#current-implementation)
2. [Signal Inventory](#signal-inventory)
3. [Gaps & Missing Signals](#gaps--missing-signals)
4. [Most Valuable Signals](#most-valuable-signals)
5. [Interest Scoring Model](#interest-scoring-model)
6. [Privacy & Compliance](#privacy--compliance)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Technical Reference](#technical-reference)

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
Admin Dashboard
├── /admin/analytics (high-level stats)
└── /admin/activity (detailed log + CSV export)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/tracking/ActivityTracker.tsx` | Main provider, auth integration, privacy |
| `src/lib/activity/sessionManager.ts` | Session lifecycle, visibility handling |
| `src/lib/activity/types.ts` | Event type definitions |
| `src/hooks/useActivityTracker.ts` | Standalone tracking hook |
| `src/components/activity/ActivityProvider.tsx` | Auto page-view tracking |
| `src/app/api/activity/route.ts` | Batch event ingestion |
| `src/app/api/activity/session/route.ts` | Session create/end |

### Currently Tracked Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `page_view` | Route change | path, referrer, searchParams |
| `listing_view` | Listing detail exit | listingId, durationMs, scrollDepth*, imageViews* |
| `search` | Search submit | query, resultCount, filters |
| `filter_change` | Filter toggle | filters, changedFilter, oldValue, newValue |
| `favorite_add/remove` | Favorite action | listingId |
| `alert_create/delete` | Alert action | alertId, alertType, criteria |
| `external_link_click` | Dealer link click | url, listingId, dealerName |

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
| **Listing View Duration** | Engagement depth | High | Tracked (detail page only) |
| **Return to Same Listing** | Persistent interest | Very High | Not tracked |
| **Image Gallery Interaction** | Visual inspection | High | Not tracked |
| **Scroll Depth** | Content consumption | Medium | Defined but not populated |
| **Viewport Dwell Time** | Browse-level interest | High | **NOT IMPLEMENTED** |
| **Scroll Velocity** | Browsing vs. reading | Medium | **NOT IMPLEMENTED** |
| **Session Frequency** | Habit formation | High | Partial (session count) |
| **Time of Day** | Usage patterns | Low | Available via timestamp |

---

## Gaps & Missing Signals

### Critical Gap: Browse Grid Viewport Tracking

**Problem:** We track listing detail page views but NOT which items users pause on while scrolling the browse grid. This is the most common interaction pattern.

**User Journey:**
```
Browse Grid (90% of time) ──> Quick scroll past
                          └──> Pause & look (interest signal!) ──> Maybe click
                                                                └──> Maybe not click (still interested!)
```

**What we're missing:**
- Which listings enter the viewport
- How long each listing is visible (dwell time)
- Whether user scrolled back to re-view
- Viewport intersection ratio (50% vs 100% visible)

### Missing: Image Interaction Tracking

On listing detail pages and QuickView:
- Number of images viewed
- Time spent on each image
- Zoom/pinch interactions (mobile)
- Image swipe patterns

### Missing: Scroll Behavior Patterns

- Scroll velocity (fast = browsing, slow = reading)
- Scroll direction changes (hesitation = interest)
- Scroll-to-top events (re-browsing)

### Missing: Cross-Session Identity (Anonymous)

Currently each browser tab = new session. No way to:
- Link multiple sessions from same anonymous user
- Track return visits without login
- Build preference history over time

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
| Opt-out mechanism | Implemented (`localStorage` flag) |
| No cookies | Correct - uses `sessionStorage` only |
| No fingerprinting | Correct - only captures consented data |
| Anonymous by default | Correct - userId null until login |
| Data retention | Not implemented (needs policy) |

### GDPR Considerations

1. **Session-based tracking** (no cookies) is generally consent-free under GDPR if:
   - No cross-session identification
   - Data is anonymous
   - No sharing with third parties

2. **For logged-in users**: Covered by account terms of service

3. **Recommended additions**:
   - Add privacy notice explaining tracking
   - Add data export endpoint (GDPR Article 15)
   - Implement data deletion endpoint (GDPR Article 17)
   - Define retention period (recommend: 90 days anonymous, 2 years authenticated)

### localStorage Keys Used

| Key | Purpose |
|-----|---------|
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

## Appendix: Research Sources

- [Intersection Observer API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Implicit Feedback in E-Commerce Recommendations](https://link.springer.com/article/10.1007/s42979-023-01752-x)
- [Privacy-Friendly Analytics: GDPR 2025](https://secureprivacy.ai/blog/privacy-friendly-analytics)
- [Snowplow Mobile Screen Engagement](https://snowplow.io/blog/mobile-screen-engagement)
- [Zillow: Explicit & Implicit Signals](https://www.zillow.com/tech/utilizing-both-explicit-implicit-signals/)
