import type { KoshiraeData } from '@/types';

/**
 * Sanitizes raw koshirae input from untrusted client payloads.
 * Whitelists every field, trims strings, enforces length limits,
 * and strips blob: URLs. Used by both POST and PATCH listing handlers.
 */
export function sanitizeKoshirae(raw: unknown): KoshiraeData | null {
  if (!raw || typeof raw !== 'object') return null;
  const k = raw as Record<string, unknown>;

  return {
    cert_type: trimOrNull(k.cert_type, 50),
    cert_in_blade_paper: !!k.cert_in_blade_paper,
    cert_session: typeof k.cert_session === 'number' ? k.cert_session : null,
    description: trimOrNull(k.description, 2000),
    images: Array.isArray(k.images)
      ? (k.images as unknown[]).filter(
          (url): url is string => typeof url === 'string' && !url.startsWith('blob:')
        )
      : [],
    // Single maker (issaku)
    artisan_id: trimOrNull(k.artisan_id, 20),
    artisan_name: trimOrNull(k.artisan_name, 200),
    artisan_kanji: trimOrNull(k.artisan_kanji, 200),
    // Multi maker (per-component)
    components: Array.isArray(k.components)
      ? (k.components as unknown[]).map(sanitizeComponent)
      : [],
    // Yuhinkai catalog link
    setsumei_text_en: trimOrNull(k.setsumei_text_en, 10000),
    setsumei_text_ja: trimOrNull(k.setsumei_text_ja, 10000),
    catalog_object_uuid: trimOrNull(k.catalog_object_uuid, 50),
    // Koshirae-level attribution context
    era: trimOrNull(k.era, 100),
    province: trimOrNull(k.province, 100),
    school: trimOrNull(k.school, 100),
  };
}

function sanitizeComponent(raw: unknown): KoshiraeData['components'][number] {
  if (!raw || typeof raw !== 'object') {
    return {
      id: crypto.randomUUID(),
      component_type: 'other',
      artisan_id: null,
      artisan_name: null,
      artisan_kanji: null,
      description: null,
      signed: false,
      mei_text: null,
    };
  }
  const c = raw as Record<string, unknown>;
  const signed = !!c.signed;
  return {
    id: typeof c.id === 'string' ? c.id : crypto.randomUUID(),
    component_type: isValidComponentType(c.component_type) ? c.component_type : 'other',
    artisan_id: trimOrNull(c.artisan_id, 20),
    artisan_name: trimOrNull(c.artisan_name, 200),
    artisan_kanji: trimOrNull(c.artisan_kanji, 200),
    description: trimOrNull(c.description, 2000),
    signed,
    mei_text: signed ? trimOrNull(c.mei_text, 200) : null,
  };
}

const VALID_COMPONENT_TYPES = new Set(['tsuba', 'menuki', 'fuchi_kashira', 'kozuka', 'kogai', 'other']);

function isValidComponentType(v: unknown): v is KoshiraeData['components'][number]['component_type'] {
  return typeof v === 'string' && VALID_COMPONENT_TYPES.has(v);
}

function trimOrNull(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim().slice(0, maxLen);
  return trimmed || null;
}
