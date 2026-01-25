# Nihontowatch Documentation Index

## This Project

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](../CLAUDE.md) | AI context, project overview, quick reference |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow, infrastructure |
| [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md) | What lives where across all repos |
| [DEALERS.md](./DEALERS.md) | Dealer-specific quirks, exclusions, maintenance notes |
| [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) | Auth, profiles, favorites, alerts, activity tracking, admin |
| [INQUIRY_EMAIL_SYSTEM.md](./INQUIRY_EMAIL_SYSTEM.md) | AI-powered dealer inquiry emails (keigo, seasonal greetings, collector etiquette) |
| [EMAIL_ALERTS.md](./EMAIL_ALERTS.md) | Email notification system (saved searches, price drops, back-in-stock) |
| [SIGNUP_PRESSURE.md](./SIGNUP_PRESSURE.md) | Signup modal triggers, thresholds, copy variants, testing |
| [MOBILE_UX.md](./MOBILE_UX.md) | Mobile interaction patterns, QuickView bottom sheet |
| [USER_BEHAVIOR_TRACKING.md](./USER_BEHAVIOR_TRACKING.md) | Engagement signals, interest scoring, recommendations |
| [QUICKVIEW_METADATA.md](./QUICKVIEW_METADATA.md) | QuickView metadata display, translation system |
| [STUDY_SETSUMEI_FEATURE.md](./STUDY_SETSUMEI_FEATURE.md) | Study mode for reading NBTHK setsumei (book icon in QuickView) |
| [SEARCH_FEATURES.md](./SEARCH_FEATURES.md) | Natural language search, filters, query syntax |
| [NEW_LISTING_INDICATOR.md](./NEW_LISTING_INDICATOR.md) | "New" badge for recently discovered listings |
| [OPTIMIZATION.md](./OPTIMIZATION.md) | Performance optimization, image loading, caching strategies |
| [PRO_TIER_STRATEGY.md](./PRO_TIER_STRATEGY.md) | Subscription business strategy, tier features, pricing |
| [PRO_TIER_IMPLEMENTATION.md](./PRO_TIER_IMPLEMENTATION.md) | Full implementation checklist for subscription system |
| [PHASE_1_BREAKDOWN.md](./PHASE_1_BREAKDOWN.md) | Detailed Phase 1 task breakdown with estimates |
| [SUBSCRIPTION_HANDOFF.md](./SUBSCRIPTION_HANDOFF.md) | **Current status & handoff notes for subscription implementation** |
| [SEO.md](./SEO.md) | SEO optimization, structured data, sitemap, robots.txt |
| [TESTING.md](./TESTING.md) | Test suite docs, concordance tests, CI/CD integration |

## Postmortems & QA Audits

| Document | Date | Issue |
|----------|------|-------|
| [POSTMORTEM_SWORD_SETSUMEI_MISSING.md](./POSTMORTEM_SWORD_SETSUMEI_MISSING.md) | 2026-01-21 | Sword enrichments missing setsumei_en (translation_md not fetched) |
| [QA_PRICE_DATA_AUDIT_20260121.md](./QA_PRICE_DATA_AUDIT_20260121.md) | 2026-01-21 | **Comprehensive price data audit** - E-sword bug, parser bugs, sold transitions |
| [POSTMORTEM_PRICE_HISTORY_DATA_QUALITY.md](./POSTMORTEM_PRICE_HISTORY_DATA_QUALITY.md) | 2026-01-21 | price_history cleanup (178 bad records removed) |
| [POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md](./POSTMORTEM_TOUKEN_MATSUMOTO_SOLD.md) | 2025-01-20 | Touken Matsumoto listings incorrectly marked as sold (LLM hallucination) |
| [POSTMORTEM_TRAILING_SLASH_DUPLICATES.md](./POSTMORTEM_TRAILING_SLASH_DUPLICATES.md) | 2025-01-19 | Duplicate listings from URL trailing slash variants |
| [POSTMORTEM_SEARCH_DEBUG.md](./POSTMORTEM_SEARCH_DEBUG.md) | - | Search functionality debugging |
| [POSTMORTEM_NAVIGATION_CRASH.md](./POSTMORTEM_NAVIGATION_CRASH.md) | - | Navigation crash issue |
| [AUTH_SYSTEM_POSTMORTEM.md](./AUTH_SYSTEM_POSTMORTEM.md) | - | Auth system issues |
| [OTP_DEBUG_POSTMORTEM.md](./OTP_DEBUG_POSTMORTEM.md) | - | OTP verification issues |

---

## Related Projects

### Oshi-scrapper (Python Backend)

**Location:** `/Users/christopherhill/Desktop/Claude_project/Oshi-scrapper`

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Project overview, CLI commands |
| `docs/schema.md` | Database schema documentation |
| `docs/discovery.md` | Crawler documentation |
| `docs/DATA_FLOW.md` | How data flows through the system |
| `docs/TEST_COVERAGE_ANALYSIS.md` | Test coverage status (542 tests) |

**Key Files:**
| File | Purpose |
|------|---------|
| `models/listing.py` | **DATA MODEL** - ScrapedListing, ItemType, SwordSpecs, TosoguSpecs |
| `scrapers/base.py` | Base scraper class |
| `scrapers/registry.py` | Scraper discovery/routing |
| `db/repository.py` | Database CRUD operations |
| `db/client.py` | Supabase singleton |

### Oshi-v2 (Reference Implementation)

**Location:** `/Users/christopherhill/Desktop/Claude_project/oshi-v2`

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Comprehensive project guide |
| `docs/INDEX.md` | Documentation navigation |
| `docs/ARCHITECTURE.md` | System architecture |
| `docs/TESTING.md` | Test strategy (994 tests) |

**Key Files to Reference:**
| File | Purpose | Reusability |
|------|---------|-------------|
| `src/lib/constants.ts` | App-wide constants | High - adapt thresholds |
| `src/lib/fieldAccessors.ts` | Unified metadata extraction | High - dual-path pattern |
| `src/lib/textNormalization.ts` | Japanese text handling | High - use as-is |
| `src/lib/errors.ts` | Error handling | High - use pattern |
| `src/types/index.ts` | TypeScript types | Medium - adapt structure |
| `src/components/item/MetadataPanel.tsx` | Metadata display | Medium - adapt for listings |

---

## Quick Links by Task

### "I need to understand the data model"
1. Read `Oshi-scrapper/models/listing.py` - Python dataclasses
2. Read `Oshi-scrapper/supabase/migrations/` - SQL schema
3. See [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md#data-model)

### "I need to add a new dealer scraper"
1. Read `Oshi-scrapper/scrapers/base.py` - Base class
2. Copy `Oshi-scrapper/scrapers/generic.py` - Template
3. Add tests in `Oshi-scrapper/tests/scrapers/`
4. Document quirks in [DEALERS.md](./DEALERS.md)

### "I need to fix dealer-specific issues"
1. Read [DEALERS.md](./DEALERS.md) - Existing dealer notes
2. Check `Oshi-scrapper/scrapers/<dealer>.py` - Scraper code
3. Add exclusions, quirks, or cleanup notes to DEALERS.md

### "I need to build a UI component"
1. Check `oshi-v2/src/components/` - Reference implementations
2. Check `oshi-v2/src/lib/` - Utility functions
3. Adapt patterns for nihontowatch

### "I need to query the database"
1. Use Supabase client pattern from `oshi-v2/src/lib/supabase/`
2. Check `Oshi-scrapper/db/repository.py` - Python patterns
3. See [ARCHITECTURE.md](./ARCHITECTURE.md#database)

### "I need to understand the scraping pipeline"
1. Read `Oshi-scrapper/docs/DATA_FLOW.md`
2. Read `Oshi-scrapper/scripts/daily_scrape.py`
3. See [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md#scraping)

### "I need to work on user accounts/auth"
1. Read [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) - Complete system docs
2. Check `src/lib/auth/AuthContext.tsx` - Auth state management
3. Check `src/app/api/favorites/`, `src/app/api/alerts/` - API routes
4. Check `src/app/admin/` - Admin dashboard pages

### "I need to work on signup pressure/conversion"
1. Read [SIGNUP_PRESSURE.md](./SIGNUP_PRESSURE.md) - Complete system docs
2. Check `src/lib/signup/config.ts` - Thresholds and copy variants
3. Check `src/contexts/SignupPressureContext.tsx` - State management
4. Check `src/components/signup/SignupModal.tsx` - Modal UI
5. Run `npm test tests/signup` - 200 unit tests
6. Run `npx playwright test tests/e2e/signup-pressure.spec.ts` - 29 e2e tests

### "I need to add admin features"
1. Read [USER_ACCOUNTS_SYSTEM.md#admin-dashboard](./USER_ACCOUNTS_SYSTEM.md#admin-dashboard)
2. Check `src/app/admin/` - Existing admin pages
3. Check `src/app/api/admin/` - Admin API routes
4. Verify admin role check in middleware

### "I need to work on mobile UX"
1. Read [MOBILE_UX.md](./MOBILE_UX.md) - Mobile interaction patterns
2. Check `src/components/listing/QuickViewMobileSheet.tsx` - Bottom sheet implementation
3. Check `tests/quickview-regression.spec.ts` - Mobile test patterns
4. Use viewport `{ width: 390, height: 844 }` for testing

### "I need to work on QuickView metadata or translation"
1. Read [QUICKVIEW_METADATA.md](./QUICKVIEW_METADATA.md) - Complete system docs
2. Check `src/components/listing/MetadataGrid.tsx` - Type-aware metadata display
3. Check `src/components/listing/TranslatedDescription.tsx` - Translation UI
4. Check `src/app/api/translate/route.ts` - OpenRouter translation API
5. Run `npx playwright test tests/translation-api.spec.ts` - Translation tests

### "I need to work on user behavior tracking or recommendations"
1. Read [USER_BEHAVIOR_TRACKING.md](./USER_BEHAVIOR_TRACKING.md) - Complete tracking docs
2. Check `src/lib/tracking/ActivityTracker.tsx` - Main tracking provider
3. Check `src/lib/activity/types.ts` - Event type definitions
4. Check `src/app/api/activity/` - API routes
5. Check `src/app/admin/analytics/` - Analytics dashboard

### "I need to work on dealer inquiry emails"
1. Read [INQUIRY_EMAIL_SYSTEM.md](./INQUIRY_EMAIL_SYSTEM.md) - Complete system docs
2. Check `src/lib/inquiry/` - Prompts, validation, seasonal greetings
3. Check `src/app/api/inquiry/generate/route.ts` - API endpoint
4. Check `src/components/inquiry/` - Modal and form components
5. Test locally with `node scripts/test-inquiry-api.mjs`
6. Run `npm test -- tests/api/inquiry` - 28 unit tests
7. See [DEALER_CONTACT_RESEARCH.md](./DEALER_CONTACT_RESEARCH.md) for dealer data spec

### "I need to work on email alerts"
1. Read [EMAIL_ALERTS.md](./EMAIL_ALERTS.md) - Complete email system docs
2. Check `src/app/api/cron/` - Cron job endpoints
3. Check `src/lib/email/` - SendGrid integration and templates
4. Test with `POST /api/test/send-email` endpoint
5. Monitor at https://app.sendgrid.com/email_activity

### "I need to work on Yuhinkai enrichment"
1. Read [YUHINKAI_ENRICHMENT.md](./YUHINKAI_ENRICHMENT.md) - Feature overview
2. Check `src/hooks/useListingEnrichment.ts` - On-demand enrichment fetching
3. Check `src/components/listing/YuhinkaiEnrichmentSection.tsx` - Display component
4. Check `Oshi-scrapper/setsumei/enrichment/` - Backend enrichment logic
5. Check `Oshi-scrapper/run_sword_backfill.py` - Sword enrichment pipeline
6. **Critical**: Always include `translation_md` when fetching catalog_records!

### "I need to run or write tests"
1. Read [TESTING.md](./TESTING.md) - Complete testing documentation
2. Run `npm test` - All tests
3. Run `npm test -- browse-concordance` - Production API concordance tests
4. Run `npm test -- browse` - Browse API unit tests
5. Run `npx playwright test` - E2E tests
6. Check `.github/workflows/test.yml` - CI configuration

### "I need to work on subscription/Pro tiers"
1. **Start here:** Read [SUBSCRIPTION_HANDOFF.md](./SUBSCRIPTION_HANDOFF.md) - Current status & next steps
2. Read [PRO_TIER_STRATEGY.md](./PRO_TIER_STRATEGY.md) - Business strategy and tier features
3. Read [PRO_TIER_IMPLEMENTATION.md](./PRO_TIER_IMPLEMENTATION.md) - Full implementation checklist
4. Read [PHASE_1_BREAKDOWN.md](./PHASE_1_BREAKDOWN.md) - Detailed task breakdown
5. Check `src/types/subscription.ts` - Type definitions and feature access
6. Check `src/contexts/SubscriptionContext.tsx` - Subscription state management
7. Check `src/lib/stripe/` - Stripe integration (server + client)
8. Check `src/app/api/subscription/` - API routes (checkout, webhook, portal)

### "I need to work on SEO"
1. Read [SEO.md](./SEO.md) - Complete SEO documentation
2. Check `src/app/robots.ts` - robots.txt generation
3. Check `src/app/sitemap.ts` - Dynamic sitemap
4. Check `src/lib/seo/jsonLd.ts` - JSON-LD schema generators
5. Validate at https://search.google.com/test/rich-results
6. Monitor at Google Search Console

---

## Architecture Diagrams

See [ARCHITECTURE.md](./ARCHITECTURE.md) for:
- System overview diagram
- Data flow diagram
- Database schema diagram
- Deployment architecture

---

## Development Guides

| Task | Where to Look |
|------|---------------|
| Local development | [CLAUDE.md](../CLAUDE.md#development-workflow) |
| Database setup | [ARCHITECTURE.md](./ARCHITECTURE.md#database) |
| Adding dealers | [CROSS_REPO_REFERENCE.md](./CROSS_REPO_REFERENCE.md#adding-dealers) |
| Dealer quirks & fixes | [DEALERS.md](./DEALERS.md) |
| User accounts & auth | [USER_ACCOUNTS_SYSTEM.md](./USER_ACCOUNTS_SYSTEM.md) |
| Admin dashboard | [USER_ACCOUNTS_SYSTEM.md#admin-dashboard](./USER_ACCOUNTS_SYSTEM.md#admin-dashboard) |
| Signup pressure & conversion | [SIGNUP_PRESSURE.md](./SIGNUP_PRESSURE.md) |
| Mobile UX & gestures | [MOBILE_UX.md](./MOBILE_UX.md) |
| QuickView metadata & translation | [QUICKVIEW_METADATA.md](./QUICKVIEW_METADATA.md) |
| Search features | [SEARCH_FEATURES.md](./SEARCH_FEATURES.md) |
| Email alerts | [EMAIL_ALERTS.md](./EMAIL_ALERTS.md) - Saved search, price drop, back-in-stock |
| Testing | [TESTING.md](./TESTING.md) - Unit, concordance, integration tests |
| SEO & Structured Data | [SEO.md](./SEO.md) - sitemap, robots.txt, JSON-LD schemas |
| Deployment | [CLAUDE.md](../CLAUDE.md#deployment) |
