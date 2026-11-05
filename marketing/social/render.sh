#!/usr/bin/env bash
# Render a carousel.html into 1080x1350 PNGs (Instagram 4:5) with headless Chrome.
# Usage: bash marketing/social/render.sh marketing/social/<post-folder> <slide-count>
set -euo pipefail
DIR="$(cd "$1" && { pwd -W 2>/dev/null || pwd; })"
COUNT="$2"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
mkdir -p "$1/export"
for i in $(seq 1 "$COUNT"); do
  out="$DIR/export/slide-$(printf '%02d' "$i").png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1080,1350 --virtual-time-budget=8000 \
    --screenshot="$out" "file:///$DIR/carousel.html?s=$i" 2>/dev/null
  echo "wrote $out"
done
