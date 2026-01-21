-- =============================================================================
-- Migration 034: Seed Dealer Contact Information
-- Purpose: Populate contact details, policies, and payment methods for all dealers
-- Data source: docs/DEALER_CONTACT_DATA.md (researched 2026-01-21)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1: Fix Domain Corrections
-- These dealers have incorrect domains in the database
-- -----------------------------------------------------------------------------

UPDATE dealers SET domain = 'eirakudo.shop' WHERE name = 'Eirakudo';
UPDATE dealers SET domain = 'ginzaseikodo.com' WHERE name = 'Ginza Seikodo';
UPDATE dealers SET domain = 'iidakoendo.com' WHERE name = 'Iida Koendo';
UPDATE dealers SET domain = 'katana-ando.co.jp' WHERE name = 'Katana Ando';
UPDATE dealers SET domain = 'shoubudou.co.jp' WHERE name = 'Shoubudou';
UPDATE dealers SET domain = 'taiseido.biz' WHERE name = 'Taiseido';
UPDATE dealers SET domain = 'galleryyouyou.com' WHERE name = 'Gallery Youyou';
UPDATE dealers SET domain = 'hyozaemon.jp' WHERE name = 'Hyozaemon';
-- Note: Touken Sakata site is offline - keeping current domain

-- -----------------------------------------------------------------------------
-- Part 2: Seed Contact Data for All Dealers
-- -----------------------------------------------------------------------------

-- 1. Aoi Art
UPDATE dealers SET
    contact_email = 'info@aoijapan.jp',
    contact_page_url = 'https://www.aoijapan.com/contact/',
    sales_policy_url = 'https://www.aoijapan.com/how-to-order/',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = false,
    english_support = true
WHERE name = 'Aoi Art';

-- 2. Eirakudo
UPDATE dealers SET
    contact_email = 'k@eirakudo.co.jp',
    contact_page_url = 'https://www.eirakudo.shop/contact/',
    sales_policy_url = 'https://www.eirakudo.shop/law/',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = false,
    accepts_credit_card = true,
    requires_deposit = true,
    deposit_percentage = 10,
    english_support = true
WHERE name = 'Eirakudo';

-- 3. Nipponto
UPDATE dealers SET
    contact_email = 'global@nipponto.co.jp',
    contact_page_url = 'https://ssl.internetwarp.com/nipponto/form.htm',
    sales_policy_url = 'https://global.nipponto.co.jp/pages/law',
    ships_international = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    english_support = false
WHERE name = 'Nipponto';

-- 4. E-sword
UPDATE dealers SET
    contact_email = 'info@e-sword.jp',
    contact_page_url = 'https://www.e-sword.jp/toiawase.htm',
    sales_policy_url = 'https://www.e-sword.jp/tokutei.htm',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = false,
    english_support = true
WHERE name = 'E-sword';

-- 5. Samurai Nippon
UPDATE dealers SET
    contact_email = 'info@samurai-nippon.net',
    contact_page_url = 'https://www.samurai-nippon.net/FORM/contact.cgi',
    sales_policy_url = 'https://www.samurai-nippon.net/hpgen/HPB/shop/business.html',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = false,
    english_support = true
WHERE name = 'Samurai Nippon';

-- 6. Kusanagi
UPDATE dealers SET
    contact_email = 'sword@kusanaginosya.com',
    contact_page_url = NULL,
    sales_policy_url = 'https://www.kusanaginosya.com/hpgen/HPB/shop/business.html',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = false,
    accepts_credit_card = false,
    requires_deposit = true,
    deposit_percentage = 10,
    english_support = false
WHERE name = 'Kusanagi';

-- 7. Choshuya
UPDATE dealers SET
    contact_email = 'info@choshuya.co.jp',
    contact_page_url = 'https://www.choshuya.co.jp/en/contact',
    ships_international = true,
    english_support = true
WHERE name = 'Choshuya';

-- 8. Ginza Seikodo
UPDATE dealers SET
    contact_email = 'saito@ginzaseikodo.com',
    contact_page_url = 'https://ginzaseikodo.com/en/contact/',
    sales_policy_url = 'https://ginzaseikodo.com/en/contact/#kiyaku',
    ships_international = true,
    accepts_wire_transfer = true,
    english_support = true
WHERE name = 'Ginza Seikodo';

-- 9. Iida Koendo
UPDATE dealers SET
    contact_page_url = 'https://iidakoendo.com/contact/',
    sales_policy_url = 'https://iidakoendo.com/tokutei/',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = false,
    accepts_credit_card = false,
    requires_deposit = true,
    deposit_percentage = 100,
    english_support = true
WHERE name = 'Iida Koendo';

-- 10. Katana Ando
UPDATE dealers SET
    contact_email = 'info@katana-ando.co.jp',
    contact_page_url = 'https://katana-ando.co.jp/contact.php',
    english_support = false
WHERE name = 'Katana Ando';

-- 11. Katanahanbai
UPDATE dealers SET
    contact_email = 'info@maruhidetouken.com',
    contact_page_url = 'https://www.katanahanbai.com/contact/',
    sales_policy_url = 'https://www.katanahanbai.com/kitei/',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = true,
    deposit_percentage = 100,
    english_support = true
WHERE name = 'Katanahanbai';

-- 12. Shoubudou
UPDATE dealers SET
    contact_email = 'info@shoubudou.co.jp',
    contact_page_url = 'https://www.shoubudou.co.jp/contact/',
    sales_policy_url = 'https://www.shoubudou.co.jp/order/',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = false,
    english_support = true
WHERE name = 'Shoubudou';

-- 13. Taiseido
UPDATE dealers SET
    contact_email = 'info@taiseido.biz',
    contact_page_url = 'https://taiseido.biz/about.html',
    sales_policy_url = 'https://taiseido.biz/guide/tokutei.html',
    ships_international = false,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = true,
    deposit_percentage = 10,
    english_support = false
WHERE name = 'Taiseido';

-- 14. Premi
UPDATE dealers SET
    contact_email = 'takayoshi@premi.co.jp',
    contact_page_url = 'https://www.premi.co.jp/',
    sales_policy_url = 'https://www.premi.co.jp/hanbai-kitei.html',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_credit_card = true,
    requires_deposit = true,
    english_support = true
WHERE name = 'Premi';

-- 15. Gallery Youyou
UPDATE dealers SET
    english_support = true
WHERE name = 'Gallery Youyou';

-- 16. Hyozaemon
UPDATE dealers SET
    contact_email = 'hyozaemon@beach.ocn.ne.jp',
    contact_page_url = 'https://hyozaemon.jp/inquiry/',
    ships_international = NULL,
    accepts_wire_transfer = true,
    requires_deposit = true,
    deposit_percentage = 5,
    english_support = false
WHERE name = 'Hyozaemon';

-- 17. Tsuruginoya
UPDATE dealers SET
    contact_email = 'info@tsuruginoya.com',
    contact_page_url = 'https://www.tsuruginoya.com/contact/ask',
    sales_policy_url = 'https://www.tsuruginoya.com/purchasing/transaction-law',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = true,
    deposit_percentage = 100,
    english_support = false
WHERE name = 'Tsuruginoya';

-- 18. Touken Matsumoto
UPDATE dealers SET
    contact_page_url = 'https://touken-matsumoto.jp/en/contact',
    sales_policy_url = 'https://touken-matsumoto.jp/en/info/sales_rules',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = false,
    english_support = true
WHERE name = 'Touken Matsumoto';

-- 19. Touken Komachi
UPDATE dealers SET
    contact_email = 's_tsukada@toukenkomachi.com',
    contact_page_url = 'https://www.toukenkomachi.com/script/mailform/CGI1/',
    sales_policy_url = 'https://www.toukenkomachi.com/index_en_tokuteisyoutorihiki.html',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = false,
    requires_deposit = false,
    english_support = true
WHERE name = 'Touken Komachi';

-- 20. Touken Sakata (Site offline)
-- Keeping minimal data until site status is verified

-- 21. Token-Net
UPDATE dealers SET
    contact_email = 'info@token-net.com',
    contact_page_url = 'https://www.token-net.com/contact/',
    sales_policy_url = 'https://www.token-net.com/law/',
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = true,
    deposit_percentage = 100,
    english_support = false
WHERE name = 'Token-Net';

-- 22. World Seiyudo
UPDATE dealers SET
    contact_email = 'touken@seiyudo.com',
    contact_page_url = 'https://world-seiyudo.com/contact-us/',
    sales_policy_url = 'https://world-seiyudo.com/rule/',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = false,
    english_support = true
WHERE name = 'World Seiyudo';

-- 23. Tokka Biz
UPDATE dealers SET
    contact_email = 'tokka@tokka.biz',
    contact_page_url = NULL,
    sales_policy_url = 'https://tokka.biz/sword-order.html',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = false,
    accepts_credit_card = false,
    requires_deposit = true,
    deposit_percentage = 100,
    english_support = false
WHERE name = 'Tokka Biz';

-- 24. Sanmei
UPDATE dealers SET
    contact_email = 'tokugawa@sanmei.com',
    contact_page_url = 'https://www.sanmei.com/en-us/enter.html',
    accepts_paypal = true,
    accepts_credit_card = true,
    english_support = true
WHERE name = 'Sanmei';

-- 25. Nihonto (USA)
UPDATE dealers SET
    contact_email = 'fred@nihonto.com',
    contact_page_url = 'https://nihonto.com/about-nihonto/',
    ships_international = true,
    requires_deposit = false,
    english_support = true
WHERE name = 'Nihonto';

-- 26. Nihonto Art (USA)
UPDATE dealers SET
    contact_email = 'contact@nihontoart.com',
    contact_page_url = 'https://www.nihontoart.com/contact',
    sales_policy_url = 'https://www.nihontoart.com/collecting',
    ships_international = true,
    accepts_wire_transfer = true,
    accepts_paypal = true,
    accepts_credit_card = true,
    requires_deposit = true,
    english_support = true
WHERE name = 'Nihonto Art';

-- 27. Swords of Japan (USA)
UPDATE dealers SET
    contact_email = 'theswordsofjapan@gmail.com',
    contact_page_url = 'https://swordsofjapan.com/contact/',
    accepts_paypal = true,
    accepts_credit_card = true,
    english_support = true
WHERE name = 'Swords of Japan';

-- -----------------------------------------------------------------------------
-- Part 3: Verification Query (for manual testing)
-- -----------------------------------------------------------------------------
-- Run this after migration to verify data:
-- SELECT name, domain, contact_email, ships_international, english_support
-- FROM dealers ORDER BY name;
