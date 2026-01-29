# Email Alert System

This document describes the email notification system for Nihontowatch.

## Overview

The system sends three types of email notifications:

| Type | Trigger | Frequency |
|------|---------|-----------|
| **Saved Search** | New listings match saved search criteria | Instant (15 min) or Daily digest |
| **Price Drop** | Price decreases on watched item | Every 15 min (24h cooldown) |
| **Back in Stock** | Sold item becomes available again | Every 15 min (24h cooldown) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Vercel Cron Jobs                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Saved Searches  │  │  Price Alerts   │  │  Stock Alerts   │ │
│  │ */15 * * * *    │  │ */15 * * * *    │  │ */15 * * * *    │ │
│  │ 0 8 * * * (daily)│  │                 │  │                 │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SendGrid API                             ││
│  │                notifications@nihontowatch.com               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/api/cron/
│   ├── process-saved-searches/route.ts  # Saved search notifications
│   ├── process-price-alerts/route.ts    # Price drop notifications
│   └── process-stock-alerts/route.ts    # Back-in-stock notifications
├── lib/email/
│   ├── sendgrid.ts                      # SendGrid integration
│   └── templates/
│       ├── saved-search.ts              # Saved search email template
│       ├── price-drop.ts                # Price drop email template
│       └── back-in-stock.ts             # Back-in-stock email template
└── lib/savedSearches/
    ├── matcher.ts                       # Finds listings matching criteria
    └── urlToCriteria.ts                 # Converts URL params to criteria
```

## Configuration

### Environment Variables

```bash
# .env.local
SENDGRID_API_KEY=SG.xxxxx           # SendGrid API key
SENDGRID_FROM_EMAIL=notifications@nihontowatch.com  # Verified sender
CRON_SECRET=your-secret-here        # Auth for cron endpoints
NEXT_PUBLIC_SITE_URL=https://nihontowatch.com
```

### Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-saved-searches?frequency=instant",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/process-saved-searches?frequency=daily",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/process-price-alerts",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/process-stock-alerts",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

## Cron Endpoints

### Saved Search Notifications

**Endpoint:** `GET /api/cron/process-saved-searches?frequency=instant|daily`

**Logic:**
1. Fetch all active saved searches with matching notification frequency
2. For each search, find new listings since `last_notified_at`
3. If matches found, send email and update `last_notified_at`
4. Record notification in `saved_search_notifications` table

### Price Drop Alerts

**Endpoint:** `GET /api/cron/process-price-alerts`

**Logic:**
1. Query `price_history` for price decreases in last 20 minutes
2. Find active `price_drop` alerts for those listings
3. Check 24-hour cooldown (`last_triggered_at`)
4. Send email and update alert timestamp
5. Record in `alert_history` table

### Back-in-Stock Alerts

**Endpoint:** `GET /api/cron/process-stock-alerts`

**Logic:**
1. Query `price_history` for status changes to 'available'
2. Find active `back_in_stock` alerts for those listings
3. Check 24-hour cooldown
4. Send email and update alert timestamp
5. Record in `alert_history` table

## Database Tables

### saved_searches
```sql
id, user_id, name, search_criteria (JSONB),
notification_frequency ('instant'|'daily'|'none'),
is_active, last_notified_at, last_match_count
```

### alerts
```sql
id, user_id, listing_id, alert_type ('price_drop'|'back_in_stock'),
is_active, last_triggered_at, created_at
```

### alert_history
```sql
id, alert_id, listing_id, alert_type, old_value, new_value,
triggered_at, delivery_status, delivery_method, error_message
```

### saved_search_notifications
```sql
id, saved_search_id, matched_listing_ids (JSONB),
status ('sent'|'failed'), sent_at, error_message
```

## Testing

### Test Endpoint

**Endpoint:** `POST /api/test/send-email`

**Authorization:** Admin user or `x-cron-secret` header

**Request body:**
```json
{
  "type": "saved-search" | "price-drop" | "back-in-stock",
  "email": "recipient@example.com"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/test/send-email \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"type": "saved-search", "email": "your@email.com"}'
```

### Manual Cron Testing

```bash
# Test saved search notifications
curl -H "x-cron-secret: YOUR_SECRET" \
  "http://localhost:3000/api/cron/process-saved-searches?frequency=instant"

# Test price drop alerts
curl -H "x-cron-secret: YOUR_SECRET" \
  "http://localhost:3000/api/cron/process-price-alerts"

# Test back-in-stock alerts
curl -H "x-cron-secret: YOUR_SECRET" \
  "http://localhost:3000/api/cron/process-stock-alerts"
```

## Email Templates

All templates include:
- Responsive HTML design (mobile-friendly)
- Plain text fallback
- Nihontowatch branding
- Listing images and details
- **Quickview links** - clicking items opens them on Nihontowatch (not external dealer sites)
- Manage alerts link

### Saved Search Email
- Subject: "New matches for [search name]" or "Daily digest: X new matches"
- Shows up to 10 listings with images, titles, prices
- **Each listing links to quickview**: `https://nihontowatch.com/?listing=<id>`
- "View All Results" button links to full search results

### Price Drop Email
- Subject: "Price dropped X% on [listing title]"
- Shows old price → new price with percentage
- Listing image and details

### Back-in-Stock Email
- Subject: "[listing title] is back in stock!"
- Listing image, price, and details
- Direct link to purchase

## Listing Links

Email templates use `getListingQuickViewUrl(listingId)` to generate links that open on Nihontowatch:

```typescript
// src/lib/email/templates/saved-search.ts
getListingQuickViewUrl(39097)
// Returns: "https://nihontowatch.com/?listing=39097"
```

When users click these links:
1. The `?listing=<id>` parameter is detected by `DeepLinkHandler`
2. The listing is fetched from Supabase
3. The QuickView modal opens with full listing details

This keeps users on Nihontowatch instead of redirecting to external dealer sites.

## SendGrid Setup

1. Create account at https://sendgrid.com (free tier: 100 emails/day)
2. Verify sender email or domain at Settings → Sender Authentication
3. Create API key at Settings → API Keys
4. Add to `.env.local`:
   ```
   SENDGRID_API_KEY=SG.xxxxx
   SENDGRID_FROM_EMAIL=your-verified@email.com
   ```

## Monitoring

- **SendGrid Activity:** https://app.sendgrid.com/email_activity
- **Vercel Logs:** Check function logs for cron execution
- **Database:** Query `alert_history` and `saved_search_notifications` tables

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Emails not sending | Check SendGrid sender verification |
| Emails in spam | Add SPF/DKIM records for domain |
| No notifications sent | Check `last_notified_at` timestamps |
| Cron not running | Verify `vercel.json` and CRON_SECRET |
