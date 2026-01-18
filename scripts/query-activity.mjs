#!/usr/bin/env node
/**
 * Query activity events from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env.local manually
const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Querying activity events...\n');

  // Get total count first
  const { count: totalCount } = await supabase
    .from('activity_events')
    .select('*', { count: 'exact', head: true });

  console.log(`Total events in database: ${totalCount}\n`);

  // Get event counts by type - use RPC if available or get more events
  const { data: events, error } = await supabase
    .from('activity_events')
    .select('event_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Count by type
  const counts = {};
  events.forEach(e => counts[e.event_type] = (counts[e.event_type] || 0) + 1);

  console.log('=== Event Counts (last 1000 events) ===');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${count.toString().padStart(5)}  ${type}`);
    });

  if (events.length > 0) {
    console.log('\nDate range:',
      events[events.length - 1]?.created_at?.slice(0, 16),
      'to',
      events[0]?.created_at?.slice(0, 16)
    );
  }

  // Check for viewport_dwell events specifically
  const { data: dwellEvents, error: dwellError } = await supabase
    .from('activity_events')
    .select('event_data, created_at')
    .eq('event_type', 'viewport_dwell')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!dwellError && dwellEvents?.length > 0) {
    console.log('\n=== Recent Viewport Dwell Events ===');
    dwellEvents.forEach(e => {
      const d = e.event_data;
      console.log(`  ${e.created_at.slice(11, 19)} - Listing ${d.listingId}, ${d.dwellMs}ms${d.isRevisit ? ' (revisit)' : ''}`);
    });
  }

  // Check for new engagement signals
  const { data: panelEvents } = await supabase
    .from('activity_events')
    .select('event_data, created_at')
    .eq('event_type', 'quickview_panel_toggle')
    .order('created_at', { ascending: false })
    .limit(10);

  if (panelEvents?.length > 0) {
    console.log('\n=== QuickView Panel Toggle Events ===');
    panelEvents.forEach(e => {
      const d = e.event_data;
      console.log(`  ${e.created_at.slice(11, 19)} - Listing ${d.listingId}, ${d.action}, dwelt ${d.dwellMs}ms`);
    });
  }

  const { data: zoomEvents } = await supabase
    .from('activity_events')
    .select('event_data, created_at')
    .eq('event_type', 'image_pinch_zoom')
    .order('created_at', { ascending: false })
    .limit(10);

  if (zoomEvents?.length > 0) {
    console.log('\n=== Image Pinch Zoom Events ===');
    zoomEvents.forEach(e => {
      const d = e.event_data;
      console.log(`  ${e.created_at.slice(11, 19)} - Listing ${d.listingId}, image ${d.imageIndex}, scale ${d.zoomScale?.toFixed(2)}`);
    });
  }

  // Get session count
  const { count: sessionCount } = await supabase
    .from('user_sessions')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== Sessions ===');
  console.log(`  Total sessions: ${sessionCount}`);

  // Get recent sessions with activity
  const { data: recentSessions } = await supabase
    .from('user_sessions')
    .select('id, started_at, page_views, total_duration_ms')
    .order('started_at', { ascending: false })
    .limit(10);

  if (recentSessions?.length > 0) {
    console.log('\n=== Recent Sessions ===');
    recentSessions.forEach(s => {
      const duration = s.total_duration_ms ? `${Math.round(s.total_duration_ms / 1000)}s` : 'active';
      console.log(`  ${s.started_at?.slice(0, 16)} - ${s.page_views} pages, ${duration}`);
    });
  }

  // Analyze external link clicks - which listings are clicked most
  const { data: clickEvents } = await supabase
    .from('activity_events')
    .select('event_data')
    .eq('event_type', 'external_link_click')
    .limit(500);

  if (clickEvents?.length > 0) {
    console.log('\n=== External Click Analysis ===');
    const listingClicks = {};
    const dealerClicks = {};
    clickEvents.forEach(e => {
      const d = e.event_data;
      if (d.listingId) listingClicks[d.listingId] = (listingClicks[d.listingId] || 0) + 1;
      if (d.dealerName) dealerClicks[d.dealerName] = (dealerClicks[d.dealerName] || 0) + 1;
    });

    console.log('  Top clicked listings:');
    Object.entries(listingClicks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([id, count]) => console.log(`    Listing ${id}: ${count} clicks`));

    console.log('\n  Clicks by dealer:');
    Object.entries(dealerClicks)
      .sort((a, b) => b[1] - a[1])
      .forEach(([dealer, count]) => console.log(`    ${dealer}: ${count} clicks`));
  }

  // Check events by hour to understand usage patterns
  console.log('\n=== Activity by Hour (UTC) ===');
  const hourCounts = {};
  events.forEach(e => {
    const hour = e.created_at?.slice(11, 13);
    if (hour) hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  Object.entries(hourCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([hour, count]) => {
      const bar = '█'.repeat(Math.ceil(count / 20));
      console.log(`  ${hour}:00  ${bar} ${count}`);
    });
}

main().catch(console.error);
