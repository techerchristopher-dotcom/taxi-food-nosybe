#!/bin/sh
# Rend les trois visuels avec le Chrome du Mac et lit les controles mesures.
set -e
cd "$(dirname "$0")"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
python3 pub_reouverture.py
for n in officielle officieuse ce-soir; do
  U="file://$PWD/$n.html"
  echo "== $n"
  "$CH" --headless=new --hide-scrollbars --virtual-time-budget=6000 --dump-dom "$U" 2>/dev/null \
    | sed -n '/<pre id="m"/,/<\/pre>/p' | sed 's/<[^>]*>//g'
  "$CH" --headless=new --hide-scrollbars --window-size=1080,1350 --force-device-scale-factor=2 \
    --virtual-time-budget=6000 --screenshot="$PWD/PUB-reouverture-$n.png" "$U" 2>/dev/null
done
