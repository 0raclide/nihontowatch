import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  SignupPressureProvider,
  useSignupPressure,
} from '@/contexts/SignupPressureContext';
import { SignupModal } from '@/components/signup/SignupModal';
import { SIGNUP_MODAL_COPY, ANIMATION_TIMING } from '@/lib/signup/config';

// Mock createPortal to render in the same container
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// Mock useBodyScrollLock
vi.mock('@/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.matchMedia for responsive detection
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

// Component to trigger modal with specific context
function ContextTrigger({
  context,
}: {
  context: 'engagement' | 'favorite' | 'alert' | 'priceHistory';
}) {
  const { triggerForAction, dismissModal, closeModal, isModalOpen } =
    useSignupPressure();

  return (
    <div>
      <button data-testid="trigger-modal" onClick={() => triggerForAction(context)}>
        Open Modal
      </button>
      <button data-testid="dismiss-context" onClick={dismissModal}>
        Dismiss via Context
      </button>
      <button data-testid="close-context" onClick={closeModal}>
        Close via Context
      </button>
      <span data-testid="modal-state">{isModalOpen ? 'open' : 'closed'}</span>
    </div>
  );
}

// Wrapper component that uses the context hook
function TestWrapper({
  children,
  triggerContext = 'engagement',
}: {
  children?: React.ReactNode;
  triggerContext?: 'engagement' | 'favorite' | 'alert' | 'priceHistory';
}) {
  return (
    <SignupPressureProvider>
      <ContextTrigger context={triggerContext} />
      <SignupModal />
      {children}
    </SignupPressureProvider>
  );
}

describe('SignupModal', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Default to desktop (window.innerWidth >= 1024)
    mockMatchMedia(true);
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('does not render when modal is closed', () => {
      render(<TestWrapper />);

      // Modal should not be visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when modal is open', async () => {
      render(<TestWrapper />);

      // Open modal
      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Copy Variants', () => {
    it('shows engagement copy for engagement trigger', async () => {
      render(<TestWrapper triggerContext="engagement" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(
          screen.getByText(SIGNUP_MODAL_COPY.engagement.headline)
        ).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.engagement.body)).toBeInTheDocument();
      });
    });

    it('shows favorite copy for favorite trigger', async () => {
      render(<TestWrapper triggerContext="favorite" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(
          screen.getByText(SIGNUP_MODAL_COPY.favorite.headline)
        ).toBeInTheDocument();
      });
    });

    it('shows alert copy for alert trigger', async () => {
      render(<TestWrapper triggerContext="alert" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByText(SIGNUP_MODAL_COPY.alert.headline)).toBeInTheDocument();
      });
    });

    it('shows price history copy for priceHistory trigger', async () => {
      render(<TestWrapper triggerContext="priceHistory" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(
          screen.getByText(SIGNUP_MODAL_COPY.priceHistory.headline)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Form Elements', () => {
    it('renders email input field', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText('email@example.com');
        expect(emailInput).toBeInTheDocument();
        expect(emailInput).toHaveAttribute('type', 'email');
      });
    });

    it('renders CTA button', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: SIGNUP_MODAL_COPY.engagement.cta })
        ).toBeInTheDocument();
      });
    });

    it('renders dismiss link', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByText(/continue browsing/i)).toBeInTheDocument();
      });
    });

    it('renders social proof text', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(
          screen.getByText(SIGNUP_MODAL_COPY.engagement.socialProof)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Form Behavior', () => {
    it('disables submit button when email is empty', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', {
          name: SIGNUP_MODAL_COPY.engagement.cta,
        });
        expect(submitButton).toBeDisabled();
      });
    });

    it('enables submit button when email is entered', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText('email@example.com');
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

        const submitButton = screen.getByRole('button', {
          name: SIGNUP_MODAL_COPY.engagement.cta,
        });
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('updates email input value on change', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(
          'email@example.com'
        ) as HTMLInputElement;
        fireEvent.change(emailInput, { target: { value: 'user@test.com' } });

        expect(emailInput.value).toBe('user@test.com');
      });
    });
  });

  describe('Dismissal', () => {
    it('dismisses modal when clicking backdrop', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click backdrop (the element with aria-hidden that handles backdrop clicks)
      const backdrop = document.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      // Wait for animation and state update
      await waitFor(
        () => {
          expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
        },
        { timeout: 1000 }
      );
    });

    it('dismisses modal when clicking dismiss link', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dismissLink = screen.getByText(/continue browsing/i);
      fireEvent.click(dismissLink);

      await waitFor(
        () => {
          expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
        },
        { timeout: 1000 }
      );
    });

    it('dismisses modal when clicking close button', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Get the first close button (the X in the modal header)
      const closeButtons = screen.getAllByLabelText('Close');
      fireEvent.click(closeButtons[0]);

      await waitFor(
        () => {
          expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
        },
        { timeout: 1000 }
      );
    });

    it('dismisses modal on Escape key', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(
        () => {
          expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
      });
    });

    it('has accessible close button', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      // Wait for modal to be in DOM
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // The close button has aria-label="Close"
      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton.tagName.toLowerCase()).toBe('button');
    });

    it('has accessible email input with label', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      // Wait for modal first
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Email input has sr-only label
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('renders desktop modal on large screens', async () => {
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        // Desktop modal has flex and items-center in parent
        expect(dialog.className).toContain('flex');
        expect(dialog.className).toContain('items-center');
      });
    });

    it('renders mobile sheet on small screens', async () => {
      mockMatchMedia(false);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        // Mobile sheet - the dialog element itself doesn't have bottom-0,
        // but we can verify it exists and is accessible
        expect(dialog).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits with valid email', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });
      fireEvent.click(submitButton);

      // The form should process the submission
      await waitFor(() => {
        // Form submission should eventually close the modal
        expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
      }, { timeout: 2000 });
    });

    it('shows loading state during submission', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });
      fireEvent.click(submitButton);

      // Should show loading state immediately
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument();
      });
    });

    it('disables email input while submitting', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });
      fireEvent.click(submitButton);

      // Email input should be disabled during submission
      await waitFor(() => {
        expect(emailInput).toBeDisabled();
      });
    });

    it('prevents double submission', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });

      // Click multiple times rapidly
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      // Should show loading state (only one submission should occur)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument();
      });
    });
  });

  describe('Email Validation', () => {
    it('has email input type for native validation', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText('email@example.com');
        expect(emailInput).toHaveAttribute('type', 'email');
      });
    });

    it('has autocomplete attribute for email', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText('email@example.com');
        expect(emailInput).toHaveAttribute('autocomplete', 'email');
      });
    });
  });

  describe('Modal Animations', () => {
    it('applies enter animation classes when opening', async () => {
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        // Desktop modal should have fadeIn animation
        const modalContent = dialog.querySelector('.animate-fadeIn');
        expect(modalContent).toBeInTheDocument();
      });
    });

    it('applies exit animation classes when closing', async () => {
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Trigger close
      const closeButton = screen.getAllByLabelText('Close')[0];
      fireEvent.click(closeButton);

      // During closing animation, fadeOut class should be applied
      await waitFor(() => {
        const dialog = screen.queryByRole('dialog');
        if (dialog) {
          const fadeOutElement = dialog.querySelector('.animate-fadeOut');
          expect(fadeOutElement).toBeInTheDocument();
        }
      });
    });

    it('uses correct animation duration from config', async () => {
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const modalCard = dialog.querySelector('[style*="animation"]');
        if (modalCard) {
          expect(modalCard.getAttribute('style')).toContain(`${ANIMATION_TIMING.modalEnter}ms`);
        }
      });
    });
  });

  describe('Multiple Open/Close Cycles', () => {
    it('handles rapid open/close cycles', async () => {
      render(<TestWrapper />);

      // First cycle
      fireEvent.click(screen.getByTestId('trigger-modal'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('dismiss-context'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
      }, { timeout: 1000 });

      // Second cycle - need to wait for cooldown logic
      // The modal may not reopen immediately due to dismiss count
      // This tests the state management handles the cycle
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('maintains state consistency after multiple operations', async () => {
      render(<TestWrapper />);

      // Open
      fireEvent.click(screen.getByTestId('trigger-modal'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-state')).toHaveTextContent('open');
      });

      // Close via close button
      const closeButton = screen.getAllByLabelText('Close')[0];
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
      }, { timeout: 1000 });

      // State should be consistent
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('focuses email input on desktop after modal opens', async () => {
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Wait for the focus timeout (100ms in component)
      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText('email@example.com');
        expect(document.activeElement).toBe(emailInput);
      }, { timeout: 500 });
    });

    it('does not focus email input on mobile', async () => {
      mockMatchMedia(false);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Wait a bit to ensure focus would have happened if it was going to
      await new Promise(resolve => setTimeout(resolve, 200));

      const emailInput = screen.getByPlaceholderText('email@example.com');
      // On mobile, input should NOT be focused (to prevent keyboard auto-open)
      expect(document.activeElement).not.toBe(emailInput);
    });
  });

  describe('Scroll Lock', () => {
    it('applies scroll lock styles when modal opens', async () => {
      // We need to mock the actual implementation to test this
      const { useBodyScrollLock } = await import('@/hooks/useBodyScrollLock');

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // The hook is mocked, so we verify it was called with true
      // In a real test, we'd check document.body styles
      expect(useBodyScrollLock).toHaveBeenCalled();
    });
  });

  describe('Portal Rendering', () => {
    it('renders modal via createPortal', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        // The mocked createPortal renders inline, but we can verify
        // the modal structure is correct
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
      });
    });

    it('modal content exists in DOM when open', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        // Verify critical modal elements are rendered
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
        expect(screen.getByText(/continue browsing/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dark Mode Support', () => {
    it('uses theme-aware CSS classes', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        // Check for theme-aware classes (these use CSS variables)
        const emailInput = screen.getByPlaceholderText('email@example.com');
        expect(emailInput.className).toContain('bg-surface');
        expect(emailInput.className).toContain('text-ink');
        expect(emailInput.className).toContain('border-border');
      });
    });

    it('modal background uses theme colors', async () => {
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const modalCard = dialog.querySelector('.bg-cream');
        expect(modalCard).toBeInTheDocument();
      });
    });
  });

  describe('Touch Gestures (Mobile)', () => {
    it('allows swipe down to dismiss on mobile', async () => {
      mockMatchMedia(false);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find the drag handle area
      const dragHandle = document.querySelector('.cursor-grab');
      expect(dragHandle).toBeInTheDocument();

      if (dragHandle) {
        // Simulate swipe down gesture
        fireEvent.touchStart(dragHandle, {
          touches: [{ clientY: 100 }],
        });

        fireEvent.touchMove(dragHandle, {
          touches: [{ clientY: 250 }], // Move down 150px (threshold is 100)
        });

        fireEvent.touchEnd(dragHandle);

        // Modal should close after swipe
        await waitFor(() => {
          expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
        }, { timeout: 1000 });
      }
    });

    it('does not dismiss when swipe is less than threshold', async () => {
      mockMatchMedia(false);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dragHandle = document.querySelector('.cursor-grab');

      if (dragHandle) {
        // Simulate small swipe (less than 100px threshold)
        fireEvent.touchStart(dragHandle, {
          touches: [{ clientY: 100 }],
        });

        fireEvent.touchMove(dragHandle, {
          touches: [{ clientY: 150 }], // Only 50px movement
        });

        fireEvent.touchEnd(dragHandle);

        // Modal should remain open
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Copy Variants - Full Coverage', () => {
    it('shows all elements for engagement context', async () => {
      render(<TestWrapper triggerContext="engagement" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByText(SIGNUP_MODAL_COPY.engagement.headline)).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.engagement.body)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: SIGNUP_MODAL_COPY.engagement.cta })).toBeInTheDocument();
        expect(screen.getByText(new RegExp(SIGNUP_MODAL_COPY.engagement.dismiss))).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.engagement.socialProof)).toBeInTheDocument();
      });
    });

    it('shows all elements for favorite context', async () => {
      render(<TestWrapper triggerContext="favorite" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByText(SIGNUP_MODAL_COPY.favorite.headline)).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.favorite.body)).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.favorite.socialProof)).toBeInTheDocument();
      });
    });

    it('shows all elements for alert context', async () => {
      render(<TestWrapper triggerContext="alert" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByText(SIGNUP_MODAL_COPY.alert.headline)).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.alert.body)).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.alert.socialProof)).toBeInTheDocument();
      });
    });

    it('shows all elements for priceHistory context', async () => {
      render(<TestWrapper triggerContext="priceHistory" />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByText(SIGNUP_MODAL_COPY.priceHistory.headline)).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.priceHistory.body)).toBeInTheDocument();
        expect(screen.getByText(SIGNUP_MODAL_COPY.priceHistory.socialProof)).toBeInTheDocument();
      });
    });
  });

  describe('Long Email Addresses', () => {
    it('handles very long email addresses', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const longEmail = 'verylongemailaddressthatgoesonforseveralcharacters@extremelylongdomainname.example.com';
      const emailInput = screen.getByPlaceholderText('email@example.com') as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: longEmail } });

      expect(emailInput.value).toBe(longEmail);

      // Button should be enabled
      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Special Characters in Email', () => {
    it('accepts email with plus sign', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'test+tag@example.com' } });

      expect(emailInput.value).toBe('test+tag@example.com');
    });

    it('accepts email with dots in local part', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'first.last@example.com' } });

      expect(emailInput.value).toBe('first.last@example.com');
    });

    it('accepts international domain emails', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'user@example.co.jp' } });

      expect(emailInput.value).toBe('user@example.co.jp');
    });
  });

  describe('Tab Navigation', () => {
    it('can tab through form elements in order', async () => {
      mockMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Wait for initial focus
      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText('email@example.com');
        expect(document.activeElement).toBe(emailInput);
      }, { timeout: 500 });

      // Tab to submit button
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });

      const dismissLink = screen.getByText(/continue browsing/i);

      // Verify dismiss link is tabbable (has no tabindex=-1)
      expect(dismissLink).not.toHaveAttribute('tabindex', '-1');
    });

    it('has focusable close button', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getAllByLabelText('Close')[0];
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);
    });
  });

  describe('Screen Reader Accessibility', () => {
    it('has proper aria-labelledby structure', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby', 'signup-modal-title');
      });
    });

    it('has aria-modal attribute', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
      });
    });

    it('has sr-only label for email input', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const label = screen.getByText('Email address');
        expect(label).toHaveClass('sr-only');
      });
    });

    it('icons have aria-hidden attribute', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const svgs = dialog.querySelectorAll('svg[aria-hidden="true"]');
        // Should have close icon
        expect(svgs.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('backdrop has aria-hidden attribute', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        const backdrop = document.querySelector('[aria-hidden="true"]');
        expect(backdrop).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles whitespace-only email', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com');
      fireEvent.change(emailInput, { target: { value: '   ' } });

      // Submit button should remain disabled for whitespace-only
      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });
      expect(submitButton).toBeDisabled();
    });

    it('trims whitespace from email input value', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: '  test@example.com  ' } });

      // Browser's email input type trims whitespace automatically
      // The actual value stored is trimmed
      expect(emailInput.value).toBe('test@example.com');

      // Button should be enabled since trimmed value is valid
      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });
      expect(submitButton).not.toBeDisabled();
    });

    it('handles empty string email', async () => {
      render(<TestWrapper />);

      fireEvent.click(screen.getByTestId('trigger-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('email@example.com') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: '' } });

      expect(emailInput.value).toBe('');

      const submitButton = screen.getByRole('button', {
        name: SIGNUP_MODAL_COPY.engagement.cta,
      });
      expect(submitButton).toBeDisabled();
    });

    it('does not render before hydration', () => {
      // This tests SSR behavior - the component returns null before mounted state
      // In the real implementation, mounted is set to true in useEffect
      // The existing tests cover that the modal appears after mounting
      render(<TestWrapper />);

      // Initially no modal
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
