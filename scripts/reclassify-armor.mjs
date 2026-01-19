#!/usr/bin/env node
/**
 * Reclassify armor items in the database
 *
 * This script identifies items with armor-related titles that are currently
 * classified as 'unknown' and updates them to proper armor types.
 *
 * Usage:
 *   node scripts/reclassify-armor.mjs           # Dry run (preview changes)
 *   node scripts/reclassify-armor.mjs --apply   # Apply changes
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials. Check .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Armor classification patterns (ordered by specificity - most specific first)
const ARMOR_PATTERNS = [
  // Helmets (most specific types first)
  { pattern: /兜|kabuto|helmet/i, type: 'helmet', category: 'Other' },

  // Face masks
  { pattern: /面頬|menpo|mengu|mask.*face/i, type: 'menpo', category: 'Other' },

  // Full armor (generic patterns)
  { pattern: /甲冑|具足|yoroi|gusoku|armor|armour/i, type: 'armor', category: 'Other' },

  // Body armor components
  { pattern: /籠手|kote|gauntlet/i, type: 'kote', category: 'Other' },
  { pattern: /脛当|suneate|shin guard/i, type: 'suneate', category: 'Other' },
];

// Exclusion patterns (items that mention armor but aren't actually armor)
const EXCLUSION_PATTERNS = [
  // Tsuba by armorers (甲冑師 = armor maker, but the item is a tsuba)
  /鐔|tsuba/i,
  // Books about armor
  /書籍|book|図説|文献/i,
  // Swords with cutting test records (胴 in title refers to torso in test, not armor)
  /胴裁断|胴截断|胴落|切付銘|一ノ胴|二ノ胴|三ノ胴/i,
  // Yoroi-doshi (armor-piercing tanto/wakizashi) - these are swords, not armor
  /yoroi-doshi|yoroidoshi|鎧通し|yoroi doshi/i,
];

function classifyItem(title) {
  if (!title) return null;

  // Check exclusion patterns first
  for (const pattern of EXCLUSION_PATTERNS) {
    if (pattern.test(title)) {
      return null; // Not armor
    }
  }

  // Check armor patterns
  for (const { pattern, type, category } of ARMOR_PATTERNS) {
    if (pattern.test(title)) {
      return { type, category };
    }
  }

  return null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');

  console.log('🛡️  Armor Reclassification Script');
  console.log('='.repeat(50));
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --apply to make changes)' : 'APPLYING CHANGES'}`);
  console.log('');

  // Query items that might be armor (currently unknown or null type)
  // Search for armor-related terms in title
  const { data: candidates, error } = await supabase
    .from('listings')
    .select('id, title, item_type, item_category, is_available')
    .or('item_type.eq.unknown,item_type.is.null')
    .order('id');

  if (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  }

  console.log(`Found ${candidates.length} items with unknown/null item_type`);
  console.log('');

  // Classify each item
  const toUpdate = [];
  const skipped = [];

  for (const item of candidates) {
    const classification = classifyItem(item.title);

    if (classification) {
      toUpdate.push({
        id: item.id,
        title: item.title,
        currentType: item.item_type,
        newType: classification.type,
        newCategory: classification.category,
        isAvailable: item.is_available,
      });
    }
  }

  // Note: We only update items with unknown/null type
  // Items already classified as tsuba, tanto, katana etc. are kept as-is
  // even if they mention armor terms (e.g., "yoroi-doshi tanto" stays as tanto)

  // Display results
  console.log('📋 Items to reclassify:');
  console.log('-'.repeat(80));

  const byType = {};
  for (const item of toUpdate) {
    if (!byType[item.newType]) byType[item.newType] = [];
    byType[item.newType].push(item);
  }

  for (const [type, items] of Object.entries(byType).sort()) {
    console.log(`\n${type.toUpperCase()} (${items.length} items):`);
    for (const item of items) {
      const status = item.isAvailable ? '✓' : '✗';
      console.log(`  [${status}] ${item.id}: "${item.title?.substring(0, 60)}..."`);
      console.log(`      ${item.currentType || 'null'} → ${item.newType}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${toUpdate.length} items to update`);
  console.log(`  - Available: ${toUpdate.filter(i => i.isAvailable).length}`);
  console.log(`  - Sold: ${toUpdate.filter(i => !i.isAvailable).length}`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes made');
    console.log('Run with --apply to update the database');
    return;
  }

  // Apply changes
  console.log('\n🔄 Applying changes...');

  let success = 0;
  let failed = 0;

  for (const item of toUpdate) {
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        item_type: item.newType,
        item_category: item.newCategory,
      })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  ❌ Failed to update ${item.id}: ${updateError.message}`);
      failed++;
    } else {
      success++;
    }
  }

  console.log('\n✅ Complete!');
  console.log(`  - Updated: ${success}`);
  console.log(`  - Failed: ${failed}`);
}

main().catch(console.error);
