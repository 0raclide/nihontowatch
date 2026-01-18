#!/usr/bin/env node
/**
 * Bulk Wayback Machine checker
 *
 * Runs locally with concurrent requests to quickly process all listings.
 * Uses 5 concurrent requests with 200ms delay between batches.
 *
 * Usage: node scripts/bulk-wayback-check.mjs [--limit N] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;

// Parse .env.local
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Wayback CDX API
const CDX_API_BASE = 'https://web.archive.org/cdx/search/cdx';
const REQUEST_TIMEOUT_MS = 30000; // 30s timeout - CDX can be slow

// Concurrency settings - slower to avoid blocks
const CONCURRENT_REQUESTS = 2; // Lower to avoid rate limits
const BATCH_DELAY_MS = 3000; // 3s delay between batches

// Progress file - use absolute path for nohup compatibility
const PROGRESS_FILE = '/Users/christopherhill/Desktop/Claude_project/nihontowatch/wayback-progress.json';

function parseWaybackTimestamp(timestamp) {
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  const hour = timestamp.slice(8, 10);
  const minute = timestamp.slice(10, 12);
  const second = timestamp.slice(12, 14);
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

async function checkWaybackArchiveSingle(url) {
  const params = new URLSearchParams({
    url: url,
    limit: '1',
    output: 'json',
    fl: 'timestamp',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${CDX_API_BASE}?${params}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nihontowatch/1.0 (https://nihontowatch.com; archival research)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text.trim()) {
      return { found: false, firstArchiveAt: null };
    }

    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length < 2) {
      return { found: false, firstArchiveAt: null };
    }

    const timestamp = data[1]?.[0];
    if (!timestamp) {
      return { found: false, firstArchiveAt: null };
    }

    return { found: true, firstArchiveAt: parseWaybackTimestamp(timestamp) };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Retry settings
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000; // 3s between retries
const RATE_LIMIT_DELAY_MS = 10000; // 10s extra delay if rate limited

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function checkWaybackArchive(url) {
  const checkedAt = new Date();
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await checkWaybackArchiveSingle(url);
      return { url, checkedAt, ...result };
    } catch (error) {
      lastError = error;
      const errMsg = error.name === 'AbortError' ? 'timeout' :
        error.cause ? `${error.message}: ${error.cause.code || error.cause}` : error.message;

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 3s, 6s, 12s
        let backoff = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        // Extra delay if connection refused (rate limited)
        if (errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND')) {
          backoff += RATE_LIMIT_DELAY_MS;
        }
        await sleep(backoff);
      } else {
        return {
          url,
          found: false,
          firstArchiveAt: null,
          checkedAt,
          error: `${errMsg} (after ${MAX_RETRIES} retries)`,
        };
      }
    }
  }
}

async function processListing(listing) {
  const result = await checkWaybackArchive(listing.url);

  if (!dryRun) {
    const updateData = {
      wayback_checked_at: result.checkedAt.toISOString(),
    };

    if (result.found && result.firstArchiveAt) {
      updateData.wayback_first_archive_at = result.firstArchiveAt.toISOString();
      updateData.freshness_source = 'wayback';
      updateData.freshness_confidence = 'high';
    }

    const { error } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', listing.id);

    if (error) {
      console.error(`  DB error for ${listing.id}:`, error.message);
    }
  }

  return { id: listing.id, ...result };
}

async function processBatch(listings) {
  return Promise.all(listings.map(processListing));
}

async function fetchUncheckedListings() {
  const query = supabase
    .from('listings')
    .select('id, url')
    .is('wayback_checked_at', null)
    .eq('status', 'available')
    .order('first_seen_at', { ascending: true })
    .limit(limit || 1000); // Supabase max is 1000 per query

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function main() {
  console.log('🔍 Bulk Wayback Check (Continuous Mode)');
  console.log('='.repeat(50));
  if (dryRun) console.log('⚠️  DRY RUN - no database updates');
  if (limit) console.log(`📊 Batch size: ${limit} listings`);
  console.log(`🔄 Concurrency: ${CONCURRENT_REQUESTS} parallel requests`);
  console.log('🔁 Will loop until all listings are checked');
  console.log('');

  let batchNum = 0;
  let totalProcessed = 0;
  let totalFound = 0;
  let totalErrors = 0;
  const globalStartTime = Date.now();

  // Loop until no more unchecked listings
  while (true) {
    batchNum++;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📦 BATCH ${batchNum}`);
    console.log('='.repeat(50));

    let listings;
    try {
      listings = await fetchUncheckedListings();
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      process.exit(1);
    }

    console.log(`📋 Found ${listings.length} listings to check\n`);

    if (listings.length === 0) {
      console.log('✅ All listings already checked!');
      break;
    }

    let processed = 0;
    let found = 0;
    let errors = 0;
    const startTime = Date.now();

    // Write progress to file for easy checking
    const writeProgress = () => {
      const elapsed = ((Date.now() - globalStartTime) / 1000).toFixed(0);
      const rate = totalProcessed > 0 ? (totalProcessed / (Date.now() - globalStartTime) * 1000 * 60).toFixed(1) : '0';
      const progress = {
        batch: batchNum,
        batchProcessed: processed,
        batchTotal: listings.length,
        totalProcessed: totalProcessed + processed,
        totalFound: totalFound + found,
        totalErrors: totalErrors + errors,
        rate: `${rate}/min`,
        elapsed: `${elapsed}s`,
        percent: ((processed / listings.length) * 100).toFixed(1) + '%',
        lastUpdate: new Date().toISOString(),
      };
      writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    };

    // Process in batches
    for (let i = 0; i < listings.length; i += CONCURRENT_REQUESTS) {
      const batch = listings.slice(i, i + CONCURRENT_REQUESTS);
      const results = await processBatch(batch);

      for (const r of results) {
        processed++;
        if (r.found) found++;
        if (r.error) errors++;

        const status = r.found ? '✅' : r.error ? '❌' : '⬜';
        const rate = ((totalProcessed + processed) / (Date.now() - globalStartTime) * 1000 * 60).toFixed(1);

        console.log(`${status} [${processed}/${listings.length}] ID ${r.id} ${r.found ? '(archived ' + r.firstArchiveAt?.toISOString().slice(0,10) + ')' : ''} ${r.error ? '(' + r.error + ')' : ''} [${rate}/min]`);
      }

      // Write progress every 30 items
      if (processed % 30 === 0 || processed === listings.length) {
        writeProgress();
      }

      // Delay between batches
      if (i + CONCURRENT_REQUESTS < listings.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // Update totals
    totalProcessed += processed;
    totalFound += found;
    totalErrors += errors;

    const batchElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n📦 Batch ${batchNum} complete: ${processed} processed, ${found} found, ${errors} errors in ${batchElapsed}s`);

    // Small delay between batches to avoid hammering
    console.log('⏳ Waiting 5s before next batch...');
    await new Promise(r => setTimeout(r, 5000));
  }

  // Final summary
  const totalElapsed = ((Date.now() - globalStartTime) / 1000 / 60).toFixed(1);
  const finalRate = (totalProcessed / (Date.now() - globalStartTime) * 1000 * 60).toFixed(1);

  console.log('\n' + '='.repeat(50));
  console.log('🎉 ALL DONE!');
  console.log('='.repeat(50));
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Found in archive: ${totalFound} (${(totalFound/totalProcessed*100).toFixed(1)}%)`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Total time: ${totalElapsed} min`);
  console.log(`   Average rate: ${finalRate} listings/min`);
}

main().catch(console.error);
