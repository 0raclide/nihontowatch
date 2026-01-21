/**
 * CopyButton Component Tests
 *
 * Tests the reusable copy-to-clipboard button with feedback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CopyButton } from '@/components/inquiry/CopyButton';

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockWriteText = vi.fn();

// Setup clipboard mock globally before any tests run
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
    readText: vi.fn(),
  },
  writable: true,
  configurable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteText.mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  // Don't restore mocks - we want clipboard to persist
});

// =============================================================================
// TEST SUITES
// =============================================================================

describe('CopyButton', () => {
  // ===========================================================================
  // RENDERING
  // ===========================================================================

  describe('rendering', () => {
    it('renders with default label', () => {
      render(<CopyButton text="test" />);
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<CopyButton text="test" label="Copy Email" />);
      expect(screen.getByRole('button', { name: /copy email/i })).toBeInTheDocument();
    });

    it('renders with icon only variant', () => {
      render(<CopyButton text="test" variant="icon" />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // COPY FUNCTIONALITY
  // ===========================================================================

  describe('copy functionality', () => {
    it('copies text to clipboard when clicked', async () => {
      render(<CopyButton text="Hello World" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Hello World');
      });
    });

    it('copies multiline text correctly', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      render(<CopyButton text={multilineText} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(multilineText);
      });
    });

    it('copies Japanese text correctly', async () => {
      const japaneseText = '拝啓\n\n敬具';
      render(<CopyButton text={japaneseText} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(japaneseText);
      });
    });
  });

  // ===========================================================================
  // FEEDBACK
  // ===========================================================================

  describe('feedback', () => {
    it('shows copied state after clicking', async () => {
      render(<CopyButton text="test" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });

    it('reverts to initial state after delay', async () => {
      // Use real timers and wait for actual timeout
      render(<CopyButton text="test" />);

      fireEvent.click(screen.getByRole('button'));

      // Verify copied state appears
      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });

      // Wait for the 2000ms reset timeout + buffer
      await waitFor(
        () => {
          expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByText(/copy/i)).toBeInTheDocument();
    });

    it('calls onCopy callback when provided', async () => {
      const onCopy = vi.fn();
      render(<CopyButton text="test" onCopy={onCopy} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('handles clipboard failure gracefully', async () => {
      // Create a mock that rejects
      const rejectingMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: rejectingMock },
        writable: true,
        configurable: true,
      });

      render(<CopyButton text="test" />);

      // Should not throw
      fireEvent.click(screen.getByRole('button'));

      // Wait a bit for the async operation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Button should still exist and be clickable (component didn't crash)
      expect(screen.getByRole('button')).toBeInTheDocument();

      // Reset the mock for other tests
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });
    });

    it('calls onError callback on failure', async () => {
      const rejectingMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: rejectingMock },
        writable: true,
        configurable: true,
      });

      const onError = vi.fn();
      render(<CopyButton text="test" onError={onError} />);

      fireEvent.click(screen.getByRole('button'));

      // Wait for the rejection to be handled
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onError).toHaveBeenCalled();

      // Reset the mock for other tests
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });
    });
  });

  // ===========================================================================
  // STYLING
  // ===========================================================================

  describe('styling', () => {
    it('applies custom className', () => {
      render(<CopyButton text="test" className="custom-class" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('applies size variants', () => {
      const { rerender } = render(<CopyButton text="test" size="sm" />);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<CopyButton text="test" size="md" />);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<CopyButton text="test" size="lg" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // DISABLED STATE
  // ===========================================================================

  describe('disabled state', () => {
    it('does not copy when disabled', () => {
      render(<CopyButton text="test" disabled />);

      fireEvent.click(screen.getByRole('button'));

      // Since the button is disabled, writeText should not be called
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    it('shows disabled styling', () => {
      render(<CopyButton text="test" disabled />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  // ===========================================================================
  // ACCESSIBILITY
  // ===========================================================================

  describe('accessibility', () => {
    it('has accessible name', () => {
      render(<CopyButton text="test" />);
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('has aria-label for icon-only variant', () => {
      render(<CopyButton text="test" variant="icon" ariaLabel="Copy to clipboard" />);
      expect(screen.getByLabelText(/copy to clipboard/i)).toBeInTheDocument();
    });

    it('announces copy success to screen readers', async () => {
      render(<CopyButton text="test" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        // Check for aria-live announcement or similar
        const button = screen.getByRole('button');
        expect(button).toHaveTextContent(/copied/i);
      });
    });
  });
});
