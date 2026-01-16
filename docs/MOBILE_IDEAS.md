# Mobile UI Patterns for Addictive Shopping

This document outlines mobile UI patterns that drive engagement and make the shopping experience more addictive for collectors.

---

## High-Impact Patterns

| Pattern | Why It's Addictive | Effort | Status |
|---------|-------------------|--------|--------|
| **Double-tap to favorite** | Instant gratification, Instagram muscle memory | Medium | Planned |
| **Pull-to-refresh** | "What's new?" dopamine hit, checking behavior | Low | Planned |
| **Swipe gestures on cards** | Tinder-style save/dismiss, speeds browsing | Medium | Planned |
| **"NEW" badges** | FOMO, urgency for fresh inventory | Low | Planned |
| **Quick-view modal** | Preview without losing scroll position | Medium | Planned |
| **Recently viewed row** | Easy return, keeps items in mind | Low | Planned |
| **Image viewer with swipe/zoom** | Collectors scrutinize details | Medium | Planned |
| **Sticky "Contact Dealer" CTA** | Reduces friction to purchase | Low | Planned |
| **Share sheet** | Send to collector friends | Low | Planned |

---

## Implementation Priority

### Phase 1: Quick Wins
1. **Pull-to-refresh** - Native gesture, satisfying feedback
2. **"NEW" badges** - Items added in last 48h get a badge

### Phase 2: Core Engagement
3. **Double-tap to favorite** - Heart animation, localStorage for guests
4. **Recently viewed row** - Horizontal scroll, persists in localStorage

### Phase 3: Power Features
5. **Quick-view modal** - Tap card for overlay, swipe to dismiss
6. **Image viewer** - Full-screen, pinch-to-zoom, swipe between images
7. **Swipe gestures** - Right to save, left to hide

### Phase 4: Social
8. **Share sheet** - Native share API, deep links
9. **Sticky CTA** - "Contact Dealer" button on scroll

---

## Pattern Details

### Pull-to-Refresh
```
- Use native pull gesture at top of listing grid
- Show refresh indicator with brand color
- Haptic feedback on release
- Update "last updated" timestamp
```

### "NEW" Badges
```
- Show on items where first_seen_at < 48 hours ago
- Small gold badge in corner of card
- Text: "NEW" or just a dot indicator
- Configurable threshold (24h, 48h, 72h)
```

### Double-tap to Favorite
```
- Double-tap anywhere on card triggers favorite
- Heart animation scales up and fades (Instagram-style)
- Haptic feedback (light impact)
- Store in localStorage for guests
- Sync to account when logged in (future)
- Favorites accessible from header icon
```

### Recently Viewed
```
- Horizontal scrolling row above main grid
- "Continue browsing" or "Recently viewed" label
- Max 10-15 items, LIFO order
- Stored in localStorage
- Clicking item scrolls to it or opens detail
```

### Quick-View Modal
```
- Tap card opens bottom sheet (60% height)
- Shows: large image, title, price, key specs
- "View full details" button for full page
- Swipe down to dismiss
- Swipe left/right to navigate items
```

### Image Viewer
```
- Tap image opens full-screen viewer
- Pinch-to-zoom with smooth animation
- Swipe between multiple images
- Double-tap to zoom in/out
- X button or swipe down to close
```

### Swipe Gestures
```
- Swipe right: Save to favorites (heart icon reveal)
- Swipe left: Hide/not interested (X icon reveal)
- Partial swipe shows action preview
- Full swipe executes action
- Undo toast for accidental swipes
```

### Share Sheet
```
- Share button on card and detail page
- Uses Web Share API (native on mobile)
- Fallback: copy link to clipboard
- Share text: "{title} - {price} on Nihontowatch"
- Include thumbnail in share preview
```

### Sticky Contact CTA
```
- Appears after scrolling past fold
- Fixed at bottom of screen
- "Contact Dealer" or "Inquire" button
- Links to dealer's listing page (external)
- Subtle slide-up animation
```

---

## Technical Notes

### localStorage Keys
```javascript
favorites: string[]        // Array of listing IDs
recentlyViewed: string[]   // Array of listing IDs (max 15)
hiddenItems: string[]      // Items user swiped away
```

### Haptic Feedback
```javascript
// Light impact for favorites
navigator.vibrate?.(10);

// Or using Haptic Feedback API (iOS Safari)
if ('vibrate' in navigator) {
  navigator.vibrate(10);
}
```

### Animation Library
Consider using:
- Framer Motion (already common in React)
- CSS animations for simple effects
- Lottie for complex heart animations

---

## Metrics to Track

| Metric | Pattern | Goal |
|--------|---------|------|
| Pull-to-refresh rate | Pull-to-refresh | 2+ per session |
| Favorite rate | Double-tap | 5%+ of viewed items |
| Return to recently viewed | Recently viewed | 20%+ click-through |
| Quick-view usage | Quick-view | 30%+ of card taps |
| Share rate | Share sheet | 1%+ of sessions |
| Session duration | All | +20% increase |

---

## References

- Instagram: Double-tap to like, pull-to-refresh
- Tinder: Swipe gestures, quick decisions
- Pinterest: Masonry grid, save functionality
- GOAT/StockX: Sneaker collecting patterns
- Chrono24: Watch collecting, similar demographic
