# User Accounts System Documentation

## Overview

The Nihontowatch user accounts system provides authentication, user profiles, favorites, alerts, activity tracking, and admin tools. Built on Supabase Auth with magic code (email OTP) login.

**Live at:** https://nihontowatch.com

---

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [Authentication](#authentication)
4. [User Features](#user-features)
5. [Activity Tracking](#activity-tracking)
6. [Admin Dashboard](#admin-dashboard)
7. [API Reference](#api-reference)
8. [Components Reference](#components-reference)
9. [Configuration](#configuration)
10. [Future Enhancements](#future-enhancements)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Auth       │  │   Favorites  │  │    Alerts    │  │   Admin     │ │
│  │   Context    │  │   System     │  │    System    │  │  Dashboard  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │         │
│         └─────────────────┴────────┬────────┴─────────────────┘         │
│                                    │                                    │
│                          ┌─────────▼─────────┐                          │
│                          │   Activity        │                          │
│                          │   Tracker         │                          │
│                          └─────────┬─────────┘                          │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                           ┌─────────▼─────────┐
                           │   API Routes      │
                           │   /api/*          │
                           └─────────┬─────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────┐
│                           SUPABASE                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Auth       │  │   profiles   │  │   favorites  │  │   alerts    │ │
│  │   (built-in) │  │   table      │  │   table      │  │   table     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   user_      │  │   activity_  │  │   alert_     │                  │
│  │   sessions   │  │   events     │  │   history    │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (extends auth.users) |
| `user_favorites` | User's saved/favorited listings |
| `user_alerts` | Price drop, new listing, back-in-stock alerts |
| `user_sessions` | Browsing session tracking |
| `user_activity` | Detailed activity log (from migration 009) |
| `activity_events` | Event tracking (from migration 010) |
| `alert_history` | Record of triggered alerts |

### profiles

Extends Supabase `auth.users` with additional profile data.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Auto-creation:** A trigger automatically creates a profile when a user signs up.

**Preferences JSONB structure:**
```json
{
  "currency": "JPY",
  "emailNotifications": true,
  "darkMode": true
}
```

### user_favorites

Stores user's favorited listings.

```sql
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);
```

### user_alerts

Stores user alert configurations.

```sql
CREATE TABLE user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'new_listing', 'back_in_stock')),
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  target_price NUMERIC,
  search_criteria JSONB,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Alert Types:**

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `price_drop` | Triggered when listing price drops | `listing_id`, optional `target_price` |
| `new_listing` | Triggered when new listing matches criteria | `search_criteria` |
| `back_in_stock` | Triggered when sold item becomes available | `listing_id` |

**search_criteria JSONB structure:**
```json
{
  "item_type": "katana",
  "dealer_id": 5,
  "min_price": 100000,
  "max_price": 500000,
  "cert_type": "Juyo"
}
```

### user_sessions

Tracks browsing sessions for analytics.

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  total_duration_ms INTEGER,
  page_views INTEGER DEFAULT 0,
  device_info JSONB DEFAULT '{}'
);
```

### activity_events

Tracks individual user interactions.

```sql
CREATE TABLE activity_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Event Types:**
- `page_view` - Page navigation
- `listing_view` - Viewed a listing detail
- `search` - Performed a search
- `filter_change` - Changed browse filters
- `favorite_add` / `favorite_remove` - Favorited/unfavorited
- `alert_create` / `alert_delete` - Alert management
- `external_link_click` - Clicked to dealer site

### alert_history

Records triggered alerts for auditing.

```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES user_alerts(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  metadata JSONB
);
```

### Row Level Security (RLS)

All tables have RLS enabled:

- **Users** can read/write their own data
- **Admins** can read all data
- **Service role** has full access (for background jobs)

---

## Authentication

### Magic Code Login Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │   Frontend  │     │   Supabase  │     │   Email     │
│             │     │   (Next.js) │     │   Auth      │     │   Provider  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. Enter email   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │  2. signInWithOtp │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │  3. Send OTP      │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │                   │  4. Email
       │<──────────────────────────────────────────────────────────│
       │                   │                   │                   │
       │  5. Enter code    │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │  6. verifyOtp     │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │  7. Session       │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │  8. Logged in     │                   │                   │
       │<──────────────────│                   │                   │
```

### AuthContext

Located at: `src/lib/auth/AuthContext.tsx`

**Provided State:**
```typescript
interface AuthContextValue {
  user: User | null;           // Supabase user object
  profile: Profile | null;     // Profile from profiles table
  session: Session | null;     // Supabase session
  isLoading: boolean;          // Auth state loading
  isAdmin: boolean;            // true if profile.role === 'admin'
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

**Usage:**
```tsx
import { useAuth } from '@/lib/auth/AuthContext';

function MyComponent() {
  const { user, profile, isAdmin, signOut } = useAuth();

  if (!user) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <p>Welcome, {profile?.display_name || user.email}</p>
      {isAdmin && <AdminTools />}
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Auth Components

| Component | Path | Description |
|-----------|------|-------------|
| `LoginModal` | `src/components/auth/LoginModal.tsx` | Modal with email input + OTP verification |
| `UserMenu` | `src/components/auth/UserMenu.tsx` | Dropdown menu for logged-in users |

---

## User Features

### Favorites

**How it works:**
1. User clicks heart icon on a listing card
2. If logged in, listing is added to `user_favorites`
3. If not logged in, login modal appears
4. User can view all favorites at `/favorites`

**Components:**
- `FavoriteButton` - Heart icon toggle
- `FavoritesList` - Grid of favorited listings
- `useFavorites` hook - State management

**API Endpoints:**
- `GET /api/favorites` - Get user's favorites
- `POST /api/favorites` - Add favorite
- `DELETE /api/favorites` - Remove favorite

### Alerts

**Alert Types:**

1. **Price Drop Alert**
   - Set on a specific listing
   - Optional target price threshold
   - Triggers when listing price decreases

2. **New Listing Alert**
   - Set with search criteria (type, dealer, price range, etc.)
   - Triggers when new listing matches criteria

3. **Back in Stock Alert**
   - Set on a sold listing
   - Triggers when listing becomes available again

**Components:**
- `CreateAlertModal` - Form to create alerts
- `AlertCard` - Display single alert
- `AlertsList` - List of user's alerts
- `useAlerts` hook - State management

**API Endpoints:**
- `GET /api/alerts` - Get user's alerts
- `POST /api/alerts` - Create alert
- `PATCH /api/alerts` - Update alert (toggle active)
- `DELETE /api/alerts` - Delete alert

---

## Activity Tracking

### What's Tracked

| Event | Data Collected |
|-------|----------------|
| Page View | path, timestamp |
| Listing View | listing_id, duration_ms |
| Search | query, result_count, filters |
| Filter Change | filter_name, old_value, new_value |
| Favorite Add/Remove | listing_id |
| Alert Create/Delete | alert_id, alert_type |
| External Link Click | url, listing_id, dealer_name |

### Session Management

Sessions are tracked with:
- Unique session ID (stored in sessionStorage)
- Start/end timestamps
- Total duration
- Page view count
- Device info (user agent, screen size)

### Implementation

**SessionManager:** `src/lib/activity/sessionManager.ts`
```typescript
// Get or create session
const sessionId = getSessionId();

// Track session end on page unload
endSession(); // Uses sendBeacon for reliability
```

**Activity Tracker Hook:** `src/hooks/useActivityTracker.ts`
```typescript
const activity = useActivity();

// Track events
activity.trackPageView('/browse');
activity.trackListingView(123, 5000); // 5 second view
activity.trackSearch('katana', 42, { itemTypes: ['katana'] });
activity.trackExternalLinkClick('https://dealer.com', 123, 'Aoi Art');
```

**Auto-tracking:** The `ActivityProvider` automatically tracks:
- Page views on route changes
- Session start/end

---

## Admin Dashboard

### Access Control

Only users with `role = 'admin'` in the `profiles` table can access `/admin/*` routes.

**Protected by:**
1. `src/middleware.ts` - Redirects non-admins
2. `src/app/admin/layout.tsx` - Client-side verification

### Admin Pages

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard with key metrics |
| `/admin/users` | User management, role changes |
| `/admin/activity` | Activity logs with filters |
| `/admin/analytics` | Session stats, popular content |
| `/admin/alerts` | All alerts across users |

### Dashboard Metrics

- Total users
- Active users (24h)
- Total listings
- Favorites count
- Recent signups
- Popular listings

### User Management

Admins can:
- View all users
- Search users by email/name
- Change user roles (user ↔ admin)
- View user activity

### Activity Logs

- Filter by user, action type, date range
- View event details
- Export to CSV

### Analytics

- Session statistics (avg duration, page views)
- Most viewed listings
- Popular search terms
- Conversion funnel (views → favorites → alerts)

---

## API Reference

### Authentication

Auth is handled by Supabase client-side. No custom auth API routes.

### Favorites API

#### GET /api/favorites

Get user's favorited listings.

**Response:**
```json
{
  "favorites": [
    {
      "id": "uuid",
      "listing_id": 123,
      "created_at": "2024-01-15T10:30:00Z",
      "listing": {
        "id": 123,
        "title": "Katana by Masamune",
        "price_value": 5000000,
        ...
      }
    }
  ]
}
```

#### POST /api/favorites

Add a listing to favorites.

**Request:**
```json
{
  "listing_id": 123
}
```

#### DELETE /api/favorites

Remove a listing from favorites.

**Request:**
```json
{
  "listing_id": 123
}
```

### Alerts API

#### GET /api/alerts

Get user's alerts.

**Query params:**
- `type` - Filter by alert type
- `active` - Filter by active status

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "alert_type": "price_drop",
      "listing_id": 123,
      "target_price": 400000,
      "is_active": true,
      "listing": { ... }
    }
  ]
}
```

#### POST /api/alerts

Create a new alert.

**Request (price_drop):**
```json
{
  "alert_type": "price_drop",
  "listing_id": 123,
  "target_price": 400000
}
```

**Request (new_listing):**
```json
{
  "alert_type": "new_listing",
  "search_criteria": {
    "item_type": "katana",
    "min_price": 100000,
    "max_price": 500000
  }
}
```

#### PATCH /api/alerts

Update an alert.

**Request:**
```json
{
  "id": "uuid",
  "is_active": false
}
```

#### DELETE /api/alerts

Delete an alert.

**Request:**
```json
{
  "id": "uuid"
}
```

### Activity API

#### POST /api/activity

Batch insert activity events.

**Request:**
```json
{
  "session_id": "abc123",
  "events": [
    {
      "event_type": "page_view",
      "event_data": { "path": "/browse" }
    },
    {
      "event_type": "listing_view",
      "event_data": { "listing_id": 123, "duration_ms": 5000 }
    }
  ]
}
```

#### POST /api/activity/session

Create or update a session.

**Request:**
```json
{
  "session_id": "abc123",
  "device_info": {
    "userAgent": "...",
    "screenWidth": 1920,
    "screenHeight": 1080
  }
}
```

#### PATCH /api/activity/session

End a session.

**Request:**
```json
{
  "session_id": "abc123",
  "total_duration_ms": 300000
}
```

### Admin API

All admin routes require admin role.

#### GET /api/admin/stats

Get dashboard statistics.

**Query params:**
- `section=alerts` - Get alerts data
- `detailed=true&range=30d` - Get detailed analytics

#### GET /api/admin/users

Get users list.

**Query params:**
- `page` - Page number
- `limit` - Items per page
- `search` - Search query

#### PATCH /api/admin/users

Update user role.

**Request:**
```json
{
  "user_id": "uuid",
  "is_admin": true
}
```

#### GET /api/admin/activity

Get activity logs.

**Query params:**
- `user` - Filter by user ID
- `action_type` - Filter by event type
- `start_date` - Start date
- `end_date` - End date
- `format=csv` - Export as CSV

---

## Components Reference

### Auth Components

| Component | Props | Description |
|-----------|-------|-------------|
| `LoginModal` | `isOpen`, `onClose` | Email + OTP login modal |
| `UserMenu` | - | Dropdown for authenticated users |

### Favorites Components

| Component | Props | Description |
|-----------|-------|-------------|
| `FavoriteButton` | `listingId`, `size?`, `className?` | Heart toggle button |
| `FavoritesList` | - | Grid of favorited listings |

### Alerts Components

| Component | Props | Description |
|-----------|-------|-------------|
| `CreateAlertModal` | `isOpen`, `onClose`, `onSubmit`, `listing?`, `dealers` | Alert creation form |
| `AlertCard` | `alert`, `onToggle`, `onDelete` | Single alert display |
| `AlertsList` | `alerts`, `onToggle`, `onDelete`, `onCreateClick` | List of alerts |

### Activity Components

| Component | Props | Description |
|-----------|-------|-------------|
| `ActivityProvider` | `children` | Provides activity tracking context |
| `ActivityWrapper` | `children` | Suspense wrapper for ActivityProvider |

---

## Configuration

### Environment Variables

```bash
# .env.local

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Email provider (for alerts - future)
RESEND_API_KEY=re_xxx
```

### Setting Admin Users

After a user signs up, set them as admin:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

Or use the auto-admin trigger (set up for `christoph.hill@gmail.com`).

### Supabase Configuration

1. **Enable Email Auth:**
   - Go to Authentication → Providers
   - Enable Email
   - Configure OTP settings

2. **Email Templates:**
   - Customize OTP email template in Authentication → Email Templates

3. **SMTP (optional):**
   - Configure custom SMTP for better deliverability
   - Settings → SMTP

---

## Future Enhancements

### Planned Features

1. **Email Notifications**
   - Set up Resend/SendGrid
   - Create Supabase Edge Function for alert processing
   - Email templates for each alert type

2. **Profile Management**
   - `/profile` page for editing display name, avatar
   - `/profile/settings` for preferences

3. **Weekly Digest**
   - Summary email of new listings matching interests
   - Configurable frequency

4. **Social Features**
   - Public wishlists
   - Share favorites
   - Follow dealers

### Technical Debt

- [ ] Add proper TypeScript types for all Supabase tables
- [ ] Add unit tests for hooks and components
- [ ] Add E2E tests for auth flow
- [ ] Implement proper error boundaries
- [ ] Add rate limiting to API routes

---

## Migrations Reference

| Migration | Description |
|-----------|-------------|
| `009_user_accounts.sql` | Core tables: profiles, favorites, alerts, sessions, activity |
| `010_activity_tracking.sql` | activity_events table and analytics functions |
| `011_set_admin_user.sql` | Auto-admin trigger for christoph.hill@gmail.com |

Run migrations:
```bash
supabase db push
```

---

## Troubleshooting

### User can't sign in

1. Check Supabase Auth is enabled
2. Verify email provider is working
3. Check browser console for errors
4. Ensure `profiles` trigger exists

### Favorites not saving

1. Check user is authenticated
2. Verify `user_favorites` table exists
3. Check RLS policies

### Admin access denied

1. Verify `role = 'admin'` in profiles table
2. Check middleware is running
3. Clear browser cache/cookies

### Activity not tracking

1. Check `ActivityProvider` wraps app
2. Verify `activity_events` table exists
3. Check browser console for API errors

---

*Last updated: January 2025*
