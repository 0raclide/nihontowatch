#!/usr/bin/env node
/**
 * Wayback Dealer Content Validation Test
 *
 * Tests a specific dealer's listings for URL reuse
 * Designed to be run in parallel across dealers
 *
 * Usage: node scripts/wayback-dealer-test.mjs --dealer DOMAIN --sample N
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { JSDOM } from 'jsdom';

// Parse .env.local
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Parse args
const args = process.argv.slice(2);
const dealerArg = args.indexOf('--dealer') !== -1 ? args[args.indexOf('--dealer') + 1] : null;
const sampleSize = args.indexOf('--sample') !== -1 ? parseInt(args[args.indexOf('--sample') + 1]) : 15;

if (!dealerArg) {
  console.error('Usage: node wayback-dealer-test.mjs --dealer DOMAIN [--sample N]');
  process.exit(1);
}

// Settings
const WAYBACK_BASE = 'https://web.archive.org/web';
const REQUEST_TIMEOUT = 30000;
const REQUEST_DELAY = 2500;
const MAX_RETRIES = 2;

// Ensure output directory exists
const OUTPUT_DIR = 'wayback-validation-results';
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);

/**
 * Fetch with retry
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Nihontowatch/1.0 (academic research on web archiving)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (i < retries) {
          await sleep(REQUEST_DELAY * (i + 1));
          continue;
        }
        return { error: `HTTP ${response.status}`, html: null };
      }

      const html = await response.text();
      return { error: null, html };
    } catch (error) {
      if (i < retries) {
        await sleep(REQUEST_DELAY * (i + 1));
        continue;
      }
      return { error: error.message, html: null };
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch Wayback snapshot
 */
async function fetchWaybackSnapshot(url, timestamp) {
  const ts = timestamp.replace(/[-:T]/g, '').slice(0, 14);
  // Use id_ to get original content without Wayback toolbar
  const waybackUrl = `${WAYBACK_BASE}/${ts}id_/${url}`;
  return fetchWithRetry(waybackUrl);
}

/**
 * Extract content from HTML
 */
function extractContent(html, url) {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Remove Wayback elements
    doc.querySelectorAll('[id*="wm-"], [class*="wayback"]').forEach(el => el.remove());

    // Extract title
    let title = '';
    const titleSelectors = ['h1', '.product-title', '.item-title', 'title', '[class*="title"]'];
    for (const sel of titleSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim().length > 3) {
        title = el.textContent.trim().slice(0, 200);
        break;
      }
    }

    // Extract all images
    const images = [];
    doc.querySelectorAll('img').forEach(img => {
      let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      // Skip tiny images (likely icons), wayback images, and data URIs
      if (src.includes('wayback') || src.includes('archive.org') || src.startsWith('data:')) return;
      const width = parseInt(img.getAttribute('width') || '100');
      const height = parseInt(img.getAttribute('height') || '100');
      if (width < 50 && height < 50) return;

      // Normalize URL
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) {
        try {
          const u = new URL(url);
          src = u.origin + src;
        } catch {}
      }
      if (src) images.push(src);
    });

    // Extract price
    let price = null;
    const bodyText = doc.body ? doc.body.textContent : '';
    const pricePatterns = [/¥[\d,]+/, /￥[\d,]+/, /[\d,]+円/, /USD\s*[\d,]+/, /\$[\d,]+/];
    for (const p of pricePatterns) {
      const m = bodyText.match(p);
      if (m) { price = m[0]; break; }
    }

    // Extract description/body text (first 1000 chars of meaningful text)
    ['script', 'style', 'nav', 'footer', 'header', 'aside'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });
    const cleanText = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1000);

    return { title, images: images.slice(0, 20), price, textSample: cleanText };
  } catch (error) {
    return { error: error.message, title: '', images: [], price: null, textSample: '' };
  }
}

/**
 * Calculate Jaccard similarity
 */
function jaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const tokenize = (s) => {
    // For Japanese, use character bigrams; for English, use words
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(s);
    if (hasJapanese) {
      const bigrams = [];
      for (let i = 0; i < s.length - 1; i++) bigrams.push(s.slice(i, i + 2));
      return new Set(bigrams);
    } else {
      return new Set(s.toLowerCase().split(/[\s\-_,.:;]+/).filter(w => w.length > 2));
    }
  };

  const set1 = tokenize(str1);
  const set2 = tokenize(str2);
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

/**
 * Calculate image filename overlap
 */
function imageFilenameOverlap(images1, images2) {
  if (!images1?.length || !images2?.length) return { score: 0, common: 0 };

  const getFilename = (url) => {
    try {
      return new URL(url).pathname.split('/').pop().split('?')[0].toLowerCase();
    } catch {
      return url.split('/').pop().split('?')[0].toLowerCase();
    }
  };

  const filenames1 = new Set(images1.map(getFilename).filter(f => f.length > 3));
  const filenames2 = new Set(images2.map(getFilename).filter(f => f.length > 3));

  if (filenames1.size === 0 || filenames2.size === 0) return { score: 0, common: 0 };

  const common = [...filenames1].filter(f => filenames2.has(f));
  const score = common.length / Math.max(filenames1.size, filenames2.size);

  return { score, common: common.length, total1: filenames1.size, total2: filenames2.size };
}

/**
 * Determine verdict
 */
function determineVerdict(titleSim, imageSim, gap) {
  // Strong evidence of same listing
  if (titleSim > 0.6 && imageSim > 0.5) return { verdict: 'SAME', confidence: 'high' };
  if (titleSim > 0.7) return { verdict: 'SAME', confidence: 'medium' };
  if (imageSim > 0.6) return { verdict: 'SAME', confidence: 'medium' };

  // Strong evidence of different listing
  if (titleSim < 0.15 && imageSim < 0.15) return { verdict: 'DIFFERENT', confidence: 'high' };
  if (titleSim < 0.1) return { verdict: 'DIFFERENT', confidence: 'high' };

  // Medium confidence different
  if (titleSim < 0.25 && imageSim < 0.25) return { verdict: 'DIFFERENT', confidence: 'medium' };
  if (titleSim < 0.2) return { verdict: 'LIKELY_DIFFERENT', confidence: 'medium' };

  // Uncertain
  return { verdict: 'UNCERTAIN', confidence: 'low' };
}

/**
 * Analyze a single listing
 */
async function analyzeListing(listing) {
  const gap = Math.floor((new Date(listing.first_seen_at) - new Date(listing.wayback_first_archive_at)) / (1000*60*60*24));

  // Fetch Wayback snapshot
  const { error, html } = await fetchWaybackSnapshot(listing.url, listing.wayback_first_archive_at);

  if (error) {
    return {
      id: listing.id,
      url: listing.url,
      gap,
      error,
      verdict: 'FETCH_FAILED',
      confidence: 'none',
    };
  }

  // Extract content
  const archived = extractContent(html, listing.url);
  const current = {
    title: listing.title || '',
    images: listing.images || [],
    price: listing.price_value ? `¥${listing.price_value}` : null,
  };

  // Calculate similarities
  const titleSim = jaccardSimilarity(archived.title, current.title);
  const imageAnalysis = imageFilenameOverlap(archived.images, current.images);

  // Determine verdict
  const { verdict, confidence } = determineVerdict(titleSim, imageAnalysis.score, gap);

  return {
    id: listing.id,
    url: listing.url,
    gap,
    archived: {
      title: archived.title?.slice(0, 100),
      imageCount: archived.images?.length || 0,
      price: archived.price,
    },
    current: {
      title: current.title?.slice(0, 100),
      imageCount: current.images?.length || 0,
      price: current.price,
    },
    similarity: {
      title: Math.round(titleSim * 100),
      images: Math.round(imageAnalysis.score * 100),
      commonImages: imageAnalysis.common,
    },
    verdict,
    confidence,
  };
}

/**
 * Main
 */
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING DEALER: ${dealerArg}`);
  console.log(`Sample size: ${sampleSize}`);
  console.log('='.repeat(60));

  // Fetch listings for this dealer
  const { data, error } = await supabase
    .from('listings')
    .select('id, url, title, images, price_value, first_seen_at, wayback_first_archive_at')
    .not('wayback_first_archive_at', 'is', null)
    .ilike('url', `%${dealerArg}%`);

  if (error) {
    console.error('DB Error:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No listings with Wayback data for this dealer');
    const result = { dealer: dealerArg, total: 0, sampled: 0, results: [], summary: {} };
    writeFileSync(`${OUTPUT_DIR}/${dealerArg.replace(/\./g, '_')}.json`, JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Sort by gap (largest first) and sample
  const sorted = data
    .map(l => ({
      ...l,
      gap: Math.floor((new Date(l.first_seen_at) - new Date(l.wayback_first_archive_at)) / (1000*60*60*24))
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, sampleSize);

  console.log(`Found ${data.length} listings, testing ${sorted.length}`);
  console.log(`Gap range: ${sorted[sorted.length-1]?.gap || 0} - ${sorted[0]?.gap || 0} days\n`);

  const results = [];

  for (let i = 0; i < sorted.length; i++) {
    const listing = sorted[i];
    console.log(`[${i+1}/${sorted.length}] ID ${listing.id} (gap: ${listing.gap}d)...`);

    const result = await analyzeListing(listing);
    results.push(result);

    const icon = result.verdict === 'SAME' ? '✅' :
                 result.verdict === 'DIFFERENT' ? '❌' :
                 result.verdict === 'LIKELY_DIFFERENT' ? '⚠️' :
                 result.verdict === 'FETCH_FAILED' ? '💥' : '❓';
    console.log(`  ${icon} ${result.verdict} (title: ${result.similarity?.title || 0}%, img: ${result.similarity?.images || 0}%)`);

    // Rate limit
    if (i < sorted.length - 1) await sleep(REQUEST_DELAY);
  }

  // Summary
  const summary = {
    total: data.length,
    sampled: results.length,
    verdicts: {},
    avgTitleSim: 0,
    avgImageSim: 0,
  };

  let titleSimSum = 0, imageSimSum = 0, validCount = 0;
  results.forEach(r => {
    summary.verdicts[r.verdict] = (summary.verdicts[r.verdict] || 0) + 1;
    if (r.similarity) {
      titleSimSum += r.similarity.title;
      imageSimSum += r.similarity.images;
      validCount++;
    }
  });
  summary.avgTitleSim = validCount > 0 ? Math.round(titleSimSum / validCount) : 0;
  summary.avgImageSim = validCount > 0 ? Math.round(imageSimSum / validCount) : 0;

  // Calculate URL reuse rate
  const differentCount = (summary.verdicts['DIFFERENT'] || 0) + (summary.verdicts['LIKELY_DIFFERENT'] || 0);
  const validResults = results.filter(r => r.verdict !== 'FETCH_FAILED').length;
  summary.urlReuseRate = validResults > 0 ? Math.round((differentCount / validResults) * 100) : 0;

  console.log(`\n${'='.repeat(40)}`);
  console.log(`SUMMARY: ${dealerArg}`);
  console.log('='.repeat(40));
  console.log(`Total with Wayback: ${summary.total}`);
  console.log(`Sampled: ${summary.sampled}`);
  console.log(`Verdicts:`, summary.verdicts);
  console.log(`Avg Title Similarity: ${summary.avgTitleSim}%`);
  console.log(`Avg Image Similarity: ${summary.avgImageSim}%`);
  console.log(`URL Reuse Rate: ${summary.urlReuseRate}%`);

  // Save results
  const output = {
    dealer: dealerArg,
    timestamp: new Date().toISOString(),
    summary,
    results,
  };

  const outputFile = `${OUTPUT_DIR}/${dealerArg.replace(/[.:]/g, '_')}.json`;
  writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
