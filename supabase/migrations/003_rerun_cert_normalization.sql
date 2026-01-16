-- Re-run cert_type normalization
-- The initial migration may have run before data was imported

UPDATE listings SET cert_type = 'Juyo' WHERE LOWER(cert_type) = 'juyo' AND cert_type != 'Juyo';
UPDATE listings SET cert_type = 'Tokuju' WHERE LOWER(cert_type) IN ('tokuju', 'tokubetsu juyo', 'tokubetsu_juyo') AND cert_type != 'Tokuju';
UPDATE listings SET cert_type = 'TokuHozon' WHERE LOWER(cert_type) IN ('tokuhozon', 'tokubetsu hozon', 'tokubetsu_hozon') AND cert_type != 'TokuHozon';
UPDATE listings SET cert_type = 'Hozon' WHERE LOWER(cert_type) = 'hozon' AND cert_type != 'Hozon';
UPDATE listings SET cert_type = 'TokuKicho' WHERE LOWER(cert_type) IN ('tokukicho', 'tokubetsu kicho', 'tokubetsu_kicho') AND cert_type != 'TokuKicho';

-- Also normalize item_type to lowercase
UPDATE listings SET item_type = LOWER(item_type) WHERE item_type IS NOT NULL AND item_type != LOWER(item_type);
UPDATE listings SET item_type = 'fuchi-kashira' WHERE item_type = 'fuchi_kashira';
