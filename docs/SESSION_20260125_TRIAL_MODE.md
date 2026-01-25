# Session: Trial Mode & Business Model Pivot

**Date:** 2026-01-25

## Summary

Implemented trial mode to make all premium features free, supporting a business model pivot from collector-paid subscriptions to a hybrid model (free collectors, paid dealers).

## Business Context

### Market Analysis

- Nihonto Message Board has ~8,400 registered members (larger than initially estimated 200)
- ~1,500-2,000 active collectors globally
- Growth matters more than conversion at this stage

### New Business Model

```
┌─────────────────────────────────────────────────────────┐
│                   COLLECTORS                            │
│                                                         │
│   FREE (all features)         OPTIONAL PREMIUM          │
│   - Real-time listings        - Future: power features  │
│   - Setsumei translations                               │
│   - AI inquiry emails                                   │
│   - Saved searches + alerts                             │
│                                                         │
│   Goal: Maximum eyeballs                                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼ traffic
┌─────────────────────────────────────────────────────────┐
│                    DEALERS                              │
│                                                         │
│   $100-300/mo for:                                      │
│   - Click/view analytics                                │
│   - Traffic reports                                     │
│   - Competitive intel                                   │
│   - Premium placement                                   │
│                                                         │
│   Goal: Monetize the eyeballs                           │
└─────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Trial Mode Toggle

```bash
# Vercel environment variables
NEXT_PUBLIC_TRIAL_MODE=true   # All features free
NEXT_PUBLIC_TRIAL_MODE=false  # Normal paywall (or remove var)
```

### Files Changed

| File | Change |
|------|--------|
| `src/types/subscription.ts` | Added `isTrialModeActive()`, `canAccessFeature()` returns true in trial |
| `src/lib/subscription/server.ts` | `isDelayed` returns false in trial, added `isAdmin` to return type |
| `src/components/subscription/DataDelayBanner.tsx` | Hidden in trial mode |
| `src/app/pricing/page.tsx` | Redirects to home in trial mode |
| `src/app/connoisseur/page.tsx` | Redirects to home in trial mode |
| `tests/subscription/trial-mode.test.ts` | 15 comprehensive tests |
| `CLAUDE.md` | Updated with business strategy |
| `docs/SUBSCRIPTION_HANDOFF.md` | Updated with trial mode docs |

### What Trial Mode Does

| Component | Behavior |
|-----------|----------|
| `canAccessFeature()` | Returns `true` for all features |
| `isDelayed` | Returns `false` (no 72h data delay) |
| `DataDelayBanner` | Hidden |
| `/pricing` page | Redirects to `/` |
| `/connoisseur` page | Redirects to `/` |
| Paywall modals | Never shown (all features accessible) |

## Commits

1. `0b4a549` - feat: Add trial mode for free access to all features
2. `4608f41` - feat: Hide pricing and connoisseur pages during trial mode

## To Restore Paywall

When ready to monetize:

1. Go to Vercel → Settings → Environment Variables
2. Delete `NEXT_PUBLIC_TRIAL_MODE` or set to `false`
3. Redeploy

Paywall returns instantly. Justification: "Costs are increasing"

## Dealer Analytics (Ready for B2B)

Infrastructure already built:

- Click-through tracking per dealer
- Unique visitor counts
- Dwell time tracking
- Conversion tracking (click → sold)
- Admin dashboard at `/admin/dealers`
- PDF export for dealer reports

**Gap:** Dealer self-serve portal (dealers can't log in yet)

## Next Steps

1. Validate dealer demand - email sample reports to 5 dealers
2. If 2+ dealers interested - build dealer auth/dashboard
3. Monitor trial adoption metrics
4. Decide on trial end date and paywall restoration

## Test Coverage

All 49 subscription tests pass, including 15 new trial mode tests covering:

- `isTrialModeActive()` env var detection
- `canAccessFeature()` returns true for all features in trial
- `isDelayed` returns false in trial
- Regression guards for code presence
- Toggle behavior verification
