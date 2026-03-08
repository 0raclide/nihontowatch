# Session: Kanto Hibisho (関東日々抄) Scholarly Reference

**Date:** 2026-03-08
**Branch:** main (deployed to prod)
**Commit:** `9d4cbf0`

---

## Problem

The Kanto Hibisho is a multi-volume scholarly publication by Honma Junji (本間順治) documenting specific nihonto. Having a Kanto Hibisho entry is prestigious — similar to a Tanobe sayagaki. Dealers needed a way to record this reference (volume, entry number, text, page scans) when listing a sword. This is only relevant for nihonto (swords), not tosogu or armor.

---

## Solution

### Data Model

Single JSONB column on `listings`:

**KantoHibishoData** (`listings.kanto_hibisho`):
```typescript
{
  volume: string;          // "2" or "上"
  entry_number: string;    // "1110"
  text: string | null;     // Copy-pasted content (any language)
  images: string[];        // Scanned PDF pages (max 10)
}
```

Key design decisions:
- **Single entry per sword** — unlike sayagaki (array of entries), a sword has at most one Kanto Hibisho reference
- **Free-form text** — EN from overseas dealers, JP from Japanese dealers (no language detection needed)
- **Volume + entry number as strings** — some volumes use kanji (上/下), not just numbers
- **Max 10 images** — PDF page scans can be numerous (more generous than sayagaki's 5)

### Architecture

Follows established patterns exactly:
- **Display:** `KantoHibishoDisplay` mirrors `SayagakiDisplay` (section header, content, thumbnail grid with lightbox)
- **Form:** `KantoHibishoSection` uses opt-in reveal pattern (simpler than array-based SayagakiSection since it's a single entry). When null → "Add" button. When present → bordered card with remove, volume/entry inputs side-by-side, 6-row textarea, image upload.
- **Image upload:** Dual-mode (add: blob previews + pending files, edit: immediate upload to Supabase Storage). Storage path: `{dealerId}/{listingId}/kanto-hibisho/{uuid}.{ext}`
- **Category gating:** Only visible when `category === 'nihonto'`. Cleared on nihonto→tosogu switch (with confirmation if data exists).

---

## Files Created (4)

| File | Purpose |
|------|---------|
| `supabase/migrations/113_kanto_hibisho.sql` | `ALTER TABLE listings ADD COLUMN kanto_hibisho JSONB DEFAULT NULL` |
| `src/components/listing/KantoHibishoDisplay.tsx` | Display component with lightbox (QuickView, MobileSheet, ListingDetail) |
| `src/components/dealer/KantoHibishoSection.tsx` | Dealer form section — opt-in reveal, vol/entry inputs, textarea, image upload |
| `src/app/api/dealer/kanto-hibisho-images/route.ts` | POST/DELETE image upload endpoint (follows sayagaki-images pattern) |

## Files Modified (10)

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `KantoHibishoData` interface + `kanto_hibisho` field on `Listing` |
| `src/lib/listing/getListingDetail.ts` | Added to SELECT, `ListingWithDealer`, `EnrichedListingDetail`, return object |
| `src/app/api/dealer/listings/route.ts` | POST: destructure + serialize `kanto_hibisho` to JSONB |
| `src/app/api/dealer/listings/[id]/route.ts` | GET: added to SELECT. ALLOWED_FIELDS: added `kanto_hibisho` |
| `src/components/dealer/DealerListingForm.tsx` | State, draft persistence, category switch guard, submit payload, pending file upload, render section (nihonto only, between Sayagaki and Koshirae) |
| `src/components/listing/QuickViewContent.tsx` | Render `KantoHibishoDisplay` after KiwameDisplay |
| `src/components/listing/QuickViewMobileSheet.tsx` | Render `KantoHibishoDisplay` after KiwameDisplay |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Render `KantoHibishoDisplay` after KiwameDisplay |
| `src/i18n/locales/en.json` | 10 new keys |
| `src/i18n/locales/ja.json` | 10 matching JA keys |

---

## Form Placement

In the dealer listing form, the section order is:

1. Category (nihonto/tosogu)
2. Item Type
3. Certification
4. **Sayagaki** (nihonto) / Hakogaki (tosogu)
5. **Kanto Hibisho** (nihonto only) ← NEW
6. Koshirae (nihonto, non-koshirae item types)
7. Provenance
8. Kiwame
9. Artisan

---

## Display Placement

In QuickView, MobileSheet, and ListingDetail, the display order after metadata is:

1. Sayagaki / Hakogaki
2. Koshirae
3. Provenance
4. Kiwame
5. **Kanto Hibisho** ← NEW
6. Description

---

## i18n Keys

| Key | EN | JA |
|-----|----|----|
| `dealer.kantoHibisho` | Kantō Hibishō (関東日々抄) | 関東日々抄 |
| `dealer.addKantoHibisho` | Add Kantō Hibishō Entry | 関東日々抄を追加 |
| `dealer.removeKantoHibisho` | Remove | 削除 |
| `dealer.kantoHibishoVolume` | Volume | 巻 |
| `dealer.kantoHibishoEntryNumber` | Entry No. | 番号 |
| `dealer.kantoHibishoText` | Content | 内容 |
| `dealer.kantoHibishoTextPlaceholder` | Paste or type the Kantō Hibishō entry text | 関東日々抄の記載内容を入力してください |
| `dealer.kantoHibishoPhotos` | Page Scans | ページスキャン |
| `dealer.kantoHibishoMaxImages` | Maximum 10 images per entry | 最大10枚 |

---

## Testing

- `npm run build` — clean, no type errors
- `npm test` — 196 test files pass, 4838 tests, 0 failures
- Migration 113 applied to Supabase production
