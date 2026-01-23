import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Dealer {
  name: string;
  domain: string;
  contact_email: string | null;
  ships_international: boolean | null;
  accepts_wire_transfer: boolean | null;
  accepts_paypal: boolean | null;
  accepts_credit_card: boolean | null;
  requires_deposit: boolean | null;
  deposit_percentage: number | null;
  english_support: boolean | null;
  is_active: boolean | null;
}

async function auditDealers() {
  const { data: dealers, error } = await supabase
    .from('dealers')
    .select('id, name, domain, contact_email, ships_international, accepts_wire_transfer, accepts_paypal, accepts_credit_card, requires_deposit, deposit_percentage, english_support, is_active')
    .eq('is_active', true)
    .order('name');

  // First show ID/name mapping for debugging
  console.log('=== DEALER ID/NAME MAPPING ===\n');
  for (const d of (dealers as any[]) || []) {
    console.log(`${d.id}: "${d.name}"`);
  }
  console.log('');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== DEALER POLICY AUDIT ===\n');

  for (const d of (dealers as Dealer[]) || []) {
    const issues: string[] = [];

    // Check for missing critical data
    if (!d.contact_email) issues.push('NO EMAIL');
    if (d.ships_international === null) issues.push('SHIPPING UNKNOWN');
    if (d.accepts_wire_transfer === null && d.accepts_paypal === null && d.accepts_credit_card === null) {
      issues.push('NO PAYMENT INFO');
    }
    if (d.english_support === null) issues.push('ENGLISH UNKNOWN');

    const status = issues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${d.name}`);
    console.log(`   Domain: ${d.domain}`);
    console.log(`   Email: ${d.contact_email || '❌ MISSING'}`);
    console.log(`   Ships Intl: ${d.ships_international === null ? '❓' : d.ships_international ? '✅' : '❌ Domestic only'}`);
    console.log(`   Wire: ${d.accepts_wire_transfer === null ? '❓' : d.accepts_wire_transfer ? '✅' : '❌'} | PayPal: ${d.accepts_paypal === null ? '❓' : d.accepts_paypal ? '✅' : '❌'} | CC: ${d.accepts_credit_card === null ? '❓' : d.accepts_credit_card ? '✅' : '❌'}`);
    console.log(`   Deposit: ${d.requires_deposit === null ? '❓' : d.requires_deposit ? `✅ ${d.deposit_percentage || '?'}%` : '❌ Not required'}`);
    console.log(`   English: ${d.english_support === null ? '❓' : d.english_support ? '✅' : '❌ Japanese only'}`);
    if (issues.length > 0) console.log(`   ⚠️  Issues: ${issues.join(', ')}`);
    console.log('');
  }

  // Summary stats
  const total = dealers?.length || 0;
  const withEmail = dealers?.filter((d: Dealer) => d.contact_email).length || 0;
  const withShipping = dealers?.filter((d: Dealer) => d.ships_international !== null).length || 0;
  const withPayment = dealers?.filter((d: Dealer) => d.accepts_wire_transfer !== null || d.accepts_paypal !== null || d.accepts_credit_card !== null).length || 0;
  const withEnglish = dealers?.filter((d: Dealer) => d.english_support !== null).length || 0;

  console.log('=== SUMMARY ===');
  console.log(`Total active dealers: ${total}`);
  console.log(`With email: ${withEmail}/${total} (${Math.round(withEmail/total*100)}%)`);
  console.log(`With shipping info: ${withShipping}/${total} (${Math.round(withShipping/total*100)}%)`);
  console.log(`With payment info: ${withPayment}/${total} (${Math.round(withPayment/total*100)}%)`);
  console.log(`With English info: ${withEnglish}/${total} (${Math.round(withEnglish/total*100)}%)`);
}

auditDealers();
