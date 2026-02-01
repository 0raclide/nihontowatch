# Postmortem: False 404 Detection Marking Listings as Sold

**Date:** 2026-02-02
**Severity:** Medium
**Affected:** 62 listings across multiple dealers (5 recoverable, 1 confirmed sold in sample)
**Status:** Resolved

## Summary

Listings were incorrectly marked as `presumed_sold` due to transient HTTP 404 responses from dealer websites. The scraper treated any 404 as definitive proof the page no longer exists, without retry logic to handle temporary server/CDN failures.

## Timeline

| Time | Event |
|------|-------|
| 2026-01-17 11:50:22 | Kusanagi 75.html scraped, received transient 404, marked `presumed_sold` |
| 2026-02-02 | User reported listing missing despite being available on dealer site |
| 2026-02-02 | Investigation revealed 62 affected listings across all dealers |
| 2026-02-02 | Fix implemented and deployed, 5 of 6 sampled listings recovered |

## Root Cause Analysis

### The Specific Failure (Kusanagi 75.html, Listing ID 9513)

1. URL discovered 2025-12-31 via catalog crawler
2. Scraped 2026-01-17 at 11:50:22 during batch scrape
3. HTTP request returned 404 (transient server/CDN issue)
4. Scraper immediately marked `page_exists=false`, `status=presumed_sold`
5. No data captured - `raw_page_text` empty, `llm_model` null
6. Page actually exists and is for sale at ¥2,800,000

### Code Path (kusanagi.py lines 108-112, before fix)

```python
if response.status_code == 404:
    listing.page_exists = False
    listing.is_available = False
    listing.success = True  # Marked as success, not failure!
    return listing  # Returns immediately, no data extraction
```

### Why 404 Wasn't Retried

The HTTP client retry strategy (http_client.py line 53):
```python
status_forcelist=[429, 500, 502, 503, 504]  # 404 NOT included!
```

A 404 was treated as definitive "page doesn't exist" - no retry attempted.

### Evidence

| Clue | Value | Implication |
|------|-------|-------------|
| `page_exists` | false | HTTP 404 was received |
| `raw_page_text` | empty (len=0) | No content was ever fetched |
| `llm_model` | null | LLM extraction never ran |
| `http_status` | NOT STORED | Critical gap - no HTTP code logged |
| Same-second scrapes | 5/6 succeeded | Isolated transient failure |

### Same-Second Analysis (11:50:22)

```
11:50:22 - 104.html: reserved ✓
11:50:22 - 238.html: reserved ✓
11:50:22 - 414.html: reserved ✓
11:50:22 - 75.html: presumed_sold ✗  ← ONLY THIS ONE FAILED
11:50:22 - 432.html: reserved ✓
11:50:22 - 421.html: reserved ✓
```

Only 1 of 6 URLs scraped at the same second failed, ruling out systematic issues.

## Resolution

### Fixes Implemented

1. **404 Retry Logic** (`scrapers/kusanagi.py`, `scrapers/base.py`)
   - Wait 2 seconds and retry once before accepting 404 as genuine
   - Handles transient CDN/server issues

   ```python
   if response.status_code == 404:
       logger.info(f"Got 404 for {url}, retrying after 2s...")
       time.sleep(2)
       response = self.http_client.get(url)

       if response.status_code == 404:
           # Confirmed 404 after retry
           listing.page_exists = False
           ...
       elif response.status_code == 200:
           # Page exists! Continue with normal extraction
           ...
   ```

2. **HTTP Status Storage** (`db/repository.py`)
   - Now stores `http_status` in `raw_fields` for debugging
   ```python
   if hasattr(listing, 'http_status') and listing.http_status is not None:
       raw_fields['http_status'] = listing.http_status
   ```

3. **Recovery Script** (`scripts/recover_failed_scrapes.py`)
   - Identifies listings with `page_exists=false` and `status=presumed_sold`
   - Verifies URL accessibility in parallel
   - Marks recoverable URLs for rescrape
   - Supports `--dry-run`, `--dealer`, `--rescrape`, `--workers` flags

### Recovery Results

| URL | Dealer | Result |
|-----|--------|--------|
| kusanaginosya.com/SHOP/75.html | Kusanagi | ✅ Recovered (¥2,800,000) |
| aoijapan.com/kozuka-mumeiunsigned-8 | Aoi Art | ✅ Recovered (¥75,000) |
| samurai-nippon.net/SHOP/V-2139.html | Samurai Nippon | ❌ Confirmed Sold |
| world-seiyudo.com/product/ka-010725 | World Seiyudo | ✅ Recovered (Juyo Token) |
| choshuya.co.jp/.../七宝文家紋散透図鐔 | Choshuya | ✅ Recovered |
| choshuya.co.jp/.../スルメ図目貫 | Choshuya | ✅ Recovered |

**5 of 6 sampled false 404s recovered** (1 confirmed actually sold)

## Commits

| Repo | Commit | Description |
|------|--------|-------------|
| Oshi-scrapper | `0395ecb` | fix: Add 404 retry logic to prevent false sold detection |
| nihontowatch | `63344ea` | docs: Add investigation plan for false 404 detection issue |

## Lessons Learned

1. **Never trust a single 404** - Transient failures are common with CDNs and high-traffic sites
2. **Store HTTP status codes** - Critical for debugging scrape failures
3. **Parallel scraping masks issues** - One failure in a batch can go unnoticed
4. **Recovery mechanisms matter** - Having `needs_rescrape` infrastructure enabled quick recovery

## Prevention

- 404s now retried once after 2-second delay
- HTTP status stored in `raw_fields.http_status` for debugging
- Recovery script available for future false 404 detection
- Consider adding periodic verification of `presumed_sold` listings

## Related Documents

- [PLAN_RESCRAPE_FAILED_LISTINGS.md](./PLAN_RESCRAPE_FAILED_LISTINGS.md) - Original investigation plan
- [DEALERS.md](./DEALERS.md) - Dealer-specific quirks and notes
