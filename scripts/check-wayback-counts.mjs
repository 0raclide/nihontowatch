import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { count: total } = await supabase.from('listings').select('*', { count: 'exact', head: true });

const { count: checked } = await supabase
  .from('listings')
  .select('*', { count: 'exact', head: true })
  .not('wayback_checked_at', 'is', null);

const { count: withArchive } = await supabase
  .from('listings')
  .select('*', { count: 'exact', head: true })
  .not('wayback_first_archive_at', 'is', null);

const { count: highConf } = await supabase
  .from('listings')
  .select('*', { count: 'exact', head: true })
  .eq('freshness_confidence', 'high');

console.log('Total listings:', total);
console.log('wayback_checked_at set:', checked);
console.log('wayback_first_archive_at set:', withArchive);
console.log('freshness_confidence = high:', highConf);

if (withArchive > 0) {
  const { data } = await supabase
    .from('listings')
    .select('id, url, wayback_first_archive_at, freshness_confidence, status')
    .not('wayback_first_archive_at', 'is', null)
    .limit(5);
  console.log('\nSample with wayback archive:');
  data.forEach(l => console.log('  ID:', l.id, '| status:', l.status, '| conf:', l.freshness_confidence));
}
