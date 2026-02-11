'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { CollectionItem } from '@/types/collection';

// ============================================================================
// Types
// ============================================================================

export type CollectionQuickViewMode = 'view' | 'add' | 'edit';

interface CollectionQuickViewContextType {
  isOpen: boolean;
  mode: CollectionQuickViewMode;
  currentItem: CollectionItem | null;
  /** Pre-filled data for add mode (from catalog, artisan, or listing import) */
  prefillData: Partial<CollectionItem> | null;
  items: CollectionItem[];
  currentIndex: number;
  openQuickView: (item: CollectionItem, mode?: CollectionQuickViewMode) => void;
  openAddForm: (prefill?: Partial<CollectionItem>) => void;
  openEditForm: (item: CollectionItem) => void;
  closeQuickView: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  setItems: (items: CollectionItem[]) => void;
  /** Refresh after save — refetch from API */
  onSaved: () => void;
  /** Callback set by the page for refresh after mutations */
  setOnSavedCallback: (cb: () => void) => void;
}

// ============================================================================
// Context
// ============================================================================

const CollectionQuickViewContext = createContext<CollectionQuickViewContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface CollectionQuickViewProviderProps {
  children: ReactNode;
}

export function CollectionQuickViewProvider({ children }: CollectionQuickViewProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CollectionQuickViewMode>('view');
  const [currentItem, setCurrentItem] = useState<CollectionItem | null>(null);
  const [prefillData, setPrefillData] = useState<Partial<CollectionItem> | null>(null);
  const [items, setItemsState] = useState<CollectionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [savedCallback, setSavedCallback] = useState<(() => void) | null>(null);

  const openQuickView = useCallback((item: CollectionItem, openMode: CollectionQuickViewMode = 'view') => {
    const index = items.findIndex(i => i.id === item.id);
    setCurrentItem(index !== -1 ? items[index] : item);
    setMode(openMode);
    setPrefillData(null);
    setIsOpen(true);
    setCurrentIndex(index);
  }, [items]);

  const openAddForm = useCallback((prefill?: Partial<CollectionItem>) => {
    setCurrentItem(null);
    setMode('add');
    setPrefillData(prefill || null);
    setIsOpen(true);
    setCurrentIndex(-1);
  }, []);

  const openEditForm = useCallback((item: CollectionItem) => {
    setCurrentItem(item);
    setMode('edit');
    setPrefillData(null);
    setIsOpen(true);
    const index = items.findIndex(i => i.id === item.id);
    setCurrentIndex(index);
  }, [items]);

  const closeQuickView = useCallback(() => {
    setIsOpen(false);
    setCurrentItem(null);
    setPrefillData(null);
    setCurrentIndex(-1);
  }, []);

  const goToNext = useCallback(() => {
    if (items.length === 0 || currentIndex === -1 || currentIndex >= items.length - 1) return;
    const nextIndex = currentIndex + 1;
    setCurrentItem(items[nextIndex]);
    setCurrentIndex(nextIndex);
    setMode('view');
  }, [items, currentIndex]);

  const goToPrevious = useCallback(() => {
    if (items.length === 0 || currentIndex <= 0) return;
    const prevIndex = currentIndex - 1;
    setCurrentItem(items[prevIndex]);
    setCurrentIndex(prevIndex);
    setMode('view');
  }, [items, currentIndex]);

  const setItems = useCallback((newItems: CollectionItem[]) => {
    setItemsState(newItems);
    if (currentItem) {
      const index = newItems.findIndex(i => i.id === currentItem.id);
      setCurrentIndex(index);
    }
  }, [currentItem]);

  const onSaved = useCallback(() => {
    savedCallback?.();
  }, [savedCallback]);

  const setOnSavedCallback = useCallback((cb: () => void) => {
    setSavedCallback(() => cb);
  }, []);

  // Keyboard: Escape to close, arrows to navigate in view mode
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeQuickView();
      }
      if (mode === 'view') {
        if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); goToNext(); }
        if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); goToPrevious(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, closeQuickView, goToNext, goToPrevious]);

  const hasNext = items.length > 1 && currentIndex !== -1 && currentIndex < items.length - 1;
  const hasPrevious = items.length > 1 && currentIndex !== -1 && currentIndex > 0;

  const value = useMemo<CollectionQuickViewContextType>(() => ({
    isOpen, mode, currentItem, prefillData, items, currentIndex,
    openQuickView, openAddForm, openEditForm, closeQuickView,
    goToNext, goToPrevious, hasNext, hasPrevious,
    setItems, onSaved, setOnSavedCallback,
  }), [
    isOpen, mode, currentItem, prefillData, items, currentIndex,
    openQuickView, openAddForm, openEditForm, closeQuickView,
    goToNext, goToPrevious, hasNext, hasPrevious,
    setItems, onSaved, setOnSavedCallback,
  ]);

  return (
    <CollectionQuickViewContext.Provider value={value}>
      {children}
    </CollectionQuickViewContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useCollectionQuickView(): CollectionQuickViewContextType {
  const context = useContext(CollectionQuickViewContext);
  if (!context) {
    throw new Error('useCollectionQuickView must be used within CollectionQuickViewProvider');
  }
  return context;
}

export function useCollectionQuickViewOptional(): CollectionQuickViewContextType | null {
  return useContext(CollectionQuickViewContext);
}
