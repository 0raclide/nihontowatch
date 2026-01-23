# Nihontowatch Architecture

## Production Status

**Live at:** https://nihontowatch.com

**Deployment:** Vercel (auto-deploy from CLI)

**Last Updated:** January 2026

---

## System Overview

Nihontowatch is a **read-heavy** application. The scraping backend (Oshi-scrapper) writes data, and the frontend (nihontowatch) reads and displays it.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                       │
│                    Collectors, Dealers, Researchers                      │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NIHONTOWATCH.COM                                 │
│                      (Next.js 15 on Vercel)                             │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │   Browse   │  │   Search   │  │  Listing   │  │  Dealers   │        │
│  │   /browse  │  │  /search   │  │ /listing/* │  │  /dealers  │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
│        │               │               │               │                │
│        └───────────────┴───────┬───────┴───────────────┘                │
│                                │                                         │
│                    ┌───────────▼───────────┐                            │
│                    │    API Routes         │                            │
│                    │  /api/browse          │                            │
│                    │  /api/search          │                            │
│                    │  /api/listings        │                            │
│                    └───────────┬───────────┘                            │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       SUPABASE          │
                    │    (PostgreSQL)         │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │    listings     │   │ ◄── Primary table
                    │  │    (50k+ rows)  │   │
                    │  └────────┬────────┘   │
                    │           │            │
                    │  ┌────────▼────────┐   │
                    │  │    dealers      │   │
                    │  │    (50+ rows)   │   │
                    │  └─────────────────┘   │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │  price_history  │   │
                    │  │  discovered_urls│   │
                    │  │  scrape_runs    │   │
                    │  └─────────────────┘   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     OSHI-SCRAPPER       │
                    │   (Python on GitHub     │
                    │    Actions - Daily)     │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │ Discovery       │   │ ── Find new URLs
                    │  │ Crawlers (16)   │   │
                    │  └────────┬────────┘   │
                    │           │            │
                    │  ┌────────▼────────┐   │
                    │  │ Item Scrapers   │   │ ── Extract data
                    │  │ (18 dealers)    │   │
                    │  └────────┬────────┘   │
                    │           │            │
                    │  ┌────────▼────────┐   │
                    │  │ LLM Extraction  │   │ ── Enhance metadata
                    │  │ (Optional)      │   │
                    │  └─────────────────┘   │
                    └─────────────────────────┘
```

---

## Data Flow

### 1. Discovery Phase (Daily)

```
GitHub Actions Cron (6am JST)
         │
         ▼
┌─────────────────┐
│ Discovery       │
│ Crawlers        │──── Iterate dealer catalogs
└────────┬────────┘     Extract product URLs
         │
         ▼
┌─────────────────┐
│ discovered_urls │──── Store new URLs
│ table           │     Mark priority
└─────────────────┘
```

### 2. Scraping Phase (Daily)

```
┌─────────────────┐
│ discovered_urls │──── Get unscraped URLs
│ (priority ASC)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Item Scrapers   │──── Fetch page HTML
│ (per dealer)    │     Extract: title, price, specs, images
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ listings table  │──── Upsert listing data
│                 │     Track price changes
└─────────────────┘
```

### 3. Display Phase (Real-time)

```
User Request: /browse?type=katana
         │
         ▼
┌─────────────────┐
│ API Route       │──── Parse filters
│ /api/browse     │     Build query
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Supabase Query  │──── SELECT with filters
│ listings +      │     JOIN dealers
│ dealers         │     ORDER BY, LIMIT
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ React Component │──── Render cards
│ ListingGrid     │     Handle pagination
└─────────────────┘
```

---

## Database Schema

### Core Tables

```sql
-- Dealers (source websites)
CREATE TABLE dealers (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  catalog_url TEXT,
  country TEXT DEFAULT 'JP',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  earliest_listing_at TIMESTAMPTZ  -- When dealer's first listing was discovered
);

-- Listings (scraped items)
CREATE TABLE listings (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  dealer_id INTEGER REFERENCES dealers(id),

  -- Status
  status TEXT DEFAULT 'unknown',
  is_available BOOLEAN,
  is_sold BOOLEAN,
  page_exists BOOLEAN DEFAULT true,

  -- Basic info
  title TEXT,
  description TEXT,
  item_type TEXT,
  item_category TEXT,

  -- Price
  price_value NUMERIC,
  price_currency TEXT DEFAULT 'JPY',
  price_raw TEXT,

  -- Sword specifications
  nagasa_cm NUMERIC,
  sori_cm NUMERIC,
  motohaba_cm NUMERIC,
  sakihaba_cm NUMERIC,
  kasane_cm NUMERIC,
  weight_g NUMERIC,

  -- Tosogu specifications
  tosogu_maker TEXT,
  tosogu_school TEXT,
  material TEXT,
  height_cm NUMERIC,
  width_cm NUMERIC,

  -- Attribution
  smith TEXT,
  school TEXT,
  province TEXT,
  era TEXT,
  mei_type TEXT,

  -- Certification
  cert_type TEXT,
  cert_session INTEGER,
  cert_organization TEXT,

  -- Media
  images JSONB DEFAULT '[]',
  raw_page_text TEXT,

  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at TIMESTAMPTZ DEFAULT NOW(),
  scrape_count INTEGER DEFAULT 1,

  -- Sorting
  is_initial_import BOOLEAN DEFAULT TRUE,  -- TRUE = bulk import, FALSE = genuine new

  -- Indexes
  INDEX idx_listings_dealer (dealer_id),
  INDEX idx_listings_type (item_type),
  INDEX idx_listings_price (price_value),
  INDEX idx_listings_status (status)
);

-- Price history (track changes)
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id),
  old_price NUMERIC,
  new_price NUMERIC,
  old_currency TEXT,
  new_currency TEXT,
  change_type TEXT, -- 'increase', 'decrease', 'new', 'sold'
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovery queue
CREATE TABLE discovered_urls (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  dealer_id INTEGER REFERENCES dealers(id),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at TIMESTAMPTZ,
  is_scraped BOOLEAN DEFAULT false,
  scrape_priority INTEGER DEFAULT 0
);
```

### Indexes for Performance

```sql
-- Full-text search
CREATE INDEX idx_listings_title_fts ON listings USING gin(to_tsvector('english', title));

-- Faceted browsing
CREATE INDEX idx_listings_item_type ON listings(item_type) WHERE is_available = true;
CREATE INDEX idx_listings_dealer ON listings(dealer_id) WHERE is_available = true;
CREATE INDEX idx_listings_school ON listings(school) WHERE is_available = true;
CREATE INDEX idx_listings_cert ON listings(cert_type) WHERE is_available = true;

-- Price range queries
CREATE INDEX idx_listings_price_range ON listings(price_value) WHERE is_available = true;

-- Recent listings
CREATE INDEX idx_listings_recent ON listings(first_seen_at DESC) WHERE is_available = true;
```

---

## API Design

### Browse Endpoint

```typescript
// GET /api/browse
interface BrowseParams {
  // Pagination
  page?: number;        // Default: 1
  limit?: number;       // Default: 24, Max: 100

  // Filters
  type?: string;        // Item type: katana, tsuba, etc.
  dealer?: string;      // Dealer slug
  certification?: string; // Cert type: juyo, hozon, etc.
  school?: string;      // School name
  minPrice?: number;
  maxPrice?: number;

  // Search
  q?: string;           // Full-text search

  // Sort
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'name';
}

interface BrowseResponse {
  listings: Listing[];
  total: number;
  page: number;
  totalPages: number;
  facets: {
    types: { name: string; count: number }[];
    dealers: { name: string; count: number }[];
    certifications: { name: string; count: number }[];
    schools: { name: string; count: number }[];
    priceRanges: { label: string; min: number; max: number; count: number }[];
  };
}
```

### Listing Detail Endpoint

```typescript
// GET /api/listings/[id]
interface ListingDetail extends Listing {
  dealer: Dealer;
  priceHistory: PriceChange[];
  similarListings: Listing[];
}
```

---

## Caching Strategy

### Edge Caching (Vercel)

```typescript
// In API route
export const revalidate = 300; // 5 minutes

// Or with cache tags
export async function GET() {
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
    }
  });
}
```

### Client-side Caching

```typescript
// SWR configuration
const { data } = useSWR('/api/browse', fetcher, {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  dedupingInterval: 60000, // 1 minute
});
```

### Database Query Caching

```typescript
// Supabase with cache headers
const { data } = await supabase
  .from('listings')
  .select('*')
  .eq('dealer_id', dealerId)
  .limit(24);
  // Supabase handles connection pooling
```

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| **LCP** | < 2.5s | SSG for static pages, ISR for listings |
| **FID** | < 100ms | Code splitting, lazy loading |
| **CLS** | < 0.1 | Image dimensions, skeleton loaders |
| **TTFB** | < 200ms | Edge caching, DB indexes |
| **API Response** | < 500ms | Query optimization, caching |

---

## Security

### Authentication (Future)

```
User Login (Magic Link)
       │
       ▼
Supabase Auth
       │
       ▼
JWT Token (HttpOnly cookie)
       │
       ▼
API Route validates token
       │
       ▼
Row Level Security (RLS)
```

### Rate Limiting

```typescript
// Vercel Edge Config or custom middleware
const rateLimit = {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // requests per window
};
```

### Input Validation

```typescript
// Zod schemas for all inputs
const BrowseSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
  type: z.enum(['katana', 'wakizashi', 'tsuba', ...]).optional(),
  // ...
});
```

---

## Monitoring

### Vercel Analytics
- Page views, unique visitors
- Web Vitals (LCP, FID, CLS)
- Geographic distribution

### Supabase Dashboard
- Query performance
- Database size
- API usage

### Custom Metrics (Future)
- Search queries (popular terms)
- Filter usage
- Listing views
- Click-through to dealers

---

## Scaling Considerations

### Current Capacity
- ~50k listings
- ~50 dealers
- ~1k daily active users (estimated)

### Growth Path

| Scale | Challenge | Solution |
|-------|-----------|----------|
| 100k listings | Query performance | Materialized views, better indexes |
| 500k listings | Database size | Partitioning by dealer/date |
| 10k DAU | API load | Edge caching, read replicas |
| 100 dealers | Scraper load | Parallel processing, queue system |

---

## Disaster Recovery

### Database
- Supabase automatic backups (daily)
- Point-in-time recovery (7 days)

### Code
- Git history on GitHub
- Vercel deployment history

### Scraper State
- `discovered_urls` table is recoverable
- Re-scrape from scratch if needed (24-48h)

---

## Current App Layer Implementation

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Main browse page (collection grid with filters) |
| `/browse` | Redirects to `/` |
| `/api/browse` | Browse API with faceted filtering |
| `/api/exchange-rates` | Currency conversion rates |

### Homepage (Browse Page)

The homepage directly shows the collection grid - no landing page.

**Default Settings:**
- Currency: **JPY** (Japanese Yen)
- Sort: **Price high to low** (`price_desc`)
- Items per page: **100**
- Tab: **Available only** (sold archive hidden)

**Filter Sidebar Order:**
1. Category (All / Nihonto / Tosogu)
2. Dealer (dropdown with search)
3. Price on request only (toggle)
4. Certification (Jūyō, Tokubetsu Hozon, Hozon, etc.)
5. Type (Katana, Wakizashi, Tsuba, etc.)

### Image Optimization

Images are optimized for fast loading with multiple strategies:

```
┌─────────────────────────────────────────────┐
│           Image Loading Flow                │
├─────────────────────────────────────────────┤
│ 1. Skeleton shimmer (animated placeholder)  │
│ 2. Blur placeholder (base64 SVG)            │
│ 3. Image loads in background                │
│ 4. Fade-in transition on load               │
│ 5. Error fallback (icon) if load fails      │
└─────────────────────────────────────────────┘
```

**Configuration (next.config.ts):**
- Modern formats: AVIF, WebP (auto-served)
- Cache TTL: 30 days
- Priority loading: First 10 images
- Device sizes: 640, 750, 828, 1080, 1200, 1920

**Cache Headers:**
```
Cache-Control: public, max-age=31536000, immutable
```

### Component Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage (browse functionality)
│   ├── browse/page.tsx       # Redirects to /
│   ├── globals.css           # Tailwind + custom styles
│   └── api/
│       ├── browse/route.ts   # Browse API
│       └── exchange-rates/   # Currency API
├── components/
│   ├── browse/
│   │   ├── FilterSidebar.tsx # Faceted filters
│   │   ├── ListingGrid.tsx   # Card grid + pagination
│   │   └── ListingCard.tsx   # Individual card with image
│   ├── layout/
│   │   └── Header.tsx        # Site header
│   └── ui/
│       ├── CurrencySelector.tsx
│       └── ThemeToggle.tsx
└── lib/
    ├── constants.ts          # Pagination, cache, routes
    └── supabase/             # Database client
```

### Styling

- **Framework:** Tailwind CSS v4
- **Theme:** Scholarly collector aesthetic
- **Colors:** Warm museum whites, gold accents
- **Dark mode:** Supported via class toggle

**Key Design Tokens:**
```css
--cream: #FAF9F6      /* Background */
--ink: #1C1C1C        /* Text */
--gold: #B8860B       /* Accent */
--burgundy: #6B2D35   /* Jūyō certification */
--toku-hozon: #2D4A4A /* Tokubetsu Hozon */
```

### State Management

Client-side state with URL sync:
- Filters, sort, page → URL params
- Currency preference → localStorage
- Exchange rates → fetched on mount

```typescript
// URL params example
/?tab=available&cat=nihonto&type=katana&sort=price_desc&page=2
```

---

## Deployment

### Production Deploy

```bash
vercel --prod --yes
```

Deploys directly to nihontowatch.com (no git push required).

### DNS Configuration

Domain managed at GoDaddy, pointing to Vercel:
- A record: `@` → `76.76.21.21`
- CNAME: `www` → `cname.vercel-dns.com`
