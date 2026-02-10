# Session: Admin Artisan Lock Protection

**Date:** 2026-02-10
**Issue:** Admin artisan edits (via fix-artisan/verify-artisan APIs) were silently overwritten when the scraper re-scraped listings.

## Problem

The admin UI correctly set `artisan_method = 'ADMIN_CORRECTION'` and `artisan_verified = 'correct'` when an admin manually assigned an artisan, but the Oshi-scrapper's `save_result()` in `matcher.py` blindly overwrote `artisan_id`, `artisan_confidence`, `artisan_method`, `artisan_candidates`, and `artisan_matched_at` without checking any protection flags. Five batch/rerun scripts had the same vulnerability with direct `.update()` calls.

## Solution

### New Column: `artisan_admin_locked`

Added a dedicated `BOOLEAN NOT NULL DEFAULT FALSE` column as the **single source of truth** for protecting admin artisan assignments. Unlike checking compound conditions (`artisan_verified IS NOT NULL OR artisan_method = 'ADMIN_CORRECTION'`), a single boolean is unambiguous and impossible to accidentally bypass.

**Migration:** `supabase/migrations/054_artisan_admin_locked.sql`
- Adds column with partial index on locked rows
- Backfills 105 existing admin corrections/verifications to `TRUE`

### Who Sets It

| Action | Sets `artisan_admin_locked` to |
|--------|-------------------------------|
| Admin assigns artisan (fix-artisan API) | `TRUE` |
| Admin verifies correct/incorrect (verify-artisan API) | `TRUE` |
| Admin clears verification (verify-artisan API with `null`) | `FALSE` |
| Scraper / batch scripts | **NEVER TOUCHES IT** |

### Protection Points (7 total)

| # | File | Function | Protection |
|---|------|----------|------------|
| 1 | `Oshi-scrapper/db/repository.py` | `_run_artisan_matching()` | Early exit — skips entire match process including LLM calls |
| 2 | `Oshi-scrapper/artisan_matcher/matcher.py` | `save_result()` | Defense-in-depth — queries DB before writing |
| 3 | `Oshi-scrapper/artisan_matcher/scripts/full_rerun_with_llm.py` | `process_listing()` | Skips locked listings |
| 4 | `Oshi-scrapper/artisan_matcher/scripts/rerun_with_llm.py` | `process_listing()` | Skips locked listings |
| 5 | `Oshi-scrapper/artisan_matcher/scripts/rerun_ns_school_blades.py` | `process_listing()` | Skips locked listings |
| 6 | `Oshi-scrapper/artisan_matcher/scripts/rerun_ns_goto.py` | Main loop | Skips locked listings |
| 7 | `Oshi-scrapper/artisan_matcher/scripts/batch_tosogu_parallel.py` | `update_listings_batch()` | Checks before each update |

### Tests: 17 new tests

**File:** `Oshi-scrapper/tests/artisan_matcher/test_admin_protection.py`

| Test Class | Count | Covers |
|------------|-------|--------|
| `TestSaveResultAdminProtection` | 5 | Locked/unlocked/null/missing/column safety |
| `TestRunArtisanMatchingAdminProtection` | 4 | Pipeline early exit for locked/unlocked/null |
| `TestAdminProtectionScenarios` | 4 | End-to-end: admin corrects → scraper reruns, admin marks incorrect, new listing, pipeline skip |
| `TestBatchScriptProtection` | 2 | full_rerun_with_llm locked/unlocked |
| `TestColumnSafety` | 2 | Scraper never writes admin-only columns |

### Column Safety

Tests explicitly verify the scraper update payload **never** contains:
- `artisan_admin_locked`
- `artisan_verified`
- `artisan_verified_at`
- `artisan_verified_by`

And **only** contains the expected 5 columns:
- `artisan_id`, `artisan_confidence`, `artisan_method`, `artisan_candidates`, `artisan_matched_at`

## Commits

| Repo | Commit | Description |
|------|--------|-------------|
| Oshi-scrapper | `45382cc` | 7 protection points + 17 tests |
| Nihontowatch | `1a2c5cf` | Migration + API updates |

## Verification

Tested with listing 43159 (admin changed MAS590 → UNKNOWN):
```json
{
  "artisan_id": "UNKNOWN",
  "artisan_method": "ADMIN_CORRECTION",
  "artisan_admin_locked": true,
  "artisan_verified": "correct"
}
```
Audit trail in `artisan_corrections` table: `original: MAS590 → corrected: UNKNOWN`.

## Files Changed

### Nihontowatch
- `supabase/migrations/054_artisan_admin_locked.sql` (new)
- `src/app/api/listing/[id]/fix-artisan/route.ts` — adds `artisan_admin_locked: true`
- `src/app/api/listing/[id]/verify-artisan/route.ts` — adds `artisan_admin_locked: true/false`

### Oshi-scrapper
- `artisan_matcher/matcher.py` — guard in `save_result()`
- `db/repository.py` — early exit in `_run_artisan_matching()`
- `artisan_matcher/scripts/full_rerun_with_llm.py` — skip locked
- `artisan_matcher/scripts/rerun_with_llm.py` — skip locked
- `artisan_matcher/scripts/rerun_ns_school_blades.py` — skip locked
- `artisan_matcher/scripts/rerun_ns_goto.py` — skip locked
- `artisan_matcher/scripts/batch_tosogu_parallel.py` — skip locked
- `tests/artisan_matcher/test_admin_protection.py` (new — 17 tests)
