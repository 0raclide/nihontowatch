import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MobileUIProvider, useMobileUI } from '@/contexts/MobileUIContext';

// Test component that uses the context
function TestConsumer() {
  const {
    filterDrawerOpen,
    navDrawerOpen,
    searchOpen,
    openFilterDrawer,
    closeFilterDrawer,
    openNavDrawer,
    closeNavDrawer,
    openSearch,
    closeSearch,
    closeAll,
  } = useMobileUI();

  return (
    <div>
      <span data-testid="filter-state">{filterDrawerOpen ? 'open' : 'closed'}</span>
      <span data-testid="nav-state">{navDrawerOpen ? 'open' : 'closed'}</span>
      <span data-testid="search-state">{searchOpen ? 'open' : 'closed'}</span>
      <button data-testid="open-filter" onClick={openFilterDrawer}>Open Filter</button>
      <button data-testid="close-filter" onClick={closeFilterDrawer}>Close Filter</button>
      <button data-testid="open-nav" onClick={openNavDrawer}>Open Nav</button>
      <button data-testid="close-nav" onClick={closeNavDrawer}>Close Nav</button>
      <button data-testid="open-search" onClick={openSearch}>Open Search</button>
      <button data-testid="close-search" onClick={closeSearch}>Close Search</button>
      <button data-testid="close-all" onClick={closeAll}>Close All</button>
    </div>
  );
}

describe('MobileUIContext', () => {
  it('provides initial closed state for all drawers', () => {
    render(
      <MobileUIProvider>
        <TestConsumer />
      </MobileUIProvider>
    );

    expect(screen.getByTestId('filter-state')).toHaveTextContent('closed');
    expect(screen.getByTestId('nav-state')).toHaveTextContent('closed');
    expect(screen.getByTestId('search-state')).toHaveTextContent('closed');
  });

  it('opens filter drawer when openFilterDrawer is called', () => {
    render(
      <MobileUIProvider>
        <TestConsumer />
      </MobileUIProvider>
    );

    fireEvent.click(screen.getByTestId('open-filter'));
    expect(screen.getByTestId('filter-state')).toHaveTextContent('open');
  });

  it('closes filter drawer when closeFilterDrawer is called', () => {
    render(
      <MobileUIProvider>
        <TestConsumer />
      </MobileUIProvider>
    );

    fireEvent.click(screen.getByTestId('open-filter'));
    expect(screen.getByTestId('filter-state')).toHaveTextContent('open');

    fireEvent.click(screen.getByTestId('close-filter'));
    expect(screen.getByTestId('filter-state')).toHaveTextContent('closed');
  });

  it('opens nav drawer when openNavDrawer is called', () => {
    render(
      <MobileUIProvider>
        <TestConsumer />
      </MobileUIProvider>
    );

    fireEvent.click(screen.getByTestId('open-nav'));
    expect(screen.getByTestId('nav-state')).toHaveTextContent('open');
  });

  it('opens search when openSearch is called', () => {
    render(
      <MobileUIProvider>
        <TestConsumer />
      </MobileUIProvider>
    );

    fireEvent.click(screen.getByTestId('open-search'));
    expect(screen.getByTestId('search-state')).toHaveTextContent('open');
  });

  describe('mutex behavior (only one drawer open at a time)', () => {
    it('closes filter drawer when nav drawer is opened', () => {
      render(
        <MobileUIProvider>
          <TestConsumer />
        </MobileUIProvider>
      );

      // Open filter first
      fireEvent.click(screen.getByTestId('open-filter'));
      expect(screen.getByTestId('filter-state')).toHaveTextContent('open');

      // Open nav - should close filter
      fireEvent.click(screen.getByTestId('open-nav'));
      expect(screen.getByTestId('filter-state')).toHaveTextContent('closed');
      expect(screen.getByTestId('nav-state')).toHaveTextContent('open');
    });

    it('closes nav drawer when search is opened', () => {
      render(
        <MobileUIProvider>
          <TestConsumer />
        </MobileUIProvider>
      );

      // Open nav first
      fireEvent.click(screen.getByTestId('open-nav'));
      expect(screen.getByTestId('nav-state')).toHaveTextContent('open');

      // Open search - should close nav
      fireEvent.click(screen.getByTestId('open-search'));
      expect(screen.getByTestId('nav-state')).toHaveTextContent('closed');
      expect(screen.getByTestId('search-state')).toHaveTextContent('open');
    });

    it('closes search when filter drawer is opened', () => {
      render(
        <MobileUIProvider>
          <TestConsumer />
        </MobileUIProvider>
      );

      // Open search first
      fireEvent.click(screen.getByTestId('open-search'));
      expect(screen.getByTestId('search-state')).toHaveTextContent('open');

      // Open filter - should close search
      fireEvent.click(screen.getByTestId('open-filter'));
      expect(screen.getByTestId('search-state')).toHaveTextContent('closed');
      expect(screen.getByTestId('filter-state')).toHaveTextContent('open');
    });
  });

  it('closes all drawers when closeAll is called', () => {
    render(
      <MobileUIProvider>
        <TestConsumer />
      </MobileUIProvider>
    );

    // Open filter
    fireEvent.click(screen.getByTestId('open-filter'));
    expect(screen.getByTestId('filter-state')).toHaveTextContent('open');

    // Close all
    fireEvent.click(screen.getByTestId('close-all'));
    expect(screen.getByTestId('filter-state')).toHaveTextContent('closed');
    expect(screen.getByTestId('nav-state')).toHaveTextContent('closed');
    expect(screen.getByTestId('search-state')).toHaveTextContent('closed');
  });

  it('throws error when useMobileUI is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useMobileUI must be used within a MobileUIProvider');

    consoleSpy.mockRestore();
  });
});
