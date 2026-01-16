import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { MobileUIProvider } from '@/contexts/MobileUIContext';

// Mock the child components
vi.mock('@/components/layout/MobileNavDrawer', () => ({
  MobileNavDrawer: () => <div data-testid="mobile-nav-drawer">Nav Drawer</div>,
}));

vi.mock('@/components/layout/MobileSearchSheet', () => ({
  MobileSearchSheet: () => <div data-testid="mobile-search-sheet">Search Sheet</div>,
}));

vi.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

// Mock useMobileUI
const mockOpenSearch = vi.fn();
const mockOpenNavDrawer = vi.fn();

vi.mock('@/contexts/MobileUIContext', async () => {
  const actual = await vi.importActual('@/contexts/MobileUIContext');
  return {
    ...actual,
    useMobileUI: () => ({
      openSearch: mockOpenSearch,
      openNavDrawer: mockOpenNavDrawer,
      filterDrawerOpen: false,
      navDrawerOpen: false,
      searchOpen: false,
    }),
  };
});

describe('Header Component', () => {
  beforeEach(() => {
    mockOpenSearch.mockClear();
    mockOpenNavDrawer.mockClear();
  });

  it('renders the logo', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    // Logo appears in both mobile and desktop versions
    const logos = screen.getAllByText(/Nihonto/);
    expect(logos.length).toBeGreaterThan(0);
  });

  it('renders mobile header with search and menu buttons', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    // Mobile search button
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeInTheDocument();

    // Mobile menu button
    const menuButton = screen.getByRole('button', { name: /menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('renders desktop navigation links', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    // Desktop navigation links
    expect(screen.getByRole('link', { name: /browse/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dealers/i })).toBeInTheDocument();
  });

  it('renders desktop search form', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    // Desktop search input
    expect(screen.getByPlaceholderText(/search collection/i)).toBeInTheDocument();
  });

  it('calls openSearch when mobile search button is clicked', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    expect(mockOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('calls openNavDrawer when mobile menu button is clicked', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);
    expect(mockOpenNavDrawer).toHaveBeenCalledTimes(1);
  });

  it('includes MobileNavDrawer component', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    expect(screen.getByTestId('mobile-nav-drawer')).toBeInTheDocument();
  });

  it('includes MobileSearchSheet component', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    expect(screen.getByTestId('mobile-search-sheet')).toBeInTheDocument();
  });

  it('has sticky positioning', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    const header = document.querySelector('header');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
  });

  it('has responsive padding classes', () => {
    render(
      <MobileUIProvider>
        <Header />
      </MobileUIProvider>
    );

    // Find the container div with responsive padding
    const container = document.querySelector('.px-4.py-3.lg\\:px-6.lg\\:py-5');
    expect(container).toBeInTheDocument();
  });

  describe('Desktop search form', () => {
    it('updates input value on change', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search collection/i);
      fireEvent.change(searchInput, { target: { value: 'katana' } });
      expect(searchInput).toHaveValue('katana');
    });

    it('navigates to search results on form submit', () => {
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as Location;

      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search collection/i);
      fireEvent.change(searchInput, { target: { value: 'katana' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(window.location.href).toBe('/browse?q=katana');

      // Restore
      window.location = originalLocation;
    });

    it('does not navigate on empty search', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' } as Location;

      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search collection/i);
      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(window.location.href).toBe('');

      window.location = originalLocation;
    });
  });

  describe('Mobile layout visibility', () => {
    it('mobile header has lg:hidden class', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Mobile header should have lg:hidden
      const mobileHeader = document.querySelector('.flex.lg\\:hidden.items-center.justify-between');
      expect(mobileHeader).toBeInTheDocument();
    });

    it('desktop header has hidden lg:flex class', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Desktop header should have hidden lg:flex
      const desktopHeader = document.querySelector('.hidden.lg\\:flex.items-center.justify-between');
      expect(desktopHeader).toBeInTheDocument();
    });
  });

  describe('Logo sizing', () => {
    it('mobile logo has text-xl class', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Find mobile logo (inside lg:hidden container)
      const mobileContainer = document.querySelector('.flex.lg\\:hidden');
      const mobileLogo = mobileContainer?.querySelector('h1');
      expect(mobileLogo).toHaveClass('text-xl');
    });

    it('desktop logo has text-2xl class', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Find desktop logo (inside hidden lg:flex container)
      const desktopContainer = document.querySelector('.hidden.lg\\:flex');
      const desktopLogo = desktopContainer?.querySelector('h1');
      expect(desktopLogo).toHaveClass('text-2xl');
    });
  });
});
