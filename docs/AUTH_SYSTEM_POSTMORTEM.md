# Auth System Post-Mortem: Admin Access & Profile Fetch Issues

**Date:** January 17, 2026
**Duration:** ~4 hours of debugging and fixes
**Severity:** Critical - Admin users could not access admin pages
**Status:** Resolved

---

## Executive Summary

Admin users were unable to access `/admin` pages, experiencing infinite "Verifying access" spinners or immediate redirects to home. The root cause was a combination of:
1. RLS policy recursion causing 500 errors
2. Race conditions between auth events
3. Profile fetch timeouts due to premature cookie access
4. Singleton browser client preserving stale state

---

## Timeline of Issues

### Issue 1: RLS Policy Recursion (500 Errors)
**Symptom:** Profile fetch returned HTTP 500
**Root Cause:** The `profiles_select_admin` RLS policy queried the `profiles` table to check admin status, creating infinite recursion.

```sql
-- BROKEN: This policy queries profiles within a profiles policy
CREATE POLICY profiles_select_admin ON profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles  -- Triggers same RLS check = infinite loop
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

**Fix:** Use the `is_admin()` SECURITY DEFINER function which bypasses RLS:
```sql
CREATE POLICY profiles_select_admin ON profiles
    FOR SELECT
    USING (is_admin());  -- Function bypasses RLS
```

### Issue 2: Singleton Browser Client
**Symptom:** Auth state became stale, requests hung indefinitely
**Root Cause:** Browser Supabase client was created once at module load and reused.

```typescript
// BROKEN: Singleton can get into bad state
const supabase = createBrowserClient<Database>(url, key);
export function createClient() {
  return supabase;  // Same instance every time
}
```

**Fix:** Create fresh client per call (stored in ref within component):
```typescript
export function createClient() {
  return createBrowserClient<Database>(url, key);  // Fresh each time
}

// In AuthProvider:
const supabaseRef = useRef<SupabaseClient | null>(null);
if (!supabaseRef.current) {
  supabaseRef.current = createClient();
}
```

### Issue 3: Race Condition Between initAuth and onAuthStateChange
**Symptom:** Double profile fetches, inconsistent state
**Root Cause:** Both `initAuth()` and `onAuthStateChange` fired simultaneously, both trying to fetch profile and set state.

```typescript
// BROKEN: Both paths execute concurrently
useEffect(() => {
  initAuth();  // Starts async

  supabase.auth.onAuthStateChange((event, session) => {
    // Also fires, races with initAuth
    fetchProfile(session.user.id);
  });
}, []);
```

**Fix:** Use `hasInitializedRef` to prevent duplicate processing:
```typescript
const hasInitializedRef = useRef(false);

// In initAuth:
if (hasInitializedRef.current) return;
// ... do work ...
hasInitializedRef.current = true;

// In onAuthStateChange:
if (hasInitializedRef.current) return;
```

### Issue 4: SIGNED_IN Before Cookies Ready
**Symptom:** Profile fetch timed out (10s), then `isAdmin: false`, then redirect
**Root Cause:** `SIGNED_IN` event fires immediately after OTP verification, before cookies are established. `INITIAL_SESSION` fires later when cookies are ready.

```
Timeline (BROKEN):
1. SIGNED_IN fires → fetch profile → timeout (cookies not ready)
2. Set isAdmin: false → redirect away
3. INITIAL_SESSION fires → fetch succeeds → too late
```

**Fix:** Defer SIGNED_IN processing until INITIAL_SESSION has fired:
```typescript
const hasReceivedInitialSessionRef = useRef(false);

// In onAuthStateChange:
if (event === 'INITIAL_SESSION') {
  hasReceivedInitialSessionRef.current = true;
  // Process normally
}

if (event === 'SIGNED_IN') {
  if (!hasReceivedInitialSessionRef.current) {
    console.log('Deferring to INITIAL_SESSION');
    return;  // Let INITIAL_SESSION handle it
  }
}
```

### Issue 5: No Timeout Protection
**Symptom:** Profile fetch hung forever, infinite spinner
**Root Cause:** Supabase queries have no default timeout, can hang indefinitely.

**Fix:** Add timeout using Promise.race:
```typescript
const timeoutPromise = new Promise((resolve) => {
  setTimeout(() => {
    resolve({ data: null, error: { message: 'Timeout' } });
  }, 10000);
});

const result = await Promise.race([fetchPromise, timeoutPromise]);
```

### Issue 6: useEffect Dependency Loop
**Symptom:** Auth reinitializing repeatedly
**Root Cause:** `fetchProfile` in useEffect dependencies caused re-runs.

**Fix:** Empty dependency array with eslint-disable:
```typescript
useEffect(() => {
  // ... auth logic ...
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);  // Only run once on mount
```

---

## Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AuthProvider                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────┐   │
│  │  supabaseRef    │    │  hasInitializedRef          │   │
│  │  (stable client)│    │  hasReceivedInitialSession  │   │
│  └────────┬────────┘    └──────────────┬──────────────┘   │
│           │                            │                   │
│           ▼                            ▼                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              onAuthStateChange                       │  │
│  │                                                      │  │
│  │  INITIAL_SESSION ─────► hasReceivedInitialSession   │  │
│  │        │                 = true                      │  │
│  │        ▼                                             │  │
│  │  fetchProfile() ────► setState() ───► hasInit=true  │  │
│  │                                                      │  │
│  │  SIGNED_IN ────► if (!hasReceivedInitialSession)    │  │
│  │                       return; // defer               │  │
│  │                                                      │  │
│  │  SIGNED_OUT ───► clearState()                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              initAuth() (fallback)                   │  │
│  │  - Only runs if onAuthStateChange didn't fire       │  │
│  │  - Checks hasInitializedRef before proceeding       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/migrations/016_fix_rls_recursion.sql` | Fixed admin RLS policies to use `is_admin()` function |
| `src/lib/supabase/client.ts` | Removed singleton, create fresh client per call |
| `src/lib/auth/AuthContext.tsx` | Complete rewrite with race condition fixes |
| `src/app/admin/layout.tsx` | Use shared `useAuth()` instead of separate check |
| `src/components/layout/Header.tsx` | Show skeleton when profile cached but user loading |

---

## Test Coverage Added

| Script | Purpose |
|--------|---------|
| `scripts/setup-test-admin.ts` | Creates test admin with email/password auth |
| `scripts/test-auth-flow.ts` | Tests basic auth flow (8 tests) |
| `scripts/test-admin-functions.ts` | Tests all admin capabilities (20 tests) |

---

## Lessons Learned & Teachings

### 1. Supabase Auth Event Ordering is Non-Deterministic
**Teaching:** Never assume `SIGNED_IN` means cookies/session are ready. `INITIAL_SESSION` is the authoritative event for "auth is fully loaded."

**Pattern:**
```typescript
// Track INITIAL_SESSION before processing other events
if (event === 'INITIAL_SESSION') {
  hasReceivedInitialSession = true;
  // This is safe to process
}

if (event === 'SIGNED_IN' && !hasReceivedInitialSession) {
  // Cookies might not be ready, defer
  return;
}
```

### 2. RLS Policies Must Not Self-Reference
**Teaching:** Never query the same table within its own RLS policy. Use SECURITY DEFINER functions to check permissions.

**Anti-pattern:**
```sql
-- NEVER DO THIS
CREATE POLICY foo ON users FOR SELECT
USING (EXISTS (SELECT 1 FROM users WHERE ...));
```

**Correct pattern:**
```sql
-- Use SECURITY DEFINER function
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY foo ON users FOR SELECT USING (is_admin());
```

### 3. Singleton Clients Are Dangerous in React
**Teaching:** Browser clients that maintain state (auth, connections) should not be singletons. React's re-rendering and strict mode can cause issues.

**Pattern:**
```typescript
// Store in ref for stability within component lifecycle
const clientRef = useRef<Client | null>(null);
if (!clientRef.current) {
  clientRef.current = createClient();
}
```

### 4. Always Add Timeouts to External Calls
**Teaching:** Any network request can hang forever. Always add timeout protection.

**Pattern:**
```typescript
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeout]);
};
```

### 5. Race Conditions Require Explicit Coordination
**Teaching:** When multiple async operations can modify the same state, use refs to coordinate.

**Pattern:**
```typescript
const hasProcessedRef = useRef(false);

async function handler1() {
  if (hasProcessedRef.current) return;
  // ... do work ...
  hasProcessedRef.current = true;
}

async function handler2() {
  if (hasProcessedRef.current) return;
  // ... do work ...
  hasProcessedRef.current = true;
}
```

### 6. Console Logging is Essential for Auth Debugging
**Teaching:** Auth flows are complex and timing-dependent. Comprehensive logging at each step is essential.

**Pattern:**
```typescript
console.log('[Auth] Event:', event);
console.log('[Auth] State before:', { isLoading, hasUser, isAdmin });
// ... operation ...
console.log('[Auth] State after:', { isLoading, hasUser, isAdmin });
```

### 7. Test Backend and Frontend Separately
**Teaching:** Backend tests passing doesn't mean frontend works. Browser environment has different constraints (cookies, CORS, timing).

**Pattern:**
- Create programmatic tests for backend (Node.js scripts)
- Create separate E2E tests for frontend
- Test auth with real browser sessions

### 8. @supabase/ssr Version Matters
**Teaching:** Newer versions of `@supabase/ssr` have different cookie handling. v0.8.0 requires explicit cookie configuration.

**Consideration:** If experiencing cookie issues, check if downgrading to v0.5.2 helps, or add explicit cookie handlers.

---

## Preventive Measures

1. **Add auth integration tests to CI** - Run `test-auth-flow.ts` on every deploy
2. **Monitor profile fetch latency** - Alert if > 5 seconds
3. **Add health check endpoint** - `/api/health` that tests auth flow
4. **Document auth event ordering** - In CLAUDE.md for future reference
5. **Create runbook** - Steps to debug auth issues

---

## Conclusion

This incident revealed multiple layers of issues in the auth system, each masking or compounding the others. The key insight is that Supabase auth in the browser is fundamentally different from server-side auth due to cookie timing and event ordering. The fixes implemented create a robust auth system that:

1. Handles all event orderings gracefully
2. Times out gracefully instead of hanging
3. Prevents race conditions with explicit coordination
4. Provides comprehensive logging for debugging

The automated test suite (`test-auth-flow.ts` and `test-admin-functions.ts`) ensures these issues won't regress.
