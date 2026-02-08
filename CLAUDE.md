# Nihontowatch Project Guide

## Production Status

**Live at:** https://nihontowatch.com

**Current Features:**
- Browse collection with faceted filters (certification, type, dealer)
- Currency conversion (JPY/USD/EUR)
- Image optimization with skeleton loaders
- Dark mode support
- User authentication (magic link + password)
- Saved searches with email alerts
- AI inquiry email drafts
- Setsumei translations (NBTHK certification descriptions)
- Dealer analytics dashboard (admin)
- Artisan code display & search (admin-only badges with confidence levels)
- Artist directory (`/artists`) with filters, pagination, and sitemap integration

**Trial Mode:** All premium features currently free (toggle via `NEXT_PUBLIC_TRIAL_MODE` env var)

**Defaults:**
- Currency: JPY
- Sort: Newest first
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
-- Artisan matching (from Oshi-scrapper)
artisan_id, artisan_confidence, artisan_method, artisan_candidates, artisan_matched_at
-- Artisan verification (admin QA)
artisan_verified, artisan_verified_at, artisan_verified_by
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

## Current Dealers (44 Total)

### Japanese Dealers (36)

| Dealer | Domain | Status |
|--------|--------|--------|
| Aoi Art | aoijapan.com | ✅ Active |
| Asahi Token | asahitoken.jp | ✅ Active |
| Ayakashi | ayakashi.co.jp | ✅ Active |
| Choshuya | choshuya.co.jp | ✅ Active |
| E-sword | e-sword.jp | ✅ Active |
| Eirakudo | eirakudo.shop | ✅ Active |
| Gallery Youyou | galleryyouyou.com | ✅ Active |
| Giheiya | giheiya.com | ✅ Active |
| Ginza Seikodo | ginzaseikodo.com | ✅ Active |
| Goushuya | goushuya-nihontou.com | ✅ Active |
| Hyozaemon | hyozaemon.jp | ✅ Active |
| Iida Koendo | iidakoendo.com | ✅ Active |
| Kanshoan | kanshoan.com | ✅ Active |
| Katana Ando | katana-ando.co.jp | ✅ Active |
| Katanahanbai | katanahanbai.com | ✅ Active |
| Kusanagi | kusanaginosya.com | ✅ Active |
| Nipponto | nipponto.co.jp | ✅ Active |
| Premi | premi.co.jp | ✅ Active |
| Samurai Nippon | samurai-nippon.net | ✅ Active |
| Samurai Shokai | samuraishokai.jp | ✅ Active |
| Sanmei | sanmei.com | ✅ Active |
| Shoubudou | shoubudou.co.jp | ✅ Active |
| Sugie Art | sugieart.com | ✅ Active |
| Taiseido | taiseido.biz | ✅ Active |
| Token-Net | token-net.com | ✅ Active |
| Tokka Biz | tokka.biz | ✅ Active |
| Touken Komachi | toukenkomachi.com | ✅ Active |
| Touken Matsumoto | touken-matsumoto.jp | ✅ Active |
| Touken Sakata | touken-sakata.com | ✅ Active |
| Toukentakarado | toukentakarado.com | ✅ Active |
| Tsuba Info | tsuba.info | ✅ Active |
| Tsuruginoya | tsuruginoya.com | ✅ Active |
| Wakeidou | wakeidou.com | ✅ Active |
| World Seiyudo | world-seiyudo.com | ✅ Active |
| Yamasiroya | yamasiroya.com | ✅ Active |
| Yushindou | yushindou.com | ✅ Active |

### International Dealers (8)

| Dealer | Domain | Country | Status |
|--------|--------|---------|--------|
| Giuseppe Piva | giuseppepiva.com | Italy | ✅ Active |
| Legacy Swords | legacyswords.com | USA | ✅ Active |
| Nihonto | nihonto.com | USA | ✅ Active |
| Nihonto Art | nihontoart.com | USA | ✅ Active |
| Nihonto Australia | nihonto.com.au | Australia | ✅ Active |
| Nihontocraft | nihontocraft.com | USA | ✅ Active |
| Swords of Japan | swordsofjapan.com | USA | ✅ Active |
| Tetsugendo | tetsugendo.com | USA | ✅ Active |

---

## Key Features (Planned)

### MVP Features
1. **Browse Listings** - Grid/list view with filters
2. **Search** - Full-text search with facets
3. **Listing Detail** - Images, specs, price, dealer info
4. **Dealer Directory** - All dealers with inventory counts

### Completed Features (Phase 1)
1. **User Accounts** - Magic link + password auth
2. **Subscription Tiers** - Free / Enthusiast ($25/mo) / Connoisseur ($200/mo)
3. **Saved Searches with Alerts** - Instant (15 min) or daily digest emails
4. **Price Drop Alerts** - Email when watched items decrease in price
5. **AI Inquiry Emails** - Japanese business email drafts
6. **Setsumei Translations** - NBTHK certification descriptions in English
7. **72h Data Delay** - Free users see listings 72h late

### Future Features (Phase 2+)
1. **Private Listings** - Exclusive dealer items (Connoisseur)
2. **Artist Stats** - Juyo/Tokuju certification counts by smith
3. **Market Analytics** - Price trends, inventory levels
4. **Dealer Tier** - Analytics and listing management for dealers

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
# .env.local (and Vercel production)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only

# SendGrid (for email alerts)
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=notifications@nihontowatch.com

# Cron job security
CRON_SECRET=xxx  # Used to authenticate cron endpoints

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# OpenRouter (for AI features)
OPENROUTER_API_KEY=xxx
```

**Important:** When adding env vars to Vercel, you must **redeploy** for changes to take effect.

---

## Business Model & Monetization

### Strategy: Hybrid Model

The optimal monetization strategy is a hybrid approach:

1. **Free for collectors** - Maximize eyeballs to become the default first stop
2. **Charge dealers** - B2B revenue from analytics and premium placement
3. **Optional collector premium** - Power user features for serious buyers

**Market Size Context:**
- ~8,400 registered members on Nihonto Message Board
- ~1,500-2,000 active collectors globally
- 27+ dealers currently in the system

### Trial Mode

All premium features are currently **free for all users** to drive adoption.

**To toggle trial mode:**
```bash
# In Vercel environment variables:
NEXT_PUBLIC_TRIAL_MODE=true   # All features free
NEXT_PUBLIC_TRIAL_MODE=false  # Normal paywall (or remove var)
```

When trial ends, paywall returns instantly - no code changes needed.

**What trial mode does:**
- `canAccessFeature()` returns `true` for all features
- `isDelayed` returns `false` (no 72h data delay)
- DataDelayBanner is hidden
- Pricing page still exists but free tier shows "Browse all listings"

### Subscription Tiers (Post-Trial)

| Tier | Price | Key Features |
|------|-------|--------------|
| Free | $0 | Browse all listings, filters, favorites, currency conversion |
| Enthusiast | $25/mo | Email alerts, setsumei translations, AI inquiry emails, data exports |
| Connoisseur | $200/mo | Everything + private listings, artist stats, LINE access, Discord |
| Dealer | $100-300/mo | Analytics dashboard, click tracking, competitive intel |

### Search Alerts Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH ALERTS FLOW                           │
│                                                                 │
│  User saves search          Vercel Cron (*/15 min)             │
│  with notification          or (8am UTC daily)                  │
│        │                           │                            │
│        ▼                           ▼                            │
│  ┌───────────┐              ┌────────────────┐                 │
│  │ saved_    │◄─────────────│ process-saved- │                 │
│  │ searches  │              │ searches cron  │                 │
│  └───────────┘              └───────┬────────┘                 │
│                                     │                           │
│                                     ▼                           │
│                            ┌────────────────┐                  │
│                            │   matcher.ts   │                  │
│                            │ findMatching() │                  │
│                            └───────┬────────┘                  │
│                                    │                            │
│                                    ▼                            │
│                            ┌────────────────┐                  │
│                            │   SendGrid     │                  │
│                            │   Email API    │                  │
│                            └───────┬────────┘                  │
│                                    │                            │
│                                    ▼                            │
│                            ┌────────────────┐                  │
│                            │ saved_search_  │                  │
│                            │ notifications  │                  │
│                            └────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | Location |
|-----------|----------|
| Subscription types | `src/types/subscription.ts` |
| Subscription context | `src/contexts/SubscriptionContext.tsx` |
| Saved searches API | `src/app/api/saved-searches/route.ts` |
| Alerts cron job | `src/app/api/cron/process-saved-searches/route.ts` |
| Price drop cron | `src/app/api/cron/process-price-alerts/route.ts` |
| Email sending | `src/lib/email/sendgrid.ts` |
| Email templates | `src/lib/email/templates/*.ts` |
| Matcher logic | `src/lib/savedSearches/matcher.ts` |
| Cron config | `vercel.json` (crons section) |

### Feature Gating

```typescript
// Check if user can access a feature
const { canAccessFeature, tier } = useSubscription();

if (!canAccessFeature('search_alerts')) {
  // Show paywall
}
```

Features and minimum tier:
- `fresh_data`: enthusiast
- `setsumei_translation`: enthusiast
- `inquiry_emails`: enthusiast
- `saved_searches`: enthusiast
- `search_alerts`: enthusiast
- `private_listings`: connoisseur
- `artist_stats`: connoisseur

### Dealer Analytics (B2B Revenue)

Comprehensive analytics infrastructure already built for dealer monetization:

**Tracking in place:**
- Click-through tracking to dealer websites
- Unique visitor counts per dealer
- Dwell time (how long users view listings)
- Favorites per dealer
- Conversion tracking (click → item sold)
- Daily aggregated stats
- Dealer rankings and percentiles

**Admin dashboard:**
- `/admin/dealers` - All dealer analytics
- `/admin/dealers/[id]` - Individual dealer report with PDF export
- Traffic value estimates (CPM calculation)

**Key files:**
| Component | Location |
|-----------|----------|
| Tracking API | `src/app/api/track/route.ts` |
| Dealer analytics API | `src/app/api/admin/dealers/analytics/route.ts` |
| Admin dashboard | `src/app/admin/dealers/page.tsx` |
| Individual report | `src/app/admin/dealers/[id]/page.tsx` |
| Activity tracker | `src/lib/tracking/ActivityTracker.tsx` |
| Dwell tracking | `src/lib/viewport/DwellTracker.ts` |

**Gap for B2B launch:** Dealer self-serve portal (dealers can't log in to see their own data yet)

### Artisan Code Display & Verification (Admin Feature)

Displays Yuhinkai artisan codes (e.g., "MAS590", "OWA009") on listing cards for admin users, with confidence-based color coding and QA verification.

**How it works:**
- Artisan matching runs in Oshi-scrapper (`artisan_matcher/` module)
- Matches listings to Yuhinkai database entries (12,447 smiths, 1,119 tosogu makers)
- Stores `artisan_id` and `artisan_confidence` in listings table

**Display:**
- Badge appears on **right side** of certification row (e.g., "TOKUBETSU HOZON" left, "MAS590" right)
- **Green** = HIGH confidence (exact kanji match or LLM consensus)
- **Yellow** = MEDIUM confidence (romaji match or school fallback)
- **Gray** = LOW confidence (LLM disagreement)
- Only visible to **admin users**

**Tooltip (click badge):**
- Shows artisan details from Yuhinkai database (name kanji/romaji, school, province, era)
- Displays Juyo/Tokuju counts and match method
- Shows alternative candidates for QA review
- **Verification buttons**: ✓ Correct / ✗ Incorrect to flag match accuracy
- Verification saved to database with timestamp and admin user ID

**Search:**
- URL param: `?artisan=MAS590` (substring match)
- Search box: Type artisan code directly (e.g., "OWA009") - auto-detected by pattern

**Key files:**
| Component | Location |
|-----------|----------|
| CSS colors | `src/app/globals.css` (--artisan-high, --artisan-medium, --artisan-low) |
| Badge display | `src/components/browse/ListingCard.tsx` (certification row) |
| Tooltip component | `src/components/artisan/ArtisanTooltip.tsx` |
| Artisan details API | `src/app/api/artisan/[code]/route.ts` |
| Verification API | `src/app/api/listing/[id]/verify-artisan/route.ts` |
| Yuhinkai client | `src/lib/supabase/yuhinkai.ts` |
| API filter | `src/app/api/browse/route.ts` (artisanCode param) |
| DB schema | `supabase/migrations/048_artisan_matching.sql`, `049_artisan_verification.sql` |

### Artist Directory (`/artists`)

Browseable index of all 13,566 artisans from the Yuhinkai database. Server-rendered for SEO, client-side filtering for instant UX. Default view shows ~1,400 notable artisans (those with certified works) sorted by elite factor.

**Architecture**: Hybrid SSR + client fetch. Initial page load is server-rendered. Filter changes use client-side `fetch()` to `/api/artists/directory` with `window.history.replaceState()` for URL updates (no SSR round-trip).

**Key files:**
| Component | Location |
|-----------|----------|
| Directory API | `src/app/api/artists/directory/route.ts` |
| Server page | `src/app/artists/page.tsx` |
| Client component | `src/app/artists/ArtistsPageClient.tsx` |
| DB queries | `src/lib/supabase/yuhinkai.ts` (`getArtistsForDirectory`, `getArtistDirectoryFacets`) |
| JSON-LD | `src/lib/seo/jsonLd.ts` (`generateArtistDirectoryJsonLd`) |
| Slug utils | `src/lib/artisan/slugs.ts` |
| Session doc | `docs/SESSION_20260208_ARTIST_DIRECTORY.md` |

### Documentation

For detailed implementation docs, see:
- `docs/SUBSCRIPTION_HANDOFF.md` - Current status and changelog
- `docs/PRO_TIER_IMPLEMENTATION.md` - Implementation checklist
- `docs/PRO_TIER_STRATEGY.md` - Business strategy
- `docs/SESSION_20260208_ARTIST_DIRECTORY.md` - Artist directory implementation

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
- `/artists` - Artist directory (filterable)
- `/artists/[slug]` - Individual artist profile (e.g., `/artists/masamune-MAS590`)

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
