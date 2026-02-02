# Nihonto Australia Integration Postmortem

**Date:** 2026-02-02
**Status:** Complete
**Dealer ID:** 70

## Summary

Successfully integrated Nihonto Australia (nihonto.com.au) as the first Australian dealer on nihontowatch.com. This required scraper development, bug fixes, and frontend currency support.

## Work Completed

### 1. Scraper Development (Oshi-scrapper)

**Files Modified:**
- `scrapers/dealers/nihonto_au.py` - Product page scraper
- `scrapers/discovery/nihonto_au.py` - WooCommerce API discovery crawler
- `scrapers/dealers/__init__.py` - Created package for dealer scrapers
- `scrapers/__init__.py` - Added dealer imports
- `prompts/dealers/nihonto_au.py` - LLM extraction hints

**Key Features:**
- WooCommerce Store API integration for catalog discovery
- Divi theme dual-gallery image extraction
- AUD currency handling (all prices in Australian Dollars)
- Stock status detection (In Stock, On Hold, Reserved, Sold)
- Item type classification (swords, tosogu, armor, etc.)

### 2. Bug Fixes

#### Domain Matching Bug
**Problem:** `nihonto.com` scraper was matching `nihonto.com.au` URLs due to substring matching.
**Fix:** Implemented exact domain matching with subdomain support in `scrapers/base.py`.
**Commit:** `eb234ec`

#### Banner Image in Gallery
**Problem:** Site header banner (`nihonto-australia-header-no-text.jpg`) was being captured as first product image.
**Fix:** Added `_is_icon()` override in NihontoAuScraper to filter banner patterns.
**Commit:** `69a4e29`

**Patterns filtered:**
- `nihonto-australia-header`
- `nihonto-australia-logo`
- `samurai-gallery-header`
- `header-no-text`

#### Currency Mismatch (USD vs AUD)
**Problem:** 44 listings had `price_currency: 'USD'` instead of `'AUD'`.
**Fix:** Database update + strengthened LLM hints to emphasize AUD.
**Commit:** `578ea85`

### 3. Frontend Changes (nihontowatch)

#### AUD Currency Support
**Problem:** AUD was not in exchange rates, so Australian prices couldn't be converted.
**Fix:** Added AUD to exchange rates API and fallback rates.
**Commit:** `15a6f5a`

**Files Modified:**
- `src/app/api/exchange-rates/route.ts` - Added AUD to Frankfurter API call
- `src/lib/currency/convert.ts` - Added AUD fallback rate (97 JPY/AUD)

#### Dealer Filter
**Problem:** Nihonto Australia not appearing in International dealers filter.
**Fix:** Added to `DEALER_COUNTRIES` mapping.
**Commit:** `5da440a`

**File Modified:**
- `src/components/browse/FilterContent.tsx` - Added `'Nihonto Australia': 'AU'`

### 4. Database Updates

```sql
-- Created dealer
INSERT INTO dealers (id, name, domain, is_active, country)
VALUES (70, 'Nihonto Australia', 'nihonto.com.au', true, 'AU');

-- Fixed banner images (18 listings)
UPDATE listings SET images = filtered_images WHERE dealer_id = 70 AND images[1] LIKE '%header%';

-- Fixed currency (44 listings)
UPDATE listings SET price_currency = 'AUD' WHERE dealer_id = 70 AND price_currency = 'USD';
```

## Final Statistics

| Metric | Value |
|--------|-------|
| Total URLs discovered | 390 |
| Items excluded (non-nihonto) | 73 |
| Listings scraped | 247+ (backfill continuing) |
| Classification rate | 99.7% (1 unknown) |
| Price extraction rate | ~70% (some "Contact for Price") |
| Image extraction | 100% |

## Currency Conversion Flow

```
Database: AUD $5,000
     ↓
Exchange Rate API: 1 USD = 1.4264 AUD
     ↓
Convert to USD: $5,000 / 1.4264 = $3,505
     ↓
Display Currency (user choice):
  - JPY (default): $3,505 × 154 = ¥539,770
  - USD: $3,505
  - EUR: $3,505 × 0.84 = €2,944
```

## Commits Summary

| Repo | Commit | Description |
|------|--------|-------------|
| Oshi-scrapper | `eb234ec` | Fix domain matching (exact match) |
| Oshi-scrapper | `578ea85` | Fix AUD currency in hints |
| Oshi-scrapper | `69a4e29` | Filter banner images from gallery |
| nihontowatch | `5da440a` | Add Nihonto Australia to filters |
| nihontowatch | `15a6f5a` | Add AUD currency support |

## Excluded Item Patterns

The discovery crawler filters out non-nihonto items:
- Paintings, scrolls, prints
- Noh/Bugaku masks
- Okimono, netsuke (standalone)
- Religious items (Buddha statues)
- Certificates (standalone)
- Books, tools, stands

## Known Issues

1. **Image upload warning** - `http_client is not defined` in backfill logs (pre-existing, doesn't affect scraping)
2. **Some items "Contact for Price"** - These show as "Ask" in the UI (expected behavior)

## Testing Verification

Verified against actual page content:
- Smith names match
- Nagasa measurements match
- Certifications match
- Images are product images (not banners)
- Prices are in AUD

## QA Report (Post-Backfill)

### Final Statistics

| Metric | Value | Status |
|--------|-------|--------|
| Total listings | 390 | ✓ |
| Unknown items | 0 | ✓ Fixed |
| Currency (AUD) | 100% | ✓ Fixed |
| Banner images | 0 | ✓ Fixed |
| Price coverage | 53.6% | OK (some "Contact for Price") |
| Image coverage | 95.4% | OK (18 have dealer placeholders) |
| Sword smith | 86.2% | Good |
| Tosogu attribution | 27.7% | Fixed (was 0%) |
| Sword nagasa | 40.7% | Acceptable |

### Item Type Distribution

| Type | Count | % |
|------|-------|---|
| tsuba | 153 | 39.2% |
| katana | 72 | 18.5% |
| menuki | 32 | 8.2% |
| tanto | 31 | 7.9% |
| wakizashi | 21 | 5.4% |
| kozuka | 15 | 3.8% |
| fuchi-kashira | 13 | 3.3% |
| yari | 10 | 2.6% |
| inro | 10 | 2.6% |
| other | 33 | 8.5% |

### QA Fixes Applied

1. **23 Unknown items classified:**
   - 5 kabuto (helmets)
   - 9 inro
   - 3 kogai
   - 2 koshirae (daisho)
   - 1 armor
   - 1 katana
   - 1 fuchi-kashira
   - 1 book (excluded from nihonto)

2. **64 tosogu items fixed:**
   - Copied `school` → `tosogu_school`
   - Copied `smith` → `tosogu_maker`

3. **18 listings with no images:**
   - Verified as dealer-side issue (placeholder images on website)
   - Not a scraping bug

### Certification Breakdown

| Type | Count |
|------|-------|
| Hozon | 35 |
| TokuHozon | 33 |
| Juyo | 8 |
| Tokuju | 1 |

## Related Documentation

- `prompts/dealers/nihonto_au.py` - LLM extraction hints for this dealer
- `CLAUDE.md` - Updated dealer list includes Nihonto Australia
