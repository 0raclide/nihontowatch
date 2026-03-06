/**
 * DealerCardIndicators Component Tests
 *
 * Tests the card-level intelligence indicators:
 * - Completeness dots rendering
 * - Heat dot colors matching trend
 * - Interested collector count visibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealerCardIndicators } from '@/components/dealer/DealerCardIndicators';

vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    setLocale: () => {},
    t: (key: string) => {
      const map: Record<string, string> = {
        'dealer.intel.hot': 'Hot',
        'dealer.intel.warm': 'Active',
        'dealer.intel.cool': 'Quiet',
      };
      return map[key] || key;
    },
  }),
}));

describe('DealerCardIndicators', () => {
  it('returns null when no completeness prop', () => {
    const { container } = render(<DealerCardIndicators />);
    expect(container.innerHTML).toBe('');
  });

  it('renders completeness dots with correct count', () => {
    const { container } = render(
      <DealerCardIndicators completeness={{ score: 4, total: 6 }} />
    );
    // Should show "4/6" text
    expect(container.textContent).toContain('4/6');
    // Should have 6 dot spans
    const dots = container.querySelectorAll('span.inline-block.rounded-full');
    expect(dots).toHaveLength(6);
  });

  it('renders gold dots for filled, border dots for unfilled', () => {
    const { container } = render(
      <DealerCardIndicators completeness={{ score: 3, total: 6 }} />
    );
    const dots = container.querySelectorAll('span.inline-block.rounded-full');
    const goldDots = Array.from(dots).filter(d => d.className.includes('bg-gold'));
    const borderDots = Array.from(dots).filter(d => d.className.includes('border'));
    expect(goldDots).toHaveLength(3);
    expect(borderDots).toHaveLength(3);
  });

  it('shows heat dot with correct label for hot', () => {
    render(
      <DealerCardIndicators
        completeness={{ score: 5, total: 6 }}
        heatTrend="hot"
      />
    );
    expect(screen.getByText('Hot')).toBeTruthy();
  });

  it('shows heat dot with correct label for warm', () => {
    render(
      <DealerCardIndicators
        completeness={{ score: 5, total: 6 }}
        heatTrend="warm"
      />
    );
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('shows heat dot with correct label for cool', () => {
    render(
      <DealerCardIndicators
        completeness={{ score: 5, total: 6 }}
        heatTrend="cool"
      />
    );
    expect(screen.getByText('Quiet')).toBeTruthy();
  });

  it('hides heat dot when no heatTrend', () => {
    render(
      <DealerCardIndicators completeness={{ score: 5, total: 6 }} />
    );
    expect(screen.queryByText('Hot')).toBeNull();
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.queryByText('Quiet')).toBeNull();
  });

  it('shows interested collector count when > 0', () => {
    const { container } = render(
      <DealerCardIndicators
        completeness={{ score: 5, total: 6 }}
        interestedCollectors={12}
      />
    );
    expect(container.textContent).toContain('12');
    // Should have a bell icon (SVG)
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('hides interested count when 0', () => {
    const { container } = render(
      <DealerCardIndicators
        completeness={{ score: 5, total: 6 }}
        interestedCollectors={0}
      />
    );
    // Should NOT contain a bell SVG for interested (only dots and heat)
    const bellPaths = container.querySelectorAll('svg path');
    // Bell icon has a specific path — with 0 collectors, no bell SVG
    expect(container.textContent).not.toContain('0');
  });

  it('hides interested count when undefined', () => {
    const { container } = render(
      <DealerCardIndicators
        completeness={{ score: 3, total: 6 }}
      />
    );
    // No bell icon
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows position indicator with rank-colored number', () => {
    const { container } = render(
      <DealerCardIndicators
        completeness={{ score: 5, total: 6 }}
        estimatedPosition={42}
        totalListings={3200}
        rankBucket="top25"
      />
    );
    expect(screen.getByTestId('position-indicator')).toBeTruthy();
    expect(container.textContent).toContain('#42');
    expect(container.textContent).toContain('3,200');
  });

  it('hides position indicator when totalListings is 0', () => {
    render(
      <DealerCardIndicators
        completeness={{ score: 5, total: 6 }}
        estimatedPosition={1}
        totalListings={0}
      />
    );
    expect(screen.queryByTestId('position-indicator')).toBeNull();
  });
});
