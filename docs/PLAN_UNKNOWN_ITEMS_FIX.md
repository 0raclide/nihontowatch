# Plan: Fix "Unknown" Item Classification

## Executive Summary

We have ~93 unknown items currently shown as available in the database. Investigation reveals these fall into several fixable categories. The root causes are:
1. Missing item types in the LLM extraction prompt
2. Non-collectible items being scraped (books, info pages, accessories)
3. Poor handling of set items (daisho, futatokoro, etc.)
4. The "other" catch-all being mapped to "Unknown"

---

## Analysis Results

### Unknown Items by Pattern (from 93 analyzed)

| Pattern | Count | Recommended Fix |
|---------|-------|-----------------|
| other/unrecognized | 49 | Improve LLM prompt + add new types |
| contains 刀 (possible sword) | 19 | LLM should classify as katana/wakizashi |
| non-listing pages (info/media) | 5 | Exclude at scraper discovery stage |
| futatokoro (2-piece set) | 4 | Add `futatokoro` item type |
| sword rack/stand | 4 | Already have Stand type, needs prompt fix |
| sansho/mitokoro (3-piece) | 3 | Add `mitokoromono` item type |
| tosogu artist works | 2 | Add artist→type inference to prompt |
| daisho (sword pair) | 2 | Add `daisho` item type |
| naginata-naoshi | 2 | Already in prompt - case mismatch fix |
| shisho (4-piece set) | 1 | Add `shisho-mono` item type |
| kodachi | 1 | Add `kodachi` item type |
| koshirae fittings | 1 | Already in prompt - needs better inference |

### Non-Collectible Items Found (Should Be Excluded)

1. **Books** (書籍):
   - "図説 日本刀大全" (Illustrated Guide to Japanese Swords)
   - "書籍 信家" (Book Nobuie)
   - "MEIBUTSU-Treasured Japanese Swords-"

2. **Information Pages**:
   - "メディア出演情報" (Media Appearances)
   - "刀剣が鑑賞できる展覧会情報2025年" (Exhibition Info)

3. **Non-Sword Antiques**:
   - "阿波筒火縄銃" (Matchlock gun)
   - "鉄扇" (Iron fan)
   - "轡" (Horse bit)
   - "猪口" (Sake cup)
   - "鞍" (Saddle)
   - "Sword Cleaning Kit"

---

## Root Causes

### 1. LLM Extraction Prompt Missing Types

**File**: `/Oshi-scrapper/utils/llm_extractor.py:364`

Current prompt:
```
"item_type": "katana|wakizashi|tanto|tachi|naginata|naginata-naoshi|yari|ken|tsuba|menuki|kozuka|kogai|fuchi|kashira|fuchi-kashira|koshirae|other"
```

Missing types that exist in `models/listing.py` but not in prompt:
- `kodachi` (小太刀)
- `sword` (generic)
- `daisho` (matched pair)
- `armor`
- `helmet`
- `stand`

Tosogu set types needed (not in model):
- `futatokoro` / `nisho-mono` (2-piece sets)
- `mitokoromono` (3-piece sets)
- `shisho-mono` (4-piece sets)

### 2. "other" → "Unknown" Mapping

When the LLM can't classify, it returns `"item_type": "other"`. This becomes `Unknown` in the DB, making it impossible to distinguish:
- Genuinely unclassifiable items
- Items the prompt just doesn't handle
- Non-collectibles that should be filtered

### 3. No URL/Title-Based Pre-filtering

The scraper discovers URLs without filtering out:
- Blog posts / info pages
- Book listings
- Accessory items

---

## Implementation Plan

### Phase 1: Update Item Type Enum (Oshi-scrapper)

**File**: `/Oshi-scrapper/models/listing.py`

Add new types to `ItemType` enum:

```python
class ItemType(str, Enum):
    # Token (bladed weapons)
    KATANA = "Katana"
    WAKIZASHI = "Wakizashi"
    TANTO = "Tanto"
    TACHI = "Tachi"
    KODACHI = "Kodachi"           # ADD
    NAGINATA = "Naginata"
    NAGINATA_NAOSHI = "Naginata Naoshi"
    YARI = "Yari"
    KEN = "Ken"
    SWORD = "Sword"
    DAISHO = "Daisho"             # ADD - matched sword pair

    # Tosogu (fittings)
    TSUBA = "Tsuba"
    MENUKI = "Menuki"
    KOZUKA = "Kozuka"
    KOGAI = "Kogai"
    FUCHI = "Fuchi"
    KASHIRA = "Kashira"
    FUCHI_KASHIRA = "Fuchi-Kashira"
    FUTATOKORO = "Futatokoro"     # ADD - 2-piece set (kozuka+kogai)
    MITOKOROMONO = "Mitokoromono" # ADD - 3-piece set
    KOSHIRAE = "Koshirae"
    TOSOGU = "Tosogu"

    # Other
    ARMOR = "Armor"
    HELMET = "Helmet"
    STAND = "Stand"
    BOOK = "Book"                 # ADD - filter these out
    OTHER = "Other"
    UNKNOWN = "Unknown"
```

### Phase 2: Update LLM Extraction Prompt

**File**: `/Oshi-scrapper/utils/llm_extractor.py`

Update the `EXTRACTION_PROMPT` item_type list:

```python
"item_type": "katana|wakizashi|tanto|tachi|kodachi|naginata|naginata-naoshi|yari|ken|sword|daisho|tsuba|menuki|kozuka|kogai|fuchi|kashira|fuchi-kashira|futatokoro|mitokoromono|koshirae|tosogu|armor|helmet|stand|book|other"
```

Add classification guidance to prompt:

```
6. ITEM TYPE CLASSIFICATION:
   - Daisho (大小): A MATCHED PAIR of katana + wakizashi sold together
   - Kodachi (小太刀): A short sword, typically 60-70cm
   - Futatokoro (二所物): A SET of TWO fittings (usually kozuka + kogai)
   - Mitokoromono (三所物): A SET of THREE fittings (kozuka + kogai + menuki)
   - Naginata-naoshi: A naginata blade remounted as a sword
   - Stand (刀掛, スタンド): Display racks for swords or fittings
   - Book (書籍): Reference books, catalogs - NOT collectibles
   - Armor (甲冑, 鎧): Full armor suits or major armor pieces

   If the listing title contains 二所, 三所, 四所 → use futatokoro/mitokoromono
   If the listing is a matched sword pair → use daisho
   If it's a book or reference material → use book
   If it's a cleaning kit, stand, or accessory → use stand or other
```

### Phase 3: Update Discovery Crawlers (URL Filtering)

**File**: Create `/Oshi-scrapper/scrapers/discovery/filters.py`

Add URL/title-based exclusion patterns:

```python
# URLs to exclude
EXCLUDED_URL_PATTERNS = [
    r'/blog/', r'/news/', r'/exhibition/', r'/event/',
    r'/media/', r'/about/', r'/contact/', r'/info/',
]

# Title patterns to exclude (non-collectibles)
EXCLUDED_TITLE_PATTERNS = [
    r'^書籍\s',                    # Books
    r'^Book\s',
    r'展覧会情報',                  # Exhibition info
    r'メディア出演',                # Media appearances
    r'Cleaning Kit',
    r'^お知らせ',                   # Announcements
]

# Title patterns for known non-sword items
NON_SWORD_PATTERNS = [
    r'火縄銃|hinawajyu|matchlock', # Guns
    r'猪口|guinomi|sake cup',      # Ceramics
    r'鉄扇|iron fan',              # Fans
    r'轡|bit',                     # Horse equipment
    r'鞍|saddle',
]
```

### Phase 4: Nihontowatch Frontend Updates

**File**: `/nihontowatch/src/lib/constants.ts`

Add new types:

```typescript
export const ITEM_TYPES = {
  // Blades
  KATANA: 'katana',
  // ... existing ...
  KODACHI: 'kodachi',
  DAISHO: 'daisho',

  // Tosogu
  // ... existing ...
  FUTATOKORO: 'futatokoro',
  MITOKOROMONO: 'mitokoromono',

  // Other
  ARMOR: 'armor',
  HELMET: 'helmet',
  BOOK: 'book',     // For filtering out
  STAND: 'stand',
  UNKNOWN: 'unknown',
} as const;

// Update BLADE_TYPES
export const BLADE_TYPES = [
  ITEM_TYPES.KATANA,
  // ... existing ...
  ITEM_TYPES.KODACHI,
  ITEM_TYPES.DAISHO, // Show daisho with blades
] as const;

// Update TOSOGU_TYPES
export const TOSOGU_TYPES = [
  // ... existing ...
  ITEM_TYPES.FUTATOKORO,
  ITEM_TYPES.MITOKOROMONO,
] as const;

// Items to HIDE from browse (filter at API level)
export const EXCLUDED_TYPES = [
  ITEM_TYPES.BOOK,
  ITEM_TYPES.STAND,
] as const;
```

**File**: `/nihontowatch/src/app/api/browse/route.ts`

Add exclusion filter:

```typescript
// After status filter, before item type filter
query = query.not('item_type', 'in', '("book","stand","Book","Stand")');
```

### Phase 5: Backfill Existing Unknown Items

**Script**: `/Oshi-scrapper/scripts/reclassify_unknown.py`

Create a re-extraction script:

```python
"""
Re-extract item_type for all 'unknown' items using:
1. Title-based pattern matching (fast, rule-based)
2. LLM re-extraction for remaining items
"""

# Pattern-based classification rules
TITLE_TO_TYPE = {
    r'二所物?|futatokoro|nisho': 'Futatokoro',
    r'三所物?|mitokoro|sansho': 'Mitokoromono',
    r'大小|daisho': 'Daisho',
    r'小太刀|kodachi': 'Kodachi',
    r'薙刀直[しシ]?|naginata.?naoshi': 'Naginata Naoshi',
    r'書籍|book': 'Book',
    r'刀掛|sword.?rack|stand': 'Stand',
    r'甲冑|armor|鎧|具足': 'Armor',
    r'兜|kabuto|helmet': 'Helmet',
}
```

### Phase 6: Database Migration

Add the following if needed:
```sql
-- Create enum type if using strict typing
-- Or just update existing string values

-- Update any "other" to "Unknown" for consistency
UPDATE listings SET item_type = 'Unknown' WHERE item_type = 'other';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_listings_item_type ON listings(item_type);
```

---

## Test Plan

### Unit Tests (Oshi-scrapper)

```python
# tests/test_item_type_classification.py

class TestItemTypeClassification:

    def test_kodachi_detected(self):
        """小太刀 should be classified as Kodachi"""
        title = "小太刀 備中国住右衛門尉平吉"
        assert classify_item_type(title) == "Kodachi"

    def test_daisho_detected(self):
        """大小 or 'Daisho' should be classified as Daisho"""
        titles = [
            "大小 肥前国住近江大掾藤原忠吉",
            "EXCELLENT SAMURAI DAISHO OF MINO SWORDS",
        ]
        for title in titles:
            assert classify_item_type(title) == "Daisho"

    def test_futatokoro_detected(self):
        """二所物 should be Futatokoro"""
        title = "龍虎図二所 無銘 京金工"
        assert classify_item_type(title) == "Futatokoro"

    def test_mitokoromono_detected(self):
        """三所物 should be Mitokoromono"""
        title = "魚尽図三所物 後藤通乗"
        assert classify_item_type(title) == "Mitokoromono"

    def test_naginata_naoshi_detected(self):
        """薙刀直し should be Naginata Naoshi"""
        titles = [
            "薙刀直し脇差 無銘",
            "薙刀直し刀 無銘 (青江)",
        ]
        for title in titles:
            assert classify_item_type(title) == "Naginata Naoshi"

    def test_book_detected(self):
        """Books should be classified as Book"""
        titles = [
            "書籍 信家",
            "Book Meito Kotetsu",
            "MEIBUTSU-Treasured Japanese Swords-",
        ]
        for title in titles:
            assert classify_item_type(title) == "Book"

    def test_stand_detected(self):
        """Sword racks should be Stand"""
        title = "蓬莱山図蒔絵小箪笥付三本掛刀掛"
        assert classify_item_type(title) == "Stand"

    def test_info_page_excluded(self):
        """Info pages should not be scraped/classified"""
        titles = [
            "メディア出演情報",
            "刀剣が鑑賞できる展覧会情報2025年",
        ]
        for title in titles:
            assert should_exclude_listing(title) == True
```

### Integration Tests (Nihontowatch)

```typescript
// tests/api/browse.test.ts

describe('Browse API item type filtering', () => {
  it('should exclude books from results', async () => {
    const res = await fetch('/api/browse?tab=available');
    const data = await res.json();

    const hasBooks = data.listings.some(
      l => l.item_type?.toLowerCase() === 'book'
    );
    expect(hasBooks).toBe(false);
  });

  it('should include new item types in facets', async () => {
    const res = await fetch('/api/browse?tab=available&cat=nihonto');
    const data = await res.json();

    const typeValues = data.facets.itemTypes.map(f => f.value);
    // Should include new types if they exist
    expect(typeValues).toContain('kodachi');
  });

  it('should filter futatokoro under tosogu category', async () => {
    const res = await fetch('/api/browse?tab=available&cat=tosogu');
    const data = await res.json();

    // Futatokoro should appear in tosogu results
    const hasFutatokoro = data.listings.some(
      l => l.item_type?.toLowerCase() === 'futatokoro'
    );
    // Only true if we have futatokoro items
  });
});
```

### E2E Test Scenarios

1. **Filter by new types**: Navigate to `?type=kodachi` and verify results
2. **Facet counts**: Check that new types appear in filter counts
3. **Category grouping**: Verify `daisho` appears under "Nihonto" category
4. **Exclusion**: Verify books and stands don't appear in browse results
5. **Unknown count**: After backfill, unknown count should drop significantly

---

## Rollout Plan

### Step 1: Schema Updates (Day 1)
- Update `ItemType` enum in Oshi-scrapper
- Update constants in Nihontowatch
- Deploy Nihontowatch with new types (backward compatible)

### Step 2: LLM Prompt Update (Day 2)
- Update extraction prompt with new types
- Deploy updated scraper
- New scrapes will use new classification

### Step 3: Backfill (Day 3-4)
- Run reclassification script on existing unknown items
- Monitor for misclassifications
- Manual review of edge cases

### Step 4: Discovery Filtering (Day 5)
- Add URL/title exclusion patterns
- Test with dry-run mode
- Deploy to prevent future non-collectibles

### Step 5: Frontend Polish (Day 6)
- Update type labels in UI
- Add icons for new types (optional)
- Verify facet display

---

## Success Metrics

| Metric | Before | Target After |
|--------|--------|--------------|
| Unknown items (available) | 93 | < 10 |
| Books in results | ~20 | 0 |
| Info pages in results | ~5 | 0 |
| Daisho classified | 0 | 100% |
| Set items (futatokoro etc) | 0 classified | 100% |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM misclassifies new types | Start with rule-based patterns for clear cases |
| Breaking existing filters | New types are additive, existing queries unchanged |
| Backfill creates errors | Run in batches with validation |
| Over-filtering legitimate items | Conservative exclusion patterns, manual review |

---

## Files to Modify

### Oshi-scrapper
1. `models/listing.py` - Add new ItemType values
2. `utils/llm_extractor.py` - Update prompt
3. `scrapers/discovery/filters.py` - New exclusion logic
4. `scripts/reclassify_unknown.py` - Backfill script

### Nihontowatch
1. `src/lib/constants.ts` - Add new types
2. `src/types/index.ts` - Update ItemType type
3. `src/app/api/browse/route.ts` - Add exclusion filter
4. Filter UI components (if showing new types)
