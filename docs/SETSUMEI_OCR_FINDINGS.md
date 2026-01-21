# Setsumei OCR Pipeline - Findings & Results

## Final Results (Jan 2026)

| Metric | Value |
|--------|-------|
| Total Processed | 224 |
| Successful OCR | 182 (81%) |
| With EN Translation | 182 |
| Failed | 42 |

## Success Rate by Dealer

| Dealer | Rate | Notes |
|--------|------|-------|
| Nihonto, Touken Matsumoto, Shoubudou | 100% | Excellent detection |
| Aoi Art | 94% | URL patterns work well |
| Taiseido | 88% | Good composite detection |
| Eirakudo | 84% | High volume, consistent |
| Token-Net | 78% | Good coverage |
| World Seiyudo | 77% | Fixed blade composite issue |
| Kusanagi | 75% | Fixed thumbnail vs larger issue |
| Samurai Nippon, Wakeidou | 67% | Acceptable |
| Iida Koendo | 46% | Some listings lack cert images |
| Tsuruginoya | 40% | Detection struggles |
| **Choshuya** | 0% | No cert images (oshigata only) |
| **Katanahanbai** | 0% | Text-only certs (no images) |
| **Nipponto** | 0% | Generic naming, hard to detect |

## Key Improvements Made

### 1. 4x Lanczos Super-Resolution
- Applied to all images < 2000px width
- Significantly improved OCR accuracy on small certificate images

### 2. World Seiyudo Fix
- Excluded blade composites (950a/b/c patterns) from detection
- Only matches document composites (950d patterns)

### 3. Kusanagi Fix  
- Prefer larger images (llimg/) over thumbnails (limg/)
- 640px versions OCR much better than 250px thumbnails

### 4. Choshuya Strategy
- Created explicit skip strategy
- *_oshi_*.jpg files are oshigata (blade tracings), not certificates

## Dealers Without Certificate Images

These dealers do NOT upload certificate images:
- **Katanahanbai**: Text-only certification info
- **Choshuya**: Oshigata drawings only, no setsumei scans
- **Nipponto**: Some listings lack cert images entirely

## Error Breakdown

| Error Type | Count | Notes |
|------------|-------|-------|
| OCR validation failed | 34 | Text too short or wrong chars |
| Network errors | 14 | Retryable |
| No text detected | 8 | Wrong image or blank |

## Database Fields

Setsumei data stored in `listings` table:
- `setsumei_image_url` - Detected certificate image URL
- `setsumei_ocr_raw` - Raw OCR text from Google Cloud Vision
- `setsumei_text_ja` - Corrected Japanese text (GPT-4o)
- `setsumei_text_en` - English translation
- `setsumei_metadata` - JSON with session numbers, dates, etc.
- `setsumei_processed_at` - Processing timestamp
- `setsumei_error` - Error message if failed
