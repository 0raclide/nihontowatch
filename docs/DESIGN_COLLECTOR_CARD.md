# Collector Card — MTG-Inspired Museum Placard Design

**Status:** Implemented (Phase 0-2)
**Date:** 2026-03-15

## Overview

A user-selectable card style inspired by Magic: The Gathering card frames but with museum placard / auction house aesthetics. Intended for collectors who want items *presented*, not just listed.

## Card Anatomy

```
+----------------------------------+  <-- 2px gold border (cert color on hover)
|  +----------------------------+  |
|  | Item Title         [NEW] * |  |  <-- name bar (serif font, cert dot)
|  +----------------------------+  |
|  |                            |  |
|  |      [ HERO IMAGE ]        |  |  <-- aspect-[4/5]
|  |       (smart crop)         |  |
|  +----------------------------+  |
|  | Katana . Bizen . Kamakura  |  |  <-- type line (uppercase, tracking-wide)
|  +----------------------------+  |
|  | "A masterwork of the late  |  |
|  | Kamakura period..."        |  |  <-- text box (curator headline, line-clamp-3)
|  +----------------------------+  |
|  | 72.4 cm        Aoi Art     |  |  <-- stat bar (nagasa/price + dealer/visibility)
|  +----------------------------+  |
+----------------------------------+
```

## Design Decisions

### Aesthetic: Museum Placard, Not Game Card

- **Gold border** (uniform) with cert color reveal on hover
- **Serif font** in name bar (editorial, not decorative)
- **No textures** (no parchment, no linen backgrounds)
- **No drop shadows** (the frame border IS the treatment)
- **Cert dot** (small filled circle) instead of text label — border communicates tier

### Content Priority (Text Box)

1. `ai_curator_headline_en` / `ai_curator_headline_ja` (locale-aware)
2. Description excerpt (~120 chars, `line-clamp-3`)
3. If neither: text box collapses entirely (no empty boxes)

### Stat Bar Content by Source

| Source | Left | Right |
|--------|------|-------|
| Vault/Showcase | Nagasa (cm) | — |
| Browse | Price | Dealer name |
| Dealer | Price | Status label |

## Card Style Toggle

**Orthogonal to theme** — card style is independent of theme selection.

- **Key:** `nihontowatch-card-style` (localStorage)
- **Values:** `standard` (default) | `collector`
- **Location:** ThemeSwitcher dropdown, below theme options (divider separated)
- **Mobile grid fallback:** 2-col mobile always uses standard cards (too dense for framed layout)

## Files

### Created
| File | Purpose |
|------|---------|
| `src/hooks/useCardStyle.ts` | `useCardStyle()` hook — localStorage read/write |
| `src/components/browse/CollectorCard.tsx` | MTG-inspired card component |

### Modified
| File | Change |
|------|--------|
| `src/components/ui/ThemeSwitcher.tsx` | Card Style section in dropdown |
| `src/components/ui/ThemeToggle.tsx` | Card Style section in ThemeSelector (mobile) |
| `src/components/browse/VirtualListingGrid.tsx` | Conditional CollectorCard vs ListingCard rendering |
| `src/app/api/browse/route.ts` | Added `ai_curator_headline_en/ja` to SELECT |
| `src/lib/displayItem/fromShowcaseItem.ts` | Map `ai_curator_headline_en/ja` in showcase items |
| `src/i18n/locales/en.json` | Card style i18n keys |
| `src/i18n/locales/ja.json` | Card style i18n keys |

## Border Color by Certification

| Cert | CSS Variable | On Hover |
|------|-------------|----------|
| Tokubetsu Juyo | `var(--tokuju)` | Purple |
| Jubun / Jubi | `var(--jubi)` | Orange |
| Juyo | `var(--juyo)` | Blue |
| Tokubetsu Hozon | `var(--toku-hozon)` | Brown |
| Hozon | `var(--hozon)` | Olive |
| No cert | `var(--gold)` | Gold (stays gold) |

At rest, ALL cards have gold borders. On hover, certified items transition to their cert color.

## Future Extensions

- **Foil effect**: CSS shimmer on Tokuju cards
- **Card flip**: 3D CSS transform to show measurements on back
- **PNG export**: Generate shareable collector card images
