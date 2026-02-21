/**
 * LoginModal Component Tests
 *
 * Tests the OTP-based login flow including:
 * - Email submission
 * - OTP code entry and auto-submit
 * - Error handling
 * - Modal state management
 * - Router refresh after successful login (critical for UI update)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

// Hoist mock functions for better test isolation
const { mockSignInWithEmail, mockVerifyOtp, mockSignInWithPassword, mockRouterRefresh, mockRouterPush } = vi.hoisted(() => ({
  mockSignInWithEmail: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockRouterRefresh: vi.fn(),
  mockRouterPush: vi.fn(),
}));

// Mock useAuth hook
vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    signInWithEmail: mockSignInWithEmail,
    verifyOtp: mockVerifyOtp,
    signInWithPassword: mockSignInWithPassword,
  }),
}));

// Mock useRouter from next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: mockRouterPush,
  }),
}));

import { LoginModal } from '@/components/auth/LoginModal';

// Mock useBodyScrollLock hook
vi.mock('@/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

describe('LoginModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithEmail.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  describe('Email Step', () => {
    it('renders email input when modal is open', () => {
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
      expect(screen.getByText('Continue with Email')).toBeInTheDocument();
    });

    it('does not render when modal is closed', () => {
      render(<LoginModal isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByText('Welcome')).not.toBeInTheDocument();
    });

    it('submits email and transitions to OTP step', async () => {
      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByText('Continue with Email');
      await user.click(submitButton);

      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com');

      // Wait for success message and transition
      await waitFor(() => {
        expect(screen.getByText('Code sent! Check your email.')).toBeInTheDocument();
      });
    });

    it('displays error when email submission fails', async () => {
      mockSignInWithEmail.mockResolvedValue({
        error: { message: 'Invalid email' }
      });

      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      const emailInput = screen.getByPlaceholderText('your@email.com');
      // Use valid email format to pass HTML5 validation, server returns error
      await user.type(emailInput, 'invalid@test.com');

      const submitButton = screen.getByText('Continue with Email');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
      });
    });
  });

  describe('OTP Step', () => {
    async function goToOtpStep() {
      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');
      await user.click(screen.getByText('Continue with Email'));

      // Wait for transition to OTP step
      await waitFor(() => {
        expect(screen.getByText('Enter Code')).toBeInTheDocument();
      }, { timeout: 2000 });

      return user;
    }

    it('shows OTP input fields after email submission', async () => {
      await goToOtpStep();

      expect(screen.getByText('We sent a code to test@example.com')).toBeInTheDocument();
      expect(screen.getByText('6-Digit Code')).toBeInTheDocument();

      // Should have 6 input fields
      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(6);
    });

    it('auto-advances focus when typing digits', async () => {
      const user = await goToOtpStep();

      const inputs = screen.getAllByRole('textbox');

      await user.type(inputs[0], '1');
      expect(document.activeElement).toBe(inputs[1]);

      await user.type(inputs[1], '2');
      expect(document.activeElement).toBe(inputs[2]);
    });

    it('auto-submits when all 6 digits are entered', async () => {
      const user = await goToOtpStep();

      const inputs = screen.getAllByRole('textbox');

      // Type all 6 digits
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(mockVerifyOtp).toHaveBeenCalledWith('test@example.com', '123456');
      });
    });

    it('handles paste of full OTP code', async () => {
      const user = await goToOtpStep();

      const inputs = screen.getAllByRole('textbox');

      // Paste full code into first input
      await user.click(inputs[0]);
      await user.paste('654321');

      await waitFor(() => {
        expect(mockVerifyOtp).toHaveBeenCalledWith('test@example.com', '654321');
      });
    });

    it('displays error when OTP verification fails', async () => {
      mockVerifyOtp.mockResolvedValue({
        error: { message: 'Invalid code' }
      });

      const user = await goToOtpStep();

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '0');
      }

      await waitFor(() => {
        expect(screen.getByText('Invalid code')).toBeInTheDocument();
      });
    });

    it('closes modal on successful verification', async () => {
      const user = await goToOtpStep();

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '1');
      }

      await waitFor(() => {
        expect(screen.getByText('Login successful!')).toBeInTheDocument();
      });

      // Modal closes after 500ms delay
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('allows going back to email step', async () => {
      const user = await goToOtpStep();

      const backButton = screen.getByText('Use a different email');
      await user.click(backButton);

      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });
  });

  describe('Modal Controls', () => {
    it('closes on backdrop click', async () => {
      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      // Find backdrop (the div with bg-black/60 class)
      const backdrop = document.querySelector('.bg-black\\/60');
      if (backdrop) {
        await user.click(backdrop);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('closes on X button click', async () => {
      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes on Escape key', async () => {
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('UI State Update After Login', () => {
    /**
     * CRITICAL: These tests ensure the UI updates after successful login.
     *
     * Previously, there was a bug where the auth state would update correctly
     * but the Header component wouldn't re-render, leaving the "Sign In" button
     * visible even after successful login. The fix was to call router.refresh()
     * after successful authentication.
     *
     * If these tests fail, users will see "Login successful!" but the UI will
     * still show "Sign In" instead of their user menu.
     */

    async function goToOtpStepForRefreshTest() {
      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');
      await user.click(screen.getByText('Continue with Email'));

      await waitFor(() => {
        expect(screen.getByText('Enter Code')).toBeInTheDocument();
      }, { timeout: 2000 });

      return user;
    }

    it('calls router.refresh() after successful OTP verification', async () => {
      const user = await goToOtpStepForRefreshTest();

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '1');
      }

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText('Login successful!')).toBeInTheDocument();
      });

      // Wait for the 500ms delay + router.refresh() call
      await waitFor(() => {
        expect(mockRouterRefresh).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('does NOT call router.refresh() when OTP verification fails', async () => {
      mockVerifyOtp.mockResolvedValue({
        error: { message: 'Invalid code' }
      });

      const user = await goToOtpStepForRefreshTest();

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '0');
      }

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText('Invalid code')).toBeInTheDocument();
      });

      // router.refresh should NOT have been called
      expect(mockRouterRefresh).not.toHaveBeenCalled();
    });

    it('calls router.refresh() after successful password login (test accounts)', async () => {
      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      // Use a .local email to trigger password flow
      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'admin@test.local');
      await user.click(screen.getByText('Continue with Email'));

      // Should transition to password step (not OTP)
      await waitFor(() => {
        expect(screen.getByText('Enter Password')).toBeInTheDocument();
      });

      // Enter password
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      await user.type(passwordInput, 'testpassword123');
      await user.click(screen.getByText('Sign In'));

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText('Login successful!')).toBeInTheDocument();
      });

      // Wait for the 500ms delay + router.refresh() call
      await waitFor(() => {
        expect(mockRouterRefresh).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('does NOT call router.refresh() when password login fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid password' }
      });

      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={mockOnClose} />);

      // Use a .local email to trigger password flow
      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'admin@test.local');
      await user.click(screen.getByText('Continue with Email'));

      // Wait for password step
      await waitFor(() => {
        expect(screen.getByText('Enter Password')).toBeInTheDocument();
      });

      // Enter wrong password
      const passwordInput = screen.getByPlaceholderText('Enter your password');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(screen.getByText('Sign In'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText('Invalid password')).toBeInTheDocument();
      });

      // router.refresh should NOT have been called
      expect(mockRouterRefresh).not.toHaveBeenCalled();
    });

    it('calls both onClose and router.refresh() in the correct order', async () => {
      const callOrder: string[] = [];
      const trackingOnClose = vi.fn(() => callOrder.push('onClose'));
      mockRouterRefresh.mockImplementation(() => callOrder.push('refresh'));

      const user = userEvent.setup();
      render(<LoginModal isOpen={true} onClose={trackingOnClose} />);

      // Go through OTP flow
      const emailInput = screen.getByPlaceholderText('your@email.com');
      await user.type(emailInput, 'test@example.com');
      await user.click(screen.getByText('Continue with Email'));

      await waitFor(() => {
        expect(screen.getByText('Enter Code')).toBeInTheDocument();
      }, { timeout: 2000 });

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], '1');
      }

      // Wait for both calls
      await waitFor(() => {
        expect(trackingOnClose).toHaveBeenCalled();
        expect(mockRouterRefresh).toHaveBeenCalled();
      }, { timeout: 1000 });

      // onClose should be called first, then refresh
      expect(callOrder).toEqual(['onClose', 'refresh']);
    });
  });
});
