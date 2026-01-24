# Yuhinkai Setsumei Connection System

## Overview

The Yuhinkai Setsumei Connection System allows administrators to manually link nihontowatch listings to their corresponding entries in the Yuhinkai catalog database (oshi-v2). This provides collectors with professional English translations of NBTHK certification papers (setsumei).

### Why Manual Connections?

The automated SOTA matcher in oshi-v2 uses fuzzy matching on smith names, schools, certification types, and measurements. However, it can miss connections when:

- Listing titles use different romanization (e.g., "Kunitoshi" vs "國俊")
- Measurements differ slightly between sources
- The listing lacks structured metadata
- Multiple similar items exist in the catalog

Manual connections provide a 100% confidence override for these edge cases.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NIHONTOWATCH                                   │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  AdminSetsumei   │───▶│  /api/admin/     │───▶│   yuhinkai_      │  │
│  │  Widget (UI)     │    │  setsumei/*      │    │   enrichments    │  │
│  └──────────────────┘    └──────────────────┘    │   (table)        │  │
│          │                       │               └──────────────────┘  │
│          │                       │                        │            │
│          │                       ▼                        ▼            │
│          │               ┌──────────────────┐    ┌──────────────────┐  │
│          │               │  oshiV2Client    │    │  listing_        │  │
│          │               │  (read-only)     │    │  yuhinkai_       │  │
│          │               └──────────────────┘    │  enrichment      │  │
│          │                       │               │  (view)          │  │
│          │                       │               └──────────────────┘  │
│          │                       ▼                        │            │
│          │               ┌──────────────────┐             │            │
│          │               │    OSHI-V2       │             │            │
│          │               │  (Supabase)      │             │            │
│          │               │                  │             │            │
│          │               │  catalog_records │             │            │
│          │               └──────────────────┘             │            │
│          │                                                │            │
│          ▼                                                ▼            │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                     QuickViewContent                              │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │ │
│  │  │ SetsumeiSection│  │ YuhinkaiEnrich │  │ AdminSetsumeiWidget│  │ │
│  │  │ (direct OCR)   │  │ mentSection    │  │ (admin only)       │  │ │
│  │  └────────────────┘  └────────────────┘  └────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Admin pastes Yuhinkai URL** in AdminSetsumeiWidget
2. **URL is parsed** to extract collection/volume/itemNumber
3. **Preview endpoint** fetches catalog record from oshi-v2
4. **Admin confirms** the match is correct
5. **Connect endpoint** creates/updates `yuhinkai_enrichments` record
6. **QuickView refreshes** to show the new setsumei via `YuhinkaiEnrichmentSection`

---

## Database Schema

### Table: `yuhinkai_enrichments`

Stores the connection between nihontowatch listings and Yuhinkai catalog records.

```sql
CREATE TABLE yuhinkai_enrichments (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

  -- Yuhinkai catalog reference
  yuhinkai_uuid UUID NOT NULL,           -- UUID from oshi-v2 catalog_records
  yuhinkai_collection VARCHAR(50),       -- e.g., "Juyo", "Tokuju", "Kokuho"
  yuhinkai_volume INTEGER,               -- e.g., 68 (session number)
  yuhinkai_item_number INTEGER,          -- e.g., 14936 (item number in catalog)

  -- Match metadata
  match_score DECIMAL(5,4) DEFAULT 0,    -- 0.0-1.0, 1.0 for manual
  match_confidence VARCHAR(20),          -- 'DEFINITIVE', 'HIGH', 'MEDIUM', 'LOW'
  match_signals JSONB,                   -- { manual: true, connected_by: "user-id" }
  matched_fields TEXT[],                 -- ['manual_connection'] for manual

  -- Enriched data from catalog
  enriched_maker VARCHAR(255),           -- Artisan name (English)
  enriched_maker_kanji VARCHAR(255),     -- Artisan name (Japanese)
  enriched_school VARCHAR(255),          -- School name
  enriched_period VARCHAR(255),          -- Era/period
  enriched_form_type VARCHAR(100),       -- For tosogu: tsuba, fuchi, etc.

  -- Setsumei translations
  setsumei_ja TEXT,                      -- Original Japanese OCR text
  setsumei_en TEXT,                      -- English translation (markdown)
  setsumei_en_format VARCHAR(20),        -- 'markdown' or 'plain'

  -- Certification data
  enriched_cert_type VARCHAR(50),        -- e.g., "Juyo", "Tokubetsu Juyo"
  enriched_cert_session INTEGER,         -- Session number

  -- Classification
  item_category VARCHAR(50),             -- 'blade' or 'tosogu'

  -- Verification
  verification_status VARCHAR(20),       -- 'pending', 'auto', 'confirmed', 'rejected'
  verified_by UUID,                      -- Admin user ID who confirmed
  verified_at TIMESTAMPTZ,               -- When verified

  -- Connection tracking
  connection_source VARCHAR(20),         -- 'auto' or 'manual'

  -- Timestamps
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(listing_id)
);

-- Index for finding manual connections
CREATE INDEX idx_yuhinkai_enrich_manual
ON yuhinkai_enrichments(connection_source, verified_at DESC)
WHERE connection_source = 'manual';
```

### View: `listing_yuhinkai_enrichment`

Joins listings with their enrichment data for efficient queries.

```sql
CREATE OR REPLACE VIEW listing_yuhinkai_enrichment AS
SELECT
  e.id AS enrichment_id,
  e.listing_id,
  e.yuhinkai_uuid,
  e.yuhinkai_collection,
  e.yuhinkai_volume,
  e.yuhinkai_item_number,
  e.match_score,
  e.match_confidence,
  e.match_signals,
  e.matched_fields,
  e.enriched_maker,
  e.enriched_maker_kanji,
  e.enriched_school,
  e.enriched_period,
  e.enriched_form_type,
  e.setsumei_ja,
  e.setsumei_en,
  e.setsumei_en_format,
  e.enriched_cert_type,
  e.enriched_cert_session,
  e.item_category,
  e.verification_status,
  e.connection_source,
  e.enriched_at,
  e.updated_at
FROM yuhinkai_enrichments e;
```

---

## API Endpoints

### Preview: `GET /api/admin/setsumei/preview`

Fetches catalog record for preview before connecting.

**Query Parameters:**
- `url` (required): Yuhinkai URL or path (e.g., `/item/juyo/68/14936`)
- `listing_id` (required): Nihontowatch listing ID

**Response:**
```json
{
  "catalogRecord": {
    "yuhinkai_uuid": "abc-123-def",
    "yuhinkai_collection": "Juyo",
    "yuhinkai_volume": 68,
    "yuhinkai_item_number": 14936,
    "collection_display": "Juyo Token",
    "has_setsumei": true,
    "setsumei_en": "## Juyo Token, 68th Session...",
    "catalog_url": "https://yuhinkai.com/item/juyo/68/14936",
    "artisan": "Masamune",
    "school": "Soshu",
    "period": "Kamakura"
  },
  "willOverwrite": false,
  "existingEnrichment": null
}
```

**File:** `src/app/api/admin/setsumei/preview/route.ts`

---

### Connect: `POST /api/admin/setsumei/connect`

Creates or updates manual connection.

**Request Body:**
```json
{
  "listing_id": 5671,
  "yuhinkai_url": "/item/tokuju/25/5"
}
```

**Response:**
```json
{
  "success": true,
  "action": "created",
  "enrichment": {
    "id": 120,
    "listing_id": 5671,
    "yuhinkai_uuid": "abc-123-def",
    "yuhinkai_collection": "Tokuju",
    "yuhinkai_volume": 25,
    "yuhinkai_item_number": 5,
    "connection_source": "manual",
    "verified_by": "user-uuid",
    "verified_at": "2026-01-24T15:53:46Z"
  }
}
```

**File:** `src/app/api/admin/setsumei/connect/route.ts`

---

### Disconnect: `DELETE /api/admin/setsumei/disconnect`

Removes an existing connection.

**Request Body:**
```json
{
  "listing_id": 5671
}
```

**Response:**
```json
{
  "success": true,
  "message": "Enrichment removed for listing 5671"
}
```

**File:** `src/app/api/admin/setsumei/disconnect/route.ts`

---

## URL Parser

Parses Yuhinkai URLs to extract collection, volume, and item number.

**File:** `src/lib/yuhinkai/urlParser.ts`

### Supported URL Formats

```
https://yuhinkai.com/item/juyo/68/14936
https://www.yuhinkai.com/item/tokuju/25/5
/item/kokuho/1/100
item/hozon/45/7890
```

### Collection Mapping

| URL Segment | Collection Name | Display Name |
|-------------|-----------------|--------------|
| `juyo` | Juyo | Juyo Token |
| `tokuju` | Tokuju | Tokubetsu Juyo Token |
| `kokuho` | Kokuho | Kokuho (National Treasure) |
| `hozon` | Hozon | Hozon Token |
| `tokuho` | Tokuho | Tokubetsu Hozon Token |
| `juyo-bunkazai` | Juyo Bunkazai | Important Cultural Property |

### Usage

```typescript
import { parseYuhinkaiUrl } from '@/lib/yuhinkai/urlParser';

const result = parseYuhinkaiUrl('/item/juyo/68/14936');
// {
//   success: true,
//   data: {
//     collection: 'Juyo',
//     volume: 68,
//     itemNumber: 14936,
//     fullUrl: 'https://yuhinkai.com/item/juyo/68/14936'
//   }
// }
```

---

## Oshi-V2 Client

Read-only client for querying the Yuhinkai catalog database.

**File:** `src/lib/yuhinkai/oshiV2Client.ts`

### Environment Variables

```bash
# .env.local
OSHI_V2_SUPABASE_URL=https://xxx.supabase.co
OSHI_V2_SUPABASE_ANON_KEY=eyJ...
```

### Functions

#### `fetchCatalogRecord(collection, volume, itemNumber)`

Fetches a catalog record by its unique identifier.

```typescript
const record = await fetchCatalogRecord('Juyo', 68, 14936);
// Returns: CatalogRecord | null
```

#### Helper Extractors

```typescript
extractArtisanName(metadata)    // "Masamune" from metadata.artisan
extractArtisanKanji(metadata)   // "正宗" from metadata.artisan_kanji
extractSchool(metadata)         // "Soshu" from metadata.school
extractPeriod(metadata)         // "Kamakura" from metadata.period
extractItemCategory(metadata)   // "blade" or "tosogu"
getCertTypeFromCollection(col)  // "Juyo" → "Juyo Token"
```

---

## UI Components

### AdminSetsumeiWidget

Inline admin widget for managing connections.

**File:** `src/components/listing/AdminSetsumeiWidget.tsx`

#### States

1. **Collapsed** (default): Shows header with "Connected" badge if enriched
2. **Expanded - No Connection**: URL input field + Preview button
3. **Expanded - Preview**: Shows catalog record preview + Connect button
4. **Expanded - Connected**: Shows connection details + Disconnect option

#### Props

```typescript
interface AdminSetsumeiWidgetProps {
  listing: Listing;
  onConnectionChanged?: () => void;  // Called after connect/disconnect
}
```

#### Integration

```tsx
// In QuickViewContent.tsx or ListingDetailClient.tsx
{isAdmin && (
  <AdminSetsumeiWidget
    listing={listing}
    onConnectionChanged={quickView?.refreshCurrentListing}
  />
)}
```

---

### YuhinkaiEnrichmentSection

Displays the setsumei translation from Yuhinkai enrichment.

**File:** `src/components/listing/YuhinkaiEnrichmentSection.tsx`

#### Render Conditions

Only renders when `hasVerifiedEnrichment(listing)` returns true:
- `listing.yuhinkai_enrichment` exists
- `match_confidence === 'DEFINITIVE'`
- `verification_status` is `'auto'` or `'confirmed'`

#### Display Modes

1. **Full setsumei**: Shows "Official Catalog Translation" header with markdown content
2. **Metadata only**: Shows "Catalog Data" with artisan/school when no setsumei

#### Props

```typescript
interface YuhinkaiEnrichmentSectionProps {
  listing: ListingWithEnrichment;
  variant?: 'preview' | 'full';      // 'preview' truncates content
  previewLength?: number;             // Default: 400 chars
  className?: string;
}
```

---

### SetsumeiSection vs YuhinkaiEnrichmentSection

**Important:** These are two separate systems for displaying setsumei:

| Component | Data Source | Use Case |
|-----------|-------------|----------|
| `SetsumeiSection` | `listing.setsumei_text_en` | Direct OCR from listing images |
| `YuhinkaiEnrichmentSection` | `listing.yuhinkai_enrichment.setsumei_en` | Yuhinkai catalog (auto or manual) |

Both can coexist - a listing might have direct OCR setsumei AND Yuhinkai enrichment.

---

## QuickView Integration

### Data Flow Problem (Solved)

The browse API doesn't include `yuhinkai_enrichment` data to keep payloads small. When opening QuickView from the grid, the listing initially lacks enrichment.

### Solution

`QuickViewContext.openQuickView()` fetches the full listing data from `/api/listing/[id]` after opening, which includes enrichment:

```typescript
// In QuickViewContext.tsx
const openQuickView = useCallback((listing: Listing) => {
  // ... set initial state

  // Fetch full listing data (with enrichment) asynchronously
  fetchFullListing(listing.id).then((fullListing) => {
    if (fullListing) {
      setCurrentListing(fullListing);
    }
  });
}, [...]);
```

### Refresh After Connection

When `AdminSetsumeiWidget` connects/disconnects, it calls `onConnectionChanged()` which triggers `refreshCurrentListing()` to reload the updated data.

---

## Type Definitions

**File:** `src/types/index.ts`

```typescript
interface YuhinkaiEnrichment {
  enrichment_id: number;
  listing_id: number;
  yuhinkai_uuid: string;
  yuhinkai_collection: string | null;
  yuhinkai_volume: number | null;
  yuhinkai_item_number: number | null;
  match_score: number;
  match_confidence: string;
  match_signals: Record<string, unknown> | null;
  matched_fields: string[] | null;
  enriched_maker: string | null;
  enriched_maker_kanji: string | null;
  enriched_school: string | null;
  enriched_period: string | null;
  enriched_form_type: string | null;
  setsumei_ja: string | null;
  setsumei_en: string | null;
  setsumei_en_format: string | null;
  enriched_cert_type: string | null;
  enriched_cert_session: number | null;
  item_category: string | null;
  verification_status: string;
  enriched_at: string;
  updated_at: string;
}

interface ListingWithEnrichment extends Listing {
  yuhinkai_enrichment?: YuhinkaiEnrichment | null;
}

function hasVerifiedEnrichment(listing: ListingWithEnrichment): boolean {
  const enrichment = listing.yuhinkai_enrichment;
  if (!enrichment) return false;
  return (
    enrichment.match_confidence === 'DEFINITIVE' &&
    ['auto', 'confirmed'].includes(enrichment.verification_status)
  );
}
```

---

## Security

### Authentication

All `/api/admin/setsumei/*` endpoints verify:
1. User is authenticated via Supabase auth
2. User has `role: 'admin'` in their profile

```typescript
async function verifyAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }
  return { user };
}
```

### Service Client

Writing to `yuhinkai_enrichments` requires the service role key (RLS):

```typescript
import { createServiceClient } from '@/lib/supabase/server';
const serviceClient = createServiceClient();
// Use for INSERT/UPDATE/DELETE operations
```

### Audit Trail

Manual connections are tracked via:
- `connection_source: 'manual'`
- `verified_by: <user-uuid>`
- `verified_at: <timestamp>`
- `match_signals: { manual: true, connected_by: <user-uuid> }`

---

## Testing

### Unit Tests

**File:** `tests/components/listing/AdminSetsumeiWidget.test.tsx`

```bash
npm test -- AdminSetsumeiWidget
```

### E2E Tests

**File:** `tests/e2e/quickview-yuhinkai-debug.spec.ts`

```bash
npx playwright test quickview-yuhinkai-debug
```

---

## Troubleshooting

### Enrichment Not Showing in QuickView

1. **Check API response:**
   ```bash
   curl "https://nihontowatch.com/api/listing/LISTING_ID?nocache=1" | grep yuhinkai_enrichment
   ```

2. **Verify enrichment values:**
   - `match_confidence` must be `"DEFINITIVE"`
   - `verification_status` must be `"auto"` or `"confirmed"`

3. **Hard refresh browser:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### Connection Fails

1. **Check Yuhinkai URL format:** Must match `/item/{collection}/{volume}/{itemNumber}`

2. **Verify catalog record exists:** The oshi-v2 database must have the record

3. **Check environment variables:**
   ```bash
   echo $OSHI_V2_SUPABASE_URL
   echo $OSHI_V2_SUPABASE_ANON_KEY
   ```

### Admin Widget Not Visible

1. **Verify admin status:** User must have `role: 'admin'` in profiles table

2. **Check `isAdmin` context:** `useAuth()` must return `isAdmin: true`

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/yuhinkai/urlParser.ts` | Parse Yuhinkai URLs |
| `src/lib/yuhinkai/oshiV2Client.ts` | Query oshi-v2 database |
| `src/app/api/admin/setsumei/preview/route.ts` | Preview endpoint |
| `src/app/api/admin/setsumei/connect/route.ts` | Connect endpoint |
| `src/app/api/admin/setsumei/disconnect/route.ts` | Disconnect endpoint |
| `src/components/listing/AdminSetsumeiWidget.tsx` | Admin UI widget |
| `src/components/listing/YuhinkaiEnrichmentSection.tsx` | Display enrichment |
| `src/components/listing/SetsumeiSection.tsx` | Display direct OCR setsumei |
| `src/contexts/QuickViewContext.tsx` | QuickView state + data fetching |
| `src/types/index.ts` | Type definitions |
| `supabase/migrations/040_manual_enrichment_tracking.sql` | Database migration |
| `tests/components/listing/AdminSetsumeiWidget.test.tsx` | Unit tests |
| `tests/e2e/quickview-yuhinkai-debug.spec.ts` | E2E tests |

---

## Related Documentation

- [Plan: Manual Yuhinkai Setsumei Connection](/.claude/plans/stateless-nibbling-bonbon.md)
- [Architecture Overview](/docs/ARCHITECTURE.md)
- [Cross-Repo Reference](/docs/CROSS_REPO_REFERENCE.md)
