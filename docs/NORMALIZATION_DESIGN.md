# Metadata Field Normalization Design

## Overview

This document describes a modular normalization system for deriving clean, consistent metadata fields from raw LLM-extracted data. The design prioritizes **accuracy over completeness** - we prefer `null` over incorrect values.

## Core Principles

1. **Derivation, not replacement** - Create new derived fields from existing raw fields
2. **Preserve raw data** - Never modify original LLM-extracted values
3. **Idempotent** - Running normalization multiple times produces identical results
4. **Fail-safe** - Unknown values produce `null`, not guesses
5. **Modular** - Each normalizer is independent and testable
6. **Dual-use** - Same logic for backfill AND ongoing scrapes

---

## Field Definitions

### Signature Fields

**Problem:** The `mei_type` field conflates signature presence with signature type.

**Solution:** Derive two new fields:

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `signature_status` | enum | `signed`, `unsigned` | Binary: does it have a signature? |
| `signature_detail` | enum | `original`, `kinzogan`, `orikaeshi`, `gaku`, `shu`, `gimei`, null | How the signature appears |

**Derivation Logic:**

```
mei_type                  → signature_status  signature_detail
─────────────────────────────────────────────────────────────
mei, signed, 銘           → signed            original
mumei, unsigned, 無銘     → unsigned          null
kinzogan-mei, 金象嵌銘    → unsigned          kinzogan    ¹
orikaeshi-mei, 折返銘     → signed            orikaeshi   ²
gaku-mei, 額銘            → signed            gaku        ³
shu-mei, 朱銘             → unsigned          shu         ⁴
gimei, 偽銘               → signed            gimei       ⁵
suriage-mumei             → unsigned          null
den, 伝                   → unsigned          null
ubu, 生ぶ                 → null              null        ⁶
(unknown/other)           → null              null
```

**Notes:**
1. **kinzogan**: Gold inlay attribution added later by appraiser. Blade is unsigned.
2. **orikaeshi**: Original signature preserved by folding tang when shortened. Signed.
3. **gaku**: Original signature preserved in frame when tang shortened. Signed.
4. **shu**: Red lacquer attribution. Blade is unsigned.
5. **gimei**: False/fake signature. Physically signed but fraudulent.
6. **ubu**: Tang condition (unshortened), NOT a signature type. Data error - ignore.

**Edge Case - gimei:**
A gimei blade physically HAS a signature carved on it, but it's fake. We mark it as `signed` because:
- Users filtering "unsigned" want blades with NO signature marks
- Users can further filter `signature_detail != 'gimei'` for genuine signatures
- This is more accurate to physical reality

---

### Era/Period Fields

**Problem:** The `era` field mixes sword classification periods with historical periods.

**Solution:** Derive two new fields (with item-type awareness):

| Field | Type | Applies To | Values |
|-------|------|------------|--------|
| `sword_period` | enum | Blades only | `Koto`, `Shinto`, `Shin-shinto`, `Gendaito` |
| `historical_period` | enum | All items | `Heian`, `Kamakura`, `Nanbokucho`, `Muromachi`, `Momoyama`, `Edo`, `Meiji`, `Taisho`, `Showa`, `Heisei`, `Reiwa` |

**Key Insight:** Sword periods and historical periods are related but NOT 1:1:

```
Sword Period    Year Range      Historical Periods (overlap)
────────────────────────────────────────────────────────────
Koto            before 1596     Heian, Kamakura, Nanbokucho, Muromachi, early Momoyama
Shinto          1596-1780       late Momoyama, early-mid Edo
Shin-shinto     1780-1876       late Edo, early Meiji
Gendaito        1876+           late Meiji, Taisho, Showa, Heisei, Reiwa
```

**Derivation Logic:**

```
Raw era                   → sword_period    historical_period
─────────────────────────────────────────────────────────────
# Explicit sword periods (keep, can't derive historical)
Koto, 古刀                → Koto            null
Shinto, 新刀              → Shinto          null
Shin-shinto, 新々刀       → Shin-shinto     null
Gendaito, 現代刀          → Gendaito        null

# Historical periods → derive sword period when UNAMBIGUOUS
Heian, 平安               → Koto            Heian
Kamakura, 鎌倉            → Koto            Kamakura
Nanbokucho, 南北朝        → Koto            Nanbokucho
Muromachi, 室町           → Koto            Muromachi         ¹

# Ambiguous periods → DON'T derive sword period (accuracy > completeness)
Momoyama, 桃山            → null            Momoyama          ²
Edo, 江戸                 → null            Edo               ³
Meiji, 明治               → null            Meiji             ⁴

# Late periods → can derive sword period
Taisho, 大正              → Gendaito        Taisho
Showa, 昭和               → Gendaito        Showa
Heisei, 平成              → Gendaito        Heisei
Reiwa, 令和               → Gendaito        Reiwa
```

**Notes:**
1. Muromachi ends 1573, entirely within Koto period (before 1596)
2. Momoyama (1573-1603) spans Koto/Shinto boundary (1596)
3. Edo (1603-1868) spans Shinto/Shin-shinto boundary (1780)
4. Meiji (1868-1912) spans Shin-shinto/Gendaito boundary (1876)

**Tosogu Handling:**
- Tosogu items get `sword_period = null` (not applicable)
- Tosogu items derive `historical_period` from `tosogu_era` field

---

## Architecture

### Module Structure (Oshi-scrapper)

```
normalization/
├── __init__.py
├── pipeline.py                 # Orchestrator (existing, extended)
├── normalizers/
│   ├── __init__.py             # Export all normalizers
│   ├── text.py                 # Existing - text cleanup
│   ├── names.py                # Existing - province/school/smith
│   ├── measurements.py         # Existing - unit conversion
│   ├── prices.py               # Existing - price cleanup
│   ├── urls.py                 # Existing - URL normalization
│   ├── signature.py            # NEW - signature_status, signature_detail
│   └── era.py                  # NEW - sword_period, historical_period
├── mappings/
│   ├── provinces.json          # Existing
│   ├── schools.json            # Existing
│   ├── smiths.json             # Existing
│   ├── eras.json               # Existing
│   ├── signature_mappings.json # NEW - mei_type → derived fields
│   └── period_mappings.json    # NEW - era → derived fields
└── tests/
    ├── test_signature.py       # NEW
    └── test_era.py             # NEW
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM Extraction                           │
│    (raw values: mei_type="kinzogan-mei", era="Kamakura")       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Normalization Pipeline                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. TextNormalizer     - Clean whitespace, unicode        │  │
│  │ 2. URLNormalizer      - Normalize URLs                   │  │
│  │ 3. NameNormalizer     - Province/school/smith cleanup    │  │
│  │ 4. MeasurementNorm.   - Unit conversion                  │  │
│  │ 5. PriceNormalizer    - Currency cleanup                 │  │
│  │ 6. SignatureNormalizer - DERIVE signature_status/detail  │  │
│  │ 7. EraNormalizer      - DERIVE sword_period/historical   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database (Supabase)                         │
│   Raw fields preserved:  mei_type, era, tosogu_era             │
│   Derived fields added:  signature_status, signature_detail,   │
│                          sword_period, historical_period        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Columns

```sql
-- Add derived columns
ALTER TABLE listings ADD COLUMN IF NOT EXISTS signature_status TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS signature_detail TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sword_period TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS historical_period TEXT;

-- Add constraints to enforce valid values
ALTER TABLE listings ADD CONSTRAINT chk_signature_status
  CHECK (signature_status IS NULL OR signature_status IN ('signed', 'unsigned'));

ALTER TABLE listings ADD CONSTRAINT chk_signature_detail
  CHECK (signature_detail IS NULL OR signature_detail IN
    ('original', 'kinzogan', 'orikaeshi', 'gaku', 'shu', 'gimei'));

ALTER TABLE listings ADD CONSTRAINT chk_sword_period
  CHECK (sword_period IS NULL OR sword_period IN
    ('Koto', 'Shinto', 'Shin-shinto', 'Gendaito'));

ALTER TABLE listings ADD CONSTRAINT chk_historical_period
  CHECK (historical_period IS NULL OR historical_period IN
    ('Heian', 'Kamakura', 'Nanbokucho', 'Muromachi', 'Momoyama',
     'Edo', 'Meiji', 'Taisho', 'Showa', 'Heisei', 'Reiwa'));

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_listings_signature_status ON listings(signature_status);
CREATE INDEX IF NOT EXISTS idx_listings_sword_period ON listings(sword_period);
CREATE INDEX IF NOT EXISTS idx_listings_historical_period ON listings(historical_period);

-- Comment columns for documentation
COMMENT ON COLUMN listings.signature_status IS 'Derived: signed/unsigned from mei_type';
COMMENT ON COLUMN listings.signature_detail IS 'Derived: signature type from mei_type';
COMMENT ON COLUMN listings.sword_period IS 'Derived: Koto/Shinto/Shin-shinto/Gendaito (blades only)';
COMMENT ON COLUMN listings.historical_period IS 'Derived: historical period from era/tosogu_era';
```

---

## Implementation Details

### SignatureNormalizer (signature.py)

```python
"""Signature field normalizer - derives signature_status and signature_detail."""

from dataclasses import dataclass
from typing import Optional, Tuple
import json
from pathlib import Path


@dataclass
class SignatureResult:
    """Result of signature normalization."""
    status: Optional[str]   # 'signed' or 'unsigned'
    detail: Optional[str]   # 'original', 'kinzogan', etc.
    confidence: float       # 0.0-1.0


class SignatureNormalizer:
    """
    Derives signature_status and signature_detail from mei_type.

    Design principles:
    - Accuracy over completeness: unknown → null
    - Preserve original mei_type (read-only)
    - Idempotent: same input → same output
    """

    # Mapping: mei_type variants → (status, detail)
    SIGNATURE_MAP = {
        # Signed with original signature
        'mei': ('signed', 'original'),
        'signed': ('signed', 'original'),
        '銘': ('signed', 'original'),

        # Unsigned - no signature
        'mumei': ('unsigned', None),
        'unsigned': ('unsigned', None),
        '無銘': ('unsigned', None),

        # Attribution signatures (blade is unsigned)
        'kinzogan-mei': ('unsigned', 'kinzogan'),
        'kinzogan mei': ('unsigned', 'kinzogan'),
        'kinzogan': ('unsigned', 'kinzogan'),
        '金象嵌銘': ('unsigned', 'kinzogan'),
        '金象嵌': ('unsigned', 'kinzogan'),

        'shu-mei': ('unsigned', 'shu'),
        'shu mei': ('unsigned', 'shu'),
        '朱銘': ('unsigned', 'shu'),

        # Preserved original signatures
        'orikaeshi-mei': ('signed', 'orikaeshi'),
        'orikaeshi mei': ('signed', 'orikaeshi'),
        'orikaeshi': ('signed', 'orikaeshi'),
        '折返銘': ('signed', 'orikaeshi'),

        'gaku-mei': ('signed', 'gaku'),
        'gaku mei': ('signed', 'gaku'),
        'gaku': ('signed', 'gaku'),
        '額銘': ('signed', 'gaku'),

        # Fake signature - physically present but fraudulent
        'gimei': ('signed', 'gimei'),
        'false signature': ('signed', 'gimei'),
        '偽銘': ('signed', 'gimei'),

        # Shortened, signature lost
        'suriage-mumei': ('unsigned', None),
        'suriage mumei': ('unsigned', None),
        '磨上無銘': ('unsigned', None),

        # Attributed (unsigned)
        'den': ('unsigned', None),
        '伝': ('unsigned', None),
        'attributed': ('unsigned', None),

        # Tang condition - NOT a signature type (data error, ignore)
        'ubu': (None, None),
        '生ぶ': (None, None),
        'suriage': (None, None),  # Just tang condition
        '磨上': (None, None),
    }

    def __init__(self, mappings_path: Optional[Path] = None):
        """
        Initialize with optional external mappings file.

        External mappings override built-in for extensibility.
        """
        self.mappings = dict(self.SIGNATURE_MAP)

        if mappings_path and mappings_path.exists():
            with open(mappings_path, encoding='utf-8') as f:
                external = json.load(f)
                for key, value in external.items():
                    self.mappings[key.lower()] = tuple(value)

    def normalize(self, mei_type: Optional[str]) -> SignatureResult:
        """
        Derive signature_status and signature_detail from mei_type.

        Args:
            mei_type: Raw mei_type value from LLM extraction

        Returns:
            SignatureResult with status, detail, and confidence
        """
        if not mei_type:
            return SignatureResult(status=None, detail=None, confidence=0.0)

        # Normalize for lookup
        key = mei_type.strip().lower()

        # Handle compound types (e.g., "mumei (den Masamune)")
        # Take the first part before parenthesis
        if '(' in key:
            key = key.split('(')[0].strip()

        if key in self.mappings:
            status, detail = self.mappings[key]
            return SignatureResult(
                status=status,
                detail=detail,
                confidence=1.0 if status else 0.0
            )

        # Unknown - fail safe to null
        return SignatureResult(status=None, detail=None, confidence=0.0)
```

### EraNormalizer (era.py)

```python
"""Era/period normalizer - derives sword_period and historical_period."""

from dataclasses import dataclass
from typing import Optional, Tuple
import json
from pathlib import Path


@dataclass
class EraResult:
    """Result of era normalization."""
    sword_period: Optional[str]       # Koto/Shinto/Shin-shinto/Gendaito
    historical_period: Optional[str]  # Kamakura/Edo/Meiji/etc.
    confidence: float


class EraNormalizer:
    """
    Derives sword_period and historical_period from era.

    Design principles:
    - Accuracy over completeness: ambiguous → null
    - Tosogu get only historical_period (no sword_period)
    - Same logic for both blades and tosogu
    """

    # Sword periods (classification system)
    SWORD_PERIODS = {'Koto', 'Shinto', 'Shin-shinto', 'Gendaito'}

    # Historical periods
    HISTORICAL_PERIODS = {
        'Heian', 'Kamakura', 'Nanbokucho', 'Muromachi', 'Momoyama',
        'Edo', 'Meiji', 'Taisho', 'Showa', 'Heisei', 'Reiwa'
    }

    # Mapping: era variants → (sword_period, historical_period)
    # null means "can't determine" (accuracy over completeness)
    ERA_MAP = {
        # Explicit sword periods → keep, can't derive historical
        'koto': ('Koto', None),
        '古刀': ('Koto', None),
        'old sword': ('Koto', None),

        'shinto': ('Shinto', None),
        '新刀': ('Shinto', None),
        'new sword': ('Shinto', None),

        'shin-shinto': ('Shin-shinto', None),
        'shinshinto': ('Shin-shinto', None),
        '新々刀': ('Shin-shinto', None),
        '新新刀': ('Shin-shinto', None),

        'gendaito': ('Gendaito', None),
        'gendai': ('Gendaito', None),
        '現代刀': ('Gendaito', None),
        'modern': ('Gendaito', None),

        # Historical periods → derive sword period when UNAMBIGUOUS
        'heian': ('Koto', 'Heian'),
        '平安': ('Koto', 'Heian'),
        '平安時代': ('Koto', 'Heian'),

        'kamakura': ('Koto', 'Kamakura'),
        '鎌倉': ('Koto', 'Kamakura'),
        '鎌倉時代': ('Koto', 'Kamakura'),

        'nanbokucho': ('Koto', 'Nanbokucho'),
        'nanboku-cho': ('Koto', 'Nanbokucho'),
        '南北朝': ('Koto', 'Nanbokucho'),

        'muromachi': ('Koto', 'Muromachi'),  # Ends 1573, all Koto
        '室町': ('Koto', 'Muromachi'),
        '室町時代': ('Koto', 'Muromachi'),

        # AMBIGUOUS - can't determine sword period
        'momoyama': (None, 'Momoyama'),  # Spans Koto/Shinto (1596)
        '桃山': (None, 'Momoyama'),
        'azuchi-momoyama': (None, 'Momoyama'),
        '安土桃山': (None, 'Momoyama'),

        'edo': (None, 'Edo'),  # Spans Shinto/Shin-shinto (1780)
        '江戸': (None, 'Edo'),
        '江戸時代': (None, 'Edo'),
        'tokugawa': (None, 'Edo'),

        'meiji': (None, 'Meiji'),  # Spans Shin-shinto/Gendaito (1876)
        '明治': (None, 'Meiji'),
        '明治時代': (None, 'Meiji'),

        # Unambiguous late periods → can derive sword period
        'taisho': ('Gendaito', 'Taisho'),
        '大正': ('Gendaito', 'Taisho'),

        'showa': ('Gendaito', 'Showa'),
        '昭和': ('Gendaito', 'Showa'),

        'heisei': ('Gendaito', 'Heisei'),
        '平成': ('Gendaito', 'Heisei'),

        'reiwa': ('Gendaito', 'Reiwa'),
        '令和': ('Gendaito', 'Reiwa'),

        # Sub-periods (map to parent)
        'early kamakura': ('Koto', 'Kamakura'),
        'mid kamakura': ('Koto', 'Kamakura'),
        'late kamakura': ('Koto', 'Kamakura'),

        'early muromachi': ('Koto', 'Muromachi'),
        'mid muromachi': ('Koto', 'Muromachi'),
        'late muromachi': ('Koto', 'Muromachi'),
        'sengoku': ('Koto', 'Muromachi'),

        'early edo': (None, 'Edo'),  # Still ambiguous
        'mid edo': (None, 'Edo'),
        'late edo': (None, 'Edo'),
        'bakumatsu': (None, 'Edo'),
        '幕末': (None, 'Edo'),

        # Special sword period sub-types
        'sue-koto': ('Koto', None),
        '末古刀': ('Koto', None),

        'kanbun shinto': ('Shinto', 'Edo'),
        '寛文新刀': ('Shinto', 'Edo'),
        'genroku': ('Shinto', 'Edo'),
        '元禄': ('Shinto', 'Edo'),
    }

    def __init__(self, mappings_path: Optional[Path] = None):
        self.mappings = dict(self.ERA_MAP)

        if mappings_path and mappings_path.exists():
            with open(mappings_path, encoding='utf-8') as f:
                external = json.load(f)
                for key, value in external.items():
                    self.mappings[key.lower()] = tuple(value)

    def normalize(
        self,
        era: Optional[str],
        is_tosogu: bool = False
    ) -> EraResult:
        """
        Derive sword_period and historical_period from era.

        Args:
            era: Raw era value from LLM extraction
            is_tosogu: If True, sword_period will always be None

        Returns:
            EraResult with sword_period, historical_period, confidence
        """
        if not era:
            return EraResult(
                sword_period=None,
                historical_period=None,
                confidence=0.0
            )

        # Normalize for lookup
        key = era.strip().lower()

        # Handle variations like "Edo Period" → "edo"
        key = key.replace(' period', '').replace('時代', '')

        if key in self.mappings:
            sword_period, historical_period = self.mappings[key]

            # Tosogu don't have sword periods
            if is_tosogu:
                sword_period = None

            confidence = 1.0 if (sword_period or historical_period) else 0.0

            return EraResult(
                sword_period=sword_period,
                historical_period=historical_period,
                confidence=confidence
            )

        # Try to match just the canonical values (already normalized)
        key_title = era.strip().title()
        if key_title in self.SWORD_PERIODS:
            return EraResult(
                sword_period=None if is_tosogu else key_title,
                historical_period=None,
                confidence=1.0
            )
        if key_title in self.HISTORICAL_PERIODS:
            # Can't derive sword_period from just historical
            return EraResult(
                sword_period=None,
                historical_period=key_title,
                confidence=0.8  # Lower confidence for simple match
            )

        # Unknown - fail safe to null
        return EraResult(
            sword_period=None,
            historical_period=None,
            confidence=0.0
        )
```

---

## Pipeline Integration

### Updated pipeline.py

```python
# In NormalizationPipeline.__init__(), add:
from .normalizers import SignatureNormalizer, EraNormalizer

self.signature_normalizer = SignatureNormalizer(
    mappings_path=mappings_dir / 'signature_mappings.json'
)
self.era_normalizer = EraNormalizer(
    mappings_path=mappings_dir / 'period_mappings.json'
)

# In NormalizationPipeline.normalize(), add after existing normalizers:

# 6. Derive signature fields
sig_changes = self._derive_signature_fields(listing)
changes.extend(sig_changes)

# 7. Derive era/period fields
era_changes = self._derive_era_fields(listing)
changes.extend(era_changes)
```

### New Pipeline Methods

```python
def _derive_signature_fields(self, listing: ScrapedListing) -> List[FieldChange]:
    """Derive signature_status and signature_detail from mei_type."""
    changes = []

    # Get mei_type from attribution (swords) or tosogu_specs
    mei_type = None
    if listing.attribution and listing.attribution.mei_type:
        mei_type = listing.attribution.mei_type
    elif listing.tosogu_specs and listing.tosogu_specs.mei_type:
        mei_type = listing.tosogu_specs.mei_type

    if mei_type:
        result = self.signature_normalizer.normalize(mei_type)

        if result.status:
            # Store in listing (need to extend ScrapedListing model)
            old_status = getattr(listing, 'signature_status', None)
            if old_status != result.status:
                listing.signature_status = result.status
                changes.append(FieldChange(
                    field='signature_status',
                    before=old_status,
                    after=result.status,
                    normalizer='SignatureNormalizer',
                    reason=f'derived from mei_type="{mei_type}"'
                ))

        if result.detail:
            old_detail = getattr(listing, 'signature_detail', None)
            if old_detail != result.detail:
                listing.signature_detail = result.detail
                changes.append(FieldChange(
                    field='signature_detail',
                    before=old_detail,
                    after=result.detail,
                    normalizer='SignatureNormalizer',
                    reason=f'derived from mei_type="{mei_type}"'
                ))

    return changes

def _derive_era_fields(self, listing: ScrapedListing) -> List[FieldChange]:
    """Derive sword_period and historical_period from era."""
    changes = []

    # Determine if this is tosogu
    is_tosogu = listing.is_tosogu() if hasattr(listing, 'is_tosogu') else False

    # Get era from appropriate source
    era = None
    if is_tosogu and listing.tosogu_specs:
        era = listing.tosogu_specs.era
    elif listing.attribution:
        era = listing.attribution.era

    if era:
        result = self.era_normalizer.normalize(era, is_tosogu=is_tosogu)

        if result.sword_period:
            old_period = getattr(listing, 'sword_period', None)
            if old_period != result.sword_period:
                listing.sword_period = result.sword_period
                changes.append(FieldChange(
                    field='sword_period',
                    before=old_period,
                    after=result.sword_period,
                    normalizer='EraNormalizer',
                    reason=f'derived from era="{era}"'
                ))

        if result.historical_period:
            old_hist = getattr(listing, 'historical_period', None)
            if old_hist != result.historical_period:
                listing.historical_period = result.historical_period
                changes.append(FieldChange(
                    field='historical_period',
                    before=old_hist,
                    after=result.historical_period,
                    normalizer='EraNormalizer',
                    reason=f'derived from era="{era}"'
                ))

    return changes
```

---

## Model Changes (listing.py)

Add derived fields to ScrapedListing:

```python
@dataclass
class ScrapedListing:
    # ... existing fields ...

    # Derived fields (populated by normalization pipeline)
    signature_status: Optional[str] = None   # 'signed' | 'unsigned'
    signature_detail: Optional[str] = None   # 'original' | 'kinzogan' | etc.
    sword_period: Optional[str] = None       # 'Koto' | 'Shinto' | etc.
    historical_period: Optional[str] = None  # 'Kamakura' | 'Edo' | etc.
```

---

## Repository Changes (repository.py)

Update `_listing_to_db_row` to include derived fields:

```python
def _listing_to_db_row(self, listing: ScrapedListing) -> Dict[str, Any]:
    # ... existing code ...

    # Derived fields (from normalization pipeline)
    row.update({
        "signature_status": getattr(listing, 'signature_status', None),
        "signature_detail": getattr(listing, 'signature_detail', None),
        "sword_period": getattr(listing, 'sword_period', None),
        "historical_period": getattr(listing, 'historical_period', None),
    })

    return row
```

---

## Backfill Strategy

### Approach: SQL-based with Python validation

The backfill uses SQL for speed but with Python-generated mappings for consistency.

### backfill_derived_fields.py

```python
"""
Backfill script for derived metadata fields.

Usage:
    python scripts/backfill_derived_fields.py --dry-run
    python scripts/backfill_derived_fields.py --execute
"""

import argparse
from db.client import get_supabase_client
from normalization.normalizers import SignatureNormalizer, EraNormalizer


def generate_signature_sql():
    """Generate SQL CASE statement for signature_status."""
    normalizer = SignatureNormalizer()

    # Group by result
    signed_values = []
    unsigned_values = []

    for mei_type, (status, detail) in normalizer.SIGNATURE_MAP.items():
        if status == 'signed':
            signed_values.append(mei_type)
        elif status == 'unsigned':
            unsigned_values.append(mei_type)

    # Generate SQL
    signed_list = ", ".join(f"'{v}'" for v in signed_values)
    unsigned_list = ", ".join(f"'{v}'" for v in unsigned_values)

    return f"""
    UPDATE listings SET signature_status = CASE
        WHEN LOWER(mei_type) IN ({signed_list}) THEN 'signed'
        WHEN LOWER(mei_type) IN ({unsigned_list}) THEN 'unsigned'
        ELSE NULL
    END
    WHERE mei_type IS NOT NULL AND signature_status IS NULL;
    """


def backfill_with_python(batch_size=1000, dry_run=True):
    """
    Python-based backfill for full accuracy.

    Slower but uses exact same logic as ongoing normalization.
    """
    client = get_supabase_client()
    sig_norm = SignatureNormalizer()
    era_norm = EraNormalizer()

    # Fetch records needing normalization
    response = client.table("listings").select(
        "id, mei_type, era, tosogu_era, item_type"
    ).is_("signature_status", "null").limit(batch_size).execute()

    updates = []
    for row in response.data:
        update = {"id": row["id"]}

        # Signature
        if row["mei_type"]:
            sig = sig_norm.normalize(row["mei_type"])
            if sig.status:
                update["signature_status"] = sig.status
            if sig.detail:
                update["signature_detail"] = sig.detail

        # Era
        is_tosogu = row["item_type"] in (
            "Tsuba", "Menuki", "Kozuka", "Kogai",
            "Fuchi", "Kashira", "Fuchi-Kashira", "Tosogu"
        )
        era_value = row["tosogu_era"] if is_tosogu else row["era"]

        if era_value:
            era = era_norm.normalize(era_value, is_tosogu=is_tosogu)
            if era.sword_period:
                update["sword_period"] = era.sword_period
            if era.historical_period:
                update["historical_period"] = era.historical_period

        if len(update) > 1:  # Has updates beyond just id
            updates.append(update)

    if dry_run:
        print(f"Would update {len(updates)} records")
        for u in updates[:5]:
            print(f"  {u}")
        return

    # Execute updates
    for update in updates:
        id = update.pop("id")
        client.table("listings").update(update).eq("id", id).execute()

    print(f"Updated {len(updates)} records")
```

---

## Testing Strategy

### Unit Tests

```python
# tests/normalization/test_signature.py

import pytest
from normalization.normalizers.signature import SignatureNormalizer


class TestSignatureNormalizer:
    def setup_method(self):
        self.normalizer = SignatureNormalizer()

    # Core cases
    def test_mei_returns_signed_original(self):
        result = self.normalizer.normalize("mei")
        assert result.status == "signed"
        assert result.detail == "original"

    def test_mumei_returns_unsigned(self):
        result = self.normalizer.normalize("mumei")
        assert result.status == "unsigned"
        assert result.detail is None

    def test_kinzogan_returns_unsigned_with_detail(self):
        result = self.normalizer.normalize("kinzogan-mei")
        assert result.status == "unsigned"
        assert result.detail == "kinzogan"

    def test_gimei_returns_signed_with_detail(self):
        """Gimei is physically signed, just fake."""
        result = self.normalizer.normalize("gimei")
        assert result.status == "signed"
        assert result.detail == "gimei"

    # Edge cases
    def test_ubu_returns_null(self):
        """ubu is tang condition, not signature type."""
        result = self.normalizer.normalize("ubu")
        assert result.status is None
        assert result.detail is None

    def test_none_input(self):
        result = self.normalizer.normalize(None)
        assert result.status is None

    def test_unknown_value(self):
        result = self.normalizer.normalize("some_random_value")
        assert result.status is None
        assert result.confidence == 0.0

    def test_case_insensitive(self):
        result = self.normalizer.normalize("MUMEI")
        assert result.status == "unsigned"

    def test_kanji_input(self):
        result = self.normalizer.normalize("無銘")
        assert result.status == "unsigned"
```

---

## Rollout Plan

### Phase 1: Implementation (Oshi-scrapper)
1. Create `signature.py` normalizer
2. Create `era.py` normalizer
3. Add to pipeline.py
4. Add derived fields to ScrapedListing
5. Update repository.py
6. Write unit tests

### Phase 2: Database Migration
1. Run ALTER TABLE to add columns
2. Add constraints and indexes
3. Test on staging/dev

### Phase 3: Backfill
1. Run dry-run backfill
2. Validate sample of results
3. Execute backfill in batches
4. Verify completeness

### Phase 4: Verify Pipeline
1. Test full scrape → normalize → save cycle
2. Verify new scrapes populate derived fields
3. Monitor for edge cases

### Phase 5: Frontend (Nihontowatch)
1. Update TypeScript types
2. Add facet filters for `signature_status`, `sword_period`
3. Update display components
4. Deploy

---

## Monitoring & Validation

### Coverage Metrics

Track percentage of records with derived values:

```sql
SELECT
    COUNT(*) as total,
    COUNT(signature_status) as has_signature_status,
    COUNT(sword_period) as has_sword_period,
    COUNT(historical_period) as has_historical_period,
    ROUND(100.0 * COUNT(signature_status) / COUNT(*), 1) as sig_pct,
    ROUND(100.0 * COUNT(sword_period) / COUNT(*), 1) as period_pct
FROM listings
WHERE mei_type IS NOT NULL OR era IS NOT NULL;
```

### Anomaly Detection

Flag unexpected null values:

```sql
-- Records with mei_type but no signature_status (should investigate)
SELECT url, mei_type
FROM listings
WHERE mei_type IS NOT NULL
  AND signature_status IS NULL
LIMIT 100;
```
