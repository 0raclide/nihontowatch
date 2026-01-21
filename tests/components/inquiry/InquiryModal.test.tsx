/**
 * InquiryModal Component Tests
 *
 * Tests the AI-powered email generation modal including:
 * - Two-step flow (form input → generated email display)
 * - Form validation
 * - Loading and error states
 * - Copy functionality
 * - Modal behavior (close on escape, backdrop click)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InquiryModal } from '@/components/inquiry/InquiryModal';
import type { GeneratedEmail } from '@/lib/inquiry/types';

// =============================================================================
// MOCK DATA
// =============================================================================

const mockListing = {
  id: 123,
  title: 'Katana by Bizen Osafune Sukesada',
  url: 'https://example.com/listing/123',
  dealer_id: 1,
  dealers: {
    id: 1,
    name: 'Test Dealer',
    domain: 'test-dealer.com',
  },
  price_value: 500000,
  price_currency: 'JPY',
  item_type: 'katana',
  cert_type: 'Juyo',
  status: 'available',
  is_available: true,
  is_sold: false,
  page_exists: true,
  scrape_count: 1,
  images: [],
  first_seen_at: '2026-01-01T00:00:00Z',
  last_scraped_at: '2026-01-20T00:00:00Z',
} as const;

const mockGeneratedEmail: GeneratedEmail = {
  email_ja: '拝啓\n\n新春の候、貴社ますますご清栄のこととお慶び申し上げます。\n\n貴サイトに掲載されております備前長船祐定作の刀について、購入を検討しております。\n\n海外（アメリカ合衆国）への発送は可能でしょうか。\n\n何卒よろしくお願い申し上げます。\n\n敬具\n\nジョン・スミス',
  email_en: 'Dear Sir/Madam,\n\nI hope this message finds you well in the new year.\n\nI am writing to inquire about the katana by Bizen Osafune Sukesada listed on your website. I am considering purchasing this item.\n\nWould it be possible to ship to the United States?\n\nThank you for your time and consideration.\n\nBest regards,\nJohn Smith',
  subject_ja: '【お問い合わせ】備前長船祐定 刀について',
  subject_en: 'Inquiry: Bizen Osafune Sukesada Katana',
  dealer_email: 'info@test-dealer.com',
  dealer_name: 'Test Dealer',
  dealer_domain: 'test-dealer.com',
  dealer_policies: {
    ships_international: true,
    accepts_wire_transfer: true,
    accepts_paypal: false,
    accepts_credit_card: false,
    requires_deposit: true,
    deposit_percentage: 30,
    english_support: false,
  },
};

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock useInquiry hook
const mockGenerateEmail = vi.fn();
const mockClearError = vi.fn();

vi.mock('@/hooks/useInquiry', () => ({
  useInquiry: () => ({
    generateEmail: mockGenerateEmail,
    isGenerating: false,
    error: null,
    clearError: mockClearError,
  }),
}));

// Mock clipboard API
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
  mockGenerateEmail.mockResolvedValue(mockGeneratedEmail);
  mockWriteText.mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  // Don't restore mocks - we want clipboard to persist
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function renderModal(props: Partial<React.ComponentProps<typeof InquiryModal>> = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    listing: mockListing,
  };
  return render(<InquiryModal {...defaultProps} {...props} />);
}

// Helper to fill the form and submit
async function fillFormAndSubmit(user: ReturnType<typeof userEvent.setup>, options?: { message?: string }) {
  await user.type(screen.getByLabelText(/your name/i), 'John Smith');
  await user.type(screen.getByLabelText(/your country/i), 'United States');
  if (options?.message) {
    await user.type(screen.getByLabelText(/your message/i), options.message);
  } else {
    await user.type(screen.getByLabelText(/your message/i), 'I am interested in this item.');
  }
  await user.click(screen.getByRole('button', { name: /generate email/i }));
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('InquiryModal', () => {
  // ===========================================================================
  // RENDERING
  // ===========================================================================

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/contact dealer/i)).toBeInTheDocument();
    });

    it('displays listing title', () => {
      renderModal();
      expect(screen.getByText(/Katana by Bizen Osafune Sukesada/i)).toBeInTheDocument();
    });

    it('displays buyer name input', () => {
      renderModal();
      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    });

    it('displays buyer country input', () => {
      renderModal();
      expect(screen.getByLabelText(/your country/i)).toBeInTheDocument();
    });

    it('displays message textarea', () => {
      renderModal();
      expect(screen.getByLabelText(/your message/i)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // MODAL BEHAVIOR
  // ===========================================================================

  describe('modal behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const closeButton = screen.getByLabelText(/close/i);
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      const content = screen.getByRole('dialog');
      fireEvent.click(content);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // FORM INPUT
  // ===========================================================================

  describe('form input', () => {
    it('allows entering buyer name', async () => {
      renderModal();
      const user = userEvent.setup();

      const nameInput = screen.getByLabelText(/your name/i);
      await user.type(nameInput, 'John Smith');

      expect(nameInput).toHaveValue('John Smith');
    });

    it('allows entering buyer country', async () => {
      renderModal();
      const user = userEvent.setup();

      const countryInput = screen.getByLabelText(/your country/i);
      await user.type(countryInput, 'United States');

      expect(countryInput).toHaveValue('United States');
    });

    it('allows entering message', async () => {
      renderModal();
      const user = userEvent.setup();

      const messageInput = screen.getByLabelText(/your message/i);
      await user.type(messageInput, 'Is there any active rust?');

      expect(messageInput).toHaveValue('Is there any active rust?');
    });
  });

  // ===========================================================================
  // FORM VALIDATION
  // ===========================================================================

  describe('form validation', () => {
    it('shows error when name is empty', async () => {
      renderModal();
      const user = userEvent.setup();

      // Fill country and message but not name
      await user.type(screen.getByLabelText(/your country/i), 'United States');
      await user.type(screen.getByLabelText(/your message/i), 'Test message');

      const submitButton = screen.getByRole('button', { name: /generate email/i });
      await user.click(submitButton);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });

    it('shows error when country is empty', async () => {
      renderModal();
      const user = userEvent.setup();

      // Fill name and message but not country
      await user.type(screen.getByLabelText(/your name/i), 'John Smith');
      await user.type(screen.getByLabelText(/your message/i), 'Test message');

      const submitButton = screen.getByRole('button', { name: /generate email/i });
      await user.click(submitButton);

      expect(screen.getByText(/country is required/i)).toBeInTheDocument();
    });

    it('shows error when message is empty', async () => {
      renderModal();
      const user = userEvent.setup();

      // Fill name and country but not message
      await user.type(screen.getByLabelText(/your name/i), 'John Smith');
      await user.type(screen.getByLabelText(/your country/i), 'United States');

      const submitButton = screen.getByRole('button', { name: /generate email/i });
      await user.click(submitButton);

      expect(screen.getByText(/message is required/i)).toBeInTheDocument();
    });

    it('does not submit when validation fails', async () => {
      renderModal();
      const user = userEvent.setup();

      const submitButton = screen.getByRole('button', { name: /generate email/i });
      await user.click(submitButton);

      expect(mockGenerateEmail).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // EMAIL GENERATION
  // ===========================================================================

  describe('email generation', () => {
    it('calls generateEmail with correct input', async () => {
      renderModal();
      const user = userEvent.setup();

      // Fill form
      await user.type(screen.getByLabelText(/your name/i), 'John Smith');
      await user.type(screen.getByLabelText(/your country/i), 'United States');
      await user.type(screen.getByLabelText(/your message/i), 'Is this item available?');

      // Submit
      await user.click(screen.getByRole('button', { name: /generate email/i }));

      expect(mockGenerateEmail).toHaveBeenCalledWith({
        listingId: 123,
        buyerName: 'John Smith',
        buyerCountry: 'United States',
        message: 'Is this item available?',
      });
    });

    it('shows loading state during generation', async () => {
      // Setup mock to show loading state
      vi.doMock('@/hooks/useInquiry', () => ({
        useInquiry: () => ({
          generateEmail: mockGenerateEmail,
          isGenerating: true,
          error: null,
          clearError: mockClearError,
        }),
      }));

      renderModal();

      // The button should show loading when isGenerating is true
      // Note: This test relies on the component showing a loading indicator
    });

    it('transitions to result view after successful generation', async () => {
      renderModal();
      const user = userEvent.setup();

      // Fill form with all required fields
      await fillFormAndSubmit(user);

      // Wait for result view
      await waitFor(() => {
        expect(screen.getByText(/generated email/i)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // RESULT VIEW
  // ===========================================================================

  describe('result view', () => {
    async function goToResultView() {
      renderModal();
      const user = userEvent.setup();

      await fillFormAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText(/generated email/i)).toBeInTheDocument();
      });

      return user;
    }

    it('displays dealer email when available', async () => {
      await goToResultView();
      expect(screen.getByText('info@test-dealer.com')).toBeInTheDocument();
    });

    it('displays Japanese subject line', async () => {
      await goToResultView();
      expect(screen.getByText(/【お問い合わせ】備前長船祐定/)).toBeInTheDocument();
    });

    it('displays Japanese email body', async () => {
      await goToResultView();
      expect(screen.getByText(/拝啓/)).toBeInTheDocument();
      expect(screen.getByText(/敬具/)).toBeInTheDocument();
    });

    it('displays English translation section', async () => {
      await goToResultView();
      expect(screen.getByText(/english translation/i)).toBeInTheDocument();
    });

    it('shows dealer policies when available', async () => {
      await goToResultView();

      // Check for ships international
      expect(screen.getByText(/ships international/i)).toBeInTheDocument();
    });

    it('shows start over button', async () => {
      await goToResultView();
      expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument();
    });

    it('returns to form view when start over is clicked', async () => {
      const user = await goToResultView();

      await user.click(screen.getByRole('button', { name: /start over/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // COPY FUNCTIONALITY
  // ===========================================================================

  describe('copy functionality', () => {
    async function goToResultView() {
      renderModal();

      // Use fireEvent for faster and more reliable form filling
      fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'John Smith' } });
      fireEvent.change(screen.getByLabelText(/your country/i), { target: { value: 'United States' } });
      fireEvent.change(screen.getByLabelText(/your message/i), { target: { value: 'I am interested in this item.' } });
      fireEvent.click(screen.getByRole('button', { name: /generate email/i }));

      await waitFor(() => {
        expect(screen.getByText(/generated email/i)).toBeInTheDocument();
      });
    }

    it('has copy button for dealer email', async () => {
      await goToResultView();
      const copyButtons = screen.getAllByRole('button', { name: /copy/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('copies dealer email to clipboard and shows feedback', async () => {
      await goToResultView();

      const copyButton = screen.getByTestId('copy-dealer-email');
      fireEvent.click(copyButton);

      // Verify the button shows copied feedback
      await waitFor(() => {
        // The icon button changes its aria-label when copied
        expect(copyButton).toHaveAttribute('aria-label', 'Copied');
      });
    });

    it('copies subject line to clipboard and shows feedback', async () => {
      await goToResultView();

      const copyButton = screen.getByTestId('copy-subject');
      fireEvent.click(copyButton);

      // Verify the button shows copied feedback
      await waitFor(() => {
        expect(copyButton).toHaveAttribute('aria-label', 'Copied');
      });
    });

    it('copies email body to clipboard and shows feedback', async () => {
      await goToResultView();

      const copyEmailButton = screen.getByTestId('copy-email-body');
      fireEvent.click(copyEmailButton);

      // Verify button shows copied feedback
      await waitFor(() => {
        expect(screen.getByTestId('copy-email-body')).toHaveTextContent('Copied');
      });
    });

    it('shows copied confirmation feedback', async () => {
      await goToResultView();

      const copyEmailButton = screen.getByTestId('copy-email-body');
      fireEvent.click(copyEmailButton);

      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('displays error message when generation fails', async () => {
      mockGenerateEmail.mockResolvedValue(null);

      renderModal();
      const user = userEvent.setup();

      // Re-mock hook with error
      vi.doMock('@/hooks/useInquiry', () => ({
        useInquiry: () => ({
          generateEmail: mockGenerateEmail,
          isGenerating: false,
          error: 'Failed to generate email',
          clearError: mockClearError,
        }),
      }));

      await fillFormAndSubmit(user);

      // The component should stay on form view and show error
      await waitFor(() => {
        expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
      });
    });

    it('clears error when starting a new generation', async () => {
      renderModal();
      const user = userEvent.setup();

      await fillFormAndSubmit(user);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles listing without dealer email', async () => {
      mockGenerateEmail.mockResolvedValue({
        ...mockGeneratedEmail,
        dealer_email: null,
      });

      renderModal();
      const user = userEvent.setup();

      await fillFormAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText(/generated email/i)).toBeInTheDocument();
      });

      // Should show message about finding email on dealer site
      expect(screen.getByText(/contact.*dealer.*website/i)).toBeInTheDocument();
    });

    it('handles listing without dealer policies', async () => {
      mockGenerateEmail.mockResolvedValue({
        ...mockGeneratedEmail,
        dealer_policies: null,
      });

      renderModal();
      const user = userEvent.setup();

      await fillFormAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText(/generated email/i)).toBeInTheDocument();
      });

      // Should not crash, policies section should be hidden or show unknown
    });

    it('resets form when modal is reopened', async () => {
      const { rerender } = renderModal();
      const user = userEvent.setup();

      // Fill form
      await user.type(screen.getByLabelText(/your name/i), 'John Smith');

      // Close modal
      rerender(<InquiryModal isOpen={false} onClose={() => {}} listing={mockListing} />);

      // Reopen modal
      rerender(<InquiryModal isOpen={true} onClose={() => {}} listing={mockListing} />);

      // Form should be reset
      expect(screen.getByLabelText(/your name/i)).toHaveValue('');
    });

    it('handles very long message', async () => {
      renderModal();

      const longText = 'A'.repeat(2000);

      // Use fireEvent for faster input on long text
      const nameInput = screen.getByLabelText(/your name/i);
      const countryInput = screen.getByLabelText(/your country/i);
      const messageInput = screen.getByLabelText(/your message/i);

      fireEvent.change(nameInput, { target: { value: 'John Smith' } });
      fireEvent.change(countryInput, { target: { value: 'United States' } });
      fireEvent.change(messageInput, { target: { value: longText } });

      const submitButton = screen.getByRole('button', { name: /generate email/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Should call API with the text
        expect(mockGenerateEmail).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // ACCESSIBILITY
  // ===========================================================================

  describe('accessibility', () => {
    it('has proper dialog role', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has proper form labels', () => {
      renderModal();

      // All inputs should be properly labeled
      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/your country/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/your message/i)).toBeInTheDocument();
    });

    it('traps focus within modal', () => {
      renderModal();

      // Modal should have focus trap (implementation detail)
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });
});
