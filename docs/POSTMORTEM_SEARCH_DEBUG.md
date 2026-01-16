# Post-Mortem: Search Input Debugging Session

**Date:** January 17, 2026
**Duration:** ~45 minutes of debugging
**Resolution:** Simplified from React-controlled input to basic HTML form

---

## The Problem

The search input in the header appeared functional but wouldn't navigate to search results when users typed and pressed Enter. The URL would show `/?q=` with an empty query parameter despite visible text in the input field.

---

## Root Cause

**React controlled input state was not syncing with the actual DOM input value.**

The input was configured as a controlled component:
```tsx
<input
  value={query}           // React state
  onChange={(e) => setQuery(e.target.value)}  // State updater
/>
```

When the form submitted, it read from `query` state, which remained empty (`""`), even though the user could see their typed text in the input field.

---

## Why Debugging Took So Long

### 1. Over-engineered Initial Implementation

The search had multiple layers of complexity:
- `useSearch` custom hook with debouncing
- `SearchSuggestions` dropdown component
- Keyboard navigation (arrow keys, escape, enter)
- `highlightedIndex` state for dropdown selection
- Multiple `useEffect` hooks for state synchronization
- ARIA attributes for accessibility

**Lesson:** Start simple. Add complexity only when needed.

### 2. Assumed the Problem Was in the Wrong Place

Initial debugging focused on:
- The `showSuggestions` state logic
- The `useEffect` dependencies
- The suggestion dropdown behavior

The actual problem was much simpler: `onChange` wasn't firing.

**Lesson:** Verify basic assumptions first. Before debugging complex state logic, confirm the input event is actually firing.

### 3. Added Debug Logging Too Late

We should have added `console.log('[onChange]', e.target.value)` in the first debugging attempt, not after multiple iterations.

**Lesson:** Add logging at the source immediately. Don't debug downstream effects before confirming upstream events are firing.

### 4. Multiple State Sources of Truth

The code had both:
- React state (`query` from `useSearch` hook)
- DOM value (what's actually in the input)

These diverged silently with no error.

**Lesson:** Controlled inputs require bulletproof onChange handling. If onChange fails silently, the input appears to work but state doesn't update.

### 5. Remote Debugging Limitations

Debugging through commit-deploy-test cycles is slow:
- Each hypothesis required a git commit, push, Vercel deploy, hard refresh
- ~2-3 minutes per iteration
- No ability to set breakpoints or inspect state directly

**Lesson:** For UI debugging, local development with hot reload is essential. Remote debugging should be a last resort.

---

## The Fix

Replaced the entire implementation with a basic HTML form:

```tsx
const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  const searchQuery = (formData.get('q') as string) || '';
  if (searchQuery.trim()) {
    window.location.href = `/?q=${encodeURIComponent(searchQuery.trim())}`;
  }
};

<form onSubmit={handleSearch}>
  <input type="text" name="q" defaultValue={currentQuery} />
</form>
```

Key changes:
1. **Uncontrolled input** - Uses `defaultValue` instead of `value`, letting the DOM own the state
2. **FormData on submit** - Reads value directly from the form, not from React state
3. **No custom hooks** - Removed `useSearch`, `useCallback`, multiple `useEffect`
4. **No dropdown** - Removed suggestion dropdown, keyboard navigation, ARIA attributes

---

## What We Removed

| Component/Feature | Lines of Code | Purpose |
|-------------------|---------------|---------|
| `useSearch` hook usage | ~5 | Debounced search with suggestions |
| `showSuggestions` state | ~15 | Control dropdown visibility |
| `highlightedIndex` state | ~30 | Keyboard navigation |
| `SearchSuggestions` component | ~20 | Dropdown rendering |
| Multiple `useEffect` hooks | ~20 | State synchronization |
| Keyboard handlers | ~25 | Arrow/Enter/Escape handling |
| ARIA attributes | ~10 | Accessibility for dropdown |

**Total removed: ~125 lines**

**Final implementation: ~15 lines**

---

## Lessons for Future Development

1. **Start with the simplest possible implementation.** A basic form that navigates on submit. Only add autocomplete/suggestions after the basic flow works.

2. **Verify events fire before debugging state.** Add `console.log` in event handlers as the first debugging step.

3. **Prefer uncontrolled inputs for forms.** Unless you need real-time validation or character-by-character features, let the DOM manage input state and read via FormData on submit.

4. **Avoid premature abstraction.** Custom hooks like `useSearch` add indirection. The bug was hidden inside layers of abstraction.

5. **Debug locally first.** Remote debugging through deploy cycles is 10x slower than local hot reload with browser DevTools.

6. **When stuck, simplify radically.** Delete the complex implementation and rebuild from scratch with the minimum viable approach.

---

## Timeline

| Step | Action | Result |
|------|--------|--------|
| 1 | Fixed `showSuggestions` state logic | No change |
| 2 | Reordered variable declarations | No change |
| 3 | Added state debug logging | Showed `query: ""` |
| 4 | Added `onChange` debug logging | No `[onChange]` logs appeared |
| 5 | Added `name="q"` and FormData fallback | Still empty |
| 6 | Removed controlled input, used uncontrolled | **Working** |
| 7 | Removed all suggestion/dropdown code | Clean implementation |

---

## Status

- Search now works correctly
- Query persists in input after submission (via `useSearchParams`)
- Suggestions/autocomplete removed (can be re-added later with proper testing)
