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
- Personal collection manager (`/collection`) with Yuhinkai catalog lookup and "I Own This" import
- Full i18n localization (JA/EN) — UI chrome (1100+ keys) + listing data (titles, descriptions, artisan names)
- JA UX tuning — locale-conditional typography, information density, social sharing (LINE), polite empty states

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
name_ja              -- TEXT, verified Japanese name (kanji/kana) for JA locale display. NULL for international dealers.
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
-- Admin lock (single source of truth — scraper NEVER writes this)
artisan_admin_locked  -- BOOLEAN, TRUE = artisan fields protected from automated overwrite
-- Smart crop (computed by cron/backfill, auto-nulled by trigger when images change)
focal_x, focal_y  -- REAL, 0-100% crop center for object-position CSS. NULL = center.
-- Bidirectional translation cache (JP→EN: title_en/description_en, EN→JP: title_ja/description_ja)
title_ja, description_ja  -- TEXT, cached Japanese translations for EN-source listings
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

## Current Dealers (52 Total)

### Japanese Dealers (39)

All Japanese dealers have verified `name_ja` values for JA locale display. Names sourced from official websites (title tags, headers, footers, 特定商取引法 pages). See `supabase/migrations/084_dealer_name_ja.sql`.

| Dealer | Domain | name_ja | Status |
|--------|--------|---------|--------|
| Aoi Art | aoijapan.com | 葵美術 | ✅ Active |
| Asahi Token | asahitoken.jp | あさひ刀剣 | ✅ Active |
| Ayakashi | ayakashi.co.jp | あやかし堂 | ✅ Active |
| Choshuya | ginza.choshuya.co.jp | 銀座長州屋 | ✅ Active |
| E-sword | e-sword.jp | イーソード | ✅ Active |
| Eirakudo | eirakudo.shop | 永楽堂 | ✅ Active |
| Gallery Youyou | galleryyouyou.com | ギャラリー陽々 | ✅ Active |
| Giheiya | giheiya.com | 儀平屋 | ✅ Active |
| Ginza Seikodo | ginzaseikodo.com | 銀座盛光堂 | ✅ Active |
| Goushuya | goushuya-nihontou.com | 江州屋刀剣店 | ✅ Active |
| Hyozaemon | hyozaemon.jp | 兵左衛門百観音堂 | ✅ Active |
| Iida Koendo | iidakoendo.com | 飯田高遠堂 | ✅ Active |
| Kanshoan | kanshoan.com | 干将庵 | ✅ Active |
| Katana Ando | katana-ando.co.jp | 安東貿易 | ✅ Active |
| Katanahanbai | katanahanbai.com | 丸英刀剣 | ✅ Active |
| Kusanagi | kusanaginosya.com | 草薙の舎 | ✅ Active |
| Nipponto | nipponto.co.jp | 明倫産業 | ✅ Active |
| Premi | premi.co.jp | 刀剣高吉 | ✅ Active |
| Samurai Nippon | samurai-nippon.net | コレクション情報 | ✅ Active |
| Samurai Shokai | samuraishokai.jp | サムライ商会 | ✅ Active |
| Sanmei | sanmei.com | 刀剣徳川 | ✅ Active |
| Seikeido | seikeido.com | 成蹊堂 | ✅ Active |
| Shingendou | instagram.com | 眞玄堂 | ✅ Active |
| Shoubudou | shoubudou.co.jp | 勝武堂 | ✅ Active |
| Sugie Art | sugieart.com | 杉江美術店 | ✅ Active |
| Taiseido | taiseido.biz | タイセイ堂 | ✅ Active |
| Token-Net | token-net.com | 刀剣杉田 | ✅ Active |
| Tokka Biz | tokka.biz | 十拳 | ✅ Active |
| Tosa Touken Do | tosatoukendo.com | 土佐刀剣堂 | ✅ Active |
| Touken Komachi | toukenkomachi.com | 刀剣小町 | ✅ Active |
| Touken Matsumoto | touken-matsumoto.jp | 美術刀剣松本 | ✅ Active |
| Touken Sakata | touken-sakata.com | 刀剣坂田 | ✅ Active |
| Toukentakarado | toukentakarado.com | 宝刀堂 | ✅ Active |
| Toushin | shop.nihontou.jp | 刀心 | ✅ Active |
| Tsuruginoya | tsuruginoya.com | つるぎの屋 | ✅ Active |
| Wakeidou | wakeidou.com | 和敬堂 | ✅ Active |
| World Seiyudo | world-seiyudo.com | 銀座誠友堂 | ✅ Active |
| Yamasiroya | yamasiroya.com | 山城屋 | ✅ Active |
| Yushindou | yushindou.com | 勇進堂 | ✅ Active |

### International Dealers (13)

International dealers have `name_ja = NULL` — English name used in both locales.

| Dealer | Domain | Country | Status |
|--------|--------|---------|--------|
| Giuseppe Piva | giuseppepiva.com | Italy | ✅ Active |
| Katana Sword | katana-sword.com | USA | ✅ Active |
| Legacy Swords | legacyswords.com | USA | ✅ Active |
| Nihon Art | nihonart.com | USA | ✅ Active |
| Nihonto | nihonto.com | USA | ✅ Active |
| Nihonto Art | nihontoart.com | Canada | ✅ Active |
| Nihonto Art EU | nihonto.art | France | ✅ Active |
| Nihonto Australia | nihonto.com.au | Australia | ✅ Active |
| Nihontocraft | nihontocraft.com | USA | ✅ Active |
| SamuraiSword | samuraisword.com | USA | ✅ Active |
| Soryu | soryu.pl | Poland | ✅ Active |
| Swords of Japan | swordsofjapan.com | USA | ✅ Active |
| Tetsugendo | tetsugendo.com | USA | ✅ Active |
| Tsuba Info | tsuba.info | Netherlands | ✅ Active |

---

## Key Features (Planned)

### MVP Features
1. **Browse Listings** - Grid/list view with filters
2. **Search** - Full-text search with facets
3. **Listing Detail** - Images, specs, price, dealer info
4. **Dealer Directory** - All dealers with inventory counts

### Completed Features (Phase 1)
1. **User Accounts** - Magic link + password auth
2. **Subscription Tiers** - Free / Pro ($25/mo) / Collector ($99/mo) / Inner Circle ($249/mo) / Dealer ($150/mo)
3. **Saved Searches with Alerts** - Instant (15 min) or daily digest emails
4. **Price Drop Alerts** - Email when watched items decrease in price
5. **AI Inquiry Emails** - Japanese business email drafts
6. **Setsumei Translations** - NBTHK certification descriptions in English
7. **7-day Data Delay** - Free users see listings 7 days late

### Future Features (Phase 2+)
1. **Private Listings** - Exclusive dealer items (Inner Circle)
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
- `isDelayed` returns `false` (no 7-day data delay)
- DataDelayBanner is hidden
- Pricing page still exists but free tier shows "Browse all listings"

### Subscription Tiers (Post-Trial)

| Tier | Internal Name | Price | Key Features |
|------|---------------|-------|--------------|
| Free | `free` | $0 | Browse all listings, filters, favorites, currency conversion |
| Pro | `enthusiast` | $25/mo | Fresh data, email alerts, AI inquiry emails, data exports |
| Collector | `collector` | $99/mo | Everything in Pro + setsumei translations, artist stats, priority Juyo alerts |
| Inner Circle | `inner_circle` | $249/mo | Everything in Collector + private listings, Discord, LINE |
| Dealer | `dealer` | $150/mo | Pro features + analytics dashboard, competitive intel |

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
| Dealer analytics RPC | `supabase/migrations/072_dealer_analytics_rpc.sql` (5 SQL functions) |
| Admin dashboard | `src/app/admin/dealers/page.tsx` |
| Individual report | `src/app/admin/dealers/[id]/page.tsx` |
| Activity tracker | `src/lib/tracking/ActivityTracker.tsx` |
| Dwell tracking | `src/lib/viewport/DwellTracker.ts` |

**Data accuracy (2026-02-20):** Dealer analytics uses SQL RPC functions for aggregation (`get_dealer_click_stats`, `get_dealer_dwell_stats`, `get_dealer_favorite_stats`, etc.) instead of JS-side counting, which was silently truncating at Supabase's row limits.

**Gap for B2B launch:** Dealer self-serve portal (dealers can't log in to see their own data yet)

### Featured Score & Browse Sort Order

The `featured_score` column drives the default sort order in browse. Computed as `(quality + heat) × freshness`:

- **quality (0–395)** = artisan stature (elite_factor × 200 + √elite_count × 18, capped 100) × **price damping** + cert points (0–40) + completeness (0–55: images, price, attribution, measurements, description, era, school, HIGH confidence)
- **price damping** = `min(estimatedPriceJpy / ¥500K, 1)` — dampens artisan stature for cheap items where elite artisan matches are likely wrong attributions. A ¥30K item with an elite artisan match gets only 6% of the stature boost; ¥500K+ gets 100%. **NULL price (inquiry-based / "Ask") bypasses damping entirely (factor=1.0)** — "no listed price" ≠ "cheap". Currency-converted via rough rates (`CURRENCY_TO_JPY` in scoring.ts). Null currency defaults to JPY.
- **heat (0–160)** = 30-day behavioral data: favorites (×15, cap 60) + clicks (×10, cap 40) + quickview opens (×3, cap 24) + views (×1, cap 20) + pinch zooms (×8, cap 16)
- **freshness** = age multiplier: <3d→1.4, <7d→1.2, <30d→1.0, <90d→0.85, <180d→0.5, ≥180d→0.3. Initial imports = 1.0.
- Listings without images → score = 0.
- `UNKNOWN`/`unknown` artisan IDs → artisan stature = 0.

**Recompute triggers:**
- **Cron** (every 4h): batch recompute for all available listings. Also **auto-syncs elite_factor/elite_count** from Yuhinkai for any listing with `artisan_id` but NULL elite columns (cap 500/run, handles NS-* school codes).
- **Admin fix-cert**: recomputes inline after cert correction
- **Admin fix-artisan**: recomputes inline + syncs elite_factor/elite_count from Yuhinkai
- **Admin hide**: sets score to 0; unhide restores via recompute

**Important:** All admin endpoint recomputes use `await` (not fire-and-forget). Vercel serverless freezes functions after response is sent — unawaited promises never complete.

**Important:** The `listing_views` table uses `viewed_at` as its timestamp column (not `created_at`). The cron RPC correctly uses `viewed_at`, and all JS-side queries (Score Inspector, inline recompute) must also use `viewed_at`. A `created_at` column does not exist on this table — PostgREST returns 400, silently defaulting to 0 views via `count ?? 0`. This bug caused false "stale" indicators across all items with views (fixed 2026-02-24).

**Key files:**
| Component | Location |
|-----------|----------|
| Scoring module | `src/lib/featured/scoring.ts` (shared: `computeQuality`, `computeFreshness`, `computeFeaturedScore`, `recomputeScoreForListing`) |
| Cron batch recompute | `src/app/api/cron/compute-featured-scores/route.ts` |
| Fix cert (inline recompute) | `src/app/api/listing/[id]/fix-cert/route.ts` |
| Fix artisan (inline recompute + elite sync) | `src/app/api/listing/[id]/fix-artisan/route.ts` |
| Hide/unhide (inline recompute) | `src/app/api/listing/[id]/hide/route.ts` |
| Score breakdown (admin diagnostics) | `src/app/api/listing/[id]/score-breakdown/route.ts` |
| Score Inspector UI | `src/components/listing/AdminScoreInspector.tsx` |
| Tests (85) | `tests/lib/featured/scoring.test.ts` |
| Session doc | `docs/SESSION_20260222_FEATURED_SCORE_RECOMPUTE.md` |
| Postmortem | `docs/POSTMORTEM_FEATURED_SCORE_NULL_PRICE_ELITE_SYNC.md` |

### Cheap Elite Artisan Suppression

The artisan matcher (Oshi-scrapper) assigns confidence based purely on match quality (kanji match, LLM consensus) with no price awareness. This causes misattributions — e.g., Horikawa Kunihiro (KUN232, elite_factor 0.21) matched to a ¥6,600 tsuba. Cheap items with elite artisan matches are almost always wrong.

**Fix (two layers):**

1. **Confidence downgrade (DB)** — `artisan_confidence` set to `NONE` for listings where `price_jpy < ¥100K` AND `artisan_elite_factor > 0.05`. NONE confidence hides the artisan badge entirely in the UI (existing display code checks confidence). Migration `088_artisan_confidence_cheap_downgrade.sql` backfilled 148 rows (2026-02-24).

2. **Featured score damping (scoring.ts)** — `price_damping = min(priceJpy / ¥500K, 1)` multiplies artisan stature in the quality score. A ¥30K item gets only 6% of the stature boost. This is a secondary defense that affects sort order even if confidence isn't downgraded.

**Scraper gap (TODO):** Oshi-scrapper's `artisan_matcher/matcher.py:save_result()` does not apply price-based confidence downgrade. New cheap listings with elite matches will continue to get HIGH/MEDIUM confidence until the scraper is patched. Fix location: `save_result()` should check `price_jpy < 100000 AND elite_factor > 0.05` before writing confidence, and downgrade to NONE.

**Thresholds:**
- Price: `< ¥100,000` (items under ¥100K with elite artisan matches are suspect)
- Elite factor: `> 0.05` (artisans with meaningful Juyo/Tokuju presence)
- `artisan_admin_locked` items are never affected (admin overrides take precedence)

**Key files:**
| Component | Location |
|-----------|----------|
| DB migration (backfill) | `supabase/migrations/088_artisan_confidence_cheap_downgrade.sql` |
| Featured score damping | `src/lib/featured/scoring.ts` (`computeQuality`, `PRICE_DAMPING_CEILING_JPY`) |
| Scraper match writer | `Oshi-scrapper/artisan_matcher/matcher.py` (`save_result()` — needs price check) |
| Badge visibility | `src/components/browse/ListingCard.tsx` (hides badge when confidence = NONE) |

### Smart Crop Focal Points

Listing card thumbnails use AI-detected focal points to crop images intelligently instead of defaulting to center-center. Uses `smartcrop-sharp` to detect the most visually important area of each image (face detection, edge analysis, saturation mapping) and stores the crop center as `focal_x`/`focal_y` percentages (0-100) in the database.

**How it works:**
1. **Backfill script** (`scripts/backfill-focal-points.ts`) — One-shot bulk processing with `--dry-run`, `--limit`, `--dealer`, `--recompute` flags
2. **Cron job** (`/api/cron/compute-focal-points`) — Every 4h at :30, picks up new listings with NULL focal points (cap 500/run)
3. **Postgres trigger** (`080_focal_point_invalidation.sql`) — BEFORE UPDATE trigger NULLs focal_x/focal_y when `images` or `stored_images` change, so cron recomputes
4. **CSS rendering** — `object-position: {focal_x}% {focal_y}%` on the `<Image>` component's style prop

**Data flow:**
```
Scraper writes listing → images column populated → focal_x/focal_y are NULL
    ↓
Cron (every 4h): fetch NULL focal_x listings → download image → sharp resize to 512px
    → smartcrop.crop() with 3:4 target → store focal_x/focal_y percentages
    ↓
Browse API: SELECT focal_x, focal_y → VirtualListingGrid computes focalPosition string
    → ListingCard receives focalPosition prop → <Image style={{ objectPosition }}>
```

**Admin toggle:** Admin users see a "Smart Crop" on/off switch in the FilterSidebar panel controls (desktop). Persisted in localStorage (`nihontowatch-smart-crop`). Lets admin compare smart crop vs center-center in real time. Non-admin users always get the env var default (`NEXT_PUBLIC_SMART_CROP`, default ON).

**Feature flag:** `NEXT_PUBLIC_SMART_CROP=false` disables for all users. `isSmartCropActive()` in `src/types/subscription.ts` reads this.

**Performance:** Feature flag evaluates once per grid render in VirtualListingGrid (not per-card). The `focalPosition` string is computed in the parent and passed as a prop to ListingCard.

**Image change invalidation:** When a dealer re-photographs an item and the scraper updates `images` or `stored_images`, the Postgres trigger automatically NULLs the focal points. The cron picks it up within 4 hours.

**Key files:**
| Component | Location |
|-----------|----------|
| Cron job | `src/app/api/cron/compute-focal-points/route.ts` |
| Backfill script | `scripts/backfill-focal-points.ts` |
| Feature flag | `src/types/subscription.ts` (`isSmartCropActive()`) |
| Focal position prop | `src/components/browse/VirtualListingGrid.tsx` (computes per-listing, passes to card) |
| Image rendering | `src/components/browse/ListingCard.tsx` (`focalPosition` prop → `objectPosition` style) |
| Admin toggle UI | `src/components/browse/FilterSidebar.tsx` (PanelControls zone, admin-only) |
| Toggle state | `src/app/HomeClient.tsx` (`smartCropEnabled` localStorage state) |
| Pass-through | `src/components/browse/ListingGrid.tsx` (`smartCropEnabled` prop) |
| DB columns | `supabase/migrations/078_focal_point.sql` (`focal_x REAL, focal_y REAL`) |
| Invalidation trigger | `supabase/migrations/080_focal_point_invalidation.sql` |
| Cron schedule | `vercel.json` (`30 */4 * * *` — offset from featured-scores at :00) |
| **Full documentation** | `docs/SMART_CROP_FOCAL_POINTS.md` |

### Listing Data Localization (i18n)

UI chrome (labels, buttons, nav) uses the `useLocale()` hook and `t()` function from `LocaleContext.tsx` with ~1090 keys across `en.json` and `ja.json`. **Listing data** (titles, descriptions, artisan names) is also locale-aware:

**Behavior by locale:**
- **JA locale**: Shows original Japanese data by default for JP-source listings. For EN-source listings (international dealers), shows `title_ja`/`description_ja` (auto-translated). Translation toggle ("翻訳を表示") reveals English version.
- **EN locale**: Shows English translations by default — `listing.title_en`, `listing.description_en`, romanized names. "Show original" toggle reveals Japanese.

**Bidirectional translation (`/api/translate`):**
- Auto-detects direction from source text: Japanese → EN (`title_en`/`description_en`), English → JP (`title_ja`/`description_ja`)
- Model: `google/gemini-3-flash-preview` (via OpenRouter)
- EN→JP prompts use natural nihonto terminology in kanji (銘, 無銘, 長さ, 反り, 赤銅, 四分一)
- Shared `containsJapanese()` utility in `src/lib/text/japanese.ts` (single source of truth for JAPANESE_REGEX)

**How it works:**
1. **TranslatedTitle** — JA shows `title_ja` (cached JP translation) for EN-source listings, falls back to `title`. EN shows `title_en` (auto-translates via `/api/translate` if missing). Both directions auto-fetch on demand.
2. **TranslatedDescription** — Bidirectional: JA locale auto-fetches JP translation for EN-source listings; EN locale auto-fetches EN translation for JP-source listings. Toggle labels localized.
3. **MetadataGrid `getArtisanInfo(listing, locale)`** — JA returns kanji smith/maker/school directly; EN romanizes via `title_en` extraction, filters out Japanese-only names. Also localizes `mei_type` via `td('meiType', ...)` → "Signed"/"在銘".
4. **ListingCard** — `cleanedTitle` uses `title_en` for EN locale, `title_ja` for JA locale (if available), falls back to `title`.
5. **QuickViewContent** — Shows `artisan_name_kanji` for JA locale, `artisan_display_name` for EN.

**i18n keys for listing data:**

| Key | EN | JA |
|-----|----|----|
| `listing.showOriginal` | Show original | 原文を表示 |
| `listing.showTranslation` | Show translation | 翻訳を表示 |
| `listing.readMore` | Read more | 続きを読む |
| `listing.showLess` | Show less | 閉じる |
| `listing.translationUnavailable` | (Translation unavailable) | （翻訳なし） |
| `meiType.mei` | Signed | 在銘 |
| `meiType.mumei` | Unsigned | 無銘 |

**Key files:**
| Component | Location |
|-----------|----------|
| Translate API (bidirectional) | `src/app/api/translate/route.ts` |
| `containsJapanese()` utility | `src/lib/text/japanese.ts` |
| TranslatedTitle | `src/components/listing/TranslatedTitle.tsx` |
| TranslatedDescription | `src/components/listing/TranslatedDescription.tsx` |
| MetadataGrid (`getArtisanInfo`) | `src/components/listing/MetadataGrid.tsx` |
| ListingCard (cleanedTitle) | `src/components/browse/ListingCard.tsx` |
| QuickViewContent (artisan kanji) | `src/components/listing/QuickViewContent.tsx` |
| Locale context | `src/i18n/LocaleContext.tsx` |
| EN strings | `src/i18n/locales/en.json` |
| JA strings | `src/i18n/locales/ja.json` |
| DB migration | `supabase/migrations/083_ja_translation_columns.sql` |
| Tests (57+41) | `tests/lib/listing-data-localization.test.ts`, `tests/components/listing/TranslatedTitle.test.tsx`, `tests/components/listing/TranslatedDescription.test.tsx`, `tests/components/listing/listing-data-locale.test.tsx`, `tests/components/listing/MetadataGrid-locale.test.tsx`, `tests/api/translate.test.ts` |

### Dealer Name Localization (i18n)

Japanese dealers display their official kanji/kana names when locale is JA (e.g., "Ginza Seikodo" → "銀座盛光堂"). International dealers show English names in both locales.

**How it works:**
- `dealers.name_ja` column stores verified Japanese names (NULL for international dealers)
- `getDealerDisplayName(dealer, locale)` centralized utility returns `name_ja` for JA, English name for EN
- `getDealerDisplayNameEN(dealer)` always returns English (for slugs, SEO, analytics)
- Filter sidebar groups dealers into "日本" and "International" via `DEALER_COUNTRIES` map in FilterContent.tsx
- Browse facets RPC (`get_browse_facets`) includes `name_ja` in JSONB response

**Important:** All 39 Japanese names were verified from official dealer websites (title tags, headers, 特定商取引法 pages). AI-guessing is dangerously inaccurate — 24/36 initial guesses were wrong. Always verify against the dealer's own site.

**What stays English (never localized):**
- URL slugs (`createDealerSlug()`)
- SEO meta tags (`generateMetadata()`)
- JSON-LD structured data
- OG images (`sanitizeText()` strips non-ASCII)
- Admin pages, analytics tracking
- Sitemap URLs

**Key files:**
| Component | Location |
|-----------|----------|
| Display name utility | `src/lib/dealers/displayName.ts` |
| Dealer grouping map | `src/components/browse/FilterContent.tsx` (`DEALER_COUNTRIES`) |
| DB migration | `supabase/migrations/084_dealer_name_ja.sql` |
| RPC function | `get_browse_facets` (returns `name_ja` in dealer facets) |
| Type definition | `src/types/index.ts` (`Dealer.name_ja`) |

### Japanese UX Tuning (Locale-Conditional)

Beyond i18n string translation, the UI applies locale-conditional UX changes for Japanese users based on established JA web design conventions (*ichimokuryouzen*, *omotenashi*):

**Typography (CSS):**
- Body line-height 1.85 (vs EN 1.65) — kanji fill full em-box, need more vertical air
- Heading line-height 1.4 (vs EN 1.25)
- Italic → bold (`font-weight: 600`) — Japanese has no true italic glyphs; oblique rendering looks broken. Scoped with `:not(:lang(en))` for embedded English
- Prose translation sections use Noto Sans JP, not Cormorant Garamond

**Information Density:**
- Filter sidebar: 4 sections (Period, Type, Signature, Dealer) expand by default in JA, collapsed in EN
- Listing cards: JA-only nagasa (cm) + era metadata row between attribution and price
- Freshness timestamps: "Confirmed 3h ago" / "3時間前に確認" in price row (desktop only)

**Social Sharing:**
- LINE share button (JA locale only) + Twitter/X (always visible) on listing detail and QuickView
- Pure URL-scheme links — no SDKs or API keys
- Uses `NEXT_PUBLIC_BASE_URL` for SSR-safe absolute URLs

**Empty States:**
- JA filter empty strings use polite instructive guidance (*omotenashi*) instead of terse labels

**Key files:**
| Component | Location |
|-----------|----------|
| JA typography CSS | `src/app/globals.css` (after `html[lang="ja"]` block) |
| Filter expand logic | `src/components/browse/FilterContent.tsx` (`defaultOpen={locale === 'ja'}`) |
| Card nagasa+era+freshness | `src/components/browse/ListingCard.tsx` |
| Relative time util | `src/lib/time.ts` (`formatRelativeTime()`) |
| Social share buttons | `src/components/share/SocialShareButtons.tsx` |
| Tests (14) | `tests/lib/time.test.ts` |
| Research doc | `docs/JAPANESE_UX_RECOMMENDATIONS.md` |
| Session doc | `docs/SESSION_20260222_JAPANESE_UX.md` |

### Artisan Code Display & Verification (Admin Feature)

Displays Yuhinkai artisan codes (e.g., "MAS590", "OWA009") on listing cards for admin users, with confidence-based color coding and QA verification.

**How it works:**
- Artisan matching runs in Oshi-scrapper (`artisan_matcher/` module)
- Matches listings to Yuhinkai database entries (12,453 smiths, 1,119 tosogu makers in `artisan_makers`)
- Stores `artisan_id` and `artisan_confidence` in listings table
- This is **separate from** oshi-v2's V7 catalog matching pipeline (see below)

**Oshi-v2 Artisan Index (Yuhinkai):**
- oshi-v2 has its own V7 pipeline (`scripts/artisan-matching-v6.js`) that links catalog records to artisans
- Results stored in `catalog_records.artisan_code_v5` and synthesized to `gold_values.gold_smith_id`/`gold_maker_id`
- NihontoWatch reads `gold_smith_id`/`gold_maker_id` via `yuhinkai.ts` for artist profile pages, form analysis, and provenance
- See `oshi-v2/docs/ARTISAN_MATCHING_V7.md` and `oshi-v2/docs/ARTISAN_PIPELINE_VERSION_HISTORY.md` for full details

**Display:**
- Badge appears on **right side** of certification row (e.g., "TOKUBETSU HOZON" left, artisan name right)
- Badge text shows **display name** (e.g., "Osafune Yasumitsu") resolved server-side from Yuhinkai, falling back to raw code if unavailable
- `artisan_display_name` field is enriched by browse and listing detail APIs via `getArtisanNames()` + `getArtisanDisplayName()`
- **Green** = HIGH confidence (exact kanji match or LLM consensus)
- **Yellow** = MEDIUM confidence (romaji match or school fallback)
- **Gray** = LOW confidence (LLM disagreement)
- **Hidden** = NONE confidence (no badge displayed — includes cheap elite suppression, see below)
- Admin users see tooltip with code, candidates, and verification buttons; non-admin badges link to `/artists/{code}`

**Tooltip (click badge):**
- Shows artisan details from Yuhinkai database (name kanji/romaji, school, province, era)
- Displays Juyo/Tokuju counts and match method
- Shows alternative candidates for QA review
- **Verification buttons**: ✓ Correct / ✗ Incorrect to flag match accuracy
- Verification saved to database with timestamp and admin user ID

**Search:**
- URL param: `?artisan=MAS590` (substring match)
- Search box: Type artisan code directly (e.g., "OWA009") - auto-detected by pattern

**Admin "Set Artisan" widget (QuickView):**
- Collapsible panel in QuickView for manually assigning artisan codes to unmatched listings
- Search with auto-detected type filtering (smith/tosogu based on item_type)
- Uses `/api/artisan/search` + `/api/listing/[id]/fix-artisan`
- Admin also sees edit pen icon next to artisan badges in QuickView for quick corrections via ArtisanTooltip

**Key files:**
| Component | Location |
|-----------|----------|
| CSS colors | `src/app/globals.css` (--artisan-high, --artisan-medium, --artisan-low) |
| Badge display | `src/components/browse/ListingCard.tsx` (certification row) |
| Tooltip component | `src/components/artisan/ArtisanTooltip.tsx` |
| Admin set artisan | `src/components/artisan/AdminArtisanWidget.tsx` |
| Artisan details API | `src/app/api/artisan/[code]/route.ts` |
| Artisan search API | `src/app/api/artisan/search/route.ts` |
| Fix artisan API | `src/app/api/listing/[id]/fix-artisan/route.ts` |
| Verification API | `src/app/api/listing/[id]/verify-artisan/route.ts` |
| Yuhinkai client | `src/lib/supabase/yuhinkai.ts` (`getArtisanNames()` for batch lookup) |
| Display name logic | `src/lib/artisan/displayName.ts` (`getArtisanDisplayName()`) |
| API filter | `src/app/api/browse/route.ts` (artisanCode param + display name enrichment) |
| DB schema | `supabase/migrations/048_artisan_matching.sql`, `049_artisan_verification.sql`, `054_artisan_admin_locked.sql` |

### Artist Feature (`/artists` + `/artists/[slug]`)

Two-tier artisan discovery system for 13,572 artisans (12,453 smiths + 1,119 tosogu makers) from the Yuhinkai `artisan_makers` directory:

1. **Directory** (`/artists`) — Filterable index with search, type/school/province/era filters, elite factor ranking. Cards show all 6 designation types (Kokuho, Jubun, Jubi, Gyobutsu, Tokuju, Juyo) and "N for sale" links that open browse with QuickView.

2. **Profile** (`/artists/[slug]`) — Rich individual pages with biography, certification pyramid, elite standing, blade form/signature analysis, teacher-student lineage, provenance (denrai), school ancestry breadcrumbs, and live listings.

**Architecture**: Hybrid SSR + client fetch. Initial page load is server-rendered. Filter changes use client-side `fetch()` to `/api/artists/directory` with `window.history.replaceState()` for URL updates (no SSR round-trip).

**Key files:**
| Component | Location |
|-----------|----------|
| Directory API | `src/app/api/artists/directory/route.ts` |
| Artisan API (detail) | `src/app/api/artisan/[code]/route.ts` |
| Directory page | `src/app/artists/page.tsx` + `ArtistsPageClient.tsx` |
| Profile page | `src/app/artists/[slug]/page.tsx` + `ArtistPageClient.tsx` |
| Shared components | `src/components/artisan/` (Tooltip, Listings, Pyramid, Elite, etc.) |
| **Shared page data** | `src/lib/artisan/getArtistPageData.ts` — `buildArtistPageData()` used by SSR + API |
| **Page response type** | `src/types/artisan.ts` — `ArtisanPageResponse` shared type |
| **Display name dedup** | `src/lib/artisan/displayName.ts` — **all artisan name rendering goes through here** |
| **School expansion** | `src/lib/artisan/schoolExpansion.ts` — `expandArtisanCodes()` for NS-* → member codes |
| **School ancestry** | `src/lib/supabase/yuhinkai.ts` — `getSchoolAncestry()` calls `get_school_ancestry` RPC for breadcrumb path |
| **Attribution utility** | `src/lib/listing/attribution.ts` — `getAttributionName()` / `getAttributionSchool()` |
| DB queries | `src/lib/supabase/yuhinkai.ts` — `getArtisan()` is the single lookup function |
| Slug utils | `src/lib/artisan/slugs.ts` |
| **Full documentation** | `docs/ARTIST_FEATURE.md` (includes display name rules + how to fix) |

### Collection Manager (`/collection`)

Personal item cataloging for authenticated users. Four entry paths: manual, artisan-linked, Yuhinkai catalog lookup, and "I Own This" from browse. Client-side image resize + Supabase Storage upload.

**Key files:**
| Component | Location |
|-----------|----------|
| Collection page | `src/app/collection/page.tsx` + `CollectionPageClient.tsx` |
| Components (9) | `src/components/collection/` (Card, Grid, QuickView, Form, ImageUpload, etc.) |
| API routes (6) | `src/app/api/collection/` (items, images, catalog-search, artisan-search, folders) |
| Context | `src/contexts/CollectionQuickViewContext.tsx` |
| Utilities | `src/lib/collection/catalogMapping.ts`, `listingImport.ts` |
| Types | `src/types/collection.ts` |
| DB migration | `supabase/migrations/057_collection_tables.sql` |
| Storage bucket | `collection-images` (Supabase Storage, public) |
| "I Own This" button | `src/components/listing/QuickViewContent.tsx` (line ~375) |
| Nav links | `src/components/layout/Header.tsx`, `MobileNavDrawer.tsx` (auth-gated) |
| **Full documentation** | `docs/COLLECTION_MANAGER.md` |

### Documentation

For detailed implementation docs, see:
- `docs/COLLECTION_MANAGER.md` - **Collection Manager** (cataloging, Yuhinkai lookup, image upload, all file paths)
- `docs/ARTIST_FEATURE.md` - **Comprehensive artist feature documentation** (directory + profiles + admin badges)
- `docs/SUBSCRIPTION_HANDOFF.md` - Current status and changelog
- `docs/PRO_TIER_IMPLEMENTATION.md` - Implementation checklist
- `docs/PRO_TIER_STRATEGY.md` - Business strategy
- `docs/SESSION_20260208_ARTIST_DIRECTORY.md` - Artist directory implementation session
- `docs/SESSION_20260209_ADMIN_SET_ARTISAN.md` - Admin artisan assignment widget session
- `docs/SESSION_20260210_ADMIN_LOCK.md` - Admin artisan lock protection (prevents scraper overwrites)
- `docs/CATALOGUE_PUBLICATION_PIPE.md` - **Catalogue publication pipe** — Yuhinkai→NihontoWatch content flow (cross-repo)
- `docs/SESSION_20260220_ADMIN_PANEL_OVERHAUL.md` - Admin panel security, data accuracy & UI overhaul (19 fixes, 3 SQL migrations)
- `docs/SESSION_20260222_FEATURED_SCORE_RECOMPUTE.md` - Inline featured score recompute on admin actions + serverless fire-and-forget postmortem
- `docs/POSTMORTEM_FEATURED_SCORE_NULL_PRICE_ELITE_SYNC.md` - **NULL price zeroed artisan stature + cron never synced elite_factor** — two compounding bugs, Juyo Ichimonji scored 98→333
- `docs/SMART_CROP_FOCAL_POINTS.md` - **Smart crop focal points** — AI image cropping, cron pipeline, admin toggle, invalidation trigger
- `docs/SESSION_20260222_JAPANESE_UX.md` - JA UX improvements — typography, filter expand, card metadata, freshness timestamps, LINE+Twitter/X share, polite empty states
- `docs/JAPANESE_UX_RECOMMENDATIONS.md` - JA UX research — design philosophy, typography, density, trust signals, navigation patterns
- `supabase/migrations/088_artisan_confidence_cheap_downgrade.sql` - **Cheap elite suppression** — backfill 148 misattributed cheap items to NONE confidence

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

### Listing Detail SSR
The listing detail page (`/listing/[id]`) server-renders the full listing content via `getListingDetail()` (`src/lib/listing/getListingDetail.ts`). This shared function fetches from Supabase and applies all enrichments (dealer baseline, Yuhinkai, artisan display name/tier, price history fallback). The enriched listing is passed as `initialData` to the client component, so Googlebot sees h1, price, specs, dealer info, and images in the initial HTML. See `docs/SEO.md` for full architecture.

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
9. **NEVER use fire-and-forget promises in API routes** - Vercel serverless freezes functions the instant the HTTP response is sent. Unawaited promises (`someAsyncFn().catch(...)`) will never complete. Always `await` side effects with `try/catch`. If work genuinely needs to run after the response, use Vercel's `waitUntil()` API. This bit us in the featured score recompute — the DB update never ran (see `docs/SESSION_20260222_FEATURED_SCORE_RECOMPUTE.md`).
11. **`listing_views` uses `viewed_at`, not `created_at`** - This table's timestamp column is `viewed_at`. All other behavioral tables (`user_favorites`, `dealer_clicks`, `activity_events`) use `created_at`. When querying `listing_views` with a time filter, always use `.gte('viewed_at', ...)`. Using `created_at` silently returns 0 rows (PostgREST 400 swallowed by `count ?? 0`). This caused false "stale" scores across the entire catalog for months.
10. **NEVER use `{ passive: false }` on touchmove listeners** - This is the single most common regression in this codebase. A non-passive `touchmove` on ANY scrollable element (or its ancestors) blocks the compositor from fast-pathing scroll. Chrome DevTools mobile emulation translates two-finger trackpad scroll into touch events — a non-passive listener kills it instantly. This has broken the build **4 separate times** (bottom sheet drag, artisan tooltip drag, image scroller top-bounce prevention, edge swipe dismiss). **The rule:** never call `addEventListener('touchmove', fn, { passive: false })` on or above a scrollable container. If you need to conditionally `preventDefault()` a touch gesture, use a CSS property toggle from a passive `scroll` listener instead (see `docs/POSTMORTEM_PASSIVE_TOUCHMOVE.md` for safe patterns).

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
