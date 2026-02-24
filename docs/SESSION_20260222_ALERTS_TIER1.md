# Session: Make Alerts Obvious (Tier 1)

**Date:** 2026-02-22
**Status:** Shipped to production

---

## Problem

Saved search alerts were NihontoWatch's most powerful feature for collectors, but adoption was low because the entry points were buried. The "Save Search" button used a generic bookmark icon, defaulted to daily digests (not instant), and was invisible on mobile scroll. There was no persistent notification UI in the header — users had to navigate to `/saved` to see if alerts had fired.

The goal: make alerts impossible to miss, reduce friction to zero taps on mobile, and surface notification state in the header at all times.

---

## What Was Built

Three interconnected changes plus a notification system, collectively branded "Tier 1: Make Alerts Obvious."

### 1. CTA Rename + Default Instant

- Replaced bookmark icon with bell icon on the browse page "Save Search" button
- Changed label from "Save Search" to "Get Alerts" (i18n key: `saveSearch.getAlerts`)
- Changed default notification frequency from `daily` to `instant` in SaveSearchModal
- Rationale: "Get Alerts" communicates the value proposition directly; instant is the behavior users actually want

### 2. Sticky Mobile Alert Bar

New `MobileAlertBar` component rendered between the scrollable content area and the BottomTabBar:

- **Visibility:** Only appears when browse filters are active; `lg:hidden` (mobile only)
- **One-tap quick-save:** Saves the current filter set as an instant-frequency alert without opening the modal
- **Inline success toast:** "Saved! You'll get instant alerts." shown for 2.5 seconds after save
- **Dismiss:** X button stores dismissal to `sessionStorage` (reappears next browser session)
- **Paywall gating:** Uses `requireFeature('saved_searches')` for subscribers; shows login modal for unauthenticated users

### 3. Notification Bell + Dropdown in Header

Replaced the "Saved" text link in the desktop header with a bell icon and dropdown panel:

- **API endpoint:** `GET /api/notifications/recent?since=<ISO>` returns recent saved search notification data with associated listings and dealers
- **Polling hook:** `useNotifications` with conditional 60-second polling (only when user has saved searches)
- **Four states:** not logged in, no saved searches, no notifications, has notifications
- **Notification items:** Clicking opens QuickView modal directly (not full page navigation)
- **"View all"** link navigates to `/saved`
- **Unread badge:** Gold circle, caps at "9+"
- **Read/unread styling:**
  - Unread: `bg-gold/[0.04] border-l-2 border-l-gold` + `font-semibold`
  - Read: `border-l-2 border-l-transparent opacity-70` + `font-normal`
- **`readSince` snapshot:** Captured on dropdown open BEFORE `markAsRead()` updates localStorage, so unread styling persists during the current viewing session
- **Mark as read:** Triggered when visiting `/saved` page (writes to `localStorage` key `lastSavedPageVisit`)

---

## Architecture

### Notification API (`/api/notifications/recent`)

Four sequential Supabase queries:

1. `saved_searches` — fetch user's saved searches
2. `saved_search_notifications` — fetch recent notifications for those searches
3. `listings` — fetch listing details for notification listing IDs (capped at 2 IDs per notification, 10 total)
4. `dealers` — fetch dealer names for those listings

Computes `unreadCount` by comparing each notification's `created_at` against the `since` query parameter. All queries are `await`ed (no fire-and-forget, per CLAUDE.md rule 9). Uses explicit type aliases to work around missing Supabase generated types for the `saved_search_notifications` table.

### Polling Strategy

```
Mount → useEffect #1: initial fetch (if logged in)
         ↓
      didInitialFetch = true
         ↓
Mount → useEffect #2: starts 60s setInterval
         ONLY IF didInitialFetch === true AND hasSavedSearches === true
         ↓
      Each tick → fetchNotifications()
         ↓
Unmount / logout → clearInterval + reset state
```

Key optimization: no polling for users without saved searches. This avoids unnecessary API calls for the majority of visitors.

### Read/Unread Flow

```
User opens dropdown
  → snapshot readSince = current localStorage value (before update)
  → markAsRead() writes new timestamp to localStorage
  → badge count clears immediately (uses live readSince)
  → but dropdown items use the SNAPSHOT readSince for styling
  → so items that were unread when opened stay visually unread during this viewing

User visits /saved page
  → writes localStorage 'lastSavedPageVisit' = now
  → next dropdown open sees all prior notifications as read
```

### Shared Criteria Memo

The browse page needed the current filter state as a `SavedSearchCriteria` object for both the SaveSearchButton (modal flow) and the MobileAlertBar (quick-save flow). Rather than constructing it in two places, a shared `useMemo` (`savedSearchCriteria`) was extracted in `HomeClient.tsx` and passed to both components.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/components/browse/MobileAlertBar.tsx` | Sticky mobile one-tap alert bar |
| `src/app/api/notifications/recent/route.ts` | Notification data API endpoint |
| `src/hooks/useNotifications.ts` | Notification polling hook with conditional activation |
| `src/components/notifications/NotificationBell.tsx` | Header bell icon + dropdown with read/unread styling |
| `tests/api/notifications/recent.test.ts` | 12 tests for API endpoint |
| `tests/hooks/useNotifications.test.ts` | 11 tests for polling hook |
| `tests/components/browse/MobileAlertBar.test.tsx` | 11 tests for mobile alert bar |
| `tests/components/browse/SaveSearchButton.test.tsx` | 5 tests for renamed button |
| `tests/components/browse/SaveSearchModal.test.tsx` | 2 tests for default frequency |

## Files Modified

| File | Change |
|------|--------|
| `src/components/browse/SaveSearchButton.tsx` | Bell icon, "Get Alerts" label, category filter fix |
| `src/components/browse/SaveSearchModal.tsx` | Default frequency `daily` to `instant` |
| `src/app/HomeClient.tsx` | MobileAlertBar integration, shared `savedSearchCriteria` memo |
| `src/components/layout/Header.tsx` | NotificationBell replacing "Saved" text link |
| `src/app/saved/page.tsx` | Mark-as-read on page visit |
| `src/i18n/locales/en.json` | New i18n keys: `saveSearch.getAlerts`, `mobileAlert.*`, `notifications.*` |
| `src/i18n/locales/ja.json` | Matching Japanese translations |

---

## Test Coverage (41 tests, all passing)

| Test File | Count | Coverage |
|-----------|-------|---------|
| `tests/api/notifications/recent.test.ts` | 12 | Auth checks, empty states, full flow with listings/dealers, unread count with `since` param, listing ID caps, error handling |
| `tests/hooks/useNotifications.test.ts` | 11 | Logged out state, initial fetch, polling gate (`hasSavedSearches`), `markAsRead` localStorage, logout reset, error resilience |
| `tests/components/browse/MobileAlertBar.test.tsx` | 11 | Visibility with/without filters, askOnly/query/price filters, quick-save with instant frequency, success toast, dismiss via sessionStorage, paywall gating, login modal |
| `tests/components/browse/SaveSearchButton.test.tsx` | 5 | Hidden without filters, "Get Alerts" label, bell icon SVG path, title attribute |
| `tests/components/browse/SaveSearchModal.test.tsx` | 2 | Defaults to instant frequency, closed state |

---

## Bug Fixes During Deployment

### 1. TypeScript error: `category !== 'all'`

`SavedSearchCriteria.category` is typed as `'nihonto' | 'tosogu' | 'armor'` — the string `'all'` is not in the union, so the comparison `category !== 'all'` was a type error. The comparison was unnecessary (the category value was already validated upstream) and was removed.

**Commit:** `a52f573`

### 2. Build error: `smartCropEnabled` reference

In-progress focal point feature code was accidentally included in `HomeClient.tsx` — properties `smartCropEnabled` and `focalPoints` were passed to components that didn't accept them. Removed the unreferenced properties.

**Commit:** `77daaf9`

### 3. Notification dropdown links not navigating

`<Link>` components inside the notification dropdown were unmounting before navigation completed because the `onClick` handler set `open = false`, which removed the dropdown (and its `<Link>` children) from the DOM before Next.js could process the navigation.

First fix: switched to `router.push()`. Final fix: switched to `openQuickView()` to open the QuickView modal directly, which is the better UX (user stays on the browse page, no full page navigation).

**Commits:** `8cd6903`, `104e151`

---

## Commits

| Hash | Message |
|------|---------|
| `832a4c3` | `feat: Make alerts obvious — bell icon, CTA rename, mobile save bar, notification dropdown` |
| `a52f573` | `fix: Remove invalid category !== 'all' comparison that broke Vercel build` |
| `77daaf9` | `fix: Remove accidentally committed smartCrop references from HomeClient` |
| `8cd6903` | `fix: Notification dropdown links not navigating — use router.push` |
| `104e151` | `fix: Notification items open QuickView modal instead of navigating to listing page` |
| `ff0557d` | `feat: Read/unread styling for notification dropdown items` |

---

## Design Decisions

### Why QuickView instead of page navigation for notifications

When a user clicks a notification item (e.g., "3 new katana from Aoi Art"), the natural expectation is to see the listing immediately. Full page navigation to `/listing/[id]` would lose the browse context and feel heavy. Opening the QuickView modal keeps the user in flow — they can preview the listing, dismiss it, and check the next notification without round-tripping.

### Why conditional polling instead of WebSocket/SSE

The notification volume is low (most users have 0-5 saved searches, alerts fire at most every 15 minutes). A 60-second polling interval with conditional activation (only when `hasSavedSearches === true`) means zero API calls for casual visitors and at most 1 req/min for power users. WebSocket infrastructure would be over-engineered for this volume and would require additional Vercel configuration.

### Why sessionStorage for dismiss instead of localStorage

The MobileAlertBar dismiss state uses `sessionStorage` so it reappears on the next browser session. If it used `localStorage`, a user who dismissed it once would never see it again — even if they returned weeks later with different filters. Session-scoped dismissal balances respect for user preference with continued visibility.

### Why snapshot `readSince` on dropdown open

Without the snapshot, opening the dropdown would immediately mark everything as read and clear the visual distinction. The snapshot preserves the unread styling during the current viewing session so users can visually scan which notifications are new. The badge count clears immediately (signaling "you've acknowledged these"), but the item-level styling persists until the dropdown closes.
