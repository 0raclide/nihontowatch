/**
 * Backfill smart crop focal points for listing cover images
 *
 * Uses smartcrop-sharp to detect the optimal focal point for each listing's
 * cover image, storing it as focal_x/focal_y (0-100%) for object-position CSS.
 *
 * Run with: npx tsx scripts/backfill-focal-points.ts
 * Options:
 *   --dry-run         Show what would be processed without writing to DB
 *   --limit N         Process at most N listings
 *   --dealer "Name"   Only process listings from a specific dealer
 *   --recompute       Re-process listings that already have focal points
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import sharp from 'sharp';
import smartcrop from 'smartcrop-sharp';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const recompute = args.includes('--recompute');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const dealerIdx = args.indexOf('--dealer');
const dealerName = dealerIdx !== -1 ? args[dealerIdx + 1] : null;

const BATCH_SIZE = 100;
const CONCURRENT_WORKERS = 5;
const MAX_DIMENSION = 512; // Resize to max 512px for faster analysis
const CROP_ASPECT_W = 3;   // Target aspect ratio for crop detection
const CROP_ASPECT_H = 4;

interface ListingRow {
  id: number;
  stored_images: string[] | null;
  images: string[] | null;
}

/**
 * Get the first usable image URL for a listing.
 * Prefers stored_images (Supabase Storage) over original dealer URLs.
 */
function getFirstImageUrl(listing: ListingRow): string | null {
  const stored = listing.stored_images;
  if (stored && stored.length > 0 && stored[0]) return stored[0];
  const original = listing.images;
  if (original && original.length > 0 && original[0]) return original[0];
  return null;
}

/**
 * Download an image and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NihontoWatch-FocalPointBackfill/1.0',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Compute the focal point for an image buffer.
 * Returns { x, y } as percentages (0-100).
 */
async function computeFocalPoint(imageBuffer: Buffer): Promise<{ x: number; y: number; width: number; height: number }> {
  // Get original dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const origWidth = metadata.width || 800;
  const origHeight = metadata.height || 600;

  // Resize to max dimension for faster analysis
  const scale = Math.min(MAX_DIMENSION / origWidth, MAX_DIMENSION / origHeight, 1);
  const analysisWidth = Math.round(origWidth * scale);
  const analysisHeight = Math.round(origHeight * scale);

  const resizedBuffer = await sharp(imageBuffer)
    .resize(analysisWidth, analysisHeight, { fit: 'inside' })
    .toBuffer();

  // Use 3:4 aspect ratio crop target (matching card thumbnail proportions)
  const cropWidth = Math.min(analysisWidth, Math.round(analysisHeight * CROP_ASPECT_W / CROP_ASPECT_H));
  const cropHeight = Math.min(analysisHeight, Math.round(analysisWidth * CROP_ASPECT_H / CROP_ASPECT_W));

  const result = await smartcrop.crop(resizedBuffer, {
    width: cropWidth,
    height: cropHeight,
  });

  const crop = result.topCrop;

  // Convert crop center to percentage of original image
  const centerX = (crop.x + crop.width / 2) / analysisWidth * 100;
  const centerY = (crop.y + crop.height / 2) / analysisHeight * 100;

  // Round to 1 decimal place
  return {
    x: Math.round(centerX * 10) / 10,
    y: Math.round(centerY * 10) / 10,
    width: origWidth,
    height: origHeight,
  };
}

/**
 * Process a single listing: download image, compute focal point.
 */
async function processListing(listing: ListingRow): Promise<{ id: number; focal_x: number; focal_y: number; image_width: number; image_height: number } | null> {
  const imageUrl = getFirstImageUrl(listing);
  if (!imageUrl) return null;

  try {
    const buffer = await downloadImage(imageUrl);
    const { x, y, width, height } = await computeFocalPoint(buffer);
    return { id: listing.id, focal_x: x, focal_y: y, image_width: width, image_height: height };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Don't log every failure — just count them
    if (msg.includes('HTTP 4') || msg.includes('HTTP 5')) {
      return null; // Image not accessible
    }
    console.warn(`  Warning: listing ${listing.id}: ${msg}`);
    return null;
  }
}

/**
 * Process items in chunks with bounded concurrency.
 */
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

async function main() {
  console.log('=== Smart Crop Focal Point Backfill ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (dealerName) console.log(`Dealer filter: ${dealerName}`);
  if (limit < Infinity) console.log(`Limit: ${limit}`);
  if (recompute) console.log(`Recompute: overwriting existing focal points`);
  console.log('');

  // Resolve dealer ID if filter is set
  let dealerId: number | null = null;
  if (dealerName) {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('id')
      .ilike('name', dealerName)
      .single();
    if (!dealer) {
      console.error(`Dealer "${dealerName}" not found.`);
      process.exit(1);
    }
    dealerId = dealer.id;
  }

  // Count eligible listings
  let countQuery = supabase
    .from('listings')
    .select('id', { count: 'exact', head: true });

  if (!recompute) {
    countQuery = countQuery.is('focal_x', null);
  }
  if (dealerId !== null) {
    countQuery = countQuery.eq('dealer_id', dealerId);
  }
  // Only listings with images
  countQuery = countQuery.not('images', 'is', null);

  const { count: totalCount } = await countQuery;
  const effectiveCount = Math.min(totalCount || 0, limit);
  console.log(`Found ${totalCount} eligible listings. Processing ${effectiveCount}.\n`);

  if (effectiveCount === 0) {
    console.log('Nothing to process.');
    return;
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let offset = 0;

  const startTime = Date.now();

  while (processed < effectiveCount) {
    const batchLimit = Math.min(BATCH_SIZE, effectiveCount - processed);

    let query = supabase
      .from('listings')
      .select('id, stored_images, images');

    if (!recompute) {
      query = query.is('focal_x', null);
    }
    if (dealerId !== null) {
      query = query.eq('dealer_id', dealerId);
    }
    query = query.not('images', 'is', null);
    query = query.range(offset, offset + batchLimit - 1);

    const { data: listings, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      break;
    }

    if (!listings || listings.length === 0) {
      break;
    }

    // Process listings concurrently
    const results = await processChunk(
      listings as ListingRow[],
      processListing,
      CONCURRENT_WORKERS
    );

    const updates = results.filter((r): r is { id: number; focal_x: number; focal_y: number; image_width: number; image_height: number } => r !== null);
    const batchFailed = results.filter(r => r === null).length;
    failed += batchFailed;
    skipped += batchFailed;

    // Write updates to DB
    if (!dryRun && updates.length > 0) {
      const writeResults = await processChunk(
        updates,
        async (update) => {
          const { error: updateError } = await supabase
            .from('listings')
            .update({
              focal_x: update.focal_x,
              focal_y: update.focal_y,
              image_width: update.image_width,
              image_height: update.image_height,
            })
            .eq('id', update.id);
          return !updateError;
        },
        CONCURRENT_WORKERS
      );
      updated += writeResults.filter(Boolean).length;
    } else if (dryRun) {
      updated += updates.length;
      for (const u of updates.slice(0, 3)) {
        console.log(`  [dry-run] listing ${u.id}: focal_x=${u.focal_x}%, focal_y=${u.focal_y}%, ${u.image_width}x${u.image_height}`);
      }
      if (updates.length > 3) {
        console.log(`  [dry-run] ... and ${updates.length - 3} more`);
      }
    }

    processed += listings.length;
    // In default mode (focal_x IS NULL filter), successfully updated rows drop
    // out of the result set. Only advance offset by failed count (those rows
    // stay NULL and would be re-fetched). In --recompute mode the filter doesn't
    // shrink, so advance by full batch.
    offset += recompute ? batchLimit : batchFailed;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (processed / parseFloat(elapsed)).toFixed(1);
    console.log(
      `Progress: ${processed}/${effectiveCount} (${rate}/s) | Updated: ${updated} | Skipped: ${skipped}`
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Backfill Complete ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully ${dryRun ? 'would update' : 'updated'}: ${updated}`);
  console.log(`Skipped (no image / download failed): ${skipped}`);
  console.log(`Time elapsed: ${totalTime}s`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
