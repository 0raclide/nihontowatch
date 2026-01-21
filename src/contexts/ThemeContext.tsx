'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';

// ============================================================================
// Theme Definitions
// ============================================================================

/**
 * Available theme names - each has a unique aesthetic
 *
 * Dark themes: dark (default), opus
 * Light themes: light
 *
 * Extensible: Add new themes to THEME_NAMES and THEMES record
 */
export const THEME_NAMES = ['opus', 'sothebys', 'yuhindo'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export type ThemeMode = 'light' | 'dark';

export interface ThemeDefinition {
  name: ThemeName;
  label: string;
  mode: ThemeMode;
  /** Primary accent color for preview */
  previewAccent: string;
  /** Background color for preview */
  previewBg: string;
  /** Meta theme-color for mobile browsers */
  metaColor: string;
}

/**
 * Theme metadata for UI display
 *
 * To add a new theme:
 * 1. Add the name to THEME_NAMES array
 * 2. Add the definition to this THEMES record
 * 3. Add corresponding CSS variables in your global styles
 */
export const THEMES: Record<ThemeName, ThemeDefinition> = {
  opus: {
    name: 'opus',
    label: 'Opus',
    mode: 'dark',
    previewAccent: '#daa55a',
    previewBg: '#0c1220',
    metaColor: '#0c1220',
  },
  sothebys: {
    name: 'sothebys',
    label: 'Sothebys',
    mode: 'light',
    previewAccent: '#B8860B',
    previewBg: '#FAF9F6',
    metaColor: '#FAF9F6',
  },
  yuhindo: {
    name: 'yuhindo',
    label: 'Yuhindo',
    mode: 'dark',
    previewAccent: '#aa98dd',
    previewBg: '#010000',
    metaColor: '#010000',
  },
};

// ============================================================================
// Types
// ============================================================================

export type ThemeSetting = ThemeName | 'system';

interface ThemeContextValue {
  /** Current theme setting (theme name or 'system') */
  themeSetting: ThemeSetting;
  /** The active theme being displayed */
  activeTheme: ThemeName;
  /** The active theme's mode (light or dark) */
  activeMode: ThemeMode;
  /** Full theme definition */
  themeDefinition: ThemeDefinition;
  /** Update the theme */
  setTheme: (theme: ThemeSetting) => void;
  /** All available themes */
  themes: typeof THEMES;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'nihontowatch-theme';
const DEFAULT_THEME: ThemeName = 'opus';

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ============================================================================
// Helper Functions
// ============================================================================

function getSystemTheme(): ThemeName {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'sothebys'
    : 'opus';
}

function getStoredTheme(): ThemeSetting | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'system' || THEME_NAMES.includes(stored as ThemeName)) {
    return stored as ThemeSetting;
  }
  return null;
}

function resolveTheme(setting: ThemeSetting): ThemeName {
  if (setting === 'system') {
    return getSystemTheme();
  }
  return setting;
}

function applyTheme(themeName: ThemeName) {
  const root = document.documentElement;
  const theme = THEMES[themeName];

  // Remove all theme classes
  THEME_NAMES.forEach((name) => {
    root.classList.remove(`theme-${name}`);
  });
  root.classList.remove('theme-light', 'theme-dark', 'dark');

  // Add the theme class
  root.classList.add(`theme-${themeName}`);

  // Also add mode class for light: variant compatibility
  root.classList.add(`theme-${theme.mode}`);

  // Add standard 'dark' class for Tailwind dark: prefix compatibility
  if (theme.mode === 'dark') {
    root.classList.add('dark');
  }

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme.metaColor);
  }
}

// ============================================================================
// Provider Component
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme if none is stored. Defaults to 'yuhinkai'. */
  defaultTheme?: ThemeSetting;
  /** Force a specific theme (useful for previews). Overrides stored theme. */
  forcedTheme?: ThemeSetting;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  forcedTheme,
}: ThemeProviderProps) {
  // IMPORTANT: Always use the same initial value on server and client to avoid hydration mismatch
  // The actual stored theme will be applied in useEffect after mount
  const [themeSetting, setThemeSettingState] = useState<ThemeSetting>(
    forcedTheme ?? defaultTheme
  );

  const [activeTheme, setActiveTheme] = useState<ThemeName>(
    resolveTheme(forcedTheme ?? defaultTheme)
  );

  // Track if we've initialized from localStorage
  const isHydratedRef = useRef(false);

  // Initialize theme from localStorage after mount (client-only)
  // This runs once on mount
  useEffect(() => {
    if (isHydratedRef.current) return;
    isHydratedRef.current = true;

    if (forcedTheme) return;

    const stored = getStoredTheme();
    if (stored && stored !== themeSetting) {
      setThemeSettingState(stored);
      const resolved = resolveTheme(stored);
      if (resolved !== activeTheme) {
        setActiveTheme(resolved);
      }
      applyTheme(resolved);
    } else {
      // Apply default theme to DOM
      applyTheme(activeTheme);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply theme to DOM whenever themeSetting changes (user action)
  useEffect(() => {
    // Skip on first render (handled by init effect above)
    if (!isHydratedRef.current) return;

    const activeSetting = forcedTheme ?? themeSetting;
    const resolved = resolveTheme(activeSetting);
    if (resolved !== activeTheme) {
      setActiveTheme(resolved);
    }
    applyTheme(resolved);
  }, [themeSetting, forcedTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for system preference changes when theme is 'system'
  useEffect(() => {
    if (forcedTheme || themeSetting !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

    const handleChange = () => {
      const resolved = getSystemTheme();
      setActiveTheme(resolved);
      applyTheme(resolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeSetting, forcedTheme]);

  // Persist theme to localStorage
  const setTheme = useCallback(
    (newTheme: ThemeSetting) => {
      if (forcedTheme) return;

      setThemeSettingState(newTheme);
      localStorage.setItem(STORAGE_KEY, newTheme);
    },
    [forcedTheme]
  );

  const themeDefinition = THEMES[activeTheme];

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value: ThemeContextValue = useMemo(
    () => ({
      themeSetting: forcedTheme ?? themeSetting,
      activeTheme,
      activeMode: themeDefinition.mode,
      themeDefinition,
      setTheme,
      themes: THEMES,
    }),
    [forcedTheme, themeSetting, activeTheme, themeDefinition, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ============================================================================
// Script for preventing FOUC (Flash of Unstyled Content)
// ============================================================================

/**
 * Inline script to prevent flash of unstyled content
 * Include this in your root layout's <head> via <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('nihontowatch-theme');
    var themes = ['opus', 'sothebys', 'yuhindo'];
    var themeData = {
      opus: { mode: 'dark', metaColor: '#0c1220' },
      sothebys: { mode: 'light', metaColor: '#FAF9F6' },
      yuhindo: { mode: 'dark', metaColor: '#010000' }
    };

    var theme = themes.includes(stored) ? stored : null;

    if (stored === 'system' || !theme) {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'sothebys' : 'opus';
    }

    var data = themeData[theme] || themeData.opus;

    document.documentElement.classList.add('theme-' + theme);
    document.documentElement.classList.add('theme-' + data.mode);

    // Add 'dark' class for Tailwind dark: prefix compatibility
    if (data.mode === 'dark') {
      document.documentElement.classList.add('dark');
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', data.metaColor);
    }
  } catch (e) {}
})();
`;
