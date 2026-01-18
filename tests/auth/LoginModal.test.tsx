/**
 * LoginModal Component Tests
 *
 * Tests the OTP-based login flow including:
 * - Email submission
 * - OTP code entry and auto-submit
 * - Error handling
 * - Modal state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal } from '@/components/auth/LoginModal';

// Mock useAuth hook
const mockSignInWithEmail = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    signInWithEmail: mockSignInWithEmail,
    verifyOtp: mockVerifyOtp,
  }),
}));

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
});
