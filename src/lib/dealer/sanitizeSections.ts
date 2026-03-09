import type { SayagakiEntry, SayagakiAuthor, HakogakiEntry, ProvenanceEntry, KiwameEntry, KiwameType, KantoHibishoData } from '@/types';

// =============================================================================
// Shared helpers
// =============================================================================

function trimOrNull(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim().slice(0, maxLen);
  return trimmed || null;
}

function sanitizeImageArray(arr: unknown, maxCount = 10): string[] {
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[])
    .filter((url): url is string => typeof url === 'string' && url.length > 0 && !url.startsWith('blob:'))
    .slice(0, maxCount);
}

// =============================================================================
// Sayagaki
// =============================================================================

const VALID_SAYAGAKI_AUTHORS = new Set<string>([
  'honami_koson', 'honami_nishu', 'tanobe_michihiro',
  'kanzan_sato', 'honma_junji', 'other',
]);

function sanitizeSayagakiEntry(raw: unknown): SayagakiEntry {
  if (!raw || typeof raw !== 'object') {
    return { id: crypto.randomUUID(), author: 'other', author_custom: null, content: null, images: [] };
  }
  const e = raw as Record<string, unknown>;
  const author = typeof e.author === 'string' && VALID_SAYAGAKI_AUTHORS.has(e.author)
    ? (e.author as SayagakiAuthor)
    : 'other';
  return {
    id: typeof e.id === 'string' ? e.id : crypto.randomUUID(),
    author,
    author_custom: author === 'other' ? trimOrNull(e.author_custom, 200) : null,
    content: trimOrNull(e.content, 5000),
    images: sanitizeImageArray(e.images, 5),
  };
}

/**
 * Sanitizes raw sayagaki input from untrusted client payloads.
 * Returns a valid SayagakiEntry[] or null if input is empty/invalid.
 */
export function sanitizeSayagaki(raw: unknown): SayagakiEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries = (raw as unknown[]).slice(0, 10).map(sanitizeSayagakiEntry);
  return entries.length > 0 ? entries : null;
}

// =============================================================================
// Hakogaki
// =============================================================================

function sanitizeHakogakiEntry(raw: unknown): HakogakiEntry {
  if (!raw || typeof raw !== 'object') {
    return { id: crypto.randomUUID(), author: null, content: null, images: [] };
  }
  const e = raw as Record<string, unknown>;
  return {
    id: typeof e.id === 'string' ? e.id : crypto.randomUUID(),
    author: trimOrNull(e.author, 200),
    content: trimOrNull(e.content, 5000),
    images: sanitizeImageArray(e.images, 5),
  };
}

/**
 * Sanitizes raw hakogaki input from untrusted client payloads.
 * Returns a valid HakogakiEntry[] or null if input is empty/invalid.
 */
export function sanitizeHakogaki(raw: unknown): HakogakiEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries = (raw as unknown[]).slice(0, 10).map(sanitizeHakogakiEntry);
  return entries.length > 0 ? entries : null;
}

// =============================================================================
// Provenance
// =============================================================================

function sanitizeProvenanceEntry(raw: unknown): ProvenanceEntry {
  if (!raw || typeof raw !== 'object') {
    return { id: crypto.randomUUID(), owner_name: '', owner_name_ja: null, notes: null, images: [] };
  }
  const e = raw as Record<string, unknown>;
  return {
    id: typeof e.id === 'string' ? e.id : crypto.randomUUID(),
    owner_name: trimOrNull(e.owner_name, 200) ?? '',
    owner_name_ja: trimOrNull(e.owner_name_ja, 200),
    notes: trimOrNull(e.notes, 5000),
    images: sanitizeImageArray(e.images, 5),
  };
}

/**
 * Sanitizes raw provenance input from untrusted client payloads.
 * Returns a valid ProvenanceEntry[] or null if input is empty/invalid.
 */
export function sanitizeProvenance(raw: unknown): ProvenanceEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries = (raw as unknown[]).slice(0, 20).map(sanitizeProvenanceEntry);
  return entries.length > 0 ? entries : null;
}

// =============================================================================
// Kiwame
// =============================================================================

const VALID_KIWAME_TYPES = new Set<string>(['origami', 'kinzogan', 'saya_mei', 'other']);

function sanitizeKiwameEntry(raw: unknown): KiwameEntry {
  if (!raw || typeof raw !== 'object') {
    return { id: crypto.randomUUID(), judge_name: '', judge_name_ja: null, kiwame_type: 'origami', notes: null };
  }
  const e = raw as Record<string, unknown>;
  return {
    id: typeof e.id === 'string' ? e.id : crypto.randomUUID(),
    judge_name: trimOrNull(e.judge_name, 200) ?? '',
    judge_name_ja: trimOrNull(e.judge_name_ja, 200),
    kiwame_type: typeof e.kiwame_type === 'string' && VALID_KIWAME_TYPES.has(e.kiwame_type)
      ? (e.kiwame_type as KiwameType)
      : 'origami',
    notes: trimOrNull(e.notes, 5000),
  };
}

/**
 * Sanitizes raw kiwame input from untrusted client payloads.
 * Returns a valid KiwameEntry[] or null if input is empty/invalid.
 */
export function sanitizeKiwame(raw: unknown): KiwameEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries = (raw as unknown[]).slice(0, 10).map(sanitizeKiwameEntry);
  return entries.length > 0 ? entries : null;
}

// =============================================================================
// Kanto Hibisho
// =============================================================================

/**
 * Sanitizes raw kanto_hibisho input from untrusted client payloads.
 * Returns a valid KantoHibishoData or null if input is empty/invalid.
 */
export function sanitizeKantoHibisho(raw: unknown): KantoHibishoData | null {
  if (!raw || typeof raw !== 'object') return null;
  const k = raw as Record<string, unknown>;
  const volume = trimOrNull(k.volume, 50) ?? '';
  const entry_number = trimOrNull(k.entry_number, 50) ?? '';
  const text = trimOrNull(k.text, 10000);
  const images = sanitizeImageArray(k.images, 10);
  // If everything is empty, return null
  if (!volume && !entry_number && !text && images.length === 0) return null;
  return { volume, entry_number, text, images };
}
