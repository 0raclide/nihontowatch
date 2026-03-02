# NihontoWatch: 25-Point "Ticking Bomb" Audit

**Date:** 2026-03-02
**Auditor:** Claude Code (automated codebase analysis)
**Source checklist:** "25 signs your vibe-coded app is a ticking bomb"

---

## Scorecard

| # | Check | Verdict | Severity |
|---|-------|---------|----------|
| 1 | API keys hardcoded | **PASS** | — |
| 2 | No /health endpoint | **PASS** | — |
| 3 | Schema changes not in migrations | **PASS** | — |
| 4 | Every query is SELECT * | **PASS** | — |
| 5 | Error handling = console.log | **PASS** | — |
| 6 | No rate limit on auth/writes | **PARTIAL** | Medium |
| 7 | UTC / local time mixed | **PARTIAL** | Low |
| 8 | README empty or wrong | **PASS** | — |
| 9 | No staging env | **PASS** | — |
| 10 | God components | **FAIL** | Medium |
| 11 | No analytics | **PASS** | — |
| 12 | "We'll clean up after launch" | **PASS** | — |
| 13 | Env vars only on your laptop | **PARTIAL** | Medium |
| 14 | Frontend calls 5 APIs directly | **PASS** | — |
| 15 | No monitoring or alerts | **PARTIAL** | High |
| 16 | Logs only in terminal | **PARTIAL** | Medium |
| 17 | DB backups never tested | **FAIL** | High |
| 18 | Feature flags = commenting code | **PASS** | — |
| 19 | Deploys from local machine | **PASS** | — |
| 20 | No input validation | **PASS** | — |
| 21 | CORS set to * | **PASS** | — |
| 22 | CI = "ran it locally once" | **PASS** | — |
| 23 | Same API token across envs | **PASS** | — |
| 24 | Only one person can deploy | **PASS** | — |
| 25 | Overall production readiness | **PASS** | — |

**Result: 17 PASS, 5 PARTIAL, 2 FAIL, 1 meta (overall)**

---

## Detailed Findings

### 1. API keys hardcoded "for now" — PASS

- `.gitignore` excludes `.env*` (line 34)
- `.env.example` has placeholders only (no real values)
- All secrets accessed via `process.env.*`
- No hardcoded `sk_`, `SG.`, bearer tokens found in source
- `NEXT_PUBLIC_` prefix used correctly (only for truly public values)

### 2. No /health endpoint — PASS

- Full health endpoint at `src/app/api/health/route.ts` (107 lines)
- Checks: database connectivity with latency, environment variable presence
- Returns `healthy` / `degraded` / `unhealthy` with HTTP 200/503
- Includes `X-Response-Time` header, `Cache-Control: no-store`

### 3. Schema in head, not migrations — PASS

- **94 numbered migration files** in `supabase/migrations/`
- Sequential numbering: `001_normalize_listings.sql` through `094_artisan_designation_factor.sql`
- Covers: tables, indexes, RPC functions, RLS policies, triggers
- All schema changes version-controlled

### 4. Every query is SELECT * — PASS

- All major APIs specify columns explicitly
- Browse API: 40+ columns listed in `.select()` (route.ts:262-315)
- Artisan Listings: `LISTING_FIELDS` constant with explicit column list
- Favorites, notifications, user queries: all column-specific
- **One exception:** `collection/items` uses `.select('*')` on user-owned RLS-protected data (acceptable)

### 5. Error handling = console.log(e) — PASS

- Structured logger at `src/lib/logger.ts` (227 lines) with level-aware output
- API response helpers in `src/lib/api/responses.ts`: `apiUnauthorized()`, `apiBadRequest()`, `apiServerError()`, etc.
- All sampled API routes use try/catch with proper HTTP error codes
- Activity API uses `Promise.allSettled` for graceful degradation on analytics writes

### 6. No rate limit on auth or writes — PARTIAL

**What works:**
- Feedback API: 10 submissions/hour/user (DB count check) — `feedback/route.ts:41-51`
- Translate API: 10 requests/minute/IP (in-memory map) — `translate/route.ts:13-47`

**What's missing:**
- Favorites POST/DELETE: no throttle
- Saved searches POST: max-count limit (20) but no per-request rate limit
- Collection items POST: no throttle
- Alert creation: no throttle

**Risk:** Authenticated users could spam write endpoints. Mitigated by auth requirement and resource caps, but no per-request throttling.

**Recommendation:** Add generic rate-limit middleware (e.g., 30 writes/min per user) to all POST/DELETE routes.

### 7. UTC / local time mixed — PARTIAL

**What works:**
- Database stores all timestamps as UTC (ISO 8601 via `.toISOString()`)
- `formatRelativeTime()` in `src/lib/time.ts` uses epoch math (timezone-agnostic)
- All Supabase queries use ISO strings

**Minor concerns:**
- Activity chart API (`admin/stats/activity-chart/route.ts:68-74`) mixes `new Date()` with `setUTCHours()` — semantically confusing but functionally correct on Vercel (runs in UTC)
- Saved search cron has 25-hour lookback "for timezone variations" — a workaround, not a bug, since user timezone preferences aren't stored

**Risk:** Low. Vercel serverless runs in UTC. The mixed patterns are cosmetic, not functional bugs. Would only matter if server moved to a non-UTC environment.

### 8. README empty or wrong — PASS

- `README.md`: 107 lines, well-structured
- Accurate sections: overview, features, tech stack, development setup, project structure, deployment
- Links to docs/ and CLAUDE.md
- Live URL correct (nihontowatch.com)

### 9. No staging env — PASS

- Vercel auto-creates preview deployments on every PR
- Production: `main` branch auto-deploys
- Preview: any other branch gets `https://nihontowatch-*.vercel.app`
- Cron jobs run only in production (Vercel's `vercel.json` cron config)
- Environment variables separated per deployment context in Vercel dashboard

### 10. God components — FAIL

Six components exceed 800 lines:

| Component | Lines | Concern |
|-----------|-------|---------|
| `FilterContent.tsx` | 1,219 | All 4 filter types + sort + form state in one file |
| `ListingCard.tsx` | 896 | Card + cert pills + image + artisan badge + skeleton |
| `ArtisanTooltip.tsx` | 842 | "Tooltip" that's actually a modal with search + edit |
| `HomeClient.tsx` | 810 | Browse page: URL sync, filters, pagination, grid, sidebar |
| `InquiryModal.tsx` | 675 | Modal + form + validation + email draft + submission |
| `ListingDetailClient.tsx` | 585 | Page state + 3 modals + carousel + tracking |

**Median component size:** ~180 lines (healthy).
**Outlier count:** 6/137 components (4.4%) are oversized.

**Risk:** High blast radius on changes to FilterContent or HomeClient. Testing one filter type requires touching all four due to shared state.

**Recommendation:** Extract sub-components. FilterContent → FilterPeriod, FilterSignature, FilterDealer, FilterType. ListingCard → CardImage, CardCert, CardAttribution.

### 11. No analytics — PASS

Comprehensive built-in analytics:
- `ActivityTracker.tsx` (901 lines): 17+ event types, batched writes (30s / 50 events)
- `activity/route.ts`: Validates and stores events in `activity_events` table
- `DwellTracker.ts`: Viewport-based dwell time tracking
- Dealer analytics: click-through, favorites, conversion, rankings (5 SQL RPC functions)
- Admin dashboards: `/admin/analytics`, `/admin/visitors`, `/admin/dealers`

**Note:** Data is in Supabase, not an external analytics platform. No Google Analytics / Mixpanel / Amplitude. This is a deliberate architectural choice (privacy-first, no third-party scripts).

### 12. "We'll clean this up after launch" — PASS

Only **7 TODO comments** in entire `src/`:
- 3 feature placeholders (CSV export, user details modal, export functionality)
- 2 DB schema dependencies (tosogu measurement columns)
- 1 email notification (payment failure)
- 1 signup logic placeholder

All are legitimate future work items, not deferred cleanup. No HACK/FIXME/WORKAROUND comments found.

### 13. Env vars only on your laptop — PARTIAL

**What works:**
- `.env.example` exists with template structure
- `CLAUDE.md` documents all env vars (lines 186-225)
- Vercel dashboard holds production secrets
- GitHub Secrets used in CI workflows

**What's missing:**
- `.env.example` only lists 3 of 20+ required variables
- Missing from template: `CRON_SECRET`, `SENDGRID_API_KEY`, `OPENROUTER_API_KEY`, `STRIPE_*`, `YUHINKAI_*`, `OSHI_V2_*`, `NEXT_PUBLIC_BASE_URL`, `GITHUB_TOKEN`

**Risk:** New developer copies `.env.example`, gets a partially working app. Cron jobs, email, AI translation, Stripe all silently fail.

**Recommendation:** Update `.env.example` with all 20+ variables (placeholder values + comments).

### 14. Frontend calls 5 APIs directly — PASS

All external integrations proxied through API routes:
- Stripe → `/api/subscription/checkout`, `/api/subscription/webhook`
- SendGrid → cron routes → `src/lib/email/sendgrid.ts` (server-only)
- OpenRouter → `/api/translate` (server-only)
- Supabase → client-side anon key (read-only, by design)

No client-side `fetch()` calls to third-party domains with secret keys.

### 15. No monitoring or alerts — PARTIAL

**What works:**
- `/api/health` endpoint exists (DB + env checks, returns 503 on failure)
- Vercel sends deployment failure emails (built-in)
- GitHub Actions validates cron HTTP responses post-deploy

**What's missing:**
- No external uptime monitor consuming `/api/health` (UptimeRobot, Checkly, etc.)
- No error tracking service (Sentry, DataDog, LogRocket)
- No Slack/PagerDuty alerting on errors
- Logger has commented-out `sendToErrorTracking()` placeholder (logger.ts:151-154)

**Risk:** You find out the site is down from a user DM or by manually checking. Health endpoint exists but nobody watches it.

**Recommendation:** Add UptimeRobot (free tier) pointing at `/api/health`. Uncomment and implement `sendToErrorTracking()` in logger.ts.

### 16. Logs only in terminal — PARTIAL

**What works:**
- Structured logger (`src/lib/logger.ts`, 227 lines) with debug/info/warn/error levels
- Environment-aware: dev shows all, prod server shows info+, prod client shows warn+
- Vercel auto-captures stdout/stderr in deployment logs

**What's missing:**
- Vercel log retention: ~7 days (then gone)
- No external log aggregation (Axiom, LogTail, DataDog Logs)
- No searchable log history beyond Vercel dashboard
- `sendToErrorTracking()` commented out

**Risk:** If a bug manifests in production 10 days ago, logs are gone. Forensic debugging requires reproducing the issue.

### 17. DB backups never tested — FAIL

**What exists:**
- Supabase automatic daily backups (managed)
- 7-day point-in-time recovery (Supabase feature)
- 94 versioned migrations (can rebuild schema from scratch)
- Ad-hoc backup tables created during data fixes (e.g., `yuhinkai_enrichments_backup_20260121`)

**What's missing:**
- No restore playbook / disaster recovery document
- No RTO/RPO targets defined
- No quarterly restore test schedule
- No cross-region backup
- No documented "what to do if Supabase goes down" procedure

**Risk:** Backups exist but have never been validated. If Supabase has a regional outage or data corruption, there's no tested procedure to follow.

**Recommendation:** Create `docs/DISASTER_RECOVERY.md` with restore steps, RTO (e.g., 4h), RPO (e.g., 1h), and schedule quarterly test restores.

### 18. Feature flags = commenting code — PASS

- `isTrialModeActive()` reads `NEXT_PUBLIC_TRIAL_MODE` env var (`subscription.ts:98-100`)
- `isSmartCropActive()` reads `NEXT_PUBLIC_SMART_CROP` env var (`subscription.ts:106-108`)
- `canAccessFeature(tier, feature)` with `FEATURE_MIN_TIER` map gates subscription features
- Toggle via Vercel env vars + redeploy — no code changes needed

### 19. Deploys from local machine — PASS

- **GitHub Actions CI** (`.github/workflows/test.yml`, 121 lines): unit tests, build check, concordance tests
- **Vercel auto-deploy** on push to `main`
- **Preview deploys** on every PR
- No manual deploy scripts, no `scp` to a server, no `docker push` from laptop
- 8 cron jobs configured in `vercel.json`

### 20. No input validation — PASS

- Feedback API: type allowlist, message length cap (2000), rate limit
- Activity API: 17 valid event types allowlist, timestamp validation, session ID required
- Saved Searches: `validateCriteria()` imported validator + feature gate
- Fix Artisan: listing ID, artisan_id, confidence all validated with `apiBadRequest()` on failure
- Collection: numeric range clamping (`Math.min(limit, 200)`)
- Pattern: manual validation (not Zod/Joi) but systematic and complete

### 21. CORS set to * — PASS

- No `Access-Control-Allow-Origin: *` anywhere in codebase
- Security headers in `next.config.ts:28-59`:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Image `remotePatterns` allows HTTPS from any domain (correct for multi-dealer image aggregation)

### 22. CI = "ran it locally" — PASS

- **116 test files** across `tests/`
- **11 test scripts** in package.json: unit, API, lib, SQL, components, e2e, coverage
- **GitHub Actions** runs on push + PR: unit tests, build check, production concordance
- **Vitest** for unit/integration, **Playwright** for e2e
- Concordance test hits production API post-deploy to verify data integrity

### 23. Same token across envs — PASS

- `.env.local` (dev), Vercel dashboard (prod), GitHub Secrets (CI) — all separate
- Different Supabase project keys per environment
- `.gitignore` blocks all `.env*` files
- CI workflow references `${{ secrets.* }}` (not hardcoded values)

### 24. Only one person can deploy — PASS

- `README.md`: step-by-step setup (clone, install, env, dev server)
- `CLAUDE.md`: 766-line comprehensive guide with schema, patterns, rules
- `docs/`: 47+ documents covering architecture, features, postmortems, sessions
- Deploy: `git push origin main` — anyone with repo access can deploy
- No tribal knowledge required — env vars documented, migrations versioned, CI automated

### 25. Overall production readiness — PASS

The project is **live in production** at nihontowatch.com serving real collector traffic. Infrastructure is mature:
- 94 DB migrations, 116 test files, 47 docs, full CI/CD
- Proper auth, CORS, input validation, feature flags
- Admin dashboards, cron jobs, analytics tracking
- Incident postmortems documenting lessons learned

---

## Priority Action Items

### High Priority
1. **Monitoring:** Add external uptime monitor (UptimeRobot/Checkly) consuming `/api/health`
2. **Disaster recovery:** Create `docs/DISASTER_RECOVERY.md` with restore playbook and test schedule
3. **Error tracking:** Implement `sendToErrorTracking()` in logger.ts (Sentry free tier)

### Medium Priority
4. **Rate limiting:** Add generic write-endpoint middleware (30 req/min/user)
5. **`.env.example`:** Expand from 3 variables to all 20+ with placeholder comments
6. **Log retention:** Add Axiom or LogTail integration for searchable log history

### Low Priority (Quality of Life)
7. **Component decomposition:** Split FilterContent (1,219 lines) and ListingCard (896 lines) into sub-components
8. **Timezone:** Centralize date construction patterns (minor, since Vercel runs in UTC)
