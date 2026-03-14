# Session: Collector Card — MTG-Inspired Museum Placard

**Date:** 2026-03-15
**Status:** Deployed to prod, admin-only toggle

## What Was Built

A new user-selectable card style for browse, vault, showcase, and dealer grids. Inspired by Magic: The Gathering card frames but styled as museum placards / auction catalog entries.

### Card Anatomy

```
+----------------------------------+  <-- 1px muted border (cert color on hover)
|  +----------------------------+  |
|  | Item Title              *  |  |  <-- name bar (serif, cert dot right)
|  +----------------------------+  |
|  |                            |  |
|  |      [ HERO IMAGE ]        |  |  <-- aspect-[4/5], smart crop
|  |                            |  |
|  +----------------------------+  |
|  | KATANA · SOSHU · KAMAKURA  |  |  <-- type line (uppercase, tracking-wide)
|  +----------------------------+  |
|  | "An exceptional katana..." |  |  <-- text box (curator headline, line-clamp-3)
|  +----------------------------+  |
|  | 68.3 cm          Aoi Art   |  |  <-- stat bar (nagasa/price + dealer)
|  +----------------------------+  |
+----------------------------------+
```

### Key Design Decisions

1. **Museum placard, not game card** — Serif title, italic flavor text, no textures, no drop shadows. The frame is structure, not decoration.
2. **Muted border at rest** — `border-border/60` (1px). Early iteration used bright `var(--gold)` (2px) which was overwhelmingly loud. Killed it.
3. **Cert color on hover** — Border transitions to cert color (purple Tokuju, blue Juyo, etc.) as a subtle reveal. No cert = stays muted.
4. **Text box collapses** — No empty boxes. Items without curator headline or description simply omit the section.
5. **Admin-only for now** — Card style toggle hidden behind `isAdmin` prop in ThemeSwitcher. Remove gate when ready to ship.

## Files Created

| File | Purpose |
|------|---------|
| `src/hooks/useCardStyle.ts` | Shared card style store using `useSyncExternalStore` |
| `src/components/browse/CollectorCard.tsx` | The collector card component (~470 lines) |
| `docs/DESIGN_COLLECTOR_CARD.md` | Formal design document |

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/browse/route.ts` | Added `ai_curator_headline_en/ja` to SELECT |
| `src/lib/displayItem/fromShowcaseItem.ts` | Map `ai_curator_headline_en/ja` in showcase items |
| `src/components/browse/VirtualListingGrid.tsx` | Conditional `CollectorCard` vs `ListingCard` rendering |
| `src/components/collection/SortableCard.tsx` | Card style switching for vault drag grid |
| `src/components/collection/SortableCollectionGrid.tsx` | Card style switching for drag overlay |
| `src/components/ui/ThemeSwitcher.tsx` | Card Style section (admin-gated) |
| `src/components/ui/ThemeToggle.tsx` | Card Style section in mobile ThemeSelector (admin-gated) |
| `src/components/layout/Header.tsx` | Pass `isAdmin` to ThemeSwitcher |
| `src/components/layout/MobileNavDrawer.tsx` | Pass `isAdmin` to ThemeSelector |
| `src/i18n/locales/en.json` | 6 card style i18n keys |
| `src/i18n/locales/ja.json` | 6 card style i18n keys |

## Bugs Fixed During Session

### 1. Card style not syncing across components

**Problem:** `useCardStyle()` was a plain `useState` hook — each component got its own independent state. Clicking "Collector" in ThemeSwitcher updated ThemeSwitcher's state but VirtualListingGrid's copy stayed on "standard".

**Fix:** Rewrote hook to use `useSyncExternalStore` with module-level state. All consumers share the same store. One `setCardStyle` call triggers re-render in every consumer.

### 2. Vault grid bypassed VirtualListingGrid

**Problem:** The vault page uses `SortableCollectionGrid` → `SortableCard` → hardcoded `ListingCard`, completely bypassing VirtualListingGrid where card switching was wired.

**Fix:** Added `useCardStyle` to both `SortableCard` and `SortableCollectionGrid`, with the same `CardComponent` pattern.

### 3. Bright gold border was too loud

**Problem:** `2px solid var(--gold)` (the accent color) drew all attention to the frame instead of the content. Looked like a highlight/selection state, not a subtle frame.

**Fix:** Changed to `border border-border/60` (1px, muted). Cert color only appears on hover as a reveal.

## Architecture Notes

### Three Card Rendering Paths

Cards render through three independent paths — ALL must be updated when changing card behavior:

1. **VirtualListingGrid** — Browse, showcase, dealer listings, vault (non-drag)
2. **SortableCollectionGrid** — Vault when `isDragEnabled` (custom sort + desktop + grid view)
3. **SortableCard** — Individual draggable card wrapper inside SortableCollectionGrid

### Card Style Store

```
useCardStyle() → useSyncExternalStore
  ├── Module-level: currentStyle, listeners[], emitChange()
  ├── subscribe/getSnapshot/getServerSnapshot
  ├── Initializes from localStorage on module load
  └── setCardStyle writes localStorage + emits to all subscribers
```

No React Context needed. Module-level store is simpler and sufficient since card style doesn't affect the DOM tree (no `<html>` class toggles).

### Text Box Content Priority

1. `ai_curator_headline_en` / `ai_curator_headline_ja` (locale-aware)
2. Description excerpt (~120 chars)
3. Collapse entirely (no empty box)

### Stat Bar Content by Source

| Source | Left | Right |
|--------|------|-------|
| Vault/Showcase | Nagasa (cm) | — |
| Browse | Price | Dealer name |
| Dealer | Price | Status label |

## Opening to All Users

When ready to remove the admin gate:

1. **ThemeSwitcher.tsx** — Remove `isAdmin &&` wrapper around card style section
2. **ThemeToggle.tsx** — Remove `isAdmin &&` wrapper around card style section
3. **Header.tsx** — Can stop passing `isAdmin` to ThemeSwitcher (optional cleanup)
4. **MobileNavDrawer.tsx** — Can stop passing `isAdmin` to ThemeSelector (optional cleanup)

## Future Polish Ideas

- **Cert-colored top ribbon** — 3px strip of cert color above name bar (instead of/in addition to border hover)
- **Foil shimmer** — CSS gradient animation on Tokuju card borders
- **Card flip** — 3D CSS transform to show measurements/specs on back
- **Wider cert dot** — Current 2.5px diameter may be too subtle (try 3-4px)
- **Browse grid gap** — Collector cards may benefit from slightly more gap between cards than standard
- **Performance** — Monitor if the `useSyncExternalStore` pattern causes unnecessary re-renders on large grids

## Commits

1. `74d20b02` — feat: add collector card style (MTG-inspired museum placard, admin-only toggle)
2. `78a006b5` — fix: use useSyncExternalStore for card style so all instances share state
3. `1ee00982` — fix: wire collector card into vault sortable grid and drag overlay
4. `6c897040` — fix: replace bright gold border with subtle muted frame
