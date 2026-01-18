#!/usr/bin/env node
/**
 * Wayback Content Validator
 *
 * Tests hypothesis: Are dealers reusing URLs for different items?
 *
 * Approach:
 * 1. Fetch Wayback archived version of a listing
 * 2. Extract key content (title, images, text)
 * 3. Compare with current listing in our database
 * 4. Compute similarity scores
 * 5. Determine if it's the same listing or URL reuse
 *
 * Usage: node scripts/wayback-content-validator.mjs [--url URL] [--sample N]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
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
const urlArg = args.indexOf('--url') !== -1 ? args[args.indexOf('--url') + 1] : null;
const sampleSize = args.indexOf('--sample') !== -1 ? parseInt(args[args.indexOf('--sample') + 1]) : 5;

// Wayback settings
const WAYBACK_BASE = 'https://web.archive.org/web';
const REQUEST_TIMEOUT = 30000;
const REQUEST_DELAY = 2000; // Be nice to Wayback

/**
 * Fetch a Wayback snapshot
 */
async function fetchWaybackSnapshot(url, timestamp) {
  // Format timestamp as YYYYMMDDHHMMSS
  const ts = timestamp.replace(/[-:T]/g, '').slice(0, 14);
  const waybackUrl = `${WAYBACK_BASE}/${ts}id_/${url}`;

  console.log(`  Fetching: ${waybackUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(waybackUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nihontowatch/1.0 (content validation research)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: `HTTP ${response.status}`, html: null };
    }

    const html = await response.text();
    return { error: null, html };
  } catch (error) {
    return { error: error.message, html: null };
  }
}

/**
 * Extract content from HTML
 */
function extractContent(html, url) {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Remove Wayback Machine toolbar if present
    const wbToolbar = doc.querySelector('#wm-ipp-base');
    if (wbToolbar) wbToolbar.remove();

    // Extract title - try multiple selectors
    let title = '';
    const titleSelectors = [
      'h1',
      '.product-title',
      '.item-title',
      '[class*="title"]',
      'title'
    ];
    for (const sel of titleSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim()) {
        title = el.textContent.trim();
        break;
      }
    }

    // Extract images
    const images = [];
    const imgElements = doc.querySelectorAll('img');
    imgElements.forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src && !src.includes('wayback') && !src.includes('archive.org')) {
        // Normalize URL
        let normalizedSrc = src;
        if (src.startsWith('//')) normalizedSrc = 'https:' + src;
        else if (src.startsWith('/')) {
          const urlObj = new URL(url);
          normalizedSrc = urlObj.origin + src;
        }
        images.push(normalizedSrc);
      }
    });

    // Extract main text content
    // Remove scripts, styles, nav, footer
    ['script', 'style', 'nav', 'footer', 'header'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    const bodyText = doc.body ? doc.body.textContent.replace(/\s+/g, ' ').trim() : '';

    // Try to extract price
    let price = null;
    const pricePatterns = [
      /¥[\d,]+/,
      /￥[\d,]+/,
      /[\d,]+円/,
      /\$[\d,]+/,
    ];
    for (const pattern of pricePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        price = match[0];
        break;
      }
    }

    return {
      title,
      images: images.slice(0, 10), // Limit to first 10
      textLength: bodyText.length,
      textSample: bodyText.slice(0, 500),
      price,
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Calculate Jaccard similarity between two strings
 * (Intersection of words / Union of words)
 */
function jaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  // Tokenize into words (handles Japanese by using character n-grams as fallback)
  const tokenize = (s) => {
    // Try word-based first
    const words = s.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 1);
    if (words.length > 3) return new Set(words);
    // Fall back to character trigrams for short/Japanese text
    const trigrams = [];
    for (let i = 0; i < s.length - 2; i++) {
      trigrams.push(s.slice(i, i + 3));
    }
    return new Set(trigrams);
  };

  const set1 = tokenize(str1);
  const set2 = tokenize(str2);

  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate image URL overlap
 */
function imageOverlap(images1, images2) {
  if (!images1?.length || !images2?.length) return { overlap: 0, note: 'missing images' };

  // Normalize image URLs for comparison
  const normalize = (url) => {
    try {
      const u = new URL(url);
      return u.pathname.split('/').pop(); // Just filename
    } catch {
      return url;
    }
  };

  const set1 = new Set(images1.map(normalize));
  const set2 = new Set(images2.map(normalize));

  const intersection = [...set1].filter(x => set2.has(x));
  const overlap = intersection.length / Math.max(set1.size, set2.size);

  return { overlap, common: intersection.length, total1: set1.size, total2: set2.size };
}

/**
 * Analyze a single listing
 */
async function analyzeListing(listing) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analyzing: ${listing.url}`);
  console.log(`ID: ${listing.id}`);
  console.log(`Current title: ${listing.title}`);
  console.log(`Wayback date: ${listing.wayback_first_archive_at}`);
  console.log(`Our first_seen: ${listing.first_seen_at}`);

  // Calculate date gap
  const waybackDate = new Date(listing.wayback_first_archive_at);
  const firstSeenDate = new Date(listing.first_seen_at);
  const dayGap = Math.floor((firstSeenDate - waybackDate) / (1000 * 60 * 60 * 24));
  console.log(`Date gap: ${dayGap} days`);

  // Fetch Wayback snapshot
  const { error, html } = await fetchWaybackSnapshot(
    listing.url,
    listing.wayback_first_archive_at
  );

  if (error) {
    console.log(`  ERROR: ${error}`);
    return { listing, error, verdict: 'FETCH_FAILED' };
  }

  // Extract content from archived version
  const archivedContent = extractContent(html, listing.url);
  console.log(`  Archived title: ${archivedContent.title}`);
  console.log(`  Archived images: ${archivedContent.images?.length || 0}`);
  console.log(`  Archived price: ${archivedContent.price}`);

  // Current content from DB
  const currentContent = {
    title: listing.title,
    images: listing.images || [],
    price: listing.price_value ? `¥${listing.price_value}` : null,
  };
  console.log(`  Current images: ${currentContent.images?.length || 0}`);

  // Calculate similarity scores
  const titleSimilarity = jaccardSimilarity(archivedContent.title, currentContent.title);
  const imageAnalysis = imageOverlap(archivedContent.images, currentContent.images);

  console.log(`\n  SIMILARITY SCORES:`);
  console.log(`    Title Jaccard: ${(titleSimilarity * 100).toFixed(1)}%`);
  console.log(`    Image overlap: ${(imageAnalysis.overlap * 100).toFixed(1)}% (${imageAnalysis.common || 0} common)`);

  // Verdict
  let verdict = 'UNCERTAIN';
  let confidence = 'low';

  if (titleSimilarity > 0.6 && imageAnalysis.overlap > 0.5) {
    verdict = 'SAME_LISTING';
    confidence = 'high';
  } else if (titleSimilarity < 0.2 && imageAnalysis.overlap < 0.2) {
    verdict = 'DIFFERENT_LISTING';
    confidence = 'high';
  } else if (titleSimilarity < 0.3 || imageAnalysis.overlap < 0.2) {
    verdict = 'LIKELY_DIFFERENT';
    confidence = 'medium';
  } else if (titleSimilarity > 0.5 || imageAnalysis.overlap > 0.4) {
    verdict = 'LIKELY_SAME';
    confidence = 'medium';
  }

  console.log(`\n  VERDICT: ${verdict} (${confidence} confidence)`);

  return {
    listing: {
      id: listing.id,
      url: listing.url,
      currentTitle: listing.title,
      waybackDate: listing.wayback_first_archive_at,
      firstSeen: listing.first_seen_at,
      dayGap,
    },
    archived: {
      title: archivedContent.title,
      imageCount: archivedContent.images?.length || 0,
      price: archivedContent.price,
    },
    similarity: {
      title: titleSimilarity,
      imageOverlap: imageAnalysis.overlap,
    },
    verdict,
    confidence,
  };
}

/**
 * Main
 */
async function main() {
  console.log('🔍 Wayback Content Validator');
  console.log('Testing URL reuse hypothesis\n');

  let listings;

  if (urlArg) {
    // Analyze specific URL
    const { data, error } = await supabase
      .from('listings')
      .select('id, url, title, images, price_value, first_seen_at, wayback_first_archive_at')
      .eq('url', urlArg)
      .single();

    if (error || !data) {
      console.error('Listing not found:', urlArg);
      process.exit(1);
    }
    listings = [data];
  } else {
    // Find listings with largest gap between wayback date and first_seen
    // These are most likely to be URL reuse cases
    const { data, error } = await supabase
      .from('listings')
      .select('id, url, title, images, price_value, first_seen_at, wayback_first_archive_at')
      .not('wayback_first_archive_at', 'is', null)
      .order('wayback_first_archive_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Failed to fetch listings:', error);
      process.exit(1);
    }

    // Sort by gap (first_seen - wayback_date) descending
    listings = data
      .map(l => ({
        ...l,
        gap: new Date(l.first_seen_at) - new Date(l.wayback_first_archive_at)
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, sampleSize);

    console.log(`Found ${data.length} listings with Wayback data`);
    console.log(`Analyzing top ${sampleSize} with largest date gaps\n`);
  }

  const results = [];

  for (const listing of listings) {
    const result = await analyzeListing(listing);
    results.push(result);

    // Rate limit
    await new Promise(r => setTimeout(r, REQUEST_DELAY));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const verdicts = {};
  results.forEach(r => {
    verdicts[r.verdict] = (verdicts[r.verdict] || 0) + 1;
  });

  Object.entries(verdicts).forEach(([v, count]) => {
    console.log(`  ${v}: ${count}`);
  });

  // Save detailed results
  const outputPath = 'wayback-validation-results.json';
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${outputPath}`);

  // Findings
  const differentCount = (verdicts['DIFFERENT_LISTING'] || 0) + (verdicts['LIKELY_DIFFERENT'] || 0);
  if (differentCount > 0) {
    console.log(`\n⚠️  HYPOTHESIS CONFIRMED: ${differentCount}/${results.length} listings appear to be URL reuse cases`);
  }
}

main().catch(console.error);
