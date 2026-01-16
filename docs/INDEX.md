# Nihontowatch Documentation Index

## This Project

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](../CLAUDE.md) | AI context, project overview, quick reference |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow, infrastructure |
| [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md) | What lives where across all repos |

---

## Related Projects

### Oshi-scrapper (Python Backend)

**Location:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper`

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Project overview, CLI commands |
| `docs/schema.md` | Database schema documentation |
| `docs/discovery.md` | Crawler documentation |
| `docs/DATA_FLOW.md` | How data flows through the system |
| `docs/TEST_COVERAGE_ANALYSIS.md` | Test coverage status (542 tests) |

**Key Files:**
| File | Purpose |
|------|---------|
| `models/listing.py` | **DATA MODEL** - ScrapedListing, ItemType, SwordSpecs, TosoguSpecs |
| `scrapers/base.py` | Base scraper class |
| `scrapers/registry.py` | Scraper discovery/routing |
| `db/repository.py` | Database CRUD operations |
| `db/client.py` | Supabase singleton |

### Oshi-v2 (Reference Implementation)

**Location:** `/Users/christopherhill/Desktop/Claude_project/oshi-v2`

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Comprehensive project guide |
| `docs/INDEX.md` | Documentation navigation |
| `docs/ARCHITECTURE.md` | System architecture |
| `docs/TESTING.md` | Test strategy (994 tests) |

**Key Files to Reference:**
| File | Purpose | Reusability |
|------|---------|-------------|
| `src/lib/constants.ts` | App-wide constants | High - adapt thresholds |
| `src/lib/fieldAccessors.ts` | Unified metadata extraction | High - dual-path pattern |
| `src/lib/textNormalization.ts` | Japanese text handling | High - use as-is |
| `src/lib/errors.ts` | Error handling | High - use pattern |
| `src/types/index.ts` | TypeScript types | Medium - adapt structure |
| `src/components/item/MetadataPanel.tsx` | Metadata display | Medium - adapt for listings |

---

## Quick Links by Task

### "I need to understand the data model"
1. Read `Oshi-scrapper/models/listing.py` - Python dataclasses
2. Read `Oshi-scrapper/supabase/migrations/` - SQL schema
3. See [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md#data-model)

### "I need to add a new dealer scraper"
1. Read `Oshi-scrapper/scrapers/base.py` - Base class
2. Copy `Oshi-scrapper/scrapers/generic.py` - Template
3. Add tests in `Oshi-scrapper/tests/scrapers/`

### "I need to build a UI component"
1. Check `oshi-v2/src/components/` - Reference implementations
2. Check `oshi-v2/src/lib/` - Utility functions
3. Adapt patterns for nihontowatch

### "I need to query the database"
1. Use Supabase client pattern from `oshi-v2/src/lib/supabase/`
2. Check `Oshi-scrapper/db/repository.py` - Python patterns
3. See [ARCHITECTURE.md](./ARCHITECTURE.md#database)

### "I need to understand the scraping pipeline"
1. Read `Oshi-scrapper/docs/DATA_FLOW.md`
2. Read `Oshi-scrapper/scripts/daily_scrape.py`
3. See [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md#scraping)

---

## Architecture Diagrams

See [ARCHITECTURE.md](./ARCHITECTURE.md) for:
- System overview diagram
- Data flow diagram
- Database schema diagram
- Deployment architecture

---

## Development Guides

| Task | Where to Look |
|------|---------------|
| Local development | [CLAUDE.md](../CLAUDE.md#development-workflow) |
| Database setup | [ARCHITECTURE.md](./ARCHITECTURE.md#database) |
| Adding dealers | [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md#adding-dealers) |
| Testing | Oshi-scrapper: `pytest tests/`, Oshi-v2: `npm run test` |
| Deployment | [CLAUDE.md](../CLAUDE.md#deployment) |
