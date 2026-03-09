'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ShowcaseLightbox } from '@/components/showcase/ShowcaseLightbox';

// ============================================================================
// Types
// ============================================================================

interface LightboxContextType {
  openLightbox: (imageUrl: string) => void;
  isOpen: boolean;
}

interface LightboxProviderProps {
  allImageUrls: string[];
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const LightboxContext = createContext<LightboxContextType | null>(null);

export function useLightbox(): LightboxContextType {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within a LightboxProvider');
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================

export function LightboxProvider({ allImageUrls, children }: LightboxProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = useCallback((imageUrl: string) => {
    const idx = allImageUrls.indexOf(imageUrl);
    if (idx === -1) return;
    setCurrentIndex(idx);
    setIsOpen(true);
  }, [allImageUrls]);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  const navigateLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  return (
    <LightboxContext.Provider value={{ openLightbox, isOpen }}>
      {children}
      {isOpen && allImageUrls.length > 0 && (
        <ShowcaseLightbox
          images={allImageUrls}
          currentIndex={currentIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}
    </LightboxContext.Provider>
  );
}
