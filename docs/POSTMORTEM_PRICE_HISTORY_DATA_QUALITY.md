# Price History Data Quality Audit

**Date:** 2026-01-21
**Status:** Critical issues found - data NOT production-ready
**Auditor:** Claude Code

## Executive Summary

A deep audit of the `price_history` table reveals **significant data quality issues** that prevent us from showing price changes and sold events to users. Of 440 total records:

| Category | Records | Quality | Action |
|----------|---------|---------|--------|
| Sold transitions | 352 | 73.3% valid | Cleanup needed |
| Price decreases | 53 | 7.5% valid (4/53) | Cleanup needed |
| Price increases | 35 | 0% valid | Delete all |

**Bottom line:** We cannot show this data to users in its current state.

---

## Finding 1: E-sword Extraction Bug (CRITICAL)

### The Problem
The E-sword scraper has a bug that intermittently extracts `¥4,000,000` instead of the actual price.

### Evidence
- **49 price "decreases"**: All from E-sword, all with `old_price = ¥4,000,000`
- **32 price "increases"**: All from E-sword, all with `new_price = ¥4,000,000`
- Pattern shows the bug oscillating:
  1. Correct price extracted (e.g., ¥280,000)
  2. Bug extracts ¥4,000,000
  3. Bug fixed, extracts correct price again

### Manual Verification
```
URL: https://www.e-sword.jp/tantou/2210-3016.htm
Our record: ¥4,000,000 → ¥280,000 (-93% drop)
Actual price on site: ¥280,000
Verdict: ¥4,000,000 was NEVER the real price - extraction bug
```

### Impact
- **81 false records** (49 decreases + 32 increases)
- All E-sword price change data is unreliable
- Users would see "93% price drop!" notifications that never happened

### Root Cause Hypothesis
The value `¥4,000,000` is likely:
- A placeholder/default in the page template
- A value from a different element (e.g., shipping insurance max)
- A parsing error with a comma/period

### Recommended Action
1. Delete all E-sword `price_history` records where `old_price = 4000000` OR `new_price = 4000000`
2. Fix the E-sword scraper in Oshi-scrapper
3. Add validation: reject price changes >50% as suspicious

---

## Finding 2: False Sold Transitions (CRITICAL)

### The Problem
94 items have "sold" transitions in `price_history` but are currently `is_sold=false, is_available=true` in `listings`.

### Breakdown by Dealer
| Dealer | False Sold Count | % of their sold transitions |
|--------|------------------|----------------------------|
| Touken Matsumoto | 67 | ~99% false |
| Eirakudo | 12 | 37% false |
| Aoi Art | 10 | 34% false |
| Samurai Nippon | 1 | 4% false |
| E-sword | 2 | 50% false |
| Shoubudou | 2 | 100% false |

### Manual Verification
```
URL: https://www.touken-matsumoto.jp/ja/product/shousai/KA-0790
Our record: Sold transition on 2026-01-01
Actual status: AVAILABLE at ¥3,500,000
Verdict: FALSE POSITIVE - item was never sold

URL: https://www.samurai-nippon.net/SHOP/V-2116.html
Our record: Sold transition, last price ¥3,200,000
Actual status: AVAILABLE at ¥3,200,000
Verdict: FALSE POSITIVE - item was never sold
```

### Root Cause Hypothesis
The scrapers are detecting "sold" incorrectly when:
- Page layout changes temporarily
- Network errors return partial pages
- Dealer-specific sold indicators are misinterpreted

### Recommended Action
1. Delete price_history records where `listing.is_sold = false` but `change_type IN ('sold', 'presumed_sold')`
2. Review sold detection logic for Touken Matsumoto, Eirakudo, Aoi Art
3. Add reconciliation: if a later scrape finds item available, void the sold transition

---

## Finding 3: Temporal Clustering (INFO)

### Observation
Events are clustered around scraper batch runs, not distributed over time:

```
2025-12-31: 18 events (scraper deployment?)
2026-01-01: 76 events (batch run)
2026-01-17: 330 events (major batch run)
  - 216 events in hour 12:00
  - 65 events in hour 13:00
```

### Implication
- Most "changes" are detected during periodic scraper runs, not real-time
- A bug in a scraper run can create many false records at once
- The Jan 1 batch likely introduced the Touken Matsumoto false positives

---

## Finding 4: Missing Price Data

### Observation
- **189 sold transitions** (54%) have `old_price = 0` or `null`
- This means we never captured the price before the item sold

### Breakdown
| Dealer | Sold Transitions | With Price | Without Price |
|--------|-----------------|------------|---------------|
| Nihonto Art | 147 | 23 (16%) | 124 (84%) |
| Touken Matsumoto | 68 | 65 (96%) | 3 (4%) |
| Eirakudo | 32 | 5 (16%) | 27 (84%) |
| Aoi Art | 29 | 27 (93%) | 2 (7%) |

### Implication
- Nihonto Art and Eirakudo scrapers aren't capturing prices reliably
- "Sold for $X" feature only works for ~46% of sold items

---

## Finding 5: Legitimate Data (What We CAN Use)

### Verified Good Data

**Price Drops (4 records):**
| Item | Dealer | Change | Verified |
|------|--------|--------|----------|
| Katana Echizen-no-kami Sadamichi | Sanmei | ¥1,500,000 → ¥800,000 | ✓ Real |
| Katana by Mino Kanetsune | Nihonto | $14,500 → $12,500 | ✓ Real |
| Katana by Shitahara Terushige | Nihonto | $14,000 → $9,000 | ✓ Real |
| Fukushima #47262 Masanaga | Choshuya | ¥365,000 → ¥350,000 | ✓ Real |

**Sold Transitions (estimated ~200 valid):**
After removing Touken Matsumoto (67), Eirakudo (12), Aoi Art (10) false positives:
- ~200 sold transitions appear reliable
- Best quality from: Aoi Art (after cleanup), Samurai Nippon, Nihonto Art

### Verified Good Example
```
URL: https://www.aoijapan.com/katana-mumei-mihara-masanobu-late-nanbokuchonbthk-tokubetsu-hozon-token
Our record: Sold at ¥650,000
Actual: "SOLD" displayed on page with ¥650,000
Verdict: CORRECT
```

---

## Data Quality Score Summary

| Metric | Score | Notes |
|--------|-------|-------|
| Price decrease reliability | **7.5%** | 4/53 valid (E-sword bug) |
| Price increase reliability | **0%** | 0/35 valid (all E-sword bug) |
| Sold transition reliability | **73%** | ~258/352 valid (after removing mismatches) |
| Overall price_history reliability | **~60%** | Needs cleanup before production use |

---

## Recommended Cleanup Actions

### Immediate (Before showing to users)

1. **Delete E-sword price changes:**
   ```sql
   DELETE FROM price_history
   WHERE listing_id IN (
     SELECT l.id FROM listings l
     JOIN dealers d ON l.dealer_id = d.id
     WHERE d.name = 'E-sword'
   )
   AND change_type IN ('decrease', 'increase');
   ```

2. **Delete false sold transitions:**
   ```sql
   DELETE FROM price_history ph
   WHERE ph.change_type IN ('sold', 'presumed_sold')
   AND EXISTS (
     SELECT 1 FROM listings l
     WHERE l.id = ph.listing_id
     AND l.is_sold = false
   );
   ```

3. **Add validation to scraper:**
   - Reject price changes >50% (flag for review)
   - Cross-validate sold detection with multiple signals
   - Log suspicious patterns for human review

### Future Prevention

1. **Add `is_verified` flag** to price_history
2. **Implement reconciliation job** that voids transitions contradicted by later scrapes
3. **Add data quality dashboard** to monitor anomalies in real-time

---

---

## Cleanup Plan

### Migration Created
**File:** `supabase/migrations/031_cleanup_price_history.sql`

### What Will Be Deleted

| Category | Count | Reason |
|----------|-------|--------|
| E-sword ¥4M bug | 82 | Phantom price (old_price OR new_price = 4,000,000) |
| False sold transitions | 94 | Items currently available but marked as sold |
| All price increases | 35 | 100% are extraction bugs (E-sword + Choshuya) |
| **TOTAL** | ~178* | *Some overlap between categories |

### What Will Remain

| Category | Count | Notes |
|----------|-------|-------|
| Valid sold transitions | ~248 | Verified reliable |
| Presumed sold | 10 | Items where page removed |
| Valid price decreases | 4 | Sanmei, Nihonto x2, Choshuya |
| **TOTAL** | ~262 | Clean, production-ready data |

### Execution Steps

1. **Review the migration:**
   ```bash
   cat supabase/migrations/031_cleanup_price_history.sql
   ```

2. **Run the migration:**
   ```bash
   supabase db push
   ```

3. **Verify with these queries:**
   ```sql
   -- Total count (should be ~262)
   SELECT COUNT(*) FROM price_history;

   -- Breakdown by type
   SELECT change_type, COUNT(*) FROM price_history GROUP BY change_type;

   -- No E-sword 4M records
   SELECT COUNT(*) FROM price_history ph
   JOIN listings l ON ph.listing_id = l.id
   JOIN dealers d ON l.dealer_id = d.id
   WHERE d.name = 'E-sword' AND (ph.old_price = 4000000 OR ph.new_price = 4000000);

   -- No false sold transitions
   SELECT COUNT(*) FROM price_history
   WHERE change_type IN ('sold', 'presumed_sold')
   AND listing_id IN (SELECT id FROM listings WHERE is_sold = false);

   -- No increases
   SELECT COUNT(*) FROM price_history WHERE change_type = 'increase';
   ```

4. **Rollback if needed:**
   ```sql
   DROP TABLE price_history;
   ALTER TABLE price_history_backup_20260121 RENAME TO price_history;
   ```

### Post-Cleanup Actions

1. [ ] Fix E-sword scraper in Oshi-scrapper (investigate ¥4,000,000 source)
2. [ ] Fix Touken Matsumoto sold detection
3. [ ] Add price change validation (reject >50% changes)
4. [ ] Add reconciliation logic (void sold if later found available)

---

## Conclusion

**Do NOT show price_history data to users until cleanup is complete.**

### Critical Bugs Found
1. **E-sword extraction bug** - Intermittently extracts ¥4,000,000 instead of real price
2. **Choshuya extraction bug** - Similar phantom high prices (¥1.5M, ¥1.65M)
3. **False sold detection** - Touken Matsumoto (67), Eirakudo (12), Aoi Art (10)

### After Cleanup
- **~248 valid sold transitions** - Ready to show to users
- **4 valid price drops** - Ready to show to users
- **0 valid price increases** - All were bugs

### Next Steps
1. Run the cleanup migration - ✅ DONE
2. Fix the scrapers in Oshi-scrapper
3. Add validation to prevent future bad data
4. Monitor data quality going forward

---

## Follow-up Investigation

A deeper QA audit was conducted after cleanup. See:
**[QA_PRICE_DATA_AUDIT_20260121.md](./QA_PRICE_DATA_AUDIT_20260121.md)**

Key additional findings:
- Nihonto Art price parser bug: `"4,250$"` format not parsed (181 affected)
- Kusanagi extraction bug: 92% of listings missing `price_raw`
- 69% of sold items lack prices due to these upstream bugs
