/**
 * Backfill elite_factor from Yuhinkai database to listings table
 *
 * This script:
 * 1. Fetches all listings with artisan_id (matched to Yuhinkai)
 * 2. Looks up elite_factor from smith_entities or tosogu_makers
 * 3. Updates listings.artisan_elite_factor in batches
 *
 * Run with: npx tsx scripts/backfill-elite-factor.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Main Supabase (listings)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Yuhinkai Supabase (smith_entities, tosogu_makers)
const yuhinkaiUrl = process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL || '';
const yuhinkaiKey =
  process.env.YUHINKAI_SUPABASE_KEY ||
  process.env.OSHI_V2_SUPABASE_KEY ||
  process.env.OSHI_V2_SUPABASE_ANON_KEY ||
  '';

if (!yuhinkaiUrl || !yuhinkaiKey) {
  console.error('Yuhinkai database credentials not configured.');
  console.error('Set YUHINKAI_SUPABASE_URL and YUHINKAI_SUPABASE_KEY in .env.local');
  process.exit(1);
}

const yuhinkai = createClient(yuhinkaiUrl, yuhinkaiKey);

const BATCH_SIZE = 500; // Fetch 500 listings at a time
const CONCURRENT_WORKERS = 20; // Process 20 listings concurrently

interface ListingWithArtisan {
  id: string;
  artisan_id: string;
}

// Cache for elite factors to avoid redundant lookups
const eliteFactorCache = new Map<string, number | null>();

async function getEliteFactor(artisanCode: string): Promise<number | null> {
  // Check cache first
  if (eliteFactorCache.has(artisanCode)) {
    return eliteFactorCache.get(artisanCode)!;
  }

  // Try smith_entities first (blade smiths)
  const { data: smith } = await yuhinkai
    .from('smith_entities')
    .select('elite_factor')
    .eq('smith_id', artisanCode)
    .single();

  if (smith?.elite_factor !== undefined) {
    eliteFactorCache.set(artisanCode, smith.elite_factor);
    return smith.elite_factor;
  }

  // Try tosogu_makers (fitting makers)
  const { data: maker } = await yuhinkai
    .from('tosogu_makers')
    .select('elite_factor')
    .eq('maker_id', artisanCode)
    .single();

  if (maker?.elite_factor !== undefined) {
    eliteFactorCache.set(artisanCode, maker.elite_factor);
    return maker.elite_factor;
  }

  eliteFactorCache.set(artisanCode, null);
  return null;
}

async function processListing(
  listing: ListingWithArtisan
): Promise<{ id: string; elite_factor: number } | null> {
  const eliteFactor = await getEliteFactor(listing.artisan_id);
  if (eliteFactor !== null) {
    return { id: listing.id, elite_factor: eliteFactor };
  }
  return null;
}

async function processChunk<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  return results;
}

async function backfillEliteFactors() {
  console.log(`Starting elite factor backfill with ${CONCURRENT_WORKERS} workers...\n`);

  // Count total listings with artisan_id that don't have elite_factor yet
  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .not('artisan_id', 'is', null)
    .is('artisan_elite_factor', null);

  console.log(`Found ${count} listings needing elite_factor backfill.\n`);

  if (!count || count === 0) {
    console.log('No listings to process.');
    return;
  }

  let processed = 0;
  let updated = 0;
  let notFound = 0;
  let offset = 0;

  const startTime = Date.now();

  while (offset < count) {
    // Fetch batch of listings with artisan_id that need backfill
    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, artisan_id')
      .not('artisan_id', 'is', null)
      .is('artisan_elite_factor', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching listings:', error);
      break;
    }

    if (!listings || listings.length === 0) {
      break;
    }

    // Process listings concurrently
    const results = await processChunk(
      listings as ListingWithArtisan[],
      processListing,
      CONCURRENT_WORKERS
    );

    const updates = results.filter((r): r is { id: string; elite_factor: number } => r !== null);
    notFound += results.filter((r) => r === null).length;
    processed += listings.length;

    // Batch update listings with elite_factor using concurrent updates
    if (updates.length > 0) {
      const updateResults = await processChunk(
        updates,
        async (update) => {
          const { error: updateError } = await supabase
            .from('listings')
            .update({ artisan_elite_factor: update.elite_factor })
            .eq('id', update.id);
          return !updateError;
        },
        CONCURRENT_WORKERS
      );
      updated += updateResults.filter(Boolean).length;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (processed / parseFloat(elapsed)).toFixed(0);
    console.log(
      `Progress: ${processed}/${count} (${rate}/s) | Updated: ${updated} | Not found: ${notFound} | Cache: ${eliteFactorCache.size} artisans`
    );

    offset += BATCH_SIZE;
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Backfill Complete ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Artisan not found in Yuhinkai: ${notFound}`);
  console.log(`Time elapsed: ${totalTime}s`);
  console.log(`Unique artisans cached: ${eliteFactorCache.size}`);
}

backfillEliteFactors()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
