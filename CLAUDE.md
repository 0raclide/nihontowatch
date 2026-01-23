# Nihontowatch Project Guide

## Production Status

**Live at:** https://nihontowatch.com

**Current Features:**
- Browse collection with faceted filters (certification, type, dealer)
- Currency conversion (JPY/USD/EUR)
- Image optimization with skeleton loaders
- Dark mode support

**Defaults:**
- Currency: JPY
- Sort: Price high to low
- Items per page: 100
- Only available items shown (sold archive hidden)

---

## What This Project Is

**Nihontowatch** is a public aggregator site for Japanese swords (nihonto) and sword fittings (tosogu) from dealers worldwide. The goal is to become the primary hub for collectors looking to make acquisitions by aggregating listings from all major dealers into a single searchable interface.

### Mission
- **Capture eyeballs**: SEO-optimized, fast, beautiful UI
- **Primary collector hub**: The first place collectors check for new inventory
- **Global coverage**: Japanese dealers + international dealers
- **Production-grade**: Robust, reliable, scalable infrastructure

### Related Projects

| Project | Location | Purpose |
|---------|----------|---------|
| **Oshi-scrapper** | `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper` | Python scraping backend - dealers, extraction, database |
| **Oshi-v2** | `/Users/christopherhill/Desktop/Claude_project/oshi-v2` | Reference implementation - UI patterns, utilities, types |

**IMPORTANT**: Before implementing features, check `docs/CROSS_REPO_REFERENCE.md` to see what already exists.

---

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Database**: Supabase (PostgreSQL) - shared with Oshi-scrapper
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Scraping Backend**: Python (Oshi-scrapper project)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         NIHONTOWATCH                            │
│                    (Next.js Frontend)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Browse  │  │  Search  │  │  Alerts  │  │  Dealers │       │
│  │  /browse │  │  /search │  │  /alerts │  │ /dealers │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │             │             │               │
│       └─────────────┴──────┬──────┴─────────────┘               │
│                            │                                    │
│                    ┌───────▼───────┐                           │
│                    │   Supabase    │                           │
│                    │   (Shared)    │                           │
│                    └───────┬───────┘                           │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                            │                                    │
│                    ┌───────▼───────┐                           │
│                    │   Supabase    │                           │
│                    │   Database    │                           │
│                    └───────┬───────┘                           │
│                            │                                    │
│  ┌──────────┐  ┌──────────┴──────────┐  ┌──────────┐          │
│  │ Dealers  │  │      Listings       │  │  Price   │          │
│  │  Table   │  │       Table         │  │ History  │          │
│  └──────────┘  └─────────────────────┘  └──────────┘          │
│                                                                 │
│                      OSHI-SCRAPPER                             │
│                   (Python Backend)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Scrapers │  │Discovery │  │   LLM    │  │  Daily   │       │
│  │  (18+)   │  │ Crawlers │  │ Extract  │  │  Jobs    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
nihontowatch/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── browse/             # Main listing browse view
│   │   ├── search/             # Advanced search
│   │   ├── listing/[id]/       # Individual listing detail
│   │   ├── dealers/            # Dealer directory
│   │   ├── alerts/             # Price/new listing alerts
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── listing/            # Listing card, detail components
│   │   ├── search/             # Search bar, filters, facets
│   │   ├── dealers/            # Dealer cards, profiles
│   │   └── ui/                 # Shared UI components
│   ├── lib/
│   │   ├── supabase/           # Database client
│   │   ├── constants.ts        # App-wide constants
│   │   ├── types.ts            # TypeScript types
│   │   └── utils.ts            # Utility functions
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript type definitions
├── docs/
│   ├── INDEX.md                # Documentation navigation
│   ├── ARCHITECTURE.md         # System architecture
│   └── CROSS_REPO_REFERENCE.md # Links to Oshi-scrapper/Oshi-v2
├── public/                     # Static assets
├── CLAUDE.md                   # This file
└── package.json
```

---

## Database Schema (Supabase - Shared with Oshi-scrapper)

### Core Tables

**dealers**
```sql
id, name (UNIQUE), domain, catalog_url, is_active, country, created_at
earliest_listing_at  -- When dealer's first listing was discovered (for initial import detection)
```

**listings**
```sql
id, url (UNIQUE), dealer_id
-- Status
status, is_available, is_sold, page_exists
-- Price
price_value, price_currency, price_raw
-- Item classification
item_type, item_category, title, description
-- Sword specs (for blades)
nagasa_cm, sori_cm, motohaba_cm, sakihaba_cm, kasane_cm, weight_g
-- Tosogu specs (for fittings)
tosogu_maker, tosogu_school, material, height_cm, width_cm
-- Attribution
smith, school, province, era, mei_type
-- Certification
cert_type, cert_session, cert_organization
-- Media
images (JSONB), raw_page_text
-- Timestamps
first_seen_at, last_scraped_at, scrape_count
-- Sorting
is_initial_import  -- TRUE = bulk import, FALSE = genuine new inventory (for "Newest" sort)
```

**price_history**
```sql
id, listing_id, old_price, new_price, change_type, detected_at
```

**discovered_urls**
```sql
id, url (UNIQUE), dealer_id, discovered_at, is_scraped, scrape_priority
```

### Key Relationships
- `listings.dealer_id` → `dealers.id`
- `price_history.listing_id` → `listings.id`
- `discovered_urls.dealer_id` → `dealers.id`

---

## Data Model

### Item Types (from Oshi-scrapper)

**Swords (Blades)**
- KATANA, WAKIZASHI, TANTO, TACHI, NAGINATA, YARI, KEN

**Tosogu (Fittings)**
- TSUBA, MENUKI, KOZUKA, KOGAI, FUCHI, KASHIRA, FUCHI_KASHIRA

**Other**
- ARMOR, HELMET, KOSHIRAE, UNKNOWN

### Listing Status
- AVAILABLE, SOLD, PRESUMED_SOLD, WITHDRAWN, EXPIRED, ERROR, UNKNOWN

### Certifications
- **NBTHK**: Juyo, Tokubetsu Juyo, Hozon, Tokubetsu Hozon
- **NTHK**: Various grades
- Paper types, session numbers, dates

---

## Current Dealers (27 Total)

### Japanese Dealers (24)

| Dealer | Domain | Status |
|--------|--------|--------|
| Aoi Art | aoijapan.com | ✅ Active |
| Eirakudo | eirakudo.com | ✅ Active |
| Nipponto | nipponto.co.jp | ✅ Active |
| E-sword | e-sword.jp | ✅ Active |
| Samurai Nippon | samurai-nippon.net | ✅ Active |
| Kusanagi | kusanaginosya.com | ✅ Active |
| Choshuya | choshuya.co.jp | ✅ Active |
| Ginza Seikodo | ginza-seikodo.com | ✅ Active |
| Iida Koendo | iida-koendo.com | ✅ Active |
| Katana Ando | katana-ando.com | ✅ Active |
| Katanahanbai | katanahanbai.com | ✅ Active |
| Shoubudou | shoubudou.jp | ✅ Active |
| Taiseido | taiseido.net | ✅ Active |
| Premi | premi.co.jp | ✅ Active |
| Gallery Youyou | gallery-youyou.com | ✅ Active |
| Hyozaemon | hyozaemon.com | ✅ Active |
| Tsuruginoya | tsuruginoya.com | ✅ Active |
| Touken Matsumoto | touken-matsumoto.jp | ✅ Active |
| Touken Komachi | toukenkomachi.com | ✅ Active |
| Touken Sakata | touken-sakata.com | ✅ Active |
| Token-Net | token-net.com | ✅ Active |
| World Seiyudo | world-seiyudo.com | ✅ Active |
| Tokka Biz | tokka.biz | ✅ Active |
| Sanmei | sanmei.com | ✅ Active |

### Western Dealers (3)

| Dealer | Domain | Country | Status |
|--------|--------|---------|--------|
| Nihonto | nihonto.com | USA | ✅ Active |
| Nihonto Art | nihontoart.com | USA | ✅ Active |
| Swords of Japan | swordsofjapan.com | USA | ✅ Active |

### Planned International Dealers

| Dealer | Domain | Country | Status |
|--------|--------|---------|--------|
| Nihonto Antiques | nihontoantiques.com | USA | Planned |
| Unique Japan | uniquejapan.com | UK | Planned |
| Bushido Swords | bushido-swords.com | Germany | Planned |
| Japanese Sword Shop | japaneseswordshop.com | USA | Planned |
| Swordstore | swordstore.com | USA | Planned |

---

## Key Features (Planned)

### MVP Features
1. **Browse Listings** - Grid/list view with filters
2. **Search** - Full-text search with facets
3. **Listing Detail** - Images, specs, price, dealer info
4. **Dealer Directory** - All dealers with inventory counts

### Phase 2 Features
1. **Price Alerts** - Email when price drops
2. **New Listing Alerts** - Email for matching criteria
3. **Saved Searches** - Bookmark search queries
4. **Price History** - See historical prices

### Phase 3 Features
1. **User Accounts** - Save favorites, watchlists
2. **Comparison** - Compare similar items
3. **Market Analytics** - Price trends, inventory levels
4. **API Access** - For power users

---

## Development Workflow

### Local Development
```bash
cd /Users/christopherhill/Desktop/Claude_project/nihontowatch
npm run dev
# Open http://localhost:3000
```

### Database (Shared Supabase)
The database is shared with Oshi-scrapper. Data flows:
1. Oshi-scrapper discovers URLs via crawlers
2. Oshi-scrapper scrapes listings, stores in Supabase
3. Nihontowatch reads from Supabase, displays to users

### Deployment
```bash
git push  # Auto-deploys to Vercel → nihontowatch.com
```

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only
```

---

## Important Patterns

### Reuse from Oshi-v2
When implementing features, check `/Users/christopherhill/Desktop/Claude_project/oshi-v2/src/lib/` for:
- `fieldAccessors.ts` - Unified metadata extraction
- `constants.ts` - Pagination, caching, search thresholds
- `textNormalization.ts` - Japanese text handling
- `errors.ts` - Error handling patterns

### Reuse from Oshi-scrapper
The scraper defines the data model. Check `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper/models/listing.py` for:
- `ItemType` enum - All item type classifications
- `SwordSpecs` - Sword measurement fields
- `TosoguSpecs` - Tosogu measurement fields
- `Certification` - Certification structure
- `ListingStatus` - Status enum

### Dual-Path Field Access
Swords and tosogu use different field paths:
- Swords: `smith`, `school` (swordsmith attribution)
- Tosogu: `tosogu_maker`, `tosogu_school` (fitting maker attribution)

Always check both paths when displaying artisan info.

---

## SEO Strategy

### URL Structure
- `/browse` - Main listing page (paginated)
- `/browse?type=katana` - Filtered by type
- `/browse?dealer=aoi-art` - Filtered by dealer
- `/listing/[id]` - Individual listing (canonical URL)
- `/dealers` - Dealer directory
- `/dealers/[slug]` - Individual dealer page

### Meta Tags
Every page needs:
- `<title>` - Unique, keyword-rich
- `<meta name="description">` - Compelling summary
- `<meta property="og:*">` - Social sharing
- `<link rel="canonical">` - Canonical URL

### Structured Data
Use JSON-LD for:
- Product listings (schema.org/Product)
- Organization (dealer info)
- BreadcrumbList (navigation)

---

## Critical Rules

1. **Mobile-first** - Design for mobile, enhance for desktop
2. **Performance** - Target <3s LCP, use Next.js Image optimization
3. **SEO** - Every page must have unique title/description
4. **Accessibility** - WCAG 2.1 AA compliance
5. **No secrets in code** - All keys in .env.local
6. **Test locally first** - Use `npm run dev` before deploying
7. **ALWAYS run tests before deploying** - Run `npm test` before any deploy. If tests fail, investigate and fix the issues before proceeding. Never deploy with failing tests.
8. **NEVER modify tests to match broken code** - If a test fails during refactoring, the TEST IS RIGHT and the code is wrong. Tests exist to catch regressions. Changing a test to make it pass defeats its entire purpose. If a test fails: (1) understand WHY it's failing, (2) fix the CODE, not the test, (3) only modify tests when intentionally changing behavior WITH explicit user approval. This rule exists because we shipped a regression (dealer name → domain) when a test was silently "fixed" to match broken code.

---

## Quick Reference

### Run Scraper (Oshi-scrapper)
```bash
cd /Users/christopherhill/Desktop/Claude_project/Oshi-scrapper
python main.py scrape --dealer "Aoi Art" --limit 5
python main.py discover --all
```

### Check Database
```bash
# Via Supabase dashboard or CLI
supabase db diff
```

### Deploy
```bash
# ALWAYS run tests first - investigate and fix any failures before deploying
npm test
git add -A && git commit -m "feat: description" && git push
```

---

## Documentation Index

| Doc | Purpose |
|-----|---------|
| `docs/INDEX.md` | Navigation for all docs |
| `docs/ARCHITECTURE.md` | System architecture deep-dive |
| `docs/CROSS_REPO_REFERENCE.md` | What lives where across repos |
| `CLAUDE.md` | This file - AI context |

---

## Production URLs

| Environment | URL |
|-------------|-----|
| Production | https://nihontowatch.com |
| Vercel Preview | https://nihontowatch.vercel.app |
| Supabase Dashboard | https://supabase.com/dashboard/project/xxx |
