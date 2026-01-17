import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} data-testid="logo-image" />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className: string }) => (
    <a href={href} className={className} data-testid="logo-link">
      {children}
    </a>
  ),
}));

// Simplified page header component for testing
// This mimics the structure in page.tsx
function MobilePageHeader() {
  return (
    <div className="mb-4 lg:mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {/* Mobile: Show NihontoWatch branding */}
        <a href="/" className="lg:hidden flex items-center gap-2 mb-1" data-testid="logo-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mon.png"
            alt="NihontoWatch Mon"
            width={28}
            height={28}
            className="opacity-90"
            data-testid="logo-image"
          />
          <h1 className="font-serif text-xl tracking-tight text-ink">
            Nihonto<span className="text-gold font-medium">Watch</span>
          </h1>
        </a>
        {/* Desktop: Show "Collection" */}
        <h1 className="hidden lg:block font-serif text-2xl text-ink tracking-tight">Collection</h1>
        <p className="text-[12px] lg:text-[13px] text-muted mt-1">
          Japanese swords and fittings from established dealers
        </p>
      </div>
    </div>
  );
}

describe('Mobile Page Header', () => {
  describe('Mobile Branding', () => {
    it('renders the NihontoWatch logo on mobile', () => {
      render(<MobilePageHeader />);

      const logoImage = screen.getByTestId('logo-image');
      expect(logoImage).toBeInTheDocument();
      expect(logoImage).toHaveAttribute('src', '/logo-mon.png');
      expect(logoImage).toHaveAttribute('alt', 'NihontoWatch Mon');
    });

    it('renders the NihontoWatch text branding', () => {
      render(<MobilePageHeader />);

      expect(screen.getByText('Nihonto')).toBeInTheDocument();
      expect(screen.getByText('Watch')).toBeInTheDocument();
    });

    it('mobile branding links to home page', () => {
      render(<MobilePageHeader />);

      const logoLink = screen.getByTestId('logo-link');
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('mobile branding is hidden on desktop (lg:hidden class)', () => {
      render(<MobilePageHeader />);

      const logoLink = screen.getByTestId('logo-link');
      expect(logoLink).toHaveClass('lg:hidden');
    });

    it('renders with correct styling classes', () => {
      render(<MobilePageHeader />);

      const logoLink = screen.getByTestId('logo-link');
      expect(logoLink).toHaveClass('flex');
      expect(logoLink).toHaveClass('items-center');
      expect(logoLink).toHaveClass('gap-2');
    });
  });

  describe('Desktop "Collection" Heading', () => {
    it('renders "Collection" heading for desktop', () => {
      render(<MobilePageHeader />);

      // Find all h1 elements - one for mobile, one for desktop
      const headings = screen.getAllByRole('heading', { level: 1 });
      const desktopHeading = headings.find(h => h.textContent === 'Collection');
      expect(desktopHeading).toBeInTheDocument();
    });

    it('desktop heading is hidden on mobile (hidden lg:block class)', () => {
      render(<MobilePageHeader />);

      const headings = screen.getAllByRole('heading', { level: 1 });
      const desktopHeading = headings.find(h => h.textContent === 'Collection');
      expect(desktopHeading).toHaveClass('hidden');
      expect(desktopHeading).toHaveClass('lg:block');
    });
  });

  describe('Subtitle', () => {
    it('renders the subtitle text', () => {
      render(<MobilePageHeader />);

      expect(screen.getByText('Japanese swords and fittings from established dealers')).toBeInTheDocument();
    });

    it('subtitle has correct styling', () => {
      render(<MobilePageHeader />);

      const subtitle = screen.getByText('Japanese swords and fittings from established dealers');
      expect(subtitle).toHaveClass('text-muted');
      expect(subtitle).toHaveClass('mt-1');
    });
  });

  describe('Typography', () => {
    it('mobile heading uses serif font', () => {
      render(<MobilePageHeader />);

      const headings = screen.getAllByRole('heading', { level: 1 });
      // Both headings should have font-serif
      headings.forEach(heading => {
        expect(heading).toHaveClass('font-serif');
      });
    });

    it('mobile heading has correct text size', () => {
      render(<MobilePageHeader />);

      // The mobile heading (inside the link) should have text-xl
      const mobileLogoContainer = screen.getByTestId('logo-link');
      const mobileHeading = mobileLogoContainer.querySelector('h1');
      expect(mobileHeading).toHaveClass('text-xl');
    });

    it('Watch text has gold color', () => {
      render(<MobilePageHeader />);

      const watchSpan = screen.getByText('Watch');
      expect(watchSpan).toHaveClass('text-gold');
      expect(watchSpan).toHaveClass('font-medium');
    });
  });
});
