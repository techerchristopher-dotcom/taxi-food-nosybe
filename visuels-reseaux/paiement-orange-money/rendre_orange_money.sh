#!/bin/sh
# Rend le visuel avec le Chrome du Mac (Playwright absent) et lit les controles.
set -e
cd "$(dirname "$0")"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
python3 pub_orange_money.py
U="file://$PWD/orange-money.html"
"$CH" --headless=new --hide-scrollbars --virtual-time-budget=6000 --dump-dom "$U" 2>/dev/null \
  | sed -n '/<pre id="m"/,/<\/pre>/p' | sed 's/<[^>]*>//g'
"$CH" --headless=new --hide-scrollbars --window-size=1080,1350 --force-device-scale-factor=2 \
  --virtual-time-budget=6000 --screenshot="$PWD/PUB-orange-money.png" "$U" 2>/dev/null
sips -g pixelWidth -g pixelHeight PUB-orange-money.png | tail -2
