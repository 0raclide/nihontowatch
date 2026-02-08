import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for Yuhinkai database (artist profiles, smith entities, etc.)
 * This is a separate database from the main NihontoWatch database.
 */

// Support both naming conventions (YUHINKAI_* or OSHI_V2_*)
const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey = process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY || '';

if (!yuhinkaiUrl) {
  console.error('[Yuhinkai] YUHINKAI_SUPABASE_URL is not configured.');
}
if (!yuhinkaiKey) {
  console.error('[Yuhinkai] YUHINKAI_SUPABASE_KEY is not configured.');
}

export const yuhinkaiClient = createClient(yuhinkaiUrl, yuhinkaiKey);

export interface ArtistProfile {
  id: string;
  artist_code: string;
  artist_type: 'smith' | 'tosogu_maker';
  profile_md: string;
  hook: string | null;
  setsumei_count: number;
  extraction_json: Record<string, unknown>;
  stats_snapshot: Record<string, unknown>;
  profile_depth: 'full' | 'standard' | 'brief';
  human_reviewed: boolean;
  quality_flags: string[];
  generated_at: string;
  model_version: string;
  pipeline_version: string;
  created_at: string;
  updated_at: string;
}

export interface SmithEntity {
  smith_id: string;
  name_kanji: string | null;
  name_romaji: string | null;
  province: string | null;
  school: string | null;
  era: string | null;
  period: string | null;
  generation: string | null;
  teacher: string | null;
  hawley: number | null;
  fujishiro: string | null;
  toko_taikan: number | null;
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_count: number;
  elite_factor: number;
  is_school_code: boolean;
}

export interface TosoguMaker {
  maker_id: string;
  name_kanji: string | null;
  name_romaji: string | null;
  province: string | null;
  school: string | null;
  era: string | null;
  generation: string | null;
  teacher: string | null;
  specialties: string[] | null;
  alternative_names: string[] | null;
  notes: string | null;
  // Certification counts (highest prestige first)
  kokuho_count: number;   // National Treasures
  jubun_count: number;    // Important Cultural Properties (Bunkazai)
  jubi_count: number;     // Important Art Objects (Bijutsuhin)
  gyobutsu_count: number; // Imperial Collection
  tokuju_count: number;   // Tokubetsu Juyo
  juyo_count: number;     // Juyo
  total_items: number;
  elite_count: number;
  elite_factor: number;
  is_school_code: boolean;
}

export async function getArtistProfile(code: string): Promise<ArtistProfile | null> {
  const { data, error } = await yuhinkaiClient
    .from('artist_profiles')
    .select('*')
    .eq('artist_code', code)
    .single();

  if (error || !data) {
    console.error('[Yuhinkai] Error fetching artist profile:', error);
    return null;
  }

  return data as ArtistProfile;
}

export async function getSmithEntity(code: string): Promise<SmithEntity | null> {
  const { data, error } = await yuhinkaiClient
    .from('smith_entities')
    .select('*')
    .eq('smith_id', code)
    .single();

  if (error || !data) {
    return null;
  }

  return data as SmithEntity;
}

export async function getTosoguMaker(code: string): Promise<TosoguMaker | null> {
  const { data, error } = await yuhinkaiClient
    .from('tosogu_makers')
    .select('*')
    .eq('maker_id', code)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TosoguMaker;
}
