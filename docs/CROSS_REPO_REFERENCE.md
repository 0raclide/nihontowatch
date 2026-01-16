# Cross-Repository Reference

This document maps where key components live across the three related projects.

## Project Locations

| Project | Path | Purpose |
|---------|------|---------|
| **nihontowatch** | `/Users/christopherhill/Desktop/Claude_project/nihontowatch` | Public aggregator frontend |
| **Oshi-scrapper** | `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper` | Python scraping backend |
| **oshi-v2** | `/Users/christopherhill/Desktop/Claude_project/oshi-v2` | Reference implementation (scholarly app) |

---

## Data Model

### Source of Truth: Oshi-scrapper

The Python data model defines the structure for all scraped data.

| File | Classes | Purpose |
|------|---------|---------|
| `Oshi-scrapper/models/listing.py` | `ScrapedListing` | Main listing container |
| | `ItemType` | Enum: KATANA, TSUBA, etc. |
| | `SwordSpecs` | Sword measurements |
| | `TosoguSpecs` | Tosogu measurements |
| | `SwordAttribution` | Smith, school, era |
| | `Certification` | NBTHK/NTHK papers |
| | `ListingStatus` | AVAILABLE, SOLD, etc. |

### TypeScript Types: Adapt from oshi-v2

| File | Types | Reusability |
|------|-------|-------------|
| `oshi-v2/src/types/index.ts` | `ItemMetadata` | Adapt structure |
| | `Collection`, `SearchResult` | Reference patterns |
| | `MembershipTier`, `UserProfile` | If adding auth |

### Database Schema: Oshi-scrapper

| File | Tables |
|------|--------|
| `Oshi-scrapper/supabase/migrations/initial_schema.sql` | Core tables |
| `Oshi-scrapper/supabase/migrations/listing_status.sql` | Status enum |

---

## Scraping Infrastructure

### All in Oshi-scrapper

| Component | Location | Description |
|-----------|----------|-------------|
| **Base Scraper** | `scrapers/base.py` | Abstract class, HTTP handling |
| **Registry** | `scrapers/registry.py` | Auto-discover scrapers |
| **Generic Fallback** | `scrapers/generic.py` | Fallback for unknown dealers |
| **Dealer Scrapers** | `scrapers/*.py` | 18 dealer implementations |
| **Discovery Crawlers** | `scrapers/discovery/*.py` | 16 catalog crawlers |
| **HTTP Client** | `utils/http_client.py` | Rate limiting, retries |
| **Price Parser** | `utils/price_parser.py` | Multi-format parsing |
| **LLM Extractor** | `utils/llm_extractor.py` | AI-powered extraction |

### Adding a New Dealer

1. Create scraper: `Oshi-scrapper/scrapers/new_dealer.py`
2. Create discovery crawler: `Oshi-scrapper/scrapers/discovery/new_dealer.py`
3. Add tests: `Oshi-scrapper/tests/scrapers/test_new_dealer.py`
4. Add to dealers table in Supabase

---

## Database Layer

### Python (Oshi-scrapper)

| File | Purpose |
|------|---------|
| `db/client.py` | Supabase singleton pattern |
| `db/repository.py` | CRUD operations for all tables |

### TypeScript (oshi-v2 patterns)

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser client |
| `src/lib/supabase/server.ts` | Server client |

---

## Utility Libraries

### From oshi-v2 (Adapt for nihontowatch)

| File | Purpose | Lines | Adaptation |
|------|---------|-------|------------|
| `src/lib/constants.ts` | Magic numbers, thresholds | 123 | Change values |
| `src/lib/fieldAccessors.ts` | Unified field extraction | 400+ | Essential for dual-path |
| `src/lib/textNormalization.ts` | Japanese text handling | 150+ | Use as-is |
| `src/lib/errors.ts` | Error handling pattern | 100+ | Use pattern |
| `src/lib/collections.ts` | Collection utilities | 200+ | Adapt for dealers |

### Field Accessor Pattern (Critical)

Swords and tosogu use different field paths:

```typescript
// Swords (blades)
metadata.smith?.name_romaji
metadata.school
metadata.tradition

// Tosogu (fittings)
metadata.tosogu_maker
metadata.tosogu_school
metadata.maker?.name_romaji
```

The `fieldAccessors.ts` pattern handles this:

```typescript
import { getArtisanName, getSchool } from '@/lib/fieldAccessors';

// Works for both swords and tosogu
const artisan = getArtisanName(listing);
const school = getSchool(listing);
```

---

## UI Components

### From oshi-v2 (Reference)

| Component | Location | Adapt For |
|-----------|----------|-----------|
| `MetadataPanel.tsx` | `src/components/item/` | Listing detail sidebar |
| `ImageViewer.tsx` | `src/components/item/` | Listing images |
| `FilterDrawer.tsx` | `src/components/ui/` | Mobile filters |
| `SearchOverlay.tsx` | `src/components/ui/` | Search autocomplete |
| `Tabs.tsx` | `src/components/ui/` | Tab navigation |

---

## Search & Filtering

### Query Parser (oshi-v2)

| File | Purpose |
|------|---------|
| `src/lib/search/types.ts` | ParsedQuery, FieldMatch types |
| `src/lib/search/parser.ts` | Token-based query parsing |
| `src/lib/search/matcher.ts` | Field matching logic |

Supports queries like:
- `nagasa>70` - Numeric comparisons
- `mei:kinzogan` - Field filters
- `"exact phrase"` - Quoted strings
- `school:bizen` - Facet filters

---

## Testing

### Oshi-scrapper (542 tests)

```bash
cd Oshi-scrapper
pytest tests/ -v
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/scrapers/*.py` | 249 | All 18 scrapers |
| `tests/scrapers/test_discovery_patterns.py` | 168 | All 16 crawlers |
| `tests/test_db_*.py` | 50 | Database layer |
| `tests/test_llm_extraction.py` | 34 | LLM extraction |
| `tests/test_data_quality.py` | 13 | Data validation |

### oshi-v2 (994 tests)

```bash
cd oshi-v2
npm run test
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/lib/*.test.ts` | 800+ | All utilities |
| `tests/api/*.test.ts` | 100+ | API routes, SQL |

---

## Configuration Files

### Environment Variables

**nihontowatch (.env.local)**
```bash
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Oshi-scrapper (.env)**
```bash
SUPABASE_URL=xxx
SUPABASE_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
OPENAI_API_KEY=xxx  # For LLM extraction
```

---

## Deployment

| Project | Platform | Trigger |
|---------|----------|---------|
| nihontowatch | Vercel | `git push` to main |
| Oshi-scrapper | GitHub Actions | Scheduled (daily) |
| oshi-v2 | Vercel | `git push` to main |

---

## Quick Copy Commands

### Copy utility from oshi-v2 to nihontowatch
```bash
cp /Users/christopherhill/Desktop/Claude_project/oshi-v2/src/lib/constants.ts \
   /Users/christopherhill/Desktop/Claude_project/nihontowatch/src/lib/
```

### Run scraper for specific dealer
```bash
cd /Users/christopherhill/Desktop/Claude_project/Oshi-scrapper
python main.py scrape --dealer "Aoi Art" --limit 10 --db
```

### Check database stats
```bash
cd /Users/christopherhill/Desktop/Claude_project/Oshi-scrapper
python main.py db-stats
```
