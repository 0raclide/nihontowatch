#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get dealers with certified listings
const { data: listings } = await supabase
  .from('listings')
  .select('url, cert_type, images')
  .not('cert_type', 'is', null)
  .not('images', 'is', null);

const byDealer = {};
listings.forEach(l => {
  const domain = l.url.match(/https?:\/\/([^\/]+)/)?.[1];
  if (domain === undefined) return;
  if (!byDealer[domain]) byDealer[domain] = { count: 0, certs: {} };
  byDealer[domain].count++;
  byDealer[domain].certs[l.cert_type] = (byDealer[domain].certs[l.cert_type] || 0) + 1;
});

// Sort by count
const sorted = Object.entries(byDealer).sort((a, b) => b[1].count - a[1].count);

console.log('Dealers with certified listings (sorted by count):');
console.log('─'.repeat(70));
sorted.forEach(([domain, data]) => {
  const certTypes = Object.entries(data.certs).map(([t, c]) => `${t}:${c}`).join(', ');
  console.log(`${domain.padEnd(30)} ${String(data.count).padStart(5)} │ ${certTypes}`);
});

// Output top dealers for agent testing
console.log('\n\nTop dealers to test (10+ certified listings):');
const topDealers = sorted.filter(([, d]) => d.count >= 10).map(([domain]) => domain);
console.log(topDealers.join('\n'));
