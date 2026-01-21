/**
 * SetsumeiZufuBadge Component Tests
 *
 * CRITICAL: This badge replaced CatalogEnrichedBadge.
 * Tests ensure the badge displays correctly for OCR setsumei items.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SetsumeiZufuBadge } from '@/components/ui/SetsumeiZufuBadge';

describe('SetsumeiZufuBadge Component', () => {
  describe('Rendering', () => {
    it('renders with correct text in default mode', () => {
      render(<SetsumeiZufuBadge />);

      expect(screen.getByText('NBTHK Zufu')).toBeInTheDocument();
    });

    it('renders with correct text in compact mode', () => {
      render(<SetsumeiZufuBadge compact />);

      expect(screen.getByText('Zufu')).toBeInTheDocument();
    });

    it('has correct data-testid', () => {
      render(<SetsumeiZufuBadge />);

      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
    });

    it('has correct data-testid in compact mode', () => {
      render(<SetsumeiZufuBadge compact />);

      expect(screen.getByTestId('setsumei-zufu-badge')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('has gold styling classes', () => {
      render(<SetsumeiZufuBadge />);

      const badge = screen.getByTestId('setsumei-zufu-badge');
      expect(badge.className).toContain('text-gold');
      expect(badge.className).toContain('bg-gold/15');
      expect(badge.className).toContain('border-gold/30');
    });

    it('has uppercase tracking in both modes', () => {
      const { rerender } = render(<SetsumeiZufuBadge />);
      let badge = screen.getByTestId('setsumei-zufu-badge');
      expect(badge.className).toContain('uppercase');
      expect(badge.className).toContain('tracking-wider');

      rerender(<SetsumeiZufuBadge compact />);
      badge = screen.getByTestId('setsumei-zufu-badge');
      expect(badge.className).toContain('uppercase');
      expect(badge.className).toContain('tracking-wider');
    });
  });

  describe('Accessibility', () => {
    it('has descriptive title attribute', () => {
      render(<SetsumeiZufuBadge />);

      const badge = screen.getByTestId('setsumei-zufu-badge');
      expect(badge).toHaveAttribute('title', 'Official NBTHK evaluation translated');
    });

    it('contains document icon with aria-hidden', () => {
      render(<SetsumeiZufuBadge />);

      const icon = screen.getByTestId('setsumei-zufu-badge').querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<SetsumeiZufuBadge className="custom-class" />);

      const badge = screen.getByTestId('setsumei-zufu-badge');
      expect(badge.className).toContain('custom-class');
    });
  });
});

describe('Badge Text Regression', () => {
  /**
   * CRITICAL: These tests catch if someone changes the badge text.
   * The text "NBTHK Zufu" was specifically chosen to replace "Catalog Enriched".
   */

  it('MUST display "NBTHK Zufu" not "Catalog Enriched"', () => {
    render(<SetsumeiZufuBadge />);

    expect(screen.getByText('NBTHK Zufu')).toBeInTheDocument();
    expect(screen.queryByText('Catalog Enriched')).not.toBeInTheDocument();
    expect(screen.queryByText('Catalog')).not.toBeInTheDocument();
  });

  it('MUST display "Zufu" in compact mode not "Catalog"', () => {
    render(<SetsumeiZufuBadge compact />);

    expect(screen.getByText('Zufu')).toBeInTheDocument();
    expect(screen.queryByText('Catalog')).not.toBeInTheDocument();
  });
});
