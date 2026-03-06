# Session: Dealer Portal MVP (2026-03-03)

**Date:** 2026-03-03 (updated 2026-03-05)
**Status:** Phase 1 + Phase 2 UX complete (behind feature flag). Phase 2 (inquiries) and Phase 3 (go-live) pending.
**Build spec:** `docs/DEALER_MVP_BUILD.md`

---

## Context

Sokendo (創建堂) is NihontoWatch's first dealer partner. They have no website — all stock is unlisted. A contact at Sokendo will use their mobile browser to upload listings and receive inquiries via LINE.

This session implements Phase 1: dealer authentication, listing CRUD, image upload, a mobile-first form, dealer-specific QuickView slots, and a testing gate that hides dealer listings from the public browse until the feature flag is flipped.

---

## What Was Built

### Database (Migration 097)

**File:** `supabase/migrations/097_dealer_portal.sql`

| Change | Purpose |
|--------|---------|
| `profiles.dealer_id` (FK → dealers) | Links user accounts to dealer entities |
| `listings.source` (TEXT, default 'scraper') | Distinguishes scraper-crawled from dealer-uploaded listings |
| `inquiries` table (Phase 2 schema) | Direct collector→dealer messaging, with RLS |
| `dealers.line_notify_token` | LINE notification token for Phase 2 |
| CHECK constraint fix | Updated `profiles_subscription_tier_check` to include `'collector'`, `'inner_circle'` |

Indexes: `idx_profiles_dealer_id` (partial, WHERE dealer_id IS NOT NULL), `idx_listings_source` (partial, WHERE source = 'dealer').

### Auth Infrastructure

**`src/lib/dealer/auth.ts`** — `verifyDealer()` mirrors `verifyAdmin()`. Checks `subscription_tier = 'dealer'` AND `dealer_id IS NOT NULL`. Admins also pass (for testing/support).

**`src/middleware.ts`** — Added `/dealer` page + `/api/dealer` API protection. Unauthenticated → redirect to `/?login=dealer`. Not dealer tier → redirect to `/`. Admins bypass.

**`src/lib/auth/AuthContext.tsx`** — Added `isDealer: boolean` and `dealerId: number | null` to `AuthState`. Updated all 6 state construction sites (initial, INITIAL_SESSION with user, INITIAL_SESSION without user, SIGNED_IN, SIGNED_OUT, signOut). Auth cache includes both new fields.

**`src/types/database.ts`** — Added `dealer_id: number | null` to profiles Row/Insert.

### Testing Gate

Three insertion points hide dealer listings from public browse while `NEXT_PUBLIC_DEALER_LISTINGS_LIVE !== 'true'`:

| File | Guard |
|------|-------|
| `src/app/api/browse/route.ts` | `.neq('source', 'dealer')` after admin_hidden filter |
| `src/lib/listing/getListingDetail.ts` | Returns `null` (404) for `source === 'dealer'` |
| `src/app/api/cron/compute-featured-scores/route.ts` | Excludes dealer listings from score computation |

**Phase 3 go-live:** Set `NEXT_PUBLIC_DEALER_LISTINGS_LIVE=true` in Vercel → all three gates open.

### Dealer Listing APIs

**`/api/dealer/listings` (GET + POST)**
- GET: Scoped to `dealer_id` + `source = 'dealer'`. Tab filter: inventory/available/sold (3-state lifecycle). Default tab: `inventory`. Ordered by `first_seen_at DESC`.
- POST: Generates synthetic URL `nw://dealer/{dealerId}/{uuid}` (satisfies UNIQUE NOT NULL). Sets `source = 'dealer'`, `is_initial_import = false`. Accepts `status` from body (default `'INVENTORY'`). Routes artisan fields based on `item_category` (nihonto → smith/school, tosogu → tosogu_maker/tosogu_school).

**`/api/dealer/listings/[id]` (PATCH + DELETE)**
- PATCH: Allowlisted fields only. Status changes trigger side effects (SOLD → is_available=false/is_sold=true, INVENTORY → is_available=false/is_sold=false, AVAILABLE → is_available=true/is_sold=false).
- DELETE: Only for INVENTORY or WITHDRAWN listings.

**`/api/dealer/images` (POST + DELETE)**
- Bucket: `dealer-images`. Path: `{dealerId}/{listingId}/{uuid}.{ext}`.
- Ownership verification: listing must belong to dealer AND have `source = 'dealer'`.
- Images stored as public URLs in the listing's `images` JSONB array.

### ImageUploadZone Extension

**`src/components/collection/ImageUploadZone.tsx`** — Added `apiEndpoint` prop (default: `'/api/collection/images'`). Three hardcoded fetch paths replaced with the prop. `uploadPendingFiles()` also accepts `apiEndpoint` as third parameter.

### DisplayItem Extension

**`src/types/displayItem.ts`** — Added `DealerExtension { isOwnListing: boolean }` and `dealer?: DealerExtension | null` field. `DisplayItemSource` already had `'dealer'` (pre-existing).

**`src/lib/displayItem/fromDealerListing.ts`** — `dealerListingToDisplayItem()` delegates to `listingToDisplayItem()` for 95% of fields, overrides `source: 'dealer'`, adds dealer extension.

### Title Generator

**`src/lib/dealer/titleGenerator.ts`** — `generateListingTitle(cert, type, artisanName, artisanKanji)` → `{ en, ja }`. Pattern: `{cert} {type} — {artisan}`. Uses lookup tables for EN→JA cert/type mappings (e.g., Juyo → 重要刀剣, katana → 刀).

### Form Components

| Component | Purpose |
|-----------|---------|
| `CategorySelector.tsx` | Nihonto (刀剣) / Tosogu (刀装具) toggle |
| `TypePills.tsx` | Category-dependent type pills (katana, wakizashi... or tsuba, fuchi-kashira...) |
| `CertPills.tsx` | Tokubetsu Juyo / Juyo / Tokubetsu Hozon / Hozon / None |
| `DealerListingForm.tsx` | Full mobile-first form (9 sections, 2-phase submit, sticky memory, success screen) |

**DealerListingForm** key behaviors:
- Reuses `ArtisanSearchPanel` (domain prop from category) and `ImageUploadZone` (apiEndpoint override)
- Auto-generates title reactively from cert + type + artisan
- Sticky memory: category and type persisted in localStorage
- Two-phase submit: POST listing → upload pending images → complete
- Success screen with "Add Another" (resets form, keeps sticky) and "Back to My Listings"

### Dealer Pages

**`/dealer`** — Grid of dealer's listings with 3-state tabs (Inventory/For Sale/Sold). Default: Inventory. Uses `ListingGrid` with `preMappedItems` (same pattern as collection page). Mobile FAB for quick add. Card click opens QuickView with `source: 'dealer'`. Listing cards show colored status badge in header row (amber=Inventory, green=For Sale, muted=Sold).

**`/dealer/new`** — Back button + `DealerListingForm` in add mode.

### QuickView Dealer Slots

4 new slot components in `src/components/listing/quickview-slots/`:

| Slot | Desktop | Mobile |
|------|---------|--------|
| Action bar | `DealerActionBar` — Edit, Mark Sold, Move to Inventory | `DealerMobileHeaderActions` — same buttons |
| CTA | `DealerCTA` — "List for Sale" button (inventory) or status text | `DealerMobileCTA` — same |

**QuickView.tsx** slot assembly changed from binary (`isCollection ? ... : ...`) to 3-way (`isDealer ? ... : isCollection ? ... : ...`). Admin tools slot excluded for dealer source.

**QuickViewContext.tsx** — `source` state type widened to `'browse' | 'collection' | 'dealer'`. `openQuickView()` accepts `{ source: 'dealer' }` option. `updateUrl()` type widened to match.

### Nav Links

**Header.tsx** — Dealer nav link ("My Listings") before admin menu, gated on `isDealer`.
**MobileNavDrawer.tsx** — Dealer nav link with storefront icon before admin link.

### i18n Keys (~40 per locale)

All dealer UI strings added to both `en.json` and `ja.json`. Japanese strings use natural nihonto dealer terminology (出品する, 販売中, 売切れ, 取下げ, 応談, 刀工・金工, etc.).

---

## Component Reuse Matrix

| Component | Strategy | Changes |
|-----------|----------|---------|
| `ListingCard` | As-is | Zero |
| `ListingGrid` | As-is | Zero |
| `QuickViewContent` | As-is | Receives slots via props |
| `QuickViewMobileSheet` | As-is | Receives slots via props |
| `MetadataGrid` | As-is | Works from DisplayItem fields |
| `ArtisanSearchPanel` | As-is | Already has `domain` prop |
| `ImageUploadZone` | Extended | `apiEndpoint` prop (3 line changes) |
| `uploadPendingFiles()` | Extended | `apiEndpoint` parameter |
| `listingToDisplayItem()` | Reused as base | Dealer mapper delegates to this |
| `QuickView.tsx` | Extended | 3-way slot assembly |
| `QuickViewContext` | Extended | `'dealer'` source + option |

---

## Verification

- **TypeScript:** 0 errors
- **Build:** Succeeds. All dealer routes present (`/dealer`, `/dealer/new`, `/api/dealer/listings`, `/api/dealer/listings/[id]`, `/api/dealer/images`).
- **Tests:** 4,502 passed, 10 failed (3 files — all pre-existing failures confirmed by running on clean stash).

---

## Security Hardening Pass (Post-MVP Code Review)

A full code review after the MVP build identified 4 critical and 3 high-severity issues. All fixed in the same session. Verification: TypeScript 0 errors, 4,504 tests passed (8 pre-existing failures unchanged).

### Critical Fixes

**1. CertPills DB corruption** (`CertPills.tsx`)
"No Papers" button sent `'NONE_SELECTED'` as a literal string to the DB `cert_type` column. Both CSS branches were identical (no visual selected state). Fix: exported `CERT_NONE = 'none'` sentinel constant. Form converts `CERT_NONE → null` at submit time via `cert_type: certType === CERT_NONE ? null : certType`. Added `aria-pressed` to all pill buttons.

**2. Images bypass via PATCH allowlist** (`[id]/route.ts`)
`'images'` was in `ALLOWED_FIELDS`, allowing a dealer to PATCH arbitrary URLs into the `images` array — completely bypassing the `/api/dealer/images` upload validation (file type checks, size limits, dealer ownership). Fix: removed `'images'` from allowlist with comment explaining images are managed exclusively via the images endpoint.

**3. Path traversal in image DELETE** (`images/route.ts`)
The `storagePath.startsWith(\`${dealerId}/\`)` check passed for paths like `${dealerId}/../other-dealer/file.jpg`. A dealer could delete another dealer's storage files. Fix: reject any path containing `..` and treat null storagePath as forbidden (combined into single guard).

**4. Zero-price falsification** (`route.ts` POST)
`price_value || null` converted `0` to `null` (JavaScript falsy evaluation). Inquiry-based items with explicit `price_value: 0` would lose their value. Same issue for `nagasa_cm` and 10 other fields. Fix: changed all `|| null` to `?? null` (nullish coalescing) across 12 fields.

### High-Severity Fixes

**5. Silent API failures in action bars** (`DealerActionBar.tsx`, `DealerMobileHeaderActions.tsx`)
Both components had identical copy-pasted fetch logic. If the PATCH returned 4xx/5xx, the button stopped spinning with zero feedback — dealer thinks item is sold when it isn't. Fix: extracted `useDealerStatusChange` shared hook (`quickview-slots/useDealerStatusChange.ts`) with error state, auto-clear after 3s, and proper error surfacing. Both components show `!` indicator on failure.

**6. `onStatusChange` not wired in QuickView** (`QuickView.tsx`)
`DealerActionBar` and `DealerMobileHeaderActions` both accept `onStatusChange` but QuickView.tsx passed neither. After marking sold/withdrawn, the QuickView UI didn't update until closed and reopened. Fix: created `handleDealerStatusChange` callback using `refreshCurrentListing()` with optimistic status fields (`status`, `is_available`, `is_sold`). Wired to both desktop and mobile action bars.

**7. DealerPageClient silent errors + `any[]`** (`DealerPageClient.tsx`)
The fetch handler swallowed all errors — a 401 (expired session) or 500 was indistinguishable from having zero listings. `listings` was typed as `any[]`, defeating TypeScript. Fix: added `fetchError` state with retry button, typed `listings` as `Listing[]`, handles 401 specifically with localized session-expired message.

### Additional Polish
- Dark mode support on error banner (`bg-red-50 dark:bg-red-950/30`) and success checkmark in `DealerListingForm.tsx`
- `try/catch` around `request.json()` in both POST and PATCH routes — malformed JSON now returns 400 instead of unhandled 500
- Error check added on listing images array update in DELETE handler (was silently ignored)
- 9 new i18n keys in both `en.json` and `ja.json`

### New File
`src/components/listing/quickview-slots/useDealerStatusChange.ts` — shared hook replacing copy-pasted fetch logic.

### Design Observations

Three structural choices flagged for Phase 2/3 refactoring:

1. **`source` conflates origin and context.** DB `listings.source` = data origin (`scraper`/`dealer`). `DisplayItem.source` = viewing context (`browse`/`collection`/`dealer`). A dealer listing in public browse has DB source `'dealer'` but display source `'browse'`. Better: split into `origin` and `context`. This is why source auto-detection (Gap 3) was needed — without it, browse would show dealer listings with wrong QuickView slots.

2. **DealerCTA and DealerMobileCTA are two files for a `py-3` vs `py-2` difference.** Should be one component with a variant prop.

3. **`dealerListingToDisplayItem`** is a 5-line passthrough of `listingToDisplayItem`. Could be a parameter rather than a separate file. The collection mapper earns its file (genuinely different field mapping); the dealer one doesn't.

---

## Known Gaps — Original (from Phase 1)

> Gaps 2–7 were fixed in the gap-fix session below. Gaps 1 and 8 remain.

### 1. Separate table vs. `source` column (Architectural) — DEFERRED

The `source` column on `listings` requires every query path to remember to filter on it. Separate `dealer_listings` table + UNION view would be cleaner but high effort for low ROI right now.

### 8. `dealer-images` bucket must be created manually — OPEN

The migration doesn't create Supabase Storage buckets (SQL can't do this). The `dealer-images` bucket needs to be created via Supabase dashboard with public read, authenticated write policy.

---

## Gap Fixes (2026-03-03, second session)

Seven gaps closed. Build: 0 errors. Tests: 4,504 passed (8 pre-existing failures in CollectionPageClient, confirmed on clean stash).

### Gap 3 — QuickView Source Auto-Detection (FIXED)

**Problem:** Source passed as call-site option, not inferred. Phase 3 browse would render wrong QuickView slots.

**Fix (3 files):**
- `src/lib/displayItem/fromListing.ts` — Added `source?: string | null` to `ListingInput`. Auto-detects `listing.source === 'dealer'` → sets `source: 'dealer'` + `dealer: { isOwnListing: false }` on DisplayItem.
- `src/contexts/QuickViewContext.tsx` — `openQuickView` auto-detects: checks `mappedListing.source === 'dealer'` or `url.startsWith('nw://')` before falling back to `'browse'`.
- `src/app/api/browse/route.ts` — Added `source` to SELECT fields so it flows to client.

### Gap 5 — Edit Mode Entry Point (FIXED)

**Problem:** Form supported `mode: 'edit'` but no page, no GET endpoint, no Edit button.

**Fix (5 artifacts + i18n):**
- `src/app/api/dealer/listings/[id]/route.ts` — Added `GET` handler. SELECT same fields as form `initialData`. Ownership check via `.eq('dealer_id', auth.dealerId).eq('source', 'dealer')`.
- `src/app/dealer/edit/[id]/page.tsx` — New server page, `force-dynamic`.
- `src/app/dealer/edit/[id]/DealerEditListingClient.tsx` — Fetches GET, shows loading → error → `DealerListingForm mode="edit"`.
- `src/components/listing/quickview-slots/DealerActionBar.tsx` — Pencil icon before Mark Sold. Uses `dismissForNavigation()` + `router.push()`.
- `src/components/listing/quickview-slots/DealerMobileHeaderActions.tsx` — Same pencil icon with `stopPropagation` guards.

### Gap 2 — Synthetic URL Guards (FIXED)

**Problem:** `ListingDetailClient.tsx` renders `<a href={listing.url}>` — breaks for `nw://` URLs.

**Fix (1 file):**
- `src/app/listing/[id]/ListingDetailClient.tsx` — Both `<a href>` blocks wrapped: `isDealerListing` → disabled placeholder span ("Inquiries coming soon" / "お問い合わせ機能は近日公開"). `trackDealerClick` skips for dealer listings.

### Gap 4 — Image Upload Retry (FIXED)

**Problem:** POST creates listing, images upload separately. Upload failure = imageless listing, no retry.

**Fix (1 file):**
- `src/components/dealer/DealerListingForm.tsx` — Added `imageUploadFailed` + `createdListingId` state. Upload wrapped in try/catch. Failure shows retry screen: "Retry Upload" retries the upload, "Skip for now" proceeds to success screen.

### Gap 6 — Remove `artisan_admin_locked` from Dealer POST (FIXED)

**Problem:** Dealer-set artisans got `artisan_admin_locked = true`, blocking admin QA corrections.

**Fix (1 file):**
- `src/app/api/dealer/listings/route.ts` — Removed `listingData.artisan_admin_locked = true`. Dealer listings are protected from scraper by `source = 'dealer'` guards in Oshi-scrapper, not by the admin lock flag.

### Gap 7 — Oshi-scrapper Guards (FIXED)

**Problem:** Scraper would process dealer listings incorrectly (fetch nw:// URLs, overwrite artisans).

**Fix (3 files in Oshi-scrapper):**
- `db/repository.py` — `get_stale_listings()`: `.neq("source", "dealer")`. `upsert()`: defense-in-depth skip if `existing.source == 'dealer'`.
- `scripts/batch_match_unmatched.py` — `.neq("source", "dealer")` on both query blocks (smith + tosogu_maker).
- `artisan_matcher/matcher.py` — `save_result()`: expanded SELECT to include `source`, skips if `source == 'dealer'`.

---

## Remaining Tech Debt (post gap-fix)

### 1. QuickView stores `Listing`, not `DisplayItem` — type-unsafe source detection

Source auto-detection in QuickViewContext uses `(mappedListing as any).source` because `Listing` type lacks `source` field. The browse API returns it as a dynamic property that flows through untyped.

**Risk:** If `Listing` type is tightened or data is serialized, detection silently breaks.

**Fix options:**
- a) Add `source?: string | null` to `Listing` type in `src/types/index.ts` (minimal, safe)
- b) Refactor QuickView to store `DisplayItem` instead of `Listing` (proper fix, bigger scope)

### 2. Edit mode doesn't call `uploadPendingFiles()` — hidden coupling

Edit mode works because ImageUploadZone uploads immediately when `itemId` is provided. If ImageUploadZone ever queues files regardless of `itemId`, edit mode silently drops new images. The retry mechanism only covers `mode === 'add'`.

### 3. `upsert()` guard is dead code

The defense-in-depth check in `repository.py` (`if existing.source == 'dealer'`) can never fire — the scraper never generates `nw://` URLs, so `get_by_url()` never finds dealer listings as `existing`. Harmless but misleading.

### 4. `dealer.fetchError` i18n says "listings" (plural)

The edit page uses the same key for a single listing fetch failure. Minor cosmetic issue.

---

## Phase 2 Checklist (Inquiry System)

Schema is ready (inquiries table created in migration 097). Remaining work:

- [ ] `DealerInquiryModal` component (simple text form + collector profile preview)
- [ ] `/api/dealer/inquiries` (GET for dealer, POST for collectors, rate limit 3/listing/user/day)
- [ ] LINE Notify helper (`src/lib/notifications/line.ts`)
- [ ] BrowseCTA extension: detect `nw://` prefix → show "Inquire" instead of "Visit Dealer"
- [ ] Inquiry detail page (`/dealer/inquiries/[id]`)

## Phase 3 Checklist (Go-Live)

- [ ] Set `NEXT_PUBLIC_DEALER_LISTINGS_LIVE=true` in Vercel
- [x] ~~Add `source = 'dealer'` guards to Oshi-scrapper~~ (done in gap fixes)
- [ ] Create `dealer-images` Storage bucket (Supabase Dashboard → Storage → New Bucket → `dealer-images` → Public)
- [ ] Create Sokendo dealer account via SQL: set `subscription_tier = 'dealer'`, `dealer_id = {sokendo_dealer_id}` on profile
- [ ] QA: verify listings appear in browse, QuickView shows correct slots, featured scores compute
- [ ] QA: verify edit flow (open QuickView → pencil → form pre-fills → save → redirects)

---

## File Inventory

### New Files — Phase 1 (19) + Gap Fixes (3) + Hardening (1)

```
supabase/migrations/097_dealer_portal.sql
src/lib/dealer/auth.ts
src/lib/dealer/titleGenerator.ts
src/lib/displayItem/fromDealerListing.ts
src/app/api/dealer/listings/route.ts
src/app/api/dealer/listings/[id]/route.ts
src/app/api/dealer/images/route.ts
src/components/dealer/CategorySelector.tsx
src/components/dealer/TypePills.tsx
src/components/dealer/CertPills.tsx
src/components/dealer/DealerListingForm.tsx
src/app/dealer/page.tsx
src/app/dealer/DealerPageClient.tsx
src/app/dealer/new/page.tsx
src/app/dealer/new/DealerNewListingClient.tsx
src/components/listing/quickview-slots/DealerActionBar.tsx
src/components/listing/quickview-slots/DealerCTA.tsx
src/components/listing/quickview-slots/DealerMobileHeaderActions.tsx
src/components/listing/quickview-slots/DealerMobileCTA.tsx
# Gap fixes:
src/app/dealer/edit/[id]/page.tsx
src/app/dealer/edit/[id]/DealerEditListingClient.tsx
src/components/listing/quickview-slots/useDealerStatusChange.ts
```

### Modified Files — Phase 1 (14) + Gap Fixes (12) + Hardening (10)

```
# Phase 1:
src/middleware.ts
src/lib/auth/AuthContext.tsx
src/types/database.ts
src/types/displayItem.ts
src/lib/displayItem/index.ts
src/components/collection/ImageUploadZone.tsx
src/app/api/browse/route.ts
src/lib/listing/getListingDetail.ts
src/app/api/cron/compute-featured-scores/route.ts
src/components/listing/QuickView.tsx
src/contexts/QuickViewContext.tsx
src/components/listing/quickview-slots/index.ts
src/components/layout/Header.tsx
src/components/layout/MobileNavDrawer.tsx
src/i18n/locales/en.json
src/i18n/locales/ja.json
# Gap fixes (NihontoWatch):
src/lib/displayItem/fromListing.ts
src/app/api/dealer/listings/[id]/route.ts (added GET)
src/app/api/dealer/listings/route.ts (removed artisan_admin_locked)
src/components/dealer/DealerListingForm.tsx (upload retry)
src/app/listing/[id]/ListingDetailClient.tsx (nw:// guards)
# Gap fixes (Oshi-scrapper):
Oshi-scrapper/db/repository.py
Oshi-scrapper/scripts/batch_match_unmatched.py
Oshi-scrapper/artisan_matcher/matcher.py
# Hardening pass:
src/components/dealer/CertPills.tsx (CERT_NONE sentinel, aria-pressed)
src/components/dealer/DealerListingForm.tsx (CERT_NONE import, dark mode)
src/app/api/dealer/listings/route.ts (try/catch, ?? null)
src/app/api/dealer/listings/[id]/route.ts (try/catch, removed images from allowlist)
src/app/api/dealer/images/route.ts (path traversal fix, error check)
src/components/listing/QuickView.tsx (handleDealerStatusChange wiring)
src/components/listing/quickview-slots/DealerActionBar.tsx (shared hook, error state)
src/components/listing/quickview-slots/DealerMobileHeaderActions.tsx (shared hook, error state)
src/app/dealer/DealerPageClient.tsx (error state, Listing[] typing)
src/i18n/locales/en.json + ja.json (9 new keys)
```

### Test Files (7) — Golden Tests

```
tests/lib/dealer/auth.test.ts              # 11 tests — verifyDealer() auth gate
tests/lib/dealer/titleGenerator.test.ts    # 21 tests — bilingual title generation
tests/lib/dealer/displayItem.test.ts       # 12 tests — source auto-detection + dealer mapper
tests/lib/dealer/listingApi.test.ts        # 28 tests — field routing, allowlist, status, nullish coalescing, CERT_NONE
tests/lib/dealer/imagesSecurity.test.ts    # 23 tests — path traversal, ownership, upload constraints
tests/lib/dealer/testingGate.test.ts       # 14 tests — 3 insertion points + go-live simulation
tests/lib/dealer/statusChangeHook.test.ts  # 12 tests — useDealerStatusChange hook error handling
```

**Total: 121 golden tests.** All pass. Full inventory in `tests/COVERAGE.md` → "Dealer Portal" section.

---

## Deployment & QA Fixes (2026-03-03, third session)

### Deployment Steps

1. **Migration 097 applied to prod** via `supabase db push --include-all`. Adds `listings.source`, `profiles.dealer_id`, `inquiries` table, `dealers.line_notify_token`.
2. **Code committed and pushed** — commit `d27fb32` (51 files, 6,065 lines).
3. **Test dealer account created** — `christoph.hill0@gmail.com` set to `subscription_tier='dealer'`, `dealer_id=1` (Aoi Art).

### QA Bug #1 — Phantom DB columns (commit `50cd659`)

**Symptom:** GET `/api/dealer/listings` → 500. POST (publish) → 500.

**Root cause:** `artisan_display_name` and `artisan_name_kanji` are runtime enrichment fields added by the browse API, NOT actual DB columns. The dealer API SELECT and INSERT statements referenced them, causing Supabase `42703` errors ("column does not exist").

**Fix (3 files):**
- `src/app/api/dealer/listings/route.ts` — Removed `artisan_display_name`, `artisan_name_kanji` from GET SELECT. Removed from POST insert data and destructured body variables.
- `src/app/api/dealer/listings/[id]/route.ts` — Removed from GET SELECT and PATCH allowlist.
- `tests/lib/dealer/listingApi.test.ts` — Updated PATCH allowlist test to match.

**Lesson:** Fields that appear on the `Listing` TypeScript type may be runtime enrichments (added by API code after the DB query), not actual DB columns. Always verify against the DB schema before using in raw Supabase queries.

### QA Bug #2 — React error #310 (commit `e3c937f`)

**Symptom:** Clicking a dealer listing card in QuickView → crash: "Rendered more hooks than during the previous render."

**Root cause:** `handleDealerStatusChange` was declared as `useCallback` at line 276 of `QuickView.tsx` — AFTER the early return `if (!currentListing) return null` at line 256. When QuickView is closed (no listing), the component returns before this hook. When opened, React sees N+1 hooks vs N hooks → error #310.

**Fix (1 file):**
- `src/components/listing/QuickView.tsx` — Moved `handleDealerStatusChange` useCallback above the early return, alongside all other hooks.

**Lesson:** Every hook in a component must execute on every render. Never place `useCallback`/`useMemo`/`useState`/`useEffect` after an early return.

### QA Fix #3 — dealer-images storage bucket

**Symptom:** Image upload during listing creation failed silently. Listing created with `images: []`. Thumbnail visible in form (client-side preview) but not after save.

**Root cause:** The `dealer-images` Supabase Storage bucket didn't exist. Supabase migrations can't create storage buckets (SQL only).

**Fix:** Created bucket via Supabase Storage API:
```bash
curl -X POST "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"id": "dealer-images", "name": "dealer-images", "public": true}'
```

### Commit History

| Commit | Description |
|--------|-------------|
| `d27fb32` | feat: Dealer Portal MVP — Phase 1 complete (behind feature flag) |
| `50cd659` | fix: Remove phantom columns from dealer API queries |
| `e3c937f` | fix: Move useCallback above early return to prevent React #310 |
| `fa040ba` | feat: Dealer portal inventory model + desktop form fix |
| `ac4c8f1` | fix: Always save new listings to inventory — remove Save & List button |
| `df40e29` | feat: Add delete button for inventory items on edit page |
| `990a7b7` | fix: Status badges on dealer cards + fix "Withdrawn" → "Inventory" text |
| `9a2ae27` | fix: Replace confusing "List for Sale" icon with prominent CTA button |

---

## Inventory Model + UX Overhaul (2026-03-05)

### Motivation

Phase 2 deploy revealed two problems: (1) the desktop form submit button spanned the full viewport via `fixed bottom-0 inset-x-0` while form content was `max-w-lg`, and (2) the 4-tab model (Available/Sold/Withdrawn/All) was conceptually wrong — dealers think in terms of inventory, not withdrawal.

### Inventory Lifecycle

Replaced the 4-tab model with a 3-state lifecycle:

```
INVENTORY ──→ AVAILABLE (For Sale) ──→ SOLD
    ↑                   │
    └───────────────────┘  (Move to Inventory)
```

| State | `status` column | `is_available` | `is_sold` | Visible on NW browse? |
|-------|----------------|----------------|-----------|----------------------|
| Inventory | `INVENTORY` | false | false | No |
| For Sale | `AVAILABLE` | true | false | Yes |
| Sold | `SOLD` | false | true | No |

**Key design decision:** New listings ALWAYS go to Inventory first. No "Save & List" shortcut. Dealers are skittish — they want to review before going live. From Inventory, they list via the QuickView CTA button.

### Changes (10 files)

**API (2 files):**
- `api/dealer/listings/route.ts` — GET default tab → `inventory`. POST accepts `status` from body (default `INVENTORY`). Removed `withdrawn`/`all` tabs.
- `api/dealer/listings/[id]/route.ts` — PATCH handles `INVENTORY` status (replaces `WITHDRAWN`). DELETE allows `INVENTORY` or `WITHDRAWN`.

**Tabs (2 files):**
- `DealerPageClient.tsx` — 3 tabs: Inventory / For Sale / Sold. Default: Inventory.
- `DealerBottomBar.tsx` — Same 3-tab layout for mobile.

**Form (1 file):**
- `DealerListingForm.tsx` — Desktop fix: `lg:static lg:p-0 lg:mt-6 lg:bg-transparent lg:border-0` on button wrapper, `pb-24 lg:pb-0` on form container. Single "Save" button (always → INVENTORY). Success screen shows "Saved to Inventory" message. Delete button for inventory items (red text → confirm/cancel on tap).

**Status badges on cards (1 file):**
- `ListingCard.tsx` — Dealer-source cards show colored status in header row instead of dealer name: "Inventory" (amber), "For Sale" (green), "Sold" (muted).

**QuickView slots (4 files):**
- `DealerCTA.tsx` + `DealerMobileCTA.tsx` — Inventory items show a full-width gold "List for Sale" button (calls `useDealerStatusChange`). Available/Sold items show status text. Replaced old "Withdrawn" fallback → "Inventory".
- `DealerActionBar.tsx` + `DealerMobileHeaderActions.tsx` — Removed confusing "List for Sale" refresh icon. Available items: Edit + Mark Sold + Move to Inventory (box icon). Inventory items: Edit only (CTA handles listing).

**i18n (2 files):**
- Added keys: `dealer.tabInventory`, `dealer.tabForSale`, `dealer.saveToInventory`, `dealer.saveAndList`, `dealer.moveToInventory`, `dealer.listForSale`, `dealer.statusInventory`, `dealer.saving`, `dealer.savedToInventory`, `dealer.savedToInventoryDesc` (both EN + JA).

**Tests (1 file):**
- `listingApi.test.ts` — Updated status side effects (`WITHDRAWN` → `INVENTORY`), DELETE guard allows both `INVENTORY` and `WITHDRAWN`.

### UX Flow Summary

| Action | Where | How |
|--------|-------|-----|
| Create listing | `/dealer/new` | Fill form → "Save" → lands in Inventory tab |
| List for sale | QuickView on inventory item | Gold "List for Sale" CTA button |
| Mark sold | QuickView on listed item | Checkmark icon in action bar |
| Move back to inventory | QuickView on listed item | Box icon in action bar |
| Edit listing | QuickView → pencil icon | Opens `/dealer/edit/[id]` |
| Delete listing | Edit page (inventory items only) | Red "Delete" link → confirm/cancel |

### Remaining Gaps

1. **No smart crop on dealer images** — focal point cron only processes scraper listings
2. **No engagement metrics visible to dealers** — views, favorites, clicks data exists but isn't shown
3. ~~**No draft auto-save** — page refresh on add form = total data loss~~ (fixed in prior session)
4. **Dead i18n keys** — `dealer.tabWithdrawn`, `dealer.tabAll`, `dealer.publish`, `dealer.withdraw`, `dealer.relist` orphaned after inventory model change

---

## Metadata & UX Improvements (2026-03-05)

Audit-driven pass addressing data quality and UX gaps in the dealer listing form.

### Problems Found

1. **Signature/nakago conflation** — `mei_type` state controlled both the signature pills (zaimei, mumei…) and the nakago pills (ubu, suriage). Dealer could only select one from either group, and selecting a nakago type cleared the signature type.
2. **No tosogu fields** — Tosogu listings (tsuba, fuchi-kashira…) had no measurement inputs (height, width) and no material selector. Schema docs listed `height_cm`, `width_cm`, `material` but the columns were never migrated.
3. **Free-text era** — Era was a plain text input, producing inconsistent values ("Edo", "edo period", "江戸"). Browse filters use capitalized enum values.
4. **No school auto-fill** — Selecting an artisan from the search panel didn't populate the `school`/`tosogu_school` fields. Both were hardcoded to `null` in the payload.
5. **Leftover `bg-cream`** — New/edit listing pages and the submit bar still used `bg-cream` instead of `bg-surface`, causing visual mismatch with the main dealer page.

### Fixes

#### Phase 1: bg-cream → bg-surface (3 files)

| File | Change |
|------|--------|
| `DealerNewListingClient.tsx` | `bg-cream` → `bg-surface`, `bg-cream/95` → `bg-surface/95` |
| `DealerEditListingClient.tsx` | Same |
| `DealerListingForm.tsx` L758 | Submit bar `bg-cream/95` → `bg-surface/95` |

#### Phase 2: DB Migrations (099 + 100)

**`099_nakago_type.sql`** — `ALTER TABLE listings ADD COLUMN IF NOT EXISTS nakago_type TEXT`

**`100_tosogu_columns.sql`** — Adds `height_cm REAL`, `width_cm REAL`, `material TEXT` to listings. These were documented in the schema but never migrated. The GET SELECT referencing them caused **500 on every dealer listings fetch** until this migration was applied.

#### Phase 3: API Route Updates (2 files)

**`/api/dealer/listings` (route.ts):**
- GET SELECT: Added `nakago_type, motohaba_cm, sakihaba_cm, sori_cm, height_cm, width_cm, material` (note: `motohaba_cm, sakihaba_cm, sori_cm` were also missing — pre-existing bug that prevented edit mode from hydrating measurements)
- POST: Added `nakago_type`, `height_cm`, `width_cm`, `material` to destructure + listingData. Tosogu fields routed inside `if (item_category === 'tosogu')` branch.
- Added `console.error` for GET failures (was silently returning generic 500)

**`/api/dealer/listings/[id]` (route.ts):**
- GET SELECT: Same new columns added
- ALLOWED_FIELDS: Added `nakago_type`, `height_cm`, `width_cm`, `material`

#### Phase 4: DealerListingForm (all in one file)

**Types:**
- `DealerDraft`: Added `nakagoType: string[]`, `heightCm`, `widthCm`, `material`, `artisanSchool`
- `DealerListingInitialData`: Added `nakago_type`, `height_cm`, `width_cm`, `material`

**Constants:**
- `ERA_OPTIONS` — 11 period pills (Heian→Reiwa), values match browse filter conventions
- `MATERIAL_OPTIONS` — 8 tosogu materials (iron, shakudo, shibuichi, copper, gold, silver, sentoku, mixed)

**State (5 new variables):**
- `nakagoType: string[]` — multi-select array, hydrated by splitting comma-separated DB value
- `heightCm`, `widthCm` — string, decimal inputs for tosogu measurements
- `material: string | null` — single-select pill
- `artisanSchool: string | null` — auto-filled from artisan search result, category-aware hydration

**Nakago multi-select:**
- `nakagoType` is `string[]` (NOT `string | null`). Dealer can select both "ubu" AND "suriage" independently.
- Pills toggle in/out of array: `setNakagoType(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])`
- Payload joins to comma-separated: `nakago_type: nakagoType.length ? nakagoType.join(',') : null`
- DB column is `TEXT` — stores `"ubu"`, `"suriage"`, or `"ubu,suriage"`

**School auto-fill:**
- `handleArtisanSelect`: reads `result.school` from `ArtisanSearchResult` (already includes school field)
- Shows gold tag below artisan pill when school is non-null
- Payload: `school: category === 'nihonto' ? artisanSchool : null`, `tosogu_school: category === 'tosogu' ? artisanSchool : null`

**Era pills:**
- Free-text `<input>` replaced with 11 pill buttons using existing `period.*` i18n keys
- Click to select, click again to deselect. Same gold pill styling as TypePills/CertPills.

**Tosogu measurements:**
- Height/width inputs (2-col grid, decimal) shown when `category === 'tosogu'`
- Material pill selector (8 options) below measurements

**Category switch cleanup:**
- `useEffect` on `category` clears cross-category fields (skips initial render via ref)
- Switching to nihonto clears `heightCm`, `widthCm`, `material`
- Switching to tosogu clears `nagasaCm`, `motohabaCm`, `sakihabaCm`, `soriCm`, `meiType`, `nakagoType`

**Decimal validation:**
- `sanitizeDecimal()` helper prevents multiple decimal points (`1.2.3` → `1.23`)
- Applied to all 6 measurement inputs (4 nihonto + 2 tosogu)

**Category-aware school hydration:**
- Was: `initialData?.school || initialData?.tosogu_school` (arbitrary precedence if both populated)
- Now: `initialData?.item_category === 'tosogu' ? initialData?.tosogu_school : initialData?.school`

#### Phase 5: i18n (12 new keys per locale)

| Key | EN | JA |
|-----|----|----|
| `dealer.height` | Height (cm) | 高さ (cm) |
| `dealer.width` | Width (cm) | 幅 (cm) |
| `dealer.material` | Material | 素材 |
| `dealer.school` | School | 流派 |
| `dealer.materialIron` | Iron | 鉄 |
| `dealer.materialShakudo` | Shakudō | 赤銅 |
| `dealer.materialShibuichi` | Shibuichi | 四分一 |
| `dealer.materialCopper` | Copper | 銅 |
| `dealer.materialGold` | Gold | 金 |
| `dealer.materialSilver` | Silver | 銀 |
| `dealer.materialSentoku` | Sentoku | 宣徳 |
| `dealer.materialMixed` | Mixed | 合金 |

### Production Incident: Missing DB Columns

**Symptom:** After deploy, all dealer listings pages showed "Failed to load listings" — both existing test listings and newly created ones.

**Root cause:** The GET SELECT referenced `height_cm`, `width_cm`, `material` which were documented in the CLAUDE.md schema but **never actually created as DB columns**. No migration had ever added them. The plan assumed they existed ("The tosogu columns already exist in the listings table — no migration needed"). PostgREST returned a `42703` column-not-found error, caught by the generic error handler.

**Timeline:**
1. Commit `86b8c06` pushed with SELECT referencing nonexistent columns
2. Migration 099 (nakago_type only) applied — didn't include the missing columns
3. All dealer listing fetches fail with 500
4. Migration 100 created and applied — adds `height_cm REAL`, `width_cm REAL`, `material TEXT`
5. Commit `f7a0a78` pushed with migration 100

**Lesson:** Never trust schema documentation. Verify columns exist by checking migration files (`grep ADD COLUMN`), not CLAUDE.md.

### Commit History

| Commit | Description |
|--------|-------------|
| `86b8c06` | feat: dealer form metadata & UX improvements |
| `f7a0a78` | fix: add missing tosogu columns (height_cm, width_cm, material) |

### Modified Files (8)

```
supabase/migrations/099_nakago_type.sql              # NEW — nakago_type + tosogu columns
supabase/migrations/100_tosogu_columns.sql           # NEW — hotfix for missing columns
src/components/dealer/DealerListingForm.tsx           # Types, state, constants, UI, payload, draft
src/app/api/dealer/listings/route.ts                 # GET SELECT + POST fields
src/app/api/dealer/listings/[id]/route.ts            # GET SELECT + ALLOWED_FIELDS
src/app/dealer/new/DealerNewListingClient.tsx        # bg-cream → bg-surface
src/app/dealer/edit/[id]/DealerEditListingClient.tsx # bg-cream → bg-surface
src/i18n/locales/en.json                             # 12 new dealer.* keys
src/i18n/locales/ja.json                             # 12 new dealer.* keys
```
