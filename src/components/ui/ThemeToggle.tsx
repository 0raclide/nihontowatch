'use client';

import { useEffect, useState } from 'react';
import { useTheme, THEMES, type ThemeName } from '@/contexts/ThemeContext';

/**
 * ThemeToggle - Cycles through available themes
 * A simple button that cycles to the next theme on click.
 * Good for quick toggling on mobile.
 */
export function ThemeToggle() {
  const { activeTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    const themeNames = Object.keys(THEMES) as ThemeName[];
    const currentIndex = themeNames.indexOf(activeTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    setTheme(themeNames[nextIndex]);
  };

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <button className="w-9 h-9 flex items-center justify-center border border-border bg-surface">
        <div className="w-4 h-4" />
      </button>
    );
  }

  const currentTheme = THEMES[activeTheme];
  const isDark = currentTheme.mode === 'dark';

  return (
    <button
      onClick={cycleTheme}
      className="w-9 h-9 flex items-center justify-center border border-border bg-surface hover:bg-hover transition-colors"
      aria-label={`Current theme: ${currentTheme.label}. Click to change.`}
      title={currentTheme.label}
    >
      {isDark ? (
        // Moon icon for dark themes
        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        // Sun icon for light themes
        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
}

/**
 * ThemeSelector - Shows all themes in a list format
 * Good for mobile nav drawers where you want to show all options inline.
 */
export function ThemeSelector() {
  const { themeSetting, activeTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[140px]" />;
  }

  const themeEntries = Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][];

  return (
    <div className="space-y-1">
      {/* System option */}
      <button
        onClick={() => setTheme('system')}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
          themeSetting === 'system'
            ? 'bg-accent/10 text-accent'
            : 'hover:bg-hover text-text-secondary'
        }`}
      >
        <div className="w-5 h-5 rounded-full border border-border bg-surface flex items-center justify-center">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-sm">System</span>
        {themeSetting === 'system' && (
          <svg className="w-4 h-4 ml-auto text-accent" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Theme options */}
      {themeEntries.map(([themeName, themeConfig]) => {
        const isSelected = themeSetting === themeName;

        return (
          <button
            key={themeName}
            onClick={() => setTheme(themeName)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              isSelected
                ? 'bg-accent/10 text-accent'
                : 'hover:bg-hover text-text-secondary'
            }`}
          >
            <div
              className="w-5 h-5 rounded-full border border-border flex items-center justify-center"
              style={{ backgroundColor: themeConfig.previewBg }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: themeConfig.previewAccent }}
              />
            </div>
            <span className="text-sm">{themeConfig.label}</span>
            {isSelected && (
              <svg className="w-4 h-4 ml-auto text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
