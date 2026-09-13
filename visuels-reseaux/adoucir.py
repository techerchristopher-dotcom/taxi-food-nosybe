# -*- coding: utf-8 -*-
"""Adoucit les transitoires durs d'un clip sans importer un seul son etranger.

Le raclement de la pelle sur la brique, tel que le modele le fabrique, sort a
3,7 fois le p99 de l'enveloppe : il claque. On ne le remplace pas par un
bruitage de banque — la lecon des sons Pixabay tient toujours, seul le son du
modele appartient a son image. On le remplace par de la TEXTURE GRANULAIRE
prelevee dans les zones calmes du clip lui-meme : meme micro, meme piece, meme
feu, mais sans l'attaque.
"""
import importlib.util, os, subprocess, sys
import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location('s', os.path.join(D, 'son_tiktok.py'))
s = importlib.util.module_from_spec(sp); sp.loader.exec_module(s)
SR = s.SR


def adoucir(clip, sortie, facteur=1.5, marge=0.06):
    a   = s.decoder(clip)
    env = s.enveloppe(a)
    p99 = float(np.percentile(env, 99))
    pos, med = s.zones_calmes(a, env)

    durs = np.nonzero(env > p99 * facteur)[0]
    if not len(durs):
        print('  aucun transitoire au-dessus de %.1f x p99' % facteur)
        return clip

    # on regroupe les tranches contigues en evenements
    grp, cour = [], [durs[0]]
    for i in durs[1:]:
        (cour.append(i) if i - cour[-1] <= 8 else (grp.append(cour), cour := [i]))
    grp.append(cour)

    pas = SR // 100
    for g in grp:
        d0 = max(0, int(g[0] * pas - marge * SR))
        d1 = min(len(a), int((g[-1] + 1) * pas + marge * SR))
        n  = d1 - d0
        # le niveau ambiant juste avant l'evenement, pour ne pas faire un trou
        ref = a[max(0, d0 - SR // 2):d0]
        cible = float(np.abs(ref).mean()) if len(ref) else float(med)
        tex = s.grains(a, n / SR, pos, densite=2.6, germe=d0)
        m = float(np.abs(tex).mean())
        if m > 0:
            tex *= cible / m
        f = np.hanning(min(n, int(0.03 * SR) * 2))
        moitie = len(f) // 2
        fondu = np.ones((n, 1))
        fondu[:moitie, 0] = f[:moitie]
        fondu[-moitie:, 0] = f[-moitie:]
        a[d0:d1] = a[d0:d1] * (1 - fondu) + tex[:n] * fondu
        print('  %.2f-%.2f s  adouci  (ambiance visee %.4f)' % (d0/SR, d1/SR, cible))

    brut = sortie + '.f32'
    a.astype(np.float32).tofile(brut)
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR),
                    '-ac', str(a.shape[1]), '-i', brut, sortie, '-y'], check=True)
    os.remove(brut)
    return sortie


if __name__ == '__main__':
    clip, sortie = sys.argv[1], sys.argv[2]
    piste = adoucir(clip, '/tmp/_piste.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, '-i', piste,
                    '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '192k', '-shortest', sortie, '-y'], check=True)
    print(sortie)
