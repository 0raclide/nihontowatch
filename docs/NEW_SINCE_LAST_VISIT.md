# New Since Last Visit Feature

**Status:** Implemented
**Date:** 2026-01-26
**Purpose:** Drive user retention by showing personalized "new items since your last visit" count

---

## Overview

This feature tracks when logged-in users last visited the browse page and displays a banner showing how many new items have been added since their last visit. For logged-out users, it shows a teaser encouraging them to log in.

### Why This Feature?

- **Creates FOMO**: "47 new items since you were here" is more compelling than generic "New This Week"
- **Rewards returning users**: Personalized experience makes users feel valued
- **Drives habit formation**: The "unread count" psychology encourages regular visits
- **Login incentive**: Teaser for logged-out users provides reason to create an account

---

## User Experience

### Logged-in User (Returning)

```
┌─────────────────────────────────────────────────────────────────┐
│ ✨ 47 new items since your last visit 3 days ago  [View new] [✕]│
└─────────────────────────────────────────────────────────────────┘
```

- **Emerald/green styling** (distinct from amber DataDelayBanner)
- **"View new items"** links to `/?sort=recent`
- **Dismissible** (session-only, reappears next browser session)
- **Responsive**: Shorter text on mobile

### Logged-out User (Teaser)

```
┌─────────────────────────────────────────────────────────────────┐
│ ✨ Log in to track new items since your last visit  [Log in][✕]│
└─────────────────────────────────────────────────────────────────┘
```

- **Blue styling** (informational)
- **Opens login modal** (button, not link)
- **Dismissible** (session-only)

### Logged-in User Without Consent (GDPR Compliance)

```
┌──────────────────────────────────────────────────────────────────┐
│ ✨ Enable personalization to track new items...  [Enable][✕]    │
└──────────────────────────────────────────────────────────────────┘
```

- **Purple styling** (distinct from other banners)
- **Opens consent preferences** modal
- **Dismissible** (session-only)
- **GDPR Compliant**: Feature only works if user consents to functional cookies

### First Visit

- No banner shown (user establishes baseline)
- `last_visit_at` is recorded after 2 seconds on the page

---

## GDPR Compliance

**Consent Required:** This feature requires **functional consent** from users.

### Why Functional Consent?

The feature tracks:
- User's last visit timestamp (`last_visit_at` in database)
- Visit history for personalization
- Count of new items since last visit

This is **personalization/preference tracking** → requires functional consent under GDPR.

### Implementation

```typescript
// src/contexts/NewSinceLastVisitContext.tsx
import { hasFunctionalConsent } from '@/lib/consent';

const fetchCount = useCallback(async () => {
  // ✅ Check consent BEFORE tracking
  if (!user || !hasFunctionalConsent()) {
    return; // No tracking without consent
  }

  // Proceed with API call...
}, [user]);
```

### User Experience by Consent State

| User State | Banner Shown | Behavior |
|------------|--------------|----------|
| Logged out | Login teaser (blue) | Encourages login |
| Logged in, no consent | Consent upsell (purple) | Opens preferences modal |
| Logged in, with consent | New items count (green) | Shows personalized data |
| First visit + consent | Nothing | Establishes baseline |

### Cookie Banner Copy

```
Accept cookies to unlock cool features: track new items since your last visit,
save your currency preference, remember your searches, and personalize your experience
across our 27 dealers.
```

**Key principle:** Make it explicitly clear what users get by accepting cookies.

---

## Technical Implementation

### Database Schema

```sql
-- Migration: 043_add_last_visit_at.sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_visit_at
  ON profiles(last_visit_at) WHERE last_visit_at IS NOT NULL;
```

### API Endpoints

#### `GET /api/user/new-items-count`

Returns count of new available listings since user's last visit.

**Response (anonymous):**
```json
{
  "count": null,
  "isLoggedIn": false
}
```

**Response (logged-in, returning):**
```json
{
  "count": 47,
  "isLoggedIn": true,
  "isFirstVisit": false,
  "lastVisitAt": "2024-01-20T10:30:00Z",
  "daysSince": 3
}
```

**Response (logged-in, first visit):**
```json
{
  "count": null,
  "isLoggedIn": true,
  "isFirstVisit": true
}
```

**Features:**
- Respects 72h data delay for free tier users
- Applies same filters as browse API (min price, excludes books/stands)
- Efficient count-only query (`head: true`)

#### `POST /api/user/update-last-visit`

Updates `last_visit_at` to current timestamp.

**Response:**
```json
{
  "success": true
}
```

### React Context

**File:** `src/contexts/NewSinceLastVisitContext.tsx`

```typescript
interface NewSinceLastVisitContextValue {
  count: number | null;
  daysSince: number | null;
  isFirstVisit: boolean;
  isDismissed: boolean;
  isLoading: boolean;
  lastVisitAt: string | null;
  dismiss: () => void;
  recordVisit: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

**Hooks:**
- `useNewSinceLastVisit()` - Access context state and actions
- `useShouldShowNewItemsBanner()` - Returns boolean for display logic

### Banner Component

**File:** `src/components/browse/NewSinceLastVisitBanner.tsx`

Renders below the `DataDelayBanner` on the browse page.

### Constants

**File:** `src/lib/constants.ts`

```typescript
export const NEW_SINCE_LAST_VISIT = {
  MIN_ITEMS_THRESHOLD: 1,      // Show for any new items (1+)
  MAX_DAYS_DISPLAY: 30,        // Shows "30+ days ago" for longer gaps
  RECORD_VISIT_DELAY_MS: 2000, // Debounce before recording visit
} as const;
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| First visit (null `last_visit_at`) | Don't show banner, just record visit |
| Long gap (30+ days) | Show "30+ days ago" |
| Zero new items | Don't show banner |
| Free tier user | Count respects 72h data delay |
| Rapid navigation | 2s debounce before recording visit |
| Session dismissal | Stores in `sessionStorage`, resets on new session |

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/043_add_last_visit_at.sql` | Database migration |
| `src/app/api/user/new-items-count/route.ts` | GET count endpoint |
| `src/app/api/user/update-last-visit/route.ts` | POST update endpoint |
| `src/contexts/NewSinceLastVisitContext.tsx` | State management |
| `src/components/browse/NewSinceLastVisitBanner.tsx` | Banner UI |

### Modified Files
| File | Change |
|------|--------|
| `src/types/database.ts` | Added `last_visit_at` to profiles type |
| `src/lib/constants.ts` | Added `NEW_SINCE_LAST_VISIT` constants |
| `src/app/layout.tsx` | Added `NewSinceLastVisitProvider` |
| `src/app/page.tsx` | Added banner + visit recording effect |

---

## Tests

### Context Tests (`tests/contexts/NewSinceLastVisitContext.test.tsx`)
- Initial state (loading, logged-out)
- Logged-in user count fetching
- First visit handling
- Dismiss with sessionStorage
- Record visit API call
- `useShouldShowNewItemsBanner` threshold logic

### Component Tests (`tests/components/browse/NewSinceLastVisitBanner.test.tsx`)
- Logged-out teaser rendering
- Logged-in banner with count
- Days formatting ("today", "yesterday", "X days ago", "30+ days ago")
- Singular/plural "item(s)"
- Styling (blue teaser vs emerald logged-in)
- Dismiss functionality

### API Tests (`tests/api/user-new-items.test.ts`)
- Endpoint existence
- Anonymous response format
- Authentication requirements

---

## Integration Points

### Provider Hierarchy

```tsx
<AuthProvider>
  <NewSinceLastVisitProvider>  {/* Uses useAuth internally */}
    <ConsentProvider>
      <SubscriptionProvider>
        ...
      </SubscriptionProvider>
    </ConsentProvider>
  </NewSinceLastVisitProvider>
</AuthProvider>
```

### Page Integration

```tsx
// src/app/page.tsx
<Header />
<DataDelayBanner />
<NewSinceLastVisitBanner />  {/* Positioned here */}
<main>...</main>
```

### Visit Recording

```tsx
// src/app/page.tsx - HomeContent component
useEffect(() => {
  if (!isLoading && user) {
    const timer = setTimeout(() => {
      recordVisit();
    }, NEW_SINCE_LAST_VISIT.RECORD_VISIT_DELAY_MS);
    return () => clearTimeout(timer);
  }
}, [isLoading, user, recordVisit]);
```

---

## Future Enhancements

1. **Category-specific counts**: "12 new katanas since your last visit"
2. **Saved search integration**: "5 new items matching 'Juyo Soshu'"
3. **Push notifications**: "You have 20 new items waiting"
4. **Weekly digest email**: Summary of new items since last visit
