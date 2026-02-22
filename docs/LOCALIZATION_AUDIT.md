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

## Summary by Priority

| Priority | Area | Strings | Effort |
|----------|------|---------|--------|
| **P0** | School/Province name translations | ~90 new keys + mapping functions | High |
| **P0** | Footer | ~15 strings → use existing + new `t()` keys | Low |
| **P1** | Dealer directory page | ~18 new keys + refactor | Medium |
| **P1** | Saved searches/Watchlist | ~35 new keys + refactor | Medium |
| **P1** | Profile page | ~30 new keys + refactor | Medium |
| **P1** | Era values in metadata display | Wire `t('period.*')` to MetadataGrid | Low |
| **P2** | Glossary page | ~8 new keys | Low |
| **P2** | 404 page | ~8 new keys | Low |
| **P2** | Favorites empty states | ~6 new keys | Low |
| **P2** | UserMenu (use existing keys) | 0 new keys, just wire t() | Low |
| **P2** | Search suggestions | ~3 new keys | Low |
| **P2** | Collection form defaults (use existing keys) | 0 new keys | Low |
| **P3** | Admin pages (8 pages) | ~150 new keys | High |
| **P3** | Country names | ~5 new keys | Low |

**Total estimated new translation keys needed: ~250+**
**Keys already existing but unused: ~12**
