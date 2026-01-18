#!/usr/bin/env node
/**
 * Add visitor_id and ip_address columns via Supabase Management API
 */

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL
const projectRef = SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];

async function runSQL(sql) {
  // Use the Supabase SQL endpoint (via PostgREST rpc)
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    // Try using the pg_dump endpoint format
    return { error: `RPC not available: ${response.status}` };
  }

  return response.json();
}

async function main() {
  console.log('Project:', projectRef);
  console.log('Adding visitor_id and ip_address columns...\n');

  // Since we can't run arbitrary SQL via REST API,
  // we'll use a workaround: create the columns by trying to insert
  // a record with those columns. If the columns don't exist,
  // we'll document what needs to be done manually.

  console.log('⚠️  The Supabase REST API cannot execute DDL statements.');
  console.log('\nPlease run this SQL in the Supabase Dashboard SQL Editor:');
  console.log('Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  console.log('\n' + '='.repeat(60) + '\n');

  console.log(`-- Add visitor tracking columns to activity_events
ALTER TABLE activity_events
ADD COLUMN IF NOT EXISTS visitor_id TEXT;

ALTER TABLE activity_events
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_events_visitor_id
ON activity_events(visitor_id);

CREATE INDEX IF NOT EXISTS idx_activity_events_ip_address
ON activity_events(ip_address);

-- Verify the changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'activity_events'
ORDER BY ordinal_position;`);

  console.log('\n' + '='.repeat(60));
  console.log('\nAfter running the SQL, the tracking will automatically');
  console.log('start capturing visitor_id and ip_address for new events.');
}

main().catch(console.error);
