# Plan: Conservative Status Detection System

**Date:** 2026-02-02
**Version:** 2.1 (staff engineer review incorporated)
**Priority:** High
**Principle:** "Innocent until proven gone"

---

## Staff Engineer Review Status

| Item | Status | Notes |
|------|--------|-------|
| RESERVED enum exists | ✅ Verified | `models/listing.py:33` - already defined |
| Multi-404 requirement | ✅ Added | Phase 1.5 - require 3+ consecutive 404s over 48h |
| Recovery path logic | ✅ Added | Phase 4.2 - page returns → status reverts |
| Deployment order | ✅ Added | See "Deployment Steps" section |
| High-value protection | ❌ Removed | User requested fully automatic system |

---

## Problem Statement

Our sold detection is too aggressive. Three incidents in two months:

| Date | Incident | Root Cause | Items Affected |
|------|----------|------------|----------------|
| 2025-01-20 | Touken Matsumoto | LLM hallucination | 77 |
| 2026-01-26 | Shoubudou | Navigation text | 243 |
| 2026-02-02 | Kotetsu | 商談中 misclassified | 1 (but ¥60M) |

**Core insight:** The only reliable signal that an item is sold is that **the page no longer exists**. Text-based detection is inherently unreliable.

---

## Solution Architecture

### Status Model

```
┌───────────────────────────────────────────────────────────────────┐
│                        STATUS DEFINITIONS                         │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  AVAILABLE      Page exists, has price, has order mechanism       │
│                 → Show in browse, show price                      │
│                                                                   │
│  RESERVED       Page exists, has hold signal (商談中, HOLD)        │
│                 → Hide from browse, KEEP price, may return        │
│                                                                   │
│  PRESUMED_SOLD  Page returns 404 or redirect to sold archive      │
│                 → Hide from browse, show in sold archive          │
│                                                                   │
│  SOLD           Manual confirmation or prolonged presumed_sold    │
│                 → Permanently archived                            │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Detection Logic

```python
def determine_status(page_exists, page_content, current_status, existing_record):
    """
    Conservative status detection.
    Principle: Never mark sold from content alone.

    CRITICAL: A single 404 is NOT proof of sale.
    Pages 404 for many reasons: site migration, temporary outage, URL restructure.
    Require MULTIPLE consecutive 404s over TIME before presuming sold.
    """

    # MULTI-404 REQUIREMENT: Don't trust single 404
    if not page_exists:
        consecutive_404s = (existing_record.get('consecutive_404_count') or 0) + 1
        first_404_at = existing_record.get('first_404_at') or datetime.now()
        hours_since_first = (datetime.now() - first_404_at).total_seconds() / 3600

        # Require 3+ consecutive 404s AND 48+ hours before presuming sold
        if consecutive_404s >= 3 and hours_since_first >= 48:
            return PRESUMED_SOLD, {'consecutive_404_count': consecutive_404s}
        else:
            # Not enough evidence yet - keep current status, increment counter
            return current_status, {
                'consecutive_404_count': consecutive_404s,
                'first_404_at': first_404_at,
            }

    # RECOVERY PATH: Page returned! Reset 404 tracking, may revert status
    if page_exists:
        # Reset 404 counter
        recovery_data = {'consecutive_404_count': 0, 'first_404_at': None}

        # If was presumed_sold but page is back, recover to available
        if current_status == PRESUMED_SOLD:
            logger.info(f"RECOVERY: Page returned, reverting from presumed_sold")
            # Continue to check actual content below

    if has_reserved_signal(page_content):
        # 商談中, HOLD, etc = reserved (temporary)
        return RESERVED, recovery_data

    if has_price_and_order_form(page_content):
        # Clear availability signals
        return AVAILABLE, recovery_data

    # Uncertain? Keep current status (don't change)
    return current_status, recovery_data
```

**Why Multi-404?** Single 404s occur frequently due to:
- CDN cache invalidation
- Site migrations / URL restructuring
- Temporary server issues
- Dealer website maintenance
- Rate limiting

**Evidence required to presume sold:**
| Condition | Value | Rationale |
|-----------|-------|-----------|
| Consecutive 404s | ≥3 | Rules out transient failures |
| Time span | ≥48 hours | Rules out temporary outages |
| Both conditions | Required | Defense in depth |

---

## Implementation Checklist

### Phase 0: Database Schema (Supabase) - DO FIRST

**File: `supabase/migrations/20260202000002_add_404_tracking.sql`**

```sql
-- Add 404 tracking columns to listings table
-- These enable multi-404 requirement before presuming sold

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS consecutive_404_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_404_at TIMESTAMPTZ;

-- Index for finding listings with pending 404 verification
CREATE INDEX IF NOT EXISTS idx_listings_404_pending
ON listings(consecutive_404_count)
WHERE consecutive_404_count > 0 AND consecutive_404_count < 3;

COMMENT ON COLUMN listings.consecutive_404_count IS 'Number of consecutive 404 responses. Reset to 0 when page returns.';
COMMENT ON COLUMN listings.first_404_at IS 'Timestamp of first 404 in current streak. Used with consecutive_404_count to enforce 48h+ window.';
```

**Why separate from status_history migration?**
- Schema changes should be atomic and independently reversible
- This migration is a prerequisite for Phase 1.5

---

### Phase 1: Pattern Changes (Oshi-scrapper)

#### 1.1 Update `utils/price_parser.py`

```python
# CURRENT (line 39):
SOLD_PATTERNS = [
    ...
    r'商談中',  # DELETE THIS
    ...
]

# NEW: Add after SOLD_PATTERNS
RESERVED_PATTERNS = [
    r'商談中',           # shōdanchū - under negotiation
    r'\bHOLD\b',         # English hold
    r'\bON\s+HOLD\b',    # "on hold"
]

# NEW: Add method
@classmethod
def is_reserved(cls, text: str) -> bool:
    """Check if text indicates reserved/hold status."""
    if not text:
        return False
    return any(re.search(p, text, re.IGNORECASE) for p in cls.RESERVED_PATTERNS)
```

#### 1.2 Update `tests/utils/test_sold_detection.py`

```python
# REMOVE from TestSoldDetectionTruePositives:
"商談中",  # DELETE - this is reserved, not sold

# ADD new test class:
class TestReservedDetection:
    """Test reserved/hold detection."""

    @pytest.mark.parametrize("text", [
        "商談中",
        "HOLD",
        "ON HOLD",
        "Price: 60,000,000JPY 商談中 HOLD",
    ])
    def test_reserved_detected(self, text):
        assert PriceParser.is_reserved(text) is True

    @pytest.mark.parametrize("text", [
        "商談中",
        "HOLD",
    ])
    def test_reserved_not_sold(self, text):
        """Reserved should NOT trigger sold detection."""
        assert PriceParser.is_sold(text) is False
```

---

### Phase 1.5: Multi-404 Requirement (Oshi-scrapper)

**CRITICAL CHANGE**: Single 404 should NOT trigger PRESUMED_SOLD.

#### 1.5.1 Update `scrapers/base.py` - 404 handling

```python
# CURRENT (lines 109-126):
if response.status_code == 404:
    # ... retry once ...
    if response.status_code == 404:
        listing.page_exists = False
        listing.is_sold = True  # ← TOO AGGRESSIVE
        listing.status = ListingStatus.PRESUMED_SOLD  # ← TOO AGGRESSIVE
        return listing

# NEW: Don't set status in scraper - let repository handle it
if response.status_code == 404:
    # Retry once for transient failures
    logger.info(f"Got 404 for {url}, retrying after 2s...")
    time.sleep(2)
    response = self.http_client.get(url)
    listing.http_status = response.status_code

    if response.status_code == 404:
        # Confirmed 404 - but DON'T mark as sold yet
        # Repository will handle multi-404 tracking
        logger.info(f"Confirmed 404 after retry: {url}")
        listing.page_exists = False
        listing.is_available = False
        # DO NOT set is_sold or status here - let repository decide
        # based on consecutive_404_count
        listing.success = True
        listing._pending_404 = True  # Signal to repository
        return listing
```

#### 1.5.2 Update `db/repository.py` - Multi-404 logic

```python
# Add to ListingRepository class

REQUIRED_404_COUNT = 3
REQUIRED_404_HOURS = 48

def _handle_404_tracking(self, existing: dict, new_row: dict) -> dict:
    """
    Handle multi-404 tracking for presumed_sold logic.

    Returns modified row with appropriate status based on 404 history.
    """
    if not new_row.get('page_exists', True):
        # Page returned 404 - increment counter
        current_count = existing.get('consecutive_404_count') or 0
        first_404 = existing.get('first_404_at')

        new_count = current_count + 1
        if first_404 is None:
            first_404 = datetime.now(UTC).isoformat()

        # Check if we've met the threshold
        hours_since_first = 0
        if first_404:
            try:
                first_dt = datetime.fromisoformat(first_404.replace('Z', '+00:00'))
                hours_since_first = (datetime.now(UTC) - first_dt).total_seconds() / 3600
            except (ValueError, TypeError):
                pass

        new_row['consecutive_404_count'] = new_count
        new_row['first_404_at'] = first_404

        if new_count >= REQUIRED_404_COUNT and hours_since_first >= REQUIRED_404_HOURS:
            # Met threshold - NOW we can presume sold
            logger.info(
                f"Multi-404 threshold met: {new_count} 404s over {hours_since_first:.1f}h. "
                f"Marking as presumed_sold."
            )
            new_row['status'] = 'presumed_sold'
            new_row['is_sold'] = True
            new_row['is_available'] = False
        else:
            # Not enough evidence - keep existing status
            logger.info(
                f"404 detected but threshold not met: {new_count}/{REQUIRED_404_COUNT} 404s, "
                f"{hours_since_first:.1f}/{REQUIRED_404_HOURS}h. Keeping current status."
            )
            new_row['status'] = existing.get('status', 'available')
            new_row['is_sold'] = existing.get('is_sold', False)
            new_row['is_available'] = existing.get('is_available', True)

    else:
        # Page exists - reset 404 tracking (RECOVERY PATH)
        if existing.get('consecutive_404_count', 0) > 0:
            logger.info(f"Page returned after {existing['consecutive_404_count']} 404s - resetting counter")

        new_row['consecutive_404_count'] = 0
        new_row['first_404_at'] = None

        # RECOVERY: If was presumed_sold but page is back, revert to available
        if existing.get('status') == 'presumed_sold':
            logger.info(f"RECOVERY: Reverting presumed_sold → available (page returned)")
            new_row['status'] = 'available'
            new_row['is_sold'] = False
            new_row['is_available'] = True

    return new_row

# In upsert(), add before existing status change logic:
if existing:
    row = self._handle_404_tracking(existing, row)
```

#### 1.5.3 Tests for Multi-404

```python
# tests/db/test_multi_404.py

class TestMulti404Tracking:
    """Test multi-404 requirement for presumed_sold."""

    def test_single_404_keeps_available(self, repo, listing_available):
        """Single 404 should NOT change status to presumed_sold."""
        # First 404
        listing_available.page_exists = False
        result = repo.upsert(listing_available)

        assert result['status'] == 'available'  # Unchanged
        assert result['consecutive_404_count'] == 1
        assert result['first_404_at'] is not None

    def test_three_404s_within_24h_keeps_available(self, repo, listing_available):
        """3 404s but < 48h should NOT change status."""
        # Simulate 3 quick 404s
        for i in range(3):
            listing_available.page_exists = False
            result = repo.upsert(listing_available)

        assert result['status'] == 'available'  # Still unchanged
        assert result['consecutive_404_count'] == 3

    def test_three_404s_after_48h_marks_presumed_sold(self, repo, listing_available):
        """3+ 404s over 48+ hours should mark presumed_sold."""
        # Set first_404_at to 50 hours ago
        repo.client.table('listings').update({
            'consecutive_404_count': 2,
            'first_404_at': (datetime.now(UTC) - timedelta(hours=50)).isoformat(),
        }).eq('id', listing_available.id).execute()

        # Third 404
        listing_available.page_exists = False
        result = repo.upsert(listing_available)

        assert result['status'] == 'presumed_sold'
        assert result['is_sold'] is True

    def test_page_return_resets_404_count(self, repo, listing_with_404s):
        """Page returning should reset 404 counter."""
        listing_with_404s.page_exists = True
        result = repo.upsert(listing_with_404s)

        assert result['consecutive_404_count'] == 0
        assert result['first_404_at'] is None

    def test_page_return_recovers_from_presumed_sold(self, repo, listing_presumed_sold):
        """Page returning should revert presumed_sold to available."""
        listing_presumed_sold.page_exists = True
        listing_presumed_sold.is_available = True
        listing_presumed_sold.is_sold = False
        result = repo.upsert(listing_presumed_sold)

        assert result['status'] == 'available'
        assert result['is_sold'] is False
```

---

### Phase 2: Status History (Database + Oshi-scrapper)

#### 3.1 Create Migration

File: `supabase/migrations/20260202000001_add_status_history.sql`

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

#### 3.2 Add StatusHistoryRepository

```python
class StatusHistoryRepository:
    def __init__(self):
        self.client = get_supabase_client()

    def record_change(
        self,
        listing_id: int,
        old_status: str,
        new_status: str,
        old_is_sold: bool = None,
        new_is_sold: bool = None,
        price_at_change: float = None,
        source: str = "scraper"
    ):
        return self.client.table("status_history").insert({
            "listing_id": listing_id,
            "old_status": old_status,
            "new_status": new_status,
            "old_is_sold": old_is_sold,
            "new_is_sold": new_is_sold,
            "price_at_change": price_at_change,
            "source": source,
        }).execute()
```

#### 3.3 Update ListingRepository.upsert()

```python
# In upsert(), after detecting status change:
if old_status != new_status:
    StatusHistoryRepository().record_change(
        listing_id=existing["id"],
        old_status=old_status,
        new_status=new_status,
        old_is_sold=existing.get("is_sold"),
        new_is_sold=listing.is_sold,
        price_at_change=existing.get("price_value"),
        source="scraper"
    )
```

---

### Phase 4: Base Scraper Updates (Oshi-scrapper)

#### 4.1 Update `scrapers/base.py` - Reserved detection

```python
def _is_reserved_indicator(self, soup: BeautifulSoup) -> bool:
    """Check for reserved/hold indicators."""
    text = soup.get_text()
    return self.price_parser.is_reserved(text)

# In scrape() or _post_process():
# Check reserved BEFORE sold
if self._is_reserved_indicator(soup):
    listing.status = ListingStatus.RESERVED
    listing.is_available = False
    listing.is_sold = False
    # IMPORTANT: Don't clear price for reserved items
    return
```

#### 4.2 Recovery Path Logic

**What is the recovery path?**

When a page was marked `presumed_sold` (due to 404s) but later returns with valid content, we need to recover the listing back to `available`.

**Recovery triggers:**
1. Page that was returning 404 now returns 200
2. Page has price and/or order form (clear availability signals)

**Recovery flow:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         RECOVERY PATH FLOW                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Scraper fetches URL                                                    │
│         │                                                                │
│         ▼                                                                │
│   ┌─────────────┐     YES    ┌─────────────────────────────────────┐    │
│   │ HTTP 200?   │──────────►│ Reset consecutive_404_count = 0     │    │
│   └─────────────┘            │ Reset first_404_at = NULL           │    │
│         │ NO                 └──────────────┬──────────────────────┘    │
│         ▼                                   │                            │
│   Increment 404                             ▼                            │
│   counter (see                    ┌─────────────────────┐               │
│   Phase 1.5)                      │ Was presumed_sold?  │               │
│                                   └─────────────────────┘               │
│                                      │ YES        │ NO                  │
│                                      ▼            ▼                     │
│                             ┌────────────┐  ┌──────────────┐           │
│                             │ Has price? │  │ Keep current │           │
│                             │ or signals │  │ status       │           │
│                             └────────────┘  └──────────────┘           │
│                               │ YES   │ NO                              │
│                               ▼       ▼                                 │
│                    ┌──────────────┐  ┌──────────────────┐              │
│                    │ RECOVER to   │  │ Mark as UNKNOWN  │              │
│                    │ AVAILABLE    │  │ for manual review│              │
│                    └──────────────┘  └──────────────────┘              │
│                                                                          │
│   Log: "RECOVERY: Listing {id} reverted presumed_sold → available"      │
│   Record in status_history with source='recovery'                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Implementation (in `db/repository.py`):**

```python
def _handle_recovery(self, existing: dict, new_row: dict) -> dict:
    """
    Handle recovery from presumed_sold when page returns.

    This is called AFTER _handle_404_tracking resets the counters.
    """
    old_status = existing.get('status')
    page_exists = new_row.get('page_exists', True)

    # Only attempt recovery if:
    # 1. Page now exists (200 response)
    # 2. Was previously presumed_sold
    if not page_exists or old_status != 'presumed_sold':
        return new_row

    # Check for clear availability signals
    has_price = new_row.get('price_value') is not None
    # Note: is_available comes from scraper's content analysis
    scraper_says_available = new_row.get('is_available', False)

    if has_price or scraper_says_available:
        logger.info(
            f"RECOVERY: Listing {existing['id']} reverting presumed_sold → available "
            f"(price={has_price}, scraper_available={scraper_says_available})"
        )
        new_row['status'] = 'available'
        new_row['is_sold'] = False
        new_row['is_available'] = True

        # Record recovery in status_history
        StatusHistoryRepository().record_change(
            listing_id=existing['id'],
            old_status='presumed_sold',
            new_status='available',
            old_is_sold=True,
            new_is_sold=False,
            price_at_change=new_row.get('price_value'),
            source='recovery'
        )
    else:
        # Page exists but no clear signals - mark for manual review
        logger.warning(
            f"RECOVERY UNCERTAIN: Listing {existing['id']} page returned but no "
            f"clear availability signals. Keeping presumed_sold for manual review."
        )
        # Keep presumed_sold but flag for review
        if new_row.get('raw_fields') is None:
            new_row['raw_fields'] = {}
        new_row['raw_fields']['needs_manual_review'] = True
        new_row['raw_fields']['recovery_attempted_at'] = datetime.now(UTC).isoformat()

    return new_row
```

**Tests for recovery:**

```python
# tests/db/test_recovery.py

class TestRecoveryPath:
    """Test recovery from presumed_sold status."""

    def test_recovery_with_price(self, repo, listing_presumed_sold):
        """Page returning with price should recover to available."""
        listing_presumed_sold.page_exists = True
        listing_presumed_sold.price_value = 1000000
        listing_presumed_sold.is_available = True

        result = repo.upsert(listing_presumed_sold)

        assert result['status'] == 'available'
        assert result['is_sold'] is False
        assert result['consecutive_404_count'] == 0

    def test_recovery_without_signals_stays_presumed_sold(self, repo, listing_presumed_sold):
        """Page returning without clear signals should stay presumed_sold."""
        listing_presumed_sold.page_exists = True
        listing_presumed_sold.price_value = None
        listing_presumed_sold.is_available = False

        result = repo.upsert(listing_presumed_sold)

        assert result['status'] == 'presumed_sold'  # Unchanged
        assert result['raw_fields'].get('needs_manual_review') is True

    def test_recovery_records_status_history(self, repo, listing_presumed_sold):
        """Recovery should be recorded in status_history."""
        listing_presumed_sold.page_exists = True
        listing_presumed_sold.price_value = 500000
        listing_presumed_sold.is_available = True

        repo.upsert(listing_presumed_sold)

        # Check status_history
        history = StatusHistoryRepository().get_for_listing(listing_presumed_sold.id)
        assert any(
            h['source'] == 'recovery' and h['new_status'] == 'available'
            for h in history
        )
```

---

### Phase 5: LLM Prompt Update (Oshi-scrapper)

#### 5.1 Update `utils/llm_extractor.py`

```python
# Update the prompt section about sold status:

"""
6. AVAILABILITY STATUS - BE CONSERVATIVE:

   SOLD (permanent - item is gone forever):
   - Only if page explicitly says "SOLD", "売却済", "完売"
   - Only if there is NO price and NO order form
   - When in doubt, default to available

   RESERVED (temporary - item may return):
   - 商談中 = "under negotiation" = RESERVED, not sold
   - HOLD, "on hold" = RESERVED, not sold
   - Item has price but someone is negotiating

   AVAILABLE (default):
   - Has price displayed
   - Has order form or purchase mechanism
   - No clear sold indicator

   IMPORTANT: If uncertain, return is_available: true, is_sold: false.
   It's better to show a sold item as available than to hide an available item.
"""
```

---

## Testing Strategy

### Unit Tests

```bash
cd /path/to/Oshi-scrapper
pytest tests/utils/test_sold_detection.py -v
```

Expected results:
- `is_reserved("商談中")` → True
- `is_sold("商談中")` → False
- `is_sold("売却済")` → True (regression check)
- `is_reserved("HOLD")` → True
- `is_reserved("Please hold carefully")` → False

### Multi-404 Tests (NEW)

```bash
pytest tests/db/test_multi_404.py -v
```

Expected results:
- Single 404 → status unchanged, counter = 1
- 3 404s in 1 hour → status unchanged (time requirement not met)
- 3 404s over 48h → status = presumed_sold
- Page returns → counter reset to 0

### Recovery Path Tests (NEW)

```bash
pytest tests/db/test_recovery.py -v
```

Expected results:
- presumed_sold + page returns with price → available
- presumed_sold + page returns without signals → stays presumed_sold (needs review)
- Recovery recorded in status_history with source='recovery'

### Integration Tests

```bash
pytest tests/scrapers/test_aoi_art.py -v
```

### Full Regression Suite

```bash
pytest tests/ -v --tb=short
```

### Manual Verification

After deployment, manually verify with a known 404 URL:

```bash
# Scrape a URL that 404s
python main.py scrape --url "https://example.com/sold-item"

# Check database - should NOT be presumed_sold after first 404
SELECT status, consecutive_404_count FROM listings WHERE url LIKE '%sold-item%';

# Wait and scrape again 3 times
# Status should only change after 3+ 404s AND 48h
```

---

## Deployment Steps

### Deployment Order (CRITICAL)

Changes span two repos and Supabase. Order matters for backwards compatibility.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT SEQUENCE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Database Migrations (Supabase)                                     │
│  ───────────────────────────────────────                                    │
│  Apply BOTH migrations. Order within Supabase doesn't matter.               │
│                                                                             │
│    □ 20260202000001_add_status_history.sql (status audit table)             │
│    □ 20260202000002_add_404_tracking.sql (consecutive_404_count fields)     │
│                                                                             │
│  WHY FIRST? Code needs columns to exist. Migrations are additive/safe.      │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  STEP 2: Oshi-scrapper Code Changes                                         │
│  ──────────────────────────────────                                         │
│  Deploy in a single commit. Changes are interdependent.                     │
│                                                                             │
│    □ utils/price_parser.py (RESERVED_PATTERNS, is_reserved())               │
│    □ db/repository.py (multi-404, high-value protection, status history)    │
│    □ scrapers/base.py (404 handling change, reserved detection)             │
│    □ tests/* (new test files)                                               │
│                                                                             │
│  RUN TESTS BEFORE DEPLOY:                                                   │
│    cd /path/to/Oshi-scrapper                                                │
│    pytest tests/ -v --tb=short                                              │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  STEP 3: Monitor and Verify                                                 │
│  ─────────────────────────                                                  │
│    □ Check logs for "PROTECTED:" warnings (high-value items blocked)        │
│    □ Check logs for "Multi-404 threshold" messages                          │
│    □ Check logs for "RECOVERY:" messages                                    │
│    □ Verify status_history table is being populated                         │
│    □ Verify consecutive_404_count is incrementing on 404s                   │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  STEP 4: nihontowatch (Optional - No Changes Required)                      │
│  ─────────────────────────────────────────────────────                      │
│  nihontowatch reads from Supabase. No code changes needed.                  │
│  New columns are ignored by existing queries.                               │
│                                                                             │
│  Future: Add /admin view for status_history if desired.                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Backwards Compatibility Analysis

| Change | Backwards Compatible? | Notes |
|--------|----------------------|-------|
| status_history table | ✅ Yes | Additive, nothing reads it yet |
| consecutive_404_count column | ✅ Yes | Additive, defaults to 0 |
| first_404_at column | ✅ Yes | Additive, defaults to NULL |
| RESERVED_PATTERNS | ✅ Yes | New feature, doesn't break existing |
| Multi-404 logic | ⚠️ Behavior change | Items will stay available longer (safer) |
| High-value protection | ⚠️ Behavior change | Expensive items protected (safer) |

**All changes are "fail-safe"**: If something goes wrong, items stay available rather than disappearing.

### Pre-deployment Checklist

```bash
# 1. Verify migrations exist
ls -la Oshi-scrapper/supabase/migrations/20260202*.sql

# 2. Run full test suite
cd /path/to/Oshi-scrapper
pytest tests/ -v --tb=short

# 3. Verify RESERVED enum exists (should pass)
python -c "from models.listing import ListingStatus; print(ListingStatus.RESERVED)"

# 4. Apply migrations to Supabase
supabase db push  # or via dashboard

# 5. Deploy Oshi-scrapper
git add -A && git commit -m "feat: conservative status detection with multi-404 requirement" && git push

# 6. Monitor logs for 24 hours
```

### Post-deployment Verification Queries

```sql
-- Check status_history is being populated
SELECT COUNT(*) FROM status_history WHERE detected_at > NOW() - INTERVAL '1 hour';

-- Check 404 tracking is working
SELECT id, url, consecutive_404_count, first_404_at
FROM listings
WHERE consecutive_404_count > 0
ORDER BY consecutive_404_count DESC
LIMIT 10;

-- Check no new false positives (items incorrectly marked sold)
SELECT l.id, l.url, l.status, l.price_value, l.cert_type, sh.detected_at
FROM listings l
JOIN status_history sh ON l.id = sh.listing_id
WHERE sh.new_status IN ('sold', 'presumed_sold')
  AND sh.detected_at > NOW() - INTERVAL '24 hours'
  AND (l.price_value > 10000000 OR l.cert_type IN ('Juyo', 'Tokubetsu Juyo'))
ORDER BY sh.detected_at DESC;
```

---

## Rollback Plan

| Component | Rollback Method | Risk Level |
|-----------|-----------------|------------|
| price_parser.py (RESERVED_PATTERNS) | `git revert` single file | Low |
| repository.py (high-value protection) | Set threshold to `float('inf')` | Low |
| repository.py (multi-404 logic) | Set `REQUIRED_404_COUNT = 1` | Low |
| base.py (404 handling) | Revert to immediate PRESUMED_SOLD | Medium |
| status_history table | No action needed (additive, unused by UI) | None |
| 404 tracking columns | No action needed (additive, defaults safe) | None |
| LLM prompt | Revert llm_extractor.py | Low |

### Emergency Rollback Procedure

If false negatives occur (truly sold items showing as available):

```python
# In repository.py, reduce thresholds temporarily:
REQUIRED_404_COUNT = 1  # Instead of 3
REQUIRED_404_HOURS = 0  # Instead of 48
HIGH_VALUE_THRESHOLD_JPY = float('inf')  # Disable protection
```

If false positives occur (available items marked sold):
- This shouldn't happen with the new conservative logic
- Check logs for `PROTECTED:` warnings
- Manual fix: `UPDATE listings SET status='available', is_sold=false WHERE id = ?`

### Data Recovery

If items were incorrectly marked sold before the fix:

```sql
-- Find items that went presumed_sold with only 1-2 404s
SELECT l.id, l.url, l.status, l.price_value, l.cert_type
FROM listings l
WHERE l.status = 'presumed_sold'
  AND l.consecutive_404_count < 3
ORDER BY l.price_value DESC NULLS LAST;

-- Revert to available (after manual verification)
UPDATE listings
SET status = 'available',
    is_sold = false,
    is_available = true,
    consecutive_404_count = 0
WHERE id IN (/* verified IDs */);
```

---

## Success Criteria

1. ✅ 商談中 items marked as `reserved`, not `sold`
2. ✅ Reserved items keep their price
3. ✅ All status changes recorded in status_history
4. ✅ No regressions in existing sold detection
5. ✅ Full test suite passes
6. ✅ **Single 404 does NOT mark item as presumed_sold** (multi-404 requirement)
7. ✅ **3+ consecutive 404s over 48+ hours required for presumed_sold**
8. ✅ **Items recover to available when page returns** (recovery path)
9. ✅ **404 counter resets when page returns**

---

## Future Enhancements (Not in Scope)

- Admin dashboard for status_history
- Email alerts for protected item blocks
- Periodic re-verification of presumed_sold items
- ML-based confidence scoring

These can be added later based on operational needs.

---

## Related Documentation

- [POSTMORTEM_KOTETSU_STATUS_BUG.md](./POSTMORTEM_KOTETSU_STATUS_BUG.md) - Full incident analysis
- [POSTMORTEM_SHOUBUDOU_SOLD_STATUS.md](./POSTMORTEM_SHOUBUDOU_SOLD_STATUS.md) - Previous incident
- [POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md](./POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md) - First incident
