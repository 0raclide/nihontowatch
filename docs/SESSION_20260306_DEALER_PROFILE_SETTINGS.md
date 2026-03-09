# Session: Dealer Profile Settings — Phase 1 (2026-03-06)

**Date:** 2026-03-06
**Status:** Deployed to prod. Migration applied.
**Design doc:** `docs/DEALER_PROFILE_DESIGN.md` (Phase 1 of 4)
**Commit:** `fb60136`

---

## Context

The dealer portal was a listing management back-office with zero shop identity — no logo, banner, bio, or personality. Dealers need a profile settings page where they can upload branding, write bios, and fill in contact/location/policy info before the public storefront (Phase 2) can show anything meaningful.

This session implements Phase 1 from `DEALER_PROFILE_DESIGN.md`: a `/dealer/profile` page for dealers to customize their identity. Data saved to the `dealers` table (17 new columns). Profile images stored in the existing `dealer-images` Supabase Storage bucket.

---

## What Was Built

### Database (Migration 101)

**File:** `supabase/migrations/101_dealer_profile.sql`

17 new columns on the `dealers` table, all nullable (progressive completion):

| Group | Columns |
|-------|---------|
| Visual identity | `logo_url`, `banner_url`, `accent_color` (default `#c4a35a`) |
| Story | `bio_en`, `bio_ja`, `founded_year` (CHECK 1600-2100), `shop_photo_url`, `specializations` (TEXT[]) |
| Contact | `phone`, `line_id`, `instagram_url`, `facebook_url` |
| Location | `address`, `city`, `postal_code`, `address_visible` (default false) |
| Credentials | `memberships` (TEXT[]), `return_policy` |

### Profile API

**`src/app/api/dealer/profile/route.ts`** — GET + PATCH

- **GET**: Returns full dealer row + computed `profileCompleteness` (score 0-100, missing items list)
- **PATCH**: Allowlisted fields only (17 new + 10 existing editable). Explicitly excludes `id`, `name`, `name_ja`, `domain`, `is_active`, `created_at`, etc.
- **Validation**: `accent_color` hex regex, `founded_year` 1600-2026, `specializations` checked against `SPECIALIZATION_VALUES` set, `deposit_percentage` 0-100
- **Instagram normalization**: Bare handles (`@myshop` or `myshop`) → `https://www.instagram.com/myshop`

**`src/app/api/dealer/profile/images/route.ts`** — POST + DELETE

- **POST**: FormData with `file` + `type` ("logo"|"banner"|"shop"). Logo max 2MB, banner/shop max 5MB. JPEG/PNG/WebP only. Storage path: `{dealerId}/profile/{type}/{uuid}.{ext}`. Replaces existing image (deletes old from storage first).
- **DELETE**: Body `{ type }`. Reads current URL from DB, validates storage path ownership (`{dealerId}/profile/` prefix, no `..`), removes from storage, nulls DB column.

### Utility Functions

**`src/lib/dealer/profileCompleteness.ts`** — `computeProfileCompleteness(dealer)` → `{ score, missing[] }`

Weighted 100-point scoring:
- Logo 15, Banner 15, Bio 15 (+5 bilingual bonus)
- Contact email 10, Phone/LINE 10
- Founded year 5, City 5, Specializations 5
- Return policy 5, Payment methods 5, Memberships 5

Returns i18n keys in `missing[]` for UI prompts.

**`src/lib/dealer/specializations.ts`** — 12 specialization values (kotō, shintō, shinshintō, gendaitō, 5 traditions, tsuba, armor, koshirae) with i18n label keys. `SPECIALIZATION_VALUES` Set typed as `Set<string>` for validation compatibility.

### UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `ProfileImageUpload` | `src/components/dealer/ProfileImageUpload.tsx` | Single-image upload with client-side resize. Circular 120×120 for logo, 16:9 for banner, 4:3 for shop. Drag-and-drop + click. Shows remove button on hover. |
| `AccentColorPicker` | `src/components/dealer/AccentColorPicker.tsx` | 6 preset color circles (Gold, Indigo, Crimson, Forest, Slate, Charcoal) with checkmark overlay + custom hex input validated on blur. |
| `SpecializationPills` | `src/components/dealer/SpecializationPills.tsx` | Toggle pill buttons matching DealerListingForm styling (gold when active, muted border when inactive). |
| `ProfileCompleteness` | `src/components/dealer/ProfileCompleteness.tsx` | Progress bar (h-2 rounded-full) with percentage + up to 3 missing-item prompts. Color-coded: <33% amber, 33-66% gold, 67%+ green. |

### Profile Page

**`src/app/dealer/profile/DealerProfileClient.tsx`** — Main form (520 lines)

- Fetches `GET /api/dealer/profile` on mount
- **Auto-save pattern**: `useState` for form, `useRef` for last-saved snapshot, `setTimeout` debounce (800ms). On field change → compute diff from lastSaved → if non-empty, PATCH only changed fields → on success update lastSaved ref + show toast
- Image uploads handled independently (call their own API, then update form state via callback)
- **5 collapsible `<details>` sections**: Visual Identity (open), About Your Shop (open), Contact & Location, Policies, Credentials
- **Reusable sub-components** (file-scoped): `FieldInput`, `CheckboxField`, `TriStatePills` (Yes/No/Not set), `MembershipTags` (type+Enter to add, click × to remove)
- **Toast**: Fixed-bottom green "Saved" / red error, 2s auto-dismiss
- `ProfileCompleteness` pinned at bottom (always visible, not in a details section)

**`src/app/dealer/profile/page.tsx`** — Thin server wrapper (`force-dynamic`).

### Navigation

| Location | Change |
|----------|--------|
| Desktop header (`DealerPageClient.tsx`) | Gear icon link to `/dealer/profile` next to "Add Listing" button |
| Mobile header (`DealerPageClient.tsx`) | Gear icon in the sub-header bar (phone only) |
| Mobile nav drawer (`MobileNavDrawer.tsx`) | "Profile Settings" link below "My Listings" in dealer section |

### i18n

~55 new keys under `dealer.*` in both `en.json` and `ja.json`:
- Section headers, image upload labels/help text, color picker labels
- Bio labels/placeholders, field labels, policy labels
- Completeness prompts, save feedback, specialization names (EN with macrons, JA with kanji)

All Japanese strings hand-written (not machine-translated).

---

## Key Files

### New (13 files)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migrations/101_dealer_profile.sql` | 32 | Schema: 17 new columns |
| `src/lib/dealer/profileCompleteness.ts` | 85 | Completeness scoring utility |
| `src/lib/dealer/specializations.ts` | 18 | Specialization constants + validation set |
| `src/app/api/dealer/profile/route.ts` | 151 | GET + PATCH profile API |
| `src/app/api/dealer/profile/images/route.ts` | 173 | POST + DELETE profile images |
| `src/components/dealer/ProfileImageUpload.tsx` | 200 | Single-image upload (logo/banner/shop) |
| `src/components/dealer/AccentColorPicker.tsx` | 91 | Color preset row + custom hex |
| `src/components/dealer/SpecializationPills.tsx` | 47 | Multi-select specialization pills |
| `src/components/dealer/ProfileCompleteness.tsx` | 46 | Progress bar + missing prompts |
| `src/app/dealer/profile/page.tsx` | 7 | Server wrapper |
| `src/app/dealer/profile/DealerProfileClient.tsx` | 520 | Main profile settings form |
| `tests/lib/dealer/profileCompleteness.test.ts` | 144 | 19 unit tests |
| `tests/api/dealer/profile.test.ts` | 170 | 12 API tests |

### Modified (5 files)

| File | Changes |
|------|---------|
| `src/types/index.ts` | 17 new fields on `Dealer` interface |
| `src/app/dealer/DealerPageClient.tsx` | Gear icon links (desktop + mobile), DealerMobileBar import |
| `src/components/layout/MobileNavDrawer.tsx` | "Profile Settings" link in dealer section |
| `src/i18n/locales/en.json` | ~55 new `dealer.*` keys |
| `src/i18n/locales/ja.json` | ~55 new `dealer.*` keys |

---

## Tests

**31 tests total**, all passing.

**`tests/lib/dealer/profileCompleteness.test.ts`** (19 tests):
- Empty dealer = 0, full dealer = 100
- Each weight individually verified (logo 15, banner 15, bio 15, bilingual +5, email 10, phone/LINE 10, founded 5, city 5, specs 5, policy 5, payment 5, memberships 5)
- Phone + LINE don't double-count
- Empty arrays don't award points
- Whitespace-only bio treated as empty
- Score capped at 100

**`tests/api/dealer/profile.test.ts`** (12 tests):
- Auth: 401 unauthenticated, 403 non-dealer
- GET returns dealer + completeness
- PATCH updates allowed fields, rejects disallowed (id, name, domain)
- Validation: hex color, founded_year range, specialization values, deposit_percentage range
- Instagram handle normalization (@handle, bare handle, full URL)

---

## TypeScript Patterns

- **Supabase `as any` casts**: The `dealers` table doesn't have generated types for the new columns yet. All `.from('dealers')` calls in the profile APIs use `as any` to bypass strict typing, matching the pattern in existing dealer routes (`listings/[id]/route.ts`).
- **Dynamic column access**: Profile image routes use `config.dbColumn` (computed from image type) for `.select()` and `.update()`. Cast through `as { data: Record<string, string | null> | null }` for type safety.
- **`SPECIALIZATION_VALUES`**: Explicitly typed as `Set<string>` (not `Set<literal union>`) to allow `.has(unknownString)` validation without TypeScript errors.

---

## What's Next (Phase 2)

The profile data is now stored but not displayed publicly. Phase 2 (`DEALER_PROFILE_DESIGN.md` §6) will:
- Render logo, banner, bio, accent color on the public `/dealers/[slug]` page
- Show specialization pills, founded year, location, trust signals
- Add structured data (JSON-LD Organization) for SEO
- Surface profile completeness nudges in the dealer portal dashboard

---

## Debugging Notes

- **404 on `/dealer/profile`**: If the page returns 404 after deploy, check that Vercel picked up the new route. The middleware already protects `/dealer/*` — unauthenticated users get redirected, not 404'd. A true 404 means the page file wasn't included in the build.
- **Migration already applied**: `npx supabase db push` reported "Remote database is up to date" — the columns had been created prior to the push (confirmed via REST API query returning `accent_color: "#c4a35a"`, arrays as `[]`).
- **Pre-existing build failures**: The `intelligence/route.ts` file had a pre-existing type error (`images: unknown` vs `unknown[]`). Not introduced by this session.
