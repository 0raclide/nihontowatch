#!/bin/bash
# Recover archived images from Wayback Machine for Yuhindo's Kencho listing
# CDX-verified URLs with correct timestamps — every URL here is confirmed to exist.
#
# Usage: bash scripts/recover-yuhindo-kencho-images.sh
# Images saved to: assets/yuhindo-kencho/

OUT="assets/yuhindo-kencho"
mkdir -p "$OUT"

DELAY=5
MIN_SIZE=3000
OK=0; FAIL=0; SKIP=0; CONSEC=0

dl() {
  local url="$1" fname="$2"

  if [ -f "$OUT/$fname" ]; then
    local ft; ft=$(file -b "$OUT/$fname" 2>/dev/null || true)
    if echo "$ft" | grep -qiE 'JPEG|PNG|WebP|image|bitmap|RIFF|ISO Media'; then
      local sz; sz=$(wc -c < "$OUT/$fname" | tr -d ' ')
      if [ "$sz" -gt "$MIN_SIZE" ]; then
        echo "SKIP $fname (${sz}b)"
        SKIP=$((SKIP+1)); CONSEC=0; return 0
      fi
    fi
    rm -f "$OUT/$fname"
  fi

  if [ "$CONSEC" -ge 3 ]; then
    echo "     [rate-limit backoff 30s]"
    sleep 30; CONSEC=0
  fi

  local code attempt=0
  while [ $attempt -lt 3 ]; do
    attempt=$((attempt+1))
    code=$(curl -s -o "$OUT/$fname" -w "%{http_code}" -L --max-time 30 \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
      -H "Referer: https://web.archive.org/" \
      "$url" 2>/dev/null || echo "000")

    if [ "$code" = "200" ] && [ -f "$OUT/$fname" ]; then
      local sz; sz=$(wc -c < "$OUT/$fname" | tr -d ' ')
      local ft; ft=$(file -b "$OUT/$fname" 2>/dev/null || true)

      if [ "$sz" -lt "$MIN_SIZE" ]; then
        rm -f "$OUT/$fname"
        [ $attempt -lt 3 ] && { echo "TINY $fname (${sz}b try $attempt)"; sleep 10; continue; }
        echo "FAIL $fname (${sz}b — error page)"
        FAIL=$((FAIL+1)); CONSEC=$((CONSEC+1)); return 1
      fi

      if ! echo "$ft" | grep -qiE 'JPEG|PNG|WebP|image|bitmap|RIFF|ISO Media'; then
        rm -f "$OUT/$fname"
        echo "FAIL $fname (not image: $ft)"
        FAIL=$((FAIL+1)); CONSEC=$((CONSEC+1)); return 1
      fi

      echo "  OK $fname (${sz}b)"
      OK=$((OK+1)); CONSEC=0; return 0
    else
      rm -f "$OUT/$fname"
      [ $attempt -lt 3 ] && { sleep 10; continue; }
      echo "FAIL $fname (HTTP $code)"
      FAIL=$((FAIL+1)); CONSEC=$((CONSEC+1)); return 1
    fi
  done
  return 1
}

WB="https://web.archive.org/web"

echo "================================================================"
echo "  Recovering Yuhindo Kencho (星月夜 顕長)"
echo "  CDX-verified URLs — ${DELAY}s between requests"
echo "================================================================"

# ──────────── HIGH-RES BLADE PHOTOS (JPEG, sh/ folder) ────────────
echo ""
echo "--- [1] High-res blade photos (sh/ 2560w JPEG) ---"
# These 5 are confirmed at the 2021 timestamp
dl "$WB/20210309124402im_/https://yuhindo.com/hoshizukiyo-kencho/sh/101.jpg" "blade-101.jpg"; sleep $DELAY
dl "$WB/20210309124413im_/https://yuhindo.com/hoshizukiyo-kencho/sh/043.jpg" "blade-043.jpg"; sleep $DELAY
dl "$WB/20210309124503im_/https://yuhindo.com/hoshizukiyo-kencho/sh/044.jpg" "blade-044.jpg"; sleep $DELAY
dl "$WB/20210309124453im_/https://yuhindo.com/hoshizukiyo-kencho/sh/059.jpg" "blade-059.jpg"; sleep $DELAY
dl "$WB/20210309124448im_/https://yuhindo.com/hoshizukiyo-kencho/sh/061.jpg" "blade-061.jpg"; sleep $DELAY

# ──────────── MEDIUM-RES (s2x/ 1726w WebP) — includes 3 NEW images ────────────
echo ""
echo "--- [2] Medium-res photos (s2x/ 1726w WebP) ---"
dl "$WB/20210309124426im_/https://yuhindo.com/hoshizukiyo-kencho/s2x/000.webp" "blade-000.webp"; sleep $DELAY
dl "$WB/20210309124425im_/https://yuhindo.com/hoshizukiyo-kencho/s2x/001.webp" "blade-001.webp"; sleep $DELAY
dl "$WB/20210309124430im_/https://yuhindo.com/hoshizukiyo-kencho/s2x/002.webp" "blade-002.webp"; sleep $DELAY
dl "$WB/20220108192937im_/https://yuhindo.com/hoshizukiyo-kencho/s2x/043.avif" "blade-043-s2x.avif"; sleep $DELAY

# ──────────── SMALL-RES AVIF (sl/ folder) — recovers 075, 045, 127 ────────────
echo ""
echo "--- [3] Small-res blade photos (sl/ AVIF — missing in JPEG) ---"
dl "$WB/20210309124343im_/https://yuhindo.com/hoshizukiyo-kencho/sl/075.avif" "blade-075.avif"; sleep $DELAY
dl "$WB/20210309124343im_/https://yuhindo.com/hoshizukiyo-kencho/sl/045.avif" "blade-045.avif"; sleep $DELAY
dl "$WB/20210309124349im_/https://yuhindo.com/hoshizukiyo-kencho/sl/127.avif" "blade-127.avif"; sleep $DELAY
# Also grab other sl/ avifs as backup
dl "$WB/20210309124344im_/https://yuhindo.com/hoshizukiyo-kencho/sl/000.avif" "blade-000-sl.avif"; sleep $DELAY
dl "$WB/20210309124344im_/https://yuhindo.com/hoshizukiyo-kencho/sl/001.avif" "blade-001-sl.avif"; sleep $DELAY

# ──────────── PRESENTATION IMAGES ────────────
echo ""
echo "--- [4] Presentation images ---"
dl "$WB/20220401054355im_/https://yuhindo.com/hoshizukiyo-kencho/sugata-koshirae.picture/sugata-koshirae-kencho@1m.avif" "sugata-koshirae-hires.avif"; sleep $DELAY
dl "$WB/20210309124343im_/https://yuhindo.com/hoshizukiyo-kencho/sugata-koshirae.picture/sugata-koshirae-kencho@1x.avif" "sugata-koshirae.avif"; sleep $DELAY
dl "$WB/20210309124401im_/https://yuhindo.com/hoshizukiyo-kencho/sugata.picture/sugata-kencho@2x.webp" "sugata.webp"; sleep $DELAY
dl "$WB/20210309124350im_/https://yuhindo.com/hoshizukiyo-kencho/heroes.picture/heroes-kencho@1x.avif" "heroes.avif"; sleep $DELAY
dl "$WB/20210309124343im_/https://yuhindo.com/hoshizukiyo-kencho/presentation.picture/presentation-kencho@1x.avif" "presentation.avif"; sleep $DELAY
dl "$WB/20210309124351im_/https://yuhindo.com/hoshizukiyo-kencho/yomo.picture/yomo-kencho@1x.avif" "yomo.avif"; sleep $DELAY

# ──────────── DOCUMENTATION (oshigata, origami, sayagaki) ────────────
echo ""
echo "--- [5] Documentation ---"
dl "$WB/20210309124351im_/https://yuhindo.com/hoshizukiyo-kencho/oshigata.picture/oshigata-kencho@1x.avif" "oshigata.avif"; sleep $DELAY
dl "$WB/20210309124352im_/https://yuhindo.com/hoshizukiyo-kencho/origami.picture/origami-kencho@1x.avif" "origami.avif"; sleep $DELAY
dl "$WB/20210309124353im_/https://yuhindo.com/hoshizukiyo-kencho/sayagaki.picture/sayagaki-kencho@1x.avif" "sayagaki.avif"; sleep $DELAY
dl "$WB/20210309124344im_/https://yuhindo.com/hoshizukiyo-kencho/long-oshigata.picture/long-oshigata-kencho@1x.avif" "long-oshigata.avif"; sleep $DELAY
dl "$WB/20210309124459im_/https://yuhindo.com/hoshizukiyo-kencho/long-oshigata.picture/long-oshigata-kencho@2x.webp" "long-oshigata-2x.webp"; sleep $DELAY

# ──────────── NBTHK REFERENCES ────────────
echo ""
echo "--- [6] NBTHK reference images ---"
dl "$WB/20210309124343im_/https://yuhindo.com/hoshizukiyo-kencho/660010092.picture/660010092-osafune-kencho@1x.avif" "nbthk-660010092.avif"; sleep $DELAY
dl "$WB/20210309124343im_/https://yuhindo.com/hoshizukiyo-kencho/220190038.picture/220190038-osafune-kencho@1x.avif" "nbthk-220190038.avif"; sleep $DELAY
dl "$WB/20210309124343im_/https://yuhindo.com/hoshizukiyo-kencho/330050706.picture/330050706-osafune-kencho@1x.avif" "nbthk-330050706.avif"; sleep $DELAY

# ──────────── EXHIBITION ESSAY (high-res confirmed) ────────────
echo ""
echo "--- [7] Exhibition essay scan ---"
dl "$WB/20220401054405im_/https://yuhindo.com/hoshizukiyo-kencho/ee43.picture/ee43-kencho@1m.webp" "essay-43-hires.webp"; sleep $DELAY

# ──────────── CONVERT AVIF → JPEG (if sips available) ────────────
echo ""
echo "--- Converting AVIF/WebP to JPEG ---"
converted=0
for f in "$OUT"/*.avif "$OUT"/*.webp; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  name="${base%.*}"
  jpg="$OUT/${name}.jpg"
  if [ -f "$jpg" ]; then
    echo "SKIP ${name}.jpg (exists)"
    continue
  fi
  if command -v sips &>/dev/null; then
    sips -s format jpeg "$f" --out "$jpg" &>/dev/null && {
      echo "CONV ${name}.jpg ($(wc -c < "$jpg" | tr -d ' ')b)"
      converted=$((converted+1))
    } || echo "ERR  ${name}.jpg conversion failed"
  elif command -v convert &>/dev/null; then
    convert "$f" "$jpg" 2>/dev/null && {
      echo "CONV ${name}.jpg ($(wc -c < "$jpg" | tr -d ' ')b)"
      converted=$((converted+1))
    } || echo "ERR  ${name}.jpg conversion failed"
  fi
done
[ $converted -eq 0 ] && echo "(no conversions needed or no converter available)"

# ──────────── SUMMARY ────────────
echo ""
echo "================================================================"
total_files=$(find "$OUT" -type f \( -name '*.jpg' -o -name '*.avif' -o -name '*.webp' \) 2>/dev/null | wc -l | tr -d ' ')
total_bytes=$(find "$OUT" -type f \( -name '*.jpg' -o -name '*.avif' -o -name '*.webp' \) -exec wc -c {} + 2>/dev/null | tail -1 | awk '{print $1}')
total_kb=$((${total_bytes:-0} / 1024))
echo "  Downloaded: $OK  |  Skipped: $SKIP  |  Failed: $FAIL"
echo "  Total files: $total_files  |  Total size: ${total_kb} KB"
echo "================================================================"
echo ""
echo "Files (largest first):"
ls -lhS "$OUT"/ 2>/dev/null | grep -E '\.(jpg|avif|webp)$' | awk '{printf "  %-8s %s\n", $5, $NF}'
