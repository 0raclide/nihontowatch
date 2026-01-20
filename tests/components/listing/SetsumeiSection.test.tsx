import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetsumeiSection } from '@/components/listing/SetsumeiSection';
import type { Listing } from '@/types';

// Sample listing data for testing
const createMockListing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 123,
  url: 'https://example.com/listing/123',
  title: 'Test Katana',
  item_type: 'katana' as any,
  price_value: 2500000,
  price_currency: 'JPY',
  smith: 'Famous Smith',
  tosogu_maker: null,
  school: 'Bizen',
  tosogu_school: null,
  cert_type: 'Juyo',
  cert_session: '64',
  cert_organization: 'NBTHK',
  nagasa_cm: 70.5,
  sori_cm: 1.8,
  motohaba_cm: 3.2,
  sakihaba_cm: 2.1,
  kasane_cm: 0.7,
  nakago_cm: 21.5,
  weight_g: 850,
  height_cm: null,
  width_cm: null,
  thickness_mm: null,
  material: null,
  images: ['image1.jpg'],
  first_seen_at: new Date().toISOString(),
  last_scraped_at: new Date().toISOString(),
  status: 'AVAILABLE',
  is_available: true,
  is_sold: false,
  dealer_id: 1,
  dealer: {
    id: 1,
    name: 'Test Dealer',
    domain: 'testdealer.com',
  },
  era: 'Kamakura',
  province: 'Bizen',
  mei_type: 'Mei',
  description: 'A fine katana.',
  ...overrides,
});

describe('SetsumeiSection', () => {
  describe('Rendering conditions', () => {
    it('renders nothing for non-Juyo/Tokuju items', () => {
      const listing = createMockListing({ cert_type: 'Hozon' });
      const { container } = render(<SetsumeiSection listing={listing} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for items without certification', () => {
      const listing = createMockListing({ cert_type: undefined });
      const { container } = render(<SetsumeiSection listing={listing} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders "coming soon" for Juyo items without setsumei', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: undefined
      });
      render(<SetsumeiSection listing={listing} />);

      expect(screen.getByText('Official NBTHK Evaluation')).toBeInTheDocument();
      expect(screen.getByText('Official evaluation translation coming soon')).toBeInTheDocument();
    });

    it('renders "coming soon" for Tokubetsu Juyo items without setsumei', () => {
      const listing = createMockListing({
        cert_type: 'Tokubetsu Juyo',
        setsumei_text_en: undefined
      });
      render(<SetsumeiSection listing={listing} />);

      expect(screen.getByText(/Official evaluation translation coming soon/)).toBeInTheDocument();
    });

    it('renders setsumei content when available', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: '## Juyo Token\n\nThis is a fine example of a Kamakura period katana.'
      });
      render(<SetsumeiSection listing={listing} />);

      expect(screen.getByText('Official NBTHK Evaluation')).toBeInTheDocument();
      expect(screen.getByText('Juyo')).toBeInTheDocument(); // Badge
      expect(screen.getByText('Juyo Token')).toBeInTheDocument(); // H2 from markdown
    });
  });

  describe('Markdown rendering', () => {
    it('renders markdown headers', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: '## Section Title\n\nParagraph content.'
      });
      render(<SetsumeiSection listing={listing} />);

      expect(screen.getByText('Section Title')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content.')).toBeInTheDocument();
    });

    it('renders markdown lists', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: '- Item one\n- Item two'
      });
      render(<SetsumeiSection listing={listing} />);

      expect(screen.getByText('Item one')).toBeInTheDocument();
      expect(screen.getByText('Item two')).toBeInTheDocument();
    });
  });

  describe('Toggle functionality', () => {
    it('shows "Show original" button when Japanese text is available in full mode', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: 'English translation',
        setsumei_text_ja: '日本語テキスト'
      });
      render(<SetsumeiSection listing={listing} variant="full" />);

      expect(screen.getByText('Show original')).toBeInTheDocument();
    });

    it('does not show toggle in preview mode', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: 'English translation',
        setsumei_text_ja: '日本語テキスト'
      });
      render(<SetsumeiSection listing={listing} variant="preview" />);

      expect(screen.queryByText('Show original')).not.toBeInTheDocument();
    });

    it('toggles between English and Japanese text', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: 'English translation text',
        setsumei_text_ja: '日本語テキスト'
      });
      render(<SetsumeiSection listing={listing} variant="full" />);

      // Initially shows English
      expect(screen.getByText('English translation text')).toBeInTheDocument();

      // Click to show original
      fireEvent.click(screen.getByText('Show original'));

      // Now shows Japanese
      expect(screen.getByText('日本語テキスト')).toBeInTheDocument();
      expect(screen.getByText('Show translation')).toBeInTheDocument();
    });
  });

  describe('Preview mode', () => {
    it('truncates long text in preview mode', () => {
      const longText = 'A '.repeat(200); // ~400 characters
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: longText
      });
      render(<SetsumeiSection listing={listing} variant="preview" previewLength={100} />);

      // Text should be truncated
      const content = screen.getByText(/^A A/);
      expect(content.textContent?.length).toBeLessThan(longText.length);
    });

    it('shows "Read full evaluation" button in preview mode when truncated', () => {
      const longText = 'A '.repeat(200);
      const onReadMore = vi.fn();
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: longText
      });
      render(
        <SetsumeiSection
          listing={listing}
          variant="preview"
          previewLength={100}
          onReadMore={onReadMore}
        />
      );

      const readMoreButton = screen.getByText('Read full evaluation');
      fireEvent.click(readMoreButton);

      expect(onReadMore).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: 'Test content'
      });
      const { container } = render(
        <SetsumeiSection listing={listing} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('respects px-0 override for padding', () => {
      const listing = createMockListing({
        cert_type: 'Juyo',
        setsumei_text_en: 'Test content'
      });
      const { container } = render(
        <SetsumeiSection listing={listing} className="px-0" />
      );

      // Should have py-3 but not px-4
      expect(container.firstChild).toHaveClass('py-3');
      expect(container.firstChild).toHaveClass('px-0');
    });
  });
});
