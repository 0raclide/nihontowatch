# Postmortem: Kotetsu Listing Incorrectly Marked as Sold

**Date:** 2026-02-02
**Severity:** High (high-value item incorrectly hidden from users)
**Status:** Root cause identified, fix in progress

---

## Executive Summary

A 60,000,000 JPY Juyo Kotetsu (listing ID 1344) was incorrectly marked as "sold" when the dealer page showed "商談中 HOLD" (under negotiation). When the hold was later released and the item became available again, our database remained stuck on "sold" status with no automatic recovery mechanism. The item was invisible to users until manually discovered and fixed.

This is the **third** status-related incident in two months, indicating a systemic issue with our sold detection approach.

---

## Timeline

| Time | Event |
|------|-------|
| 2025-12-31 | Kotetsu first scraped, marked available at ¥60,000,000 |
| ~2026-01-25 | Dealer adds "商談中 HOLD" (someone negotiating) |
| 2026-01-26 05:00 | Scraper runs, LLM returns `is_sold: true` |
| 2026-01-26 05:00 | Regex backup confirms (商談中 in SOLD_PATTERNS) |
| 2026-01-26 05:00 | Status changed to "sold", price cleared |
| ~2026-01-28 | Negotiation falls through, dealer removes hold |
| 2026-02-02 | User reports: "Where did the Kotetsu go?" |
| 2026-02-02 | Manual investigation finds the bug |
| 2026-02-02 | Manual fix applied: status → available, price restored |

**Time item was incorrectly hidden: ~7 days**

---

## Root Cause Analysis

### Immediate Cause

The Japanese text "商談中" (shōdanchū) means "under negotiation" or "on hold" - a **temporary** state indicating someone is interested but the sale has not finalized. Our system treated it as "sold" (permanent).

**Location of bug:** `utils/price_parser.py` line 39
```python
SOLD_PATTERNS = [
    ...
    r'商談中',  # ← This pattern treats "under negotiation" as "sold"
    ...
]
```

### Why Both Detection Methods Failed

1. **LLM (Gemini Flash)**: Saw "商談中 HOLD" and interpreted it as sold
2. **Regex backup**: Found 商談中 in SOLD_PATTERNS, confirmed the LLM

Both systems failed in the same direction because they share the same flawed assumption: that "商談中" means sold.

### Deeper Issue: Aggressive Sold Detection

This is the **third** incident:

| Date | Incident | Items Affected | Root Cause |
|------|----------|----------------|------------|
| 2025-01-20 | Touken Matsumoto | 77 items | LLM hallucination |
| 2026-01-26 | Shoubudou | 243 items | Navigation text false positive |
| 2026-02-02 | Aoi Art Kotetsu | 1 item | 商談中 misclassification |

Each time we patched the specific pattern, but the fundamental problem remains: **we're too aggressive about marking items as sold based on unreliable signals.**

### The Fundamental Flaw

**Current logic:**
```
IF (LLM says sold) OR (regex finds sold pattern) THEN mark_as_sold
```

**The problem:** Both LLM and regex operate on page content, which is inherently ambiguous:
- "SOLD" could appear in navigation, descriptions, or comparisons
- "商談中" means negotiating, not sold
- "reserved" could be copyright text
- LLM can hallucinate

**The only reliable signal that an item is sold is that the page no longer exists.**

---

## Cost Asymmetry Analysis

| Error Type | Description | Frequency | Impact |
|------------|-------------|-----------|--------|
| **False Positive** | Available item marked sold | Rare but devastating | Item vanishes, collectors can't find it, dealer loses sale, we lose credibility |
| **False Negative** | Sold item still shows available | Common, harmless | User clicks through, sees it's sold on dealer site, minor inconvenience |

**Conclusion:** We should be **extremely conservative** about marking items as sold. A false positive is far worse than a false negative.

---

## The Solution: "Innocent Until Proven Gone"

### Principle

An item should only be marked as sold/unavailable when we have **high-confidence evidence**, not based on ambiguous text patterns.

### New Status Flow

```
                    ┌─────────────────────────────────────────┐
                    │           STATUS TRANSITIONS            │
                    └─────────────────────────────────────────┘

  ┌─────────┐      ┌──────────┐      ┌───────────────┐      ┌──────┐
  │AVAILABLE│ ───► │ RESERVED │ ───► │ PRESUMED_SOLD │ ───► │ SOLD │
  └─────────┘      └──────────┘      └───────────────┘      └──────┘
       ▲                │                    │                  │
       │                │                    │                  │
       └────────────────┴────────────────────┴──────────────────┘
                    (can always revert if page returns)


  Detection triggers:

  ┌─────────────────────────────────────────────────────────────────┐
  │ Page exists + has price + order form    →  AVAILABLE           │
  │ Page exists + has hold signal           →  RESERVED            │
  │ Page returns 404 / redirect to archive  →  PRESUMED_SOLD       │
  │ Manual confirmation / prolonged 404     →  SOLD                │
  │ Uncertain / no clear signal             →  KEEP CURRENT STATUS │
  └─────────────────────────────────────────────────────────────────┘
```

### Key Changes

1. **Never mark "sold" from page content alone**
   - Page content → "reserved" at most
   - Page gone (404) → "presumed_sold"
   - Manual confirmation → "sold"

2. **Separate "reserved" from "sold"**
   - Reserved: Temporary hold, item may return (商談中, HOLD)
   - Sold: Permanent, item is gone

3. **High-value protection**
   - Items >¥10M or Juyo certification: never auto-mark sold
   - Require manual review for status changes

4. **Status history audit trail**
   - Record every status change with timestamp and source
   - Enable debugging and recovery

---

## Implementation Plan

### Phase 1: Fix Detection Logic (Oshi-scrapper)

**File: `utils/price_parser.py`**

```python
# REMOVE from SOLD_PATTERNS (line 39):
# r'商談中',

# ADD new RESERVED_PATTERNS:
RESERVED_PATTERNS = [
    r'商談中',           # shōdanchū - under negotiation
    r'\bHOLD\b',         # English hold indicator
    r'\bON\s+HOLD\b',    # "on hold"
]

# ADD new method:
@classmethod
def is_reserved(cls, text: str) -> bool:
    """Check if text indicates item is reserved/on hold (not sold)."""
    if not text:
        return False
    text_lower = text.lower()
    return any(re.search(p, text_lower, re.IGNORECASE) for p in cls.RESERVED_PATTERNS)
```

**File: `scrapers/base.py`**

Update `_determine_status()` to check reserved before sold:
```python
def _determine_status(self, soup, listing):
    # Check if page indicates reserved/hold FIRST
    if self._is_reserved_indicator(soup):
        listing.status = ListingStatus.RESERVED
        listing.is_available = False
        listing.is_sold = False  # NOT sold, just on hold
        return

    # Only mark as sold if page doesn't exist
    if not listing.page_exists:
        listing.status = ListingStatus.PRESUMED_SOLD
        listing.is_available = False
        listing.is_sold = True
        return

    # Default: available
    listing.status = ListingStatus.AVAILABLE
    listing.is_available = True
    listing.is_sold = False
```

### Phase 2: High-Value Protection (Oshi-scrapper)

**File: `db/repository.py`**

```python
HIGH_VALUE_THRESHOLD_JPY = 10_000_000
PROTECTED_CERT_TYPES = ['Juyo', 'Tokubetsu Juyo']

def _is_protected_listing(self, existing: dict) -> bool:
    """Check if listing should be protected from auto-sold."""
    price = existing.get('price_value') or 0
    cert = existing.get('cert_type') or ''

    if price >= HIGH_VALUE_THRESHOLD_JPY:
        return True
    if cert in PROTECTED_CERT_TYPES:
        return True
    return False

def upsert(self, listing):
    existing = self.get_by_url(listing.url)

    if existing:
        # HIGH-VALUE PROTECTION
        if self._is_protected_listing(existing):
            old_status = existing.get('status')
            new_status = listing.status.value if hasattr(listing.status, 'value') else listing.status

            if old_status == 'available' and new_status in ('sold', 'presumed_sold'):
                logger.warning(
                    f"BLOCKED: Auto-sold for protected item {existing['id']} "
                    f"(¥{existing.get('price_value', 0):,}, {existing.get('cert_type', 'N/A')}). "
                    f"Keeping status as '{old_status}'. Manual review required."
                )
                # Don't change status - keep as available
                listing.status = ListingStatus.AVAILABLE
                listing.is_available = True
                listing.is_sold = False

    # ... rest of upsert logic
```

### Phase 3: Status History (Database + Oshi-scrapper)

**Migration: `20260202000001_add_status_history.sql`**

```sql
CREATE TABLE status_history (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    old_is_sold BOOLEAN,
    new_is_sold BOOLEAN,
    price_at_change DECIMAL(12,2),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'scraper'
);

CREATE INDEX idx_status_history_listing ON status_history(listing_id);
CREATE INDEX idx_status_history_detected ON status_history(detected_at DESC);
```

**File: `db/repository.py`**

```python
class StatusHistoryRepository:
    """Repository for status change history."""

    def __init__(self):
        self.client = get_supabase_client()

    def record_change(
        self,
        listing_id: int,
        old_status: str,
        new_status: str,
        old_is_sold: bool,
        new_is_sold: bool,
        price_at_change: float = None,
        source: str = "scraper"
    ) -> Dict[str, Any]:
        """Record a status change."""
        return self.client.table("status_history").insert({
            "listing_id": listing_id,
            "old_status": old_status,
            "new_status": new_status,
            "old_is_sold": old_is_sold,
            "new_is_sold": new_is_sold,
            "price_at_change": price_at_change,
            "source": source,
        }).execute().data[0]
```

### Phase 4: Update Tests

**File: `tests/utils/test_sold_detection.py`**

- Remove 商談中 from sold test cases
- Add new TestReservedDetection class
- Add test: reserved signals should NOT trigger is_sold()
- Add test: Kotetsu case specifically

---

## Files Changed Summary

| Repository | File | Change |
|------------|------|--------|
| Oshi-scrapper | `utils/price_parser.py` | Add RESERVED_PATTERNS, is_reserved() |
| Oshi-scrapper | `scrapers/base.py` | Check reserved before sold |
| Oshi-scrapper | `db/repository.py` | Add StatusHistoryRepository, high-value protection |
| Oshi-scrapper | `tests/utils/test_sold_detection.py` | Update tests |
| Oshi-scrapper | `supabase/migrations/...` | Add status_history table |
| nihontowatch | `docs/` | This documentation |

---

## Testing Checklist

- [ ] Unit test: `is_reserved("商談中")` returns True
- [ ] Unit test: `is_sold("商談中")` returns False
- [ ] Unit test: `is_reserved("HOLD")` returns True
- [ ] Unit test: `is_sold("HOLD")` returns False
- [ ] Unit test: `is_sold("売却済")` still returns True (regression check)
- [ ] Unit test: High-value protection blocks auto-sold
- [ ] Integration test: Scrape page with 商談中 → status=reserved
- [ ] Integration test: Status change recorded in status_history
- [ ] Run full test suite: No regressions

---

## Rollback Plan

All changes are isolated and independently reversible:

| Change | Rollback Method |
|--------|-----------------|
| RESERVED_PATTERNS | Revert price_parser.py |
| High-value protection | Set threshold to infinity |
| Status history table | Table is additive, no dependencies |
| Base scraper changes | Revert base.py |

---

## Monitoring

After deployment, monitor for:

1. **Status history entries**: Should see new records for all status changes
2. **Protected item blocks**: Log warnings for high-value items
3. **Reserved status usage**: Items should be marked reserved instead of sold
4. **False positive rate**: Should drop to near zero

---

## Lessons Learned

1. **Conservative by default**: When uncertain, don't change status
2. **Asymmetric costs matter**: False positives are worse than false negatives
3. **Page existence is the truth**: Content can lie, 404s don't
4. **High-value items need protection**: Expensive mistakes are expensive
5. **Audit trails are essential**: Can't debug what you can't see

---

## Related Documents

- [POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md](./POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md) - First incident
- [POSTMORTEM_SHOUBUDOU_SOLD_STATUS.md](./POSTMORTEM_SHOUBUDOU_SOLD_STATUS.md) - Second incident
- [PLAN_STATUS_TRACKING_SYSTEM_V2.md](./PLAN_STATUS_TRACKING_SYSTEM_V2.md) - Implementation plan
