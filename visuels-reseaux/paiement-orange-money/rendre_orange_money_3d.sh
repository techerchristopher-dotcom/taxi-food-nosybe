#!/bin/sh
# Rend la variante 3D du visuel avec le Chrome du Mac (WebGL, capture 2x) et lit les controles.
set -e
cd "$(dirname "$0")"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
python3 pub_orange_money_3d.py
U="file://$PWD/orange-money-3d.html"
"$CH" --headless=new --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=2 --virtual-time-budget=8000 --dump-dom "$U" 2>/dev/null \
  | sed -n '/<pre id="m"/,/<\/pre>/p' | sed 's/<[^>]*>//g'
"$CH" --headless=new --hide-scrollbars --allow-file-access-from-files --window-size=1080,1350 --force-device-scale-factor=2 \
  --virtual-time-budget=8000 --screenshot="$PWD/PUB-orange-money-3d.png" "$U" 2>/dev/null
sips -g pixelWidth -g pixelHeight PUB-orange-money-3d.png | tail -2
