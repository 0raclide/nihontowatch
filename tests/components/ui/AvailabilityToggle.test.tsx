import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityToggle } from '@/components/ui/AvailabilityToggle';

describe('AvailabilityToggle Component', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Rendering', () => {
    it('renders all three options', () => {
      render(<AvailabilityToggle value="available" onChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: /for sale/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    });

    it('renders in correct order: For sale, Sold, All', () => {
      render(<AvailabilityToggle value="available" onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('For sale');
      expect(buttons[1]).toHaveTextContent('Sold');
      expect(buttons[2]).toHaveTextContent('All');
    });
  });

  describe('Active State', () => {
    it('shows "For sale" as active when value is "available"', () => {
      render(<AvailabilityToggle value="available" onChange={mockOnChange} />);

      const forSaleButton = screen.getByRole('button', { name: /for sale/i });
      const soldButton = screen.getByRole('button', { name: /sold/i });
      const allButton = screen.getByRole('button', { name: /all/i });

      // Active button should have active styling classes
      expect(forSaleButton.className).toContain('bg-paper');
      expect(forSaleButton.className).toContain('text-ink');
      expect(forSaleButton.className).toContain('shadow-sm');

      // Inactive buttons should have muted styling
      expect(soldButton.className).toContain('text-muted');
      expect(allButton.className).toContain('text-muted');
    });

    it('shows "Sold" as active when value is "sold"', () => {
      render(<AvailabilityToggle value="sold" onChange={mockOnChange} />);

      const forSaleButton = screen.getByRole('button', { name: /for sale/i });
      const soldButton = screen.getByRole('button', { name: /sold/i });
      const allButton = screen.getByRole('button', { name: /all/i });

      expect(soldButton.className).toContain('bg-paper');
      expect(soldButton.className).toContain('text-ink');
      expect(forSaleButton.className).toContain('text-muted');
      expect(allButton.className).toContain('text-muted');
    });

    it('shows "All" as active when value is "all"', () => {
      render(<AvailabilityToggle value="all" onChange={mockOnChange} />);

      const forSaleButton = screen.getByRole('button', { name: /for sale/i });
      const soldButton = screen.getByRole('button', { name: /sold/i });
      const allButton = screen.getByRole('button', { name: /all/i });

      expect(allButton.className).toContain('bg-paper');
      expect(allButton.className).toContain('text-ink');
      expect(forSaleButton.className).toContain('text-muted');
      expect(soldButton.className).toContain('text-muted');
    });
  });

  describe('Interactions', () => {
    it('calls onChange with "available" when "For sale" is clicked', () => {
      render(<AvailabilityToggle value="sold" onChange={mockOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /for sale/i }));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('available');
    });

    it('calls onChange with "sold" when "Sold" is clicked', () => {
      render(<AvailabilityToggle value="available" onChange={mockOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /sold/i }));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('sold');
    });

    it('calls onChange with "all" when "All" is clicked', () => {
      render(<AvailabilityToggle value="available" onChange={mockOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /all/i }));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('all');
    });

    it('calls onChange even when clicking the already active button', () => {
      render(<AvailabilityToggle value="available" onChange={mockOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /for sale/i }));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('available');
    });
  });

  describe('Styling', () => {
    it('has correct container styling (matches CurrencySelector)', () => {
      const { container } = render(
        <AvailabilityToggle value="available" onChange={mockOnChange} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('inline-flex');
      expect(wrapper.className).toContain('items-center');
      expect(wrapper.className).toContain('bg-linen/50');
      expect(wrapper.className).toContain('rounded-sm');
    });

    it('buttons have correct base styling', () => {
      render(<AvailabilityToggle value="available" onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button.className).toContain('px-2.5');
        expect(button.className).toContain('py-1');
        expect(button.className).toContain('text-[10px]');
        expect(button.className).toContain('tracking-wider');
      });
    });
  });
});
