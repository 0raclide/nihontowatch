# User Engagement Analytics Dashboard - Implementation Plan

## Overview

Transform `/admin/analytics` from a placeholder page into a fully functional **user engagement analytics dashboard**, complementing the existing market intelligence dashboard at `/admin/market-intelligence`.

**Goal**: Provide admins with actionable insights into user behavior, engagement patterns, and conversion metrics.

---

## Multi-Agent Coordination

### Parallel Workstream: Dealer Analytics (Other Agent)

Another agent is working on click tracking and dealer analytics:

| Task | Files | Tables |
|------|-------|--------|
| Fix click tracking calls | `ListingCard.tsx`, `QuickViewContent.tsx`, `QuickViewMobileSheet.tsx` | — |
| Create dealer clicks table | Migration | `dealer_clicks` |
| Create dealer stats table | Migration | `dealer_daily_stats` |
| Aggregation cron job | `/api/cron/aggregate-dealer-stats` | — |
| Update dealer analytics API | `/api/admin/dealers/analytics/*` | — |

### This Workstream: User Engagement (This Plan)

| Task | Files | Tables |
|------|-------|--------|
| View tracking table | Migration | `listing_views` |
| Search tracking table | Migration | `user_searches` |
| Engagement APIs | `/api/admin/analytics/engagement/*` | — |
| Dashboard rewrite | `/admin/analytics/page.tsx` | — |

### Boundaries (No Conflicts)

| Resource | Dealer Agent | This Agent |
|----------|--------------|------------|
| `/api/track/route.ts` | ❌ Does not modify | ❌ Does not modify |
| `ActivityTracker.tsx` | Fixes WHERE calls happen | ❌ Does not modify |
| `activity_events` table | Writes `external_link_click` | Reads `listing_view`, `search` |
| Database tables | `dealer_clicks`, `dealer_daily_stats` | `listing_views`, `user_searches` |
| API namespace | `/api/admin/dealers/*` | `/api/admin/analytics/engagement/*` |
| Dashboard page | `/admin/dealers` | `/admin/analytics` |

### Shared Infrastructure (Read-Only)

Both agents benefit from but do NOT modify:
- `ActivityTracker.tsx` - existing tracking provider
- `/api/track/route.ts` - existing tracking endpoint
- `activity_events` table - existing event storage
- `user_sessions` table - existing session storage

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRACKING LAYER (SHARED)                            │
│                                                                             │
│  ActivityTracker.tsx ───────► /api/track/route.ts ───────► activity_events │
│  (trackExternalLinkClick)                                   (writes)        │
│  (trackListingView)                                                         │
│  (trackSearch)                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│   DEALER ANALYTICS AGENT      │   │   USER ENGAGEMENT AGENT       │
│                               │   │                               │
│   dealer_clicks (NEW)         │   │   listing_views (NEW)         │
│   dealer_daily_stats (NEW)    │   │   user_searches (NEW)         │
│                               │   │                               │
│   /api/admin/dealers/         │   │   /api/admin/analytics/       │
│   analytics/*                 │   │   engagement/*                │
│                               │   │                               │
│   /admin/dealers (page)       │   │   /admin/analytics (page)     │
└───────────────────────────────┘   └───────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER ENGAGEMENT ANALYTICS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND LAYER                               │   │
│  │  src/app/admin/analytics/page.tsx (rewritten)                       │   │
│  │  └── useUserEngagement hook                                          │   │
│  │      └── Fetches from /api/admin/analytics/engagement/*             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          API LAYER                                   │   │
│  │  /api/admin/analytics/engagement/                                    │   │
│  │  ├── overview/route.ts      (user counts, session stats)            │   │
│  │  ├── growth/route.ts        (user growth time series)               │   │
│  │  ├── searches/route.ts      (popular search terms)                  │   │
│  │  ├── funnel/route.ts        (conversion funnel)                     │   │
│  │  └── top-listings/route.ts  (most viewed/favorited)                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DATABASE LAYER                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │   profiles   │  │ user_sessions│  │    activity_events       │  │   │
│  │  │  (existing)  │  │  (existing)  │  │      (existing)          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │listing_views │  │ user_searches│  │    user_favorites        │  │   │
│  │  │    (NEW)     │  │    (NEW)     │  │      (existing)          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       TRACKING LAYER                                 │   │
│  │  ActivityTracker.tsx (existing) + ViewTracker (NEW)                 │   │
│  │  └── Sends events to /api/track                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema & Tracking Infrastructure

### 1.1 New Tables

#### `listing_views` Table
Tracks individual listing page views for engagement metrics.

```sql
-- Migration: 20240201_create_listing_views.sql
CREATE TABLE listing_views (
  id BIGSERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,  -- For anonymous session tracking
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer TEXT,    -- Where they came from (browse, search, direct, external)
  time_on_page_ms INTEGER,  -- Updated when they leave (optional)

  -- Indexes for common queries
  CONSTRAINT listing_views_listing_id_idx UNIQUE (listing_id, session_id, DATE(viewed_at))
);

CREATE INDEX listing_views_listing_id_idx ON listing_views(listing_id);
CREATE INDEX listing_views_user_id_idx ON listing_views(user_id);
CREATE INDEX listing_views_viewed_at_idx ON listing_views(viewed_at);
CREATE INDEX listing_views_session_id_idx ON listing_views(session_id);

-- RLS: Service role only for writes, admin for reads
ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert views" ON listing_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read views" ON listing_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
```

#### `user_searches` Table
Tracks search queries for understanding user intent.

```sql
-- Migration: 20240201_create_user_searches.sql
CREATE TABLE user_searches (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  query TEXT NOT NULL,
  query_normalized TEXT NOT NULL,  -- Lowercase, trimmed for aggregation
  filters JSONB,  -- {itemType, dealer, certification, priceMin, priceMax}
  result_count INTEGER NOT NULL DEFAULT 0,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Track if user engaged with results
  clicked_listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX user_searches_query_normalized_idx ON user_searches(query_normalized);
CREATE INDEX user_searches_searched_at_idx ON user_searches(searched_at);
CREATE INDEX user_searches_user_id_idx ON user_searches(user_id);
CREATE INDEX user_searches_session_id_idx ON user_searches(session_id);

-- RLS
ALTER TABLE user_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert searches" ON user_searches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read searches" ON user_searches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
```

#### Verify/Update `user_sessions` Table
Ensure the existing table has required columns:

```sql
-- Check and add missing columns if needed
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS total_duration_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_bounce BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS user_sessions_started_at_idx ON user_sessions(started_at);
```

### 1.2 Tracking Implementation

#### File: `src/lib/tracking/viewTracker.ts`

```typescript
/**
 * Listing View Tracker
 *
 * Tracks when users view listing detail pages.
 * Deduplicates views per session per day to avoid inflation.
 */

interface ViewTrackingData {
  listingId: number;
  userId?: string;
  sessionId: string;
  referrer: 'browse' | 'search' | 'direct' | 'external' | 'alert';
}

export async function trackListingView(data: ViewTrackingData): Promise<void> {
  try {
    await fetch('/api/track/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Silently fail - tracking should never break UX
    console.error('View tracking failed:', error);
  }
}

export function getViewReferrer(): ViewTrackingData['referrer'] {
  if (typeof window === 'undefined') return 'direct';

  const referrer = document.referrer;
  const currentHost = window.location.host;

  if (!referrer) return 'direct';

  try {
    const referrerUrl = new URL(referrer);
    if (referrerUrl.host !== currentHost) return 'external';
    if (referrerUrl.pathname.includes('/browse')) return 'browse';
    if (referrerUrl.pathname.includes('/search')) return 'search';
    if (referrerUrl.searchParams.has('from_alert')) return 'alert';
  } catch {
    return 'direct';
  }

  return 'direct';
}
```

#### File: `src/lib/tracking/searchTracker.ts`

```typescript
/**
 * Search Tracker
 *
 * Tracks search queries and their outcomes.
 */

interface SearchTrackingData {
  query: string;
  filters: {
    itemType?: string;
    dealer?: string;
    certification?: string;
    priceMin?: number;
    priceMax?: number;
  };
  resultCount: number;
  userId?: string;
  sessionId: string;
}

export async function trackSearch(data: SearchTrackingData): Promise<void> {
  // Don't track empty queries
  if (!data.query.trim()) return;

  try {
    await fetch('/api/track/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Search tracking failed:', error);
  }
}

export async function trackSearchClick(
  searchId: number,
  listingId: number
): Promise<void> {
  try {
    await fetch('/api/track/search-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchId, listingId }),
    });
  } catch (error) {
    console.error('Search click tracking failed:', error);
  }
}
```

### 1.3 Tracking API Endpoints

#### File: `src/app/api/track/view/route.ts`

```typescript
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, userId, sessionId, referrer } = body;

    if (!listingId || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Upsert to deduplicate views per session per day
    const { error } = await supabase
      .from('listing_views')
      .upsert(
        {
          listing_id: listingId,
          user_id: userId || null,
          session_id: sessionId,
          referrer,
          viewed_at: new Date().toISOString(),
        },
        {
          onConflict: 'listing_id,session_id,DATE(viewed_at)',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      logger.error('View tracking insert failed', { error });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('View tracking error', { error });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
```

#### File: `src/app/api/track/search/route.ts`

```typescript
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, filters, resultCount, userId, sessionId } = body;

    if (!query || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('user_searches')
      .insert({
        query,
        query_normalized: query.toLowerCase().trim(),
        filters: filters || {},
        result_count: resultCount,
        user_id: userId || null,
        session_id: sessionId,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Search tracking insert failed', { error });
      return NextResponse.json({ success: false }, { status: 500 });
    }

    // Return search ID so we can track clicks
    return NextResponse.json({ success: true, searchId: data?.id });
  } catch (error) {
    logger.error('Search tracking error', { error });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
```

---

## Phase 2: Analytics API Endpoints

### 2.1 Shared Utilities

#### File: `src/app/api/admin/analytics/engagement/_lib/utils.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export interface EngagementPeriod {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
}

/**
 * Calculate date ranges for current period and comparison period
 */
export function calculatePeriodDates(period: string): EngagementPeriod {
  const endDate = new Date();
  const startDate = new Date();

  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  startDate.setDate(startDate.getDate() - days);

  // Previous period for comparison
  const previousEndDate = new Date(startDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousStartDate = new Date(previousEndDate);
  previousStartDate.setDate(previousStartDate.getDate() - days);

  return { startDate, endDate, previousStartDate, previousEndDate };
}

/**
 * Verify admin authentication
 */
export async function verifyAdminAuth(
  supabase: SupabaseClient
): Promise<{ isAdmin: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, error: 'unauthorized' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return { isAdmin: false, error: 'forbidden' };
  }

  return { isAdmin: true };
}

/**
 * Standard success response with caching
 */
export function successResponse<T>(data: T, cacheSeconds: number = 60): NextResponse {
  return NextResponse.json(
    { success: true, data, timestamp: new Date().toISOString() },
    {
      headers: cacheSeconds > 0
        ? { 'Cache-Control': `private, max-age=${cacheSeconds}` }
        : {},
    }
  );
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    { success: false, error: message, timestamp: new Date().toISOString() },
    { status }
  );
}

/**
 * Calculate percentage change between two values
 */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}
```

### 2.2 Overview Endpoint

#### File: `src/app/api/admin/analytics/engagement/overview/route.ts`

```typescript
/**
 * Engagement Overview API
 *
 * Returns high-level user engagement metrics:
 * - Total users, new users, active users
 * - Session statistics (count, duration, page views, bounce rate)
 * - Period-over-period comparisons
 *
 * @route GET /api/admin/analytics/engagement/overview
 * @query period - 7d | 30d | 90d (default 30d)
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import {
  calculatePeriodDates,
  verifyAdminAuth,
  successResponse,
  errorResponse,
  percentChange,
} from '../_lib/utils';

export const dynamic = 'force-dynamic';

export interface EngagementOverview {
  users: {
    total: number;
    newInPeriod: number;
    newPrevPeriod: number;
    changePercent: number;
    activeToday: number;
    activeInPeriod: number;
  };
  sessions: {
    total: number;
    avgDurationSeconds: number;
    avgPageViews: number;
    bounceRate: number;
    totalPrevPeriod: number;
    changePercent: number;
  };
  engagement: {
    totalViews: number;
    totalSearches: number;
    totalFavorites: number;
    viewsPrevPeriod: number;
    searchesPrevPeriod: number;
    favoritesPrevPeriod: number;
  };
  asOf: string;
  period: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    // Verify admin
    const auth = await verifyAdminAuth(supabase);
    if (!auth.isAdmin) {
      return errorResponse(auth.error || 'Unauthorized', auth.error === 'unauthorized' ? 401 : 403);
    }

    // Parse period
    const period = request.nextUrl.searchParams.get('period') || '30d';
    const dates = calculatePeriodDates(period);

    // Execute all queries in parallel
    const [
      totalUsersResult,
      newUsersResult,
      prevNewUsersResult,
      activeUsersResult,
      activeTodayResult,
      sessionsResult,
      prevSessionsResult,
      viewsResult,
      prevViewsResult,
      searchesResult,
      prevSearchesResult,
      favoritesResult,
      prevFavoritesResult,
    ] = await Promise.all([
      // Total users
      supabase.from('profiles').select('id', { count: 'exact', head: true }),

      // New users in period
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.startDate.toISOString()),

      // New users in previous period
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.previousStartDate.toISOString())
        .lt('created_at', dates.startDate.toISOString()),

      // Active users in period (any activity)
      serviceSupabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('started_at', dates.startDate.toISOString())
        .not('user_id', 'is', null),

      // Active users today
      serviceSupabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .not('user_id', 'is', null),

      // Sessions in period
      serviceSupabase
        .from('user_sessions')
        .select('total_duration_ms, page_views, is_bounce')
        .gte('started_at', dates.startDate.toISOString()),

      // Sessions in previous period
      serviceSupabase
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', dates.previousStartDate.toISOString())
        .lt('started_at', dates.startDate.toISOString()),

      // Views in period
      serviceSupabase
        .from('listing_views')
        .select('id', { count: 'exact', head: true })
        .gte('viewed_at', dates.startDate.toISOString()),

      // Views in previous period
      serviceSupabase
        .from('listing_views')
        .select('id', { count: 'exact', head: true })
        .gte('viewed_at', dates.previousStartDate.toISOString())
        .lt('viewed_at', dates.startDate.toISOString()),

      // Searches in period
      serviceSupabase
        .from('user_searches')
        .select('id', { count: 'exact', head: true })
        .gte('searched_at', dates.startDate.toISOString()),

      // Searches in previous period
      serviceSupabase
        .from('user_searches')
        .select('id', { count: 'exact', head: true })
        .gte('searched_at', dates.previousStartDate.toISOString())
        .lt('searched_at', dates.startDate.toISOString()),

      // Favorites in period
      supabase
        .from('user_favorites')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.startDate.toISOString()),

      // Favorites in previous period
      supabase
        .from('user_favorites')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.previousStartDate.toISOString())
        .lt('created_at', dates.startDate.toISOString()),
    ]);

    // Calculate session stats
    const sessions = sessionsResult.data || [];
    const totalSessions = sessions.length;
    const totalDurationMs = sessions.reduce((sum, s) => sum + (s.total_duration_ms || 0), 0);
    const totalPageViews = sessions.reduce((sum, s) => sum + (s.page_views || 0), 0);
    const bounces = sessions.filter(s => s.is_bounce).length;

    const overview: EngagementOverview = {
      users: {
        total: totalUsersResult.count || 0,
        newInPeriod: newUsersResult.count || 0,
        newPrevPeriod: prevNewUsersResult.count || 0,
        changePercent: percentChange(newUsersResult.count || 0, prevNewUsersResult.count || 0),
        activeToday: activeTodayResult.count || 0,
        activeInPeriod: activeUsersResult.count || 0,
      },
      sessions: {
        total: totalSessions,
        avgDurationSeconds: totalSessions > 0 ? Math.round(totalDurationMs / totalSessions / 1000) : 0,
        avgPageViews: totalSessions > 0 ? Math.round((totalPageViews / totalSessions) * 10) / 10 : 0,
        bounceRate: totalSessions > 0 ? Math.round((bounces / totalSessions) * 100) : 0,
        totalPrevPeriod: prevSessionsResult.count || 0,
        changePercent: percentChange(totalSessions, prevSessionsResult.count || 0),
      },
      engagement: {
        totalViews: viewsResult.count || 0,
        totalSearches: searchesResult.count || 0,
        totalFavorites: favoritesResult.count || 0,
        viewsPrevPeriod: prevViewsResult.count || 0,
        searchesPrevPeriod: prevSearchesResult.count || 0,
        favoritesPrevPeriod: prevFavoritesResult.count || 0,
      },
      asOf: new Date().toISOString(),
      period,
    };

    return successResponse(overview, 60); // Cache for 1 minute
  } catch (error) {
    logger.logError('Engagement overview API error', error);
    return errorResponse('Internal server error', 500);
  }
}
```

### 2.3 User Growth Endpoint

#### File: `src/app/api/admin/analytics/engagement/growth/route.ts`

```typescript
/**
 * User Growth API
 *
 * Returns time series data for user signups.
 *
 * @route GET /api/admin/analytics/engagement/growth
 * @query period - 7d | 30d | 90d | 1y (default 90d)
 * @query granularity - daily | weekly | monthly (default daily)
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdminAuth, successResponse, errorResponse } from '../_lib/utils';

export const dynamic = 'force-dynamic';

export interface GrowthDataPoint {
  date: string;
  newUsers: number;
  cumulativeUsers: number;
}

export interface GrowthResponse {
  dataPoints: GrowthDataPoint[];
  summary: {
    totalNewUsers: number;
    avgDailySignups: number;
    peakDay: string | null;
    peakCount: number;
  };
  period: string;
  granularity: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const auth = await verifyAdminAuth(supabase);
    if (!auth.isAdmin) {
      return errorResponse(auth.error || 'Unauthorized', auth.error === 'unauthorized' ? 401 : 403);
    }

    const period = request.nextUrl.searchParams.get('period') || '90d';
    const granularity = request.nextUrl.searchParams.get('granularity') || 'daily';

    // Calculate start date
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '1y' ? 365 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all users with their signup dates
    const { data: users, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Growth query error', { error });
      return errorResponse('Failed to fetch growth data', 500);
    }

    // Get total users before start date for cumulative calculation
    const { count: usersBeforePeriod } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', startDate.toISOString());

    // Aggregate by date
    const dateMap = new Map<string, number>();

    for (const user of users || []) {
      const date = new Date(user.created_at);
      let key: string;

      switch (granularity) {
        case 'weekly': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      dateMap.set(key, (dateMap.get(key) || 0) + 1);
    }

    // Fill in missing dates and calculate cumulative
    const dataPoints: GrowthDataPoint[] = [];
    let cumulative = usersBeforePeriod || 0;
    let peakDay: string | null = null;
    let peakCount = 0;

    const currentDate = new Date(startDate);
    const endDate = new Date();

    while (currentDate <= endDate) {
      const key = currentDate.toISOString().split('T')[0];
      const newUsers = dateMap.get(key) || 0;
      cumulative += newUsers;

      dataPoints.push({
        date: key,
        newUsers,
        cumulativeUsers: cumulative,
      });

      if (newUsers > peakCount) {
        peakCount = newUsers;
        peakDay = key;
      }

      // Advance date based on granularity
      switch (granularity) {
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        default:
          currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const totalNewUsers = users?.length || 0;

    const response: GrowthResponse = {
      dataPoints,
      summary: {
        totalNewUsers,
        avgDailySignups: Math.round((totalNewUsers / days) * 10) / 10,
        peakDay,
        peakCount,
      },
      period,
      granularity,
    };

    return successResponse(response, 300); // Cache for 5 minutes
  } catch (error) {
    logger.logError('User growth API error', error);
    return errorResponse('Internal server error', 500);
  }
}
```

### 2.4 Popular Searches Endpoint

#### File: `src/app/api/admin/analytics/engagement/searches/route.ts`

```typescript
/**
 * Popular Searches API
 *
 * Returns aggregated search query data.
 *
 * @route GET /api/admin/analytics/engagement/searches
 * @query period - 7d | 30d | 90d (default 30d)
 * @query limit - Max results (default 20, max 100)
 */

import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdminAuth, successResponse, errorResponse, calculatePeriodDates } from '../_lib/utils';

export const dynamic = 'force-dynamic';

export interface SearchTermData {
  term: string;
  count: number;
  uniqueUsers: number;
  avgResultCount: number;
  clickThroughRate: number;  // % of searches that led to a listing click
}

export interface SearchesResponse {
  searches: SearchTermData[];
  totals: {
    totalSearches: number;
    uniqueSearchers: number;
    avgClickThroughRate: number;
  };
  period: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const auth = await verifyAdminAuth(supabase);
    if (!auth.isAdmin) {
      return errorResponse(auth.error || 'Unauthorized', auth.error === 'unauthorized' ? 401 : 403);
    }

    const period = request.nextUrl.searchParams.get('period') || '30d';
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 100);
    const dates = calculatePeriodDates(period);

    // Get all searches in period
    const { data: searches, error } = await serviceSupabase
      .from('user_searches')
      .select('query_normalized, user_id, session_id, result_count, clicked_listing_id')
      .gte('searched_at', dates.startDate.toISOString())
      .limit(10000);

    if (error) {
      logger.error('Searches query error', { error });
      return errorResponse('Failed to fetch search data', 500);
    }

    // Aggregate by normalized query
    const termMap = new Map<string, {
      count: number;
      users: Set<string>;
      totalResults: number;
      clicks: number;
    }>();

    for (const search of searches || []) {
      const term = search.query_normalized;
      if (!term) continue;

      if (!termMap.has(term)) {
        termMap.set(term, { count: 0, users: new Set(), totalResults: 0, clicks: 0 });
      }

      const data = termMap.get(term)!;
      data.count++;
      data.totalResults += search.result_count || 0;
      if (search.user_id) data.users.add(search.user_id);
      else if (search.session_id) data.users.add(`session:${search.session_id}`);
      if (search.clicked_listing_id) data.clicks++;
    }

    // Convert to array and sort
    const searchTerms: SearchTermData[] = Array.from(termMap.entries())
      .map(([term, data]) => ({
        term,
        count: data.count,
        uniqueUsers: data.users.size,
        avgResultCount: data.count > 0 ? Math.round(data.totalResults / data.count) : 0,
        clickThroughRate: data.count > 0 ? Math.round((data.clicks / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Calculate totals
    const totalSearches = searches?.length || 0;
    const uniqueSearchers = new Set(
      (searches || []).map(s => s.user_id || `session:${s.session_id}`)
    ).size;
    const totalClicks = (searches || []).filter(s => s.clicked_listing_id).length;

    const response: SearchesResponse = {
      searches: searchTerms,
      totals: {
        totalSearches,
        uniqueSearchers,
        avgClickThroughRate: totalSearches > 0 ? Math.round((totalClicks / totalSearches) * 100) : 0,
      },
      period,
    };

    return successResponse(response, 300);
  } catch (error) {
    logger.logError('Popular searches API error', error);
    return errorResponse('Internal server error', 500);
  }
}
```

### 2.5 Conversion Funnel Endpoint

#### File: `src/app/api/admin/analytics/engagement/funnel/route.ts`

```typescript
/**
 * Conversion Funnel API
 *
 * Returns conversion funnel data showing user journey stages.
 *
 * @route GET /api/admin/analytics/engagement/funnel
 * @query period - 7d | 30d | 90d (default 30d)
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdminAuth, successResponse, errorResponse, calculatePeriodDates } from '../_lib/utils';

export const dynamic = 'force-dynamic';

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversionRate: number;  // % from previous stage
  dropoffRate: number;     // % that didn't convert
}

export interface FunnelResponse {
  stages: FunnelStage[];
  overallConversionRate: number;  // First stage to last stage
  period: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const auth = await verifyAdminAuth(supabase);
    if (!auth.isAdmin) {
      return errorResponse(auth.error || 'Unauthorized', auth.error === 'unauthorized' ? 401 : 403);
    }

    const period = request.nextUrl.searchParams.get('period') || '30d';
    const dates = calculatePeriodDates(period);

    // Get all funnel metrics in parallel
    const [
      sessionsResult,
      searchesResult,
      viewsResult,
      favoritesResult,
      savedSearchesResult,
      inquiriesResult,
    ] = await Promise.all([
      // Stage 1: Visitors (sessions)
      serviceSupabase
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', dates.startDate.toISOString()),

      // Stage 2: Searchers
      serviceSupabase
        .from('user_searches')
        .select('session_id', { count: 'exact', head: true })
        .gte('searched_at', dates.startDate.toISOString()),

      // Stage 3: Viewers (viewed a listing)
      serviceSupabase
        .from('listing_views')
        .select('session_id', { count: 'exact', head: true })
        .gte('viewed_at', dates.startDate.toISOString()),

      // Stage 4: Engagers (favorited)
      supabase
        .from('user_favorites')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.startDate.toISOString()),

      // Stage 5: High Intent (saved search)
      supabase
        .from('saved_searches')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.startDate.toISOString()),

      // Stage 6: Converted (inquiry sent) - check if inquiry_emails table exists
      serviceSupabase
        .from('inquiry_emails')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.startDate.toISOString()),
    ]);

    const visitors = sessionsResult.count || 0;
    const searchers = searchesResult.count || 0;
    const viewers = viewsResult.count || 0;
    const engagers = favoritesResult.count || 0;
    const highIntent = savedSearchesResult.count || 0;
    const converted = inquiriesResult.count || 0;

    const stages: FunnelStage[] = [
      {
        stage: 'visitors',
        label: 'Visitors',
        count: visitors,
        conversionRate: 100,
        dropoffRate: 0,
      },
      {
        stage: 'searchers',
        label: 'Searched',
        count: searchers,
        conversionRate: visitors > 0 ? Math.round((searchers / visitors) * 100) : 0,
        dropoffRate: visitors > 0 ? Math.round(((visitors - searchers) / visitors) * 100) : 0,
      },
      {
        stage: 'viewers',
        label: 'Viewed Listing',
        count: viewers,
        conversionRate: searchers > 0 ? Math.round((viewers / searchers) * 100) : 0,
        dropoffRate: searchers > 0 ? Math.round(((searchers - viewers) / searchers) * 100) : 0,
      },
      {
        stage: 'engagers',
        label: 'Favorited',
        count: engagers,
        conversionRate: viewers > 0 ? Math.round((engagers / viewers) * 100) : 0,
        dropoffRate: viewers > 0 ? Math.round(((viewers - engagers) / viewers) * 100) : 0,
      },
      {
        stage: 'high_intent',
        label: 'Saved Search',
        count: highIntent,
        conversionRate: engagers > 0 ? Math.round((highIntent / engagers) * 100) : 0,
        dropoffRate: engagers > 0 ? Math.round(((engagers - highIntent) / engagers) * 100) : 0,
      },
      {
        stage: 'converted',
        label: 'Sent Inquiry',
        count: converted,
        conversionRate: highIntent > 0 ? Math.round((converted / highIntent) * 100) : 0,
        dropoffRate: highIntent > 0 ? Math.round(((highIntent - converted) / highIntent) * 100) : 0,
      },
    ];

    const response: FunnelResponse = {
      stages,
      overallConversionRate: visitors > 0 ? Math.round((converted / visitors) * 100 * 100) / 100 : 0,
      period,
    };

    return successResponse(response, 300);
  } catch (error) {
    logger.logError('Conversion funnel API error', error);
    return errorResponse('Internal server error', 500);
  }
}
```

### 2.6 Top Listings Endpoint

#### File: `src/app/api/admin/analytics/engagement/top-listings/route.ts`

```typescript
/**
 * Top Listings API
 *
 * Returns most viewed/favorited listings.
 *
 * @route GET /api/admin/analytics/engagement/top-listings
 * @query period - 7d | 30d | 90d (default 30d)
 * @query limit - Max results (default 10, max 50)
 * @query sortBy - views | favorites (default views)
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdminAuth, successResponse, errorResponse, calculatePeriodDates } from '../_lib/utils';

export const dynamic = 'force-dynamic';

export interface TopListing {
  id: number;
  title: string;
  itemType: string;
  dealerName: string;
  views: number;
  uniqueViewers: number;
  favorites: number;
  priceJPY: number | null;
}

export interface TopListingsResponse {
  listings: TopListing[];
  period: string;
  sortedBy: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const auth = await verifyAdminAuth(supabase);
    if (!auth.isAdmin) {
      return errorResponse(auth.error || 'Unauthorized', auth.error === 'unauthorized' ? 401 : 403);
    }

    const period = request.nextUrl.searchParams.get('period') || '30d';
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10'), 50);
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'views';
    const dates = calculatePeriodDates(period);

    // Get views aggregated by listing
    const { data: views, error: viewsError } = await serviceSupabase
      .from('listing_views')
      .select('listing_id, session_id')
      .gte('viewed_at', dates.startDate.toISOString());

    if (viewsError) {
      logger.error('Views query error', { error: viewsError });
    }

    // Aggregate views
    const viewsMap = new Map<number, { total: number; unique: Set<string> }>();
    for (const view of views || []) {
      if (!viewsMap.has(view.listing_id)) {
        viewsMap.set(view.listing_id, { total: 0, unique: new Set() });
      }
      const data = viewsMap.get(view.listing_id)!;
      data.total++;
      if (view.session_id) data.unique.add(view.session_id);
    }

    // Get favorites aggregated by listing
    const { data: favorites, error: favError } = await supabase
      .from('user_favorites')
      .select('listing_id')
      .gte('created_at', dates.startDate.toISOString());

    if (favError) {
      logger.error('Favorites query error', { error: favError });
    }

    // Aggregate favorites
    const favoritesMap = new Map<number, number>();
    for (const fav of favorites || []) {
      favoritesMap.set(fav.listing_id, (favoritesMap.get(fav.listing_id) || 0) + 1);
    }

    // Combine and get top listing IDs
    const allListingIds = new Set([...viewsMap.keys(), ...favoritesMap.keys()]);
    const combinedData = Array.from(allListingIds).map(id => ({
      id,
      views: viewsMap.get(id)?.total || 0,
      uniqueViewers: viewsMap.get(id)?.unique.size || 0,
      favorites: favoritesMap.get(id) || 0,
    }));

    // Sort by requested metric
    combinedData.sort((a, b) => {
      if (sortBy === 'favorites') return b.favorites - a.favorites;
      return b.views - a.views;
    });

    const topIds = combinedData.slice(0, limit).map(d => d.id);

    // Fetch listing details
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        item_type,
        price_value,
        dealers (name)
      `)
      .in('id', topIds);

    if (listingsError) {
      logger.error('Listings query error', { error: listingsError });
      return errorResponse('Failed to fetch listings', 500);
    }

    // Create lookup map
    const listingsMap = new Map(
      (listings || []).map(l => [l.id, l])
    );

    // Build response
    const topListings: TopListing[] = combinedData.slice(0, limit).map(data => {
      const listing = listingsMap.get(data.id);
      return {
        id: data.id,
        title: listing?.title || `Listing #${data.id}`,
        itemType: listing?.item_type || 'unknown',
        dealerName: (listing?.dealers as { name: string } | null)?.name || 'Unknown',
        views: data.views,
        uniqueViewers: data.uniqueViewers,
        favorites: data.favorites,
        priceJPY: listing?.price_value || null,
      };
    });

    const response: TopListingsResponse = {
      listings: topListings,
      period,
      sortedBy: sortBy,
    };

    return successResponse(response, 300);
  } catch (error) {
    logger.logError('Top listings API error', error);
    return errorResponse('Internal server error', 500);
  }
}
```

---

## Phase 3: Frontend Implementation

### 3.1 Custom Hook

#### File: `src/hooks/useUserEngagement.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import type { EngagementOverview } from '@/app/api/admin/analytics/engagement/overview/route';
import type { GrowthResponse } from '@/app/api/admin/analytics/engagement/growth/route';
import type { SearchesResponse } from '@/app/api/admin/analytics/engagement/searches/route';
import type { FunnelResponse } from '@/app/api/admin/analytics/engagement/funnel/route';
import type { TopListingsResponse } from '@/app/api/admin/analytics/engagement/top-listings/route';

interface EngagementData {
  overview: EngagementOverview | null;
  growth: GrowthResponse | null;
  searches: SearchesResponse | null;
  funnel: FunnelResponse | null;
  topListings: TopListingsResponse | null;
}

interface LoadingState {
  overview: boolean;
  growth: boolean;
  searches: boolean;
  funnel: boolean;
  topListings: boolean;
}

interface ErrorState {
  overview: string | null;
  growth: string | null;
  searches: string | null;
  funnel: string | null;
  topListings: string | null;
}

interface UseUserEngagementOptions {
  period: '7d' | '30d' | '90d';
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseUserEngagementReturn {
  data: EngagementData;
  loading: LoadingState;
  errors: ErrorState;
  refreshAll: () => Promise<void>;
  isLoading: boolean;
  hasErrors: boolean;
  lastUpdated: Date | null;
}

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Unknown error');
  }
  return result.data;
}

export function useUserEngagement(options: UseUserEngagementOptions): UseUserEngagementReturn {
  const { period, autoRefresh = false, refreshInterval = 300000 } = options;

  const [data, setData] = useState<EngagementData>({
    overview: null,
    growth: null,
    searches: null,
    funnel: null,
    topListings: null,
  });

  const [loading, setLoading] = useState<LoadingState>({
    overview: true,
    growth: true,
    searches: true,
    funnel: true,
    topListings: true,
  });

  const [errors, setErrors] = useState<ErrorState>({
    overview: null,
    growth: null,
    searches: null,
    funnel: null,
    topListings: null,
  });

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isMountedRef = useRef(true);

  const fetchEndpoint = useCallback(async <T,>(
    key: keyof EngagementData,
    endpoint: string
  ) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: null }));

    try {
      const result = await fetchData<T>(`${endpoint}?period=${period}`);
      if (isMountedRef.current) {
        setData(prev => ({ ...prev, [key]: result }));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setErrors(prev => ({
          ...prev,
          [key]: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    }
  }, [period]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchEndpoint<EngagementOverview>('overview', '/api/admin/analytics/engagement/overview'),
      fetchEndpoint<GrowthResponse>('growth', '/api/admin/analytics/engagement/growth'),
      fetchEndpoint<SearchesResponse>('searches', '/api/admin/analytics/engagement/searches'),
      fetchEndpoint<FunnelResponse>('funnel', '/api/admin/analytics/engagement/funnel'),
      fetchEndpoint<TopListingsResponse>('topListings', '/api/admin/analytics/engagement/top-listings'),
    ]);

    if (isMountedRef.current) {
      setLastUpdated(new Date());
    }
  }, [fetchEndpoint]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const intervalId = setInterval(refreshAll, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, refreshAll]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const isLoading = Object.values(loading).some(Boolean);
  const hasErrors = Object.values(errors).some(Boolean);

  return {
    data,
    loading,
    errors,
    refreshAll,
    isLoading,
    hasErrors,
    lastUpdated,
  };
}
```

### 3.2 New Components

#### File: `src/components/admin/analytics/ConversionFunnelChart.tsx`

```typescript
'use client';

import React from 'react';
import type { FunnelStage } from '@/app/api/admin/analytics/engagement/funnel/route';
import { ChartSkeleton } from './ChartSkeleton';

interface ConversionFunnelChartProps {
  stages: FunnelStage[];
  loading?: boolean;
  height?: number;
}

export function ConversionFunnelChart({
  stages,
  loading = false,
  height = 400,
}: ConversionFunnelChartProps) {
  if (loading) {
    return <ChartSkeleton height={height} type="bar" />;
  }

  if (!stages || stages.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-linen rounded-lg border border-border border-dashed"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-muted text-sm">No funnel data available</p>
        </div>
      </div>
    );
  }

  const maxCount = stages[0]?.count || 1;

  return (
    <div className="space-y-3" style={{ minHeight: height }}>
      {stages.map((stage, index) => {
        const widthPercent = (stage.count / maxCount) * 100;
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.stage} className="relative">
            {/* Stage bar */}
            <div className="flex items-center gap-4">
              <div className="w-28 text-right">
                <p className="text-sm font-medium text-ink">{stage.label}</p>
              </div>
              <div className="flex-1 h-10 bg-linen rounded-lg overflow-hidden">
                <div
                  className="h-full bg-gold/80 rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                  style={{ width: `${widthPercent}%` }}
                >
                  <span className="text-sm font-medium text-white tabular-nums">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-20 text-right">
                {index > 0 && (
                  <span className={`text-sm tabular-nums ${
                    stage.conversionRate >= 50 ? 'text-success' :
                    stage.conversionRate >= 20 ? 'text-gold' : 'text-error'
                  }`}>
                    {stage.conversionRate}%
                  </span>
                )}
              </div>
            </div>

            {/* Dropoff indicator */}
            {!isLast && stage.dropoffRate > 0 && (
              <div className="ml-32 pl-4 py-1">
                <span className="text-xs text-muted">
                  ↓ {stage.dropoffRate}% drop-off
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

#### File: `src/components/admin/analytics/UserGrowthChart.tsx`

```typescript
'use client';

import React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { GrowthDataPoint } from '@/app/api/admin/analytics/engagement/growth/route';
import { ChartSkeleton } from './ChartSkeleton';

interface UserGrowthChartProps {
  dataPoints: GrowthDataPoint[];
  loading?: boolean;
  height?: number;
  showCumulative?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: GrowthDataPoint }>;
  label?: string;
}) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-paper border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted mb-2">
        {new Date(data.date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
      <div className="space-y-1 text-xs">
        <p className="text-charcoal">
          <span className="text-muted">New users:</span>{' '}
          <span className="font-medium tabular-nums">{data.newUsers}</span>
        </p>
        <p className="text-charcoal">
          <span className="text-muted">Total users:</span>{' '}
          <span className="font-medium tabular-nums">{data.cumulativeUsers.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}

export function UserGrowthChart({
  dataPoints,
  loading = false,
  height = 300,
  showCumulative = true,
}: UserGrowthChartProps) {
  if (loading) {
    return <ChartSkeleton height={height} type="line" />;
  }

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-linen rounded-lg border border-border border-dashed"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-muted text-sm">No growth data available</p>
        </div>
      </div>
    );
  }

  const chartData = dataPoints.map(point => ({
    ...point,
    formattedDate: formatDate(point.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={chartData}
        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
      >
        <XAxis
          dataKey="formattedDate"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        {showCumulative && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="newUsers"
          name="New Users"
          fill="var(--accent)"
          fillOpacity={0.8}
          radius={[2, 2, 0, 0]}
        />
        {showCumulative && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulativeUsers"
            name="Total Users"
            stroke="var(--text-secondary)"
            strokeWidth={2}
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

#### File: `src/components/admin/analytics/SearchTermsTable.tsx`

```typescript
'use client';

import React from 'react';
import type { SearchTermData } from '@/app/api/admin/analytics/engagement/searches/route';

interface SearchTermsTableProps {
  searches: SearchTermData[];
  loading?: boolean;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3"><div className="h-4 w-6 bg-linen rounded animate-shimmer" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-linen rounded animate-shimmer" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 bg-linen rounded animate-shimmer" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 bg-linen rounded animate-shimmer" /></td>
      <td className="px-4 py-3"><div className="h-4 w-12 bg-linen rounded animate-shimmer" /></td>
    </tr>
  );
}

export function SearchTermsTable({ searches, loading = false }: SearchTermsTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium w-12">#</th>
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium">Search Term</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">Searches</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">Avg Results</th>
              <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">CTR</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </tbody>
        </table>
      </div>
    );
  }

  if (!searches || searches.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 bg-linen rounded-lg border border-border border-dashed">
        <p className="text-muted text-sm">No search data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium w-12">#</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted font-medium">Search Term</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">Searches</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">Avg Results</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted font-medium">CTR</th>
          </tr>
        </thead>
        <tbody>
          {searches.map((search, index) => (
            <tr key={search.term} className="border-b border-border hover:bg-hover transition-colors">
              <td className="px-4 py-3 text-sm text-muted tabular-nums">{index + 1}</td>
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-ink">{search.term}</span>
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums text-charcoal">
                {search.count.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums text-charcoal">
                {search.avgResultCount}
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`text-sm tabular-nums ${
                  search.clickThroughRate >= 30 ? 'text-success' :
                  search.clickThroughRate >= 10 ? 'text-gold' : 'text-muted'
                }`}>
                  {search.clickThroughRate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3.3 Rewritten Page

#### File: `src/app/admin/analytics/page.tsx` (Complete Rewrite)

```typescript
'use client';

import { useState, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import { MetricCard, ChartSkeleton } from '@/components/admin/analytics';
import { useUserEngagement } from '@/hooks/useUserEngagement';

// Lazy load chart components
const UserGrowthChart = lazy(() =>
  import('@/components/admin/analytics/UserGrowthChart').then(mod => ({
    default: mod.UserGrowthChart,
  }))
);

const ConversionFunnelChart = lazy(() =>
  import('@/components/admin/analytics/ConversionFunnelChart').then(mod => ({
    default: mod.ConversionFunnelChart,
  }))
);

const SearchTermsTable = lazy(() =>
  import('@/components/admin/analytics/SearchTermsTable').then(mod => ({
    default: mod.SearchTermsTable,
  }))
);

// Icons
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function RefreshIcon({ className, spinning }: { className?: string; spinning?: boolean }) {
  return (
    <svg className={`${className} ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return 'Never';
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

type Period = '7d' | '30d' | '90d';

export default function UserEngagementAnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('30d');

  const {
    data,
    loading,
    errors,
    refreshAll,
    isLoading,
    lastUpdated,
  } = useUserEngagement({ period });

  const overview = data.overview;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-ink">User Engagement</h1>
          <p className="text-muted text-sm mt-1">
            User behavior, engagement metrics, and conversion analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                disabled={isLoading}
                className={`px-3 py-2 text-sm font-medium transition-colors border-r border-border last:border-r-0
                  ${period === p ? 'bg-gold text-white' : 'bg-cream text-charcoal hover:bg-linen'}
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          {/* Last updated */}
          <span className="text-xs text-muted hidden sm:inline">
            {formatLastUpdated(lastUpdated)}
          </span>

          {/* Refresh */}
          <button
            onClick={() => refreshAll()}
            disabled={isLoading}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors
              ${isLoading ? 'bg-linen border-border text-muted cursor-not-allowed' : 'bg-cream border-border text-charcoal hover:bg-linen'}`}
          >
            <RefreshIcon className="w-4 h-4" spinning={isLoading} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={overview?.users.total ?? 0}
          format="number"
          subtitle={`+${overview?.users.newInPeriod ?? 0} this period`}
          change={overview?.users.changePercent !== undefined ? {
            value: overview.users.newInPeriod - overview.users.newPrevPeriod,
            percent: overview.users.changePercent,
            period: `vs prev ${period}`,
          } : undefined}
          icon={<UsersIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Active Today"
          value={overview?.users.activeToday ?? 0}
          format="number"
          subtitle={`${overview?.users.activeInPeriod ?? 0} active this period`}
          icon={<ActivityIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Avg Session"
          value={overview?.sessions.avgDurationSeconds ? formatDuration(overview.sessions.avgDurationSeconds) : '0s'}
          subtitle={`${overview?.sessions.avgPageViews ?? 0} pages per session`}
          icon={<ClockIcon className="w-6 h-6" />}
          loading={loading.overview}
        />

        <MetricCard
          title="Total Searches"
          value={overview?.engagement.totalSearches ?? 0}
          format="number"
          subtitle={`${overview?.engagement.totalViews ?? 0} listing views`}
          icon={<SearchIcon className="w-6 h-6" />}
          loading={loading.overview}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Growth */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <h2 className="font-serif text-lg text-ink mb-4">User Growth</h2>
          {errors.growth ? (
            <ErrorDisplay message={errors.growth} />
          ) : (
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <UserGrowthChart
                dataPoints={data.growth?.dataPoints ?? []}
                loading={loading.growth}
                height={300}
              />
            </Suspense>
          )}
          {data.growth?.summary && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted uppercase">New Users</p>
                <p className="text-sm font-serif text-ink">{data.growth.summary.totalNewUsers}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase">Avg Daily</p>
                <p className="text-sm font-serif text-ink">{data.growth.summary.avgDailySignups}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase">Peak Day</p>
                <p className="text-sm font-serif text-ink">{data.growth.summary.peakCount}</p>
              </div>
            </div>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <h2 className="font-serif text-lg text-ink mb-4">Conversion Funnel</h2>
          {errors.funnel ? (
            <ErrorDisplay message={errors.funnel} />
          ) : (
            <Suspense fallback={<ChartSkeleton height={400} />}>
              <ConversionFunnelChart
                stages={data.funnel?.stages ?? []}
                loading={loading.funnel}
                height={400}
              />
            </Suspense>
          )}
          {data.funnel && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted">
                Overall conversion: <span className="font-medium text-ink">{data.funnel.overallConversionRate}%</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Popular Searches */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Popular Searches</h2>
            {data.searches?.totals && (
              <span className="text-xs text-muted">
                {data.searches.totals.totalSearches.toLocaleString()} total
              </span>
            )}
          </div>
          {errors.searches ? (
            <div className="p-6"><ErrorDisplay message={errors.searches} /></div>
          ) : (
            <Suspense fallback={<div className="p-6"><ChartSkeleton height={200} /></div>}>
              <SearchTermsTable
                searches={data.searches?.searches ?? []}
                loading={loading.searches}
              />
            </Suspense>
          )}
        </div>

        {/* Top Listings */}
        <div className="bg-cream rounded-xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Most Viewed Listings</h2>
          </div>
          {errors.topListings ? (
            <div className="p-6"><ErrorDisplay message={errors.topListings} /></div>
          ) : loading.topListings ? (
            <div className="p-6"><ChartSkeleton height={200} /></div>
          ) : (
            <div className="divide-y divide-border">
              {(data.topListings?.listings ?? []).slice(0, 10).map((listing, index) => (
                <div
                  key={listing.id}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-hover cursor-pointer transition-colors"
                  onClick={() => router.push(`/listing/${listing.id}`)}
                >
                  <span className="text-lg font-serif text-muted w-6">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{listing.title}</p>
                    <p className="text-xs text-muted">{listing.dealerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums text-ink">{listing.views} views</p>
                    <p className="text-xs text-muted">{listing.favorites} favorites</p>
                  </div>
                </div>
              ))}
              {(data.topListings?.listings ?? []).length === 0 && (
                <div className="px-6 py-8 text-center text-muted text-sm">
                  No listing data available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] bg-error/5 rounded-lg border border-error/20">
      <div className="text-center">
        <p className="text-error text-sm font-medium">Error loading data</p>
        <p className="text-muted text-xs mt-1 max-w-xs">{message}</p>
      </div>
    </div>
  );
}
```

---

## Phase 4: Testing Strategy

### 4.1 Database Migration Tests

#### File: `tests/migrations/listing_views.test.ts`

```typescript
/**
 * Tests for listing_views table migration
 */

import { createServiceClient } from '@/lib/supabase/server';

describe('listing_views table', () => {
  const supabase = createServiceClient();

  it('should allow inserting a view record', async () => {
    const { error } = await supabase.from('listing_views').insert({
      listing_id: 1,
      session_id: 'test-session-123',
      referrer: 'browse',
    });

    expect(error).toBeNull();
  });

  it('should deduplicate views per session per day', async () => {
    const sessionId = `dedup-test-${Date.now()}`;

    // Insert first view
    await supabase.from('listing_views').insert({
      listing_id: 1,
      session_id: sessionId,
      referrer: 'browse',
    });

    // Insert duplicate (same listing, same session, same day)
    const { error } = await supabase.from('listing_views').insert({
      listing_id: 1,
      session_id: sessionId,
      referrer: 'search',
    });

    // Should either error or be ignored based on upsert config
    // Query should return only 1 record
    const { data, count } = await supabase
      .from('listing_views')
      .select('*', { count: 'exact' })
      .eq('listing_id', 1)
      .eq('session_id', sessionId);

    expect(count).toBe(1);
  });

  it('should allow views from different sessions', async () => {
    const listingId = 999;

    await supabase.from('listing_views').insert([
      { listing_id: listingId, session_id: 'session-a', referrer: 'browse' },
      { listing_id: listingId, session_id: 'session-b', referrer: 'search' },
      { listing_id: listingId, session_id: 'session-c', referrer: 'direct' },
    ]);

    const { count } = await supabase
      .from('listing_views')
      .select('*', { count: 'exact' })
      .eq('listing_id', listingId);

    expect(count).toBe(3);
  });
});
```

### 4.2 API Endpoint Tests

#### File: `tests/api/admin/analytics/engagement/overview.test.ts`

```typescript
/**
 * Tests for engagement overview API endpoint
 */

import { GET } from '@/app/api/admin/analytics/engagement/overview/route';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}));

describe('GET /api/admin/analytics/engagement/overview', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          gte: jest.fn(() => ({
            lt: jest.fn(() => Promise.resolve({ count: 10 })),
          })),
        })),
        gte: jest.fn(() => ({
          lt: jest.fn(() => Promise.resolve({ data: [], count: 0 })),
        })),
        not: jest.fn(() => ({
          gte: jest.fn(() => Promise.resolve({ count: 5 })),
        })),
        limit: jest.fn(() => Promise.resolve({ data: [] })),
      })),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('should return 401 for unauthenticated requests', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/overview');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin users', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { is_admin: false } }),
        }),
      }),
    });

    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/overview');
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it('should return overview data for admin users', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-123' } } });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockResolvedValue({ count: 10 }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({ data: [], count: 0 }),
            not: jest.fn().mockResolvedValue({ count: 5 }),
          }),
          limit: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });

    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/overview?period=30d');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('users');
    expect(body.data).toHaveProperty('sessions');
    expect(body.data).toHaveProperty('engagement');
    expect(body.data.period).toBe('30d');
  });

  it('should respect period parameter', async () => {
    // Setup admin mock
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-123' } } });
    // ... setup other mocks

    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/overview?period=7d');
    const response = await GET(request);
    const body = await response.json();

    expect(body.data.period).toBe('7d');
  });
});
```

#### File: `tests/api/admin/analytics/engagement/growth.test.ts`

```typescript
/**
 * Tests for user growth API endpoint
 */

import { GET, GrowthResponse } from '@/app/api/admin/analytics/engagement/growth/route';
import { NextRequest } from 'next/server';

describe('GET /api/admin/analytics/engagement/growth', () => {
  // Similar setup to overview tests...

  it('should return daily data points for 30d period', async () => {
    // Mock admin auth and data
    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/growth?period=30d');
    const response = await GET(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.dataPoints).toBeDefined();
    expect(body.data.dataPoints.length).toBeGreaterThanOrEqual(30);
    expect(body.data.granularity).toBe('daily');
  });

  it('should calculate cumulative users correctly', async () => {
    // Mock with known data
    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/growth?period=7d');
    const response = await GET(request);
    const body = await response.json();

    const dataPoints = body.data.dataPoints as Array<{ newUsers: number; cumulativeUsers: number }>;

    // Cumulative should always increase or stay the same
    for (let i = 1; i < dataPoints.length; i++) {
      expect(dataPoints[i].cumulativeUsers).toBeGreaterThanOrEqual(dataPoints[i - 1].cumulativeUsers);
    }
  });

  it('should identify peak day correctly', async () => {
    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/growth?period=30d');
    const response = await GET(request);
    const body = await response.json();

    const { dataPoints, summary } = body.data as GrowthResponse;

    // Peak count should match the max in dataPoints
    const maxNewUsers = Math.max(...dataPoints.map(d => d.newUsers));
    expect(summary.peakCount).toBe(maxNewUsers);
  });
});
```

#### File: `tests/api/admin/analytics/engagement/funnel.test.ts`

```typescript
/**
 * Tests for conversion funnel API endpoint
 */

import { GET, FunnelResponse } from '@/app/api/admin/analytics/engagement/funnel/route';
import { NextRequest } from 'next/server';

describe('GET /api/admin/analytics/engagement/funnel', () => {
  it('should return all funnel stages', async () => {
    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/funnel');
    const response = await GET(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.stages).toHaveLength(6);

    const stageNames = body.data.stages.map((s: { stage: string }) => s.stage);
    expect(stageNames).toEqual([
      'visitors',
      'searchers',
      'viewers',
      'engagers',
      'high_intent',
      'converted',
    ]);
  });

  it('should have decreasing or equal counts down the funnel', async () => {
    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/funnel');
    const response = await GET(request);
    const body = await response.json();

    const stages = body.data.stages as Array<{ count: number }>;

    // Each stage should have fewer or equal people than the previous
    // (in a well-functioning funnel)
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].count).toBeLessThanOrEqual(stages[i - 1].count);
    }
  });

  it('should calculate conversion rates correctly', async () => {
    const request = new NextRequest('http://localhost/api/admin/analytics/engagement/funnel');
    const response = await GET(request);
    const body = await response.json();

    const stages = body.data.stages as Array<{ count: number; conversionRate: number }>;

    // First stage should have 100% conversion rate (baseline)
    expect(stages[0].conversionRate).toBe(100);

    // Other stages should have conversion rate = (current / previous) * 100
    for (let i = 1; i < stages.length; i++) {
      const expected = stages[i - 1].count > 0
        ? Math.round((stages[i].count / stages[i - 1].count) * 100)
        : 0;
      expect(stages[i].conversionRate).toBe(expected);
    }
  });
});
```

### 4.3 Tracking Tests

#### File: `tests/api/track/view.test.ts`

```typescript
/**
 * Tests for view tracking endpoint
 */

import { POST } from '@/app/api/track/view/route';
import { NextRequest } from 'next/server';

describe('POST /api/track/view', () => {
  it('should return 400 if listingId is missing', async () => {
    const request = new NextRequest('http://localhost/api/track/view', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 if sessionId is missing', async () => {
    const request = new NextRequest('http://localhost/api/track/view', {
      method: 'POST',
      body: JSON.stringify({ listingId: 123 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return success for valid view tracking', async () => {
    const request = new NextRequest('http://localhost/api/track/view', {
      method: 'POST',
      body: JSON.stringify({
        listingId: 123,
        sessionId: 'test-session',
        referrer: 'browse',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should handle optional userId', async () => {
    const request = new NextRequest('http://localhost/api/track/view', {
      method: 'POST',
      body: JSON.stringify({
        listingId: 123,
        sessionId: 'test-session',
        userId: 'user-uuid-123',
        referrer: 'search',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

### 4.4 Component Tests

#### File: `tests/components/admin/analytics/ConversionFunnelChart.test.tsx`

```typescript
/**
 * Tests for ConversionFunnelChart component
 */

import { render, screen } from '@testing-library/react';
import { ConversionFunnelChart } from '@/components/admin/analytics/ConversionFunnelChart';
import type { FunnelStage } from '@/app/api/admin/analytics/engagement/funnel/route';

const mockStages: FunnelStage[] = [
  { stage: 'visitors', label: 'Visitors', count: 1000, conversionRate: 100, dropoffRate: 0 },
  { stage: 'searchers', label: 'Searched', count: 600, conversionRate: 60, dropoffRate: 40 },
  { stage: 'viewers', label: 'Viewed', count: 300, conversionRate: 50, dropoffRate: 50 },
  { stage: 'engagers', label: 'Favorited', count: 50, conversionRate: 17, dropoffRate: 83 },
];

describe('ConversionFunnelChart', () => {
  it('should render all stage labels', () => {
    render(<ConversionFunnelChart stages={mockStages} />);

    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Searched')).toBeInTheDocument();
    expect(screen.getByText('Viewed')).toBeInTheDocument();
    expect(screen.getByText('Favorited')).toBeInTheDocument();
  });

  it('should render stage counts', () => {
    render(<ConversionFunnelChart stages={mockStages} />);

    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should show conversion rates', () => {
    render(<ConversionFunnelChart stages={mockStages} />);

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('17%')).toBeInTheDocument();
  });

  it('should render skeleton when loading', () => {
    const { container } = render(<ConversionFunnelChart stages={[]} loading />);

    expect(container.querySelector('.animate-shimmer')).toBeInTheDocument();
  });

  it('should show empty state when no stages', () => {
    render(<ConversionFunnelChart stages={[]} />);

    expect(screen.getByText('No funnel data available')).toBeInTheDocument();
  });
});
```

#### File: `tests/components/admin/analytics/UserGrowthChart.test.tsx`

```typescript
/**
 * Tests for UserGrowthChart component
 */

import { render, screen } from '@testing-library/react';
import { UserGrowthChart } from '@/components/admin/analytics/UserGrowthChart';
import type { GrowthDataPoint } from '@/app/api/admin/analytics/engagement/growth/route';

const mockDataPoints: GrowthDataPoint[] = [
  { date: '2024-01-01', newUsers: 5, cumulativeUsers: 100 },
  { date: '2024-01-02', newUsers: 10, cumulativeUsers: 110 },
  { date: '2024-01-03', newUsers: 3, cumulativeUsers: 113 },
];

describe('UserGrowthChart', () => {
  it('should render chart container', () => {
    const { container } = render(<UserGrowthChart dataPoints={mockDataPoints} />);

    // Recharts renders an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render skeleton when loading', () => {
    const { container } = render(<UserGrowthChart dataPoints={[]} loading />);

    expect(container.querySelector('.animate-shimmer')).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<UserGrowthChart dataPoints={[]} />);

    expect(screen.getByText('No growth data available')).toBeInTheDocument();
  });
});
```

### 4.5 Hook Tests

#### File: `tests/hooks/useUserEngagement.test.ts`

```typescript
/**
 * Tests for useUserEngagement hook
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserEngagement } from '@/hooks/useUserEngagement';

// Mock fetch
global.fetch = jest.fn();

describe('useUserEngagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });
  });

  it('should fetch all endpoints on mount', async () => {
    renderHook(() => useUserEngagement({ period: '30d' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/analytics/engagement/overview')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/analytics/engagement/growth')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/analytics/engagement/searches')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/analytics/engagement/funnel')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/analytics/engagement/top-listings')
    );
  });

  it('should include period in query string', async () => {
    renderHook(() => useUserEngagement({ period: '7d' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=7d')
      );
    });
  });

  it('should refetch when period changes', async () => {
    const { rerender } = renderHook(
      ({ period }) => useUserEngagement({ period }),
      { initialProps: { period: '30d' as const } }
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    rerender({ period: '7d' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(10);
    });
  });

  it('should set loading states correctly', async () => {
    const { result } = renderHook(() => useUserEngagement({ period: '30d' }));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useUserEngagement({ period: '30d' }));

    await waitFor(() => {
      expect(result.current.hasErrors).toBe(true);
    });

    expect(result.current.errors.overview).toBe('Network error');
  });

  it('should allow manual refresh', async () => {
    const { result } = renderHook(() => useUserEngagement({ period: '30d' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  it('should update lastUpdated after refresh', async () => {
    const { result } = renderHook(() => useUserEngagement({ period: '30d' }));

    await waitFor(() => {
      expect(result.current.lastUpdated).not.toBeNull();
    });

    const firstUpdate = result.current.lastUpdated;

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(result.current.lastUpdated).not.toEqual(firstUpdate);
  });
});
```

### 4.6 Integration Tests

#### File: `tests/integration/engagement-dashboard.test.ts`

```typescript
/**
 * Integration tests for the engagement dashboard
 * Tests the full flow from API to rendering
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserEngagementAnalyticsPage from '@/app/admin/analytics/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock the hook with realistic data
jest.mock('@/hooks/useUserEngagement', () => ({
  useUserEngagement: () => ({
    data: {
      overview: {
        users: { total: 1234, newInPeriod: 45, newPrevPeriod: 38, changePercent: 18.4, activeToday: 89, activeInPeriod: 456 },
        sessions: { total: 2500, avgDurationSeconds: 272, avgPageViews: 4.2, bounceRate: 42, totalPrevPeriod: 2100, changePercent: 19 },
        engagement: { totalViews: 8500, totalSearches: 1200, totalFavorites: 340, viewsPrevPeriod: 7200, searchesPrevPeriod: 1000, favoritesPrevPeriod: 280 },
        asOf: new Date().toISOString(),
        period: '30d',
      },
      growth: {
        dataPoints: [
          { date: '2024-01-01', newUsers: 5, cumulativeUsers: 1189 },
          { date: '2024-01-02', newUsers: 8, cumulativeUsers: 1197 },
        ],
        summary: { totalNewUsers: 45, avgDailySignups: 1.5, peakDay: '2024-01-15', peakCount: 12 },
        period: '30d',
        granularity: 'daily',
      },
      searches: {
        searches: [
          { term: 'katana', count: 150, uniqueUsers: 89, avgResultCount: 234, clickThroughRate: 35 },
          { term: 'tsuba', count: 95, uniqueUsers: 67, avgResultCount: 180, clickThroughRate: 28 },
        ],
        totals: { totalSearches: 1200, uniqueSearchers: 340, avgClickThroughRate: 31 },
        period: '30d',
      },
      funnel: {
        stages: [
          { stage: 'visitors', label: 'Visitors', count: 2500, conversionRate: 100, dropoffRate: 0 },
          { stage: 'searchers', label: 'Searched', count: 1200, conversionRate: 48, dropoffRate: 52 },
          { stage: 'viewers', label: 'Viewed Listing', count: 850, conversionRate: 71, dropoffRate: 29 },
          { stage: 'engagers', label: 'Favorited', count: 340, conversionRate: 40, dropoffRate: 60 },
        ],
        overallConversionRate: 13.6,
        period: '30d',
      },
      topListings: {
        listings: [
          { id: 1, title: 'Rare Katana', itemType: 'katana', dealerName: 'Aoi Art', views: 234, uniqueViewers: 180, favorites: 45, priceJPY: 1500000 },
        ],
        period: '30d',
        sortedBy: 'views',
      },
    },
    loading: { overview: false, growth: false, searches: false, funnel: false, topListings: false },
    errors: { overview: null, growth: null, searches: null, funnel: null, topListings: null },
    refreshAll: jest.fn(),
    isLoading: false,
    hasErrors: false,
    lastUpdated: new Date(),
  }),
}));

describe('User Engagement Analytics Page Integration', () => {
  it('should render page title', async () => {
    render(<UserEngagementAnalyticsPage />);

    expect(screen.getByText('User Engagement')).toBeInTheDocument();
  });

  it('should display metric cards with correct values', async () => {
    render(<UserEngagementAnalyticsPage />);

    expect(screen.getByText('1,234')).toBeInTheDocument(); // Total users
    expect(screen.getByText('89')).toBeInTheDocument(); // Active today
    expect(screen.getByText('4m 32s')).toBeInTheDocument(); // Avg session formatted
  });

  it('should render user growth chart section', async () => {
    render(<UserEngagementAnalyticsPage />);

    expect(screen.getByText('User Growth')).toBeInTheDocument();
  });

  it('should render conversion funnel section', async () => {
    render(<UserEngagementAnalyticsPage />);

    expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('2,500')).toBeInTheDocument();
  });

  it('should render popular searches table', async () => {
    render(<UserEngagementAnalyticsPage />);

    expect(screen.getByText('Popular Searches')).toBeInTheDocument();
    expect(screen.getByText('katana')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('should render top listings section', async () => {
    render(<UserEngagementAnalyticsPage />);

    expect(screen.getByText('Most Viewed Listings')).toBeInTheDocument();
    expect(screen.getByText('Rare Katana')).toBeInTheDocument();
  });

  it('should allow changing time period', async () => {
    const user = userEvent.setup();
    render(<UserEngagementAnalyticsPage />);

    const sevenDayButton = screen.getByText('7 Days');
    await user.click(sevenDayButton);

    // The button should now be selected (has gold background)
    expect(sevenDayButton).toHaveClass('bg-gold');
  });
});
```

---

## Phase 5: Implementation Order

### Step 1: Database Setup (Day 1)
1. Create and run migration for `listing_views` table
2. Create and run migration for `user_searches` table
3. Verify `user_sessions` table has required columns
4. Add RLS policies
5. Run migration tests

### Step 2: Tracking Infrastructure (Day 1-2)
1. Implement `viewTracker.ts`
2. Implement `searchTracker.ts`
3. Create `/api/track/view` endpoint
4. Create `/api/track/search` endpoint
5. Integrate view tracking into listing detail page
6. Integrate search tracking into search functionality
7. Run tracking endpoint tests

### Step 3: Analytics API (Day 2-3)
1. Create shared utilities (`_lib/utils.ts`)
2. Implement `/engagement/overview` endpoint
3. Implement `/engagement/growth` endpoint
4. Implement `/engagement/searches` endpoint
5. Implement `/engagement/funnel` endpoint
6. Implement `/engagement/top-listings` endpoint
7. Run all API endpoint tests

### Step 4: Frontend Components (Day 3-4)
1. Create `useUserEngagement` hook
2. Create `ConversionFunnelChart` component
3. Create `UserGrowthChart` component
4. Create `SearchTermsTable` component
5. Run component tests

### Step 5: Page Rewrite (Day 4-5)
1. Rewrite `src/app/admin/analytics/page.tsx`
2. Connect all components
3. Add loading and error states
4. Run integration tests

### Step 6: Polish & Deploy (Day 5)
1. Manual testing in development
2. Fix any issues discovered
3. Deploy to staging
4. Verify with production-like data
5. Deploy to production

---

## Success Criteria

- [ ] All database tables created with proper indexes and RLS
- [ ] View tracking captures 95%+ of listing page views
- [ ] Search tracking captures all user searches
- [ ] All 5 API endpoints return valid data
- [ ] All API endpoints have 90%+ test coverage
- [ ] Dashboard loads in <2 seconds
- [ ] All charts render correctly with real data
- [ ] Period selector correctly filters all data
- [ ] Refresh button works correctly
- [ ] No console errors in production
- [ ] All integration tests pass

---

## Rollback Plan

If issues are discovered post-deployment:

1. **Frontend only issues**: Revert the page.tsx file, keep tracking active
2. **API issues**: Return empty data with success=true to prevent UI errors
3. **Tracking issues**: Disable tracking endpoints but keep analytics APIs working
4. **Database issues**: Migrations include rollback scripts

---

## Future Enhancements (Out of Scope)

- Retention cohort analysis (weekly/monthly)
- Geographic user distribution
- Device/browser analytics
- A/B testing integration
- Real-time active users counter
- Custom date range picker
- CSV/PDF export functionality
- Email scheduled reports

---

## Multi-Agent Task Breakdown

This plan is designed for parallel execution with the Dealer Analytics agent. Below is the task breakdown for spawning agents.

### Agent 1: Database & Tracking (Can run first or parallel)

**Scope**: Database migrations and tracking endpoints only

**Files to create**:
- `supabase/migrations/20240201_create_listing_views.sql`
- `supabase/migrations/20240202_create_user_searches.sql`
- `src/lib/tracking/viewTracker.ts`
- `src/lib/tracking/searchTracker.ts`
- `src/app/api/track/view/route.ts`
- `src/app/api/track/search/route.ts`

**Files to modify**:
- `src/app/listing/[id]/page.tsx` - Add view tracking call
- `src/components/search/SearchBar.tsx` or equivalent - Add search tracking call

**Tests to write**:
- `tests/migrations/listing_views.test.ts`
- `tests/migrations/user_searches.test.ts`
- `tests/api/track/view.test.ts`
- `tests/api/track/search.test.ts`

**Dependencies**: None (can run immediately)

**Handoff Context**:
```
Create listing_views and user_searches tables per the plan in
docs/plans/USER_ENGAGEMENT_ANALYTICS_PLAN.md Phase 1.

Key requirements:
- listing_views must deduplicate by (listing_id, session_id, DATE(viewed_at))
- user_searches must store normalized query for aggregation
- Both tables need proper indexes and RLS policies
- Create tracking endpoints at /api/track/view and /api/track/search
- Do NOT modify existing /api/track/route.ts or ActivityTracker.tsx
- Integrate view tracking into listing detail page
- Integrate search tracking into search functionality

See Phase 1 and Phase 2 of the plan for full specifications.
```

---

### Agent 2: Analytics APIs (Depends on Agent 1 tables)

**Scope**: All engagement API endpoints

**Files to create**:
- `src/app/api/admin/analytics/engagement/_lib/utils.ts`
- `src/app/api/admin/analytics/engagement/overview/route.ts`
- `src/app/api/admin/analytics/engagement/growth/route.ts`
- `src/app/api/admin/analytics/engagement/searches/route.ts`
- `src/app/api/admin/analytics/engagement/funnel/route.ts`
- `src/app/api/admin/analytics/engagement/top-listings/route.ts`
- `src/types/engagement.ts` (optional, can use inline types)

**Tests to write**:
- `tests/api/admin/analytics/engagement/overview.test.ts`
- `tests/api/admin/analytics/engagement/growth.test.ts`
- `tests/api/admin/analytics/engagement/searches.test.ts`
- `tests/api/admin/analytics/engagement/funnel.test.ts`
- `tests/api/admin/analytics/engagement/top-listings.test.ts`

**Dependencies**: Agent 1 tables must exist (listing_views, user_searches)

**Handoff Context**:
```
Create engagement analytics API endpoints per the plan in
docs/plans/USER_ENGAGEMENT_ANALYTICS_PLAN.md Phase 2-3.

Endpoints to create (all under /api/admin/analytics/engagement/):
- /overview - User counts, session stats, engagement totals
- /growth - User signup time series with cumulative counts
- /searches - Popular search terms with CTR
- /funnel - Conversion funnel (visitors→searchers→viewers→favorites→inquiries)
- /top-listings - Most viewed/favorited listings

Key requirements:
- All endpoints require admin authentication (use verifyAdmin pattern)
- All endpoints accept ?period=7d|30d|90d query param
- Query listing_views and user_searches tables (created by Agent 1)
- Also query existing tables: profiles, user_sessions, user_favorites, saved_searches
- Return data in AnalyticsAPIResponse wrapper format
- Include period-over-period comparison where applicable

See Phase 2 API sections of the plan for full specifications and types.
```

---

### Agent 3: Frontend Components (Depends on Agent 2 APIs)

**Scope**: Hook and chart components

**Files to create**:
- `src/hooks/useUserEngagement.ts`
- `src/components/admin/analytics/ConversionFunnelChart.tsx`
- `src/components/admin/analytics/UserGrowthChart.tsx`
- `src/components/admin/analytics/SearchTermsTable.tsx`
- `src/components/admin/analytics/TopListingsTable.tsx` (optional)

**Files to modify**:
- `src/components/admin/analytics/index.ts` - Add exports

**Tests to write**:
- `tests/hooks/useUserEngagement.test.ts`
- `tests/components/admin/analytics/ConversionFunnelChart.test.tsx`
- `tests/components/admin/analytics/UserGrowthChart.test.tsx`
- `tests/components/admin/analytics/SearchTermsTable.test.tsx`

**Dependencies**: Agent 2 APIs must be complete

**Handoff Context**:
```
Create frontend components for user engagement dashboard per the plan in
docs/plans/USER_ENGAGEMENT_ANALYTICS_PLAN.md Phase 3-4.

Components to create:
- useUserEngagement hook - Fetches all 5 engagement API endpoints in parallel
- ConversionFunnelChart - Horizontal bar chart showing funnel stages
- UserGrowthChart - Combined line+bar chart (Recharts ComposedChart)
- SearchTermsTable - Table of popular search terms with CTR

Key requirements:
- Use lazy loading for chart components (Recharts is heavy)
- Include loading skeletons matching existing ChartSkeleton pattern
- Include empty state handling for all components
- Follow existing component patterns in src/components/admin/analytics/
- Reuse existing MetricCard component (don't recreate)

See Phase 3-4 of the plan for full component specifications.
```

---

### Agent 4: Page Rewrite (Depends on Agent 3 components)

**Scope**: Complete rewrite of /admin/analytics page

**Files to modify**:
- `src/app/admin/analytics/page.tsx` - Complete rewrite

**Tests to write**:
- `tests/integration/engagement-dashboard.test.ts`

**Dependencies**: Agent 3 components must be complete

**Handoff Context**:
```
Rewrite /admin/analytics page using new components per the plan in
docs/plans/USER_ENGAGEMENT_ANALYTICS_PLAN.md Phase 3.3.

The current page is mostly placeholder. Replace entirely with:
- Period selector (7d/30d/90d toggle buttons)
- 4 MetricCard components (Total Users, Active Today, Avg Session, Total Searches)
- UserGrowthChart with summary stats below
- ConversionFunnelChart with overall conversion rate
- SearchTermsTable showing popular searches
- TopListingsTable showing most viewed listings

Key requirements:
- Use useUserEngagement hook for all data fetching
- Add Suspense boundaries for lazy-loaded chart components
- Include refresh button with loading state
- Include "last updated" timestamp display
- Handle all error states gracefully
- Follow existing admin page styling patterns

See Phase 3.3 of the plan for full page layout and code.
```

---

### Execution Options

**Option A: Sequential (1 agent)**
```
Agent 1 → Agent 2 → Agent 3 → Agent 4
Total: ~5 days
```

**Option B: Parallel (2 agents)**
```
Agent A: Phase 1-2 (Database + APIs)
Agent B: Phase 3-4 (Components + Page) - starts after APIs done
Total: ~3 days
```

**Option C: Maximum Parallel (4 agents)**
```
Agent 1: Database & Tracking
Agent 2: APIs (waits for Agent 1)
Agent 3: Components (waits for Agent 2)
Agent 4: Page (waits for Agent 3)
Total: ~2 days with overlap
```

**Recommended**: Option B - 2 agents, backend/frontend split
