# Dealer-Specific Documentation

This document tracks dealer-specific customizations, quirks, and maintenance notes for each dealer in the aggregator.

---

## Table of Contents

- [Aoi Art](#aoi-art)
- [Touken Matsumoto](#touken-matsumoto)
- [Adding New Dealer Notes](#adding-new-dealer-notes)

---

## Aoi Art

**Domain:** aoijapan.com, aoijapan.net
**Scraper:** `Oshi-scrapper/scrapers/aoi_art.py`
**Status:** Active

### Excluded Images

The following images are excluded from scraping because they appear on listing pages but are not product images:

| Image | Reason | Added |
|-------|--------|-------|
| `Tsuruta.gif` | Shop owner Mr. Tsuruta holding a sword - appears on many listing pages | 2026-01-17 |

**Implementation:**
- `EXCLUDED_IMAGES` constant in `aoi_art.py` (line ~44)
- `_is_excluded_image()` method filters these before returning images
- Tests in `tests/scrapers/test_aoi_art.py`:
  - `test_excludes_shop_owner_image`
  - `test_is_excluded_image_detects_tsuruta`
  - `test_excluded_images_list_contains_known_exclusions`
  - `test_excludes_shop_owner_even_when_only_image`

**Database Cleanup (2026-01-17):**
- Removed `https://www.aoijapan.com/img/Tsuruta.gif` from 272 listings
- Script: `scripts/remove_shop_owner_image.ts` (deleted after use)

### Image Extraction Strategy

Aoi Art uses a multi-strategy approach for image extraction:

1. **Primary:** `/img/sword/` path images (Aoi Art specific)
2. **Fallback 1:** WooCommerce product gallery
3. **Fallback 2:** Entry content div images
4. **Fallback 3:** Product/article images
5. **Fallback 4:** WordPress uploads path

**Max images:** 20 per listing

### Known Quirks

- Some listings have the shop owner image mixed in with product images
- Price can be in JSON-LD, meta tags, or text patterns
- Certification data often in title or description text

---

## Touken Matsumoto

**Domain:** touken-matsumoto.jp
**Scraper:** `Oshi-scrapper/scrapers/touken_matsumoto.py`
**Status:** Active
**Dealer ID:** 24

### Sold Detection

Uses "売却済" (baikyaku-zumi) as the primary sold indicator.

**Implementation (2025-01-20):**
- Added "売却済" pattern to `utils/price_parser.py`
- Updated LLM prompt in `utils/llm_extractor.py`
- Added dealer hints in `prompts/dealers/touken_matsumoto.py`
- Post-LLM validation in `scrapers/base.py` overrides hallucinations

### Known Quirks

- All pages have "All Rights Reserved" in footer (was triggering false "reserved" status)
- Specializes in tosogu (fittings) - mostly tsuba
- Many items priced under ¥100k (filtered by browse MIN_PRICE_JPY threshold)

### Incident History

- **2025-01-20:** All 77 listings incorrectly marked as sold due to LLM hallucination. Fixed with post-LLM validation layer. See [POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md](./POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md)

---

## Adding New Dealer Notes

When documenting dealer-specific updates, include:

1. **Image Exclusions:**
   - Full URL or filename pattern
   - Reason for exclusion
   - Date added
   - Implementation location

2. **Database Cleanups:**
   - What was changed
   - How many records affected
   - Script used (if any)

3. **Scraping Quirks:**
   - Page structure issues
   - Data extraction challenges
   - Workarounds implemented

### Template

```markdown
## Dealer Name

**Domain:** example.com
**Scraper:** `Oshi-scrapper/scrapers/dealer_name.py`
**Status:** Active / Inactive / Planned

### Excluded Images

| Image | Reason | Added |
|-------|--------|-------|
| `image.jpg` | Description | YYYY-MM-DD |

### Known Quirks

- Quirk 1
- Quirk 2

### Database Cleanups

- **YYYY-MM-DD:** Description of cleanup
```

---

## Quick Reference: All Dealers

See [CLAUDE.md](../CLAUDE.md#current-dealers-27-total) for the complete dealer list.

| Dealer | Domain | Has Custom Notes |
|--------|--------|------------------|
| Aoi Art | aoijapan.com | Yes |
| Touken Matsumoto | touken-matsumoto.jp | Yes |
| Eirakudo | eirakudo.com | No |
| Nipponto | nipponto.co.jp | No |
| E-sword | e-sword.jp | No |
| ... | ... | ... |

*Add entries to this table as dealer-specific documentation is added.*
