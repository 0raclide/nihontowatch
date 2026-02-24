/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { MobileUIProvider } from '@/contexts/MobileUIContext';

// Mock window.matchMedia for scroll-linked header behavior
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} data-testid="next-image" />
  ),
}));

// Mock router with trackable push
const mockPush = vi.fn();
let mockPathname = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
    getAll: () => [],
    has: () => false,
    keys: () => [],
    values: () => [],
    entries: () => [],
    toString: () => '',
  }),
  usePathname: () => mockPathname,
}));

// Mock the child components
vi.mock('@/components/layout/MobileNavDrawer', () => ({
  MobileNavDrawer: () => <div data-testid="mobile-nav-drawer">Nav Drawer</div>,
}));

vi.mock('@/components/layout/MobileSearchSheet', () => ({
  MobileSearchSheet: () => <div data-testid="mobile-search-sheet">Search Sheet</div>,
}));

vi.mock('@/components/ui/ThemeSwitcher', () => ({
  ThemeSwitcher: () => <button data-testid="theme-switcher">Theme</button>,
}));

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    isLoading: false,
    isAdmin: false,
  }),
}));

vi.mock('@/components/auth/LoginModal', () => ({
  LoginModal: () => null,
}));

vi.mock('@/components/auth/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

vi.mock('@/components/activity/ActivityProvider', () => ({
  useActivityOptional: () => null,
}));

vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

vi.mock('@/components/ui/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <button data-testid="locale-switcher">EN</button>,
}));

// Mock useLocale — return English so all existing string assertions pass
vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then(m => m.default);
  const t = (key: string, params?: Record<string, string | number>) => {
    let value: string = (en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return {
    useLocale: () => ({ locale: 'en', setLocale: () => {}, t }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock useMobileUI - still needed for context but no longer used for buttons in header
vi.mock('@/contexts/MobileUIContext', async () => {
  const actual = await vi.importActual('@/contexts/MobileUIContext');
  return {
    ...actual,
    useMobileUI: () => ({
      openSearch: vi.fn(),
      openNavDrawer: vi.fn(),
      filterDrawerOpen: false,
      navDrawerOpen: false,
      searchOpen: false,
    }),
  };
});

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockPathname = '/';
  });

  describe('Desktop Header', () => {
    it('renders the logo on desktop', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Logo should be visible on desktop
      const logos = screen.getAllByText(/Nihonto/);
      expect(logos.length).toBeGreaterThan(0);
    });

    it('renders desktop navigation links', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Desktop navigation links
      expect(screen.getByRole('link', { name: /browse/i })).toBeInTheDocument();
    });

    it('renders desktop search form', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Desktop search input
      expect(screen.getByPlaceholderText(/search swords, smiths, dealers/i)).toBeInTheDocument();
    });

    it('updates input value on change', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: 'katana' } });
      expect(searchInput).toHaveValue('katana');
    });

    it('navigates to search results on form submit', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      fireEvent.change(searchInput, { target: { value: 'katana' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(mockPush).toHaveBeenCalledWith('/?q=katana');
    });

    it('does not navigate on empty search', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search swords, smiths, dealers/i);
      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Mobile Header Visibility', () => {
    it('header is hidden on mobile (has hidden lg:block class)', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Header should have hidden lg:block - visible only on desktop
      const header = document.querySelector('header');
      expect(header).toHaveClass('hidden');
      expect(header).toHaveClass('lg:block');
    });

    it('does not render mobile search button in top bar (removed)', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Mobile search and menu buttons should NOT exist in header anymore
      // They are now only in the BottomTabBar component
      const searchButtons = screen.queryAllByRole('button', { name: /search/i });
      // The only search button should be the desktop submit button, not mobile
      searchButtons.forEach(button => {
        // Desktop search button is a submit button in form, not the mobile one
        expect(button.closest('.lg\\:hidden')).toBeNull();
      });
    });

    it('does not render mobile menu button in top bar (removed)', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Mobile menu button should NOT exist in header anymore
      const menuButtons = screen.queryAllByRole('button', { name: /menu/i });
      expect(menuButtons.length).toBe(0);
    });
  });

  describe('Mobile Drawers', () => {
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
  });

  describe('Header Positioning', () => {
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

    it('has correct z-index for layering', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const header = document.querySelector('header');
      expect(header).toHaveClass('z-40');
    });
  });

  describe('Desktop Logo', () => {
    it('desktop logo container has correct classes', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      // Find the logo container - should be in the visible desktop section
      const logoLink = screen.getByRole('link', { name: /nihontowatch mon/i });
      expect(logoLink).toBeInTheDocument();
    });

    it('logo text has serif font', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const logoText = document.querySelector('h1');
      expect(logoText).toHaveClass('font-serif');
    });
  });

  describe('Artist Page Context', () => {
    beforeEach(() => {
      mockPathname = '/artists';
    });

    it('shows artist placeholder on /artists', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      expect(screen.getByPlaceholderText(/search artists by name, kanji, or code/i)).toBeInTheDocument();
    });

    it('shows artist placeholder on /artists/[slug]', () => {
      mockPathname = '/artists/masamune-MAS590';
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      expect(screen.getByPlaceholderText(/search artists by name, kanji, or code/i)).toBeInTheDocument();
    });

    it('dispatches artist-header-search event on form submit', () => {
      const eventSpy = vi.fn();
      window.addEventListener('artist-header-search', eventSpy);

      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const searchInput = screen.getByPlaceholderText(/search artists by name, kanji, or code/i);
      fireEvent.change(searchInput, { target: { value: 'Masamune' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      // Artist page search dispatches a custom event (not router.push)
      // to avoid clobbering the sidebar's replaceState-managed filter state
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect((eventSpy.mock.calls[0][0] as CustomEvent).detail).toEqual({ q: 'Masamune' });
      expect(mockPush).not.toHaveBeenCalled();

      window.removeEventListener('artist-header-search', eventSpy);
    });

    it('form action is /artists on artist pages', () => {
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      const form = screen.getByRole('search');
      expect(form).toHaveAttribute('action', '/artists');
    });

    it('shows default listing placeholder on non-artist pages', () => {
      mockPathname = '/browse';
      render(
        <MobileUIProvider>
          <Header />
        </MobileUIProvider>
      );

      expect(screen.getByPlaceholderText(/search swords, smiths, dealers/i)).toBeInTheDocument();
    });
  });
});
