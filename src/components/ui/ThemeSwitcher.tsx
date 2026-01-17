'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTheme, THEMES, type ThemeName } from '@/contexts/ThemeContext';

export function ThemeSwitcher() {
  const { activeTheme, themeSetting, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle mounting for hydration safety
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle escape key to close dropdown
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleThemeSelect = useCallback((themeName: ThemeName | 'system') => {
    setTheme(themeName);
    setIsOpen(false);
    buttonRef.current?.focus();
  }, [setTheme]);

  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Hydration-safe placeholder
  if (!mounted) {
    return (
      <button
        className="w-9 h-9 flex items-center justify-center border border-border bg-paper"
        aria-label="Theme selector loading"
      >
        <div className="w-4 h-4" />
      </button>
    );
  }

  const themeEntries = Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][];

  return (
    <div className="relative">
      {/* Theme switcher button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="w-9 h-9 flex items-center justify-center border border-border bg-paper hover:bg-hover transition-colors"
        aria-label="Select theme"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Palette/Paint icon */}
        <svg
          className="w-4 h-4 text-charcoal"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-64 bg-paper border border-border shadow-lg shadow-black/10 z-50"
          role="listbox"
          aria-label="Theme options"
        >
          {/* System option */}
          <button
            onClick={() => handleThemeSelect('system')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hover transition-colors ${
              themeSetting === 'system' ? 'bg-hover' : ''
            }`}
            role="option"
            aria-selected={themeSetting === 'system'}
          >
            {/* System icon */}
            <div className="w-6 h-6 flex items-center justify-center rounded-full border border-border bg-gradient-to-br from-paper to-border">
              <svg
                className="w-3.5 h-3.5 text-charcoal"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink">
                System
              </div>
              <div className="text-xs text-muted truncate">
                Follow OS preference
              </div>
            </div>
            {themeSetting === 'system' && (
              <svg
                className="w-4 h-4 text-gold flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          {/* Divider */}
          <div className="h-px bg-border mx-3" />

          {/* Theme options */}
          {themeEntries.map(([themeName, themeConfig]) => {
            const isSelected = themeSetting === themeName;

            return (
              <button
                key={themeName}
                onClick={() => handleThemeSelect(themeName)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hover transition-colors ${
                  isSelected ? 'bg-hover' : ''
                }`}
                role="option"
                aria-selected={isSelected}
              >
                {/* Color preview swatch */}
                <div
                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: themeConfig.previewBg }}
                  aria-hidden="true"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: themeConfig.previewAccent }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {themeConfig.label}
                  </div>
                </div>
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-gold flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
