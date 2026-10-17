# -*- coding: utf-8 -*-
"""Voix off du film « Paiement Orange Money » (v5).

Une seule prise par voix (HeyGen, voix/essais/<nom>.wav + horodatage mot à mot <nom>.words.json, texte
voix/script.txt), découpée en neuf répliques, une par scène. Les jetons du texte sont les mêmes pour
toutes les voix (71 jetons) : les répliques se définissent donc par plage de jetons, et chaque geste de
l'image se cale sur l'attaque d'un mot (« le geste tombe sur le mot »).

`python3 voix.py <nom>` écrit assets/voix/<nom>-L1.wav … L9.wav (prise normalisée à -16 LUFS, coupée
avec 60 ms d'avance et 150 ms de traîne, fondus courts).
"""
import json
import os
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))

# Plages de jetons (inclusives) des neuf répliques, dans l'ordre des scènes f01 … f09.
LIGNES = [(0, 4), (5, 16), (17, 21), (22, 28), (29, 38), (39, 46), (47, 50), (51, 60), (61, 70)]
TEXTES = [
    "Nouveau sur Taxi Food !",
    "Ding-dong ! Ton livreur est là… mais il n'a pas la monnaie.",
    "Plus besoin de monnaie !",
    "Au moment de payer, choisis Orange Money.",
    "Compose le dièse cent quarante-quatre dièse, puis tape ton code.",
    "Paiement confirmé : La Cabane reçoit ta commande.",
    "Payé. Rien à sortir.",
    "Ding-dong ! Cette fois, c'est déjà payé. Bon appétit !",
    "Taxi Food : paie avec Orange Money. Sans frais !",
]
AVANT, APRES = 0.06, 0.15


def _alpha(mot):
    return any(c.isalpha() for c in mot['text'])


def repliques(nom):
    """Liste de 9 dict : debut / fin dans la prise (s), duree (attaque du 1er mot → fin du dernier),
    mots = [(texte, attaque, fin)] relatifs à l'attaque du premier mot. Seuls les vrais mots comptent
    (HeyGen horodate aussi la ponctuation, sur les silences)."""
    mots = json.load(open(os.path.join(ICI, 'voix', 'essais', f'{nom}.words.json'), encoding='utf-8'))
    assert len(mots) == 71, f'{nom} : {len(mots)} jetons au lieu de 71 (le texte a changé ?)'
    sortie = []
    for a, b in LIGNES:
        ms = [m for m in mots[a:b + 1] if _alpha(m)]
        d0 = ms[0]['start']
        sortie.append({
            'debut': d0, 'fin': ms[-1]['end'], 'duree': round(ms[-1]['end'] - d0, 3),
            'mots': [(m['text'], round(m['start'] - d0, 3), round(m['end'] - d0, 3)) for m in ms],
        })
    return sortie


def fichier(nom, i):
    return f'assets/voix/{nom}-L{i + 1}.wav'


def exporter(nom):
    rs = repliques(nom)
    os.makedirs(os.path.join(ICI, 'assets', 'voix'), exist_ok=True)
    norme = os.path.join(ICI, 'voix', f'.{nom}-norme.wav')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(ICI, 'voix', 'essais', f'{nom}.wav'),
                    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '1', norme], check=True)
    for i, r in enumerate(rs):
        d0 = max(0.0, r['debut'] - AVANT)
        suivant = rs[i + 1]['debut'] - 0.02 if i + 1 < len(rs) else r['fin'] + APRES
        d1 = min(r['fin'] + APRES, suivant)
        duree = d1 - d0
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{d0:.3f}', '-t', f'{duree:.3f}', '-i', norme,
                        '-af', f'afade=t=in:d=0.012,afade=t=out:st={max(0, duree - 0.06):.3f}:d=0.06',
                        os.path.join(ICI, fichier(nom, i))], check=True)
        r['fichier_avance'] = round(r['debut'] - d0, 3)   # le 1er mot attaque à cet instant du fichier
        r['fichier_duree'] = round(duree, 3)
    os.remove(norme)
    json.dump(rs, open(os.path.join(ICI, 'voix', f'{nom}.repliques.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return rs


def charger(nom):
    p = os.path.join(ICI, 'voix', f'{nom}.repliques.json')
    if not os.path.exists(p):
        return exporter(nom)
    return json.load(open(p, encoding='utf-8'))


if __name__ == '__main__':
    nom = sys.argv[1] if len(sys.argv) > 1 else 'chloe'
    for i, r in enumerate(exporter(nom)):
        print(f'L{i + 1} {r["duree"]:5.2f} s  {TEXTES[i]}')
