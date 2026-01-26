# New Since Last Visit - GDPR Consent Analysis

**Date:** 2026-01-26
**Status:** 🚨 **PRIVACY GAP IDENTIFIED**
**Severity:** Medium (Functional feature running without user consent)

---

## Executive Summary

The "New since last visit" feature currently **bypasses GDPR consent checks** and continues to track user visits even when users explicitly decline functional cookies. This is a **compliance gap** that should be addressed before launch.

### The Issue

- ✅ **What works:** Feature tracks visits, shows counts, stores data in database
- ❌ **What's wrong:** No consent checks - runs even when users click "Decline" on cookie banner
- ⚠️ **Risk:** GDPR non-compliance for personalization/tracking feature

---

## How It Currently Works

### Data Flow

```
User visits browse page
       ↓
NewSinceLastVisitContext fetches data
       ↓
API call: GET /api/user/new-items-count
       ↓
Database: SELECT last_visit_at FROM profiles
       ↓
Display banner with count
       ↓
After 2s on page: POST /api/user/update-last-visit
       ↓
Database: UPDATE profiles SET last_visit_at = NOW()
```

### Storage Locations

| Data | Location | Consent Required? | Currently Checked? |
|------|----------|-------------------|-------------------|
| `last_visit_at` timestamp | Database (profiles table) | Yes (functional) | ❌ No |
| Banner dismissal state | sessionStorage (ephemeral) | No (session-only) | N/A |
| New items count | Calculated server-side | Yes (functional) | ❌ No |

---

## Consent System Architecture

### Consent Categories

Our consent system has 4 categories:

| Category | Always Allowed? | Default if No Choice | Example Features |
|----------|----------------|---------------------|------------------|
| **essential** | ✅ Yes | true | Auth, security, consent preferences |
| **functional** | No | **false** | Theme, currency, recently viewed, **visit tracking** |
| **analytics** | No | **true** (opt-out) | Activity tracking, visitor ID, dwell time |
| **marketing** | No | false | Ads, retargeting (future) |

### Key Insight: Defaults Matter

- `hasAnalyticsConsent()` returns `true` by default (opt-out model)
- `hasFunctionalConsent()` returns `false` by default (opt-in model)
- **"New since last visit" is functional** → Should require opt-in consent

---

## What Happens When Users Click "Decline"

When users click "Decline all non-essential cookies" on the GDPR banner:

```javascript
// This preference is stored:
{
  essential: true,
  functional: false,  // ← User said NO
  analytics: false,
  marketing: false
}
```

**Expected behavior:**
- ❌ No currency preference storage
- ❌ No theme preference storage
- ❌ No visit tracking
- ❌ No "new since last visit" feature

**Actual behavior (BUG):**
- ✅ Visit tracking continues
- ✅ "New since last visit" feature works normally
- ❌ We're tracking users who explicitly declined

---

## Current Code - The Gap

### NewSinceLastVisitContext.tsx

```typescript
// Line 82: fetchCount function
const fetchCount = useCallback(async () => {
  if (!user) {
    // Returns early for logged-out users
    setState(prev => ({ ...prev, count: null, isLoading: false }));
    return;
  }

  // ⚠️ NO CONSENT CHECK HERE
  // Should check: if (!hasFunctionalConsent()) return;

  const res = await fetch('/api/user/new-items-count');
  // ... processes data without consent check
}, [user]);
```

```typescript
// Line 142: recordVisit function
const recordVisit = useCallback(async () => {
  if (!user) return;

  // ⚠️ NO CONSENT CHECK HERE
  // Should check: if (!hasFunctionalConsent()) return;

  await fetch('/api/user/update-last-visit', { method: 'POST' });
  await fetchCount();
}, [user, fetchCount]);
```

### Comparison: ActivityTracker (Correct Implementation)

```typescript
// lib/tracking/ActivityTracker.tsx - Line 80
export function hasOptedOutOfTracking(): boolean {
  // Check legacy opt-out
  const legacyOptOut = localStorage.getItem(PRIVACY_OPT_OUT_KEY) === 'true';
  if (legacyOptOut) return true;

  // ✅ Correctly checks consent
  if (!hasAnalyticsConsent()) return true;

  return false;
}
```

---

## Privacy Policy Implications

### From src/lib/consent/types.ts

```typescript
functional: {
  id: 'functional',
  name: 'Functional',
  description: 'Enable personalized features and remember your preferences.',
  required: false,
  examples: [
    'Theme preference (light/dark mode)',
    'Currency preference (JPY/USD/EUR)',
    'Recently viewed items',  // ← Similar to "new since last visit"
  ],
}
```

**"New since last visit" should be listed under functional examples!**

Currently, our cookie banner says:
> "Cookies help us remember your currency preference, save your searches..."

But doesn't mention visit tracking!

---

## Recommended Solution

### Option 1: Gate Behind Functional Consent (RECOMMENDED)

**Pros:**
- ✅ Fully GDPR compliant
- ✅ Respects user choice
- ✅ Users who want personalization can opt in

**Cons:**
- ❌ Feature won't work for users who decline (but that's their choice!)
- ❌ Reduced feature adoption initially

**Implementation:**

```typescript
// NewSinceLastVisitContext.tsx
import { hasFunctionalConsent } from '@/lib/consent';

const fetchCount = useCallback(async () => {
  // Early return if not logged in or no consent
  if (!user || !hasFunctionalConsent()) {
    setState(prev => ({
      ...prev,
      count: null,
      daysSince: null,
      isFirstVisit: false,
      isLoading: false,
      lastVisitAt: null,
    }));
    return;
  }

  // Proceed with tracking...
}, [user]);

const recordVisit = useCallback(async () => {
  if (!user || !hasFunctionalConsent()) return;

  // Proceed with recording visit...
}, [user]);
```

### Option 2: Move to Essential Category (NOT RECOMMENDED)

Classify visit tracking as "essential" for personalization features.

**Pros:**
- ✅ Feature works for everyone
- ✅ No degraded UX

**Cons:**
- ❌ **Legally questionable** - visit tracking is NOT essential
- ❌ Violates GDPR spirit (personalization isn't essential)
- ❌ Could expose us to regulatory action

### Option 3: Show Consent Upsell in Banner (HYBRID)

When users haven't consented to functional, show a modified teaser:

```
┌────────────────────────────────────────────────────────────┐
│ ✨ Enable personalization to track new items  [Enable] [✕] │
└────────────────────────────────────────────────────────────┘
```

**Pros:**
- ✅ Fully compliant
- ✅ Educates users on value of consent
- ✅ Drives consent opt-in

**Cons:**
- ❌ More complex implementation
- ❌ Additional banner (UI clutter)

---

## Banner Copy Updates Needed

### Current Cookie Banner Text

```
Cookies help us remember your currency preference, save your searches,
and show you relevant pieces from our 27 dealers.
```

### Recommended Update

```
Cookies help us remember your currency preference, save your searches,
track new items since your last visit, and show you relevant pieces
from our 27 dealers.
```

### Functional Consent Description Update

```typescript
// src/lib/consent/types.ts
functional: {
  examples: [
    'Theme preference (light/dark mode)',
    'Currency preference (JPY/USD/EUR)',
    'Recently viewed items',
    'New items since last visit tracking',  // ← ADD THIS
  ],
}
```

---

## Testing Checklist

After implementing consent checks:

### Scenario 1: User Accepts All Cookies
- [ ] Banner shows "X new items since your last visit"
- [ ] Click "View new items" → filters to recent
- [ ] `last_visit_at` updates in database
- [ ] Count is accurate on next visit

### Scenario 2: User Declines Non-Essential
- [ ] Banner shows logged-out teaser OR nothing
- [ ] No API calls to `/api/user/new-items-count`
- [ ] No API calls to `/api/user/update-last-visit`
- [ ] `last_visit_at` does NOT update in database

### Scenario 3: User Changes Mind
- [ ] User initially declines → no banner
- [ ] User opens consent preferences → enables functional
- [ ] Banner appears immediately
- [ ] Visit tracking resumes

### Scenario 4: No Consent Choice Yet
- [ ] hasFunctionalConsent() returns `false` (opt-in default)
- [ ] Banner shows teaser (not personalized count)
- [ ] After user accepts → banner shows count

---

## Migration Strategy

### Phase 1: Add Consent Checks (No DB Changes)
1. Add `hasFunctionalConsent()` checks to NewSinceLastVisitContext
2. Update cookie banner copy
3. Update functional consent examples
4. Deploy to production

### Phase 2: Monitor Adoption
1. Track what % of users enable functional consent
2. A/B test different consent prompts
3. Measure feature engagement

### Phase 3: Optimize (Optional)
1. If functional consent is too low, add in-banner upsell
2. Show value proposition: "Enable to see X new items!"

---

## Legal/Privacy Notes

### GDPR Article 7 Requirements

> Consent must be freely given, specific, informed, and unambiguous.

✅ **Freely given:** Users can decline
✅ **Specific:** We categorize by purpose (functional vs analytics)
⚠️ **Informed:** Need to update banner text to mention visit tracking
❌ **Unambiguous:** Currently NOT unambiguous - feature runs without consent!

### ePrivacy Directive (Cookie Law)

> Non-essential cookies require prior informed consent.

- Visit tracking = personalization = non-essential
- Must obtain consent BEFORE tracking
- Currently failing this requirement

---

## Recommendation

**Implement Option 1 (Gate Behind Functional Consent) immediately.**

**Rationale:**
1. It's the legally correct approach
2. Implementation is straightforward (~20 lines of code)
3. Demonstrates respect for user privacy
4. Aligns with our existing consent architecture
5. Low risk of regulatory action

**Timeline:**
- **Urgent:** Should be fixed before public launch
- **Effort:** ~1 hour implementation + testing
- **Risk:** Low (graceful degradation for users who decline)

---

## Questions for Product Team

1. **Is this feature essential for launch?** If yes, we need consent checks immediately.
2. **What % consent rate do we expect?** (Functional is opt-in, so lower than analytics)
3. **Should we add a consent upsell banner?** To drive functional consent adoption
4. **Privacy policy update:** Do we mention visit tracking currently?

---

## Implementation PR Checklist

When implementing the fix:

- [ ] Add `hasFunctionalConsent()` checks to `fetchCount()`
- [ ] Add `hasFunctionalConsent()` checks to `recordVisit()`
- [ ] Update cookie banner copy (mention visit tracking)
- [ ] Update functional consent examples in types.ts
- [ ] Add tests for consent gating
- [ ] Update docs/NEW_SINCE_LAST_VISIT.md with consent info
- [ ] Privacy policy review (if applicable)
- [ ] QA: Test both accept/decline scenarios
- [ ] Deploy to staging first
- [ ] Monitor error rates and consent adoption

---

## References

- [GDPR Article 7 - Conditions for consent](https://gdpr-info.eu/art-7-gdpr/)
- [ePrivacy Directive](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:32002L0058)
- Our implementation:
  - `src/contexts/NewSinceLastVisitContext.tsx`
  - `src/lib/consent/helpers.ts`
  - `src/lib/consent/types.ts`
  - `docs/NEW_SINCE_LAST_VISIT.md`
