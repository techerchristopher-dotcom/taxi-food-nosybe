# -*- coding: utf-8 -*-
"""Papier contre appli, ligne a ligne. On ne conclut pas, on compte."""
import json, sys, unicodedata, re
sys.path.insert(0, '/root/audit-bidul')
from carte_papier_bidul import PAPIER, SUPPLEMENTS_PAPIER, SANS_PRIX_AU_PAPIER

def cle(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '', s)

APPLI = json.load(open('appli_bidul.json'))
app = {cle(x['plat']): x for x in APPLI}

nourriture, boissons, absents, ecarts = [], [], [], []
for nom, px_papier in PAPIER.items():
    k = cle(nom)
    if k not in app:
        absents.append(nom); continue
    a = app.pop(k)
    d = a['price'] - px_papier
    (boissons if a['boisson'] else nourriture).append((nom, px_papier, a['price'], d))
    if a['boisson'] and d != 0: ecarts.append((nom, px_papier, a['price'], d))

def bloc(titre, L):
    if not L: return
    print('\n%s — %d lignes' % (titre, len(L)))
    ds = sorted({d for _,_,_,d in L})
    for d in ds:
        n = sum(1 for x in L if x[3] == d)
        print('   ecart %+6d Ar : %2d ligne(s)' % (d, n))
    for nom, p, a, d in sorted(L, key=lambda x: (x[3], x[0])):
        if d != (0 if L is boissons else 1000):
            print('     ! %-42s papier %6d   appli %6d   %+d' % (nom, p, a, d))

bloc('NOURRITURE', nourriture)
bloc('BOISSONS', boissons)

if absents:
    print('\nAU PAPIER, PAS TROUVE EN BASE (%d) :' % len(absents))
    for n in absents: print('   %s' % n)
reste = [v for v in app.values() if v['in_menu']]
if reste:
    print('\nEN BASE, PAS SUR LES 3 PHOTOS (%d) :' % len(reste))
    for v in sorted(reste, key=lambda x: (x['categorie'], x['price'])):
        print('   %-12s %-42s %6d Ar' % (v['categorie'], v['plat'], v['price']))

print('\nSUPPLEMENTS')
print('   %-38s %-18s %s' % ('', 'papier', 'appli'))
print('   %-38s %-18s %s' % ('2e accompagnement (riz, rougail)', '4 000 Ar', '5 000 Ar   +1 000'))
print('   %-38s %-18s %s' % ('2e accompagnement (frites, legumes,', 'non chiffre', '5 000 Ar'))
print('   %-38s %-18s %s' % ('  pates, puree)', '', ''))
print('   %-38s %-18s %s' % ('Supplement sauce', '5 000 Ar', 'ABSENT de l appli'))
print('   %-38s %-18s %s' % ('Supplement fromage (pates)', '6 000 Ar', 'ABSENT de l appli'))

n_1000 = sum(1 for _,_,_,d in nourriture if d == 1000)
print('\nCONCLUSION CHIFFREE')
print('   nourriture : %d lignes sur %d a exactement +1 000 Ar' % (n_1000, len(nourriture)))
print('   boissons   : %d lignes sur %d a 0 Ar d ecart' % (sum(1 for _,_,_,d in boissons if d==0), len(boissons)))
print('   le brasero (%d lignes) dit « Voir tableau » au papier : non comparable ici' % len(SANS_PRIX_AU_PAPIER))
