#!/bin/sh
# Pose la clé API Rounded (agent vocal) dans le Vault Supabase, secret `rounded_api_key`.
#
# Avant : créer la clé dans Rounded (compte → API Keys → New Key), puis ajouter dans
# .secrets.local une ligne
#   ROUNDED_API_KEY=...
# La clé ne s'affiche jamais : fichier temporaire lisible du seul utilisateur, envoyé à
# `deposer-secret`, qui ne répond que « cree » ou « remplace ». Même procédé que
# scripts/poser-cle-claude.sh.
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.secrets.local; set +a
: "${ROUNDED_API_KEY:?ROUNDED_API_KEY absente de .secrets.local}"
: "${DEPOT_VISUEL_SECRET:?DEPOT_VISUEL_SECRET absent de .secrets.local}"

umask 077
corps=$(mktemp)
entete=$(mktemp)
trap 'rm -f "$corps" "$entete"' EXIT
python3 -c 'import json,os,sys; json.dump({"nom":"rounded_api_key","valeur":os.environ["ROUNDED_API_KEY"].strip()}, sys.stdout)' > "$corps"
printf 'x-depot-secret: %s\n' "$DEPOT_VISUEL_SECRET" > "$entete"

curl -s -X POST "https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/deposer-secret" \
  -H "Content-Type: application/json" -H @"$entete" --data-binary @"$corps"
echo
