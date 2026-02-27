# User Feedback & Reporting System

**Date:** 2026-02-27
**Status:** Complete — 71 tests passing, deployed to production

## Overview

Two-channel feedback system: users can (a) flag inaccurate data on listings and artist pages, and (b) submit general feedback (bugs, features) from the nav. All submissions stored in Supabase `user_feedback` table, triaged via admin panel at `/admin/feedback`.

### Design Principles

- **Auth required** — only logged-in users can submit (prevents spam, links to accounts)
- **Free text only** — no category dropdowns for data reports. "What's wrong?" textarea.
- **General feedback** — simple 3-pill type toggle (Bug / Feature idea / Other) + free text
- **Admin panel is the dashboard** — no email notifications (intentionally removed as unnecessary)

---

## Architecture

```
User clicks flag/feedback icon
         ↓
  FeedbackModal / ReportModal
    (thin wrappers)
         ↓
  useFeedbackSubmit (shared hook)
         ↓
  FeedbackModalShell (shared UI)
         ↓
  POST /api/feedback
    → auth check
    → validate (type, message, target)
    → rate limit (10/hr/user via DB count)
    → insert to user_feedback (RLS: user inserts own)
         ↓
  Admin views at /admin/feedback
    → GET /api/admin/feedback (paginated, filtered, summary counts)
    → PATCH /api/admin/feedback/[id] (status + notes)
```

### Component Hierarchy

```
FeedbackButton (nav icon)
  └─ FeedbackModal
       └─ useFeedbackSubmit (hook)
       └─ FeedbackModalShell (portal-rendered modal)
            └─ Type pills (children slot)

Flag button (QuickView action bars / artist page)
  └─ ReportModal
       └─ useFeedbackSubmit (hook, basePayload = data_report + target)
       └─ FeedbackModalShell
```

The key DRY pattern: `useFeedbackSubmit` extracts all state management (message, submitting, success, error), escape-to-close, auto-dismiss on success, and the fetch call. `FeedbackModalShell` extracts the portal-rendered modal UI with title, subtitle, children slot (for type pills), textarea, submit/cancel, and success state. Both concrete modals are thin wrappers (~45-65 lines each).

---

## Database

### Table: `user_feedback`

**Migration:** `supabase/migrations/093_user_feedback.sql`

```sql
CREATE TABLE public.user_feedback (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,        -- 'data_report' | 'bug' | 'feature_request' | 'other'
  target_type   TEXT,                 -- 'listing' | 'artist' | NULL
  target_id     TEXT,                 -- listing.id or artisan code | NULL
  target_label  TEXT,                 -- snapshot: listing title or artisan name
  message       TEXT NOT NULL,
  page_url      TEXT,                 -- auto-captured via window.location.href
  status        TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  admin_notes   TEXT,
  resolved_by   UUID REFERENCES auth.users(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `(status, created_at DESC)` — admin list default view
- `(user_id)` — rate limit check
- `(target_type, target_id) WHERE target_id IS NOT NULL` — future: aggregate reports per item

**RLS policies:**
- `users_insert_own` — `auth.uid() = user_id` (INSERT)
- `users_read_own` — `auth.uid() = user_id` (SELECT)
- `service_role_all` — service role full access (admin APIs)

### Supabase Type Note

`user_feedback` is not in the auto-generated Supabase types (`database.ts`). All `.from('user_feedback')` calls use `as any` cast, following the same pattern as `user_collection_items` and other tables added after initial type generation.

---

## API Routes

### POST `/api/feedback`

**Auth:** User must be logged in (checks `supabase.auth.getUser()`)
**Rate limit:** Max 10 submissions per hour per user (DB count check)
**Body:**
```json
{
  "feedback_type": "bug",           // required: data_report | bug | feature_request | other
  "target_type": "listing",         // optional: listing | artist
  "target_id": "42",                // optional: listing ID or artisan code
  "target_label": "Katana by ...",  // optional: snapshot label for admin readability
  "message": "...",                 // required: 1-2000 chars, trimmed
  "page_url": "https://..."        // optional: auto-captured by client
}
```
**Returns:** `{ id: number, status: 'open' }` on success

### GET `/api/admin/feedback`

**Auth:** `verifyAdmin()` — 401/403 for non-admins
**Query params:** `?status=open&type=bug&page=1&limit=50`
**Returns:**
```json
{
  "data": [{ ...feedback, "user_display_name": "Alice" }, ...],
  "total": 42,
  "summary": { "open": 5, "data_reports": 3, "bugs": 2, "features": 1 }
}
```
Summary counts are **true DB totals** from 4 parallel `head: true` count queries, not page-scoped.

### PATCH `/api/admin/feedback/[id]`

**Auth:** `verifyAdmin()`
**Body:** `{ status?: string, admin_notes?: string }`
**Behavior:**
- Setting status to `resolved` or `dismissed` auto-sets `resolved_by` (admin user ID) and `resolved_at`
- Setting status to `open` or `acknowledged` clears `resolved_by`/`resolved_at`

---

## UI Entry Points

### 1. Nav Feedback Button

**File:** `src/components/feedback/FeedbackButton.tsx`
- Chat bubble SVG icon, same size as NotificationBell
- Auth-gated (only visible when logged in)
- Style: `text-muted hover:text-gold`
- Opens `FeedbackModal`

**Placed in:**
- Desktop: `Header.tsx` — before NotificationBell in nav
- Mobile: `MobileNavDrawer.tsx` — in user links section

### 2. Listing Flag Button (Desktop QuickView)

**File:** `src/components/listing/quickview-slots/BrowseActionBar.tsx`
- Flag icon after FavoriteButton
- Auth-gated
- Style: `text-muted hover:text-red-500 hover:bg-red-50/50`
- Opens `ReportModal` with `target_type: 'listing'`

### 3. Listing Flag Button (Mobile QuickView)

**File:** `src/components/listing/quickview-slots/BrowseMobileHeaderActions.tsx`
- Same flag icon, added after FavoriteButton
- Auth-gated
- Opens `ReportModal` with `target_type: 'listing'`

### 4. Artist Page Flag Button

**File:** `src/app/artists/[slug]/ArtistPageClient.tsx`
- Flag icon + text label ("Report an issue") in breadcrumb/share row
- Auth-gated
- Opens `ReportModal` with `target_type: 'artist'`, `target_id: entity.code`

### 5. Admin Panel

**File:** `src/app/admin/feedback/page.tsx`
- Linked from admin dropdown in Header ("Feedback" with chat bubble icon)
- Metric cards: Open, Data Reports, Bugs, Features (true DB totals)
- Status tabs: Open | Acknowledged | Resolved | All
- Type filter dropdown
- Table: Time | Type | Target (linked) | Message (truncated) | User | Status
- Click row to expand: full message, admin notes textarea, status dropdown, save button
- Pagination (50 per page)

---

## Shared Components

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| `useFeedbackSubmit` | `src/components/feedback/useFeedbackSubmit.ts` | 83 | Shared hook: state, escape-to-close, auto-dismiss, rate limit handling |
| `FeedbackModalShell` | `src/components/feedback/FeedbackModalShell.tsx` | 118 | Portal-rendered modal: title, subtitle, children slot, textarea, submit/cancel, success |
| `FeedbackModal` | `src/components/feedback/FeedbackModal.tsx` | 65 | General feedback: type pills as children, passes `feedback_type` override |
| `ReportModal` | `src/components/feedback/ReportModal.tsx` | 45 | Data report: passes `basePayload` with target info + `data_report` type |
| `FeedbackButton` | `src/components/feedback/FeedbackButton.tsx` | 39 | Nav icon: chat bubble, auth-gated, opens FeedbackModal |

---

## i18n

16 keys added to both `en.json` and `ja.json`:

| Key | EN | JA |
|-----|----|----|
| `feedback.reportIssue` | Report an issue | 問題を報告 |
| `feedback.whatLooksWrong` | What looks wrong? | どこが間違っていますか？ |
| `feedback.sendFeedback` | Send feedback | フィードバックを送信 |
| `feedback.tellUs` | Tell us what's on your mind... | ご意見をお聞かせください... |
| `feedback.bug` | Bug | バグ |
| `feedback.featureIdea` | Feature idea | 機能リクエスト |
| `feedback.other` | Other | その他 |
| `feedback.submit` | Submit | 送信 |
| `feedback.cancel` | Cancel | キャンセル |
| `feedback.thanks` | Thanks — we'll look into it | ありがとうございます — 確認いたします |
| `feedback.thanksFeedback` | Thanks for your feedback! | フィードバックありがとうございます！ |
| `feedback.rateLimited` | Too many submissions... | 送信回数が多すぎます... |
| `feedback.submitError` | Something went wrong... | エラーが発生しました... |
| `feedback.signInRequired` | Please sign in... | フィードバックを送信するには... |
| `nav.feedback` | Feedback | フィードバック |
| `admin.feedback` | Feedback | フィードバック |

---

## Tests

**71 tests across 3 files:**

| File | Tests | Coverage |
|------|-------|---------|
| `tests/api/feedback.test.ts` | 20 | Auth, validation (type/message/target), rate limiting (window + user check), insert fields, error handling |
| `tests/api/admin-feedback.test.ts` | 24 | Admin auth (401/403), data enrichment (display names), summary counts, status/type filters, pagination, limit cap, sort order, PATCH validation, status lifecycle (resolved_by auto-set/clear), notes, service client |
| `tests/components/feedback/FeedbackModals.test.tsx` | 27 | FeedbackModalShell: open/close, title/subtitle, children slot, success state, disabled states, error, backdrop click, textarea. FeedbackModal: type pills, default type, submit payload. ReportModal: target display, data_report type, success/rate-limit/error states, page_url capture |

---

## Files Created/Modified

| Action | File |
|--------|------|
| **Create** | `supabase/migrations/093_user_feedback.sql` |
| **Create** | `src/types/feedback.ts` |
| **Create** | `src/app/api/feedback/route.ts` |
| **Create** | `src/app/api/admin/feedback/route.ts` |
| **Create** | `src/app/api/admin/feedback/[id]/route.ts` |
| **Create** | `src/components/feedback/useFeedbackSubmit.ts` |
| **Create** | `src/components/feedback/FeedbackModalShell.tsx` |
| **Create** | `src/components/feedback/FeedbackModal.tsx` |
| **Create** | `src/components/feedback/ReportModal.tsx` |
| **Create** | `src/components/feedback/FeedbackButton.tsx` |
| **Create** | `src/app/admin/feedback/page.tsx` |
| **Create** | `tests/api/feedback.test.ts` |
| **Create** | `tests/api/admin-feedback.test.ts` |
| **Create** | `tests/components/feedback/FeedbackModals.test.tsx` |
| **Edit** | `src/types/database.ts` — added `user_feedback` table type |
| **Edit** | `src/components/listing/quickview-slots/BrowseActionBar.tsx` — flag button |
| **Edit** | `src/components/listing/quickview-slots/BrowseMobileHeaderActions.tsx` — flag button |
| **Edit** | `src/app/artists/[slug]/ArtistPageClient.tsx` — flag button + text label |
| **Edit** | `src/components/layout/Header.tsx` — FeedbackButton + admin nav link |
| **Edit** | `src/components/layout/MobileNavDrawer.tsx` — feedback button + modal |
| **Edit** | `src/i18n/locales/en.json` — 16 feedback keys |
| **Edit** | `src/i18n/locales/ja.json` — 16 feedback keys |
