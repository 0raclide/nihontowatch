# Nihontowatch Documentation Index

## This Project

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](../CLAUDE.md) | AI context, project overview, quick reference |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow, infrastructure |
| [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md) | What lives where across all repos |
| [DEALERS.md](./DEALERS.md) | Dealer-specific quirks, exclusions, maintenance notes |
| [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) | Auth, profiles, favorites, alerts, activity tracking, admin |
| [MOBILE_UX.md](./MOBILE_UX.md) | Mobile interaction patterns, QuickView bottom sheet |
| [SEARCH_FEATURES.md](./SEARCH_FEATURES.md) | Natural language search, filters, query syntax |
| [FRESHNESS_SYSTEM.md](./FRESHNESS_SYSTEM.md) | Listing age verification, Wayback integration, confidence levels |

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
4. Document quirks in [DEALERS.md](./DEALERS.md)

### "I need to fix dealer-specific issues"
1. Read [DEALERS.md](./DEALERS.md) - Existing dealer notes
2. Check `Oshi-scrapper/scrapers/<dealer>.py` - Scraper code
3. Add exclusions, quirks, or cleanup notes to DEALERS.md

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

### "I need to work on user accounts/auth"
1. Read [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) - Complete system docs
2. Check `src/lib/auth/AuthContext.tsx` - Auth state management
3. Check `src/app/api/favorites/`, `src/app/api/alerts/` - API routes
4. Check `src/app/admin/` - Admin dashboard pages

### "I need to add admin features"
1. Read [USER_ACCOUNTS_SYSTEM.md#admin-dashboard](./USER_ACCOUNTS_SYSTEM.md#admin-dashboard)
2. Check `src/app/admin/` - Existing admin pages
3. Check `src/app/api/admin/` - Admin API routes
4. Verify admin role check in middleware

### "I need to work on mobile UX"
1. Read [MOBILE_UX.md](./MOBILE_UX.md) - Mobile interaction patterns
2. Check `src/components/listing/QuickViewMobileSheet.tsx` - Bottom sheet implementation
3. Check `tests/quickview-regression.spec.ts` - Mobile test patterns
4. Use viewport `{ width: 390, height: 844 }` for testing

### "I need to work on listing freshness"
1. Read [FRESHNESS_SYSTEM.md](./FRESHNESS_SYSTEM.md) - Complete system docs
2. Check `src/lib/freshness/` - Freshness calculation and display
3. Check `src/lib/wayback/` - Wayback Machine client
4. Check `/api/admin/dealers/baseline` - Setting dealer baselines
5. Check `/api/cron/wayback-check` - Background verification

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
| Dealer quirks & fixes | [DEALERS.md](./DEALERS.md) |
| User accounts & auth | [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) |
| Admin dashboard | [USER_ACCOUNTS_SYSTEM.md#admin-dashboard](./USER_ACCOUNTS_SYSTEM.md#admin-dashboard) |
| Mobile UX & gestures | [MOBILE_UX.md](./MOBILE_UX.md) |
| Search features | [SEARCH_FEATURES.md](./SEARCH_FEATURES.md) |
| Listing freshness | [FRESHNESS_SYSTEM.md](./FRESHNESS_SYSTEM.md) |
| Testing | Oshi-scrapper: `pytest tests/`, Nihontowatch: `npx playwright test` |
| Deployment | [CLAUDE.md](../CLAUDE.md#deployment) |
