'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

export type CardStyle = 'standard' | 'collector';

const STORAGE_KEY = 'nihontowatch-card-style';
const CHANGE_EVENT = 'nihontowatch-card-style-change';
const VALID_STYLES: CardStyle[] = ['standard', 'collector'];

export interface UseCardStyleReturn {
  cardStyle: CardStyle;
  setCardStyle: (style: CardStyle) => void;
}

// Module-level state so all hook instances share the same value
let currentStyle: CardStyle = 'standard';
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function getSnapshot(): CardStyle {
  return currentStyle;
}

function getServerSnapshot(): CardStyle {
  return 'standard';
}

// Initialize from localStorage once on module load (client only)
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_STYLES.includes(stored as CardStyle)) {
      currentStyle = stored as CardStyle;
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Hook to read/write card style preference.
 * Uses useSyncExternalStore so ALL hook instances share the same state —
 * when ThemeSwitcher calls setCardStyle, VirtualListingGrid re-renders too.
 */
export function useCardStyle(): UseCardStyleReturn {
  const cardStyle = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCardStyle = useCallback((style: CardStyle) => {
    if (!VALID_STYLES.includes(style)) return;
    currentStyle = style;
    try {
      localStorage.setItem(STORAGE_KEY, style);
    } catch {
      // localStorage unavailable
    }
    emitChange();
  }, []);

  return { cardStyle, setCardStyle };
}
