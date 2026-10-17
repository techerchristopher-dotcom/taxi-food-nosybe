#!/bin/sh
# v5 (voix off + 3D) : génère les compositions pour la voix choisie, creuse la musique sous la voix
# (carve, skill hyperframes-audio), puis contrôle. Rendu ensuite :
#   npx --yes hyperframes@0.8.167 render -q delivery -o ../VIDEO-FINALE/taxi-food-orange-money-9x16-v5.mp4
# Usage : VOIX=chloe sh construire5.sh   (voix possibles : chloe, theo, etienne — voix/essais/)
set -e
cd "$(dirname "$0")"
VOIX=${VOIX:-chloe}
[ -f "voix/$VOIX.repliques.json" ] && [ -f "assets/voix/$VOIX-L1.wav" ] || python3 voix.py "$VOIX"
VOIX=$VOIX python3 gen5.py
# carve.mjs a besoin de @hyperframes/core (même version que la CLI), installé une fois hors du dépôt.
CORE=${HF_CORE:-$HOME/.cache/hf-core-0.8.167}
[ -d "$CORE/node_modules/@hyperframes/core" ] || (mkdir -p "$CORE" && cd "$CORE" && npm i --silent --no-audit --no-fund @hyperframes/core@0.8.167)
node ~/.claude/skills/hyperframes-audio/scripts/carve.mjs --comp index.html --bed musique --core "$CORE" | tail -1
npx --yes hyperframes@0.8.167 check
