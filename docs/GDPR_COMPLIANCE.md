# GDPR Compliance Implementation

**Implemented:** January 25, 2026
**Status:** ✅ Complete and Deployed

## Overview

Comprehensive GDPR compliance infrastructure for Nihontowatch, implementing cookie consent, legal pages, user data rights, and tracking controls required for worldwide marketing launch.

---

## Features Implemented

### 1. Cookie Consent System

**Components:**
- `src/components/consent/CookieBanner.tsx` - Bottom-fixed consent banner
- `src/components/consent/ConsentPreferences.tsx` - Detailed preference modal
- `src/contexts/ConsentContext.tsx` - React context for consent state

**Consent Categories:**
| Category | Description | Can Disable |
|----------|-------------|-------------|
| Essential | Authentication, security | No |
| Functional | Theme, currency, preferences | Yes |
| Analytics | Activity tracking, visitor ID | Yes |
| Marketing | Future email campaigns | Yes |

**Design Principles (Non-Dark Pattern):**
- Equal visual weight for Accept/Reject buttons
- No pre-checked boxes
- Clear explanations for each category
- Easy access to change preferences later

### 2. Legal Pages

| Page | URL | Content |
|------|-----|---------|
| Terms of Service | `/terms` | 12 sections covering service use, accounts, subscriptions, liability |
| Privacy Policy | `/privacy` | GDPR-compliant with data collection, third parties, user rights |
| Cookie Policy | `/cookies` | Detailed cookie inventory and management instructions |

**Layout:** `src/app/(legal)/layout.tsx`
- Standalone header with logo
- Sub-navigation between legal pages
- Professional typography via `.legal-content` CSS class
- Responsive footer

### 3. Tracking Consent Integration

**Modified Files:**
- `src/lib/tracking/ActivityTracker.tsx` - Checks consent before any tracking
- `src/lib/activity/visitorId.ts` - Only persists visitor ID with analytics consent

**Behavior:**
- No consent given → No tracking (GDPR default)
- Analytics consent → Full tracking enabled
- Consent revoked → Tracking stops immediately
- Legacy opt-out key still respected

### 4. GDPR User Rights APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/consent` | GET | Retrieve current consent preferences |
| `/api/user/consent` | POST | Update consent preferences |
| `/api/user/consent` | DELETE | Reset consent to defaults |
| `/api/user/data-export` | GET | Download all user data (JSON) |
| `/api/user/delete-account` | GET | Get deletion requirements |
| `/api/user/delete-account` | POST | Request account deletion |

**Data Export Includes:**
- Profile information
- Consent history
- Favorites
- Saved searches
- Alerts
- Activity history (anonymized)

**Account Deletion Process:**
1. Verify identity (email confirmation)
2. Check for active subscription
3. Log deletion request
4. Cascade delete all user data
5. Anonymize activity records
6. Delete auth user

### 5. Email Unsubscribe

**Endpoint:** `/api/unsubscribe`
- RFC 8058 compliant one-click unsubscribe
- HMAC-signed tokens with expiration
- Supports: all emails, marketing only, specific saved search

**Confirmation Page:** `/unsubscribe`
- Shows success/error status
- Links back to main site

### 6. Profile Privacy Settings

**Modified:** `src/app/profile/page.tsx`

New "Privacy & Data" section with:
- Data export button
- Account deletion button (with confirmation)
- Link to cookie preferences

---

## Database Schema

**Migration:** `supabase/migrations/041_gdpr_consent.sql`

```sql
-- Consent audit trail
CREATE TABLE user_consent_history (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    visitor_id TEXT,
    preferences JSONB NOT NULL,
    version TEXT DEFAULT '1.0',
    method TEXT NOT NULL,
    ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deletion requests log
CREATE TABLE data_deletion_requests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Profile columns added
ALTER TABLE profiles ADD COLUMN consent_preferences JSONB;
ALTER TABLE profiles ADD COLUMN consent_updated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN marketing_opt_out BOOLEAN DEFAULT FALSE;
```

---

## Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/consent/consent-storage.test.ts` | 22 | Consent helpers, localStorage, edge cases |
| `tests/consent/tracking-consent.test.ts` | 10 | ActivityTracker, visitor ID consent |
| `tests/api/unsubscribe.test.ts` | 17 | Token generation, URL generation, API |
| `tests/api/user-gdpr.test.ts` | 20 | Consent API, export, deletion, legal pages |

**Total:** 69 tests

---

## File Inventory

### New Files Created
```
src/lib/consent/
├── types.ts              # Consent type definitions
├── helpers.ts            # Standalone consent check functions
└── index.ts              # Barrel export

src/components/consent/
├── CookieBanner.tsx      # Initial consent banner
├── ConsentPreferences.tsx # Preference modal
└── index.ts              # Barrel export

src/contexts/ConsentContext.tsx  # React context

src/app/(legal)/
├── layout.tsx            # Shared legal pages layout
├── terms/page.tsx        # Terms of Service
├── privacy/page.tsx      # Privacy Policy
└── cookies/page.tsx      # Cookie Policy

src/app/api/user/
├── consent/route.ts      # Consent API
├── data-export/route.ts  # Data export API
└── delete-account/route.ts # Account deletion API

src/app/api/unsubscribe/route.ts  # Email unsubscribe
src/app/unsubscribe/page.tsx      # Unsubscribe confirmation

src/components/layout/Footer.tsx  # Footer with legal links

supabase/migrations/041_gdpr_consent.sql  # Database migration
```

### Modified Files
```
src/app/layout.tsx                    # Added ConsentProvider, CookieBanner
src/app/profile/page.tsx              # Added Privacy & Data section
src/lib/tracking/ActivityTracker.tsx  # Consent checks
src/lib/activity/visitorId.ts         # Consent-aware persistence
src/lib/email/sendgrid.ts             # Unsubscribe headers
src/lib/email/templates/saved-search.ts # Unsubscribe links
src/components/layout/MobileNavDrawer.tsx # Legal links
src/app/globals.css                   # Legal content styles
```

---

## Third-Party Processors Documented

| Processor | Purpose | DPA Status |
|-----------|---------|------------|
| Supabase | Database, authentication | Standard DPA |
| SendGrid | Email delivery | Standard DPA |
| Stripe | Payment processing | Standard DPA |
| OpenRouter | AI features | Standard DPA |
| Vercel | Hosting | Standard DPA |

---

## Compliance Checklist

- [x] Cookie consent banner (non-dark pattern)
- [x] Granular consent categories
- [x] Consent audit trail
- [x] Terms of Service
- [x] Privacy Policy (GDPR Art. 13/14)
- [x] Cookie Policy
- [x] Right to Access (data export)
- [x] Right to Erasure (account deletion)
- [x] Right to Object (consent management)
- [x] One-click email unsubscribe
- [x] Tracking respects consent
- [x] No tracking without consent (GDPR default)
- [x] Server-side consent sync for authenticated users

---

## Recommendations

1. **Legal Review:** Have legal counsel review ToS and Privacy Policy before major marketing push
2. **Cookie Inventory:** Periodically audit actual cookies/storage used vs documented
3. **DPA Documentation:** Maintain file of signed DPAs with all processors
4. **Consent Version:** Update `CONSENT_VERSION` when policies change significantly
5. **Supervisory Authority:** Register with relevant EU data protection authority if required

---

## Environment Variables

No new environment variables required. Uses existing:
- `NEXT_PUBLIC_SITE_URL` - For unsubscribe URLs
- `UNSUBSCRIBE_SECRET` - For token signing (auto-generated if missing)
