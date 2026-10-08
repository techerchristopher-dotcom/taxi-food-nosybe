#!/bin/sh
# Pose le jeton de la Page Facebook Taxi Food dans le Vault (secret `facebook_page_token`),
# ce qui active la publication automatique des avis positifs (fonction publier-avis-facebook).
#
# Avant : ajouter dans .secrets.local une ligne
#   FACEBOOK_PAGE_TOKEN=EAA... (jeton de Page longue durée, Meta Business Suite)
# Le jeton ne s'affiche jamais : il passe par un fichier temporaire lisible du
# seul utilisateur, envoyé à `deposer-secret`, qui ne répond que « cree » ou
# « remplace ». ⚠️ curl et pas Python : le Python 3.14 de ce poste n'a pas de
# certificats racine (CERTIFICATE_VERIFY_FAILED).
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.secrets.local; set +a
: "${FACEBOOK_PAGE_TOKEN:?FACEBOOK_PAGE_TOKEN absent de .secrets.local}"
: "${DEPOT_VISUEL_SECRET:?DEPOT_VISUEL_SECRET absent de .secrets.local}"

umask 077
corps=$(mktemp)
entete=$(mktemp)
trap 'rm -f "$corps" "$entete"' EXIT
python3 -c 'import json,os,sys; json.dump({"nom":"facebook_page_token","valeur":os.environ["FACEBOOK_PAGE_TOKEN"].strip()}, sys.stdout)' > "$corps"
printf 'x-depot-secret: %s\n' "$DEPOT_VISUEL_SECRET" > "$entete"

curl -s -X POST "https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/deposer-secret" \
  -H "Content-Type: application/json" -H @"$entete" --data-binary @"$corps"
echo
