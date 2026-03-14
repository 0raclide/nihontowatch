/**
 * Curator's Note — Context Assembly, Input Hash, Skip Logic
 *
 * Pure functions that take an EnrichedListingDetail + Yuhinkai data and produce
 * a structured context package for the AI prompt builder.
 *
 * @module lib/listing/curatorNote
 */

import { createHash } from 'crypto';
import type { EnrichedListingDetail } from './getListingDetail';
import type { ArtisanEntity } from '@/lib/supabase/yuhinkai';
import type { SayagakiEntry, HakogakiEntry, KoshiraeData, ProvenanceData, KiwameEntry } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface ArtistOverview {
  form_distribution: Record<string, number>;
  mei_distribution: Record<string, number>;
  top_students: Array<{ name: string; juyo_count: number; tokuju_count: number; elite_factor: number }>;
  school_ancestry: string[];
  elite_percentile: number;
  top_provenance_owners: Array<{ name: string; count: number }>;
}

export interface CuratorNoteContext {
  sword: {
    item_type: string | null;
    nagasa_cm: number | null;
    sori_cm: number | null;
    motohaba_cm: number | null;
    sakihaba_cm: number | null;
    kasane_cm: number | null;
    mei_type: string | null;
    mei_text: string | null;
    era: string | null;
    province: string | null;
    school: string | null;
    cert_type: string | null;
    cert_session: string | null;
    cert_organization: string | null;
  };
  artisan: {
    code: string;
    name_romaji: string | null;
    name_kanji: string | null;
    school: string | null;
    province: string | null;
    era: string | null;
    teacher: string | null;
    teacher_id: string | null;
    designation_factor: number;
    kokuho_count: number;
    jubun_count: number;
    jubi_count: number;
    gyobutsu_count: number;
    tokuju_count: number;
    juyo_count: number;
    total_items: number;
    ai_biography_en: string | null;
  } | null;
  setsumei: {
    text_en: string | null;
    text_ja: string | null;
  } | null;
  sayagaki: Array<{ author: string | null; content: string | null }> | null;
  hakogaki: Array<{ author: string | null; content: string | null }> | null;
  provenance: Array<{ owner_name: string; owner_name_ja: string | null; notes: string | null }> | null;
  kiwame: Array<{ judge_name: string; kiwame_type: string; notes: string | null }> | null;
  koshirae: {
    cert_type: string | null;
    cert_session: number | null;
    artisan_name: string | null;
    description: string | null;
  } | null;
  research_notes: string | null;
  artist_overview: ArtistOverview | null;
}

export type DataRichness = 'full' | 'moderate' | 'sparse' | 'minimal';

// =============================================================================
// CONTEXT ASSEMBLY
// =============================================================================

/**
 * Assemble the structured context package from listing + artisan data.
 * Only includes sections that have meaningful data.
 */
export function assembleCuratorContext(
  listing: EnrichedListingDetail,
  artisanEntity: ArtisanEntity | null,
  aiDescription: { en: string | null; ja: string | null } | null,
  artistOverview?: ArtistOverview | null
): CuratorNoteContext {
  // Sword data — always present (even if all null)
  const sword: CuratorNoteContext['sword'] = {
    item_type: listing.item_type,
    nagasa_cm: listing.nagasa_cm,
    sori_cm: listing.sori_cm,
    motohaba_cm: listing.motohaba_cm,
    sakihaba_cm: listing.sakihaba_cm,
    kasane_cm: listing.kasane_cm,
    mei_type: listing.mei_type,
    mei_text: listing.mei_text,
    era: listing.era ?? listing.tosogu_era,
    province: listing.province,
    school: listing.school ?? listing.tosogu_school,
    cert_type: listing.cert_type,
    cert_session: listing.cert_session,
    cert_organization: listing.cert_organization,
  };

  // Artisan data — only if we have a matched artisan entity
  const artisan: CuratorNoteContext['artisan'] = artisanEntity
    ? {
        code: artisanEntity.maker_id,
        name_romaji: artisanEntity.name_romaji,
        name_kanji: artisanEntity.name_kanji,
        school: artisanEntity.school,
        province: artisanEntity.province,
        era: artisanEntity.era,
        teacher: artisanEntity.teacher,
        teacher_id: artisanEntity.teacher_id,
        designation_factor: artisanEntity.elite_factor,
        kokuho_count: artisanEntity.kokuho_count,
        jubun_count: artisanEntity.jubun_count,
        jubi_count: artisanEntity.jubi_count,
        gyobutsu_count: artisanEntity.gyobutsu_count,
        tokuju_count: artisanEntity.tokuju_count,
        juyo_count: artisanEntity.juyo_count,
        total_items: artisanEntity.total_items,
        ai_biography_en: aiDescription?.en ?? null,
      }
    : null;

  // Setsumei — only if at least one language has text
  const hasSetsumei = !!(listing.setsumei_text_en || listing.setsumei_text_ja);
  const setsumei: CuratorNoteContext['setsumei'] = hasSetsumei
    ? { text_en: listing.setsumei_text_en, text_ja: listing.setsumei_text_ja }
    : null;

  // Sayagaki — only if entries exist with content
  const sayagakiEntries = listing.sayagaki?.filter(s => s.content) ?? [];
  const sayagaki: CuratorNoteContext['sayagaki'] = sayagakiEntries.length > 0
    ? sayagakiEntries.map(s => ({
        author: s.author_custom ?? s.author ?? null,
        content: s.content,
      }))
    : null;

  // Hakogaki — only if entries exist with content
  const hakogakiEntries = listing.hakogaki?.filter(h => h.content) ?? [];
  const hakogaki: CuratorNoteContext['hakogaki'] = hakogakiEntries.length > 0
    ? hakogakiEntries.map(h => ({
        author: h.author ?? null,
        content: h.content,
      }))
    : null;

  // Provenance — only if entries exist
  const rawProv = listing.provenance;
  const provEntries = rawProv?.entries?.filter(p => p.owner_name) ?? [];
  const provenance: CuratorNoteContext['provenance'] = provEntries.length > 0
    ? provEntries.map(p => ({
        owner_name: p.owner_name,
        owner_name_ja: p.owner_name_ja,
        notes: p.notes,
      }))
    : null;

  // Kiwame — only if entries exist
  const kiwameEntries = listing.kiwame?.filter(k => k.judge_name) ?? [];
  const kiwame: CuratorNoteContext['kiwame'] = kiwameEntries.length > 0
    ? kiwameEntries.map(k => ({
        judge_name: k.judge_name,
        kiwame_type: k.kiwame_type,
        notes: k.notes,
      }))
    : null;

  // Koshirae — only if meaningful data exists
  const k = listing.koshirae;
  const hasKoshirae = !!(k && (k.cert_type || k.artisan_id || k.artisan_name || k.description));
  const koshirae: CuratorNoteContext['koshirae'] = hasKoshirae && k
    ? {
        cert_type: k.cert_type,
        cert_session: k.cert_session,
        artisan_name: k.artisan_name,
        description: k.description,
      }
    : null;

  // Research notes — free-text from dealer/collector
  const researchNotes = listing.research_notes?.trim() || null;

  return {
    sword, artisan, setsumei, sayagaki, hakogaki, provenance, kiwame, koshirae,
    research_notes: researchNotes,
    artist_overview: artistOverview ?? null,
  };
}

// =============================================================================
// INPUT HASH
// =============================================================================

/**
 * Compute a SHA-256 hash of the context to detect when source data changes.
 * Deterministic: same input always produces the same hash.
 */
export function computeInputHash(context: CuratorNoteContext): string {
  const serialized = JSON.stringify(context);
  return createHash('sha256').update(serialized).digest('hex');
}

// =============================================================================
// SKIP LOGIC
// =============================================================================

/**
 * Should we skip generation for this listing?
 * Returns true when there isn't enough material for a scholarly note.
 * "Minimal" = no artisan match AND no setsumei text.
 */
export function shouldSkipGeneration(context: CuratorNoteContext): boolean {
  return !context.artisan && !context.setsumei;
}

// =============================================================================
// DATA RICHNESS
// =============================================================================

/**
 * Classify how rich the available data is. Drives prompt length instructions.
 *
 * - full: setsumei + (sayagaki OR provenance OR koshirae) + artisan
 * - moderate: setsumei + artisan, but no sayagaki/provenance/koshirae
 * - sparse: artisan OR setsumei, but not both
 * - minimal: neither artisan nor setsumei
 */
export function getDataRichness(context: CuratorNoteContext): DataRichness {
  const hasSetsumei = !!context.setsumei;
  const hasArtisan = !!context.artisan;
  const hasSayagaki = !!context.sayagaki;
  const hasProvenance = !!context.provenance;
  const hasHakogaki = !!context.hakogaki;
  const hasKiwame = !!context.kiwame;
  const hasKoshirae = !!context.koshirae;
  const hasResearchNotes = !!context.research_notes;

  if (!hasSetsumei && !hasArtisan) return 'minimal';

  if (hasSetsumei && hasArtisan && (hasSayagaki || hasProvenance || hasHakogaki || hasKiwame || hasKoshirae || hasResearchNotes)) {
    return 'full';
  }

  if (hasSetsumei && hasArtisan) return 'moderate';

  return 'sparse';
}

// =============================================================================
// FORM DATA → CONTEXT ADAPTER (for dealer generate-description endpoint)
// =============================================================================

export interface GenerateDescriptionFormData {
  item_type: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  sakihaba_cm: number | null;
  kasane_cm: number | null;
  mei_type: string | null;
  mei_text: string | null;
  era: string | null;
  province: string | null;
  school: string | null;
  cert_type: string | null;
  cert_session: number | null;
  setsumei_text_en: string | null;
  setsumei_text_ja: string | null;
  sayagaki: SayagakiEntry[] | null;
  hakogaki: HakogakiEntry[] | null;
  provenance: ProvenanceData | null;
  kiwame: KiwameEntry[] | null;
  koshirae: KoshiraeData | null;
  research_notes: string | null;
}

/**
 * Assemble CuratorNoteContext from dealer form data (pre-save).
 * Mirrors assembleCuratorContext but takes form fields instead of a DB listing.
 */
export function assembleCuratorContextFromFormData(
  formData: GenerateDescriptionFormData,
  artisanEntity: ArtisanEntity | null,
  aiDescription: { en: string | null; ja: string | null } | null,
  artistOverview?: ArtistOverview | null
): CuratorNoteContext {
  const sword: CuratorNoteContext['sword'] = {
    item_type: formData.item_type,
    nagasa_cm: formData.nagasa_cm,
    sori_cm: formData.sori_cm,
    motohaba_cm: formData.motohaba_cm,
    sakihaba_cm: formData.sakihaba_cm,
    kasane_cm: formData.kasane_cm,
    mei_type: formData.mei_type,
    mei_text: formData.mei_text,
    era: formData.era,
    province: formData.province,
    school: formData.school,
    cert_type: formData.cert_type,
    cert_session: formData.cert_session != null ? String(formData.cert_session) : null,
    cert_organization: null,
  };

  const artisan: CuratorNoteContext['artisan'] = artisanEntity
    ? {
        code: artisanEntity.maker_id,
        name_romaji: artisanEntity.name_romaji,
        name_kanji: artisanEntity.name_kanji,
        school: artisanEntity.school,
        province: artisanEntity.province,
        era: artisanEntity.era,
        teacher: artisanEntity.teacher,
        teacher_id: artisanEntity.teacher_id,
        designation_factor: artisanEntity.elite_factor,
        kokuho_count: artisanEntity.kokuho_count,
        jubun_count: artisanEntity.jubun_count,
        jubi_count: artisanEntity.jubi_count,
        gyobutsu_count: artisanEntity.gyobutsu_count,
        tokuju_count: artisanEntity.tokuju_count,
        juyo_count: artisanEntity.juyo_count,
        total_items: artisanEntity.total_items,
        ai_biography_en: aiDescription?.en ?? null,
      }
    : null;

  const hasSetsumei = !!(formData.setsumei_text_en || formData.setsumei_text_ja);
  const setsumei: CuratorNoteContext['setsumei'] = hasSetsumei
    ? { text_en: formData.setsumei_text_en, text_ja: formData.setsumei_text_ja }
    : null;

  const sayagakiEntries = formData.sayagaki?.filter(s => s.content) ?? [];
  const sayagaki: CuratorNoteContext['sayagaki'] = sayagakiEntries.length > 0
    ? sayagakiEntries.map(s => ({
        author: s.author_custom ?? s.author ?? null,
        content: s.content,
      }))
    : null;

  const hakogakiEntries = formData.hakogaki?.filter(h => h.content) ?? [];
  const hakogaki: CuratorNoteContext['hakogaki'] = hakogakiEntries.length > 0
    ? hakogakiEntries.map(h => ({
        author: h.author ?? null,
        content: h.content,
      }))
    : null;

  const formProvEntries = formData.provenance?.entries?.filter(p => p.owner_name) ?? [];
  const provenance: CuratorNoteContext['provenance'] = formProvEntries.length > 0
    ? formProvEntries.map(p => ({
        owner_name: p.owner_name,
        owner_name_ja: p.owner_name_ja,
        notes: p.notes,
      }))
    : null;

  const kiwameEntries = formData.kiwame?.filter(k => k.judge_name) ?? [];
  const kiwame: CuratorNoteContext['kiwame'] = kiwameEntries.length > 0
    ? kiwameEntries.map(k => ({
        judge_name: k.judge_name,
        kiwame_type: k.kiwame_type,
        notes: k.notes,
      }))
    : null;

  const k = formData.koshirae;
  const hasKoshirae = !!(k && (k.cert_type || k.artisan_id || k.artisan_name || k.description));
  const koshirae: CuratorNoteContext['koshirae'] = hasKoshirae && k
    ? {
        cert_type: k.cert_type,
        cert_session: k.cert_session,
        artisan_name: k.artisan_name,
        description: k.description,
      }
    : null;

  // Research notes — free-text from dealer/collector
  const researchNotes = formData.research_notes?.trim() || null;

  return {
    sword, artisan, setsumei, sayagaki, hakogaki, provenance, kiwame, koshirae,
    research_notes: researchNotes,
    artist_overview: artistOverview ?? null,
  };
}
