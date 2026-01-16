# Nihontowatch V1 Plan

> **Goal**: Launch the premier nihonto aggregator with comprehensive search, filtering, and alert system.

---

## Core Features

### 1. Browse Experience

**Two-Tab Layout**
```
┌─────────────────────────────────────────────────────────────┐
│  [Available] [Sold]                            🔍 Search    │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   SIDEBAR    │            LISTING GRID                      │
│   FILTERS    │                                              │
│              │  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  Item Type   │  │    │ │    │ │    │ │    │               │
│  ☑ Katana    │  │ 1  │ │ 2  │ │ 3  │ │ 4  │               │
│  ☑ Wakizashi │  └────┘ └────┘ └────┘ └────┘               │
│  ☐ Tanto     │                                              │
│  ☐ Tsuba     │  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│              │  │    │ │    │ │    │ │    │               │
│  Price Range │  │ 5  │ │ 6  │ │ 7  │ │ 8  │               │
│  ¥100k-500k  │  └────┘ └────┘ └────┘ └────┘               │
│              │                                              │
│  Certific.   │         [Load More] or Pagination           │
│  ☑ Juyo      │                                              │
│  ☑ TokuHozon │                                              │
│              │                                              │
│  School      │                                              │
│  [Dropdown]  │                                              │
│              │                                              │
│  Dealer      │                                              │
│  [Dropdown]  │                                              │
│              │                                              │
│  [Clear All] │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**Available Tab**
- Shows all listings where `status = 'available'` OR `is_available = true`
- Includes "Ask" price items (price_value IS NULL)
- Default sort: Most recent first (`first_seen_at DESC`)

**Sold Tab**
- Shows listings where `status IN ('sold', 'presumed_sold')` OR `is_sold = true`
- Useful for price research and market analysis
- Shows last known price and sold date

### 2. Sidebar Filters

| Filter | Type | Source Field | Notes |
|--------|------|--------------|-------|
| **Item Type** | Multi-checkbox | `item_type` | Katana, Wakizashi, Tanto, Tsuba, etc. |
| **Price Range** | Range slider | `price_value` | Min/Max with presets |
| **Certification** | Multi-checkbox | `cert_type` | Normalize display names |
| **School** | Searchable dropdown | `school` | Normalize JP/EN |
| **Dealer** | Searchable dropdown | `dealer_id` | Show dealer names |
| **Smith/Maker** | Text input | `smith`, `tosogu_maker` | Autocomplete |
| **Blade Length** | Range slider | `nagasa_cm` | For swords only |
| **Era/Period** | Dropdown | `era` | When available |

**Filter Behavior**
- Filters combine with AND logic
- URL state sync: `/browse?type=katana,wakizashi&minPrice=500000`
- Filter counts show beside each option (e.g., "Katana (318)")
- "Clear All" button resets all filters

### 3. Listing Cards

```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │        IMAGE            │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  刀 銘 兼元              [Juyo] │
│  Katana: Kanemoto              │
│                                 │
│  Mino School • 70.5cm          │
│                                 │
│  ¥3,500,000                    │
│  Aoi Art                       │
└─────────────────────────────────┘
```

**Card Information**
- Primary image (first from `images` array)
- Title (Japanese + English if available)
- Item type badge
- Certification badge (color-coded)
- School and key spec (nagasa for blades)
- Price (or "Ask" if null)
- Dealer name
- "New" badge if `first_seen_at` < 7 days

### 4. Listing Detail Page

```
/listing/[id]

┌─────────────────────────────────────────────────────────────┐
│  ← Back to Browse                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    TITLE & BADGES                 │
│  │                     │    刀 銘 兼元                      │
│  │    MAIN IMAGE       │    Katana: Kanemoto               │
│  │                     │    [Juyo] [Mino] [Available]      │
│  │                     │                                    │
│  └─────────────────────┘    ¥3,500,000                     │
│  [thumb] [thumb] [thumb]    Dealer: Aoi Art                │
│                              [View on Dealer Site →]        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SPECIFICATIONS              ATTRIBUTION                    │
│  ─────────────               ───────────                    │
│  Nagasa: 70.5cm              Smith: Kanemoto               │
│  Sori: 1.8cm                 School: Mino                  │
│  Motohaba: 3.2cm             Province: Mino                │
│  Kasane: 0.7cm               Era: Muromachi                │
│                              Mei: Signed                   │
│  CERTIFICATION                                              │
│  ─────────────                                              │
│  Type: Juyo Token                                          │
│  Session: 45                                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRICE HISTORY (if available)                              │
│  ─────────────                                              │
│  2024-01-15: ¥3,500,000 (current)                         │
│  2023-11-20: ¥3,800,000 (-8%)                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [🔔 Set Alert for Similar Items]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5. Alert System

**User Flow**
1. User clicks "Set Alert" on listing or creates custom alert
2. Configure alert criteria:
   - Item types (multi-select)
   - Price range (min/max budget)
   - Certification (optional)
   - School (optional)
   - Dealer (optional)
   - Keywords (optional)
3. Enter email address
4. Confirm via email link
5. Receive daily digest or instant alerts

**Alert Configuration**
```
┌─────────────────────────────────────────────────────────────┐
│  Create Price Alert                                    [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  I'm looking for:                                          │
│  ☑ Katana  ☑ Wakizashi  ☐ Tanto  ☐ Tachi                 │
│                                                             │
│  Budget:                                                    │
│  Min: [¥________]  Max: [¥________]                        │
│                                                             │
│  Certification (optional):                                 │
│  ☐ Juyo  ☐ Tokubetsu Juyo  ☑ Tokubetsu Hozon  ☐ Hozon   │
│                                                             │
│  School (optional):                                        │
│  [Select or type...]                                       │
│                                                             │
│  Keywords (optional):                                      │
│  [e.g., "Masamune", "suguha"]                             │
│                                                             │
│  Email:                                                    │
│  [your@email.com                    ]                      │
│                                                             │
│  Frequency:                                                │
│  ○ Instant (as items appear)                              │
│  ● Daily digest                                            │
│  ○ Weekly digest                                           │
│                                                             │
│  [Create Alert]                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Database Schema for Alerts**
```sql
CREATE TABLE user_alerts (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,

  -- Criteria (all optional, combine with AND)
  item_types TEXT[],           -- ['katana', 'wakizashi']
  min_price NUMERIC,
  max_price NUMERIC,
  certifications TEXT[],       -- ['Juyo', 'TokuHozon']
  schools TEXT[],
  dealers INTEGER[],           -- dealer IDs
  keywords TEXT[],             -- full-text search terms

  -- Settings
  frequency TEXT DEFAULT 'daily', -- 'instant', 'daily', 'weekly'
  is_active BOOLEAN DEFAULT TRUE,

  -- Tracking
  last_sent_at TIMESTAMPTZ,
  last_matched_listing_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_alerts_active (is_active, email_verified)
);

CREATE TABLE alert_history (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES user_alerts(id),
  listing_id INTEGER REFERENCES listings(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(alert_id, listing_id)  -- Don't alert same item twice
);
```

**Alert Processing (Background Job)**
```python
# Run every 15 minutes for instant alerts
# Run daily at 9am JST for daily digests

def process_alerts():
    for alert in get_active_alerts():
        new_listings = find_matching_listings(
            alert.criteria,
            since=alert.last_sent_at
        )
        if new_listings:
            send_alert_email(alert.email, new_listings)
            update_alert_last_sent(alert.id)
```

---

## Technical Architecture

### Database Layer

**Option: Normalized View + Search RPC**

```sql
-- Normalized view for consistent display
CREATE VIEW listings_display AS
SELECT
  l.*,
  d.name AS dealer_name,
  d.domain AS dealer_domain,
  -- Normalize certification names
  CASE l.cert_type
    WHEN 'TokuHozon' THEN 'Tokubetsu Hozon'
    WHEN 'TokuKicho' THEN 'Tokubetsu Kicho'
    ELSE l.cert_type
  END AS cert_display,
  -- Normalize school names (JP → EN)
  COALESCE(
    school_mapping.english_name,
    l.school
  ) AS school_normalized,
  -- Unified artisan field
  COALESCE(l.smith, l.tosogu_maker) AS artisan
FROM listings l
JOIN dealers d ON l.dealer_id = d.id
LEFT JOIN school_mapping ON l.school = school_mapping.japanese_name;

-- Search RPC with facets
CREATE FUNCTION search_listings_with_facets(
  p_status TEXT DEFAULT 'available',
  p_item_types TEXT[] DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_certifications TEXT[] DEFAULT NULL,
  p_schools TEXT[] DEFAULT NULL,
  p_dealers INTEGER[] DEFAULT NULL,
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 24,
  p_offset INTEGER DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Build dynamic query with all filters
  -- Return { items: [...], total: N, facets: {...} }
END;
$$ LANGUAGE plpgsql;
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/browse` | GET | List + filter listings |
| `/api/listings/[id]` | GET | Single listing detail |
| `/api/facets` | GET | Get facet counts for filters |
| `/api/dealers` | GET | List all dealers |
| `/api/alerts` | POST | Create new alert |
| `/api/alerts/verify` | GET | Verify email |
| `/api/alerts/[id]` | DELETE | Unsubscribe |

### Frontend Components

```
src/components/
├── browse/
│   ├── BrowsePage.tsx          # Main container with tabs
│   ├── ListingGrid.tsx         # Grid of listing cards
│   ├── ListingCard.tsx         # Individual card
│   ├── FilterSidebar.tsx       # Left sidebar with filters
│   ├── FilterSection.tsx       # Collapsible filter group
│   ├── PriceRangeSlider.tsx    # Min/max price input
│   ├── CheckboxGroup.tsx       # Multi-select checkboxes
│   ├── SearchableDropdown.tsx  # School/dealer selector
│   └── ActiveFilters.tsx       # Pills showing active filters
├── listing/
│   ├── ListingDetail.tsx       # Full listing page
│   ├── ImageGallery.tsx        # Image carousel
│   ├── SpecsTable.tsx          # Specifications display
│   ├── PriceHistory.tsx        # Price change chart
│   └── SimilarListings.tsx     # Related items
├── alerts/
│   ├── AlertModal.tsx          # Create alert dialog
│   ├── AlertForm.tsx           # Alert criteria form
│   └── AlertConfirmation.tsx   # Success/verify message
└── ui/
    ├── Badge.tsx               # Certification/type badges
    ├── Tabs.tsx                # Available/Sold tabs
    ├── Pagination.tsx          # Page navigation
    └── LoadingState.tsx        # Skeleton loaders
```

### State Management

```typescript
// URL-driven state for filters
interface BrowseState {
  tab: 'available' | 'sold';
  filters: {
    itemTypes: string[];
    minPrice?: number;
    maxPrice?: number;
    certifications: string[];
    schools: string[];
    dealers: number[];
    query?: string;
  };
  sort: 'recent' | 'price_asc' | 'price_desc';
  page: number;
}

// Sync with URL params
// /browse?tab=available&type=katana,wakizashi&minPrice=500000
```

---

## Data Normalization

### School Mapping Table

```sql
CREATE TABLE school_mapping (
  id SERIAL PRIMARY KEY,
  japanese_name TEXT,
  english_name TEXT NOT NULL,
  tradition TEXT,  -- Gokaden tradition if applicable
  province TEXT,

  UNIQUE(japanese_name),
  UNIQUE(english_name)
);

-- Seed data
INSERT INTO school_mapping (japanese_name, english_name, tradition, province) VALUES
('長船', 'Osafune', 'Bizen', 'Bizen'),
('一文字', 'Ichimonji', 'Bizen', 'Bizen'),
('備前', 'Bizen', 'Bizen', 'Bizen'),
('来', 'Rai', 'Yamashiro', 'Yamashiro'),
('正宗', 'Masamune', 'Soshu', 'Sagami'),
-- ... 50+ mappings
```

### Certification Normalization

```typescript
const CERT_DISPLAY: Record<string, string> = {
  'TokuHozon': 'Tokubetsu Hozon',
  'Hozon': 'Hozon',
  'Juyo': 'Jūyō',
  'Tokuju': 'Tokubetsu Jūyō',
  'TokuKicho': 'Tokubetsu Kichō',
  'Kicho': 'Kichō',
};

const CERT_PRIORITY: Record<string, number> = {
  'Tokubetsu Jūyō': 1,
  'Jūyō': 2,
  'Tokubetsu Hozon': 3,
  'Hozon': 4,
  // ...
};
```

---

## Email System

### Transactional Emails

1. **Alert Verification**
   - Subject: "Confirm your Nihontowatch alert"
   - Link to verify email

2. **Alert Notification**
   - Subject: "🗡️ 5 new items match your alert"
   - Listing cards with images
   - Direct links to listings
   - Unsubscribe link

3. **Weekly Digest**
   - Subject: "This week on Nihontowatch"
   - Top new listings
   - Price drops
   - Market stats

### Email Provider

Options:
- **Resend** - Simple, good deliverability, free tier
- **SendGrid** - More features, higher volume
- **Postmark** - Best deliverability

---

## Implementation Phases

### Phase 1: Core Browse (Week 1)
- [ ] Create `listings_display` view
- [ ] Build `/api/browse` route
- [ ] Build `BrowsePage` with tabs
- [ ] Build `FilterSidebar` with basic filters
- [ ] Build `ListingGrid` and `ListingCard`
- [ ] Implement URL state sync

### Phase 2: Listing Detail (Week 1-2)
- [ ] Build `/listing/[id]` page
- [ ] Build `ListingDetail` component
- [ ] Build `ImageGallery`
- [ ] Show price history if available
- [ ] Add "View on dealer site" link

### Phase 3: Search & Facets (Week 2)
- [ ] Create `search_listings_with_facets` RPC
- [ ] Add facet counts to sidebar
- [ ] Implement full-text search
- [ ] Add autocomplete for smith/school

### Phase 4: Alert System (Week 2-3)
- [ ] Create `user_alerts` table
- [ ] Build alert creation flow
- [ ] Implement email verification
- [ ] Build alert processing job
- [ ] Set up email sending (Resend)
- [ ] Build unsubscribe flow

### Phase 5: Polish (Week 3)
- [ ] Mobile responsive design
- [ ] Loading states and skeletons
- [ ] Error handling
- [ ] SEO meta tags
- [ ] Performance optimization

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page Load | < 2s LCP | Vercel Analytics |
| Search Response | < 500ms | API timing |
| Alert Signup | 100/month | Database count |
| Organic Traffic | 1000/month | Analytics |
| Dealer Coverage | 30+ dealers | Database count |

---

## Open Questions

1. **Authentication**: Do we need user accounts beyond email alerts?
2. **Saved Searches**: Allow saving filter combinations?
3. **Comparison**: Side-by-side item comparison?
4. **Market Stats**: Public price analytics page?
5. **Dealer Reviews**: User reviews of dealers?

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Oshi-scrapper | Data source | ✅ Active |
| Supabase | Database | ✅ Connected |
| Vercel | Hosting | ✅ Deployed |
| Resend/SendGrid | Email | ⏳ To setup |
| Cron job service | Alert processing | ⏳ To setup |
