-- Fix Choshuya items that were incorrectly classified as 'tosogu'
-- These items are actually swords or firearms based on their descriptions and attributes

-- ===========================================
-- SWORDS incorrectly classified as 'tosogu'
-- ===========================================

-- 33619: 横山加賀介藤原祐永 - Shin-shinto sword by Yokoyama Sukenaga
UPDATE listings SET item_type = 'katana' WHERE id = 33619 AND item_type = 'tosogu';

-- 35611: 備州長船師光 応永二年六月日 - Koto sword by Moromitsu of Osafune
UPDATE listings SET item_type = 'katana' WHERE id = 35611 AND item_type = 'tosogu';

-- 35722: 無銘 了久信 - Kamakura period sword attributed to Ryokuhisanobu (Rai school)
UPDATE listings SET item_type = 'katana' WHERE id = 35722 AND item_type = 'tosogu';

-- 35760: 銘 盛次(金剛兵衛) - Muromachi sword by Moritsugu of Kongobei school
UPDATE listings SET item_type = 'katana' WHERE id = 35760 AND item_type = 'tosogu';

-- 35825: 無銘 雲次 - Kamakura tachi attributed to Kumotsugu of Bizen
UPDATE listings SET item_type = 'katana' WHERE id = 35825 AND item_type = 'tosogu';

-- 35947: 銘 康道(美濃千手院) - Muromachi ko-tachi by Yasumichi of Senjuin
UPDATE listings SET item_type = 'katana' WHERE id = 35947 AND item_type = 'tosogu';

-- 36063: 銘 源式部丞信国 永享四年八月日 - Muromachi sword by Nobukuni
UPDATE listings SET item_type = 'katana' WHERE id = 36063 AND item_type = 'tosogu';


-- ===========================================
-- FIREARMS incorrectly classified as 'tosogu'
-- ===========================================

-- 33393: 火縄銃(中筒) 銘 国友・・・(備前筒) - Matchlock gun by Kunitomo
UPDATE listings SET item_type = 'tanegashima' WHERE id = 33393 AND item_type = 'tosogu';

-- 33605: 銘 二重巻張江州国友太与助勝正 - Gun by Kunitomo Tayosuke Katsumasa
UPDATE listings SET item_type = 'tanegashima' WHERE id = 33605 AND item_type = 'tosogu';

-- 34106: 管打式銃 銘 惣鍛二重巻張 江州国友藤一作 三十一 - Percussion cap gun
UPDATE listings SET item_type = 'tanegashima' WHERE id = 34106 AND item_type = 'tosogu';

-- 34149: 巻張 摂州住芝辻理右衛門作 - Gun by Shibatsuji Riemon
UPDATE listings SET item_type = 'tanegashima' WHERE id = 34149 AND item_type = 'tosogu';

-- 34785: 火縄銃 銘 國友(備前筒) - Matchlock gun by Kunitomo
UPDATE listings SET item_type = 'tanegashima' WHERE id = 34785 AND item_type = 'tosogu';

-- 34923: 管打式銃 銘 惣鍛二重巻張 江州国友藤一作 三十一 - Percussion cap gun
UPDATE listings SET item_type = 'tanegashima' WHERE id = 34923 AND item_type = 'tosogu';

-- 35628: 銘 二重巻張 □重□□ 附 火縄銃台 銘 林山〔印〕 - Matchlock gun with stand
UPDATE listings SET item_type = 'tanegashima' WHERE id = 35628 AND item_type = 'tosogu';

-- 35882: 銘 巻張 摂津住井川与三兵衛作 - Gun by Igawa Yozabei
UPDATE listings SET item_type = 'tanegashima' WHERE id = 35882 AND item_type = 'tosogu';

-- 36154: 火縄銃 銘 摂州住嶌谷喜八郎作 - Matchlock gun by Shimatani Kihachiro
UPDATE listings SET item_type = 'tanegashima' WHERE id = 36154 AND item_type = 'tosogu';


-- ===========================================
-- Verification: Show what was updated
-- ===========================================
-- Run this after migration to verify:
-- SELECT id, title, item_type FROM listings WHERE id IN (33619, 35611, 35722, 35760, 35825, 35947, 36063, 33393, 33605, 34106, 34149, 34785, 34923, 35628, 35882, 36154);
