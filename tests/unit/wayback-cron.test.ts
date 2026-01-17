/**
 * Unit tests for Wayback cron endpoint configuration
 *
 * These tests verify the cron endpoint is correctly configured
 * to avoid issues like RLS blocking updates (which happened when
 * we used createClient instead of createServiceClient).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Wayback cron endpoint configuration', () => {
  const cronRoutePath = path.join(
    process.cwd(),
    'src/app/api/cron/wayback-check/route.ts'
  );

  it('uses createServiceClient instead of createClient', () => {
    // This test ensures we don't regress to using the anon client
    // which would be blocked by RLS for UPDATE operations
    const routeContent = fs.readFileSync(cronRoutePath, 'utf-8');

    // Should import createServiceClient
    expect(routeContent).toContain('createServiceClient');

    // Should NOT be using createClient (which uses anon key)
    // Allow the import statement but check it's not being called
    const importMatch = routeContent.match(
      /import\s*{[^}]*createClient[^}]*}\s*from/
    );
    const callMatch = routeContent.match(/const\s+supabase\s*=.*createClient\(/);

    expect(callMatch).toBeNull();
  });

  it('has maxDuration set for Vercel timeout', () => {
    const routeContent = fs.readFileSync(cronRoutePath, 'utf-8');

    // Should export maxDuration
    expect(routeContent).toMatch(/export\s+const\s+maxDuration\s*=/);
  });

  it('has authorization check', () => {
    const routeContent = fs.readFileSync(cronRoutePath, 'utf-8');

    // Should have isAuthorized function
    expect(routeContent).toContain('isAuthorized');
    expect(routeContent).toContain('CRON_SECRET');
  });

  it('has rate limiting between requests', () => {
    const routeContent = fs.readFileSync(cronRoutePath, 'utf-8');

    // Should have REQUEST_INTERVAL_MS constant
    expect(routeContent).toContain('REQUEST_INTERVAL_MS');

    // Should have a setTimeout or similar delay
    expect(routeContent).toMatch(/setTimeout|await new Promise/);
  });

  it('batch size fits within Vercel timeout', () => {
    const routeContent = fs.readFileSync(cronRoutePath, 'utf-8');

    // Extract BATCH_SIZE
    const batchMatch = routeContent.match(/BATCH_SIZE\s*=\s*(\d+)/);
    expect(batchMatch).not.toBeNull();
    const batchSize = parseInt(batchMatch![1], 10);

    // Extract REQUEST_INTERVAL_MS
    const intervalMatch = routeContent.match(/REQUEST_INTERVAL_MS\s*=\s*(\d+)/);
    expect(intervalMatch).not.toBeNull();
    const intervalMs = parseInt(intervalMatch![1], 10);

    // Extract maxDuration
    const maxDurationMatch = routeContent.match(/maxDuration\s*=\s*(\d+)/);
    expect(maxDurationMatch).not.toBeNull();
    const maxDuration = parseInt(maxDurationMatch![1], 10);

    // Calculate minimum time needed (n-1 intervals + overhead)
    const minTimeNeeded = (batchSize - 1) * intervalMs / 1000;
    const maxTimeAvailable = maxDuration;

    // Should have at least 30 seconds buffer for processing
    expect(minTimeNeeded + 30).toBeLessThanOrEqual(maxTimeAvailable);
  });
});
