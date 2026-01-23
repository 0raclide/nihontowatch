-- =============================================================================
-- Migration 035: Fix Dealer Contact Data Name Mismatches
-- Purpose: Apply contact data that failed due to name differences
-- =============================================================================

-- Fix Ginza_Seikodo (name has underscore in DB)
UPDATE dealers SET
    contact_email = 'saito@ginzaseikodo.com',
    contact_page_url = 'https://ginzaseikodo.com/en/contact/',
    sales_policy_url = 'https://ginzaseikodo.com/en/contact/#kiyaku',
    ships_international = true,
    accepts_wire_transfer = true,
    english_support = true
WHERE name = 'Ginza_Seikodo';

-- Fix Katana_Ando (name has underscore in DB)
UPDATE dealers SET
    contact_email = 'info@katana-ando.co.jp',
    contact_page_url = 'https://katana-ando.co.jp/contact.php',
    english_support = false
WHERE name = 'Katana_Ando';

-- Iida Koendo - contact form only, but we can set the contact page URL
-- (email left as NULL since they only accept form submissions)
UPDATE dealers SET
    contact_page_url = 'https://iidakoendo.com/contact/',
    sales_policy_url = 'https://iidakoendo.com/tokutei/'
WHERE name = 'Iida Koendo' AND contact_page_url IS NULL;

-- Touken Matsumoto - contact form only
-- (email left as NULL since they only accept form submissions)
UPDATE dealers SET
    contact_page_url = 'https://touken-matsumoto.jp/en/contact',
    sales_policy_url = 'https://touken-matsumoto.jp/en/info/sales_rules'
WHERE name = 'Touken Matsumoto' AND contact_page_url IS NULL;
