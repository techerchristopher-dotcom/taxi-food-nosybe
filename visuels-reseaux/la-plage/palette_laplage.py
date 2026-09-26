# -*- coding: utf-8 -*-
"""La palette de la carte de La Plage, lue sur SON logo et non sur ses photos.

Meme methode que pour Chez Bidul & Truc. Mesure sur les 262 144 pixels du logo
(`produits/la-plage/divers/logo.jpeg`, 512 x 512) :

  blanc du fond  #FEFFFE   77,5 % de l'image
  bleu mer       #0F90BA   33,1 % des pixels colores, teinte 195
  orange soleil  #F76309   24,2 %, teinte 23
  rouge soleil   #F10D1E   14,1 %, teinte 355
  bleu profond   #266D8A   11,3 %, teinte 197
  terre          #BF5236   10,7 %, teinte 12

Son logo est un SOLEIL QUI SE COUCHE SUR LA MER : un arc orange-rouge au-dessus
de deux vagues bleues. Deux familles de teintes, pas une — et c'est cette
opposition chaud/froid qui fait l'identite. La carte s'y tient.
"""
import colorsys
import numpy as np

def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def hexa(c):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in c)
def lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
def L(c):
    return float(lin(c) @ np.array([0.2126, 0.7152, 0.0722]))
def ratio(a, b):
    la, lb = L(rgb(a) if isinstance(a, str) else a)+0.05, L(rgb(b) if isinstance(b, str) else b)+0.05
    return max(la, lb)/min(la, lb)

def assombrir(h, cible, fond):
    """Descend la VALEUR a teinte et saturation constantes jusqu'au contraste
    voulu. On ne change pas la couleur, on change sa luminosite : un rouge
    « corrige » en RGB devient un autre rouge, ce qui trahit la marque."""
    hh, s, v = colorsys.rgb_to_hsv(*(np.array(rgb(h))/255))
    for i in range(1000):
        # On QUANTIFIE avant de tester. Sans cela le test porte sur un flottant
        # et la valeur rendue, arrondie a l'entier par hexa(), retombe sous la
        # cible : l'orange sortait a 4,48:1 pour une cible de 4,50.
        c = np.array(rgb(hexa(np.array(colorsys.hsv_to_rgb(hh, s, v))*255)), float)
        if ratio(c, rgb(fond)) >= cible:
            return hexa(c), v
        v -= 0.001
    return hexa(np.array(colorsys.hsv_to_rgb(hh, s, 0))*255), 0.0

LOGO = {'blanc': '#FEFFFE', 'bleu': '#0F90BA', 'orange': '#F76309',
        'rouge': '#F10D1E', 'bleu_profond': '#266D8A', 'terre': '#BF5236'}

# LE FOND. Le blanc du logo, tire vers le sable de 3,5 % en teinte 38 : c'est
# une carte de bord de mer, et un fond legerement chaud coute moins cher a
# imprimer qu'un blanc pur qui exige un papier couche.
h, s, v = colorsys.rgb_to_hsv(*(np.array(rgb(LOGO['blanc']))/255))
FOND = hexa(np.array(colorsys.hsv_to_rgb(38/360, 0.035, v))*255)

if __name__ == '__main__':
    print('LOGO MESURE')
    for k, x in LOGO.items():
        print('  %-13s %s   sur blanc %5.2f:1' % (k, x, ratio(x, '#FFFFFF')))
    print('\nFOND DE CARTE : %s  (le blanc du logo, tire vers le sable)' % FOND)
    print('\nCONTRASTE DE CHAQUE COULEUR DU LOGO SUR CE FOND')
    for k, x in LOGO.items():
        r = ratio(x, FOND)
        print('  %-13s %s   %5.2f:1   %s' % (k, x, r, 'ok texte' if r >= 4.5 else
              ('ok gros titre' if r >= 3.0 else 'INSUFFISANT')))
    print('\nCORRECTIONS A TEINTE ET SATURATION CONSTANTES (cible 4,5:1)')
    for k in ('bleu', 'orange', 'rouge', 'bleu_profond', 'terre'):
        c, v2 = assombrir(LOGO[k], 4.5, FOND)
        print('  %-13s %s -> %s   valeur %.0f %%   %5.2f:1'
              % (k, LOGO[k], c, v2*100, ratio(c, FOND)))
    encre, _ = assombrir(LOGO['bleu_profond'], 14.0, FOND)
    print('\nENCRE : le bleu profond du logo descendu a 14:1 -> %s  (%5.2f:1)'
          % (encre, ratio(encre, FOND)))
    for p, cible in (('gris', 5.5), ('gris2', 4.6)):
        hh, ss, vv = colorsys.rgb_to_hsv(*(np.array(rgb(encre))/255))
        for t in np.linspace(0, 1, 1001):
            c = np.array(rgb(encre))*(1-t) + np.array(rgb(FOND))*t
            if ratio(c, FOND) < cible:
                print('  %-5s : l\'encre diluee a %3.0f %% dans le fond -> %s  (%5.2f:1)'
                      % (p, t*100, hexa(c), ratio(c, FOND)))
                break
