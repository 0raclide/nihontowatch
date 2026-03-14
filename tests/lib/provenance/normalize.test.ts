import { describe, it, expect } from 'vitest';
import { normalizeProvenance } from '@/lib/provenance/normalize';

describe('normalizeProvenance', () => {
  // Null/empty
  it('returns null for null', () => {
    expect(normalizeProvenance(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeProvenance(undefined)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(normalizeProvenance([])).toBeNull();
  });

  it('returns null for empty ProvenanceData', () => {
    expect(normalizeProvenance({ entries: [], documents: [] })).toBeNull();
  });

  // Legacy array shape
  it('normalizes legacy array — images[0] to portrait, images[1:] to documents', () => {
    const result = normalizeProvenance([
      {
        id: 'p1',
        owner_name: 'Tokugawa',
        owner_name_ja: '徳川',
        notes: 'Gift',
        images: ['https://portrait.jpg', 'https://doc1.jpg', 'https://doc2.jpg'],
      },
    ]);
    expect(result).not.toBeNull();
    expect(result!.entries).toHaveLength(1);
    expect(result!.entries[0].id).toBe('p1');
    expect(result!.entries[0].owner_name).toBe('Tokugawa');
    expect(result!.entries[0].owner_name_ja).toBe('徳川');
    expect(result!.entries[0].notes).toBe('Gift');
    expect(result!.entries[0].portrait_image).toBe('https://portrait.jpg');
    expect(result!.documents).toEqual(['https://doc1.jpg', 'https://doc2.jpg']);
  });

  it('normalizes legacy array — entry with no images', () => {
    const result = normalizeProvenance([
      { id: 'p1', owner_name: 'Owner', images: [] },
    ]);
    expect(result).not.toBeNull();
    expect(result!.entries[0].portrait_image).toBeNull();
    expect(result!.documents).toEqual([]);
  });

  it('normalizes legacy array — multiple entries aggregate documents', () => {
    const result = normalizeProvenance([
      { id: 'p1', owner_name: 'A', images: ['https://a-portrait.jpg', 'https://doc-a.jpg'] },
      { id: 'p2', owner_name: 'B', images: ['https://b-portrait.jpg', 'https://doc-b.jpg'] },
    ]);
    expect(result!.entries).toHaveLength(2);
    expect(result!.entries[0].portrait_image).toBe('https://a-portrait.jpg');
    expect(result!.entries[1].portrait_image).toBe('https://b-portrait.jpg');
    expect(result!.documents).toEqual(['https://doc-a.jpg', 'https://doc-b.jpg']);
  });

  // New ProvenanceData shape
  it('passes through new shape', () => {
    const data = {
      entries: [
        { id: 'p1', owner_name: 'Tokugawa', owner_name_ja: null, notes: null, portrait_image: 'https://portrait.jpg' },
      ],
      documents: ['https://doc.jpg'],
    };
    const result = normalizeProvenance(data);
    expect(result).toBe(data); // same reference
  });

  it('returns null for new shape with no entries and no documents', () => {
    const result = normalizeProvenance({ entries: [], documents: [] });
    expect(result).toBeNull();
  });

  // Edge cases
  it('handles missing fields in legacy entries gracefully', () => {
    const result = normalizeProvenance([{ id: 'p1' }]);
    expect(result).not.toBeNull();
    expect(result!.entries[0].owner_name).toBe('');
    expect(result!.entries[0].portrait_image).toBeNull();
  });

  it('skips non-object entries in legacy array', () => {
    const result = normalizeProvenance([null, 42, 'string', { id: 'valid', owner_name: 'Test' }]);
    expect(result).not.toBeNull();
    expect(result!.entries).toHaveLength(1); // non-objects skipped
    expect(result!.entries[0].owner_name).toBe('Test');
  });
});
