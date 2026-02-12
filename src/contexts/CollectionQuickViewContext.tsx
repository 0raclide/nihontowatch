'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

  // Close cooldown — prevents re-open from click propagation (matching browse QuickViewContext)
  const closeCooldown = useRef(false);

  // URL sync helper — update ?item=ID in URL without navigation
  const syncItemToURL = useCallback((itemId: string | null) => {
    const url = new URL(window.location.href);
    if (itemId) {
      url.searchParams.set('item', itemId);
    } else {
      url.searchParams.delete('item');
    }
    window.history.replaceState(null, '', url.toString());
  }, []);

  const openQuickView = useCallback((item: CollectionItem, openMode: CollectionQuickViewMode = 'view') => {
    if (closeCooldown.current) return;

    const index = items.findIndex(i => i.id === item.id);
    setCurrentItem(index !== -1 ? items[index] : item);
    setMode(openMode);
    setPrefillData(null);
    setIsOpen(true);
    setCurrentIndex(index);

    // Sync to URL
    syncItemToURL(item.id);
  }, [items, syncItemToURL]);

  const openAddForm = useCallback((prefill?: Partial<CollectionItem>) => {
    if (closeCooldown.current) return;

    setCurrentItem(null);
    setMode('add');
    setPrefillData(prefill || null);
    setIsOpen(true);
    setCurrentIndex(-1);

    // Don't sync add mode to URL (no item ID)
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

    // Remove ?item= from URL
    syncItemToURL(null);

    // Cooldown to prevent re-open from click propagation
    closeCooldown.current = true;
    setTimeout(() => { closeCooldown.current = false; }, 300);
  }, [syncItemToURL]);

  const goToNext = useCallback(() => {
    if (items.length === 0 || currentIndex === -1 || currentIndex >= items.length - 1) return;
    const nextIndex = currentIndex + 1;
    const nextItem = items[nextIndex];
    setCurrentItem(nextItem);
    setCurrentIndex(nextIndex);
    setMode('view');
    syncItemToURL(nextItem.id);
  }, [items, currentIndex, syncItemToURL]);

  const goToPrevious = useCallback(() => {
    if (items.length === 0 || currentIndex <= 0) return;
    const prevIndex = currentIndex - 1;
    const prevItem = items[prevIndex];
    setCurrentItem(prevItem);
    setCurrentIndex(prevIndex);
    setMode('view');
    syncItemToURL(prevItem.id);
  }, [items, currentIndex, syncItemToURL]);

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
  // Note: Escape is also handled by QuickViewModal, but we keep it here for
  // keyboard nav which QuickViewModal doesn't handle
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (mode === 'view') {
        if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); goToNext(); }
        if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); goToPrevious(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, goToNext, goToPrevious]);

  // Popstate listener — close modal when browser back button is pressed
  useEffect(() => {
    const handlePopstate = () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('item') && isOpen && mode === 'view') {
        setIsOpen(false);
        setCurrentItem(null);
        setPrefillData(null);
        setCurrentIndex(-1);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [isOpen, mode]);

  // On mount, check URL for ?item=ID and open it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    if (itemId && items.length > 0) {
      const item = items.find(i => i.id === itemId);
      if (item && !isOpen) {
        const index = items.indexOf(item);
        setCurrentItem(item);
        setMode('view');
        setIsOpen(true);
        setCurrentIndex(index);
      }
    }
    // Only run when items are loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

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
