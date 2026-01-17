# Postmortem: Dropdown Navigation Crash

**Date:** January 2026
**Severity:** High (core navigation broken)
**Duration:** Unknown (likely since FavoriteButton was added to listing cards)
**Impact:** All dropdown menu navigation non-functional for logged-in users

---

## Summary

Clicking any link in the user dropdown menu (Profile, Favorites, Alerts, Admin) or the Admin header dropdown caused the page to freeze and navigation to fail. The browser console showed "Maximum update depth exceeded" errors and hundreds of "Error fetching favorites: Failed to fetch" messages.

---

## Timeline

1. User clicks dropdown menu item (e.g., "Profile")
2. Link's `onClick` handler fires: `setIsOpen(false)`
3. React begins re-render cycle
4. Multiple `useFavorites` hook instances trigger fetch cascades
5. Fetches fail during state transition
6. Failed fetches trigger `setState` calls
7. State updates cause re-renders
8. Re-renders trigger more fetches
9. **Infinite loop** - React crashes with "Maximum update depth exceeded"
10. Navigation never completes

---

## Root Cause Analysis

### The Immediate Cause

The `useFavorites` hook was used by every `FavoriteButton` component on the page. With ~30 listing cards visible, there were ~30 independent instances of this hook, each with:

- Its own React state
- Its own Supabase client instance
- Its own auth state change listener
- Its own fetch logic

When React's reconciliation was triggered by closing the dropdown menu, this army of hooks created a feedback loop.

### The Deeper Problems

#### 1. Anti-Pattern: Duplicated Shared State

```tsx
// FavoriteButton.tsx - EVERY button created its own hook instance
export function FavoriteButton({ listingId }) {
  const { isFavorited, toggleFavorite } = useFavorites(); // New instance!
  // ...
}
```

**What went wrong:** Favorites data is inherently shared - whether listing #123 is favorited is the same for all buttons. But each button maintained its own copy of this state, fetched its own data, and set up its own listeners.

**The correct pattern:** Use a `FavoritesProvider` context at the app level with a single source of truth:

```tsx
// Correct approach
export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(new Set());
  // ONE fetch, ONE listener, ONE state
  return (
    <FavoritesContext.Provider value={{ favorites, ... }}>
      {children}
    </FavoritesContext.Provider>
  );
}
```

#### 2. Anti-Pattern: Creating Clients Inside Effects/Callbacks

```tsx
// useFavorites.ts - WRONG
const fetchFavorites = useCallback(async () => {
  const supabase = createClient(); // New client every call!
  const { data: { user } } = await supabase.auth.getUser();
  // ...
}, []);

useEffect(() => {
  const supabase = createClient(); // Another new client!
  supabase.auth.onAuthStateChange(...);
}, []);
```

**What went wrong:** Each call to `createClient()` potentially creates a new client instance. While `@supabase/ssr` may cache these internally, the pattern is dangerous because:
- Multiple auth listeners get registered
- State can become inconsistent between instances
- Memory leaks from untracked subscriptions

**The correct pattern:** Create client once and store in a ref:

```tsx
// Correct approach
const supabaseRef = useRef<SupabaseClient | null>(null);
if (!supabaseRef.current) {
  supabaseRef.current = createClient();
}
const supabase = supabaseRef.current;
```

#### 3. Anti-Pattern: Auth Listeners in Component Hooks

```tsx
// useFavorites.ts - WRONG: Every component instance adds a listener
useEffect(() => {
  const supabase = createClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event) => {
      if (event === 'SIGNED_IN') {
        fetchFavorites(); // 30 buttons = 30 fetches on sign-in!
      }
    }
  );
  return () => subscription.unsubscribe();
}, [fetchFavorites]);
```

**What went wrong:** With 30 FavoriteButtons:
- 30 auth listeners registered
- When SIGNED_IN fires, 30 `fetchFavorites()` calls happen simultaneously
- 30 API requests to `/api/favorites`
- 30 state updates when responses arrive
- Potential for race conditions and cascading re-renders

**The correct pattern:** Auth listeners belong in a single provider, not in component hooks:

```tsx
// AuthContext.tsx - ONE listener at app level
useEffect(() => {
  const { subscription } = supabase.auth.onAuthStateChange((event) => {
    // Handle auth changes ONCE for entire app
  });
  return () => subscription.unsubscribe();
}, []);
```

#### 4. Anti-Pattern: No Protection Against Unmounted Updates

```tsx
// useFavorites.ts - Original code had no unmount protection
const fetchFavorites = useCallback(async () => {
  try {
    const response = await fetch('/api/favorites');
    const data = await response.json();
    setState({ ... }); // What if component unmounted during fetch?
  } catch (error) {
    setState({ error: ... }); // Still tries to update!
  }
}, []);
```

**What went wrong:** When navigation starts, components begin unmounting. If a fetch was in-flight, it would complete and try to `setState` on an unmounted component. React warns about this, but more critically, it can cause unexpected behavior during transitions.

**The correct pattern:** Track mounted state:

```tsx
// Correct approach
const isMountedRef = useRef(true);

useEffect(() => {
  return () => { isMountedRef.current = false; };
}, []);

const fetchFavorites = useCallback(async () => {
  try {
    const data = await fetch(...);
    if (isMountedRef.current) {
      setState({ ... });
    }
  } catch (error) {
    if (isMountedRef.current) {
      setState({ error: ... });
    }
  }
}, []);
```

#### 5. Dangerous Pattern: Link onClick + State Updates

```tsx
// UserMenu.tsx - Risky combination
<Link
  href="/profile"
  onClick={() => setIsOpen(false)} // State update during navigation
>
  Profile
</Link>
```

**What went wrong:** Next.js `<Link>` components use client-side navigation with React's concurrent rendering. When you modify state in the `onClick`:

1. React schedules a re-render for the state change
2. Next.js router schedules navigation
3. Both happen concurrently
4. If the re-render triggers problematic effects (like our useFavorites cascade), the entire process can break

**Why it's subtle:** This pattern works fine in most cases. It only fails when the state change triggers a cascade that overwhelms React's ability to reconcile.

---

## The Fix (Temporary)

The immediate fix was to bypass React's navigation entirely:

```tsx
// UserMenu.tsx - Nuclear option
const navigateTo = useCallback((href: string) => {
  setIsOpen(false);
  window.location.href = href; // Full page reload
}, []);

<button onClick={() => navigateTo('/profile')}>
  Profile
</button>
```

**Trade-offs:**
- ✅ Works reliably
- ❌ Loses client-side navigation benefits (speed, state preservation)
- ❌ Full page reload on every navigation
- ❌ Doesn't fix the underlying architectural issues

---

## The Proper Fix (TODO)

### Phase 1: FavoritesProvider Context

Move favorites state management to a single provider:

```tsx
// contexts/FavoritesContext.tsx
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // ONE fetch function
  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }
    const response = await fetch('/api/favorites');
    const data = await response.json();
    setFavoriteIds(new Set(data.favoriteIds));
    setIsLoading(false);
  }, [user]);

  // ONE effect to fetch on user change
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // NO auth listener here - useAuth already handles auth state

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isLoading, ... }}>
      {children}
    </FavoritesContext.Provider>
  );
}
```

### Phase 2: Simplify FavoriteButton

```tsx
// components/favorites/FavoriteButton.tsx
export function FavoriteButton({ listingId }) {
  // Just consume context - no local state, no fetching, no listeners
  const { isFavorited, toggleFavorite } = useFavorites();

  return (
    <button onClick={() => toggleFavorite(listingId)}>
      {isFavorited(listingId) ? '★' : '☆'}
    </button>
  );
}
```

### Phase 3: Restore Link Navigation

Once favorites are properly managed, restore client-side navigation:

```tsx
// UserMenu.tsx
<Link href="/profile" onClick={() => setIsOpen(false)}>
  Profile
</Link>
```

---

## Lessons Learned

### 1. Shared State Needs Shared Management

If multiple components need the same data, lift it to a context provider. Don't let each component fetch and manage its own copy.

### 2. Hooks Are Not Singletons

Every component instance gets its own hook instance. A hook used by 30 components creates 30 independent state machines. Design accordingly.

### 3. Be Careful with Listeners in Hooks

Auth listeners, WebSocket connections, and other subscriptions should typically live in providers, not in hooks used by many components.

### 4. Test Navigation Flows

Our E2E tests only verified that links were visible, not that clicking them actually navigated. The new tests that click and verify URL changes caught this issue.

### 5. Watch for Concurrent React Issues

When mixing state updates with navigation (or other async operations), consider whether the state change could trigger effects that interfere with the primary action.

---

## Action Items

- [ ] Implement FavoritesProvider context
- [ ] Remove per-button state management from useFavorites
- [ ] Restore Link-based navigation in menus
- [ ] Add E2E tests for all critical navigation paths
- [ ] Audit other hooks for similar patterns (useWatchlist, etc.)
- [ ] Consider adding React DevTools Profiler to CI to catch render cascades

---

## References

- [React Docs: Lifting State Up](https://react.dev/learn/sharing-state-between-components)
- [React Docs: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [Next.js Navigation](https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating)
