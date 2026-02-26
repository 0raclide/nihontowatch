# AdminEditView — Unified Admin Panel

**Date:** 2026-02-26
**Status:** Complete

## Overview

AdminEditView is the **single admin surface** for all listing corrections in QuickView. Accessed via the pen icon in the action bar. Works identically on desktop and mobile.

### Panel Layout (top to bottom)

```
┌─────────────────────────────────────────┐
│  Admin Edit                View Photos  │  ← Sticky header
├─────────────────────────────────────────┤
│  [Hidden banner — if admin_hidden]      │
├─────────────────────────────────────────┤
│  Designation                            │
│  [Tokuju] [Jūyō] [TokuHo] [Hozon] ... │  ← CertPillRow (always visible)
├─────────────────────────────────────────┤
│  ▶ Edit Metadata Fields                 │  ← Collapsed by default (<details>)
│    ┌─────────────────────────────────┐  │
│    │ FieldEditSection (17 fields)    │  │    Only 5% of corrections need this
│    └─────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  Artisan                                │
│  ┌─────────────────────────────────┐    │
│  │ ArtisanDetailsPanel             │    │  ← Fetches from Yuhinkai
│  │ (name, school, elite bar,       │    │
│  │  cert counts, candidates,       │    │
│  │  profile link)                  │    │
│  └─────────────────────────────────┘    │
│  [✓ Correct]      [✗ Incorrect]         │  ← Verify buttons
│  [Reassign Artisan]                     │  ← Opens search panel
│  ┌─────────────────────────────────┐    │
│  │ ArtisanSearchPanel              │    │    Auto-opens for unmatched/UNKNOWN
│  │ (search + results + UNKNOWN)    │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  [Mark as Sold / Mark as Available]     │  ← Status override
│  [Hide Listing / Unhide Listing]        │  ← Admin hide toggle
└─────────────────────────────────────────┘
```

### Design Rationale

95% of admin corrections are cert designation or artisan code fixes. Metadata field editing (smith name, measurements, price, era) is rare. The panel prioritizes the common case:

1. **Cert pills** — always visible at top, one tap to change
2. **Artisan section** — rich details + verify + search, auto-opens for unmatched
3. **Metadata fields** — collapsed in a `<details>` disclosure, intentional click to expand

### Consolidation History (2026-02-26)

Previously, desktop QuickView had 3 overlapping artisan tools:

| Tool | Where | What it did |
|------|-------|-------------|
| **ArtisanTooltip** | Floating portal on artist name | Details, verify, search, cert editing |
| **AdminArtisanWidget** | Collapsible panel below score inspector | Search & assign only |
| **AdminEditView** | Full panel (mobile only) | Cert, fields, artisan search, status, hide |

All three used the same APIs but had independent state management. AdminArtisanWidget was deleted (339 lines). ArtisanTooltip was removed from QuickView (stays on browse grid ListingCards). AdminEditView became the single admin surface for both platforms.

---

## Field Editing with Auto-Lock

### Problem

Listing 49696 had `smith = "All Yamashiro Swords In Existence"` — an LLM hallucination from the scraper. Rather than fixing individual scraper bugs, we built admin-editable fields with auto-lock to prevent scraper overwrite.

### Architecture

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
| **AdminEditView** (unified panel) | nihontoWatch | `src/components/listing/AdminEditView.tsx` |
| **ArtisanDetailsPanel** (artisan display) | nihontoWatch | `src/components/admin/ArtisanDetailsPanel.tsx` |
| **ArtisanSearchPanel** (shared search) | nihontoWatch | `src/components/admin/ArtisanSearchPanel.tsx` |
| **CertPillRow** (shared cert editor) | nihontoWatch | `src/components/admin/CertPillRow.tsx` |
| **FieldEditSection** (field editor) | nihontoWatch | `src/components/admin/FieldEditSection.tsx` |
| **ArtisanCandidate** type | nihontoWatch | `src/types/artisan.ts` |
| Fix-fields API | nihontoWatch | `src/app/api/listing/[id]/fix-fields/route.ts` |
| Fix-artisan API | nihontoWatch | `src/app/api/listing/[id]/fix-artisan/route.ts` |
| Fix-cert API | nihontoWatch | `src/app/api/listing/[id]/fix-cert/route.ts` |
| Verify-artisan API | nihontoWatch | `src/app/api/listing/[id]/verify-artisan/route.ts` |
| Unlock-fields API | nihontoWatch | `src/app/api/listing/[id]/unlock-fields/route.ts` |
| DB migration (`admin_locked_fields`) | Oshi-scrapper | `supabase/migrations/20260226000001_add_admin_locked_fields.sql` |
| Scraper lock check | Oshi-scrapper | `db/repository.py` (line ~631) |
| Listing type | nihontoWatch | `src/types/index.ts` (`admin_locked_fields`) |
| Data fetching | nihontoWatch | `src/lib/listing/getListingDetail.ts` (SELECT + enrichment) |
| Tests (ArtisanDetailsPanel) | nihontoWatch | `tests/components/admin/ArtisanDetailsPanel.test.tsx` (17 tests) |
| Tests (AdminEditView) | nihontoWatch | `tests/components/admin/AdminEditView.test.tsx` (8 tests) |
| Tests (QuickView regression) | nihontoWatch | `tests/components/listing/QuickViewContent.test.tsx` (6 regression tests) |

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
