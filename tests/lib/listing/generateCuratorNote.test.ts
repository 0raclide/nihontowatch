import { describe, it, expect } from 'vitest';
import { parseHeadlineAndNote } from '@/lib/listing/generateCuratorNote';

describe('parseHeadlineAndNote', () => {
  it('parses HEADLINE + separator + note correctly', () => {
    const raw = `HEADLINE: A rare Kamakura-period masterwork by Masamune bearing original signature and Tokubetsu Jūyō designation.
---
This katana represents one of the finest achievements of the Sōshū tradition.

The setsumei describes the blade as displaying "noble bearing."`;

    const result = parseHeadlineAndNote(raw);

    expect(result.headline).toBe(
      'A rare Kamakura-period masterwork by Masamune bearing original signature and Tokubetsu Jūyō designation.'
    );
    expect(result.note).toBe(
      `This katana represents one of the finest achievements of the Sōshū tradition.\n\nThe setsumei describes the blade as displaying "noble bearing."`
    );
  });

  it('returns null headline when no delimiter is found', () => {
    const raw = 'This is just a note with no headline format.';
    const result = parseHeadlineAndNote(raw);

    expect(result.headline).toBeNull();
    expect(result.note).toBe('This is just a note with no headline format.');
  });

  it('parses Japanese headline content', () => {
    const raw = `HEADLINE: 鎌倉時代の名匠正宗による稀有な在銘の一振り、特別重要刀剣に指定。
---
本刀は相州伝の最高傑作のひとつである。`;

    const result = parseHeadlineAndNote(raw);

    expect(result.headline).toBe('鎌倉時代の名匠正宗による稀有な在銘の一振り、特別重要刀剣に指定。');
    expect(result.note).toBe('本刀は相州伝の最高傑作のひとつである。');
  });

  it('trims whitespace from headline and note', () => {
    const raw = `HEADLINE:   Some headline with spaces
---
  Note with leading spaces.  `;

    const result = parseHeadlineAndNote(raw);

    expect(result.headline).toBe('Some headline with spaces');
    expect(result.note).toBe('Note with leading spaces.');
  });

  it('handles empty headline after HEADLINE: prefix', () => {
    const raw = 'HEADLINE: \n---\nJust the note.';
    const result = parseHeadlineAndNote(raw);

    // Empty headline still gets trimmed to empty string
    expect(result.headline).toBe('');
    expect(result.note).toBe('Just the note.');
  });

  it('handles multiline notes after separator', () => {
    const raw = `HEADLINE: A fine blade.
---
Paragraph one.

Paragraph two.

Paragraph three with *italics* and "quotes."`;

    const result = parseHeadlineAndNote(raw);

    expect(result.headline).toBe('A fine blade.');
    expect(result.note).toContain('Paragraph one.');
    expect(result.note).toContain('Paragraph two.');
    expect(result.note).toContain('Paragraph three');
  });

  it('treats response as note-only when HEADLINE prefix is missing', () => {
    const raw = `This blade was forged by Sadamune.

The setsumei describes...`;

    const result = parseHeadlineAndNote(raw);

    expect(result.headline).toBeNull();
    expect(result.note).toBe(raw.trim());
  });

  it('handles --- appearing inside the note body (only first separator matters)', () => {
    const raw = `HEADLINE: A remarkable work.
---
The blade features noteworthy characteristics.

---

Another paragraph after a horizontal rule in the note.`;

    const result = parseHeadlineAndNote(raw);

    expect(result.headline).toBe('A remarkable work.');
    expect(result.note).toContain('---');
    expect(result.note).toContain('Another paragraph');
  });
});
