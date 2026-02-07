# Sanmei Image Extraction Fix

**Date:** 2026-02-06
**Issue:** Listing 47314 had no photos displaying despite images existing on sanmei.com

## Root Causes Identified

### 1. Malformed URL Construction
- **Problem:** Relative URLs like `../media/foo.gif` were being resolved against a static base URL (`https://www.sanmei.com`), producing invalid paths like `https://www.sanmei.com/../media/...`
- **Fix:** Use `urljoin()` with the actual page URL as base, so `../media/` from `/contents/en-us/p2488.html` correctly resolves to `/contents/media/`

### 2. Missing Blade Photos
- **Problem:** Sanmei stores blade photos behind popup HTML pages (e.g., `O47357_S1901_PUP1.html`). The scraper only looked for direct image links ending in `.jpg/.gif/.png`
- **Fix:** Added pattern detection for `_PUP*.html` links and convert them to `.jpg` URLs

### 3. Incorrect Thumbnail Paths
- **Problem:** Thumbnails were stored as `https://www.sanmei.com/media/...` but the correct path is `https://www.sanmei.com/contents/media/...`
- **Fix:** Corrected 115 thumbnail URLs across 44 listings

### 4. Promotional Banner GIFs
- **Problem:** Sanmei places promotional banners (400x182 GIFs) on product pages. These were being scraped as product images. Pattern: `t_katana_*.gif`, `t_wakizashi_*.gif`, etc.
- **Fix:** Added filter to exclude all `t_*.gif` files (banners). Real product images are JPGs.

### 5. Duplicate Images from stored_images
- **Problem:** Old cached images in `stored_images` field were causing duplicates on the frontend
- **Fix:** Cleared `stored_images` for all Sanmei listings

## Code Changes

### Oshi-scrapper: `scrapers/sanmei.py`

```python
# 1. Added urljoin import
from urllib.parse import urljoin

# 2. Updated _extract_product_images() to use page URL as base
def _extract_product_images(self, soup: BeautifulSoup, page_url: str = None) -> list[str]:
    base_url = page_url or "https://www.sanmei.com/contents/en-us/"
    # ... uses urljoin(base_url, src) for relative URLs

# 3. Added PUP popup image extraction
pup_match = re.search(r'([A-Z0-9_]+_PUP\d+)\.html?$', href, re.IGNORECASE)
if pup_match:
    img_url = f"https://www.sanmei.com/Pictures/Sword/{pup_match.group(1)}.jpg"

# 4. Updated _is_icon() to filter banner GIFs
if src_lower.endswith('.gif'):
    filename = src_lower.split('/')[-1]
    if filename.startswith('t_') and '_' in filename[2:]:
        return True  # All t_<itemtype>_*.gif files are banners
```

### Oshi-scrapper: `tests/scrapers/test_sanmei.py`

Added two new tests:
- `test_extracts_popup_images()` - Verifies PUP link → JPG conversion
- `test_resolves_relative_urls()` - Verifies proper URL resolution with `/contents/media/` path

## Database Cleanup

| Action | Count |
|--------|-------|
| Thumbnail URLs corrected (`/media/` → `/contents/media/`) | 115 |
| Banner GIFs removed (timestamped) | 12 |
| Banner GIFs removed (all `t_*.gif`) | 13 |
| `stored_images` cleared | 43 |
| **Total banners removed** | **25** |

## Image Types (Post-Fix)

| Pattern | Type | Example |
|---------|------|---------|
| `k_*.jpg` | NBTHK certificate | `k_O47357_S1901.jpg` |
| `k1_*.jpg` | Additional certificate (tsuba) | `k1_O47357_S1901.jpg` |
| `*_PUP1.jpg` | Blade photo | `O47357_S1901_PUP1.jpg` |
| `*_PUP2.jpg` | Koshirae/fittings photo | `O47357_S1901_PUP2.jpg` |
| `*_PUP3.jpg` | Scabbard detail | `O47357_S1901_PUP3.jpg` |
| `t_Tuba*.jpg` | Tsuba thumbnail (legitimate) | `t_Tuba2354a.jpg` |

## Filtered Out (Banners)

| Pattern | Reason |
|---------|--------|
| `t_katana_*.gif` | Promotional banner (400x182) |
| `t_wakizashi_*.gif` | Promotional banner |
| `t_tanto_*.gif` | Promotional banner |
| `t_yari_*.gif` | Promotional banner |
| `aoi_tokugawa*.gif` | Site logo |
| `*_60th.gif` | Anniversary badge |
| `flag*.gif` | Language switcher |
| `sendmail*.gif` | Email button |

## Verification

All 38 Sanmei scraper tests pass. Final database state:
- 44 Sanmei listings with images
- 0 malformed URLs
- 0 GIF banners
- 0 duplicate images
- 24 listings with blade photos (PUP pattern)

## Scripts Created

Cleanup scripts in `nihontowatch/scripts/`:
- `check_sanmei.js` - Integrity check for Sanmei listings
- `fix_sanmei_thumbnails.js` - Fix `/media/` → `/contents/media/` paths
- `clean_sanmei_banners.js` - Remove timestamped banner GIFs
- `clean_all_gif_banners.js` - Remove all `t_*.gif` banners
- `check_banners.js` - Find banner patterns in database
