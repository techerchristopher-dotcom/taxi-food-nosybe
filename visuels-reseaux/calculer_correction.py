# -*- coding: utf-8 -*-
"""Mesure tout ce qui change d'un plat a l'autre, et ecrit le manifeste Remotion.

Trois mesures, aucune a l'oeil :

  1. LA CORRECTION DE CADRAGE. Le modele vise la composition de l'image de fin
     mais ne l'atteint pas au pixel : sur l'Oriental il finissait 32 % trop
     gros. On compare la boite du plat sur la derniere image du clip a celle de
     l'image de fin, et on en deduit l'echelle et la translation. L'echelle est
     NON UNIFORME : le disque rendu est elliptique (8 % plus haut que large sur
     l'Oriental), et une echelle uniforme laisse 15 px, au-dessus de la
     tolerance. Corriger l'ellipse rend la pizza plus ronde, pas moins.

  2. LA COURSE DE LA CAMERA. La correction ne doit pas s'ajouter au mouvement
     du modele, elle doit le prolonger. On suit la boite du plat image par
     image et on note quand elle commence a se stabiliser et quand elle se fige.

  3. LA GEOMETRIE DES CALQUES. Centre du badge, centre de la pastille du code,
     emprise de l'url, ancre du prix : lus sur l'alpha, pas recopies.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

W, H, FPS = 1080, 1920, 30


def boite(a, hmax=H):
    """La boite du plat. Le fond est gris neutre, la pizza est chaude : la
    chroma suffit, a condition de refermer les taches de brulure avant de
    mesurer. Un seuil sur la luminance decoupe la pizza en morceaux."""
    a = a[:hmax]
    m = (a.max(2) - a.min(2)) > 24
    m = ndimage.binary_closing(m, np.ones((41, 41)))
    m = ndimage.binary_opening(m, np.ones((15, 15)))
    lab, n = ndimage.label(m)
    if not n:
        return None
    t = ndimage.sum(m, lab, range(1, n + 1))
    m = ndimage.binary_fill_holes(lab == (t.argmax() + 1))
    ys, xs = np.nonzero(m)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def image(clip, n, tmp='_c.png'):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', clip, '-vf',
                    f'select=eq(n\\,{n})', '-vsync', '0', '-frames:v', '1', tmp], check=True)
    return np.asarray(Image.open(tmp).convert('RGB').resize((W, H), Image.LANCZOS)).astype(float)


def calques(dossier, slug):
    """Centres et emprises, lus sur l'alpha. alpha > 160 : le contenu, pas les
    ombres portees — une ombre qui deborde ne gene personne, c'est elle qui
    detache la pastille de la bande."""
    g = {}
    import glob as _g
    for n in ('L05', 'L07', 'L09', 'L12'):
        f, = _g.glob(os.path.join(dossier, f'{n}-*-{slug}.png'))
        al = np.asarray(Image.open(f))[:, :, 3]
        ys, xs = np.nonzero(al > 160)
        g[n] = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    c = lambda b: {'cx': (b[0] + b[2]) / 2, 'cy': (b[1] + b[3]) / 2}
    return dict(badge=c(g['L07']), code=c(g['L09']),
                url={'x0': g['L12'][0], 'x1': g['L12'][2], 'bas': g['L12'][3] + 9},
                prix={'x': g['L05'][0], 'y': g['L05'][3] - 15})


def mesurer(slug, clip, fin, dossier='.'):
    n_img = int(subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
         '-show_entries', 'stream=nb_read_frames', '-of', 'default=nw=1:nk=1', clip],
        capture_output=True, text=True).stdout.strip())
    duree = float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=nw=1:nk=1', clip], capture_output=True, text=True).stdout.strip())
    fps_clip = n_img / duree

    c = boite(image(clip, n_img - 1))
    d = boite(np.asarray(Image.open(fin).convert('RGB')).astype(float))
    kx = (d[2] - d[0]) / (c[2] - c[0])
    ky = (d[3] - d[1]) / (c[3] - c[1])
    CX, CY = W / 2, H / 2
    dx = d[0] - (CX + (c[0] - CX) * kx)
    dy = d[1] - (CY + (c[1] - CY) * ky)
    n = [CX + (c[0]-CX)*kx + dx, CY + (c[1]-CY)*ky + dy,
         CX + (c[2]-CX)*kx + dx, CY + (c[3]-CY)*ky + dy]
    derive = max(abs(a - b) for a, b in zip(n, d))

    # La course de la camera : a partir de quand la boite ne bouge plus ?
    # On ne cherche que la FIN. Le debut ne se mesure pas : tant que le plat
    # deborde du cadre sa largeur est bornee par le cadre et ne dit rien du
    # mouvement. La correction demarre donc a une avance fixe de 2,4 s, la
    # valeur qui a donne une course monotone sur l'Oriental (0 -> -9,7 px/image
    # -> 0, sans a-coup).
    prof = {}
    for i in range(int(n_img * 0.55), n_img, max(1, n_img // 40)):
        b = boite(image(clip, i))
        if b:
            prof[i] = b[2] - b[0]
    cles = sorted(prof)
    fige = cles[-1]
    for i in reversed(cles):
        if abs(prof[i] - prof[cles[-1]]) > 6:
            break
        fige = i
    AVANCE = 2.4

    plat = dict(slug=slug, kx=round(kx, 5), ky=round(ky, 5),
                dx=round(dx, 1), dy=round(dy, 1),
                corDebut=round(max(0.0, fige / fps_clip - AVANCE), 2),
                corFin=round(fige / fps_clip, 2),
                clipSecondes=round(duree, 4), **calques(dossier, slug))
    print(f"{slug}")
    print(f"  clip derniere image  x {c[0]}..{c[2]}  y {c[1]}..{c[3]}   {c[2]-c[0]}x{c[3]-c[1]}"
          f"  rapport {(c[2]-c[0])/(c[3]-c[1]):.3f}")
    print(f"  cible (image de fin) x {d[0]}..{d[2]}  y {d[1]}..{d[3]}   {d[2]-d[0]}x{d[3]-d[1]}")
    print(f"  correction  kx {kx:.5f}  ky {ky:.5f}  dx {dx:+.1f}  dy {dy:+.1f}"
          f"   -> derive residuelle {derive:.2f} px")
    print(f"  camera du modele figee a {fige/fps_clip:.2f} s ; correction de "
          f"{max(0.0, fige/fps_clip - AVANCE):.2f} a {fige/fps_clip:.2f} s")
    return plat


if __name__ == '__main__':
    slug, clip, fin = sys.argv[1], sys.argv[2], sys.argv[3]
    manifeste = sys.argv[4] if len(sys.argv) > 4 else 'plats.json'
    plats = json.load(open(manifeste)) if os.path.exists(manifeste) else []
    plats = [p for p in plats if p['slug'] != slug] + [mesurer(slug, clip, fin)]
    json.dump(sorted(plats, key=lambda p: p['slug']), open(manifeste, 'w'), indent=2)
    print(f"  -> {manifeste}")
