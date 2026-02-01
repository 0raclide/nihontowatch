# User Engagement Analytics Dashboard

**Status**: ✅ Complete & Fully Operational
**Implemented**: 2026-02-01
**Tracking Integration**: 2026-02-01
**Location**: `/admin/analytics`

## Overview

The User Engagement Analytics dashboard provides admins with actionable insights into user behavior, engagement patterns, and conversion metrics. It complements the existing Market Intelligence dashboard at `/admin/market-intelligence`.

## Features

### Dashboard Components

| Component | Description |
|-----------|-------------|
| **Period Selector** | Toggle between 7-day, 30-day, and 90-day views |
| **Metric Cards** | Total users, active today, avg session duration, total searches |
| **User Growth Chart** | Bar chart (new users) + line chart (cumulative) |
| **Conversion Funnel** | 6-stage funnel from visitors to inquiries |
| **Search Terms Table** | Popular searches with CTR metrics |
| **Top Listings** | Most viewed/favorited listings |

### Conversion Funnel Stages

1. **Visitors** - Total unique sessions
2. **Searched** - Users who performed a search
3. **Viewed Listing** - Users who viewed a listing detail
4. **Favorited** - Users who added favorites
5. **Saved Search** - Users who created search alerts
6. **Sent Inquiry** - Users who sent dealer inquiries

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      /admin/analytics                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              useUserEngagement Hook                      │   │
│  │  Fetches 5 endpoints in parallel, manages state         │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ MetricCards │    │   Charts    │    │   Tables    │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              /api/admin/analytics/engagement/*                  │
│                                                                 │
│  ├── overview/     User counts, session stats, engagement      │
│  ├── growth/       User growth time series                     │
│  ├── searches/     Popular search terms + CTR                  │
│  ├── funnel/       Conversion funnel metrics                   │
│  └── top-listings/ Most viewed/favorited listings              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database Tables                            │
│                                                                 │
│  listing_views      Track listing page views (deduped/day)     │
│  user_searches      Track search queries + click-through       │
│  user_sessions      Session data (existing)                    │
│  user_favorites     Favorite actions (existing)                │
│  saved_searches     Search alerts (existing)                   │
│  profiles           User accounts (existing)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `listing_views` Table (New)

Tracks when users view listing detail pages.

```sql
CREATE TABLE listing_views (
  id BIGSERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  referrer TEXT  -- 'browse', 'search', 'direct', 'external', 'alert'
);

-- Deduplication: one view per listing/session/day
CREATE UNIQUE INDEX idx_listing_views_dedup
  ON listing_views(listing_id, session_id, view_date);
```

### `user_searches` Table (New)

Tracks search queries with click-through rate support.

```sql
CREATE TABLE user_searches (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  query_normalized TEXT NOT NULL,  -- lowercase, trimmed
  filters JSONB,                   -- {itemType, dealer, certification, priceMin, priceMax}
  result_count INTEGER NOT NULL DEFAULT 0,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clicked_listing_id INTEGER REFERENCES listings(id),  -- For CTR tracking
  clicked_at TIMESTAMPTZ
);
```

---

## API Endpoints

All endpoints require admin authentication and support `?period=7d|30d|90d`.

### GET `/api/admin/analytics/engagement/overview`

Returns aggregate stats for users, sessions, and engagement.

```typescript
{
  users: {
    total: number,
    newInPeriod: number,
    newPrevPeriod: number,
    changePercent: number,
    activeToday: number,
    activeInPeriod: number
  },
  sessions: {
    total: number,
    avgDurationSeconds: number,
    avgPageViews: number,
    bounceRate: number,
    totalPrevPeriod: number,
    changePercent: number
  },
  engagement: {
    totalViews: number,
    totalSearches: number,
    totalFavorites: number,
    viewsPrevPeriod: number,
    searchesPrevPeriod: number,
    favoritesPrevPeriod: number
  },
  asOf: string,
  period: string
}
```

### GET `/api/admin/analytics/engagement/growth`

Returns user growth time series data.

Query params: `?period=90d&granularity=daily|weekly|monthly`

```typescript
{
  dataPoints: [{ date: string, newUsers: number, cumulativeUsers: number }],
  summary: {
    totalNewUsers: number,
    avgDailySignups: number,
    peakDay: string,
    peakCount: number
  },
  period: string,
  granularity: string
}
```

### GET `/api/admin/analytics/engagement/searches`

Returns popular search terms with engagement metrics.

Query params: `?period=30d&limit=20`

```typescript
{
  searches: [{
    term: string,
    count: number,
    uniqueUsers: number,
    avgResultCount: number,
    clickThroughRate: number
  }],
  totals: {
    totalSearches: number,
    uniqueSearchers: number,
    avgClickThroughRate: number
  },
  period: string
}
```

### GET `/api/admin/analytics/engagement/funnel`

Returns conversion funnel metrics.

```typescript
{
  stages: [{
    stage: string,      // 'visitors', 'searchers', 'viewers', etc.
    label: string,      // 'Visitors', 'Searched', 'Viewed Listing', etc.
    count: number,
    conversionRate: number,  // % from first stage
    dropoffRate: number      // % drop from previous stage
  }],
  overallConversionRate: number,
  period: string
}
```

### GET `/api/admin/analytics/engagement/top-listings`

Returns most engaged-with listings.

Query params: `?period=30d&limit=10&sortBy=views|favorites`

```typescript
{
  listings: [{
    id: number,
    title: string,
    itemType: string,
    dealerName: string,
    views: number,
    uniqueViewers: number,
    favorites: number,
    priceJPY: number
  }],
  period: string,
  sortedBy: string
}
```

---

## Tracking Endpoints

### POST `/api/track/view`

Track listing views (called from listing detail pages).

```typescript
// Request
{ listingId: number, sessionId: string, userId?: string, referrer?: string }

// Response
{ success: true }
```

### POST `/api/track/search`

Track search queries.

```typescript
// Request
{ query: string, filters?: object, resultCount: number, sessionId: string, userId?: string }

// Response
{ success: true, searchId: number }
```

### PATCH `/api/track/search`

Track search click-through (when user clicks a result).

```typescript
// Request
{ searchId: number, listingId: number }

// Response
{ success: true }
```

---

## Frontend Components

### `useUserEngagement` Hook

Location: `src/hooks/useUserEngagement.ts`

```typescript
const {
  data,        // { overview, growth, searches, funnel, topListings }
  loading,     // { overview: boolean, growth: boolean, ... }
  errors,      // { overview: string | null, ... }
  refreshAll,  // () => Promise<void>
  isLoading,   // boolean - true if any endpoint loading
  hasErrors,   // boolean - true if any endpoint errored
  lastUpdated  // Date | null
} = useUserEngagement({ period: '30d' });
```

### Chart Components

| Component | Location | Props |
|-----------|----------|-------|
| `UserGrowthChart` | `src/components/admin/analytics/UserGrowthChart.tsx` | `dataPoints, loading?, height?, showCumulative?` |
| `ConversionFunnelChart` | `src/components/admin/analytics/ConversionFunnelChart.tsx` | `stages, loading?, height?` |
| `SearchTermsTable` | `src/components/admin/analytics/SearchTermsTable.tsx` | `searches, loading?` |

### Client Tracking Helpers

| Helper | Location | Purpose |
|--------|----------|---------|
| `trackListingView()` | `src/lib/tracking/viewTracker.ts` | Track listing page views |
| `getViewReferrer()` | `src/lib/tracking/viewTracker.ts` | Detect referrer source |
| `trackSearch()` | `src/lib/tracking/searchTracker.ts` | Track search queries |
| `trackSearchClick()` | `src/lib/tracking/searchTracker.ts` | Track search result clicks |

---

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   └── analytics/
│   │       └── page.tsx                    # Main dashboard page
│   └── api/
│       ├── admin/
│       │   └── analytics/
│       │       └── engagement/
│       │           ├── _lib/utils.ts       # Shared utilities
│       │           ├── overview/route.ts
│       │           ├── growth/route.ts
│       │           ├── searches/route.ts
│       │           ├── funnel/route.ts
│       │           └── top-listings/route.ts
│       └── track/
│           ├── view/route.ts               # View tracking endpoint
│           └── search/route.ts             # Search tracking endpoint
├── components/
│   └── admin/
│       └── analytics/
│           ├── ConversionFunnelChart.tsx
│           ├── UserGrowthChart.tsx
│           ├── SearchTermsTable.tsx
│           └── index.ts
├── hooks/
│   └── useUserEngagement.ts
└── lib/
    └── tracking/
        ├── viewTracker.ts
        └── searchTracker.ts

supabase/
└── migrations/
    ├── 044_listing_views.sql
    └── 045_user_searches.sql

tests/
├── api/
│   ├── track/
│   │   ├── view.test.ts
│   │   └── search.test.ts
│   └── admin/
│       └── analytics/
│           └── engagement/
│               ├── overview.test.ts
│               ├── growth.test.ts
│               ├── searches.test.ts
│               ├── funnel.test.ts
│               └── top-listings.test.ts
├── hooks/
│   └── useUserEngagement.test.ts
├── components/
│   └── admin/
│       └── analytics/
│           ├── ConversionFunnelChart.test.tsx
│           ├── UserGrowthChart.test.tsx
│           └── SearchTermsTable.test.tsx
└── integration/
    └── engagement-dashboard.test.tsx
```

---

## Integration Notes

### Adding View Tracking to Listing Pages

To track views on the listing detail page, add to `src/app/listing/[id]/page.tsx`:

```typescript
import { trackListingView, getViewReferrer } from '@/lib/tracking/viewTracker';
import { getSessionId } from '@/lib/activity/sessionManager';

// In component useEffect:
useEffect(() => {
  trackListingView(
    listing.id,
    getSessionId(),
    user?.id,
    getViewReferrer()
  );
}, [listing.id, user?.id]);
```

### Adding Search Tracking

To track searches, call from your search handler:

```typescript
import { trackSearch } from '@/lib/tracking/searchTracker';
import { getSessionId } from '@/lib/activity/sessionManager';

// After search results are fetched:
trackSearch(
  query,
  { itemType, dealer, certification, priceMin, priceMax },
  results.length,
  getSessionId(),
  user?.id
);
```

---

## Testing

Run all tests:
```bash
npm test
```

Run specific test suites:
```bash
# Tracking endpoints
npm test -- tests/api/track/

# Analytics APIs
npm test -- tests/api/admin/analytics/engagement/

# Frontend components
npm test -- tests/components/admin/analytics/

# Integration tests
npm test -- tests/integration/engagement-dashboard
```

**Test Coverage**: 257 tests across 13 test files

---

## Parallel Workstream Notes

This implementation was designed to run in parallel with the Dealer Analytics workstream. Key boundaries:

| Resource | User Engagement | Dealer Analytics |
|----------|-----------------|------------------|
| Tables | `listing_views`, `user_searches` | `dealer_clicks`, `dealer_daily_stats` |
| API namespace | `/api/admin/analytics/engagement/*` | `/api/admin/dealers/analytics/*` |
| Dashboard | `/admin/analytics` | `/admin/dealers` |

**Shared infrastructure (read-only, neither modifies):**
- `ActivityTracker.tsx`
- `/api/track/route.ts`
- `activity_events` table
- `user_sessions` table

---

## Tracking Integration (2026-02-01)

The initial implementation created the infrastructure but tracking wasn't integrated into the frontend. A follow-up fix connected all the pieces:

### What Was Fixed

| Component | Change |
|-----------|--------|
| **Analytics Endpoints** | Updated to query `listing_views` and `user_searches` tables instead of `activity_events` |
| **ListingDetailClient.tsx** | Added `trackListingView()` call on page load |
| **QuickView.tsx** | Added `trackListingView()` call when QuickView opens |
| **page.tsx (browse)** | Added `trackSearch()` call after search results load |
| **ListingCard.tsx** | Added `trackSearchClick()` for CTR tracking |

### Data Flow

```
User browses/searches                  User views listing
        │                                      │
        ▼                                      ▼
  trackSearch()                         trackListingView()
        │                                      │
        ▼                                      ▼
  /api/track/search                    /api/track/view
        │                                      │
        ▼                                      ▼
  user_searches table                  listing_views table
        │                                      │
        └──────────────┬───────────────────────┘
                       │
                       ▼
           Analytics API endpoints
                       │
                       ▼
              /admin/analytics
```

### Session Duration Tracking

Session duration and page views are tracked via the existing `ActivityTracker` system:

1. **Session Start**: `ActivityTrackerProvider` creates session on mount via POST to `/api/activity/session`
2. **Page Views**: `updateActivity(true)` increments page view counter in sessionStorage
3. **Session End**: `setupUnloadHandler()` sends duration via `sendBeacon` on page unload

**Reliability Note**: Session end uses `sendBeacon` which is reliable for normal browser closes, but may miss data if the browser is force-quit or crashes.

### Metrics Tracked

| Metric | Table | How Populated |
|--------|-------|---------------|
| Views | `listing_views` | `trackListingView()` from detail page & QuickView |
| Searches | `user_searches` | `trackSearch()` from browse page |
| Search CTR | `user_searches.clicked_listing_id` | `trackSearchClick()` from ListingCard |
| Session Duration | `user_sessions.total_duration_ms` | `endSession()` on page unload |
| Page Views/Session | `user_sessions.page_views` | `updateActivity(true)` on navigation |
| Bounce Rate | Calculated | Sessions with `page_views <= 1` |
| Favorites | `user_favorites` | Direct insert on favorite action |
| User Growth | `profiles.created_at` | Standard auth registration |

### Files Modified in Integration Fix

```
src/app/api/admin/analytics/engagement/overview/route.ts    # Query new tables
src/app/api/admin/analytics/engagement/searches/route.ts    # Query user_searches
src/app/api/admin/analytics/engagement/top-listings/route.ts # Query listing_views
src/app/api/admin/analytics/engagement/funnel/route.ts      # Query both new tables
src/app/listing/[id]/ListingDetailClient.tsx                # Add view tracking
src/components/listing/QuickView.tsx                        # Add view tracking
src/app/page.tsx                                            # Add search tracking
src/components/browse/ListingGrid.tsx                       # Pass searchId prop
src/components/browse/VirtualListingGrid.tsx                # Pass searchId prop
src/components/browse/ListingCard.tsx                       # Add CTR tracking
tests/api/admin/analytics/engagement/searches.test.ts       # Update mocks
```
