# User Engagement Analytics - Agent Handoff Document

> **Status: ✅ COMPLETED** - 2026-02-01
>
> This plan was successfully executed. See `docs/USER_ENGAGEMENT_ANALYTICS.md` for final documentation.

## Executive Summary

Transform the placeholder `/admin/analytics` page into a fully functional user engagement dashboard. This work runs **in parallel** with the Dealer Analytics workstream (click tracking fixes) with **no conflicts**.

**Plan Reference**: `docs/plans/USER_ENGAGEMENT_ANALYTICS_PLAN.md`

---

## Quick Context

### Current State
- `/admin/analytics` page exists but is mostly placeholder
- Calls `/api/admin/stats` which returns partial/mock data
- Charts show "coming soon" or use fake data
- `/admin/market-intelligence` (separate page) is fully functional

### Target State
- Real user engagement metrics from database
- Working charts: User Growth, Conversion Funnel, Popular Searches, Top Listings
- Period selector (7d/30d/90d) that actually filters data
- Proper loading states and error handling

---

## Parallel Workstream Coordination

### Other Agent: Dealer Analytics
Working on:
- Fix `trackExternalLinkClick` calls in QuickView components
- Create `dealer_clicks` and `dealer_daily_stats` tables
- Update `/api/admin/dealers/analytics/*`

### This Workstream: User Engagement
Working on:
- Create `listing_views` and `user_searches` tables
- Create `/api/admin/analytics/engagement/*` endpoints
- Rewrite `/admin/analytics` page

### No-Touch Zones (Shared Infrastructure)
**DO NOT MODIFY these files** - both agents read from them:
- `src/lib/tracking/ActivityTracker.tsx`
- `src/app/api/track/route.ts`
- `activity_events` table schema

---

## Agent Task Assignments

### Agent 1: Database & Tracking Infrastructure

**Objective**: Create database tables and tracking endpoints

**Files to CREATE**:

1. `supabase/migrations/044_listing_views.sql`
```sql
-- Key requirements:
-- - listing_id INTEGER NOT NULL REFERENCES listings(id)
-- - session_id TEXT NOT NULL
-- - user_id UUID (nullable)
-- - viewed_at TIMESTAMPTZ DEFAULT NOW()
-- - referrer TEXT ('browse'|'search'|'direct'|'external'|'alert')
-- - UNIQUE constraint on (listing_id, session_id, DATE(viewed_at)) for deduplication
-- - Indexes on: listing_id, viewed_at, user_id, session_id
-- - RLS: service role insert, admin select, user select own
```

2. `supabase/migrations/045_user_searches.sql`
```sql
-- Key requirements:
-- - query TEXT NOT NULL
-- - query_normalized TEXT NOT NULL (lowercase, trimmed)
-- - filters JSONB (itemType, dealer, certification, price range)
-- - result_count INTEGER
-- - session_id TEXT NOT NULL
-- - user_id UUID (nullable)
-- - searched_at TIMESTAMPTZ DEFAULT NOW()
-- - clicked_listing_id INTEGER (nullable) - for CTR tracking
-- - Indexes on: query_normalized, searched_at, session_id
-- - RLS: service role insert, admin select
```

3. `src/app/api/track/view/route.ts`
```typescript
// POST endpoint receiving:
// { listingId: number, sessionId: string, userId?: string, referrer: string }
//
// Requirements:
// - Use createServiceClient() for insert (bypass RLS)
// - Upsert to handle deduplication
// - Return { success: true } even on duplicate
// - Silent failure - never break UX
```

4. `src/app/api/track/search/route.ts`
```typescript
// POST endpoint receiving:
// { query: string, filters: object, resultCount: number, sessionId: string, userId?: string }
//
// Requirements:
// - Normalize query (lowercase, trim)
// - Store filters as JSONB
// - Return { success: true, searchId: number } for CTR tracking
```

5. `src/lib/tracking/viewTracker.ts`
```typescript
// Client-side helper:
// - trackListingView(listingId, sessionId, userId?, referrer)
// - getViewReferrer() - detect referrer from document.referrer
```

6. `src/lib/tracking/searchTracker.ts`
```typescript
// Client-side helper:
// - trackSearch(query, filters, resultCount, sessionId, userId?)
// - trackSearchClick(searchId, listingId) - for CTR
```

**Files to MODIFY**:

7. `src/app/listing/[id]/page.tsx`
   - Add view tracking on page load
   - Get session ID from existing session management
   - Detect referrer

8. Find the search component (likely `src/components/search/SearchBar.tsx` or similar)
   - Add search tracking when results are displayed

**Tests to CREATE**:
- `tests/api/track/view.test.ts`
- `tests/api/track/search.test.ts`

**Verification**:
```bash
# After migrations, verify tables exist:
supabase db execute "SELECT * FROM listing_views LIMIT 1"
supabase db execute "SELECT * FROM user_searches LIMIT 1"
```

---

### Agent 2: Analytics API Endpoints

**Objective**: Create all engagement analytics API endpoints

**Depends on**: Agent 1 tables must exist

**Files to CREATE**:

1. `src/app/api/admin/analytics/engagement/_lib/utils.ts`
```typescript
// Shared utilities:
// - verifyAdminAuth(supabase) - check admin role
// - calculatePeriodDates(period) - get start/end dates + comparison period
// - successResponse(data, cacheSeconds) - standard response wrapper
// - errorResponse(message, status)
// - percentChange(current, previous)
```

2. `src/app/api/admin/analytics/engagement/overview/route.ts`
```typescript
// GET /api/admin/analytics/engagement/overview?period=30d
// Returns:
{
  users: { total, newInPeriod, newPrevPeriod, changePercent, activeToday, activeInPeriod },
  sessions: { total, avgDurationSeconds, avgPageViews, bounceRate, totalPrevPeriod, changePercent },
  engagement: { totalViews, totalSearches, totalFavorites, viewsPrevPeriod, searchesPrevPeriod, favoritesPrevPeriod },
  asOf: string,
  period: string
}
// Query: profiles, user_sessions, listing_views, user_searches, user_favorites
```

3. `src/app/api/admin/analytics/engagement/growth/route.ts`
```typescript
// GET /api/admin/analytics/engagement/growth?period=90d&granularity=daily
// Returns:
{
  dataPoints: [{ date, newUsers, cumulativeUsers }],
  summary: { totalNewUsers, avgDailySignups, peakDay, peakCount },
  period: string,
  granularity: string
}
// Query: profiles.created_at aggregated by day/week/month
```

4. `src/app/api/admin/analytics/engagement/searches/route.ts`
```typescript
// GET /api/admin/analytics/engagement/searches?period=30d&limit=20
// Returns:
{
  searches: [{ term, count, uniqueUsers, avgResultCount, clickThroughRate }],
  totals: { totalSearches, uniqueSearchers, avgClickThroughRate },
  period: string
}
// Query: user_searches aggregated by query_normalized
```

5. `src/app/api/admin/analytics/engagement/funnel/route.ts`
```typescript
// GET /api/admin/analytics/engagement/funnel?period=30d
// Returns:
{
  stages: [
    { stage: 'visitors', label: 'Visitors', count, conversionRate: 100, dropoffRate: 0 },
    { stage: 'searchers', label: 'Searched', count, conversionRate, dropoffRate },
    { stage: 'viewers', label: 'Viewed Listing', count, conversionRate, dropoffRate },
    { stage: 'engagers', label: 'Favorited', count, conversionRate, dropoffRate },
    { stage: 'high_intent', label: 'Saved Search', count, conversionRate, dropoffRate },
    { stage: 'converted', label: 'Sent Inquiry', count, conversionRate, dropoffRate },
  ],
  overallConversionRate: number,
  period: string
}
// Query: user_sessions, user_searches, listing_views, user_favorites, saved_searches, inquiry_emails
```

6. `src/app/api/admin/analytics/engagement/top-listings/route.ts`
```typescript
// GET /api/admin/analytics/engagement/top-listings?period=30d&limit=10&sortBy=views
// Returns:
{
  listings: [{ id, title, itemType, dealerName, views, uniqueViewers, favorites, priceJPY }],
  period: string,
  sortedBy: string
}
// Query: listing_views + user_favorites aggregated, joined with listings
```

**Tests to CREATE**:
- `tests/api/admin/analytics/engagement/overview.test.ts`
- `tests/api/admin/analytics/engagement/growth.test.ts`
- `tests/api/admin/analytics/engagement/searches.test.ts`
- `tests/api/admin/analytics/engagement/funnel.test.ts`
- `tests/api/admin/analytics/engagement/top-listings.test.ts`

**Test Requirements**:
- Mock Supabase client
- Test 401 for unauthenticated
- Test 403 for non-admin
- Test successful response structure
- Test period parameter handling

---

### Agent 3: Frontend Components

**Objective**: Create React components and data hook

**Depends on**: Agent 2 APIs must be complete

**Files to CREATE**:

1. `src/hooks/useUserEngagement.ts`
```typescript
// Custom hook that:
// - Accepts { period: '7d'|'30d'|'90d' }
// - Fetches all 5 endpoints in parallel
// - Returns { data, loading, errors, refreshAll, isLoading, hasErrors, lastUpdated }
// - Tracks individual loading/error state per endpoint
// - Re-fetches when period changes
```

2. `src/components/admin/analytics/ConversionFunnelChart.tsx`
```typescript
// Props: { stages: FunnelStage[], loading?: boolean, height?: number }
// Features:
// - Horizontal bars showing count at each stage
// - Percentage labels showing conversion rate
// - Color coding (green >50%, yellow >20%, red <20%)
// - Dropoff indicators between stages
// - Loading skeleton state
// - Empty state handling
```

3. `src/components/admin/analytics/UserGrowthChart.tsx`
```typescript
// Props: { dataPoints: GrowthDataPoint[], loading?: boolean, height?: number, showCumulative?: boolean }
// Features:
// - Recharts ComposedChart
// - Bar chart for daily new users (left axis)
// - Line chart for cumulative users (right axis)
// - Custom tooltip showing both values
// - Loading skeleton state
// - Empty state handling
```

4. `src/components/admin/analytics/SearchTermsTable.tsx`
```typescript
// Props: { searches: SearchTermData[], loading?: boolean }
// Features:
// - Table with columns: #, Term, Searches, Avg Results, CTR
// - Color-coded CTR (green >=30%, yellow >=10%, red <10%)
// - Loading skeleton rows
// - Empty state handling
```

**Files to MODIFY**:

5. `src/components/admin/analytics/index.ts`
   - Add exports for new components

**Tests to CREATE**:
- `tests/hooks/useUserEngagement.test.ts`
- `tests/components/admin/analytics/ConversionFunnelChart.test.tsx`
- `tests/components/admin/analytics/UserGrowthChart.test.tsx`
- `tests/components/admin/analytics/SearchTermsTable.test.tsx`

**Test Requirements**:
- Use @testing-library/react
- Test loading state rendering
- Test empty state rendering
- Test data rendering
- Test hook fetch behavior and state management

---

### Agent 4: Page Rewrite

**Objective**: Replace the analytics page with new implementation

**Depends on**: Agent 3 components must be complete

**Files to MODIFY**:

1. `src/app/admin/analytics/page.tsx` - **COMPLETE REWRITE**

```typescript
// Structure:
// - Period selector (7d/30d/90d toggle buttons)
// - Last updated timestamp + Refresh button
// - 4 MetricCards in a grid:
//   - Total Users (with change %)
//   - Active Today
//   - Avg Session Duration
//   - Total Searches
// - 2-column grid:
//   - UserGrowthChart with summary stats
//   - ConversionFunnelChart with overall rate
// - 2-column grid:
//   - SearchTermsTable
//   - Top Listings list (can be simple div with items)
//
// Use:
// - useUserEngagement hook for data
// - Suspense + lazy() for chart components
// - Existing MetricCard from components/admin/analytics
// - ChartSkeleton for loading states
```

**Tests to CREATE**:
- `tests/integration/engagement-dashboard.test.ts`

**Test Requirements**:
- Mock useUserEngagement hook
- Test page renders without error
- Test metric cards display values
- Test period selector changes state
- Test refresh button triggers refresh

---

## File Tree Summary

```
src/
├── app/
│   ├── admin/
│   │   └── analytics/
│   │       └── page.tsx                    # REWRITE (Agent 4)
│   └── api/
│       ├── admin/
│       │   └── analytics/
│       │       └── engagement/
│       │           ├── _lib/
│       │           │   └── utils.ts        # CREATE (Agent 2)
│       │           ├── overview/
│       │           │   └── route.ts        # CREATE (Agent 2)
│       │           ├── growth/
│       │           │   └── route.ts        # CREATE (Agent 2)
│       │           ├── searches/
│       │           │   └── route.ts        # CREATE (Agent 2)
│       │           ├── funnel/
│       │           │   └── route.ts        # CREATE (Agent 2)
│       │           └── top-listings/
│       │               └── route.ts        # CREATE (Agent 2)
│       └── track/
│           ├── view/
│           │   └── route.ts                # CREATE (Agent 1)
│           └── search/
│               └── route.ts                # CREATE (Agent 1)
├── components/
│   └── admin/
│       └── analytics/
│           ├── index.ts                    # MODIFY (Agent 3)
│           ├── ConversionFunnelChart.tsx   # CREATE (Agent 3)
│           ├── UserGrowthChart.tsx         # CREATE (Agent 3)
│           └── SearchTermsTable.tsx        # CREATE (Agent 3)
├── hooks/
│   └── useUserEngagement.ts                # CREATE (Agent 3)
└── lib/
    └── tracking/
        ├── viewTracker.ts                  # CREATE (Agent 1)
        └── searchTracker.ts                # CREATE (Agent 1)

supabase/
└── migrations/
    ├── 044_listing_views.sql               # CREATE (Agent 1)
    └── 045_user_searches.sql               # CREATE (Agent 1)

tests/
├── api/
│   ├── track/
│   │   ├── view.test.ts                    # CREATE (Agent 1)
│   │   └── search.test.ts                  # CREATE (Agent 1)
│   └── admin/
│       └── analytics/
│           └── engagement/
│               ├── overview.test.ts        # CREATE (Agent 2)
│               ├── growth.test.ts          # CREATE (Agent 2)
│               ├── searches.test.ts        # CREATE (Agent 2)
│               ├── funnel.test.ts          # CREATE (Agent 2)
│               └── top-listings.test.ts    # CREATE (Agent 2)
├── hooks/
│   └── useUserEngagement.test.ts           # CREATE (Agent 3)
├── components/
│   └── admin/
│       └── analytics/
│           ├── ConversionFunnelChart.test.tsx  # CREATE (Agent 3)
│           ├── UserGrowthChart.test.tsx        # CREATE (Agent 3)
│           └── SearchTermsTable.test.tsx       # CREATE (Agent 3)
└── integration/
    └── engagement-dashboard.test.ts        # CREATE (Agent 4)
```

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent 1: Database & Tracking                                   │
│  - Migrations (044, 045)                                        │
│  - Tracking endpoints (/api/track/view, /api/track/search)      │
│  - Client helpers (viewTracker.ts, searchTracker.ts)            │
│  - Integration into listing page and search                     │
│  - Tests                                                        │
│                                                                 │
│  Est: 2-3 hours                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ (tables must exist)
┌─────────────────────────────────────────────────────────────────┐
│  Agent 2: Analytics APIs                                        │
│  - Shared utils                                                 │
│  - 5 API endpoints                                              │
│  - Tests                                                        │
│                                                                 │
│  Est: 2-3 hours                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ (APIs must work)
┌─────────────────────────────────────────────────────────────────┐
│  Agent 3: Frontend Components                                   │
│  - useUserEngagement hook                                       │
│  - 3 chart/table components                                     │
│  - Tests                                                        │
│                                                                 │
│  Est: 2-3 hours                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ (components must work)
┌─────────────────────────────────────────────────────────────────┐
│  Agent 4: Page Rewrite                                          │
│  - Complete page rewrite                                        │
│  - Integration test                                             │
│                                                                 │
│  Est: 1-2 hours                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Reference Files

Agents should read these for patterns and context:

| Purpose | File |
|---------|------|
| Existing analytics components | `src/components/admin/analytics/*.tsx` |
| Similar hook pattern | `src/hooks/useMarketIntelligence.ts` |
| API auth pattern | `src/app/api/admin/analytics/market/overview/route.ts` |
| Existing tracking | `src/lib/tracking/ActivityTracker.tsx` |
| Existing migrations | `supabase/migrations/010_activity_tracking.sql` |
| Full plan | `docs/plans/USER_ENGAGEMENT_ANALYTICS_PLAN.md` |

---

## Success Criteria

- [x] `listing_views` table created with proper indexes and RLS
- [x] `user_searches` table created with proper indexes and RLS
- [x] View tracking works (verify with manual test)
- [x] Search tracking works (verify with manual test)
- [x] All 5 engagement APIs return valid data
- [x] All APIs require admin authentication
- [x] Period filter works on all APIs
- [x] Dashboard loads without errors
- [x] Charts render with data
- [x] Period selector updates all data
- [x] Refresh button works
- [x] All tests pass (`npm test`) - 3,582 tests passing
- [x] No TypeScript errors (`npm run build`)

### Tracking Integration Fix (2026-02-01)

After initial implementation, tracking wasn't connected to the frontend. Fixed by:
1. Updated analytics endpoints to query `listing_views` and `user_searches` (not `activity_events`)
2. Integrated `trackListingView()` into ListingDetailClient.tsx and QuickView.tsx
3. Integrated `trackSearch()` into page.tsx with CTR tracking via searchId prop chain
4. Updated test mocks to use new table structure

See `docs/USER_ENGAGEMENT_ANALYTICS.md` for complete documentation.
