-- Fix firearms incorrectly classified as 'unknown' or 'katana'
-- These are all matchlock guns (火縄銃 hinawaju / tanegashima 種子島)

-- From various dealers with firearm keywords in title
UPDATE listings SET item_type = 'tanegashima' WHERE id = 42548;  -- Tanegashima 種子島
UPDATE listings SET item_type = 'tanegashima' WHERE id = 35756;  -- 火縄銃 無銘 堺筒
UPDATE listings SET item_type = 'tanegashima' WHERE id = 35169;  -- 火縄銃無銘 堺筒
UPDATE listings SET item_type = 'tanegashima' WHERE id = 44404;  -- 火縄銃 □三左衛門作 三十八
UPDATE listings SET item_type = 'tanegashima' WHERE id = 33798;  -- 中筒火縄銃 無銘
UPDATE listings SET item_type = 'tanegashima' WHERE id = 5475;   -- 阿波筒火縄銃 芝辻長左衛門邦富作
UPDATE listings SET item_type = 'tanegashima' WHERE id = 35227;  -- 火縄銃管打式銃 江州国友藤一作
UPDATE listings SET item_type = 'tanegashima' WHERE id = 44402;  -- 火縄銃 無銘
UPDATE listings SET item_type = 'tanegashima' WHERE id = 35049;  -- 火縄銃 銘 國友(備前筒)
UPDATE listings SET item_type = 'tanegashima' WHERE id = 34943;  -- 無銘 堺筒
UPDATE listings SET item_type = 'tanegashima' WHERE id = 35398;  -- 火縄銃 無銘
UPDATE listings SET item_type = 'tanegashima' WHERE id = 5468;   -- 土佐筒火縄銃 土州住秋本喜平重義作

-- Note: ID 34408 is correctly classified as 'tsuba' - it's a catalog page
-- that mentions firearms among other tosogu types, not a firearm itself
