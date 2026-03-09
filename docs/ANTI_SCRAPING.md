# Anti-Scraping Countermeasures

**Date:** 2026-03-08
**Status:** Deployed to production

## Threat Model

Our `/api/browse` endpoint returns clean, paginated JSON (40+ fields per listing, up to 200 items per page). A scraper can bulk-extract the entire ~5,000-item catalog without parsing HTML. `robots.txt` disallows `/api/` but only stops well-behaved bots. These countermeasures add server-enforced rate limiting.

## Defense Layers

### Layer 1: Cloudflare WAF Rate Limiting (Global, Durable)

**Rule:** `API Rate Limit`
- **Match:** URI Path starts with `/api/`
- **Rate:** 10 requests per 10 seconds per IP
- **Action:** Block for 10 seconds
- **Plan:** Free tier (limits: 1 rule, 10s window, 10s block duration)

**Why this works:**
- Global state — shared across all Vercel isolates, survives cold starts
- Runs at the edge before traffic reaches Vercel
- Catches burst scraping from any single IP

**Limitations (Free plan):**
- Only 1 rate limiting rule (can't set per-route limits)
- 10-second window and block duration only (Pro plan unlocks 1min–1day)
- No custom response body

### Layer 2: Middleware Rate Limiter (Per-Isolate, Route-Specific)

**File:** `src/lib/rateLimit.ts`, applied in `src/middleware.ts`

Sliding-window rate limiter with per-route configuration, running in middleware before Supabase auth (saves the round-trip for abusive clients).

**Route limits (per minute):**

| Route | Limit | Rationale |
|-------|-------|-----------|
| `/api/browse` | 30 | Main scraping target |
| `/api/listing/` | 60 | Users click through listings fast |
| `/api/artisan/` | 30 | Artist detail + listings |
| `/api/artists/` | 30 | Artist directory pagination |
| `/api/search/` | 20 | Search suggestions |
| `/api/favorites` | 30 | Favorites list |
| `/api/exchange-rates` | 10 | Rarely changes |
| Default `/api/*` | 60 | Catch-all |

**Bypassed routes** (not rate limited):
- `/api/og` — Open Graph images (social media crawlers)
- `/api/health` — Monitoring
- `/api/cron/*` — Vercel cron jobs (gated by `x-cron-secret`)
- `/api/admin/*` — Already auth-gated in middleware
- `/api/dealer/*` — Already auth-gated in middleware
- `/api/webhook*` — Stripe webhooks

**Response on 429:**
```json
{ "error": "Too many requests. Please try again later." }
```
Headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**IP extraction:** `x-forwarded-for` (first IP) → `x-real-ip` → `'unknown'`

**Storage:** In-memory `Map<string, number[]>` (timestamps per IP:route key). Cleanup runs every 60s. Resets on cold start — this is the gap Cloudflare fills.

### Layer 3: robots.txt

**File:** `src/app/robots.ts`

Disallows `/api/` for all user agents. Allows `/api/og` only. Advisory — stops Googlebot and well-behaved crawlers from indexing API responses.

### Layer 4: Cloudflare AI Labyrinth

Enabled in Cloudflare Security Settings. Injects nofollow links with AI-generated content to trap and waste scraper bots that ignore robots.txt. Only visible to bots, not real users.

### Layer 5: Existing Per-Endpoint Rate Limiters

Some endpoints have their own tighter inner limits (enforced in the route handler, not middleware):
- `/api/translate` — 10 requests/min per user (LLM cost control)
- `/api/feedback` — 10 submissions/hour per user (spam prevention)

## How the Layers Interact

```
Request
  │
  ├─ Cloudflare Edge (Layer 1)
  │   └─ 10 req/10s per IP on /api/* → 429 block for 10s
  │
  ├─ Middleware (Layer 2) — before auth
  │   └─ Per-route sliding window → 429 with Retry-After
  │
  ├─ Supabase Auth (existing)
  │   └─ Admin/dealer route protection
  │
  └─ Route Handler (Layer 5)
      └─ translate: 10/min, feedback: 10/hour
```

A scraper must pass Cloudflare's global rate limit, then the middleware's per-route limit, then (if applicable) the endpoint's own limit. Each layer independently blocks.

## What This Stops

| Threat | Stopped? | By |
|--------|----------|----|
| Naive script hammering `/api/browse` in a loop | Yes | Cloudflare + middleware |
| Single IP, 1 req/2s slow scrape | Partially | Middleware (30/min on browse), but 1/2s = 30/min exactly at the limit |
| 10+ rotating proxy IPs | Partially | Each IP gets its own limit — slows but doesn't prevent |
| Headless browser scraping SSR pages | No | No JS challenge on HTML pages |
| Sitemap enumeration → `/listing/{id}` | Partially | 60/min per IP per route |

## What This Doesn't Stop

1. **Distributed scraping** — 50 rotating IPs bypass per-IP limits trivially
2. **Slow-and-steady** — 1 req every 3 seconds from a single IP stays under all limits
3. **SSR HTML scraping** — Rate limiting only applies to `/api/*`, not server-rendered pages
4. **Sitemap-based enumeration** — `sitemap.xml` exposes every listing ID publicly
5. **Image harvesting** — Supabase Storage URLs are public, no rate limiting

## Upgrade Path

| Improvement | Effort | Impact | Cost |
|-------------|--------|--------|------|
| **Cloudflare Pro plan** | Config only | 1-min+ windows, 1-hour blocks, multiple rules | $20/mo |
| **Upstash Redis store** | Code change (`rateLimit.ts`) | Shared state across all isolates, survives cold starts | ~$10/mo |
| **Reduce browse page size cap** | 1-line code change | 200→50 max forces 4x more requests, limits bite harder | Free |
| **Daily IP quota (Supabase)** | New table + middleware check | Catches slow scrapers (500 req/day cap) | Free |
| **Cloudflare Bot Management** | Config + Pro plan | Bot scoring, JS challenges, fingerprinting | $20/mo |
| **Auth-gate `/api/browse`** | Significant code change | Biggest impact but kills public access / SEO | Free |

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/rateLimit.ts` | Sliding window rate limiter module |
| `src/middleware.ts` | Rate limit check (lines 43-70), before auth |
| `tests/lib/rateLimit.test.ts` | 20 unit tests |
| `src/app/robots.ts` | robots.txt generation |

## Commit

`a68f5fc` — `feat: add sliding-window rate limiting on API routes`
