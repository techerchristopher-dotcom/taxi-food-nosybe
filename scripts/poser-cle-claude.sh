#!/bin/sh
# Pose la clé API Claude dans le Vault Supabase (secret `anthropic_api_key`),
# ce qui active la traduction automatique du menu (fonction traduire-catalogue).
#
# Avant : ajouter dans .secrets.local une ligne
#   ANTHROPIC_API_KEY=sk-ant-...
# La clé ne s'affiche jamais : lue dans une variable, envoyée à `deposer-secret`,
# la réponse ne dit que « cree » ou « remplace ».
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.secrets.local; set +a
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY absente de .secrets.local}"
: "${DEPOT_VISUEL_SECRET:?DEPOT_VISUEL_SECRET absent de .secrets.local}"

python3 - <<'PY'
import json, os, urllib.request
corps = json.dumps({"nom": "anthropic_api_key", "valeur": os.environ["ANTHROPIC_API_KEY"].strip()}).encode()
req = urllib.request.Request(
    "https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/deposer-secret",
    data=corps, method="POST",
    headers={"Content-Type": "application/json", "x-depot-secret": os.environ["DEPOT_VISUEL_SECRET"]},
)
try:
    print(urllib.request.urlopen(req).read().decode())
except urllib.error.HTTPError as e:
    print("refus", e.code, e.read().decode())
PY
