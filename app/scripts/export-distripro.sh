#!/bin/sh
# Construit le site distripro207.com (APP_VARIANT=distripro) dans app/dist-distripro.
#   sh scripts/export-distripro.sh        (depuis app/)
# Puis déployer DEPUIS LA COPIE PRINCIPALE avec un --dir absolu (règle des worktrees) :
#   npx netlify deploy --prod --dir="<chemin absolu>/app/dist-distripro" --site=<id du site distripro>
#
# Le gabarit HTML de l'app (public/index.html) est celui de TAXI FOOD (couleurs, mesure
# Umami, pages légales) : on le réécrit ici. Les fichiers propres au site vivent dans
# distripro/site/ (page Frity, icônes) — jamais dans dist-distripro, recréé à chaque fois.
set -e
cd "$(dirname "$0")/.."
rm -rf dist-distripro
APP_VARIANT=distripro npx expo export -p web --output-dir dist-distripro
python3 distripro/site/finir_export.py dist-distripro
