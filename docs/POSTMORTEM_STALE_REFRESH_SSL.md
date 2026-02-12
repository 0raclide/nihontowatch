# Postmortem: Stale Refresh Outage (Feb 9-11, 2026)

## Summary

The stale refresh pipeline failed **8 of 10 runs** over 48+ hours (Feb 9-11, 2026). Root cause: Nipponto's broken SSL certificate chain. Impact: stale prices, sold items showing as available, missed status changes across all dealers.

## Timeline

| When | What |
|------|------|
| ~Feb 9 | Nipponto's SSL cert chain breaks (missing intermediate CA) |
| Feb 9-11 | 8 of 10 stale refresh GitHub Actions runs fail |
| Feb 11 20:45 | SSL fix deployed (`verify=False` in NippontoScraper) |
| Feb 11 20:46 | First successful run: 5/5 items refreshed |
| Feb 11 21:13 | 50-item run: 50/50, 0 errors |
| Feb 11 21:37 | 200-item run: 191/200, 2.6% error rate, circuit breaker caught Choshuya |
| Feb 11 21:57 | Pipeline declared healthy |

## Root Cause

**Nipponto (`nipponto.co.jp`) has a broken SSL certificate chain** — missing intermediate CA certificate. macOS and browsers handle this gracefully (they fetch the intermediate cert), but Ubuntu runners in GitHub Actions do strict validation and reject the connection.

**Why it wasn't caught earlier**: The Nipponto *discovery crawler* already had `verify=False` (added when the crawler was first written). The Nipponto *scraper* (used for refresh) did NOT — this gap was simply missed.

**Why one dealer tanked the whole job**: Nipponto has ~170 items in the stale queue. All 170 failed SSL validation. With 500 total items per Tier 3 run, that's 170/500 = 34% error rate, exceeding the 25% job failure threshold.

## Fix (commit `fd871b4`)

### 1. Nipponto SSL Fix
```python
# scrapers/nipponto.py:108
response = self.http_client.get(url, verify=False)
```

Surgical fix — only disables cert verification for Nipponto URLs through `NippontoScraper`. Other dealers unaffected.

### 2. Per-Dealer Circuit Breaker
Added to `scripts/refresh_stale.py`. Tracks errors per dealer domain. After 5 attempts with >=80% failure rate, skips remaining items from that dealer.

**Key properties:**
- Circuit-broken items are **skipped**, not counted as errors
- Each dealer has an independent breaker (one broken dealer doesn't block others)
- Logs which dealers were circuit-broken and how many items were skipped
- Resets per tier (not sticky across tiers)

**Constants:**
```python
CIRCUIT_BREAKER_MIN_ATTEMPTS = 5   # Need this many before tripping
CIRCUIT_BREAKER_ERROR_RATE = 0.8   # 80% failure rate triggers break
```

**Example log output:**
```
Tier complete: 191 refreshed, 0 price changes, 1 sold, 5 errors | Circuit-broken: choshuya.co.jp (5/5 failed, 4 skipped)
Completed with 5 errors (2.6% error rate)
```

### 3. Golden Tests
13 tests in `tests/scripts/test_circuit_breaker.py`:

| Test | What it guards |
|------|---------------|
| `test_breaker_trips_after_5_failures_skips_remaining` | Breaker trips at exactly 5 failures, skips rest |
| `test_breaker_does_not_trip_below_threshold` | 30% error rate does NOT trip |
| `test_broken_dealer_does_not_block_healthy_dealers` | Nipponto breaks, Aoi continues |
| `test_two_broken_dealers_independently_circuit_broken` | Each dealer gets own breaker |
| `test_circuit_broken_items_excluded_from_error_count` | 170 nipponto + 330 healthy = 1.5% (not 34%) |
| `test_exception_in_scraper_counts_as_error` | Python exceptions count toward breaker |
| `test_empty_listing_queue` | No listings = no crash |
| `test_single_dealer_all_succeed` | Happy path, no breaker |
| `test_www_stripping_groups_same_dealer` | `www.` stripped for domain grouping |
| `test_price_change_still_detected_for_healthy_dealers` | Normal functionality preserved |
| `test_*_constants` | Sanity bounds on thresholds |

## Production Verification

| Run | Items | Refreshed | Errors | Rate | Circuit-broken |
|-----|-------|-----------|--------|------|----------------|
| 1 (5 items) | 5 | 5 | 0 | 0% | None |
| 2 (50 items) | 50 | 50 | 0 | 0% | None |
| 3 (200 items) | 200 | 191 | 5 | 2.6% | choshuya.co.jp (5/5, 4 skipped) |

## Lessons Learned

1. **SSL fixes must be applied to BOTH discovery AND scraper paths.** The discovery crawler had `verify=False` but the scraper didn't. Checklist: when fixing a dealer-specific issue, check all code paths that touch that dealer's URLs.

2. **One broken dealer should never fail the whole pipeline.** The 25% error rate threshold is a global safety net, but it's too coarse — it doesn't distinguish between "widespread problems" and "one dealer is down." Per-dealer circuit breakers solve this.

3. **Monitor per-dealer error rates, not just global.** The global error rate hid the fact that Nipponto was 100% failing while other dealers were fine.

4. **GitHub Actions Ubuntu runners have stricter SSL than macOS.** Always test SSL-sensitive code in CI, not just locally.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `scrapers/nipponto.py` | Oshi-scrapper | `verify=False` on `http_client.get()` |
| `scripts/refresh_stale.py` | Oshi-scrapper | Per-dealer circuit breaker logic |
| `tests/scripts/test_circuit_breaker.py` | Oshi-scrapper | 13 golden tests |
