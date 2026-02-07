# Yuhinkai Registry Vision

## From Search Engine to Canonical Registry

This document outlines the strategic opportunity to transform Nihontowatch and Yuhinkai from separate tools into an integrated ecosystem that becomes **the definitive reference for the global nihonto market**.

---

## Executive Summary

**Current State:**
- **Nihontowatch**: Aggregator showing live dealer listings (44 dealers, ~15,000+ listings)
- **Yuhinkai**: Artisan reference database (12,447 smiths, 1,119 tosogu makers)

**Opportunity:**
Transform these into a **canonical work registry** that tracks every sword we've ever seen, creating:
- Comprehensive price history (like Artnet for fine art)
- Automatic provenance tracking
- Living catalogue raisonné for every smith
- Market intelligence no competitor can replicate

**The Insight:**
Every sword that appears on Nihontowatch should become a permanent record in Yuhinkai. Over time, this creates an irreplaceable historical database that compounds in value.

---

## The Two Systems Today

### Nihontowatch (Frontend)

```
PURPOSE: Help collectors find swords for sale

┌─────────────────────────────────────────────────────┐
│                   NIHONTOWATCH                      │
│                                                     │
│  • Browse 44 dealers in one place                  │
│  • Filter by type, price, certification            │
│  • Currency conversion                             │
│  • Email alerts for new listings                   │
│  • Setsumei translations                           │
│                                                     │
│  Data lifecycle: EPHEMERAL                         │
│  - Listings come and go                            │
│  - Sold items eventually archived                  │
│  - Historical data not primary focus              │
└─────────────────────────────────────────────────────┘
```

### Yuhinkai (Reference Database)

```
PURPOSE: Identify and match artisans

┌─────────────────────────────────────────────────────┐
│                     YUHINKAI                        │
│                                                     │
│  • 12,447 documented smiths                        │
│  • 1,119 tosogu makers                             │
│  • Artisan codes (MAS590, OWA009, etc.)           │
│  • School/lineage relationships                    │
│  • Used for artisan matching in scraper           │
│                                                     │
│  Data lifecycle: PERMANENT                         │
│  - Reference data, rarely changes                  │
│  - No work-level tracking                         │
│  - No market data                                 │
└─────────────────────────────────────────────────────┘
```

---

## The Integrated Vision

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    YUHINKAI REGISTRY (Enhanced)                     │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  ARTISANS   │  │   WORKS     │  │ APPEARANCES │  │  PRICE    │ │
│  │  (existing) │  │   (NEW)     │  │   (NEW)     │  │  INDEX    │ │
│  │             │  │             │  │             │  │  (NEW)    │ │
│  │ 12,447      │  │ Every sword │  │ Market      │  │ Aggregate │ │
│  │ smiths      │◄─┤ we've ever  │◄─┤ history per │──► stats by  │ │
│  │             │  │ seen        │  │ work        │  │ smith/era │ │
│  │ 1,119       │  │             │  │             │  │           │ │
│  │ tosogu      │  │ Linked to   │  │ Price,      │  │ Trends,   │ │
│  │ makers      │  │ artisan     │  │ dealer,     │  │ medians,  │ │
│  │             │  │             │  │ date, URL   │  │ ranges    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │
│         │                │                │                │       │
│         └────────────────┴────────────────┴────────────────┘       │
│                                    │                                │
│                                    ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     NIHONTOWATCH                             │   │
│  │                  (Consumer Interface)                        │   │
│  │                                                              │   │
│  │  Browse ──► Search ──► Artist Profiles ──► Price History    │   │
│  │                                                              │   │
│  │  Every listing automatically feeds the registry             │   │
│  │  Registry data enriches the browsing experience             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Synergy Model

### Data Flow: Nihontowatch → Yuhinkai

```
SCRAPER discovers new listing
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ 1. ARTISAN MATCHING                                 │
│    "Who made this?"                                 │
│    └── Match to Yuhinkai artisan (MAS590, etc.)   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ 2. WORK DEDUPLICATION (NEW)                        │
│    "Have we seen this exact sword before?"         │
│    └── Check image hashes + measurements           │
│    └── If match: link to existing work record      │
│    └── If new: create new work record              │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ 3. APPEARANCE LOGGING (NEW)                        │
│    "Record this market appearance"                 │
│    └── Dealer, date, price, URL, status           │
│    └── Builds provenance chain automatically      │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ 4. INDEX UPDATE (NEW)                              │
│    "Update aggregate statistics"                   │
│    └── Price index by smith/grade/period          │
│    └── Rarity metrics                             │
│    └── Market trends                              │
└─────────────────────────────────────────────────────┘
```

### Data Flow: Yuhinkai → Nihontowatch

```
User views listing on Nihontowatch
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ ENRICHED DISPLAY                                    │
│                                                     │
│ "Katana by Kotetsu"                                │
│  ├── Artisan: Kotetsu (KOT001)                    │
│  ├── Known works in registry: 847                  │
│  ├── This work: First seen 2019, Aoi Art          │
│  ├── Previous price: ¥12,500,000 (2019)           │
│  ├── Current ask: ¥15,800,000 (+26%)              │
│  ├── Comparable Juyo Kotetsu: ¥14-18M range       │
│  └── Rarity: 3.2 Juyo works/year appear           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## What This Enables

### 1. Cross-Dealer Work Tracking

The same sword moves through the market:

```
WORK: YUH-2019-04821
Artisan: Kotetsu (KOT001)
Type: Katana
Certification: Juyo Token, Session 47

MARKET HISTORY:
────────────────
2019-03  Aoi Art          ¥12,500,000  SOLD
2021-08  Private collection    -        -
2024-01  Ginza Seikodo    ¥15,800,000  SOLD
2024-11  [Current owner]       -        -

PROVENANCE CHAIN: Automatically built from appearances
```

**Why this matters:**
- Collectors can verify a sword's history
- Price appreciation/depreciation visible
- Authentication support (has this sword been seen before?)
- Dealers can't misrepresent provenance

### 2. Comprehensive Price Index

```
SMITH: Nagamitsu (Bizen Osafune)
CODE: NAG012
────────────────────────────────────────────────────────

PRICE HISTORY (2019-2024)
                     Works    Median        Range
Tokubetsu Juyo         2    ¥85,000,000   ¥72M-¥98M
Juyo                  14    ¥28,500,000   ¥18M-¥45M
Tokubetsu Hozon       31    ¥6,200,000    ¥3.5M-¥12M
Hozon                 47    ¥2,800,000    ¥1.2M-¥5.5M

TREND: +15% over 5 years (above Bizen average of +11%)

LIQUIDITY: High (18.8 works/year appearing)

COMPARABLE SMITHS:
├── Kanemitsu: Similar price tier, higher volume
├── Mitsutada: 40% premium, lower volume
└── Motoshige: 20% discount, similar volume
```

**Why this matters:**
- No such index exists for nihonto
- Collectors currently rely on dealer anecdotes
- Enables informed purchasing decisions
- Insurance/appraisal use case

### 3. Living Catalogue Raisonné

Every smith automatically gets a catalogue of known works:

```
CATALOGUE: Masamune (MAS590)
═══════════════════════════════════════════════════════

STATISTICS (from verified appearances)
──────────────────────────────────────
Total works documented: 127
├── Tokubetsu Juyo: 8
├── Juyo: 34
├── Tokubetsu Hozon: 42
├── Hozon: 38
└── Other/Uncertified: 5

Blade types: Katana (67), Tanto (45), Wakizashi (15)
Active period: Kamakura (1288-1328)

SCHOLARLY CONTEXT (from reference materials)
──────────────────────────────────────────────
[Synthesized biography with citations]
[Technical characteristics with sources]
[Critical reception and historical rankings]

CATALOGUE ENTRIES
─────────────────
YUH-2018-00234  Katana, Juyo #34
                Nagasa: 70.3cm, Sori: 1.8cm
                Last seen: Aoi Art, 2023, ¥45,000,000

YUH-2019-00891  Tanto, Tokubetsu Juyo
                Nagasa: 24.1cm
                Last seen: Christie's NY, 2022, ¥180,000,000

[... 125 more entries ...]
```

**Why this matters:**
- Traditional catalogues are static, expensive, rare
- This updates in real-time
- Includes market data (unprecedented)
- Available to all collectors, not just institutions

### 4. Authentication Support

```
WORK LOOKUP
═══════════

Input: [Image upload] + Measurements: 70.3cm nagasa, 1.8cm sori

MATCH FOUND
───────────
Confidence: 94%

Matches: YUH-2019-03421
├── Artisan: Sukehiro (SUK023)
├── Certification: Juyo Token, Session 52
├── Last seen: Touken Komachi, 2019
├── Price then: ¥8,200,000
└── Status: Sold

CURRENT LISTING ANALYSIS:
├── Current ask: ¥12,500,000
├── Price increase: +52% over 5 years
├── Comparable Juyo Sukehiro: ¥9-14M
└── Assessment: Within market range

⚠️ NOTE: Same work, confirmed by image hash + measurements
```

### 5. Market Intelligence

```
MARKET REPORT: Q4 2024
══════════════════════

OVERALL ACTIVITY
────────────────
New listings: 1,247
Sales confirmed: 892
Sell-through rate: 71.5%
Average days to sale: 34

TOP PERFORMING SCHOOLS (by price appreciation)
──────────────────────────────────────────────
1. Hizen-to       +22% YoY
2. Soshu-den      +18% YoY
3. Satsuma        +15% YoY
4. Bizen          +11% YoY
5. Mino           -3% YoY (declining)

NOTABLE SALES
─────────────
• Masamune tanto, Tokuju: ¥185,000,000 (record)
• Kotetsu katana, Juyo: ¥18,500,000 (above median)
• Kiyomaro wakizashi, Tokuho: ¥12,000,000 (strong)

SUPPLY TRENDS
─────────────
Juyo blades appearing: -12% vs last year (tightening)
Tosogu volume: +8% (increasing supply)
```

---

## Image Handling (Copyright-Safe Approach)

We do NOT need to host dealer images. Three complementary approaches:

### Approach 1: Perceptual Hashing

Store fingerprints for matching, not images:

```typescript
interface WorkImageSignature {
  // Perceptual hashes (for matching)
  pHash: string;          // Perceptual hash
  dHash: string;          // Difference hash
  aHash: string;          // Average hash

  // Color profile
  dominantColors: string[];

  // We can match images WITHOUT storing them
}
```

**Benefits:**
- Same sword recognized across dealers
- No copyright issues (we don't host images)
- Privacy-preserving

### Approach 2: Measurement Fingerprint

Unique combination of physical attributes:

```typescript
interface MeasurementFingerprint {
  // Normalized measurements (within tolerance)
  nagasa: number;         // ±0.1cm tolerance
  sori: number;           // ±0.05cm tolerance
  motohaba: number;
  sakihaba: number;
  kasane: number;

  // Combined with certification = very high confidence
  certOrg?: string;
  certGrade?: string;
  certSession?: string;
}
```

**Benefits:**
- Works even without images
- NBTHK papers + measurements = near-certain match
- Historical data (before our image collection) still matchable

### Approach 3: Reduced Resolution Reference (Optional)

If images needed for reference:

```typescript
interface WorkThumbnail {
  thumbnail: string;      // 200px max, heavily compressed
  watermark: string;      // "Source: {dealer}"
  sourceUrl: string;      // Always link back
  capturedDate: Date;

  // Clear attribution
  attribution: string;    // "Image courtesy of Aoi Art"
}
```

**Benefits:**
- Visual reference for verification
- Clear attribution protects relationships
- Low resolution = not commercially useful

---

## Database Schema

### New Tables for Yuhinkai Registry

```sql
-- ============================================
-- WORKS: Every sword we've ever documented
-- ============================================
CREATE TABLE works (
  id TEXT PRIMARY KEY,                    -- 'YUH-2024-00847'

  -- Link to artisan
  artisan_id TEXT REFERENCES artisans(id),
  artisan_confidence TEXT,                -- 'high', 'medium', 'low'

  -- Identity signatures (for deduplication)
  measurement_hash TEXT,                  -- Hash of normalized measurements
  image_signatures JSONB,                 -- Array of perceptual hashes

  -- Physical description
  item_type TEXT,                         -- 'katana', 'wakizashi', etc.
  mei TEXT,                               -- Original signature
  mei_romaji TEXT,
  mei_type TEXT,                          -- 'zaimei', 'mumei', 'orikaeshi', etc.

  -- Measurements
  nagasa_cm NUMERIC(5,2),
  sori_cm NUMERIC(4,2),
  motohaba_cm NUMERIC(4,2),
  sakihaba_cm NUMERIC(4,2),
  kasane_cm NUMERIC(4,2),

  -- Current certification (most recent known)
  cert_org TEXT,
  cert_grade TEXT,
  cert_session TEXT,

  -- Tracking
  first_recorded_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  appearance_count INT DEFAULT 1,

  -- Deduplication confidence
  dedup_confidence NUMERIC(3,2),          -- 0.00-1.00
  dedup_method TEXT,                      -- 'image_hash', 'measurement', 'cert_match'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORK_APPEARANCES: Market history per work
-- ============================================
CREATE TABLE work_appearances (
  id SERIAL PRIMARY KEY,
  work_id TEXT REFERENCES works(id) ON DELETE CASCADE,

  -- Source
  source_type TEXT NOT NULL,              -- 'nihontowatch', 'auction', 'manual'
  listing_id UUID,                        -- Link to listings table if applicable
  dealer_id UUID REFERENCES dealers(id),
  auction_house TEXT,                     -- For auction records

  -- When
  appeared_at DATE NOT NULL,

  -- Price
  price_value NUMERIC(12,2),
  price_currency TEXT DEFAULT 'JPY',
  price_jpy NUMERIC(12,2),                -- Normalized to JPY

  -- Outcome
  status TEXT,                            -- 'available', 'sold', 'withdrawn'
  sold_at DATE,
  days_on_market INT,

  -- Attribution (always credit source)
  source_url TEXT,
  source_dealer_name TEXT,

  -- Metadata
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(work_id, source_type, appeared_at, dealer_id)
);

-- ============================================
-- PRICE_INDEX: Aggregated market statistics
-- ============================================
CREATE TABLE price_index (
  id SERIAL PRIMARY KEY,

  -- Dimensions
  artisan_id TEXT REFERENCES artisans(id),
  school TEXT,
  province TEXT,
  era TEXT,
  cert_grade TEXT,
  item_type TEXT,
  period TEXT,                            -- '2024-Q1', '2024', etc.

  -- Metrics
  works_appeared INT,
  works_sold INT,
  sell_through_rate NUMERIC(4,2),

  -- Price stats (in JPY)
  min_price NUMERIC(12,2),
  max_price NUMERIC(12,2),
  median_price NUMERIC(12,2),
  avg_price NUMERIC(12,2),

  -- Trends
  prev_period_median NUMERIC(12,2),
  price_change_pct NUMERIC(5,2),

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(artisan_id, cert_grade, item_type, period)
);

-- ============================================
-- WORK_IMAGES: Image signatures (not actual images)
-- ============================================
CREATE TABLE work_image_signatures (
  id SERIAL PRIMARY KEY,
  work_id TEXT REFERENCES works(id) ON DELETE CASCADE,

  -- Perceptual hashes
  phash TEXT,
  dhash TEXT,
  ahash TEXT,

  -- Source (for attribution)
  source_url TEXT,
  source_dealer TEXT,
  captured_at TIMESTAMPTZ,

  UNIQUE(work_id, phash)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_works_artisan ON works(artisan_id);
CREATE INDEX idx_works_measurement_hash ON works(measurement_hash);
CREATE INDEX idx_works_cert ON works(cert_org, cert_grade, cert_session);
CREATE INDEX idx_appearances_work ON work_appearances(work_id);
CREATE INDEX idx_appearances_dealer ON work_appearances(dealer_id);
CREATE INDEX idx_appearances_date ON work_appearances(appeared_at);
CREATE INDEX idx_price_index_artisan ON price_index(artisan_id);
CREATE INDEX idx_price_index_period ON price_index(period);
CREATE INDEX idx_image_sigs_phash ON work_image_signatures(phash);
```

---

## Monetization Strategy

### Tier Structure

| Tier | Price | Registry Access |
|------|-------|-----------------|
| **Free** | $0 | Browse works exist (no prices) |
| **Enthusiast** | $25/mo | Basic price ranges, 90-day delay |
| **Connoisseur** | $200/mo | Full history, real-time, provenance lookup |
| **Dealer** | $300/mo | API access, comparables, market reports |
| **Institutional** | Custom | Research partnerships, bulk data |

### Feature Matrix

| Feature | Free | Enthusiast | Connoisseur | Dealer |
|---------|------|------------|-------------|--------|
| Browse current listings | ✓ | ✓ | ✓ | ✓ |
| See work exists in registry | ✓ | ✓ | ✓ | ✓ |
| View price history | - | 90-day delay | Real-time | Real-time |
| Provenance lookup | - | - | ✓ | ✓ |
| Work alerts | - | Limited | Unlimited | Unlimited |
| Price comparables | - | - | ✓ | ✓ |
| Market reports | - | - | Quarterly | Monthly |
| API access | - | - | - | ✓ |
| Bulk data export | - | - | - | ✓ |

### Revenue Projections

Conservative estimates based on ~2,000 active collectors globally:

```
SCENARIO: Year 2 (post-launch)
──────────────────────────────
Free users:           1,000 (awareness building)
Enthusiast ($25):       300 × $25  = $7,500/mo
Connoisseur ($200):      50 × $200 = $10,000/mo
Dealer ($300):           20 × $300 = $6,000/mo
────────────────────────────────────────────────
Monthly recurring:                   $23,500/mo
Annual recurring:                    $282,000/yr
```

---

## Competitive Moat

### Why This Is Defensible

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPETITIVE ADVANTAGES                       │
│                                                                 │
│  1. DATA COMPOUNDS OVER TIME                                   │
│     ─────────────────────────                                  │
│     • Every day of scraping = more history                     │
│     • 5 years of data exponentially more valuable than 1       │
│     • Historical prices cannot be scraped retroactively        │
│     • First-mover advantage is permanent                       │
│                                                                 │
│  2. NETWORK EFFECTS                                            │
│     ───────────────                                            │
│     • More collectors → more provenance shared                 │
│     • More dealers want listing → more data                    │
│     • More data → more valuable → more users                   │
│                                                                 │
│  3. INSTITUTIONAL KNOWLEDGE                                    │
│     ───────────────────────                                    │
│     • Yuhinkai artisan database is comprehensive              │
│     • Cross-references impossible to recreate quickly          │
│     • Artisan matching improves over time                      │
│                                                                 │
│  4. BECOMES THE REFERENCE                                      │
│     ────────────────────────                                   │
│     • "Check Yuhinkai" becomes standard practice               │
│     • Like "check Artnet" for paintings                        │
│     • Self-reinforcing authority                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Comparison to Art Market Analogues

| Service | Market | Our Equivalent |
|---------|--------|----------------|
| Artnet | Fine art prices | Price Index |
| Getty Provenance Index | Ownership history | Work Appearances |
| Catalogue Raisonné | Complete artist works | Artist Profiles |
| Blouin Art Sales | Auction results | Market Reports |

**Key difference:** These are separate services in the art world. We integrate all four.

---

## Partnership Opportunities

### Potential Partners

| Partner Type | Value Exchange |
|--------------|----------------|
| **NBTHK** | Official data partner; we get certification data, they get market intelligence |
| **Auction Houses** | Pre-sale comparables; they get exposure, we get auction data |
| **Museums** | Research access; academic credibility for us, data for them |
| **Insurance Companies** | Valuation database; they need pricing, we need revenue |
| **Dealers** | Enhanced listings; they get analytics, we get priority data |

### NBTHK Partnership (Dream Scenario)

```
POTENTIAL COLLABORATION
───────────────────────

We provide:
• Market analytics on certified works
• Price trends by certification grade
• Collector behavior data (anonymized)
• International market visibility

They provide:
• Official certification database access
• Setsumei text for all certified works
• New certification announcements
• Legitimacy and endorsement

Result: Yuhinkai becomes the OFFICIAL market registry
```

---

## Implementation Roadmap

### Phase 1: Foundation (Current → +3 months)

- [ ] Add `works` table to database
- [ ] Implement work creation on listing scrape
- [ ] Basic deduplication (measurement fingerprint)
- [ ] Link existing listings to works
- [ ] Create work appearance logging

### Phase 2: Matching (Months 3-6)

- [ ] Implement perceptual image hashing
- [ ] Build deduplication pipeline
- [ ] Create confidence scoring system
- [ ] Manual review interface for uncertain matches
- [ ] Historical backfill of existing data

### Phase 3: Intelligence (Months 6-9)

- [ ] Build price index calculation jobs
- [ ] Create artist profile generation (DB-driven stats)
- [ ] Implement market trend analysis
- [ ] Build provenance display UI
- [ ] Create comparables API

### Phase 4: Monetization (Months 9-12)

- [ ] Build gated access to registry features
- [ ] Create dealer API tier
- [ ] Implement institutional access
- [ ] Launch market reports
- [ ] Pursue NBTHK partnership discussions

---

## Technical Challenges

### The Deduplication Problem

Recognizing the same sword across appearances is the hardest problem:

```typescript
interface DeduplicationSignals {
  // Strong signals (any one is near-certain)
  certSessionExactMatch: boolean;    // Same NBTHK papers
  imageHashExactMatch: boolean;      // Identical images

  // Supporting signals (combination increases confidence)
  measurementMatch: number;          // 0-1, within tolerances
  meiMatch: boolean;                 // Same signature
  imageHashSimilar: number;          // 0-1, perceptual similarity
  dealerProximity: boolean;          // Known reseller pattern
  timeGap: number;                   // Months between appearances

  // Computed confidence
  overallConfidence: number;         // 0-1
  recommendedAction: 'auto_merge' | 'manual_review' | 'separate';
}

function calculateDeduplicationConfidence(signals: DeduplicationSignals): number {
  // Certain matches
  if (signals.certSessionExactMatch) return 0.99;
  if (signals.imageHashExactMatch) return 0.98;

  // Probabilistic combination
  let confidence = 0;

  if (signals.measurementMatch > 0.95) confidence += 0.4;
  if (signals.meiMatch) confidence += 0.2;
  if (signals.imageHashSimilar > 0.85) confidence += 0.3;
  if (signals.dealerProximity && signals.timeGap < 12) confidence += 0.1;

  return Math.min(confidence, 0.95); // Cap without certain signals
}
```

### Privacy & Ethics

| Concern | Mitigation |
|---------|------------|
| Dealer relationships | Always attribute, never scrape aggressively |
| Collector privacy | No buyer identification, aggregate only |
| Copyright | Hashes only, or low-res with attribution |
| Competition abuse | Time-delay on specific transactions |
| Data accuracy | Confidence scoring, manual review for low confidence |

---

## Conclusion

The opportunity is to transform:

**FROM:** Two useful but separate tools
- Nihontowatch: "Where can I find swords for sale?"
- Yuhinkai: "Who made this sword?"

**TO:** An integrated ecosystem that is THE reference
- "What is this sword's complete market history?"
- "What should I pay for a Juyo Kotetsu?"
- "How rare are works by this smith?"
- "Is this a fair price?"

The data we're already collecting—every listing, every price, every sale—becomes exponentially more valuable when treated as a **permanent historical registry** rather than ephemeral search results.

**The moat is time.** Every day we collect data that cannot be retrieved retroactively. Start now, and in 5 years we have an irreplaceable asset.

---

## Appendix: Reference Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       COMPLETE DATA FLOW                            │
│                                                                     │
│  OSHI-SCRAPPER                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Scrape → Extract → Match Artisan → Create/Update Work     │   │
│  │                         │                    │               │   │
│  │                         ▼                    ▼               │   │
│  │               ┌─────────────────┐  ┌─────────────────┐      │   │
│  │               │    artisans     │  │     works       │      │   │
│  │               │    (Yuhinkai)   │  │   (Registry)    │      │   │
│  │               └─────────────────┘  └────────┬────────┘      │   │
│  │                                             │                │   │
│  │                                             ▼                │   │
│  │                                   ┌─────────────────┐       │   │
│  │                                   │  appearances    │       │   │
│  │                                   └────────┬────────┘       │   │
│  │                                            │                 │   │
│  └────────────────────────────────────────────┼─────────────────┘   │
│                                               │                     │
│  ANALYTICS JOBS                               │                     │
│  ┌────────────────────────────────────────────┼─────────────────┐   │
│  │  Daily: Aggregate prices → price_index     │                 │   │
│  │  Weekly: Calculate trends                  │                 │   │
│  │  Monthly: Generate market reports          ▼                 │   │
│  │                                   ┌─────────────────┐       │   │
│  │                                   │  price_index    │       │   │
│  │                                   └─────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  NIHONTOWATCH                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Browse ◄── listings + works + appearances + price_index    │  │
│  │  Artist Profile ◄── artisans + works + price_index          │  │
│  │  Work History ◄── works + appearances                        │  │
│  │  Market Reports ◄── price_index + trends                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
