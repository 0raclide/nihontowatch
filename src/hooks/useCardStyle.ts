'use client';

import { useState, useEffect, useCallback } from 'react';

export type CardStyle = 'standard' | 'collector';

const STORAGE_KEY = 'nihontowatch-card-style';
const VALID_STYLES: CardStyle[] = ['standard', 'collector'];

export interface UseCardStyleReturn {
  cardStyle: CardStyle;
  setCardStyle: (style: CardStyle) => void;
}

/**
 * Hook to read/write card style preference from localStorage.
 * Returns 'standard' by default.
 */
export function useCardStyle(): UseCardStyleReturn {
  const [cardStyle, setCardStyleState] = useState<CardStyle>('standard');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_STYLES.includes(stored as CardStyle)) {
        setCardStyleState(stored as CardStyle);
      }
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  const setCardStyle = useCallback((style: CardStyle) => {
    if (!VALID_STYLES.includes(style)) return;
    setCardStyleState(style);
    try {
      localStorage.setItem(STORAGE_KEY, style);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { cardStyle, setCardStyle };
}
