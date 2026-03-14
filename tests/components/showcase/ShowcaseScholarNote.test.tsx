import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { setupLocaleMock } from '../../helpers/mockLocale';

// Mock locale context (required by HighlightedMarkdown)
setupLocaleMock();

// Mock HighlightedMarkdown to avoid deep dependency chain
vi.mock('@/components/glossary/HighlightedMarkdown', () => ({
  HighlightedMarkdown: ({ content }: { content: string }) => <span>{content}</span>,
}));

// Mock EditableText
vi.mock('@/components/listing/EditableText', () => ({
  EditableText: ({ value, children, placeholder }: { value: string | null; children?: React.ReactNode; placeholder?: string }) =>
    children || <span>{value || placeholder}</span>,
}));

import { ShowcaseScholarNote } from '@/components/showcase/ShowcaseCuratorNotePlaceholder';

describe('ShowcaseScholarNote', () => {
  it('renders listing title centered', () => {
    render(
      <ShowcaseScholarNote
        noteEn="A fine blade."
        noteJa={null}
        listingTitle="Katana by Masamune"
      />
    );
    const title = screen.getByText('Katana by Masamune');
    expect(title.tagName).toBe('H3');
    expect(title.className).toContain('text-center');
  });

  it('renders headline in italic', () => {
    render(
      <ShowcaseScholarNote
        noteEn="A fine blade."
        noteJa={null}
        headlineEn="A rare Kamakura masterwork."
      />
    );
    const headline = screen.getByText('A rare Kamakura masterwork.');
    expect(headline.className).toContain('italic');
    expect(headline.className).toContain('text-center');
  });

  it('renders separator when title or headline is present', () => {
    const { container } = render(
      <ShowcaseScholarNote
        noteEn="Body text."
        noteJa={null}
        listingTitle="Test Title"
      />
    );
    // Separator is a thin horizontal line div
    const separator = container.querySelector('.w-64');
    expect(separator).toBeTruthy();
  });

  it('does NOT render separator when no title and no headline', () => {
    const { container } = render(
      <ShowcaseScholarNote
        noteEn="Body text only."
        noteJa={null}
      />
    );
    const separator = container.querySelector('.w-64');
    expect(separator).toBeNull();
  });

  it('gracefully degrades when headline is null (existing notes)', () => {
    render(
      <ShowcaseScholarNote
        noteEn="Old note without headline."
        noteJa={null}
        headlineEn={null}
        headlineJa={null}
        listingTitle="Test Title"
      />
    );
    // Title should render, headline paragraph should not
    expect(screen.getByText('Test Title')).toBeTruthy();
    // Note body should render
    expect(screen.getByText('Old note without headline.')).toBeTruthy();
  });

  it('bilingual toggle switches both headline and note', () => {
    render(
      <ShowcaseScholarNote
        noteEn="English note."
        noteJa="日本語の解説。"
        headlineEn="English headline."
        headlineJa="日本語の見出し。"
      />
    );

    // Should initially show EN content
    expect(screen.getByText('English headline.')).toBeTruthy();
    expect(screen.getByText('English note.')).toBeTruthy();

    // Click toggle to switch to JA
    const toggle = screen.getByText('翻訳');
    fireEvent.click(toggle);

    // Should now show JA content
    expect(screen.getByText('日本語の見出し。')).toBeTruthy();
    expect(screen.getByText('日本語の解説。')).toBeTruthy();
  });

  it('falls back to EN headline when JA headline is null and showing JA', () => {
    render(
      <ShowcaseScholarNote
        noteEn="English note."
        noteJa="日本語の解説。"
        headlineEn="English headline only."
        headlineJa={null}
      />
    );

    // Toggle to JA
    const toggle = screen.getByText('翻訳');
    fireEvent.click(toggle);

    // Should fall back to EN headline since JA is null
    expect(screen.getByText('English headline only.')).toBeTruthy();
  });

  it('returns null when no notes and not editable', () => {
    const { container } = render(
      <ShowcaseScholarNote
        noteEn={null}
        noteJa={null}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when editable even with no notes', () => {
    const { container } = render(
      <ShowcaseScholarNote
        noteEn={null}
        noteJa={null}
        editable={true}
        onTextSave={async () => {}}
      />
    );
    // Should render the editable container
    expect(container.innerHTML).not.toBe('');
  });
});
