# Post-Mortem: Non-Passive touchmove Kills DevTools Scroll

**Status:** Recurring regression — broken the build 4 times
**Severity:** P0 — makes the app untestable in Chrome DevTools
**Last occurrence:** 2026-02-14

## The Rule

**NEVER use `{ passive: false }` on a `touchmove` listener attached to (or above) a scrollable container.**

Not "be careful with." Not "only attach briefly." **Never.** Even a briefly-attached non-passive touchmove blocks the compositor thread from fast-pathing scroll during the window it's registered.

## Why It Breaks

Chrome DevTools mobile emulation translates two-finger trackpad scroll into synthetic `TouchEvent`s. The browser's compositor thread can only perform scroll on its own (60fps, off-main-thread) when it knows no JS will call `preventDefault()` on `touchmove`. A single `{ passive: false }` touchmove listener forces the compositor to block and wait for JS on every frame.

On real mobile devices this manifests as scroll jank. In DevTools emulation it kills scroll entirely — the emulated gesture never starts because the compositor won't commit to it while waiting for JS.

## Incident Timeline

### Hit 1: Bottom sheet drag (commit 5a1f711, fixed 6502af4)

**What happened:** `QuickViewMobileSheet` called `e.preventDefault()` in `handleTouchMove` on every touch to prevent scroll interference during sheet drag. This blocked ALL scroll in the image area above the sheet.

**Fix:** Added an 8px drag commitment threshold (`isDragCommitted` ref). Below threshold, `preventDefault` is not called and the browser handles the event normally. Also made `touchAction` conditional: only `'none'` during active drag.

### Hit 2: Image scroller top-bounce prevention (commit 6b91d2e)

**What happened:** To prevent the iOS rubber-band bounce at the top of the image scroller (while allowing it at the bottom), a `touchmove` listener with `{ passive: false }` was permanently attached to the image scroller element. It called `preventDefault()` when `scrollTop <= 0 && dy > 0`.

**Fix attempt 1 (commit 53df8aa):** Dynamic attachment — only attach during edge-zone touches. Still broke DevTools because the listener existed during the first 8px of gesture direction-lock.

**Fix attempt 2 (final, commit dca3572):** Removed ALL non-passive touchmove handlers. Replaced with a purely passive `scroll` listener that toggles `overscrollBehaviorY` between `''` (class default `none`) and `'contain'`.

### Hit 3: Edge swipe to dismiss (commit dff04fd, fixed 5aa3408)

**What happened:** The edge swipe gesture on `QuickViewModal` registered a permanent `{ passive: false }` touchmove on the content container (parent of ALL QuickView content). Even though the handler checked `if (!active) return` for most touches, the listener's mere existence blocked scroll.

**Fix:** Dynamic attachment — touchmove only registered during active edge-zone gestures (touch starts within 30px of left edge), removed on touchend.

### Hit 4: Second attempt at top-bounce prevention (commit 53df8aa)

**What happened:** Even the "dynamic attachment" approach for the image scroller's touchmove broke DevTools. The non-passive listener was attached on every touchstart when `scrollTop <= 2`, which includes the very first touch on the page. During the 8px direction-lock window, the compositor was blocked.

**Fix (commit dca3572):** Eliminated touchmove interception entirely. Used passive scroll listener + CSS property toggling instead.

## Safe Patterns

### Pattern 1: CSS property toggle via passive scroll listener (RECOMMENDED)

Use `overscroll-behavior-y` toggling to control bounce direction. No touch interception needed.

```tsx
// CSS class as safe default
className="overscroll-none" // no bounce anywhere

// Passive scroll listener upgrades to 'contain' when away from top
useEffect(() => {
  const scroller = ref.current;
  if (!scroller) return;

  const onScroll = () => {
    const value = scroller.scrollTop > 0 ? 'contain' : '';
    if (scroller.style.overscrollBehaviorY !== value) {
      scroller.style.overscrollBehaviorY = value;
    }
  };

  scroller.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    scroller.removeEventListener('scroll', onScroll);
    scroller.style.overscrollBehaviorY = '';
  };
}, []);
```

**Trade-off:** Momentum scroll reaching the top may briefly bounce before the scroll listener fires and sets `none`. Acceptable in practice — the bounce is subtle.

### Pattern 2: Drag commitment threshold (for sheet/panel drag)

When a draggable element overlaps a scrollable area, don't call `preventDefault()` until the gesture is clearly a drag.

```tsx
const isDragCommitted = useRef(false);

const handleTouchMove = (e: React.TouchEvent) => {
  if (!isDragging) return;

  if (!isDragCommitted.current) {
    const distance = Math.abs(currentY - dragStartY.current);
    if (distance < 8) return; // Let browser handle (scroll)
    isDragCommitted.current = true;
  }

  e.preventDefault(); // Only after commitment
};
```

**Important:** The React `onTouchMove` handler is passive by default in React 17+. This pattern works because React doesn't register it as non-passive. For native `addEventListener`, you MUST use `{ passive: true }` or omit the option.

### Pattern 3: Dynamic non-passive attachment (for edge swipe)

When you absolutely must call `preventDefault()` on touchmove (e.g., to prevent scroll during a horizontal swipe), attach the listener only during the specific gesture and remove it immediately after.

```tsx
const onTouchStart = (e: TouchEvent) => {
  if (e.touches[0].clientX > 30) return; // Not in edge zone
  content.addEventListener('touchmove', onTouchMove, { passive: false });
};

const onTouchEnd = () => {
  content.removeEventListener('touchmove', onTouchMove);
};

// ONLY register start/end permanently — touchmove is transient
content.addEventListener('touchstart', onTouchStart, { passive: true });
content.addEventListener('touchend', onTouchEnd, { passive: true });
```

**Critical:** This pattern is ONLY safe when the activation zone (left 30px edge) does not overlap with the scrollable content's primary touch area. If it does, use Pattern 1 instead.

## Files Affected

| File | What it does | Pattern used |
|------|-------------|-------------|
| `QuickViewMobileSheet.tsx` | Bottom sheet drag | Pattern 2 (8px threshold) |
| `QuickView.tsx` | Image scroller directional bounce | Pattern 1 (CSS toggle) |
| `QuickViewModal.tsx` | Edge swipe to dismiss | Pattern 3 (dynamic attach) |

## How to Test

1. Open Chrome DevTools → Toggle Device Toolbar (mobile emulation)
2. Navigate to any listing to open QuickView
3. Two-finger scroll on trackpad — images must scroll smoothly
4. Verify on real iOS device — bottom bounce should work, top bounce should not
5. Verify edge swipe from left dismisses QuickView on mobile

## Key Insight

The compositor thread and the main JS thread are separate. Scroll is handled by the compositor for performance. A `{ passive: false }` touchmove listener is a promise to the browser: "I might cancel this gesture." The compositor must then wait for JS on every frame, destroying scroll performance. In DevTools emulation, this waiting period causes the emulated gesture to never initialize at all.
