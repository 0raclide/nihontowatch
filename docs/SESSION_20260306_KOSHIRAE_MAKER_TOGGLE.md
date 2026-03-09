# Session: Koshirae Item Type — Single/Multi Maker Toggle

**Date:** 2026-03-06
**Commit:** `df8b1d4`
**Branch:** main (deployed to prod)

---

## Problem

When a dealer selects `item_type = 'koshirae'` (standalone koshirae listing), the form showed a single artisan field — identical to a tsuba or menuki. But koshirae are composite objects: tsuba by one maker, fuchi-kashira by another, etc.

The companion `KoshiraeSection` sub-form (for blades that come WITH koshirae) already had a single/multi maker toggle. The standalone koshirae path needed the same capability.

Additionally, when viewing a standalone koshirae listing, the display showed a redundant "KOSHIRAE (拵)" heading — the item IS a koshirae, so the label is tautological.

---

## Solution

### 1. Extracted `KoshiraeMakerSection` (new shared component)

**File:** `src/components/dealer/KoshiraeMakerSection.tsx` (~155 lines)

Extracted the mode toggle + single/multi maker body from `KoshiraeSection.tsx` into a reusable component with clean props:

```typescript
interface KoshiraeMakerSectionProps {
  artisanId: string | null;
  artisanName: string | null;
  artisanKanji: string | null;
  components: KoshiraeComponentEntry[];
  onArtisanChange: (id: string | null, name: string | null, kanji: string | null) => void;
  onComponentsChange: (components: KoshiraeComponentEntry[]) => void;
}
```

Contains:
- `makerMode` state ('single' | 'multi'), inferred from props on mount
- Mode toggle pills (Single Maker / Multiple Makers)
- Single mode: artisan display card + `ArtisanSearchPanel` (domain="tosogu")
- Multi mode: `KoshiraeComponentCard[]` + "Add Component" button
- Mode switch logic with confirmation dialog

### 2. Refactored `KoshiraeSection`

Replaced ~90 lines of inline maker UI with `<KoshiraeMakerSection>`. Net deletion: 106 lines. Removed: `MakerMode` type, `inferMode()`, `createEmptyComponent()`, `handleModeSwitch`, `handleSingleArtisanSelect`, `handleSingleArtisanClear`, `handleAddComponent`, `handleComponentChange`, `handleComponentRemove`. Added thin `handleArtisanChange`/`handleComponentsChange` callbacks.

Exported `createEmptyKoshirae()` for reuse by `DealerListingForm`.

### 3. Modified `DealerListingForm`

Three changes:

**A. Hide companion KoshiraeSection** when `itemType === 'koshirae'`:
```tsx
{itemType !== 'koshirae' && (
  <KoshiraeSection ... />
)}
```

**B. Replace artisan section** with `KoshiraeMakerSection` when `itemType === 'koshirae'`:
- Single mode `onArtisanChange`: updates BOTH form artisan state (`artisanId/Name/Kanji` → `tosogu_maker`) AND `koshirae.artisan_id/name/kanji` (→ JSONB)
- Multi mode `onComponentsChange`: clears single artisan state, updates `koshirae.components[]`

**C. Auto-init koshirae state** via `useEffect` when itemType changes to 'koshirae':
```tsx
useEffect(() => {
  if (itemType === 'koshirae' && !koshirae) {
    setKoshirae(createEmptyKoshirae());
  }
}, [itemType, koshirae]);
```

### 4. Added `hideHeading` to `KoshiraeDisplay`

```typescript
interface KoshiraeDisplayProps {
  koshirae: KoshiraeData;
  hideHeading?: boolean;  // When item IS a koshirae, skip "KOSHIRAE" label
}
```

Passed in all 3 consumers:
- `QuickViewContent.tsx` — `hideHeading={listing.item_type?.toLowerCase() === 'koshirae'}`
- `QuickViewMobileSheet.tsx` — same
- `ListingDetailClient.tsx` — same

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/components/dealer/KoshiraeMakerSection.tsx` | **NEW** | +155 |
| `src/components/dealer/KoshiraeSection.tsx` | Refactored | -106 net |
| `src/components/dealer/DealerListingForm.tsx` | Modified | +46 |
| `src/components/listing/KoshiraeDisplay.tsx` | Modified | +4 |
| `src/components/listing/QuickViewContent.tsx` | Modified | +1 |
| `src/components/listing/QuickViewMobileSheet.tsx` | Modified | +1 |
| `src/app/listing/[id]/ListingDetailClient.tsx` | Modified | +1 |

**Total:** +248 / -176 (net +72 lines, mostly the new shared component)

---

## Data Flow

### Standalone Koshirae (`item_type = 'koshirae'`)

```
DealerListingForm
├── KoshiraeMakerSection (in artisan section)
│   ├── Single mode → onArtisanChange → sets artisanId + koshirae.artisan_id
│   └── Multi mode  → onComponentsChange → clears artisanId, sets koshirae.components[]
├── KoshiraeSection HIDDEN (item IS the koshirae)
└── Submit → payload includes:
    ├── tosogu_maker (from artisanKanji/artisanName — single mode only)
    └── koshirae JSONB (artisan_id + components[])
```

### Companion Koshirae (blade with koshirae)

```
DealerListingForm
├── ArtisanSearchPanel (blade artisan — in artisan section)
├── KoshiraeSection (companion sub-form)
│   └── KoshiraeMakerSection (koshirae artisan)
└── Submit → payload includes:
    ├── smith (blade artisan)
    └── koshirae JSONB (koshirae artisan + components[])
```

---

## No Migration Required

`listings.koshirae` JSONB column already stores the full `KoshiraeData` shape including `artisan_id`, `artisan_name`, `artisan_kanji`, and `components[]`. No schema changes needed.

---

## Verification

- `npx tsc --noEmit` — clean
- `npm test` — 4718 passed, 9 failed (all pre-existing: CollectionPageClient localStorage mock, concordance tolerance, LoginModal OTP)
- No new i18n keys — existing `dealer.singleMaker`, `dealer.multipleMakers`, `dealer.confirmClearComponents` cover everything

---

## Testing Checklist

1. Select `item_type = 'koshirae'` → mode toggle appears, companion KoshiraeSection hidden
2. Single maker: select artisan → saved to both `tosogu_maker` and `koshirae.artisan_id`
3. Multi maker: add components → `tosogu_maker` null, `koshirae.components[]` populated
4. Mode switch: single→multi clears artisan, multi→single confirms and clears components
5. Edit mode: load existing koshirae with components → multi mode inferred
6. QuickView: standalone koshirae → no "KOSHIRAE" heading, components show inline
7. Companion koshirae (blade listing): KoshiraeSection still works unchanged
