/**
 * Backfill composite thumbnails for listings with extreme aspect ratio images
 *
 * For listings where the cover image has an extreme aspect ratio (w/h > 4),
 * generates a vertical composite thumbnail that stacks multiple panoramic strips
 * into a single 600x800 portrait image on a dark background.
 *
 * Run with: npx tsx scripts/backfill-composite-thumbnails.ts
 * Options:
 *   --dry-run         Show what would be processed without writing to DB/storage
 *   --limit N         Process at most N listings
 *   --dealer "Name"   Only process listings from a specific dealer
 *   --recompute       Re-process listings that already have composite thumbnails
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import sharp from 'sharp';

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

const BATCH_SIZE = 50;
const CONCURRENT_WORKERS = 3;
const COMPOSITE_WIDTH = 600;
const COMPOSITE_HEIGHT = 800;
const STRIP_GAP = 6;
const PANORAMIC_THRESHOLD = 3; // Individual image w/h ratio to qualify as a strip
const COMPOSITE_TRIGGER_RATIO = 4; // Cover image w/h ratio to trigger composite generation
const MAX_SCALE_UP = 1.5; // Maximum upscale factor to limit blur
const BG_COLOR = { r: 23, g: 23, b: 23 }; // #171717

interface ListingRow {
  id: number;
  stored_images: string[] | null;
  images: string[] | null;
  image_width: number;
  image_height: number;
  dealer_id: number;
  dealers: { name: string } | null;
}

/**
 * Get all usable image URLs for a listing.
 * Prefers stored_images (Supabase Storage) over original dealer URLs.
 */
function getAllImageUrls(listing: ListingRow): string[] {
  const stored = listing.stored_images;
  if (stored && stored.length > 0) return stored.filter(Boolean);
  const original = listing.images;
  if (original && original.length > 0) return original.filter(Boolean);
  return [];
}

/**
 * Download an image and return it as a Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NihontoWatch-CompositeBackfill/1.0',
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
 * Create a dealer slug from dealer name (matches storage path convention).
 */
function createDealerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface StripInfo {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Resize a strip buffer, clamping to canvas bounds to prevent sharp composite errors.
 * Sharp requires all composite overlays to fit within the canvas dimensions.
 */
async function resizeStripClamped(strip: StripInfo, targetWidth: number, scaleFactor: number): Promise<StripInfo> {
  const newWidth = Math.min(Math.round(strip.width * scaleFactor), targetWidth);
  const newHeight = Math.max(1, Math.round(strip.height * scaleFactor));
  const buf = await sharp(strip.buffer)
    .resize(newWidth, newHeight, { fit: 'fill' })
    .toBuffer();
  return { buffer: buf, width: newWidth, height: newHeight };
}

/**
 * Generate a composite thumbnail from panoramic strip images.
 * Stacks strips vertically on a dark canvas (600x800).
 */
async function generateComposite(strips: StripInfo[]): Promise<Buffer> {
  // Scale all strips to COMPOSITE_WIDTH
  const scaledStrips: StripInfo[] = [];
  for (const strip of strips) {
    const scale = COMPOSITE_WIDTH / strip.width;
    const newHeight = Math.max(1, Math.round(strip.height * scale));
    const scaledBuffer = await sharp(strip.buffer)
      .resize(COMPOSITE_WIDTH, newHeight, { fit: 'fill' })
      .toBuffer();
    scaledStrips.push({ buffer: scaledBuffer, width: COMPOSITE_WIDTH, height: newHeight });
  }

  // Calculate total height with gaps
  const totalGaps = (scaledStrips.length - 1) * STRIP_GAP;
  const totalStripHeight = scaledStrips.reduce((sum, s) => sum + s.height, 0);
  const totalContentHeight = totalStripHeight + totalGaps;

  // Scale to fit within COMPOSITE_HEIGHT
  let finalStrips = scaledStrips;
  let finalGap = STRIP_GAP;
  let yStart = 0;

  if (totalContentHeight > COMPOSITE_HEIGHT) {
    // Scale down to fit
    const scaleFactor = COMPOSITE_HEIGHT / totalContentHeight;
    const resizedStrips: StripInfo[] = [];
    for (const strip of scaledStrips) {
      resizedStrips.push(await resizeStripClamped(strip, COMPOSITE_WIDTH, scaleFactor));
    }
    finalStrips = resizedStrips;
    finalGap = Math.max(1, Math.round(STRIP_GAP * scaleFactor));
  } else if (totalContentHeight < COMPOSITE_HEIGHT) {
    // Scale up (capped at MAX_SCALE_UP to limit blur)
    const scaleFactor = Math.min(COMPOSITE_HEIGHT / totalContentHeight, MAX_SCALE_UP);
    if (scaleFactor > 1.05) {
      const resizedStrips: StripInfo[] = [];
      for (const strip of scaledStrips) {
        resizedStrips.push(await resizeStripClamped(strip, COMPOSITE_WIDTH, scaleFactor));
      }
      finalStrips = resizedStrips;
      finalGap = Math.round(STRIP_GAP * scaleFactor);
    }
    // Center vertically
    const finalHeight = finalStrips.reduce((sum, s) => sum + s.height, 0) + (finalStrips.length - 1) * finalGap;
    yStart = Math.max(0, Math.round((COMPOSITE_HEIGHT - finalHeight) / 2));
  }

  // Build composite overlays — clamp each overlay to fit within canvas
  const overlays: { input: Buffer; top: number; left: number }[] = [];
  let currentY = Math.max(0, yStart);
  for (const strip of finalStrips) {
    // Clamp: ensure overlay fits within canvas bounds
    const left = Math.max(0, Math.round((COMPOSITE_WIDTH - strip.width) / 2));
    const top = Math.max(0, Math.min(currentY, COMPOSITE_HEIGHT - 1));

    // Skip if strip would start beyond canvas
    if (top >= COMPOSITE_HEIGHT) break;

    // If strip extends past canvas bottom, crop it
    let overlayBuffer = strip.buffer;
    let overlayHeight = strip.height;
    if (top + strip.height > COMPOSITE_HEIGHT) {
      overlayHeight = COMPOSITE_HEIGHT - top;
      overlayBuffer = await sharp(strip.buffer)
        .extract({ left: 0, top: 0, width: strip.width, height: overlayHeight })
        .toBuffer();
    }
    // If strip extends past canvas right, crop it
    if (left + strip.width > COMPOSITE_WIDTH) {
      const overlayWidth = COMPOSITE_WIDTH - left;
      overlayBuffer = await sharp(overlayBuffer)
        .extract({ left: 0, top: 0, width: overlayWidth, height: overlayHeight })
        .toBuffer();
    }

    overlays.push({ input: overlayBuffer, top, left });
    currentY += strip.height + finalGap;
  }

  // Create dark canvas and composite strips
  const result = await sharp({
    create: {
      width: COMPOSITE_WIDTH,
      height: COMPOSITE_HEIGHT,
      channels: 3,
      background: BG_COLOR,
    },
  })
    .composite(overlays)
    .jpeg({ quality: 85 })
    .toBuffer();

  return result;
}

/**
 * Process a single listing: download images, filter panoramic strips, generate composite.
 */
async function processListing(listing: ListingRow): Promise<{ id: number; thumbnailBuffer: Buffer; storagePath: string } | null> {
  const imageUrls = getAllImageUrls(listing);
  if (imageUrls.length === 0) return null;

  const dealerSlug = listing.dealers?.name
    ? createDealerSlug(listing.dealers.name)
    : `dealer-${listing.dealer_id}`;
  const paddedId = String(listing.id).padStart(5, '0');
  const storagePath = `${dealerSlug}/L${paddedId}/composite.jpg`;

  try {
    // Download all images and get their dimensions
    const imageData: StripInfo[] = [];
    for (const url of imageUrls) {
      try {
        const buffer = await downloadImage(url);
        const metadata = await sharp(buffer).metadata();
        if (metadata.width && metadata.height) {
          imageData.push({
            buffer,
            width: metadata.width,
            height: metadata.height,
          });
        }
      } catch {
        // Skip individual images that fail to download
        continue;
      }
    }

    // Filter for panoramic strips (w/h > PANORAMIC_THRESHOLD)
    const strips = imageData.filter(img => img.width / img.height > PANORAMIC_THRESHOLD);

    // Need at least 2 strips to make a composite worthwhile
    if (strips.length < 2) return null;

    const thumbnailBuffer = await generateComposite(strips);
    return { id: listing.id, thumbnailBuffer, storagePath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
  console.log('=== Composite Thumbnail Backfill ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (dealerName) console.log(`Dealer filter: ${dealerName}`);
  if (limit < Infinity) console.log(`Limit: ${limit}`);
  if (recompute) console.log(`Recompute: overwriting existing composites`);
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

  // Count eligible listings (extreme aspect ratio with dimensions populated)
  let countQuery = supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .not('image_width', 'is', null)
    .not('image_height', 'is', null)
    .not('images', 'is', null);

  if (!recompute) {
    countQuery = countQuery.is('thumbnail_url', null);
  }
  if (dealerId !== null) {
    countQuery = countQuery.eq('dealer_id', dealerId);
  }

  const { count: totalCount } = await countQuery;
  console.log(`Found ${totalCount} listings with dimensions. Filtering for extreme aspect ratios...\n`);

  let processed = 0;
  let composited = 0;
  let skipped = 0;
  let uploaded = 0;
  let offset = 0;
  const effectiveLimit = Math.min(totalCount || 0, limit);

  const startTime = Date.now();

  while (processed < effectiveLimit) {
    const batchLimit = Math.min(BATCH_SIZE, effectiveLimit - processed);

    // Fetch listings with extreme aspect ratios
    let query = supabase
      .from('listings')
      .select('id, stored_images, images, image_width, image_height, dealer_id, dealers(name)')
      .not('image_width', 'is', null)
      .not('image_height', 'is', null)
      .not('images', 'is', null);

    if (!recompute) {
      query = query.is('thumbnail_url', null);
    }
    if (dealerId !== null) {
      query = query.eq('dealer_id', dealerId);
    }
    query = query.range(offset, offset + batchLimit - 1);

    const { data: listings, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      break;
    }

    if (!listings || listings.length === 0) break;

    // Filter for extreme aspect ratios in JS (PostgREST can't do column arithmetic)
    const extremeRatioListings = (listings as unknown as ListingRow[]).filter(
      l => l.image_width / l.image_height > COMPOSITE_TRIGGER_RATIO
    );

    const nonExtremeCount = listings.length - extremeRatioListings.length;
    skipped += nonExtremeCount;

    // Process listings concurrently
    const results = await processChunk(
      extremeRatioListings,
      processListing,
      CONCURRENT_WORKERS
    );

    const successes = results.filter((r): r is { id: number; thumbnailBuffer: Buffer; storagePath: string } => r !== null);
    const batchFailed = extremeRatioListings.length - successes.length;
    skipped += batchFailed;

    // Upload to Supabase Storage and write thumbnail_url to DB
    for (const { id, thumbnailBuffer, storagePath } of successes) {
      if (dryRun) {
        console.log(`  [dry-run] listing ${id}: would upload ${storagePath} (${(thumbnailBuffer.length / 1024).toFixed(1)}KB)`);
        composited++;
        continue;
      }

      try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(storagePath, thumbnailBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.warn(`  Upload error for listing ${id}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('listing-images')
          .getPublicUrl(storagePath);

        const publicUrl = urlData.publicUrl;

        // Write thumbnail_url to DB
        const { error: updateError } = await supabase
          .from('listings')
          .update({ thumbnail_url: publicUrl })
          .eq('id', id);

        if (updateError) {
          console.warn(`  DB update error for listing ${id}: ${updateError.message}`);
          continue;
        }

        uploaded++;
        composited++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  Error processing listing ${id}: ${msg}`);
      }
    }

    processed += listings.length;
    // In default mode, successfully updated rows drop out of the thumbnail_url IS NULL filter.
    // Advance offset by the number of rows that stay (non-extreme + failed).
    offset += recompute ? batchLimit : (nonExtremeCount + batchFailed);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = processed > 0 ? (processed / parseFloat(elapsed)).toFixed(1) : '0';
    console.log(
      `Progress: ${processed}/${effectiveLimit} (${rate}/s) | Composited: ${composited} | Uploaded: ${uploaded} | Skipped: ${skipped}`
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Backfill Complete ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully ${dryRun ? 'would composite' : 'composited'}: ${composited}`);
  console.log(`Uploaded to storage: ${uploaded}`);
  console.log(`Skipped (not extreme ratio / download failed / <2 strips): ${skipped}`);
  console.log(`Time elapsed: ${totalTime}s`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
