# Postmortem: Stale Refresh Throughput Crisis

**Date:** 2026-02-11
**Severity:** High — 65% false positive rate for World Seiyudo "available" listings
**Scope:** Systemic (all 44 dealers), acute for World Seiyudo
**Commit:** `d1aa7b8` (Oshi-scrapper)
**Status:** Resolved, requires ongoing monitoring

---

## Summary

65% of World Seiyudo items displayed as "available" on nihontowatch.com were actually out of stock on the dealer's site. The root cause was a systemic throughput failure in the Tier 3 stale refresh system: the queue had 5,179 items but could only process 100 per run, meaning items re-entered the queue 10x faster than they could be processed. The queue could never drain.

**Impact:** 427 World Seiyudo listings were incorrectly shown as available. Users clicking through to the dealer site would find items marked `在庫切れ` (out of stock). This erodes trust in nihontowatch as a reliable aggregator.

---

## Timeline

| Date | Event |
|------|-------|
| 2026-01-18–21 | World Seiyudo bulk-scraped (~894 items). All items scraped once. |
| 2026-01-26 | Stale refresh system goes live (first run) |
| 2026-01-26–02-11 | 66 refresh runs execute. Tier 1/2 items refreshed regularly. Tier 3 queue never drains. |
| 2026-02-11 | Listing 32077 (`ka-020616`, Rai Kunitsugu katana) spotted showing `在庫切れ` on dealer site but "available" on nihontowatch |
| 2026-02-11 | Investigation reveals 65% false positive rate (13/20 spot-checked items are OOS) |
| 2026-02-11 | 5 fixes implemented, committed, and deployed |
| 2026-02-11 | Backlog clearing: 816 items re-scraped, 427 correctly marked as sold, 0 errors |

---

## Root Cause Analysis

### PRIMARY: Tier 3 Throughput Failure

The math was simple and fatal:

```
Queue size:           5,179 items (all available listings >48h since last scrape)
Processing rate:      100 items per run x 4 runs/day = 400 items/day
Error rate:           ~35% (71 errors per 200-item run)
Effective throughput: ~260 successful Tier 3 refreshes/day
Full cycle time:      5,179 / 260 = ~20 days
Re-entry after:       48 hours (items become eligible again)
```

Items re-entered the queue 10x faster than they could be processed. The queue never drained. Items at the tail (like World Seiyudo) waited weeks or forever.

**Why Tier 1/2 worked fine:**

| Tier | Queue Size | Limit/Run | Cycle Time |
|------|-----------|-----------|------------|
| Tier 1 (Juyo) | 140 | 50 | ~18 hours |
| Tier 2 (>2M yen) | 71 | 50 | ~12 hours |
| **Tier 3 (all)** | **5,179** | **100** | **~20 days** |

### SECONDARY: Discovery Crawler Didn't Propagate OOS Status

The World Seiyudo discovery crawler (`scrapers/discovery/world_seiyudo.py`) detected `outofstock` CSS class on catalog pages but never set `is_sold=True` on `DiscoveredListing`. This meant the discovery-to-sold pipeline in `main.py` was completely bypassed for this dealer.

The complication: World Seiyudo uses WooCommerce's `outofstock` class for **both** genuinely OOS items **and** inquiry-based pricing items (no displayed price). On catalog pages alone, these are indistinguishable. ~597 of 894 "available" items had no price (inquiry-based). Blindly marking all `outofstock` as sold would incorrectly mark hundreds of items.

### TERTIARY: Missing `在庫切れ` Text Pattern

`在庫切れ` (zaiko-kire, "out of stock") — the standard WooCommerce Japanese OOS text — was absent from both the World Seiyudo scraper's `_check_sold()` patterns and the global `SOLD_PATTERNS` in `price_parser.py`. The CSS class check would catch most cases, but the text pattern adds defense in depth.

---

## Fixes Applied

### Fix 1: Increase Tier 3 Throughput (PRIMARY)

**File:** `Oshi-scrapper/scripts/refresh_stale.py` line 78

Changed Tier 3 limit from 100 to 500.

```
New rate: 500/run x 4 runs/day = 2,000 items/day
Queue:    5,179 items
Cycle:    ~2.6 days (vs ~20 days before)
```

At 2s delay + ~3s scrape per item, 500 items = ~42 minutes. Well within the 60-minute GitHub Actions timeout.

### Fix 2: Add `在庫切れ` to Sold Patterns (DEFENSIVE)

**Files:**
- `Oshi-scrapper/scrapers/world_seiyudo.py` line 132 — `_check_sold()` local patterns
- `Oshi-scrapper/utils/price_parser.py` line 42 — global `SOLD_PATTERNS`

### Fix 3: Discovery-Driven OOS Detection with Price Discrimination

**File:** `Oshi-scrapper/scrapers/discovery/world_seiyudo.py` lines 140–154

Added price-based discrimination for genuine OOS vs inquiry-based pricing:

```python
# Items with a visible price (yen amount) + outofstock = genuinely sold
# Items without price + outofstock = inquiry-based (NOT sold)
has_real_price = bool(price_text and re.search(r'[¥￥\d]', price_text))
is_sold_from_catalog = is_out_of_stock and has_real_price
```

### Fix 4: Reusable Dealer Refresh Script

**File:** `Oshi-scrapper/scripts/refresh_dealer.py` (NEW)

General-purpose script for bulk-refreshing a specific dealer's stale items. Handles Supabase pagination (>1000 rows), price change detection, status change tracking, and progress logging.

```bash
python scripts/refresh_dealer.py --dealer "World Seiyudo" --max 500 --stale-days 14
python scripts/refresh_dealer.py --dealer "Aoi Art" --dry-run
```

### Fix 5: Unit Tests

**File:** `Oshi-scrapper/tests/scrapers/test_world_seiyudo.py`

4 new tests:
1. `test_detects_zaiko_kire_sold_status` — HTML with `在庫切れ` text
2. `test_out_of_stock_with_price_marked_sold` — OOS + price = `is_sold=True`
3. `test_out_of_stock_without_price_not_marked_sold` — OOS + no price = `is_sold=False`
4. `test_available_item_not_marked_sold` — Available + price = `is_sold=False`

---

## Backlog Clearing Results

Two batches run manually via `refresh_dealer.py`:

| Metric | Batch 1 | Batch 2 | Total |
|--------|---------|---------|-------|
| Items processed | 500 | 316 | **816** |
| Marked as sold | 280 (56%) | 147 (47%) | **427** |
| Confirmed available | 220 | 169 | **389** |
| Errors | 0 | 0 | **0** |

Sold rate by inventory age (Batch 1):

| Items | Sold Rate | Notes |
|-------|-----------|-------|
| 1–150 (newest) | 15% | Recent inventory, mostly still available |
| 151–300 | 84% | Older inventory, heavily sold |
| 301–500 (oldest) | 66% | Oldest items, mostly OOS |

The original triggering listing (`ka-020616`, Rai Kunitsugu katana) was correctly detected as SOLD at item 275.

---

## System-Wide Staleness (Pre-Fix)

This was NOT isolated to World Seiyudo. The Tier 3 queue had 5,179 items across all dealers:

| Dealer | Tier 3 Eligible | % of Queue |
|--------|----------------|------------|
| Choshuya | 1,286 | 25% |
| **World Seiyudo** | **825** | **16%** |
| Aoi Art | 535 | 10% |
| Giheiya | 410 | 8% |
| Nihonto Australia | 364 | 7% |
| Eirakudo | 273 | 5% |
| All others (37 dealers) | 1,486 | 29% |

With the Tier 3 limit now at 500/run, the full queue should drain in ~3 days automatically.

---

## Monitoring Plan

### Week 1 (2026-02-11 to 2026-02-18)

Check that the automated refresh system is draining the queue:

```sql
-- Count stale items (should decrease daily and approach zero by day 3)
SELECT COUNT(*) FROM listings
WHERE status = 'available'
AND (last_scraped_at < NOW() - INTERVAL '48 hours' OR last_scraped_at IS NULL);

-- Per-dealer staleness
SELECT d.name, COUNT(*) as stale_count
FROM listings l JOIN dealers d ON l.dealer_id = d.id
WHERE l.status = 'available'
AND (l.last_scraped_at < NOW() - INTERVAL '7 days' OR l.last_scraped_at IS NULL)
GROUP BY d.name
ORDER BY stale_count DESC;
```

### Monthly (Ongoing)

Check that no dealer has a significant staleness buildup:

```sql
-- Alert if any dealer has >50 items stale >7 days
SELECT d.name, COUNT(*) as stale_7d
FROM listings l JOIN dealers d ON l.dealer_id = d.id
WHERE l.status = 'available'
AND l.last_scraped_at < NOW() - INTERVAL '7 days'
GROUP BY d.name
HAVING COUNT(*) > 50
ORDER BY stale_7d DESC;
```

### Key Metrics to Watch

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Tier 3 queue size | <1,000 | 1,000–3,000 | >3,000 |
| Max staleness (any item) | <4 days | 4–7 days | >7 days |
| Refresh error rate | <10% | 10–25% | >25% |
| scrape_count=1 items | <5% of available | 5–20% | >20% |

### Regression Signals

- **Queue growing faster than draining**: If new dealer additions or bulk discoveries add >2,000 items/day, Tier 3 limit may need another increase
- **Error rate spike**: Network issues or site structure changes can cause error rates to spike, reducing effective throughput. The refresh script exits with error if rate exceeds 50% (dealer) or 25% (tiered)
- **New dealer with large catalog**: Any new dealer with >500 items needs manual first-refresh via `refresh_dealer.py` rather than waiting for the queue

---

## Files Modified (All in Oshi-scrapper)

| File | Change | Risk |
|------|--------|------|
| `scripts/refresh_stale.py:78` | Tier 3 limit 100 -> 500 | Low |
| `scrapers/world_seiyudo.py:132` | Add `在庫切れ` to sold_patterns | Zero — additive |
| `utils/price_parser.py:42` | Add `在庫切れ` to SOLD_PATTERNS | Zero — additive |
| `scrapers/discovery/world_seiyudo.py:140` | Discovery OOS with price discrimination | Medium — tested |
| `scripts/refresh_dealer.py` (NEW) | Reusable dealer refresh script | Zero — standalone |
| `tests/scrapers/test_world_seiyudo.py` | 4 new tests | Zero |

---

## Lessons Learned

1. **Queue math matters.** A processing rate of 100/run sounds reasonable until you realize the queue is 52x larger. Always verify: `queue_size / (throughput_per_run * runs_per_day) < re-entry_interval`.

2. **Single-scrape items are a red flag.** 92% of World Seiyudo items had `scrape_count=1` — they were scraped once on initial discovery and never revisited. Any dealer with a high percentage of single-scrape items likely has stale data.

3. **Discovery crawlers should propagate status changes.** The catalog page already showed OOS indicators, but the discovery crawler discarded this signal. Even with the throughput fix, having the discovery crawler set `is_sold` for clearly-sold items provides faster status updates.

4. **WooCommerce OOS is ambiguous.** The `outofstock` CSS class means different things on different sites. World Seiyudo uses it for both genuine OOS and inquiry-based pricing. The price-based discrimination (has visible price + OOS = genuinely sold) is the correct heuristic.

5. **Build monitoring before you need it.** The staleness buildup was invisible for 16 days because we had no dashboard or alert for queue depth or per-dealer staleness. The monitoring queries above should be automated.

---

## Related Documents

- [DEALERS.md](./DEALERS.md) — Dealer-specific maintenance notes
- [SESSION_20260210_CHOSHUYA_FIXES.md](./SESSION_20260210_CHOSHUYA_FIXES.md) — Related: `is_initial_import` data corruption
- [POSTMORTEM_FALSE_404_DETECTION.md](./POSTMORTEM_FALSE_404_DETECTION.md) — Related: false status transitions
- [QA_PRICE_DATA_AUDIT_20260121.md](./QA_PRICE_DATA_AUDIT_20260121.md) — Related: sold transition accuracy
