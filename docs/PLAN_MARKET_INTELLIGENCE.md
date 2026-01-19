# Market Intelligence Dashboard - Implementation Plan

> **Status**: Planning
> **Created**: 2025-01-19
> **Priority**: High - Admin Feature

---

## Executive Summary

Build a comprehensive market intelligence dashboard for Nihontowatch administrators to analyze the Japanese sword and tosogu market. This system will provide real-time insights into market value, price distributions, dealer performance, and trends - similar to Chrono24's watch market analytics.

### Goals
1. **Total Market Visibility**: Know the complete value of inventory on offer
2. **Price Intelligence**: Understand pricing patterns across categories and dealers
3. **Trend Detection**: Identify market movements before competitors
4. **Dealer Analytics**: Compare dealer pricing and inventory strategies
5. **Export & Reporting**: Generate shareable market reports

---

## Industry Analysis: How Chrono24 Does It

### Their Approach

Chrono24 produces market intelligence through:

| Component | Implementation |
|-----------|----------------|
| **Watch Market Index** | Weighted basket of 30 popular references, tracked daily |
| **Price Guide** | Rolling 90-day median from sales + active listings |
| **Trend Analysis** | Linear regression with seasonal decomposition |
| **Demand Signals** | Views, saves, inquiries per listing |
| **Regional Analysis** | Geographic price differentials |

### Technical Stack (Inferred)

- **Data Warehouse**: ClickHouse or BigQuery for OLAP queries
- **Time-Series DB**: TimescaleDB for price history
- **Caching Layer**: Redis for dashboard performance
- **Visualization**: Custom D3.js charts
- **ML Pipeline**: Python for predictions and anomaly detection

### Key Insight

Chrono24's intelligence is valuable because they:
1. Track **sold** items (not just available) for true market prices
2. Maintain **historical snapshots** for trend analysis
3. Use **medians** not means (resistant to outliers)
4. Calculate **rolling windows** (7d, 30d, 90d, YoY)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MARKET INTELLIGENCE SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DATA LAYER                 ANALYTICS LAYER           PRESENTATION      │
│   ──────────                 ───────────────           ────────────      │
│                                                                          │
│  ┌──────────────┐          ┌──────────────┐         ┌──────────────┐   │
│  │   Supabase   │          │   API Routes │         │    Admin     │   │
│  │   ─────────  │          │   ─────────  │         │  Dashboard   │   │
│  │              │          │              │         │              │   │
│  │ • listings   │────────▶ │ • Aggregates │───────▶ │ • Overview   │   │
│  │ • price_hist │          │ • Statistics │         │ • Charts     │   │
│  │ • dealers    │          │ • Time-series│         │ • Filters    │   │
│  │ • snapshots  │          │ • Anomalies  │         │ • Reports    │   │
│  │   (new)      │          │              │         │              │   │
│  └──────────────┘          └──────────────┘         └──────────────┘   │
│         │                                                    │          │
│         │              ┌──────────────┐                     │          │
│         └─────────────▶│    Cache     │◀────────────────────┘          │
│                        │  (Vercel/KV) │                                 │
│                        └──────────────┘                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Foundation

### New Database Objects

#### 1. Market Daily Snapshots Table

Captures point-in-time market state for historical analysis.

```sql
-- Store daily market snapshots for time-series analysis
CREATE TABLE market_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,

  -- Aggregate counts
  total_listings INTEGER NOT NULL,
  available_listings INTEGER NOT NULL,
  sold_listings INTEGER NOT NULL,
  new_listings_24h INTEGER NOT NULL,
  sold_24h INTEGER NOT NULL,
  price_changes_24h INTEGER NOT NULL,

  -- Market value (in JPY, normalized)
  total_market_value_jpy BIGINT NOT NULL,
  median_price_jpy INTEGER,
  avg_price_jpy INTEGER,

  -- Price percentiles
  price_p10_jpy INTEGER,
  price_p25_jpy INTEGER,
  price_p75_jpy INTEGER,
  price_p90_jpy INTEGER,

  -- Breakdowns stored as JSONB for flexibility
  category_breakdown JSONB NOT NULL DEFAULT '{}',
  dealer_breakdown JSONB NOT NULL DEFAULT '{}',
  certification_breakdown JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date range queries
CREATE INDEX idx_snapshots_date ON market_daily_snapshots(snapshot_date DESC);
```

#### 2. Normalized Price Column

Add to listings table for consistent currency handling.

```sql
-- Add normalized price column to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_jpy BIGINT;

-- Comment explaining the column
COMMENT ON COLUMN listings.price_jpy IS
  'Price normalized to JPY using daily exchange rates. Updated by scheduled function.';
```

#### 3. Materialized Views for Performance

```sql
-- Market summary by item type (refreshed hourly)
CREATE MATERIALIZED VIEW mv_market_by_type AS
SELECT
  item_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE is_available = true) as available_count,
  COUNT(*) FILTER (WHERE is_sold = true) as sold_count,
  SUM(price_jpy) FILTER (WHERE is_available = true) as total_value_jpy,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_jpy)
    FILTER (WHERE is_available = true) as median_price_jpy,
  MIN(price_jpy) FILTER (WHERE is_available = true) as min_price_jpy,
  MAX(price_jpy) FILTER (WHERE is_available = true) as max_price_jpy
FROM listings
WHERE price_jpy IS NOT NULL
GROUP BY item_type;

-- Market summary by dealer
CREATE MATERIALIZED VIEW mv_market_by_dealer AS
SELECT
  d.id as dealer_id,
  d.name as dealer_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE l.is_available = true) as available_count,
  SUM(l.price_jpy) FILTER (WHERE l.is_available = true) as total_value_jpy,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price_jpy)
    FILTER (WHERE l.is_available = true) as median_price_jpy,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 2) as market_share_pct
FROM listings l
JOIN dealers d ON l.dealer_id = d.id
WHERE l.price_jpy IS NOT NULL
GROUP BY d.id, d.name;

-- Refresh indexes
CREATE UNIQUE INDEX ON mv_market_by_type(item_type);
CREATE UNIQUE INDEX ON mv_market_by_dealer(dealer_id);
```

#### 4. Scheduled Functions

```sql
-- Function to capture daily snapshot (run via pg_cron or Supabase scheduled function)
CREATE OR REPLACE FUNCTION capture_daily_snapshot()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_category_breakdown JSONB;
  v_dealer_breakdown JSONB;
  v_cert_breakdown JSONB;
BEGIN
  -- Build category breakdown
  SELECT jsonb_object_agg(item_type, jsonb_build_object(
    'count', total_count,
    'available', available_count,
    'value_jpy', total_value_jpy,
    'median_jpy', median_price_jpy
  ))
  INTO v_category_breakdown
  FROM mv_market_by_type;

  -- Build dealer breakdown
  SELECT jsonb_object_agg(dealer_name, jsonb_build_object(
    'count', total_count,
    'available', available_count,
    'value_jpy', total_value_jpy,
    'market_share', market_share_pct
  ))
  INTO v_dealer_breakdown
  FROM mv_market_by_dealer;

  -- Build certification breakdown
  SELECT jsonb_object_agg(COALESCE(cert_type, 'NONE'), jsonb_build_object(
    'count', COUNT(*),
    'available', COUNT(*) FILTER (WHERE is_available),
    'median_jpy', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_jpy)
  ))
  INTO v_cert_breakdown
  FROM listings
  WHERE price_jpy IS NOT NULL
  GROUP BY cert_type;

  -- Insert snapshot (upsert to handle re-runs)
  INSERT INTO market_daily_snapshots (
    snapshot_date,
    total_listings,
    available_listings,
    sold_listings,
    new_listings_24h,
    sold_24h,
    price_changes_24h,
    total_market_value_jpy,
    median_price_jpy,
    avg_price_jpy,
    price_p10_jpy,
    price_p25_jpy,
    price_p75_jpy,
    price_p90_jpy,
    category_breakdown,
    dealer_breakdown,
    certification_breakdown
  )
  SELECT
    v_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE is_available),
    COUNT(*) FILTER (WHERE is_sold),
    COUNT(*) FILTER (WHERE first_seen_at >= NOW() - INTERVAL '24 hours'),
    COUNT(*) FILTER (WHERE is_sold AND last_scraped_at >= NOW() - INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM price_history WHERE detected_at >= NOW() - INTERVAL '24 hours'),
    SUM(price_jpy) FILTER (WHERE is_available),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_jpy) FILTER (WHERE is_available),
    AVG(price_jpy) FILTER (WHERE is_available),
    PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY price_jpy) FILTER (WHERE is_available),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_jpy) FILTER (WHERE is_available),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_jpy) FILTER (WHERE is_available),
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY price_jpy) FILTER (WHERE is_available),
    v_category_breakdown,
    v_dealer_breakdown,
    v_cert_breakdown
  FROM listings
  WHERE price_jpy IS NOT NULL
  ON CONFLICT (snapshot_date) DO UPDATE SET
    total_listings = EXCLUDED.total_listings,
    available_listings = EXCLUDED.available_listings,
    sold_listings = EXCLUDED.sold_listings,
    new_listings_24h = EXCLUDED.new_listings_24h,
    sold_24h = EXCLUDED.sold_24h,
    price_changes_24h = EXCLUDED.price_changes_24h,
    total_market_value_jpy = EXCLUDED.total_market_value_jpy,
    median_price_jpy = EXCLUDED.median_price_jpy,
    avg_price_jpy = EXCLUDED.avg_price_jpy,
    price_p10_jpy = EXCLUDED.price_p10_jpy,
    price_p25_jpy = EXCLUDED.price_p25_jpy,
    price_p75_jpy = EXCLUDED.price_p75_jpy,
    price_p90_jpy = EXCLUDED.price_p90_jpy,
    category_breakdown = EXCLUDED.category_breakdown,
    dealer_breakdown = EXCLUDED.dealer_breakdown,
    certification_breakdown = EXCLUDED.certification_breakdown;
END;
$$;

-- Function to update normalized JPY prices
CREATE OR REPLACE FUNCTION update_normalized_prices(
  usd_rate NUMERIC DEFAULT 150,
  eur_rate NUMERIC DEFAULT 162
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE listings SET price_jpy =
    CASE price_currency
      WHEN 'JPY' THEN price_value
      WHEN 'USD' THEN ROUND(price_value * usd_rate)
      WHEN 'EUR' THEN ROUND(price_value * eur_rate)
      ELSE NULL
    END
  WHERE price_value IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
```

---

## API Design

### Route Structure

```
src/app/api/admin/analytics/
├── overview/
│   └── route.ts              # GET - Market overview stats
├── distribution/
│   └── route.ts              # GET - Price distribution histogram
├── breakdown/
│   ├── category/
│   │   └── route.ts          # GET - By item type
│   ├── dealer/
│   │   └── route.ts          # GET - By dealer
│   └── certification/
│       └── route.ts          # GET - By cert type
├── trends/
│   └── route.ts              # GET - Time-series data
├── price-changes/
│   └── route.ts              # GET - Recent price movements
├── velocity/
│   └── route.ts              # GET - Inventory turnover
└── index/
    └── route.ts              # GET - Nihontowatch Market Index
```

### API Specifications

#### GET /api/admin/analytics/overview

Returns high-level market statistics.

**Query Parameters:**
- `currency` (optional): Response currency (JPY|USD|EUR), default JPY

**Response:**
```typescript
interface MarketOverviewResponse {
  success: true;
  data: {
    asOf: string; // ISO timestamp

    // Counts
    totalListings: number;
    availableListings: number;
    soldListings: number;

    // Values
    totalMarketValue: number;
    currency: 'JPY' | 'USD' | 'EUR';

    // Price stats
    medianPrice: number;
    averagePrice: number;
    priceRange: {
      min: number;
      max: number;
    };
    percentiles: {
      p10: number;
      p25: number;
      p75: number;
      p90: number;
    };

    // Activity (24h)
    newListings24h: number;
    soldListings24h: number;
    priceChanges24h: number;

    // Changes vs previous period
    changes: {
      totalValue: { amount: number; percent: number; period: '7d' };
      medianPrice: { amount: number; percent: number; period: '7d' };
      listingCount: { amount: number; percent: number; period: '7d' };
    };
  };
}
```

#### GET /api/admin/analytics/distribution

Returns price distribution for histogram visualization.

**Query Parameters:**
- `buckets` (optional): Number of buckets (default 20, max 50)
- `itemType` (optional): Filter by item type
- `certification` (optional): Filter by cert type
- `dealer` (optional): Filter by dealer ID
- `minPrice` (optional): Minimum price filter
- `maxPrice` (optional): Maximum price filter

**Response:**
```typescript
interface PriceDistributionResponse {
  success: true;
  data: {
    buckets: Array<{
      rangeStart: number;
      rangeEnd: number;
      label: string; // e.g., "¥500K-1M"
      count: number;
      percentage: number;
      cumulativePercentage: number;
    }>;
    statistics: {
      count: number;
      mean: number;
      median: number;
      mode: number;
      stdDev: number;
      skewness: number; // positive = right-skewed (typical for luxury goods)
      percentiles: {
        p10: number;
        p25: number;
        p75: number;
        p90: number;
      };
    };
    filters: {
      itemType: string | null;
      certification: string | null;
      dealer: string | null;
    };
  };
}
```

#### GET /api/admin/analytics/trends

Returns time-series data for trend charts.

**Query Parameters:**
- `metric`: Metric to track (required)
  - `total_value` - Total market value
  - `median_price` - Median listing price
  - `listing_count` - Number of listings
  - `available_count` - Available listings
- `period`: Time period (default '90d')
  - `7d`, `30d`, `90d`, `180d`, `1y`, `all`
- `itemType` (optional): Filter by item type
- `granularity` (optional): Data point frequency
  - `daily` (default), `weekly`, `monthly`

**Response:**
```typescript
interface TrendResponse {
  success: true;
  data: {
    metric: string;
    period: string;
    granularity: string;

    dataPoints: Array<{
      date: string; // ISO date
      value: number;
      change: number; // vs previous point
      changePercent: number;
    }>;

    summary: {
      startValue: number;
      endValue: number;
      minValue: number;
      maxValue: number;
      totalChange: number;
      totalChangePercent: number;
      trend: 'up' | 'down' | 'stable';
      volatility: number; // coefficient of variation
    };

    // Linear regression
    trendLine: {
      slope: number;
      intercept: number;
      rSquared: number; // goodness of fit
    };
  };
}
```

#### GET /api/admin/analytics/breakdown/category

Returns market breakdown by item type.

**Response:**
```typescript
interface CategoryBreakdownResponse {
  success: true;
  data: {
    categories: Array<{
      itemType: string;
      displayName: string;

      // Counts
      totalCount: number;
      availableCount: number;
      soldCount: number;

      // Values
      totalValueJPY: number;
      medianPriceJPY: number;
      avgPriceJPY: number;
      priceRange: { min: number; max: number };

      // Market share
      countShare: number; // percentage of total listings
      valueShare: number; // percentage of total value

      // Comparison to overall market
      priceVsMarket: number; // % above/below market median
    }>;

    totals: {
      totalCount: number;
      totalValueJPY: number;
      medianPriceJPY: number;
    };
  };
}
```

---

## Frontend Components

### Directory Structure

```
src/app/admin/
├── layout.tsx                          # Admin layout with sidebar
├── page.tsx                            # Redirect to market-intelligence
│
├── market-intelligence/
│   ├── page.tsx                        # Main dashboard
│   ├── loading.tsx                     # Loading skeleton
│   └── components/
│       ├── DashboardHeader.tsx         # Title, date range, export
│       ├── FilterBar.tsx               # Category, dealer, cert filters
│       │
│       ├── cards/
│       │   ├── MetricCard.tsx          # Single KPI card
│       │   ├── MetricCardGrid.tsx      # Grid of metric cards
│       │   └── ChangeIndicator.tsx     # Up/down arrow with %
│       │
│       ├── charts/
│       │   ├── PriceDistributionChart.tsx
│       │   ├── CategoryBreakdownChart.tsx
│       │   ├── DealerMarketShareChart.tsx
│       │   ├── TrendLineChart.tsx
│       │   └── ChartContainer.tsx      # Wrapper with loading/error
│       │
│       ├── tables/
│       │   ├── PriceChangesTable.tsx   # Recent price movements
│       │   ├── TopListingsTable.tsx    # Highest value items
│       │   └── DealerStatsTable.tsx    # Dealer comparison
│       │
│       └── exports/
│           ├── ExportButton.tsx
│           └── ReportGenerator.tsx
│
├── hooks/
│   ├── useMarketOverview.ts
│   ├── usePriceDistribution.ts
│   ├── useCategoryBreakdown.ts
│   ├── useDealerBreakdown.ts
│   ├── useTrends.ts
│   └── useAnalyticsFilters.ts
│
└── lib/
    ├── formatters.ts                   # Number, currency formatting
    ├── chartHelpers.ts                 # Chart data transformations
    └── statisticsHelpers.ts            # Statistical calculations
```

### Key Component Specifications

#### MetricCard

```tsx
interface MetricCardProps {
  title: string;
  value: number;
  format: 'currency' | 'number' | 'percent';
  currency?: 'JPY' | 'USD' | 'EUR';
  change?: {
    value: number;
    percent: number;
    period: string;
  };
  subtitle?: string;
  loading?: boolean;
}
```

#### PriceDistributionChart

```tsx
interface PriceDistributionChartProps {
  data: PriceBucket[];
  statistics: PriceStatistics;
  highlightMedian?: boolean;
  highlightPercentiles?: boolean;
  onBucketClick?: (bucket: PriceBucket) => void;
}
```

#### FilterBar

```tsx
interface FilterBarProps {
  filters: {
    itemType: string | null;
    certification: string | null;
    dealer: string | null;
    dateRange: { start: Date; end: Date } | null;
  };
  onFiltersChange: (filters: Filters) => void;
  availableOptions: {
    itemTypes: Array<{ value: string; label: string; count: number }>;
    certifications: Array<{ value: string; label: string; count: number }>;
    dealers: Array<{ value: string; label: string; count: number }>;
  };
}
```

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────┐  MARKET INTELLIGENCE              [Filters ▼] [Export ▼]      │
│  │ N W │  Last updated: 2 minutes ago      [7d|30d|90d|1y|All]         │
│  └─────┘                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌───────┐ │
│  │  TOTAL VALUE    │ │   LISTINGS      │ │  MEDIAN PRICE   │ │ 24H   │ │
│  │  ¥2.47B         │ │   3,247         │ │  ¥847,000       │ │ACTIVITY│ │
│  │  ▲ 3.2% (7d)    │ │   2,891 avail   │ │  ▲ 1.8% (7d)    │ │+12 new│ │
│  │                 │ │   ▲ 24 (7d)     │ │                 │ │-4 sold│ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └───────┘ │
│                                                                         │
│  ┌────────────────────────────────────┐ ┌─────────────────────────────┐│
│  │       PRICE DISTRIBUTION           │ │    CATEGORY BREAKDOWN       ││
│  │                                    │ │                             ││
│  │   Count                            │ │  ┌──────────────────────┐   ││
│  │    │                               │ │  │      PIE CHART       │   ││
│  │ 400│     ██                        │ │  │                      │   ││
│  │    │   ████                        │ │  │  Katana    42%       │   ││
│  │ 300│  ██████                       │ │  │  Wakizashi 18%       │   ││
│  │    │ ████████                      │ │  │  Tsuba     15%       │   ││
│  │ 200│██████████ █                   │ │  │  Tanto     12%       │   ││
│  │    │████████████ █                 │ │  │  Other     13%       │   ││
│  │ 100│██████████████ █ █             │ │  └──────────────────────┘   ││
│  │    │████████████████████ █ █       │ │                             ││
│  │   0└──────────────────────────     │ │  [View Details →]           ││
│  │     0  500K  1M   2M   5M   10M+   │ │                             ││
│  │           Price (JPY)              │ │                             ││
│  │                                    │ │                             ││
│  │  Median: ¥847K | P25: ¥320K | P75: ¥1.8M                          ││
│  └────────────────────────────────────┘ └─────────────────────────────┘│
│                                                                         │
│  ┌────────────────────────────────────┐ ┌─────────────────────────────┐│
│  │      PRICE TREND (90 DAYS)         │ │    DEALER MARKET SHARE      ││
│  │                                    │ │                             ││
│  │  ¥900K │          ___/\___         │ │  Aoi Art       ████████ 22% ││
│  │        │      ___/        \        │ │  Nipponto      █████   15%  ││
│  │  ¥850K │  ___/             \__     │ │  E-sword       ████    11%  ││
│  │        │ /                    \    │ │  Eirakudo      ███     9%   ││
│  │  ¥800K │/                      \   │ │  Choshuya      ██      7%   ││
│  │        └───────────────────────    │ │  Ginza Seikodo ██      6%   ││
│  │         Nov    Dec    Jan          │ │  Others        ████████ 30% ││
│  │                                    │ │                             ││
│  │  Trend: ▲ Upward (+2.1%)           │ │  [View All Dealers →]       ││
│  └────────────────────────────────────┘ └─────────────────────────────┘│
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     RECENT PRICE CHANGES                          │  │
│  │ ─────────────────────────────────────────────────────────────────│  │
│  │  ▼ Katana by Sukesada (Aoi Art)    ¥1.2M → ¥980K  -18%      2h  │  │
│  │  ▲ Juyo Wakizashi (Nipponto)       ¥3.5M → ¥3.8M   +8%      5h  │  │
│  │  ▼ Edo Tsuba (E-sword)             ¥450K → ¥420K   -7%      8h  │  │
│  │  ● Shinto Katana (Eirakudo)        ¥2.1M → ¥2.1M    0%     12h  │  │
│  │  ▼ Fuchi-kashira set (Choshuya)    ¥180K → ¥165K   -8%     18h  │  │
│  │                                                                   │  │
│  │  [View All Changes →]                                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Data Foundation (Priority: Critical)

**Objective:** Set up the database infrastructure for analytics.

**Tasks:**
1. Add `price_jpy` column to listings table
2. Create `market_daily_snapshots` table
3. Create materialized views for category/dealer aggregates
4. Implement `update_normalized_prices()` function
5. Implement `capture_daily_snapshot()` function
6. Set up Supabase scheduled function for daily snapshot (midnight JST)
7. Backfill historical snapshots (if price_history data exists)

**Deliverables:**
- [ ] Database migration script
- [ ] Scheduled function configuration
- [ ] Verification queries

**Dependencies:** None

---

### Phase 2: Core API Routes (Priority: Critical)

**Objective:** Build the API layer for dashboard data.

**Tasks:**
1. Create `/api/admin/analytics/overview` endpoint
2. Create `/api/admin/analytics/distribution` endpoint
3. Create `/api/admin/analytics/breakdown/category` endpoint
4. Create `/api/admin/analytics/breakdown/dealer` endpoint
5. Add admin authentication middleware
6. Add response caching (5-minute TTL)
7. Add error handling and validation

**Deliverables:**
- [ ] API routes with TypeScript types
- [ ] Authentication middleware
- [ ] API documentation

**Dependencies:** Phase 1

---

### Phase 3: Dashboard MVP (Priority: High)

**Objective:** Build the basic admin dashboard with core visualizations.

**Tasks:**
1. Create admin layout with navigation
2. Build MetricCard component
3. Build PriceDistributionChart (using Recharts)
4. Build CategoryBreakdownChart (pie/donut)
5. Build DealerMarketShareChart (horizontal bar)
6. Create main dashboard page assembling components
7. Add loading states and error boundaries
8. Implement currency toggle (JPY/USD/EUR)

**Deliverables:**
- [ ] Admin dashboard at `/admin/market-intelligence`
- [ ] Responsive design (desktop-first for admin)
- [ ] Component documentation

**Dependencies:** Phase 2

---

### Phase 4: Filtering & Interactivity (Priority: High)

**Objective:** Add filtering and drill-down capabilities.

**Tasks:**
1. Build FilterBar component with multi-select
2. Implement URL state management for filters
3. Add date range picker
4. Make charts interactive (click to filter)
5. Add tooltips with detailed data
6. Implement filter persistence (localStorage)

**Deliverables:**
- [ ] Fully filterable dashboard
- [ ] Shareable filter URLs
- [ ] Filter presets (e.g., "Swords Only", "Juyo+ Only")

**Dependencies:** Phase 3

---

### Phase 5: Time Series & Trends (Priority: Medium)

**Objective:** Add historical trend analysis.

**Tasks:**
1. Create `/api/admin/analytics/trends` endpoint
2. Build TrendLineChart component
3. Add period selector (7d, 30d, 90d, 1y)
4. Implement trend line calculation (linear regression)
5. Add comparison overlays (e.g., this month vs last month)
6. Build mini sparkline components for metric cards

**Deliverables:**
- [ ] Trend visualization
- [ ] Period comparison
- [ ] Trend indicators on metric cards

**Dependencies:** Phase 1 (snapshots table populated)

---

### Phase 6: Advanced Analytics (Priority: Medium)

**Objective:** Add sophisticated market analysis features.

**Tasks:**
1. Implement Nihontowatch Market Index (NMI)
   - Define basket composition
   - Calculate weighted index
   - Track daily index value
2. Build price change feed with anomaly highlighting
3. Implement inventory velocity analysis (days on market)
4. Add certification premium analysis (Juyo vs Hozon prices)
5. Build dealer comparison tool

**Deliverables:**
- [ ] NMI index with historical chart
- [ ] Anomaly detection alerts
- [ ] Velocity metrics
- [ ] Premium analysis

**Dependencies:** Phase 5

---

### Phase 7: Export & Reporting (Priority: Low)

**Objective:** Enable data export and report generation.

**Tasks:**
1. Add CSV export for all data views
2. Implement PDF report generation
3. Create report templates (daily digest, weekly summary)
4. Add scheduled email reports (optional)
5. Build custom report builder

**Deliverables:**
- [ ] Export buttons on all views
- [ ] PDF market reports
- [ ] Scheduled report system

**Dependencies:** Phase 4

---

## Technical Decisions

### Chart Library: Recharts

**Rationale:**
- Native React components
- Good TypeScript support
- Tree-shakeable (good for bundle size)
- Built on D3.js (powerful)
- Responsive container built-in
- Active maintenance

**Alternatives Considered:**
- Chart.js: Good but requires wrapper
- Nivo: Beautiful but larger bundle
- Victory: Good but less flexible
- D3.js directly: Too low-level

### State Management: TanStack Query

**Rationale:**
- Built-in caching
- Automatic background refetching
- Loading/error states
- Optimistic updates
- DevTools available

### Data Fetching Pattern

```typescript
// hooks/useMarketOverview.ts
import { useQuery } from '@tanstack/react-query';

export function useMarketOverview(filters: Filters) {
  return useQuery({
    queryKey: ['market-overview', filters],
    queryFn: () => fetchMarketOverview(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
```

### Authentication Approach

For MVP, use a simple API key or Supabase RLS:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Check for admin session
    const session = await getSession(request);
    if (!session?.isAdmin) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
}
```

---

## Performance Considerations

### Caching Strategy

| Data Type | Cache TTL | Invalidation |
|-----------|-----------|--------------|
| Overview stats | 5 minutes | On new snapshot |
| Price distribution | 5 minutes | On price change |
| Category breakdown | 1 hour | On refresh |
| Dealer breakdown | 1 hour | On refresh |
| Trends (7d+) | 1 hour | On new snapshot |
| Price changes | 1 minute | Real-time |

### Materialized View Refresh

```sql
-- Refresh views on schedule (not per-request)
-- Via Supabase scheduled function or pg_cron

-- Every 15 minutes
SELECT cron.schedule('refresh-market-views', '*/15 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_by_type;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_by_dealer;
$$);
```

### Query Optimization

- Use covering indexes for common queries
- Pre-aggregate in materialized views
- Avoid N+1 queries in API routes
- Use connection pooling (Supabase handles this)

---

## Security Considerations

1. **Authentication**: Admin routes require authenticated session
2. **Authorization**: Check `isAdmin` role on Supabase user
3. **Rate Limiting**: Implement on API routes (10 req/s per user)
4. **Data Sanitization**: Validate all filter inputs
5. **CORS**: Restrict to known origins
6. **Audit Logging**: Log admin access (optional)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Dashboard load time | < 2 seconds |
| API response time (overview) | < 200ms |
| API response time (distribution) | < 500ms |
| Data freshness | < 15 minutes |
| Export generation | < 5 seconds |

---

## Future Enhancements

### Nihontowatch Market Index (NMI)

A weighted index tracking the overall market, similar to Chrono24's Watch Market Index:

```typescript
const NMI_BASKET = [
  // Swords (60% weight)
  { type: 'KATANA', cert: 'JUYO', weight: 0.15 },
  { type: 'KATANA', cert: 'TOKUBETSU_HOZON', weight: 0.15 },
  { type: 'KATANA', cert: 'HOZON', weight: 0.10 },
  { type: 'WAKIZASHI', cert: 'HOZON', weight: 0.10 },
  { type: 'TANTO', cert: 'HOZON', weight: 0.05 },
  { type: 'KATANA', cert: null, weight: 0.05 },

  // Tosogu (25% weight)
  { type: 'TSUBA', cert: null, weight: 0.15 },
  { type: 'FUCHI_KASHIRA', cert: null, weight: 0.05 },
  { type: 'MENUKI', cert: null, weight: 0.05 },

  // Other (15% weight)
  { type: 'KOSHIRAE', cert: null, weight: 0.10 },
  { type: 'ARMOR', cert: null, weight: 0.05 },
];

// Index = Σ(category_median × weight) / base_value × 1000
// Base value set at index creation, e.g., ¥1,000,000
```

### Predictive Analytics

- Price prediction based on attributes
- Time-to-sale estimation
- Optimal pricing suggestions
- Demand forecasting

### Alerts & Monitoring

- Price drop alerts for specific categories
- Inventory level warnings
- Market anomaly notifications
- Dealer activity monitoring

---

## Appendix: Sample Queries

### Total Market Value by Category

```sql
SELECT
  item_type,
  COUNT(*) as count,
  SUM(price_jpy) as total_value,
  ROUND(SUM(price_jpy)::numeric / SUM(SUM(price_jpy)) OVER () * 100, 2) as value_share
FROM listings
WHERE is_available = true AND price_jpy IS NOT NULL
GROUP BY item_type
ORDER BY total_value DESC;
```

### Price Distribution Buckets

```sql
WITH price_ranges AS (
  SELECT
    width_bucket(price_jpy, 0, 10000000, 20) as bucket,
    COUNT(*) as count
  FROM listings
  WHERE is_available = true AND price_jpy IS NOT NULL AND price_jpy <= 10000000
  GROUP BY bucket
)
SELECT
  bucket,
  (bucket - 1) * 500000 as range_start,
  bucket * 500000 as range_end,
  count,
  ROUND(count::numeric / SUM(count) OVER () * 100, 2) as percentage
FROM price_ranges
ORDER BY bucket;
```

### Dealer Market Share

```sql
SELECT
  d.name as dealer,
  COUNT(*) as listings,
  SUM(l.price_jpy) as total_value,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as count_share,
  ROUND(SUM(l.price_jpy)::numeric / SUM(SUM(l.price_jpy)) OVER () * 100, 2) as value_share
FROM listings l
JOIN dealers d ON l.dealer_id = d.id
WHERE l.is_available = true AND l.price_jpy IS NOT NULL
GROUP BY d.id, d.name
ORDER BY total_value DESC
LIMIT 20;
```

### Recent Price Changes

```sql
SELECT
  l.title,
  d.name as dealer,
  ph.old_price,
  ph.new_price,
  ROUND((ph.new_price - ph.old_price)::numeric / ph.old_price * 100, 1) as change_pct,
  ph.detected_at
FROM price_history ph
JOIN listings l ON ph.listing_id = l.id
JOIN dealers d ON l.dealer_id = d.id
WHERE ph.detected_at > NOW() - INTERVAL '7 days'
  AND ph.change_type = 'PRICE_CHANGE'
ORDER BY ph.detected_at DESC
LIMIT 50;
```

---

## References

- [Chrono24 Watch Market Index](https://www.chrono24.com/watch-market-index.htm)
- [Recharts Documentation](https://recharts.org/)
- [TanStack Query](https://tanstack.com/query)
- [Supabase Functions](https://supabase.com/docs/guides/functions)
- [Statistical Analysis in PostgreSQL](https://www.postgresql.org/docs/current/functions-aggregate.html)
