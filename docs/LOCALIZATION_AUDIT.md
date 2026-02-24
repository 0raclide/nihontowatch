# Japanese Localization Audit Report

**Date:** 2026-02-22
**Status:** Active — tracking localization completeness

## Executive Summary

The app has a solid custom i18n foundation (720 keys with full en/ja parity), but significant gaps remain across data-level translations, several user-facing pages, and the entire admin interface. The core browse flow is well-localized, but surrounding pages and database-sourced values break the Japanese experience.

---

## CRITICAL: Data-Level Translation Gaps

These affect every user in Japanese mode on primary user flows.

### 1. School Names — NO TRANSLATIONS
**Severity: CRITICAL** | Affects: `/artists`, `/browse`, `/listing/[id]`, QuickView

School names like "Bizen", "Yamashiro", "Mino", "Soshu" come from the database as romanized English. No `school.*` keys exist in `ja.json`. They display raw in:
- Artist directory filter dropdowns & card subtitles
- Artist profile metadata
- Listing detail / QuickView metadata
- Browse filter sidebar

**Needed:** ~30 keys (`school.Bizen` → `備前`, `school.Yamashiro` → `山城`, etc.)

### 2. Province Names — NO TRANSLATIONS
**Severity: CRITICAL** | Affects: Same pages as schools

Province names ("Sagami", "Musashi", "Settsu") stored as romanized English. No `province.*` keys exist.

**Needed:** ~60 keys (`province.Sagami` → `相模`, `province.Musashi` → `武蔵`, etc.)

### 3. Era Values — PARTIAL
**Severity: HIGH** | Affects: Listing detail, artist cards

Period translation keys exist (`period.Kamakura` → `鎌倉`) and are used in artist filters, but raw `listing.era` values (e.g. "Kamakura (1185-1333)") are displayed without mapping through `t()` in MetadataGrid and artist cards.

### 4. Country Names — NOT TRANSLATED
**Severity: LOW** | Affects: Dealer directory

`src/lib/dealers/utils.ts` has hardcoded English display names. No `country.*` keys exist.

---

## User-Facing Page Gaps

### 5. Footer — ENTIRELY ENGLISH
**File:** `src/components/layout/Footer.tsx`
**Count:** ~15 hardcoded strings

All section headers ("Swords", "Fittings", "By Certification", "Resources") and all links ("Dealer Directory", "Artist Directory", "Terms", "Privacy", "Cookie Preferences") are hardcoded English.

### 6. Dealer Directory — ENTIRELY ENGLISH
**File:** `src/app/dealers/DealersPageClient.tsx`
**Count:** ~18 hardcoded strings

Sort labels ("Most Listings", "Name A-Z"), region toggles ("All", "Japan", "Int'l"), filter labels ("Inventory Type", "Designation"), search placeholders, empty states, and count text are all hardcoded.

### 7. Individual Dealer Page — MOSTLY ENGLISH
**File:** `src/app/dealers/[slug]/page.tsx`
**Count:** ~3 hardcoded strings
"Inventory" header, "Browse All {count} Listings" CTA, breadcrumbs.

### 8. Profile Page — ENTIRELY ENGLISH
**File:** `src/app/profile/page.tsx`
**Count:** ~30 hardcoded strings

Every label: "My Profile", "Email", "Member since", "Account type", "Quick Links", "Privacy & Data", "Cookie Preferences", "Export My Data", "Sign Out", "Delete Account", confirmation warnings, etc.

### 9. Saved Searches Page — ENTIRELY ENGLISH
**Files:** `src/app/saved/page.tsx`, `src/components/saved/SearchesTab.tsx`, `WatchlistTab.tsx`
**Count:** ~35 hardcoded strings

Tab labels, empty states ("No saved searches yet"), frequency options ("Instant (15 min)", "Daily digest"), action buttons ("View", "Pause", "Delete"), watchlist labels ("Price drop", "Back in stock", "SOLD"), tip text.

### 10. Favorites — MOSTLY ENGLISH
**File:** `src/components/favorites/FavoritesList.tsx`
**Count:** ~6 hardcoded strings

Empty state heading/description, "Browse Collection" CTA, error heading, count label.

### 11. Glossary Page — MOSTLY ENGLISH
**Files:** `src/app/glossary/page.tsx`, `GlossaryPageClient.tsx`
**Count:** ~8 hardcoded strings

Page title, search placeholder, "All ({count})", category labels, "No terms found", "Clear filters".

### 12. Home Page — PARTIAL
**File:** `src/app/page.tsx`
**Count:** ~3 strings (keys exist but may not be used in all code paths)

### 13. 404 Page — ENTIRELY ENGLISH
**File:** `src/app/not-found.tsx`
**Count:** ~8 hardcoded strings

"Page Not Found", description, "Browse Collection", "View Dealers", navigation links.

### 14. UserMenu — HARDCODED
**File:** `src/components/auth/UserMenu.tsx`
**Count:** ~4 hardcoded strings

"Profile", "Saved", "Admin", "Sign Out" — should use `t('nav.*')` keys that already exist.

### 15. Search Suggestions — PARTIAL
**File:** `src/components/search/SearchSuggestions.tsx`
**Count:** ~4 hardcoded strings

"Searching...", "View all {n} results", "No results found" (key exists but unused).

### 16. Collection Form Defaults — PARTIAL
**File:** `src/components/collection/CollectionFormContent.tsx`
**Count:** ~8 hardcoded strings

Dropdown defaults ("Select type...", "None", status/condition labels) are hardcoded despite translation keys existing for some.

---

## Admin Interface (Lower Priority)

### 17. ALL Admin Pages — ENTIRELY ENGLISH
**Files:** `src/app/admin/` (8+ pages)
**Count:** ~150+ hardcoded strings

Every admin page (Dashboard, Dealers, Users, Analytics, Visitors, Alerts, Scrapers, Market Intelligence) and the admin sidebar navigation use zero i18n.

---

## Existing Keys Not Being Used

| Key | Japanese | Should be used in |
|-----|----------|-------------------|
| `search.noResults` | 結果が見つかりません | SearchSuggestions.tsx |
| `listing.untitled` | 無題 | ListingCard.tsx fallback |
| `quickview.markAvailable` | 販売中に変更 | QuickViewContent.tsx aria-label |
| `quickview.markSold` | 売却済みに変更 | QuickViewContent.tsx aria-label |
| `quickview.hide` | 非表示にする | QuickViewContent.tsx aria-label |
| `quickview.viewPhotos` | 写真を見る | QuickViewContent.tsx aria-label |
| `collection.status.*` | 所有/売却/etc | CollectionFormContent.tsx dropdowns |
| `collection.condition.*` | 極美品/美品/etc | CollectionFormContent.tsx dropdowns |

---

## Artist Detail Page (`/artists/[slug]`) — 2026-02-23

The main `ArtistPageClient.tsx` is **well-localized** — nearly all visible strings use `t()` calls with full en/ja parity (~70 keys under `artist.*`, `pyramid.*`, `fujishiro.*`, `cert.*`). However, several sub-components render hardcoded English that breaks the JA experience.

### 18. Provenance Tier Labels — HARDCODED ENGLISH
**Severity: HIGH** | Affects: Every artist profile with provenance data
**File:** `src/lib/artisan/provenanceMock.ts:134-143`
**Rendered by:** `src/components/artisan/ProvenancePyramid.tsx:75` (`tier.label`)
**Count:** 8 strings

The `PROVENANCE_TIERS` constant has hardcoded English `label` fields that are rendered directly without `t()`:

| Current (EN) | Needed (JA) | Suggested key |
|---|---|---|
| `Imperial` | 皇室 | `provenance.imperial` |
| `Shogunal` | 将軍家 | `provenance.shogunal` |
| `Premier Daimyō` | 有力大名 | `provenance.premierDaimyo` |
| `Major Daimyō` | 大大名 | `provenance.majorDaimyo` |
| `Other Daimyō` | 諸大名 | `provenance.otherDaimyo` |
| `Zaibatsu` | 財閥 | `provenance.zaibatsu` |
| `Institutions` | 文化施設 | `provenance.institutions` |
| `Named Collectors` | 著名収集家 | `provenance.namedCollectors` |

**Fix:** Add `labelKey` to each tier definition (like `PrestigePyramid` already does), pass `t()` into the component or use `useLocale()` to resolve labels.

### 19. ArtistProfileBar — HARDCODED ENGLISH
**Severity: HIGH** | Affects: Every artist profile page on mobile (bottom nav)
**File:** `src/components/artisan/ArtistProfileBar.tsx:31,42,53`
**Count:** 3 strings + 1 aria-label

| Line | Current | Needed (JA) | Suggested key |
|---|---|---|---|
| 31 | `Artists` | 刀工 | `nav.artists` (or reuse `artist.breadcrumbArtists`) |
| 42 | `Browse` | 一覧 | `nav.browse` |
| 53 | `Menu` | メニュー | `nav.menu` |
| 20 | `aria-label="Artist profile navigation"` | 刀工プロフィールナビゲーション | `artist.profileNavLabel` |

**Fix:** Import `useLocale()` and wire `t()` calls. The component currently has no locale awareness at all.

### 20. ListingReturnBar — HARDCODED ENGLISH
**Severity: HIGH** | Affects: Mobile users who navigate to artist page from QuickView
**File:** `src/components/artisan/ListingReturnBar.tsx:69,75`
**Count:** 1 string + 1 aria-label

| Line | Current | Needed (JA) | Suggested key |
|---|---|---|---|
| 69 | `Return to listing` | 商品に戻る | `artist.returnToListing` |
| 75 | `aria-label="Dismiss"` | 閉じる | `artist.dismiss` |

**Fix:** Import `useLocale()` and wire `t()` calls.

### 21. MeasurementPanel — HARDCODED ENGLISH LABELS
**Severity: MEDIUM** | Affects: Artist profile blade form drill-down
**File:** `src/components/artisan/MeasurementPanel.tsx:28-33,116`
**Count:** 4 labels + 2 unit strings

| Current | Needed (JA) | Suggested key |
|---|---|---|
| `Nagasa` | 刃長 | `measurement.nagasa` |
| `Sori` | 反り | `measurement.sori` |
| `Motohaba` | 元幅 | `measurement.motohaba` |
| `Sakihaba` | 先幅 | `measurement.sakihaba` |
| `cm` (×2) | cm | (same, but should go through `t()` for consistency) |

**Fix:** Import `useLocale()`, add keys, replace `MEASUREMENT_LABELS` constant with a function that returns locale-aware labels.

### 22. CatalogueShowcase — HARDCODED DATE FORMAT
**Severity: MEDIUM** | Affects: Published Works section on artist profiles
**File:** `src/components/artisan/CatalogueShowcase.tsx:186-189`
**Count:** 1 date format + 1 alt text fallback

| Line | Issue | Fix |
|---|---|---|
| 186 | `toLocaleDateString('en-US', ...)` hardcoded — shows "Nov 2024" in JA | Use `locale === 'ja' ? 'ja-JP' : 'en-US'` → "2024年11月" |
| 206 | Alt text fallback `'Artisan'` | Use `t('artist.artisan')` or similar |

### 23. SectionJumpNav — HARDCODED ARIA LABELS
**Severity: LOW** | Affects: Screen reader users only (mobile nav is `display: hidden`)
**File:** `src/components/artisan/SectionJumpNav.tsx`
**Count:** 4 aria-labels

| Line | Current | Suggested key |
|---|---|---|
| 153 | `aria-label="Section navigation"` | `artist.sectionNavLabel` |
| 234 | `aria-label="Previous section"` | `artist.previousSection` |
| 246 | `aria-label="Jump to section"` | `artist.jumpToSection` |
| 267 | `aria-label="Next section"` | `artist.nextSection` |

### 24. formatKoku — HARDCODED EN-US NUMBER FORMAT
**Severity: LOW** | Affects: Provenance pyramid collector detail (koku display)
**File:** `src/lib/artisan/provenanceMock.ts:128-130`

`formatKoku()` uses `toLocaleString('en-US')` → "1,025,000". JA convention would use the same comma format (or 万石 which is already handled by `artist.koku` key), so this is a minor inconsistency.

### 25. Denrai Owner Names — NOT TRANSLATABLE (by design)
**Severity: N/A** | Note for completeness

Historical collector names ("Maeda Family", "Imperial Family", "Shimazu Family") are rendered in English from the database. These are romanized historical names used internationally in nihonto scholarship. Translating them to "前田家", "皇室", "島津家" would be correct for JA users but requires a mapping table in `provenanceMock.ts`. This is a **data-level** localization task, not a UI string task — flagged but not blocking.

### Summary: Artist Detail Page

| Priority | Component | Hardcoded strings | New keys needed | Effort |
|---|---|---|---|---|
| **P1** | Provenance tier labels | 8 | 8 | Low — add `labelKey`, wire `t()` |
| **P1** | ArtistProfileBar (mobile nav) | 3 + 1 aria | 4 | Low — add `useLocale()` |
| **P1** | ListingReturnBar (mobile pill) | 1 + 1 aria | 2 | Low — add `useLocale()` |
| **P2** | MeasurementPanel labels | 4 + 2 | 4 | Low — refactor constant to fn |
| **P2** | CatalogueShowcase date format | 1 | 0 | Low — use locale for date |
| **P3** | SectionJumpNav aria-labels | 4 | 4 | Low — wire `t()` |
| **P3** | formatKoku number locale | 1 | 0 | Trivial |
| **—** | Denrai owner name mapping | ~100+ names | ~100+ | High — data-level |

**Total: ~18 new i18n keys needed + 1 date locale fix + 1 number locale fix.**

The well-localized components (no issues found):
- `ArtistPageClient.tsx` — excellent, ~70 `t()` calls
- `PrestigePyramid.tsx` — fully localized via `pyramid.*` keys
- `EliteFactorDisplay.tsx` — fully localized
- `ProvenanceFactorDisplay.tsx` — fully localized
- `FormDistributionBar.tsx` — fully localized via `itemType.*` keys
- `MeiDistributionBar.tsx` — fully localized via `mei.*` keys
- `RelatedArtisans.tsx` — fully localized, shows kanji names for JA
- `ArtisanListings.tsx` — fully localized

---

## Summary by Priority

| Priority | Area | Strings | Effort |
|----------|------|---------|--------|
| **P0** | School/Province name translations | ~90 new keys + mapping functions | High |
| **P0** | Footer | ~15 strings → use existing + new `t()` keys | Low |
| **P1** | Dealer directory page | ~18 new keys + refactor | Medium |
| **P1** | Saved searches/Watchlist | ~35 new keys + refactor | Medium |
| **P1** | Profile page | ~30 new keys + refactor | Medium |
| **P1** | Era values in metadata display | Wire `t('period.*')` to MetadataGrid | Low |
| **P1** | Artist: Provenance tier labels (#18) | 8 new keys | Low |
| **P1** | Artist: ArtistProfileBar mobile nav (#19) | 4 new keys | Low |
| **P1** | Artist: ListingReturnBar mobile pill (#20) | 2 new keys | Low |
| **P2** | Glossary page | ~8 new keys | Low |
| **P2** | 404 page | ~8 new keys | Low |
| **P2** | Favorites empty states | ~6 new keys | Low |
| **P2** | UserMenu (use existing keys) | 0 new keys, just wire t() | Low |
| **P2** | Search suggestions | ~3 new keys | Low |
| **P2** | Collection form defaults (use existing keys) | 0 new keys | Low |
| **P2** | Artist: MeasurementPanel labels (#21) | 4 new keys | Low |
| **P2** | Artist: CatalogueShowcase date format (#22) | 0 new keys, locale fix | Trivial |
| **P3** | Admin pages (8 pages) | ~150 new keys | High |
| **P3** | Country names | ~5 new keys | Low |
| **P3** | Artist: SectionJumpNav aria-labels (#23) | 4 new keys | Low |
| **P3** | Artist: formatKoku number locale (#24) | 0 new keys, locale fix | Trivial |

**Total estimated new translation keys needed: ~270+**
**Keys already existing but unused: ~12**
