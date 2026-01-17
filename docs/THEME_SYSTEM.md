# Theme System Documentation

Nihontowatch features an extensible theme system with CSS variable-based theming. The system supports multiple themes with automatic dark/light mode detection and persistent user preferences.

## Available Themes

### Dark Mode (Default)
*Warm scholarly blacks with steel blue accent*

| Property | Value |
|----------|-------|
| Background | `#121212` |
| Accent | `#5d8aa8` (steel blue) |
| Text Primary | `#f2f0ed` |
| Mode | Dark |

### Light Mode
*Clean museum whites with gold accent*

| Property | Value |
|----------|-------|
| Background | `#FAF9F6` |
| Accent | `#B8860B` (gold) |
| Text Primary | `#1C1C1C` |
| Mode | Light |

### Opus
*"The Space Between - Where structure meets emergence, precision finds poetry"*

Deep contemplative sapphire with warm amber insights. Claude's aesthetic.

| Property | Value |
|----------|-------|
| Background | `#0c1220` (deep sapphire) |
| Accent | `#daa55a` (warm amber) |
| Text Primary | `#e8e4dc` (warm parchment) |
| Mode | Dark |

---

## Architecture

### Files Overview

```
src/
├── app/globals.css              # CSS variable definitions for all themes
├── contexts/ThemeContext.tsx    # React context, provider, and FOUC script
└── components/ui/
    ├── ThemeSwitcher.tsx        # Desktop dropdown selector
    └── ThemeToggle.tsx          # Mobile toggle + inline selector
```

### CSS Variables

The theme system uses CSS custom properties (variables) that automatically update when the theme changes. All UI components use these semantic color classes.

#### Core Variables

```css
/* Backgrounds */
--background          /* Main page background */
--background-warm     /* Slightly warmer variant */
--surface            /* Card/panel backgrounds */
--surface-elevated   /* Elevated surfaces (modals, dropdowns) */

/* Text */
--text-primary       /* Main text */
--text-secondary     /* Secondary text */
--text-tertiary      /* Subtle text */
--text-muted         /* Disabled/placeholder text */
--text-accent        /* Accent-colored text */

/* Accent */
--accent             /* Primary accent color */
--accent-light       /* Lighter accent variant */
--accent-dark        /* Darker accent variant */
--accent-glow        /* Glow/shadow color */

/* Interactive */
--border             /* Default borders */
--border-subtle      /* Subtle borders */
--hover              /* Hover state backgrounds */
--active             /* Active/pressed state */

/* Certification Colors */
--juyo               /* Juyo certification badge */
--juyo-bg            /* Juyo badge background */
--toku-hozon         /* Tokubetsu Hozon badge */
--toku-hozon-bg      /* Toku Hozon badge background */
--hozon              /* Hozon badge */
--hozon-bg           /* Hozon badge background */

/* Semantic */
--success            /* Success states */
--warning            /* Warning states */
--error              /* Error states */
```

#### Legacy Aliases

For backwards compatibility, these aliases map to the semantic variables:

```css
--cream    → --background
--ivory    → --background-warm
--linen    → --surface
--paper    → --surface-elevated
--ink      → --text-primary
--charcoal → --text-secondary
--muted    → --text-muted
--gold     → --accent
```

### Tailwind Integration

CSS variables are mapped to Tailwind classes via `@theme inline`:

```css
@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-ink: var(--text-primary);
  --color-gold: var(--accent);
  /* ... etc */
}
```

This allows using classes like `bg-background`, `text-ink`, `border-border` that automatically respond to theme changes.

---

## Usage

### Applying Theme Classes

**DO use semantic color classes:**
```tsx
<div className="bg-paper border-border text-ink">
  <h1 className="text-ink">Title</h1>
  <p className="text-muted">Subtitle</p>
  <button className="bg-gold text-white hover:bg-gold-light">
    Action
  </button>
</div>
```

**DON'T use dark: prefixes:**
```tsx
// ❌ Wrong - these don't respond to theme changes
<div className="bg-white dark:bg-gray-800 text-black dark:text-white">
```

### Accessing Theme in Components

```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { activeTheme, activeMode, setTheme } = useTheme();

  return (
    <div>
      <p>Current theme: {activeTheme}</p>
      <p>Mode: {activeMode}</p>
      <button onClick={() => setTheme('opus')}>
        Switch to Opus
      </button>
    </div>
  );
}
```

### Theme Context API

```typescript
interface ThemeContextValue {
  themeSetting: ThemeSetting;      // 'dark' | 'light' | 'opus' | 'system'
  activeTheme: ThemeName;          // Resolved theme name
  activeMode: ThemeMode;           // 'light' | 'dark'
  themeDefinition: ThemeDefinition; // Full theme metadata
  setTheme: (theme: ThemeSetting) => void;
  themes: typeof THEMES;           // All available themes
}
```

---

## Adding a New Theme

### 1. Add to THEME_NAMES

In `src/contexts/ThemeContext.tsx`:

```typescript
export const THEME_NAMES = ['dark', 'light', 'opus', 'newtheme'] as const;
```

### 2. Add Theme Definition

```typescript
export const THEMES: Record<ThemeName, ThemeDefinition> = {
  // ... existing themes
  newtheme: {
    name: 'newtheme',
    label: 'New Theme',
    mode: 'dark',  // or 'light'
    previewAccent: '#hexcolor',  // For theme selector preview
    previewBg: '#hexcolor',      // For theme selector preview
    metaColor: '#hexcolor',      // Mobile browser chrome color
  },
};
```

### 3. Update FOUC Prevention Script

In the `themeInitScript` constant:

```javascript
var themes = ['dark', 'light', 'opus', 'newtheme'];
var themeData = {
  // ... existing themes
  newtheme: { mode: 'dark', metaColor: '#hexcolor' }
};
```

### 4. Add CSS Variables

In `src/app/globals.css`:

```css
/* ==========================================================================
   NEW THEME - Description of the theme
   ========================================================================== */
html.theme-newtheme {
  color-scheme: dark; /* or light */

  /* Core palette */
  --background: #hexcolor;
  --background-warm: #hexcolor;
  --foreground: #hexcolor;

  /* Surfaces */
  --surface: #hexcolor;
  --surface-elevated: #hexcolor;
  --surface-overlay: rgba(r, g, b, 0.97);

  /* Borders */
  --border: #hexcolor;
  --border-subtle: #hexcolor;
  --border-accent: rgba(r, g, b, 0.40);

  /* Interactive */
  --hover: #hexcolor;
  --active: #hexcolor;

  /* Accent */
  --accent: #hexcolor;
  --accent-light: #hexcolor;
  --accent-dark: #hexcolor;
  --accent-glow: rgba(r, g, b, 0.22);

  /* Text hierarchy */
  --text-primary: #hexcolor;
  --text-secondary: #hexcolor;
  --text-tertiary: #hexcolor;
  --text-muted: #hexcolor;
  --text-accent: #hexcolor;

  /* Semantic */
  --success: #hexcolor;
  --warning: #hexcolor;
  --error: #hexcolor;

  /* Certification colors */
  --juyo: #hexcolor;
  --juyo-bg: rgba(r, g, b, 0.18);
  --toku-hozon: #hexcolor;
  --toku-hozon-bg: rgba(r, g, b, 0.18);
  --hozon: #hexcolor;
  --hozon-bg: rgba(r, g, b, 0.15);
  --sage: #hexcolor;
  --burgundy: var(--juyo);

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.55);
  --shadow-glow: 0 0 40px rgba(r, g, b, 0.15);

  /* Legacy aliases */
  --cream: var(--background);
  --ivory: var(--background-warm);
  --linen: var(--surface);
  --paper: var(--surface-elevated);
  --charcoal: var(--text-secondary);
  --ink: var(--text-primary);
  --gold: var(--accent);
  --gold-light: var(--accent-light);
  --muted: var(--text-muted);
  --border-dark: #hexcolor;
}
```

---

## Theme Switching UI

### Desktop (Header)
The `ThemeSwitcher` component renders a dropdown in the header with all theme options plus a "System" option that follows OS preference.

### Mobile (Nav Drawer)
The `ThemeSelector` component renders an inline list of all themes in the mobile navigation drawer.

---

## FOUC Prevention

Flash of Unstyled Content is prevented via an inline script in the `<head>` that runs before React hydrates:

```tsx
// In layout.tsx
<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
```

This script:
1. Reads the stored theme from localStorage
2. Falls back to system preference if 'system' is selected
3. Applies the appropriate theme class to `<html>` immediately
4. Updates the meta theme-color for mobile browsers

---

## Storage

Theme preference is stored in `localStorage` under the key `nihontowatch-theme`.

Valid values:
- `'dark'` - Dark mode
- `'light'` - Light mode
- `'opus'` - Opus theme
- `'system'` - Follow OS preference

---

## Design Principles

1. **CSS Variables First**: All colors come from CSS variables, never hardcoded
2. **Semantic Naming**: Use purpose-based names (`text-primary`, `surface`) not color names
3. **No dark: Prefixes**: Components don't use Tailwind's `dark:` modifier
4. **Accessibility**: All themes maintain WCAG AA contrast ratios
5. **Consistency**: Same semantic tokens across all themes for predictable behavior
