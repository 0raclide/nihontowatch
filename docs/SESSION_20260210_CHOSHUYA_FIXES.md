# Session: Choshuya Bulk Import Fix & Artisan Matching Pipeline Repair

**Date:** 2026-02-10
**Scope:** Nihontowatch + Oshi-scrapper

---

## Issues Reported

1. **Choshuya items flooding "Newest" sort** — ~2,978 items appeared as "new" after a bulk re-crawl
2. **Artisan predictions missing** — New items (e.g., Samurai Nippon) had no artisan codes

---

## Root Causes

### Issue 1: is_initial_import Data Corruption

The `is_initial_import` column default was `TRUE`. When the Supabase BEFORE INSERT trigger (`set_is_initial_import`) failed silently during high-volume Choshuya inserts, all items got the default `TRUE` — meaning "bulk import, hide from Newest". When we corrected 2,609 items to `FALSE` (thinking they were genuine new), they flooded "Newest" because they had recent `first_seen_at` dates.

**Chain of events:**
1. Trigger failed silently during bulk Choshuya inserts → all got default TRUE
2. First fix set 2,609 to FALSE → items appeared as "new" in Newest sort (made things worse)
3. Applied bulk detection heuristic: >10 items from same dealer on same day = bulk → TRUE
4. Final: 2,978 bulk (TRUE), 25 genuine new (FALSE)

### Issue 2: Artisan Matching Not Running in Production

`YUHINKAI_SUPABASE_URL` and `YUHINKAI_SUPABASE_KEY` were missing from both GitHub Actions workflows. The `get_yuhinkai_client()` function returns `None` when env vars are absent, causing `ListingRepository.matcher` to silently skip all artisan matching.

---

## Fixes Applied

### 1. Database: Choshuya is_initial_import Correction

- Corrected 2,978 Choshuya items to `is_initial_import = TRUE` (bulk)
- 25 items kept at `FALSE` (genuine new inventory)
- Used paginated Supabase queries (`.range()`) to handle >1000 rows

### 2. Migration 055: Column Default FALSE

**File:** `supabase/migrations/055_fix_initial_import_default.sql`

Changed column default from TRUE to FALSE. If the trigger fails in the future, items will appear as "new" (safe — user sees them) rather than being buried (dangerous — user misses them).

### 3. shouldShowNewBadge() — DB Column Override

**File:** `src/lib/newListing.ts`

Added `isInitialImport` as 3rd parameter. The DB column is now authoritative:
- `is_initial_import === true` → never show badge (bulk import)
- `is_initial_import === false` → eligible for badge (check recency)
- `is_initial_import === null` → fallback to date-based heuristic

Updated 4 call sites:
- `src/components/browse/ListingCard.tsx`
- `src/components/listing/QuickViewContent.tsx`
- `src/components/listing/QuickViewMobileSheet.tsx`
- `src/app/listing/[id]/ListingDetailClient.tsx`

Added `is_initial_import` to `Listing` type in `src/types/index.ts`.

### 4. Golden Tests

**File:** `tests/lib/newListing.test.ts` (98 tests total, 3 GOLDEN)

```
GOLDEN: Choshuya secondary bulk import — bulk re-crawl must NOT show New badge
GOLDEN: genuine new listing from same dealer still shows badge
GOLDEN: bulk import must not appear in "new" tier regardless of first_seen_at
```

### 5. GitHub Actions: Yuhinkai Env Vars

**Files (Oshi-scrapper):**
- `.github/workflows/daily-scrape.yml` — added YUHINKAI_SUPABASE_URL + YUHINKAI_SUPABASE_KEY
- `.github/workflows/scrape.yml` — same

User added corresponding secrets via GitHub UI. Verified working with test workflow run.

### 6. Batch Artisan Match — Backfill

**File:** `Oshi-scrapper/scripts/batch_match_unmatched.py`

Ran batch match on all 94 available items with maker data but no artisan_matched_at:
- **17 matched** (saved to DB)
- **77 no match** (obscure artisans not in Yuhinkai)
- **1 skipped** (admin-locked)

---

## Commits

| Repo | Commit | Description |
|------|--------|-------------|
| nihontowatch | `45e30e1` | fix: Prevent bulk re-crawls from polluting "Newest" sort and "New" badges |
| Oshi-scrapper | (pushed) | fix: Add Yuhinkai env vars to GitHub Actions workflows |

---

## Lessons Learned

1. **Supabase triggers can fail silently** — always have a safe column default
2. **Column default TRUE was dangerous** — silent failure = items hidden from users
3. **Supabase pagination limit is 1000 rows** — always use `.range()` for bulk operations
4. **GitHub Actions env vars are per-step, not global** — must be in the right `env:` block
5. **`get_yuhinkai_client()` returns None silently** — no error when env vars missing, just skips matching
6. **Python `load_dotenv()` fails in bash heredocs** — always write to a .py file for scripts
