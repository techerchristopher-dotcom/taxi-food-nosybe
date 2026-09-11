# -*- coding: utf-8 -*-
"""Les controles de la video finie. Aucun a l'oeil."""
import json, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

F  = sys.argv[1] if len(sys.argv) > 1 else 'remotion/out/VIDEO-oriental.mp4'
NU = sys.argv[2] if len(sys.argv) > 2 else 'remotion/out/NU-oriental.mp4'
CIBLE = (194, 205, 886, 896)      # ou la pizza doit finir, mesure sur la carte
SAFE  = dict(x0=86, x1=940, y0=200, y1=1586)

def sonde(*champs):
    r = subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-count_frames',
                        '-show_entries','stream=' + ','.join(champs),
                        '-of','default=nw=1:nk=1', F], capture_output=True, text=True)
    return r.stdout.split()

def image(n, f=None):
    subprocess.run(['ffmpeg','-v','error','-y','-i',f or F,'-vf',f'select=eq(n\\,{n})',
                    '-vsync','0','-frames:v','1','_v.png'], check=True)
    return Image.open('_v.png').convert('RGB')

def disque(im, hmax=1000):
    a = np.asarray(im).astype(float)[:hmax]
    m = (a.max(2) - a.min(2)) > 24
    m = ndimage.binary_closing(m, np.ones((41,41)))
    m = ndimage.binary_opening(m, np.ones((15,15)))
    lab, n = ndimage.label(m)
    t = ndimage.sum(m, lab, range(1, n+1))
    m = ndimage.binary_fill_holes(lab == (t.argmax()+1))
    ys, xs = np.nonzero(m)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

w, h, fr, nb = sonde('width','height','r_frame_rate','nb_read_frames')
w, h, nb = int(w), int(h), int(nb)
fps = eval(fr)
duree = nb / fps
audio = subprocess.run(['ffprobe','-v','error','-select_streams','a:0',
                        '-show_entries','stream=codec_name','-of','default=nw=1:nk=1', F],
                       capture_output=True, text=True).stdout.strip()

# 1. format
c1 = (w, h) == (1080, 1920) and abs(fps - 30) < 0.01 and abs(duree - 14) <= 0.2

# 2. la pizza est-elle arrivee ou la carte l'attend
#    Mesure sur le rendu NU : dans la video finie la bande couvre le bas du plat
#    a partir de y = 880, et la cible descend a 896. Un controle qui ne voit pas
#    ce qu'il mesure ne controle rien.
b = disque(image(nb - 1, NU))
derive = max(abs(a - c) for a, c in zip(b, CIBLE))
c2 = derive <= 12

# 3. le contenu de la carte tient dans la zone sure
#    (mesure sur les calques : c'est la meme image que dans la video)
cont = []
#    alpha > 160 : on juge le CONTENU, pas les ombres portees. Une ombre qui
#    deborde de la zone sure ne gene personne — c'est elle qui detache la
#    pastille de la bande.
import glob
for n in sorted(glob.glob('/tmp/merge/t/L[01]*-oriental.png')):
    al = np.asarray(Image.open(n))[:, :, 3]
    ys, xs = np.nonzero(al > 160)
    cont.append((xs.min(), ys.min(), xs.max(), ys.max()))
# la bande deborde volontairement jusqu'aux bords : on ne juge que ce qui se lit
lus = cont[1:]                      # tout sauf la bande, qui deborde volontairement
gx0 = min(c[0] for c in lus); gx1 = max(c[2] for c in lus)
gy0 = min(c[1] for c in lus); gy1 = max(c[3] for c in lus)
c3 = gx0 >= SAFE['x0'] and gx1 <= SAFE['x1'] and gy1 <= SAFE['y1']

# 4. le raccord entre le clip et le fond, sur les cotes
#    On lit le saut de luminance a l'endroit exact ou le clip s'arrete.
im = image(nb - 1); a = np.asarray(im).astype(float).mean(2)
def saut(x):
    bande = a[100:820, x-14:x+14]
    return float(np.abs(np.diff(bande.mean(0))).max())
c4 = max(saut(133), saut(948)) <= 6.0

# 5. le son
c5 = audio == 'aac'

# 6. le badge bat-il vraiment ? On lit la largeur du disque or image par image.
#    Une animation « ajoutee » qui ne se voit pas dans les pixels n'existe pas.
def largeur_or(a):
    z = a[900:1270, 560:980]
    m = (z[:, :, 0] > 190) & (z[:, :, 1] > 150) & (z[:, :, 2] < 130)
    xs = np.nonzero(m.any(0))[0]
    return int(xs.max() - xs.min()) if len(xs) else 0

larg = []
for n in range(int(11.4 * fps), min(nb, int(13.9 * fps)), 2):
    larg.append(largeur_or(np.asarray(image(n)).astype(float)))
repos = min(larg)
pics = [w for w in larg if w >= repos * 1.035]
c6 = repos > 0 and max(larg) >= repos * 1.045 and len(pics) >= 2

# 7. rien ne bouge pendant qu'on lit. On compare la colonne de texte a
#    elle-meme, de la derniere arrivee jusqu'a la fin. x < 560 : l'ombre du
#    badge commence a 589 et son battement polluerait la mesure. Centile 99,9
#    et pas maximum : le bruit de compression h264 n'est pas un mouvement.
FIGE = int(11.6 * fps)
ref = np.asarray(image(FIGE)).astype(float)[1000:1580, 80:560]
bouge = 0.0
for n in range(FIGE + 6, nb, 12):
    d = np.asarray(image(n)).astype(float)[1000:1580, 80:560]
    bouge = max(bouge, float(np.percentile(np.abs(d - ref), 99.9)))
c7 = bouge <= 4.0

ok = all((c1, c2, c3, c4, c5, c6, c7))
print(f"{F}")
print(f"  1. format            {w}x{h}  {fps:.0f} i/s  {duree:.2f} s        {'OK' if c1 else 'NON'}")
print(f"  2. derive du plat    x {b[0]}..{b[2]}  y {b[1]}..{b[3]}  -> {derive} px (max 12)   {'OK' if c2 else 'NON'}")
print(f"  3. zone sure         x {gx0}..{gx1}  y {gy0}..{gy1}  / {SAFE['x0']}..{SAFE['x1']}, bas {SAFE['y1']}   {'OK' if c3 else 'NON'}")
print(f"  4. raccord des bords saut max {max(saut(133), saut(948)):.2f} (max 6)             {'OK' if c4 else 'NON'}")
print(f"  5. son               {audio or 'aucun'}                              {'OK' if c5 else 'NON'}")
print(f"  6. battement badge   repos {repos} px, pic {max(larg)} px (+{100*(max(larg)/repos-1):.1f} %), {len(pics)} pulsations   {'OK' if c6 else 'NON'}")
print(f"  7. texte immobile    a partir de 11,6 s : {bouge:.1f} / 255 (max 4)        {'OK' if c7 else 'NON'}")
print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")

