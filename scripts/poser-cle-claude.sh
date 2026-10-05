#!/bin/sh
# Pose la clé API Claude dans le Vault Supabase (secret `anthropic_api_key`),
# ce qui active la traduction automatique du menu (fonction traduire-catalogue).
#
# Avant : ajouter dans .secrets.local une ligne
#   ANTHROPIC_API_KEY=sk-ant-...
# La clé ne s'affiche jamais : elle passe par un fichier temporaire lisible du
# seul utilisateur, envoyé à `deposer-secret`, qui ne répond que « cree » ou
# « remplace ». ⚠️ curl et pas Python : le Python 3.14 de ce poste n'a pas de
# certificats racine (CERTIFICATE_VERIFY_FAILED).
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.secrets.local; set +a
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY absente de .secrets.local}"
: "${DEPOT_VISUEL_SECRET:?DEPOT_VISUEL_SECRET absent de .secrets.local}"

umask 077
corps=$(mktemp)
entete=$(mktemp)
trap 'rm -f "$corps" "$entete"' EXIT
python3 -c 'import json,os,sys; json.dump({"nom":"anthropic_api_key","valeur":os.environ["ANTHROPIC_API_KEY"].strip()}, sys.stdout)' > "$corps"
printf 'x-depot-secret: %s\n' "$DEPOT_VISUEL_SECRET" > "$entete"

curl -s -X POST "https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/deposer-secret" \
  -H "Content-Type: application/json" -H @"$entete" --data-binary @"$corps"
echo
