/**
 * Choshuya final cleanup — last 2 real duplicates.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DEDUP_MAP = { 31108: [35426] };
const ALL_DUPE_IDS = [35426];

async function main() {
  const { data: existing } = await supabase.from('listings').select('id, url').in('id', ALL_DUPE_IDS);
  if (!existing || existing.length === 0) { console.log('Nothing to clean.'); return; }
  console.log('Found:', existing.length, 'dupes');

  const tables = ['price_history', 'status_history', 'user_favorites', 'user_alerts', 'dealer_clicks'];
  for (const table of tables) {
    for (const [keepId, dupeIds] of Object.entries(DEDUP_MAP)) {
      const { data, error } = await supabase.from(table).update({ listing_id: Number(keepId) }).in('listing_id', dupeIds).select('id');
      if (error && error.code === '23505') await supabase.from(table).delete().in('listing_id', dupeIds);
    }
  }
  console.log('FKs reassigned');

  const { error } = await supabase.from('listings').delete().in('id', ALL_DUPE_IDS);
  console.log('Delete:', error ? error.message : 'OK');

  const dupeUrls = existing.map(l => l.url).filter(Boolean);
  if (dupeUrls.length > 0) {
    const { data } = await supabase.from('discovered_urls').delete().in('url', dupeUrls).select('id');
    console.log('Discovered URLs removed:', (data || []).length);
  }

  const { data: remaining } = await supabase.from('listings').select('id').in('id', ALL_DUPE_IDS);
  console.log('Remaining:', (remaining || []).length);

  const { count } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('dealer_id', 9).eq('is_available', true);
  console.log('Total available Choshuya:', count);
}
main().catch(console.error);
