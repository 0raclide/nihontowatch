/**
 * Oshi-v2 (Yuhinkai) Database Client
 *
 * Provides read-only access to the oshi-v2 Supabase database
 * for fetching catalog records and enrichment data.
 *
 * Environment Variables Required:
 * - OSHI_V2_SUPABASE_URL: The oshi-v2 Supabase project URL
 * - OSHI_V2_SUPABASE_ANON_KEY: Read-only anon key for oshi-v2
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Catalog record from oshi-v2 database.
 * Contains the setsumei text and metadata for a designated item.
 */
export interface CatalogRecord {
  uuid: string;
  object_uuid: string;
  collection: string;
  volume: number;
  item_number: number;
  catalog_id: string | null;
  japanese_txt: string | null;
  translation_md: string | null;
  metadata: CatalogMetadata | null;
  designation_date: string | null;
  session_number: number | null;
}

/**
 * Metadata structure from catalog_records.metadata JSONB field.
 */
export interface CatalogMetadata {
  smith?: {
    name_romaji?: string;
    name_kanji?: string;
    school?: string;
    tradition?: string;
    active_period?: string;
    residence?: string;
  };
  maker?: {
    name_romaji?: string;
    name_kanji?: string;
    school?: string;
  };
  measurements?: {
    nagasa?: number;
    sori?: number;
    motohaba?: number;
    sakihaba?: number;
    kasane?: number;
  };
  era?: {
    period?: string;
    sub_period?: string;
    western_year?: number;
  };
  classification?: string;
  blade_type?: string;
  form_type?: string;
  [key: string]: unknown;
}

/**
 * Physical object from oshi-v2 database.
 * Represents a unique physical sword/tosogu that may appear in multiple catalogs.
 */
export interface PhysicalObject {
  uuid: string;
  object_type: string;
  primary_name: string | null;
  smith_name: string | null;
  highest_designation: string | null;
}

// =============================================================================
// CLIENT SINGLETON
// =============================================================================

let oshiV2Client: SupabaseClient | null = null;

/**
 * Get or create the oshi-v2 Supabase client.
 * Uses lazy initialization to avoid errors if env vars are not set.
 *
 * @throws Error if environment variables are not configured
 */
export function getOshiV2Client(): SupabaseClient {
  if (oshiV2Client) {
    return oshiV2Client;
  }

  const url = process.env.OSHI_V2_SUPABASE_URL;
  const key = process.env.OSHI_V2_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      'OSHI_V2_SUPABASE_URL is not configured. ' +
      'Add it to your .env.local file to enable Yuhinkai catalog lookups.'
    );
  }

  if (!key) {
    throw new Error(
      'OSHI_V2_SUPABASE_ANON_KEY is not configured. ' +
      'Add it to your .env.local file to enable Yuhinkai catalog lookups.'
    );
  }

  oshiV2Client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return oshiV2Client;
}

/**
 * Check if the oshi-v2 client is configured.
 * Useful for conditionally enabling features.
 */
export function isOshiV2Configured(): boolean {
  return !!(
    process.env.OSHI_V2_SUPABASE_URL &&
    process.env.OSHI_V2_SUPABASE_ANON_KEY
  );
}

// =============================================================================
// DATA ACCESS FUNCTIONS
// =============================================================================

/**
 * Fetch a catalog record by collection, volume, and item number.
 *
 * @param collection - The collection name (e.g., 'Juyo', 'Tokuju')
 * @param volume - The volume number
 * @param itemNumber - The item number within the volume
 * @returns The catalog record or null if not found
 */
export async function fetchCatalogRecord(
  collection: string,
  volume: number,
  itemNumber: number
): Promise<CatalogRecord | null> {
  const client = getOshiV2Client();

  const { data, error } = await client
    .from('catalog_records')
    .select(`
      uuid,
      object_uuid,
      collection,
      volume,
      item_number,
      catalog_id,
      japanese_txt,
      translation_md,
      metadata,
      designation_date,
      session_number
    `)
    .eq('collection', collection)
    .eq('volume', volume)
    .eq('item_number', itemNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found - not an error, just no match
      return null;
    }
    console.error('[oshiV2Client] Failed to fetch catalog record:', error);
    throw new Error(`Failed to fetch catalog record: ${error.message}`);
  }

  return data as CatalogRecord;
}

/**
 * Fetch a catalog record by its UUID.
 *
 * @param uuid - The catalog record UUID
 * @returns The catalog record or null if not found
 */
export async function fetchCatalogRecordByUuid(
  uuid: string
): Promise<CatalogRecord | null> {
  const client = getOshiV2Client();

  const { data, error } = await client
    .from('catalog_records')
    .select(`
      uuid,
      object_uuid,
      collection,
      volume,
      item_number,
      catalog_id,
      japanese_txt,
      translation_md,
      metadata,
      designation_date,
      session_number
    `)
    .eq('uuid', uuid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[oshiV2Client] Failed to fetch catalog record by UUID:', error);
    throw new Error(`Failed to fetch catalog record: ${error.message}`);
  }

  return data as CatalogRecord;
}

/**
 * Fetch the physical object for a catalog record.
 *
 * @param objectUuid - The physical object UUID
 * @returns The physical object or null if not found
 */
export async function fetchPhysicalObject(
  objectUuid: string
): Promise<PhysicalObject | null> {
  const client = getOshiV2Client();

  const { data, error } = await client
    .from('physical_objects')
    .select(`
      uuid,
      object_type,
      primary_name,
      smith_name,
      highest_designation
    `)
    .eq('uuid', objectUuid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[oshiV2Client] Failed to fetch physical object:', error);
    throw new Error(`Failed to fetch physical object: ${error.message}`);
  }

  return data as PhysicalObject;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract artisan name from catalog metadata.
 * Handles both swords (smith) and tosogu (maker).
 */
export function extractArtisanName(metadata: CatalogMetadata | null): string | null {
  if (!metadata) return null;

  // Try smith first (swords)
  if (metadata.smith?.name_romaji) {
    return metadata.smith.name_romaji;
  }

  // Fall back to maker (tosogu)
  if (metadata.maker?.name_romaji) {
    return metadata.maker.name_romaji;
  }

  return null;
}

/**
 * Extract artisan name in kanji from catalog metadata.
 */
export function extractArtisanKanji(metadata: CatalogMetadata | null): string | null {
  if (!metadata) return null;

  if (metadata.smith?.name_kanji) {
    return metadata.smith.name_kanji;
  }

  if (metadata.maker?.name_kanji) {
    return metadata.maker.name_kanji;
  }

  return null;
}

/**
 * Extract school name from catalog metadata.
 */
export function extractSchool(metadata: CatalogMetadata | null): string | null {
  if (!metadata) return null;

  if (metadata.smith?.school) {
    return metadata.smith.school;
  }

  if (metadata.maker?.school) {
    return metadata.maker.school;
  }

  return null;
}

/**
 * Extract period from catalog metadata.
 */
export function extractPeriod(metadata: CatalogMetadata | null): string | null {
  if (!metadata) return null;

  if (metadata.era?.period) {
    const subPeriod = metadata.era.sub_period;
    return subPeriod
      ? `${subPeriod} ${metadata.era.period}`
      : metadata.era.period;
  }

  if (metadata.smith?.active_period) {
    return metadata.smith.active_period;
  }

  return null;
}

/**
 * Determine item category from metadata.
 */
export function extractItemCategory(metadata: CatalogMetadata | null): 'blade' | 'tosogu' {
  if (!metadata) return 'blade';

  // If it has a maker field, it's tosogu
  if (metadata.maker) {
    return 'tosogu';
  }

  // If it has form_type, likely tosogu
  if (metadata.form_type) {
    return 'tosogu';
  }

  // Default to blade
  return 'blade';
}

/**
 * Get certification type string from collection name.
 */
export function getCertTypeFromCollection(collection: string): string {
  const certTypes: Record<string, string> = {
    Kokuho: 'Kokuho',
    Tokuju: 'Tokubetsu Juyo',
    Juyo: 'Juyo',
    JuBun: 'Juyo Bijutsuhin',
    Jubi: 'Juyo Bijutsuhin',
    IMP_Koto: 'Imperial',
    IMP_Shin: 'Imperial',
    JE_Koto: 'JE Koto',
  };
  return certTypes[collection] || collection;
}
