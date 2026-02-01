# Plan: Fix Missing Data and Prevent Scrape Failures

> **STATUS: IMPLEMENTED** (2026-02-02)
>
> See [POSTMORTEM_FALSE_404_DETECTION.md](./POSTMORTEM_FALSE_404_DETECTION.md) for resolution details.
>
> **Commits:**
> - Oshi-scrapper `0395ecb`: 404 retry logic, http_status storage, recovery script
> - nihontowatch `63344ea`: Documentation

## Investigation Summary

### Root Cause Analysis (Deep Dive)

**The specific issue with `kusanaginosya.com/SHOP/75.html` (listing ID 9513):**

#### What Happened
1. **URL was discovered** on 2025-12-31 via the catalog crawler
2. **URL was scraped** on 2026-01-17 at 11:50:22 during a batch scrape
3. **HTTP request returned 404** (only way `page_exists=false` can be set in code)
4. **Listing was marked** `page_exists: false` and `status: presumed_sold`
5. **NO data was captured** - `raw_page_text` is empty, `llm_model` is null
6. **QA still ran** because scraper sets `success=True` for 404s (line 111 in kusanagi.py)
7. **Page actually exists** - verified via curl (HTTP 200, 62KB content, ¥2,800,000)

#### Critical Code Path (kusanagi.py lines 108-112)
```python
if response.status_code == 404:
    listing.page_exists = False
    listing.is_available = False
    listing.success = True  # ← Marked as success, not failure!
    return listing  # ← Returns immediately, no data extraction
```

#### Evidence Analysis
| Clue | Value | Implication |
|------|-------|-------------|
| `page_exists` | false | HTTP 404 was received |
| `raw_page_text` | empty (len=0) | No content was ever fetched |
| `llm_model` | null | LLM extraction never ran |
| `qa_result.validation_score` | 100 | Nothing to validate (empty listing) |
| `qa_result.completeness_score` | 33.33 | Missing title, price, specs |
| `http_status` | NOT STORED | **Critical gap - no HTTP code logged** |

#### Same-Second Scrapes (11:50:22)
```
11:50:22 - 104.html: reserved ✓
11:50:22 - 238.html: reserved ✓
11:50:22 - 414.html: reserved ✓
11:50:22 - 75.html: presumed_sold ✗  ← ONLY THIS ONE FAILED
11:50:22 - 432.html: reserved ✓
11:50:22 - 421.html: reserved ✓
```

#### Why Did The Server Return 404?
We can't know definitively because `http_status` isn't stored, but possible causes:
1. **Transient CDN glitch** - Edge cache returned stale 404
2. **Server-side race condition** - Page briefly unavailable during database update
3. **Load balancer issue** - Request routed to node without page cached
4. **Anti-scraping** - WAF briefly blocked this specific request

#### Key Finding: 404 Not Retried
The HTTP client retry strategy (http_client.py line 53):
```python
status_forcelist=[429, 500, 502, 503, 504]  # Note: 404 NOT included!
```
A 404 is treated as a definitive "page doesn't exist" - no retry attempted.

### Scope of the Problem

**Total affected listings across all dealers: 62**

| Dealer ID | Count | Example URLs |
|-----------|-------|--------------|
| 1 (Nihonto.com) | 33 | Various URL-encoded paths |
| 30 (Token-Net) | 7 | p2118.html, M286_S2175_PUP2.html |
| 25 (Tokka Biz) | 5 | index_ja_tachi&katanaA040820.html |
| 3 (E-sword) | 3 | V-2139.html, T-1199.html |
| 15 (Shoubudou) | 3 | sakyounosinmunemitu1, udakunimune |
| 5 (Kusanagi) | 1 | 75.html (¥2,800,000 Kamakura tachi) |
| Others | 10 | Various |

**Kusanagi Specifically:**
- 380 total listings in database
- Only 1 has `page_exists=false` (75.html)
- Only 1 has empty `raw_page_text` (75.html)
- All other 379 listings scraped successfully

**Common failure patterns:**
1. **Transient 404s** - Server briefly returned 404 (not retried because 404 isn't in retry list)
2. **Parallel scraping load** - 10 workers hitting same domain simultaneously
3. **No cross-worker rate limiting** - Each thread has its own rate limiter
4. **Encoding issues** - URL-encoded Japanese characters in paths

### Existing Infrastructure

The Oshi-scrapper already has a `needs_rescrape` mechanism in `discovered_urls` table:
- `needs_rescrape: boolean` - Flag to mark URLs for re-processing
- `rescrape_reason: string` - Why rescrape is needed
- `rescrape_priority: int` - Higher = more urgent
- `mark_for_rescrape()` method in `DiscoveryRepository`
- `get_needs_rescrape()` to fetch URLs that need re-scraping

---

## Implementation Plan

### Phase 1: Immediate Data Recovery (Day 1)

**Goal:** Re-scrape the 62 affected listings to recover missing data

#### Step 1.1: Create recovery script
Create `/scripts/recover_failed_scrapes.py` that:
1. Queries all listings with `page_exists = false` AND `status = 'presumed_sold'`
2. Also includes listings with `title IS NULL` but `status = 'presumed_sold'`
3. For each URL:
   - Re-fetch the page with HTTP GET
   - If HTTP 200: Mark for rescrape and reset status
   - If HTTP 404: Confirm as legitimately sold (keep presumed_sold)
4. Use the existing `mark_for_rescrape()` mechanism with reason `"failed_scrape_recovery"`

#### Step 1.2: Run recovery scrape
```bash
# Mark failed listings for rescrape
python scripts/recover_failed_scrapes.py --verify-accessibility

# Run targeted rescrape for marked URLs
python main.py scrape --needs-rescrape --reason "failed_scrape_recovery" --llm gemini-flash
```

#### Step 1.3: Verify data quality
After rescrape, verify:
- Title extracted for all recovered listings
- Price extracted where available
- Status correctly reflects availability

### Phase 2: Prevent Future Failures (Day 2-3)

**Goal:** Make the scraper resilient to transient 404s

#### Step 2.1: Add 404 retry with verification
In `utils/http_client.py`:
```python
# BEFORE (line 53):
status_forcelist=[429, 500, 502, 503, 504]

# AFTER - Add 404 but with limited retries:
status_forcelist=[404, 429, 500, 502, 503, 504]
```

OR better - in each scraper's 404 handling:
```python
if response.status_code == 404:
    # Retry once after 2 seconds before accepting 404
    if not getattr(self, '_404_retried', False):
        self._404_retried = True
        time.sleep(2)
        response = self.http_client.get(url)  # Retry
        if response.status_code == 200:
            # Page exists! Continue with extraction
            self._404_retried = False
            # ... normal extraction flow
    listing.page_exists = False
    ...
```

#### Step 2.2: Store HTTP status for debugging
In `db/repository.py`, add to `_listing_to_db_row()`:
```python
# Track the HTTP status code for debugging failed scrapes
if hasattr(listing, 'http_status') and listing.http_status:
    if not row.get('raw_fields'):
        row['raw_fields'] = {}
    row['raw_fields']['http_status'] = listing.http_status
```

#### Step 2.3: Cross-worker rate limiting
In `main.py` parallel scraping, use a SHARED rate limiter:
```python
# Instead of each thread creating its own client:
# listing, consensus = scrape_url_with_consensus(url, None, ...)

# Use a shared client with proper locking:
shared_client = HttpClient()  # Created once
listing, consensus = scrape_url_with_consensus(url, shared_client, ...)
```

#### Step 2.4: Post-scrape verification for 404s
In the save flow, verify before marking presumed_sold:
```python
def save_one(listing: ScrapedListing):
    if listing.page_exists == False and listing.scrape_count <= 1:
        # First scrape got 404 - verify before saving
        response = requests.head(listing.url, timeout=10)
        if response.status_code == 200:
            # Page actually exists! Mark for rescrape instead
            discovery_repo.mark_for_rescrape(listing.url, "false_404_detected")
            return  # Don't save as presumed_sold
    # ... continue with normal save
```

### Phase 3: Monitoring & Alerting (Day 4)

**Goal:** Get visibility into scrape failures

#### Step 3.1: Add scrape failure metrics
Track in scrape runs:
- `http_404_count` - URLs that returned 404
- `http_error_count` - Other HTTP errors (500, 503, timeout)
- `extraction_failure_count` - Pages fetched but data extraction failed

#### Step 3.2: Add admin dashboard metrics
In nihontowatch `/admin` dashboard, add:
- "Recent Scrape Failures" section
- Shows listings with `page_exists = false` from last 7 days
- "Verify" button to check if URL is actually accessible

#### Step 3.3: Weekly data quality check
Automated job that:
1. Samples 10% of `presumed_sold` listings from last 30 days
2. Verifies their URLs are actually 404
3. Reports false positives for manual review

---

## Database Changes Required

### New columns in `listings` table:
```sql
ALTER TABLE listings ADD COLUMN consecutive_404_count INTEGER DEFAULT 0;
ALTER TABLE listings ADD COLUMN last_404_at TIMESTAMPTZ;
```

### New index for failed scrape detection:
```sql
CREATE INDEX idx_listings_failed_scrapes
ON listings(status, page_exists, scrape_count)
WHERE status = 'presumed_sold' AND page_exists = false;
```

---

## Rollback Plan

If the recovery scrape causes issues:
1. All changes are additive (we're re-scraping, not deleting)
2. Original data preserved in `first_seen_at` timestamp
3. Can revert by filtering on `last_scraped_at` after recovery date

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Affected listings recovered | 62 → 0 false presumed_sold |
| False positive rate | < 1% (verified against URL accessibility) |
| Scrape reliability | 99.5% success rate per batch |
| Time to detect failures | < 24 hours |

---

## File Changes Summary

| File | Change | Priority |
|------|--------|----------|
| `scripts/recover_failed_scrapes.py` | NEW - Verify accessibility and mark for rescrape | P0 |
| `utils/http_client.py` | Add 404 to retry list OR add retry logic | P1 |
| `db/repository.py` | Store `http_status` in `raw_fields` for debugging | P1 |
| `scrapers/kusanagi.py` | Add 404 verification before accepting | P1 |
| `main.py` | Use shared HTTP client across workers | P2 |
| `scripts/daily_scrape.py` | Add post-scrape 404 verification | P2 |

## Immediate Action (Can Do Now)

```bash
# 1. Mark 75.html for rescrape
python -c "
from db.repository import DiscoveryRepository
repo = DiscoveryRepository()
repo.mark_for_rescrape('https://www.kusanaginosya.com/SHOP/75.html', 'false_404_recovery', priority=3)
print('Marked for rescrape')
"

# 2. Run targeted rescrape
python main.py scrape --url "https://www.kusanaginosya.com/SHOP/75.html" --db --llm gemini-flash
```

---

## Questions for User

1. **Priority of affected dealers:** Should we prioritize certain dealers for recovery? (e.g., Kusanagi has active inventory, Nihonto.com has many affected URLs)

2. **Retry policy:** How aggressive should retries be? (Currently proposing 2 retries with backoff)

3. **Verification approach:** Should we verify ALL presumed_sold listings periodically, or only recent ones?
