/**
 * Feedback Modal Component Tests
 *
 * Tests FeedbackModalShell, FeedbackModal, and ReportModal:
 * - Modal rendering, open/close behavior
 * - Success state display
 * - Submit button disabled when empty
 * - Type pill selection (FeedbackModal)
 * - Target info display (ReportModal)
 * - Error message rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock locale context
vi.mock('@/i18n/LocaleContext', () => ({
  useLocale: () => ({
    locale: 'en',
    setLocale: () => {},
    t: (key: string) => {
      const strings: Record<string, string> = {
        'feedback.reportIssue': 'Report an issue',
        'feedback.whatLooksWrong': "What looks wrong?",
        'feedback.sendFeedback': 'Send feedback',
        'feedback.tellUs': "Tell us what's on your mind...",
        'feedback.bug': 'Bug',
        'feedback.featureIdea': 'Feature idea',
        'feedback.other': 'Other',
        'feedback.submit': 'Submit',
        'feedback.cancel': 'Cancel',
        'feedback.thanks': "Thanks — we'll look into it",
        'feedback.thanksFeedback': 'Thanks for your feedback!',
        'feedback.rateLimited': 'Too many submissions. Please wait.',
        'feedback.submitError': 'Something went wrong.',
      };
      return strings[key] || key;
    },
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  // Default: successful submission
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { id: 1, status: 'open' } }),
  });
});

// =============================================================================
// FeedbackModalShell TESTS
// =============================================================================

import { FeedbackModalShell } from '@/components/feedback/FeedbackModalShell';

describe('FeedbackModalShell', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    success: false,
    successMessage: 'Thanks!',
    title: 'Test Title',
    message: '',
    onMessageChange: vi.fn(),
    placeholder: 'Type here...',
    submitting: false,
    error: '',
    onSubmit: vi.fn(),
  };

  it('renders nothing when not open', () => {
    const { container } = render(
      <FeedbackModalShell {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title when open', () => {
    render(<FeedbackModalShell {...defaultProps} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<FeedbackModalShell {...defaultProps} subtitle="Sub Title" />);
    expect(screen.getByText('Sub Title')).toBeInTheDocument();
  });

  it('renders textarea with placeholder', () => {
    render(<FeedbackModalShell {...defaultProps} />);
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });

  it('renders children slot', () => {
    render(
      <FeedbackModalShell {...defaultProps}>
        <div data-testid="child-slot">Custom content</div>
      </FeedbackModalShell>
    );
    expect(screen.getByTestId('child-slot')).toBeInTheDocument();
  });

  it('shows success state instead of form', () => {
    render(
      <FeedbackModalShell {...defaultProps} success={true} />
    );
    expect(screen.getByText('Thanks!')).toBeInTheDocument();
    // Form should not be visible
    expect(screen.queryByPlaceholderText('Type here...')).not.toBeInTheDocument();
  });

  it('disables submit button when message is empty', () => {
    render(<FeedbackModalShell {...defaultProps} message="" />);
    const submitBtn = screen.getByText('Submit');
    expect(submitBtn).toBeDisabled();
  });

  it('disables submit button when message is whitespace only', () => {
    render(<FeedbackModalShell {...defaultProps} message="   " />);
    const submitBtn = screen.getByText('Submit');
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when message has content', () => {
    render(<FeedbackModalShell {...defaultProps} message="Bug report" />);
    const submitBtn = screen.getByText('Submit');
    expect(submitBtn).not.toBeDisabled();
  });

  it('disables submit button while submitting', () => {
    render(<FeedbackModalShell {...defaultProps} message="Test" submitting={true} />);
    // When submitting, "Submit" text is inside a <span> inside the button.
    // Query the actual button element by its disabled state.
    const submitBtn = screen.getByText('Submit').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('renders error message', () => {
    render(
      <FeedbackModalShell {...defaultProps} message="Test" error="Something went wrong" />
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<FeedbackModalShell {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit when submit is clicked', () => {
    const onSubmit = vi.fn();
    render(<FeedbackModalShell {...defaultProps} message="Bug" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<FeedbackModalShell {...defaultProps} onClose={onClose} />);

    // Click the backdrop (the outermost fixed div)
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls onMessageChange when textarea changes', () => {
    const onMessageChange = vi.fn();
    render(<FeedbackModalShell {...defaultProps} onMessageChange={onMessageChange} />);

    const textarea = screen.getByPlaceholderText('Type here...');
    fireEvent.change(textarea, { target: { value: 'New text' } });
    expect(onMessageChange).toHaveBeenCalledWith('New text');
  });
});

// =============================================================================
// FeedbackModal TESTS
// =============================================================================

import { FeedbackModal } from '@/components/feedback/FeedbackModal';

describe('FeedbackModal', () => {
  it('renders with type pills', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature idea')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('renders the title "Send feedback"', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Send feedback')).toBeInTheDocument();
  });

  it('submits with selected feedback type', async () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);

    // Click "Feature idea" pill
    fireEvent.click(screen.getByText('Feature idea'));

    // Type a message
    const textarea = screen.getByPlaceholderText("Tell us what's on your mind...");
    fireEvent.change(textarea, { target: { value: 'Please add dark mode' } });

    // Submit
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
        method: 'POST',
      }));
    });

    // Check the body includes correct feedback_type
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.feedback_type).toBe('feature_request');
    expect(callBody.message).toBe('Please add dark mode');
  });

  it('defaults to "bug" type', async () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />);

    const textarea = screen.getByPlaceholderText("Tell us what's on your mind...");
    fireEvent.change(textarea, { target: { value: 'It crashed' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.feedback_type).toBe('bug');
  });
});

// =============================================================================
// ReportModal TESTS
// =============================================================================

import { ReportModal } from '@/components/feedback/ReportModal';

describe('ReportModal', () => {
  it('renders target label as subtitle', () => {
    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="listing"
        targetId="42"
        targetLabel="Katana by Masamune"
      />
    );

    expect(screen.getByText('Katana by Masamune')).toBeInTheDocument();
    expect(screen.getByText('Report an issue')).toBeInTheDocument();
  });

  it('submits with data_report type and target info', async () => {
    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="artist"
        targetId="MAS590"
        targetLabel="Masamune"
      />
    );

    const textarea = screen.getByPlaceholderText("What looks wrong?");
    fireEvent.change(textarea, { target: { value: 'Wrong era listed' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.feedback_type).toBe('data_report');
    expect(callBody.target_type).toBe('artist');
    expect(callBody.target_id).toBe('MAS590');
    expect(callBody.target_label).toBe('Masamune');
    expect(callBody.message).toBe('Wrong era listed');
  });

  it('does not render type pills (data_report only)', () => {
    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="listing"
        targetId="1"
        targetLabel="Test"
      />
    );

    // Should NOT have Bug/Feature/Other pills
    expect(screen.queryByText('Bug')).not.toBeInTheDocument();
    expect(screen.queryByText('Feature idea')).not.toBeInTheDocument();
  });

  it('shows success message after submission', async () => {
    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="listing"
        targetId="1"
        targetLabel="Test"
      />
    );

    const textarea = screen.getByPlaceholderText("What looks wrong?");
    fireEvent.change(textarea, { target: { value: 'Issue here' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText("Thanks — we'll look into it")).toBeInTheDocument();
    });
  });

  it('shows error on 429 rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limited' }),
    });

    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="listing"
        targetId="1"
        targetLabel="Test"
      />
    );

    const textarea = screen.getByPlaceholderText("What looks wrong?");
    fireEvent.change(textarea, { target: { value: 'Issue' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Too many submissions. Please wait.')).toBeInTheDocument();
    });
  });

  it('shows error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="listing"
        targetId="1"
        targetLabel="Test"
      />
    );

    const textarea = screen.getByPlaceholderText("What looks wrong?");
    fireEvent.change(textarea, { target: { value: 'Issue' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    });
  });

  it('shows error on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });

    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="listing"
        targetId="1"
        targetLabel="Test"
      />
    );

    const textarea = screen.getByPlaceholderText("What looks wrong?");
    fireEvent.change(textarea, { target: { value: 'Issue' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    });
  });

  it('includes page_url in submission', async () => {
    // Set window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: 'https://nihontowatch.com/listing/42' },
      writable: true,
    });

    render(
      <ReportModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="listing"
        targetId="42"
        targetLabel="Test Listing"
      />
    );

    const textarea = screen.getByPlaceholderText("What looks wrong?");
    fireEvent.change(textarea, { target: { value: 'Wrong data' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.page_url).toBe('https://nihontowatch.com/listing/42');
  });
});
