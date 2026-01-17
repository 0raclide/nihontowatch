# Signup Pressure System

A sophisticated user engagement system that encourages registration at optimal moments when users demonstrate high intent and engagement.

## Overview

The signup pressure system monitors user behavior and presents a signup modal at the **point of maximum willingness**—when users have invested enough time and taken enough actions to indicate genuine interest, but before session fatigue sets in.

### Key Principles

1. **Value-first, gate-second** — Users experience the app's value before any signup friction
2. **Behavioral triggers** — Modal appears based on engagement patterns, not arbitrary timing
3. **Respectful persistence** — Cooldown periods and dismissal limits prevent annoyance
4. **Context-aware messaging** — Copy adapts to what triggered the modal

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SignupPressureProvider                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  State Tracking │  │  Threshold      │  │  Persistence    │ │
│  │  - Quick views  │  │  Evaluation     │  │  - localStorage │ │
│  │  - Time on site │  │  - 5 views AND  │  │  - Session mgmt │ │
│  │  - Dismissals   │  │  - 3 minutes    │  │  - Cooldowns    │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                │
│                    ┌───────────▼───────────┐                   │
│                    │    Modal Trigger      │                   │
│                    │    Engine             │                   │
│                    └───────────┬───────────┘                   │
│                                │                                │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      SignupModal        │
                    │  ┌──────────────────┐  │
                    │  │ Desktop: Centered │  │
                    │  │ Modal with blur   │  │
                    │  └──────────────────┘  │
                    │  ┌──────────────────┐  │
                    │  │ Mobile: Bottom   │  │
                    │  │ sheet with drag  │  │
                    │  └──────────────────┘  │
                    └─────────────────────────┘
```

---

## Trigger Configuration

### Engagement Thresholds (AND Logic)

| Threshold | Value | Rationale |
|-----------|-------|-----------|
| **Quick Views** | 5 | Indicates comparison shopping behavior |
| **Time on Site** | 3 minutes | Indicates invested browsing, not just landing |
| **Require Both** | Yes | Filters out fast-clickers and idle tabs |

Both thresholds must be met for the engagement trigger. This combination specifically captures the "comparison shopping" phase—when a collector is mentally building a shortlist and tracking tools become genuinely valuable.

### Cooldown & Limits

| Setting | Value | Purpose |
|---------|-------|---------|
| **Cooldown Period** | 48 hours | Respects user's dismissal choice |
| **Max Dismissals** | 3 | Stops showing after repeated dismissals |
| **Session Timeout** | 30 minutes | Resets view count for new sessions |

---

## Trigger Contexts

The modal adapts its copy based on what triggered it:

### 1. Engagement (`engagement`)
Triggered automatically when both thresholds are met.

> **"Track what matters."**
>
> Create an account to save the pieces you're watching, receive alerts when prices shift, and never lose track of a listing that caught your eye.
>
> *Social proof: "Aggregating 27 dealers worldwide"*

### 2. Favorite (`favorite`)
Triggered when user attempts to favorite a listing.

> **"Keep this one close."**
>
> Create an account to save this piece to your collection. You'll be notified if the price changes or if it sells.
>
> *Social proof: "Price alerts delivered within minutes"*

### 3. Alert (`alert`)
Triggered when user attempts to set up price/listing alerts.

> **"Never miss the moment."**
>
> Price drops and new listings move fast. Create an account to receive instant alerts tailored to your criteria.
>
> *Social proof: "Alerts delivered within minutes of changes"*

### 4. Price History (`priceHistory`)
Triggered when user attempts to view price history.

> **"See the full picture."**
>
> Understanding price history helps you make informed decisions. Create an account to access historical data and market trends.
>
> *Social proof: "Price data across 27 dealers"*

---

## File Structure

```
src/
├── lib/signup/
│   ├── types.ts          # TypeScript type definitions
│   ├── config.ts         # Thresholds, copy, constants
│   ├── storage.ts        # localStorage utilities
│   └── index.ts          # Barrel exports
│
├── contexts/
│   └── SignupPressureContext.tsx  # Provider + hooks
│
├── components/signup/
│   ├── SignupModal.tsx            # Modal component (desktop + mobile)
│   ├── SignupPressureWrapper.tsx  # Auth-connected wrapper
│   └── index.ts                   # Barrel exports

tests/
├── signup/
│   ├── storage.test.ts                # Storage utility tests (80 tests)
│   ├── SignupPressureContext.test.tsx # Context provider tests (55 tests)
│   └── SignupModal.test.tsx           # Modal component tests (65 tests)
│
└── e2e/
    └── signup-pressure.spec.ts        # Playwright e2e tests (29 tests)
```

---

## Usage

### Basic Setup

The system is already integrated into the app layout. The `SignupPressureWrapper` component wraps the app and connects to `AuthContext`.

```tsx
// src/app/layout.tsx
<AuthProvider>
  <FavoritesProvider>
    <SignupPressureWrapper>
      {/* ... rest of app */}
    </SignupPressureWrapper>
  </FavoritesProvider>
</AuthProvider>
```

### Tracking Quick Views

Quick views are automatically tracked via the `QuickViewContext` integration:

```tsx
// In QuickViewContext.tsx
const openQuickView = useCallback((listing: Listing) => {
  // ... open logic

  // Track for signup pressure
  signupPressure?.trackQuickView();
}, [signupPressure]);
```

### Triggering for Actions

To trigger the modal for specific actions (favorites, alerts, etc.):

```tsx
import { useSignupPressure } from '@/contexts/SignupPressureContext';

function FavoriteButton({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  const { triggerForAction } = useSignupPressure();

  const handleFavorite = () => {
    if (!user) {
      // User not logged in - trigger signup modal
      triggerForAction('favorite');
      return;
    }

    // User logged in - proceed with favorite
    addFavorite(listing.id);
  };

  return <button onClick={handleFavorite}>♡ Save</button>;
}
```

### Preserving Pre-Signup State

Local favorites can be preserved before signup and migrated after:

```tsx
const { addLocalFavorite, getLocalFavorites } = useSignupPressure();

// Before signup - store locally
addLocalFavorite(listing.id);

// After signup - migrate
const localFavorites = getLocalFavorites();
await migrateLocalFavorites(localFavorites);
```

---

## API Reference

### SignupPressureProvider

Provider component that manages signup pressure state.

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isAuthenticated` | `boolean` | `false` | Whether user is logged in (disables all triggers) |

### useSignupPressure()

Hook to access signup pressure state and actions. Must be used within `SignupPressureProvider`.

**Returns: `SignupPressureContextValue`**

#### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `isModalOpen` | `boolean` | Whether signup modal is visible |
| `triggerContext` | `SignupTriggerContext \| null` | What triggered the modal |
| `quickViewCount` | `number` | Quick views in current session |
| `timeOnSite` | `number` | Seconds since session start |
| `thresholdsMet` | `boolean` | Whether engagement thresholds are met |
| `isOnCooldown` | `boolean` | Whether modal is in cooldown period |
| `isAuthenticated` | `boolean` | Whether user is logged in |

#### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `trackQuickView` | `() => void` | Increment quick view counter |
| `triggerForAction` | `(context: SignupTriggerContext) => boolean` | Attempt to trigger modal for an action |
| `dismissModal` | `() => void` | Dismiss modal (starts cooldown) |
| `closeModal` | `() => void` | Close modal without cooldown |
| `markAsSignedUp` | `() => void` | Mark user as signed up (disables future triggers) |
| `addLocalFavorite` | `(listingId: string) => void` | Add to local favorites |
| `getLocalFavorites` | `() => string[]` | Get local favorites for migration |
| `resetSession` | `() => void` | Reset all session state |

### useSignupPressureOptional()

Optional variant that returns `null` instead of throwing when used outside provider.

---

## Modal Design

### Desktop (lg+)

- Centered modal with backdrop blur
- Max width: 448px (max-w-md)
- Rounded corners (rounded-2xl)
- Close button in top-right corner
- Escape key dismisses

### Mobile (<lg)

- Bottom sheet with drag handle
- Max height: 90vh
- Rounded top corners (rounded-t-2xl)
- Swipe down to dismiss (100px threshold)
- Safe area bottom padding for notched devices

### Animation Timing

| Animation | Duration |
|-----------|----------|
| Modal enter | 250ms |
| Modal exit | 200ms |
| Backdrop fade | 200ms |

---

## Customization

### Adjusting Thresholds

Edit `src/lib/signup/config.ts`:

```typescript
export const SIGNUP_PRESSURE_CONFIG: SignupPressureConfig = {
  quickViewThreshold: 5,    // Adjust view count
  timeThreshold: 180,       // Adjust seconds
  requireBoth: true,        // Change to OR logic
  cooldownHours: 48,        // Adjust cooldown
  maxDismissals: 3,         // Adjust max dismissals
  sessionTimeoutMinutes: 30,
};
```

### Customizing Copy

Edit `SIGNUP_MODAL_COPY` in `src/lib/signup/config.ts`:

```typescript
export const SIGNUP_MODAL_COPY: SignupModalCopyVariants = {
  engagement: {
    headline: 'Your headline here',
    body: 'Your body copy here',
    cta: 'Button text',
    dismiss: 'Dismiss text',
    socialProof: 'Social proof text',
  },
  // ... other contexts
};
```

### Adding New Trigger Contexts

1. Add to `SignupTriggerContext` type in `types.ts`
2. Add copy variant in `config.ts`
3. Call `triggerForAction('newContext')` where needed

---

## Testing

### Unit Tests (Vitest)

```bash
npm test tests/signup
```

### E2E Tests (Playwright)

```bash
npx playwright test tests/e2e/signup-pressure.spec.ts
```

### Test Coverage

**Total: 229 tests**

| Area | Count | Coverage |
|------|-------|----------|
| Storage utilities | 80 | Session management, cooldown logic, threshold checks, edge cases |
| Context provider | 55 | State management, triggers, dismissal behavior, time tracking |
| Modal component | 65 | Rendering, form behavior, accessibility, responsive layout |
| E2E (Playwright) | 29 | Full user flows, threshold logic, dismissal, cooldowns, responsive |

### What's Tested

**Threshold Logic:**
- Modal appears only when BOTH thresholds met (5 views AND 3 minutes)
- Modal does NOT appear with only views or only time
- Quick view counting increments correctly

**Dismissal & Cooldown:**
- All dismissal methods (backdrop, escape, close button, "Continue browsing")
- 48-hour cooldown activates after dismissal
- Max 3 dismissals before permanently suppressed

**Responsive Design:**
- Desktop: centered modal with backdrop blur
- Mobile: bottom sheet with drag handle
- Both viewports render correctly

**Accessibility:**
- ARIA attributes (role="dialog", aria-modal="true")
- Accessible labels on all interactive elements
- Keyboard navigation (Escape to close)

---

## Monitoring & Analytics

Consider tracking these events for optimization:

| Event | Data |
|-------|------|
| `signup_modal_triggered` | `{ context, quickViewCount, timeOnSite }` |
| `signup_modal_dismissed` | `{ context, dismissCount }` |
| `signup_modal_converted` | `{ context, quickViewCount, timeOnSite }` |
| `signup_modal_cooldown_hit` | `{ dismissCount }` |

---

## Best Practices

1. **Don't gate core browsing** — Users should always be able to browse freely
2. **Gate enhanced features** — Saving, alerts, history are natural gates
3. **Show value before asking** — Let them experience the app first
4. **Clear value proposition** — Tell them exactly what they get
5. **Easy dismissal** — Always provide a clear way out
6. **Remember their choice** — Don't spam after dismissal
7. **Context-specific copy** — Match the message to the trigger

---

## Troubleshooting

### Modal not appearing

1. Check if user is authenticated (`isAuthenticated` prop)
2. Check if `hasSignedUp` is true in localStorage
3. Check if max dismissals reached
4. Check if on cooldown
5. Verify both thresholds are met (views AND time)

### Modal appearing too early/late

Adjust thresholds in `config.ts`. The current defaults (5 views, 3 minutes) are based on marketplace industry benchmarks but may need tuning for your specific audience.

### localStorage issues

The system handles corrupted/missing localStorage gracefully. To reset for testing:

```javascript
localStorage.removeItem('nihontowatch_signup_pressure');
```

---

## Future Enhancements

- [ ] A/B testing framework for threshold optimization
- [ ] Analytics integration for conversion tracking
- [ ] Additional trigger contexts (e.g., dealer contact, comparison)
- [ ] Personalized copy based on browsing behavior
- [ ] Integration with email capture for partial signups
