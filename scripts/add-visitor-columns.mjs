#!/usr/bin/env node
/**
 * Add visitor_id and ip_address columns to activity_events table
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
  console.log('Checking activity_events table structure...\n');

  // Get a sample record to see current columns
  const { data: sample, error: sampleError } = await supabase
    .from('activity_events')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.error('Error fetching sample:', sampleError.message);
    return;
  }

  if (sample?.[0]) {
    console.log('Current columns:', Object.keys(sample[0]).join(', '));
  }

  // Check if visitor_id column exists
  const hasVisitorId = sample?.[0] && 'visitor_id' in sample[0];
  const hasIpAddress = sample?.[0] && 'ip_address' in sample[0];

  console.log('\nColumn status:');
  console.log('  visitor_id:', hasVisitorId ? 'EXISTS' : 'MISSING');
  console.log('  ip_address:', hasIpAddress ? 'EXISTS' : 'MISSING');

  if (!hasVisitorId || !hasIpAddress) {
    console.log('\n⚠️  Missing columns need to be added via SQL migration.');
    console.log('\nRun this SQL in Supabase dashboard:');
    console.log('----------------------------------------');

    if (!hasVisitorId) {
      console.log(`
ALTER TABLE activity_events
ADD COLUMN IF NOT EXISTS visitor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_activity_events_visitor_id
ON activity_events(visitor_id);
`);
    }

    if (!hasIpAddress) {
      console.log(`
ALTER TABLE activity_events
ADD COLUMN IF NOT EXISTS ip_address TEXT;

CREATE INDEX IF NOT EXISTS idx_activity_events_ip_address
ON activity_events(ip_address);
`);
    }

    console.log('----------------------------------------');
  } else {
    console.log('\n✅ All required columns exist!');
  }

  // Show some stats
  console.log('\n=== Current Data Stats ===');

  const { count: totalEvents } = await supabase
    .from('activity_events')
    .select('*', { count: 'exact', head: true });
  console.log('Total events:', totalEvents);

  // Show unique session count as proxy for unique visitors
  const { data: sessions } = await supabase
    .from('activity_events')
    .select('session_id')
    .limit(10000);

  if (sessions) {
    const uniqueSessions = new Set(sessions.map(s => s.session_id));
    console.log('Unique sessions:', uniqueSessions.size);
  }
}

main().catch(console.error);
