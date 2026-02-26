# Admin Field Editing with Auto-Lock

**Date:** 2026-02-26
**Status:** Complete (frontend + API in nihontoWatch, DB migration + scraper lock in Oshi-scrapper)

## Problem

Listing 49696 had `smith = "All Yamashiro Swords In Existence"` — an LLM hallucination from the scraper. Rather than fixing individual scraper bugs, we built admin-editable fields with auto-lock to prevent scraper overwrite.

## Architecture

```
Admin edits field in QuickView → POST /api/listing/[id]/fix-fields
  → Updates field value in DB
  → Merges field name into admin_locked_fields JSONB
  → Recomputes featured_score
  → Returns updated locks

Scraper runs upsert() → checks admin_locked_fields
  → Pops locked field names from update dict
  → Locked fields are never overwritten
```

## What Lives Where

| Component | Repo | File |
|-----------|------|------|
| DB migration (`admin_locked_fields` JSONB) | Oshi-scrapper | `supabase/migrations/20260226000001_add_admin_locked_fields.sql` |
| Scraper lock check | Oshi-scrapper | `db/repository.py` (line ~631) |
| Fix-fields API | nihontoWatch | `src/app/api/listing/[id]/fix-fields/route.ts` |
| Unlock-fields API | nihontoWatch | `src/app/api/listing/[id]/unlock-fields/route.ts` |
| FieldEditSection UI | nihontoWatch | `src/components/admin/FieldEditSection.tsx` |
| AdminEditView integration | nihontoWatch | `src/components/listing/AdminEditView.tsx` |
| Listing type | nihontoWatch | `src/types/index.ts` (`admin_locked_fields`) |
| Data fetching | nihontoWatch | `src/lib/listing/getListingDetail.ts` (SELECT + enrichment) |

## Editable Fields

| Field | Input Type | Group |
|-------|-----------|-------|
| `smith` | text | Attribution |
| `tosogu_maker` | text | Attribution |
| `school` | text | Attribution |
| `tosogu_school` | text | Attribution |
| `province` | text | Attribution |
| `era` | dropdown (Koto/Shinto/Shinshinto/Gendaito/Shinsakuto) | Attribution |
| `mei_type` | dropdown (signed/unsigned/attributed/orikaeshi-mei/kinzogan-mei) | Attribution |
| `nagasa_cm` | number (step 0.01) | Specs |
| `sori_cm` | number (step 0.01) | Specs |
| `motohaba_cm` | number (step 0.01) | Specs |
| `sakihaba_cm` | number (step 0.01) | Specs |
| `kasane_cm` | number (step 0.01) | Specs |
| `weight_g` | number (step 1) | Specs |
| `price_value` | number (step 1) | Price |
| `price_currency` | dropdown (JPY/USD/EUR/GBP) | Price |
| `item_type` | grouped dropdown (Blades/Tosogu/Other) | Classification |

## How It Works

### Editing
1. Admin opens QuickView → Admin Edit panel
2. Clicks "Edit" button next to "Fields" section header
3. All fields become editable inputs
4. Saves → only changed fields are sent to `fix-fields` API
5. API validates against `EDITABLE_FIELDS` allowlist
6. Updates DB fields + merges into `admin_locked_fields` JSONB
7. Recomputes `featured_score` (awaited, not fire-and-forget)
8. UI shows green checkmark for 3s, dispatches `listing-refreshed` event

### Locking
- **Auto-lock on save**: Every field edited by admin is automatically locked
- **Lock indicator**: Amber lock icon next to field label
- **Merge, never remove**: New locks are merged with existing; locks are never implicitly removed
- **Scraper honors locks**: `repository.py` pops locked field names from upsert dict

### Unlocking
- Click the amber lock icon next to a field label
- Calls `POST /api/listing/[id]/unlock-fields` with `{ fields: ["smith"] }`
- Removes from `admin_locked_fields` — next scraper run will overwrite the field

## Coexistence with Existing Locks

This system coexists with the three existing per-domain locks:

| Lock | Scope | Used by |
|------|-------|---------|
| `cert_admin_locked` | cert_type only | fix-cert API |
| `artisan_admin_locked` | artisan_id + related fields | fix-artisan API |
| `status_admin_locked` | is_sold, is_available, status | set-status API |
| `admin_locked_fields` | Any field in EDITABLE_FIELDS | fix-fields API |

The JSONB lock is checked **after** the per-domain locks in `repository.py`.

## Verification Plan

1. Open listing 49696 in nihontoWatch admin QuickView
2. Click Admin Edit → Edit (Fields section)
3. Clear the hallucinated smith value, set correct value
4. Save — confirm `admin_locked_fields = {"smith": true}` in DB
5. Re-scrape: `python main.py scrape --url "https://nihonart.com/portfolio/gojo-tachi" --db`
6. Verify smith stays as admin-set value (locked)
7. Click lock icon next to smith → unlock
8. Re-scrape → verify scraper overwrites smith again
