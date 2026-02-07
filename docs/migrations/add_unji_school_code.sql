-- Migration: Add NS-Unji school code to smith_entities
-- This allows matching mumei swords attributed to the Unji school (雲次派)
-- Date: 2026-02-06

INSERT INTO smith_entities (
    smith_id,
    name_kanji,
    name_romaji,
    name_romaji_normalized,
    province,
    school,
    is_school_code,
    -- Stats fields (0 for school codes as they're placeholders)
    kokuho_count,
    jubun_count,
    jubi_count,
    gyobutsu_count,
    tokuju_count,
    juyo_count,
    total_items,
    elite_count,
    elite_factor
) VALUES (
    'NS-Unji',
    '雲次',
    'Unji',
    'Unji',
    'Yamato',  -- Unji school originated in Yamato province
    'Unji',
    true,
    0, 0, 0, 0, 0, 0, 0, 0, 0
)
ON CONFLICT (smith_id) DO NOTHING;
