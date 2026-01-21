# Postmortem: Missing Stored Images in Supabase Storage

**Date:** 2026-01-20
**Status:** Root Cause Identified, Fix Required
**Severity:** High - 35% of images not stored in CDN

---

## Executive Summary

Investigation revealed that **2,222 images (35.3%) are not stored in Supabase Storage** despite being scraped. The root cause is that the **daily scrape pipeline does not upload images to storage** - it only saves image URLs to the `images` column. Image upload only happens when using the CLI directly or running the migration script manually.

---

## Current State

### Image Storage Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total original images** | 5,706 | 100% |
| **Stored in Supabase** | 3,691 | 64.7% |
| **Missing from storage** | 2,222 | 35.3% |

### Upload Status Distribution

| Status | Listings | Description |
|--------|----------|-------------|
| `pending` | 443 | Never processed for upload |
| `completed` | 319 | All images uploaded successfully |
| `partial` | 200 | Some images failed to upload |
| `failed` | 38 | All images failed (retry needed) |

### Dealers with Most Missing Images

| Dealer | Coverage | Missing Images | Status |
|--------|----------|----------------|--------|
| **World Seiyudo** | 13% | 1,308 | 418 listings pending |
| **Aoi Art** | 50% | 384 | 24 failed, 6 pending |
| **Yushindou** | 45% | 144 | 4 failed |
| **Nihonto Art** | 19% | 82 | 4 pending |
| **Touken Komachi** | 71% | 48 | 1 pending |

**World Seiyudo alone accounts for 59% of all missing images.**

---

## Root Cause Analysis

### The Problem

There are **two separate scraping pipelines** with different behaviors:

1. **CLI Scraper (`main.py scrape`)** - Uploads images to Supabase Storage
2. **Daily Scrape (`scripts/daily_scrape.py`)** - Does NOT upload images

### Code Evidence

**main.py (lines 2284-2306)** - CLI scraper DOES upload images:
```python
# Upload images to Supabase Storage
if not skip_image_upload and result.images and saved_row.get('id'):
    storage_mgr = ImageStorageManager(http_client=http_client)
    upload_result = storage_mgr.upload_listing_images(
        listing_id=saved_row['id'],
        dealer_slug=dealer_slug,
        image_urls=result.images,
    )
    if upload_result.stored_images:
        listing_repo.update_stored_images(...)
```

**daily_scrape.py (lines 320-339)** - Daily scrape does NOT:
```python
# Scrape the URL
scraper = get_scraper_for_url(url, client)
listing = scraper.scrape(url)

if listing.success:
    listing_repo.upsert(listing)  # <-- Only saves to DB, no image upload!
    discovery_repo.mark_scraped(url)
```

### Why World Seiyudo is Most Affected

World Seiyudo was added on **2026-01-16** (commit `9ef932e`). All 432 listings were scraped via the daily scrape pipeline, which explains why **418 of 432 listings (97%)** have `pending` image upload status.

### Timeline Analysis

Listings missing stored images by `first_seen` month:
- **2025-12**: 5 listings
- **2026-01**: 455 listings (majority from recent dealer additions)

---

## Error Types for Failed Uploads

| Error | Count | Cause |
|-------|-------|-------|
| All images failed to upload | 27 | Download failures |
| Dealer server timeout | 13 | Dealer site slow/down |
| Resource temporarily unavailable | 7 | Connection issues |
| SSL handshake timeout | 1 | Network issues |

---

## Impact

1. **Performance**: Users see slower image loads (dealer URLs vs CDN)
2. **Reliability**: Original dealer images may become unavailable
3. **Cost**: Increased bandwidth from dealer sites instead of our CDN
4. **User Experience**: Inconsistent image loading times

---

## Recommended Fixes

### Option 1: Add Image Upload to Daily Scrape (Recommended)

Modify `scripts/daily_scrape.py` to upload images after scraping:

```python
# In run_scrape(), after listing_repo.upsert(listing):
if listing.images and saved_row.get('id'):
    storage_mgr = ImageStorageManager(http_client=client)
    upload_result = storage_mgr.upload_listing_images(
        listing_id=saved_row['id'],
        dealer_slug=dealer_slug,
        image_urls=listing.images,
    )
    if upload_result.stored_images:
        listing_repo.update_stored_images(...)
```

**Pros:**
- All new listings get images uploaded immediately
- No separate migration step needed
- Consistent behavior with CLI scraper

**Cons:**
- Increases daily scrape runtime
- May hit rate limits on dealer sites

### Option 2: Run Migration Script in Daily Workflow

Add a step to the GitHub Actions workflow to run the migration script after scraping:

```yaml
- name: Migrate images to storage
  run: |
    python scripts/migrate_images_to_storage.py --limit 500 --workers 10
```

**Pros:**
- Minimal code changes
- Can control batch size

**Cons:**
- Delay between scrape and image availability
- Extra workflow step to maintain

### Option 3: Scheduled Image Migration Job

Create a separate GitHub Actions workflow that runs hourly to migrate pending images:

```yaml
name: Image Migration
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
```

**Pros:**
- Decoupled from scraping
- Continuous background processing

**Cons:**
- Another workflow to maintain
- Still has delay

---

## Immediate Actions Required

### 1. Run Migration for World Seiyudo (Priority: Critical)

```bash
cd Oshi-scrapper
python scripts/migrate_images_to_storage.py --dealer "World Seiyudo" --limit 500 --workers 10
```

This will process the 418 pending listings.

### 2. Retry Failed Uploads

```bash
python scripts/migrate_images_to_storage.py --retry-failed --limit 100
```

### 3. Full Migration for All Pending

```bash
python scripts/migrate_images_to_storage.py --limit 1000 --workers 10
```

---

## Verification

After running migrations, verify with:

```bash
python scripts/migrate_images_to_storage.py --stats
```

Expected output should show migration % approaching 100%.

---

## Prevention

1. **Add image upload to daily_scrape.py** (see Option 1 above)
2. **Add monitoring** for `images_upload_status = 'pending'` count
3. **Add health check** alert if pending count > 100
4. **Document** that CLI scraper and daily scraper have different behaviors

---

## Files Referenced

| File | Purpose |
|------|---------|
| `Oshi-scrapper/main.py:2284-2306` | CLI scraper image upload logic |
| `Oshi-scrapper/scripts/daily_scrape.py:290-375` | Daily scrape (no image upload) |
| `Oshi-scrapper/scripts/migrate_images_to_storage.py` | Batch migration script |
| `Oshi-scrapper/utils/supabase_storage.py` | ImageStorageManager class |
| `Oshi-scrapper/db/repository.py:446-471` | update_stored_images method |
| `Oshi-scrapper/.github/workflows/daily-scrape.yml` | Daily cron workflow |

---

## Appendix: Analysis Scripts

Scripts created during investigation:
- `nihontowatch/scripts/check-image-stats.js` - Basic stats query
- `nihontowatch/scripts/detailed-image-report.js` - Detailed analysis

Run with:
```bash
cd nihontowatch
node scripts/detailed-image-report.js
```
