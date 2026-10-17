#!/bin/sh
# Pose les deux clés Orange Money WebPay dans le Vault Supabase :
#   om_merchant_key  <- OM_DEV_MERCHANT_KEY  (ou OM_MERCHANT_KEY en production)
#   om_auth_header   <- OM_DEV_AUTH_HEADER   (ou OM_AUTH_HEADER, base64 client_id:client_secret, sans « Basic »)
# Les valeurs ne s'affichent jamais : fichier temporaire lisible du seul
# utilisateur, envoyé à `deposer-secret`, qui ne répond que « cree » ou « remplace ».
# Passer en production : mettre OM_MERCHANT_KEY / OM_AUTH_HEADER dans .secrets.local,
# relancer ce script, puis `update payment_config set om_environnement = 'mg'`.
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.secrets.local; set +a
: "${DEPOT_VISUEL_SECRET:?DEPOT_VISUEL_SECRET absent de .secrets.local}"
CLE="${OM_MERCHANT_KEY:-${OM_DEV_MERCHANT_KEY:-}}"
ENTETE="${OM_AUTH_HEADER:-${OM_DEV_AUTH_HEADER:-}}"
[ -n "$CLE" ] || { echo "clé marchand absente de .secrets.local"; exit 1; }
[ -n "$ENTETE" ] || { echo "en-tête d'authentification absent de .secrets.local"; exit 1; }

umask 077
corps=$(mktemp)
entete=$(mktemp)
trap 'rm -f "$corps" "$entete"' EXIT
printf 'x-depot-secret: %s\n' "$DEPOT_VISUEL_SECRET" > "$entete"

for paire in "om_merchant_key:CLE" "om_auth_header:ENTETE"; do
  nom=${paire%%:*}; var=${paire#*:}
  NOM="$nom" VAL="$(eval echo \"\$$var\")" python3 -c 'import json,os,sys; json.dump({"nom":os.environ["NOM"],"valeur":os.environ["VAL"].strip().removeprefix("Basic ").strip()}, sys.stdout)' > "$corps"
  curl -s -X POST "https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/deposer-secret" \
    -H "Content-Type: application/json" -H @"$entete" --data-binary @"$corps"
  echo
done
