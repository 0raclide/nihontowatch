import type { ProvenanceData, ProvenanceEntry } from '@/types';

/**
 * Normalize provenance data from either legacy array shape or new ProvenanceData shape.
 *
 * Legacy shape: ProvenanceEntry[] with `images: string[]`
 *   → images[0] becomes portrait_image, images[1:] become chain-level documents
 *
 * New shape: ProvenanceData with per-entry portrait_image + chain-level documents[]
 *   → passed through as-is
 */
export function normalizeProvenance(raw: unknown): ProvenanceData | null {
  if (!raw) return null;

  // Legacy: flat array of entries with images[]
  if (Array.isArray(raw)) {
    const entries: ProvenanceEntry[] = [];
    const documents: string[] = [];

    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const images = Array.isArray(e.images) ? (e.images as string[]) : [];

      entries.push({
        id: typeof e.id === 'string' ? e.id : '',
        owner_name: typeof e.owner_name === 'string' ? e.owner_name : '',
        owner_name_ja: typeof e.owner_name_ja === 'string' ? e.owner_name_ja : null,
        notes: typeof e.notes === 'string' ? e.notes : null,
        portrait_image: images[0] ?? null,
      });

      // images[1:] become chain-level documents
      for (let i = 1; i < images.length; i++) {
        if (typeof images[i] === 'string' && images[i]) {
          documents.push(images[i]);
        }
      }
    }

    return entries.length > 0 || documents.length > 0
      ? { entries, documents }
      : null;
  }

  // New shape: ProvenanceData object
  if (typeof raw === 'object') {
    const data = raw as ProvenanceData;
    if (data.entries?.length > 0 || data.documents?.length > 0) {
      return data;
    }
  }

  return null;
}
