'use client';

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

interface MobileUIState {
  filterDrawerOpen: boolean;
  navDrawerOpen: boolean;
  searchOpen: boolean;
}

interface MobileUIContextValue extends MobileUIState {
  openFilterDrawer: () => void;
  closeFilterDrawer: () => void;
  openNavDrawer: () => void;
  closeNavDrawer: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  closeAll: () => void;
}

const MobileUIContext = createContext<MobileUIContextValue | null>(null);

export function MobileUIProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileUIState>({
    filterDrawerOpen: false,
    navDrawerOpen: false,
    searchOpen: false,
  });

  // Mutex behavior: opening one closes others
  const openFilterDrawer = useCallback(() => {
    setState({ filterDrawerOpen: true, navDrawerOpen: false, searchOpen: false });
  }, []);

  const closeFilterDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, filterDrawerOpen: false }));
  }, []);

  const openNavDrawer = useCallback(() => {
    setState({ filterDrawerOpen: false, navDrawerOpen: true, searchOpen: false });
  }, []);

  const closeNavDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, navDrawerOpen: false }));
  }, []);

  const openSearch = useCallback(() => {
    setState({ filterDrawerOpen: false, navDrawerOpen: false, searchOpen: true });
  }, []);

  const closeSearch = useCallback(() => {
    setState((prev) => ({ ...prev, searchOpen: false }));
  }, []);

  const closeAll = useCallback(() => {
    setState({ filterDrawerOpen: false, navDrawerOpen: false, searchOpen: false });
  }, []);

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value = useMemo(
    () => ({
      ...state,
      openFilterDrawer,
      closeFilterDrawer,
      openNavDrawer,
      closeNavDrawer,
      openSearch,
      closeSearch,
      closeAll,
    }),
    [
      state,
      openFilterDrawer,
      closeFilterDrawer,
      openNavDrawer,
      closeNavDrawer,
      openSearch,
      closeSearch,
      closeAll,
    ]
  );

  return (
    <MobileUIContext.Provider value={value}>
      {children}
    </MobileUIContext.Provider>
  );
}

export function useMobileUI() {
  const context = useContext(MobileUIContext);
  if (!context) {
    throw new Error('useMobileUI must be used within a MobileUIProvider');
  }
  return context;
}
