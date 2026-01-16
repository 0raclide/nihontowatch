# User Accounts Implementation Plan

## Overview
Add comprehensive user account functionality to nihontowatch with magic code login, activity tracking, favorites, email alerts, and admin tools.

---

## Phase 1: Database Schema & Supabase Auth Setup

### 1.1 Enable Supabase Auth
- Enable Email OTP (magic code) authentication in Supabase dashboard
- Configure email templates for OTP codes
- Set up SMTP for transactional emails (Resend recommended)

### 1.2 Database Tables to Create

**profiles** (extends auth.users)
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on user signup
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**user_favorites**
```sql
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);
```

**user_alerts**
```sql
CREATE TABLE user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'new_listing', 'back_in_stock')),
  -- For price alerts on specific listings
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  target_price NUMERIC,
  -- For new listing alerts based on search criteria
  search_criteria JSONB,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**user_activity**
```sql
CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'page_view', 'listing_view', 'search', 'filter_change',
    'favorite_add', 'favorite_remove', 'alert_create', 'alert_delete',
    'session_start', 'session_end', 'external_link_click'
  )),
  page_path TEXT,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at);
CREATE INDEX idx_user_activity_session ON user_activity(session_id);
```

**user_sessions** (for time tracking)
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
  device_info JSONB
);
```

**alert_history** (for tracking sent alerts)
```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES user_alerts(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  metadata JSONB
);
```

### 1.3 Row Level Security (RLS) Policies

```sql
-- Profiles: users can read/update own profile, admins can read all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Favorites: users manage own favorites
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites"
  ON user_favorites FOR ALL
  USING (auth.uid() = user_id);

-- Alerts: users manage own alerts
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alerts"
  ON user_alerts FOR ALL
  USING (auth.uid() = user_id);

-- Activity: users can insert own, admins can read all
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
  ON user_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity"
  ON user_activity FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

## Phase 2: Authentication Implementation

### 2.1 Auth Context & Provider

**File: `src/lib/auth/AuthContext.tsx`**
- Create React context for auth state
- Wrap app in AuthProvider
- Handle session persistence
- Expose: `user`, `profile`, `isAdmin`, `signIn`, `signOut`, `loading`

### 2.2 Auth Components

**File: `src/components/auth/LoginModal.tsx`**
- Modal dialog for email input
- Send OTP via `supabase.auth.signInWithOtp({ email })`
- Show code entry form after sending
- Verify code via `supabase.auth.verifyOtp()`
- Clean, minimal design matching site aesthetic

**File: `src/components/auth/UserMenu.tsx`**
- Dropdown in header showing user avatar/email
- Links: Profile, Favorites, Alerts, Settings
- Admin link (if admin)
- Sign Out button

### 2.3 Auth Pages

**File: `src/app/auth/callback/page.tsx`**
- Handle auth callback from email links

**File: `src/app/auth/verify/page.tsx`**
- OTP verification page (fallback)

### 2.4 Middleware (Optional)

**File: `src/middleware.ts`**
- Protect routes that require auth
- Redirect unauthenticated users to login

---

## Phase 3: User Profile

### 3.1 Profile Page

**File: `src/app/profile/page.tsx`**
- Display user info
- Edit display name
- Manage email preferences
- View account activity summary

### 3.2 Profile Settings

**File: `src/app/profile/settings/page.tsx`**
- Currency preference (persistent)
- Email notification preferences
- Dark mode preference
- Delete account option

---

## Phase 4: Favorites System

### 4.1 API Routes

**File: `src/app/api/favorites/route.ts`**
- GET: Fetch user's favorites with listing details
- POST: Add favorite
- DELETE: Remove favorite

### 4.2 Favorites Components

**File: `src/components/favorites/FavoriteButton.tsx`**
- Heart icon button for listing cards
- Optimistic UI updates
- Login prompt if not authenticated

**File: `src/components/favorites/FavoritesList.tsx`**
- Grid of favorited listings
- Remove button
- Empty state

### 4.3 Favorites Page

**File: `src/app/favorites/page.tsx`**
- Protected route (requires auth)
- Shows all favorited items
- Quick actions: remove, set alert

---

## Phase 5: Alerts System

### 5.1 API Routes

**File: `src/app/api/alerts/route.ts`**
- GET: Fetch user's alerts
- POST: Create new alert
- PATCH: Update alert (toggle active)
- DELETE: Remove alert

### 5.2 Alert Types

1. **Price Drop Alert** - Triggers when listing price decreases
2. **New Listing Alert** - Triggers when new listing matches criteria
3. **Back in Stock Alert** - Triggers when sold item becomes available

### 5.3 Alert Components

**File: `src/components/alerts/CreateAlertModal.tsx`**
- Form to create alerts
- Price drop: select listing, set target price (optional)
- New listing: define search criteria (type, dealer, price range, etc.)

**File: `src/components/alerts/AlertsList.tsx`**
- List of user's alerts
- Toggle active/inactive
- Delete option
- Show last triggered date

### 5.4 Alerts Page

**File: `src/app/alerts/page.tsx`**
- Protected route
- List all alerts
- Create new alert button
- Alert history

### 5.5 Alert Processing (Edge Function)

**File: Supabase Edge Function `process-alerts`**
- Runs on schedule (every 15 minutes)
- Checks price_history for price drops
- Checks listings for new matching items
- Sends emails via Resend/SendGrid
- Records in alert_history

---

## Phase 6: Activity Tracking

### 6.1 Activity Tracker Hook

**File: `src/hooks/useActivityTracker.ts`**
- Generate unique session ID
- Track page views automatically
- Track listing views with duration
- Batch events and send periodically
- Handle page visibility (pause when tab hidden)

### 6.2 Activity API

**File: `src/app/api/activity/route.ts`**
- POST: Batch insert activity events
- Validate user session
- Anonymous users get limited tracking (optional)

### 6.3 Session Management

**File: `src/lib/activity/sessionManager.ts`**
- Create session on first activity
- Update last_activity_at periodically
- Close session on page unload (sendBeacon)
- Calculate total duration

### 6.4 Integration Points

- Wrap app in ActivityProvider
- Track in ListingCard (view duration)
- Track in browse page (filter changes)
- Track search queries
- Track external link clicks

---

## Phase 7: Admin Dashboard

### 7.1 Admin Layout

**File: `src/app/admin/layout.tsx`**
- Protected route (admin only)
- Admin navigation sidebar
- Breadcrumb

### 7.2 Admin Pages

**File: `src/app/admin/page.tsx`** (Dashboard)
- Key metrics: users, listings, activity
- Recent signups
- Active users
- Popular listings

**File: `src/app/admin/users/page.tsx`**
- User list with search
- View user details
- Modify user roles
- View user activity

**File: `src/app/admin/activity/page.tsx`**
- Activity log viewer
- Filter by user, action type, date
- Session analysis
- Export to CSV

**File: `src/app/admin/analytics/page.tsx`**
- Time spent analytics
- Popular listings
- Search trends
- Conversion funnel (views → favorites → alerts)

**File: `src/app/admin/alerts/page.tsx`**
- View all alerts across users
- Alert delivery status
- Email send logs

### 7.3 Admin API Routes

**File: `src/app/api/admin/[...route]/route.ts`**
- Users: list, get, update role
- Activity: query, export
- Analytics: aggregated stats
- All routes check admin role

---

## Phase 8: Email System

### 8.1 Email Service Setup

- Use Resend (recommended) or SendGrid
- Configure in Supabase Edge Functions
- Store API key in Supabase secrets

### 8.2 Email Templates

**Templates to create:**
1. Welcome email (on signup)
2. Price drop alert
3. New listing alert
4. Back in stock alert
5. Weekly digest (optional)

### 8.3 Edge Function for Emails

**File: Supabase Edge Function `send-alert-email`**
- Receives alert trigger from process-alerts
- Renders email template
- Sends via email provider
- Logs delivery status

---

## Implementation Order

### Sprint 1: Foundation (Phase 1 & 2)
1. Create database tables and RLS policies
2. Set up Supabase Auth with email OTP
3. Create AuthContext and AuthProvider
4. Build LoginModal and UserMenu
5. Add auth UI to header

### Sprint 2: Profile & Favorites (Phase 3 & 4)
1. Build profile page and settings
2. Create favorites API routes
3. Build FavoriteButton component
4. Add favorites to listing cards
5. Create favorites page

### Sprint 3: Activity Tracking (Phase 6)
1. Create activity tracking hook
2. Build session manager
3. Integrate tracking into browse/listing pages
4. Create activity API route

### Sprint 4: Alerts System (Phase 5)
1. Create alerts API routes
2. Build alert creation modal
3. Create alerts page
4. Set up Supabase Edge Function for processing

### Sprint 5: Admin Dashboard (Phase 7)
1. Create admin layout and route protection
2. Build admin dashboard
3. Create user management page
4. Build activity viewer
5. Add analytics page

### Sprint 6: Email Integration (Phase 8)
1. Set up email provider
2. Create email templates
3. Build edge function for sending
4. Test alert → email flow

---

## File Structure Summary

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx (dashboard)
│   │   ├── users/page.tsx
│   │   ├── activity/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── alerts/page.tsx
│   ├── alerts/
│   │   └── page.tsx
│   ├── auth/
│   │   ├── callback/page.tsx
│   │   └── verify/page.tsx
│   ├── favorites/
│   │   └── page.tsx
│   ├── profile/
│   │   ├── page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── activity/route.ts
│       ├── alerts/route.ts
│       ├── favorites/route.ts
│       └── admin/[...route]/route.ts
├── components/
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── LoginModal.tsx
│   │   └── UserMenu.tsx
│   ├── alerts/
│   │   ├── CreateAlertModal.tsx
│   │   └── AlertsList.tsx
│   └── favorites/
│       ├── FavoriteButton.tsx
│       └── FavoritesList.tsx
├── hooks/
│   └── useActivityTracker.ts
└── lib/
    ├── auth/
    │   └── AuthContext.tsx
    └── activity/
        └── sessionManager.ts
```

---

## Environment Variables to Add

```bash
# .env.local (add to existing)
RESEND_API_KEY=re_xxx                    # For email sending
ADMIN_EMAIL=your-email@example.com       # Your email to set as admin
```

---

## Admin Setup

After first login with your email, run this SQL to make yourself admin:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

---

## Estimated Scope

- **New files**: ~25-30 files
- **Database tables**: 6 new tables
- **API routes**: 4 route files
- **Components**: ~10 new components
- **Supabase Edge Functions**: 2 functions

---

## Ready for Implementation

This plan covers:
- Magic code (OTP) authentication via Supabase
- User profiles with preferences
- Comprehensive activity tracking including time spent
- Favorites system with heart buttons
- Full alerts system (price drop, new listing, back in stock)
- Admin dashboard with user management, activity logs, and analytics
- Email delivery for alerts

Approve to begin implementation with a fleet of agents.
