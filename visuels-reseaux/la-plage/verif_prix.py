# -*- coding: utf-8 -*-
"""Chaque prix de la carte est-il celui de la base ? Compare ligne a ligne.

Le carton papier et la base concordaient deja (releve du 23/09). Ce controle
verifie que MA SAISIE n'a rien deforme entre les deux."""
import json, sys, unicodedata, re
sys.path.insert(0, '/root/carte-laplage')
import donnees_laplage as d

def cle(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'—\s*(a partir de|des)\s*$', '', s).strip()
    return re.sub(r'[^a-z0-9]+', '', s)

BASE = json.load(open('/root/carte-laplage/base_laplage.json'))
mien = {}
for nom in ('ENTREES', 'GRILLADES', 'SANDWICHS', 'PLATS', 'DESSERTS'):
    for p in getattr(d, nom):
        mien[cle(p[0])] = (p[0], p[1], p[5])

ok = True
print('%-42s %9s %9s' % ('plat', 'ma carte', 'base'))
for b in BASE:
    k = cle(b['plat'])
    if k not in mien:
        print('%-42s %9s %9d   ABSENT DE MA CARTE' % (b['plat'], '-', b['price'])); ok = False; continue
    nom, prix, photo = mien.pop(k)
    flag = '' if prix == b['price'] else '   ECART'
    if flag: ok = False
    ph = '' if photo and photo in b['fichier'] else '   PHOTO ?'
    if ph: ok = False
    if flag or ph:
        print('%-42s %9d %9d%s%s' % (nom, prix, b['price'], flag, ph))
for k, (nom, prix, _) in mien.items():
    print('%-42s %9d %9s   PAS EN BASE' % (nom, prix, '-')); ok = False

nb = sum(len(getattr(d, n)) for n in ('ENTREES','GRILLADES','SANDWICHS','PLATS','DESSERTS'))
nbo = sum(len(getattr(d, n)) for n in ('FRAICHES','CHAUDES','BIERES','COCKTAILS','VIN','SPIRITUEUX'))
print('\n  plats    %2d / 38     boissons %2d / 39' % (nb, nbo))
print('  %d lignes comparees, %s' % (len(BASE), 'AUCUN ECART' if ok else 'ECARTS CI-DESSUS'))
ok &= (nb == 38 and nbo == 39)
print('  ->  %s' % ('CONFORME' if ok else 'A CORRIGER'))
