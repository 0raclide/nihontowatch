# Disabled Features

Features intentionally deactivated from the production site. Infrastructure remains in codebase for potential future re-enablement.

## 1. Setsumei Translation Badge (SetsumeiZufuBadge)

**Disabled:** 2026-03-14
**Commit:** `b75f73d4`

**What it was:** A gold "English" badge on ListingCard and ListingDetailClient indicating that a Juyo/Tokubetsu Juyo listing had an English translation of its NBTHK setsumei (certification description) available.

**What was removed:**
- `SetsumeiZufuBadge` rendering from `ListingCard.tsx` and `ListingDetailClient.tsx`
- `hasSetsumeiTranslation()` helper function (dead code)
- `isSetsumeiEligibleCert` and `SetsumeiZufuBadge` imports from both components
- 14 tests replaced with 1 absence-confirmation test

**What remains (for re-enablement):**
- `SetsumeiZufuBadge` component: `src/components/ui/SetsumeiZufuBadge.tsx`
- `SetsumeiZufuBadge` unit tests: `tests/components/ui/SetsumeiZufuBadge.test.tsx`
- `isSetsumeiEligibleCert()` in `src/types/index.ts`
- `has_setsumei` boolean in browse API response
- `setsumei_text_en` / `setsumei_text_ja` columns in DB
- Setsumei display in QuickView study mode (book icon)
- `AdminSetsumeiWidget` for admin setsumei management

**To re-enable:**
1. Import `SetsumeiZufuBadge` and `isSetsumeiEligibleCert` in `ListingCard.tsx`
2. Restore `hasSetsumeiTranslation()` helper
3. Add `{hasSetsumeiTranslation(listing) && <SetsumeiZufuBadge compact />}` in the cert badge row (line ~808)
4. Similarly in `ListingDetailClient.tsx`
5. Restore tests in `ListingCard.test.tsx` and `ListingDetailSetsumei.test.tsx`

---

## 2. AI Inquiry Email Draft

**Disabled:** 2026-03-14

**What it was:** A button in QuickView/listing detail that generated an AI-drafted inquiry email to the dealer, pre-filled with listing details and collector context.

**What remains (for re-enablement):**
- Email generation logic in API routes
- `inquiry_emails` feature flag (currently mapped to `free` tier)
- SendGrid email infrastructure

---

## General Notes

Both features were deactivated as a product decision. The underlying data pipelines (setsumei OCR extraction, Yuhinkai catalog matching) continue to run and populate data. Re-enablement is a UI-only change.
