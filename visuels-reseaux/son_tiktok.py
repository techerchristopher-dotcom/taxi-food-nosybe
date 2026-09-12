# -*- coding: utf-8 -*-
"""La bande-son de la video. Trois problemes que le clip ne resout pas seul.

1. LE SON S'ARRETE. Le clip dure 10 s, la video 14. Pire, le modele ne
   sonorise pas toujours tout le clip : sur la 4 Fromages il s'est tu apres
   4 secondes. Six secondes de silence au milieu d'un ASMR, c'est la video qui
   tombe. On pose donc un LIT sonore continu sous les quatorze secondes.

2. LE LIT NE SE PREND PAS A LA FIN. La premiere version bouclait les 2,5
   dernieres secondes du clip — sur la 4 Fromages, du silence. On CHERCHE le
   meilleur extrait : la fenetre dont le niveau bas (centile 20) est le plus
   eleve, donc un gresillement soutenu et non un accident isole.

3. LE SON EST INAUDIBLE. Le modele sort a -37 dB de moyenne. loudnorm remonte
   a -14 LUFS, la cible des reseaux. Vingt decibels : ce n'est pas une
   finition, c'est la difference entre un ASMR et un silence.
"""
import os, subprocess, sys, tempfile
import numpy as np

SR = 48000


def decoder(f, sr=SR, canaux=2):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le',
                        '-ac', str(canaux), '-ar', str(sr), '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, canaux).astype(float)


def meilleure_fenetre(a, duree=2.5, sr=SR):
    """La fenetre la plus SOUTENUE, pas la plus forte. On maximise le centile 20
    de l'amplitude : un coup isole a un maximum enorme et un centile 20 nul."""
    n = int(duree * sr)
    if len(a) <= n:
        return 0
    mono = np.abs(a).mean(1)
    pas = sr // 4
    scores = [(np.percentile(mono[i:i+n], 20), i) for i in range(0, len(a) - n, pas)]
    return max(scores)[1]


def lit(a, debut, duree, total, sr=SR, fondu=0.4):
    """L'extrait, boucle en fondu croise jusqu'a couvrir `total` secondes."""
    n, nf = int(duree * sr), int(fondu * sr)
    bloc = a[debut:debut + n].copy()
    rampe = np.linspace(0, 1, nf)[:, None]
    bloc[:nf] *= rampe
    bloc[-nf:] *= rampe[::-1]
    sortie = np.zeros((int(total * sr) + n, a.shape[1]))
    pos, saut = 0, n - nf
    while pos < int(total * sr):
        sortie[pos:pos + n] += bloc
        pos += saut
    sortie = sortie[:int(total * sr)]
    # DEUX copies decalees d'une demi-periode. Un gresillement continu se boucle
    # bien ; un son fait d'evenements separes (la 4 Fromages : quatre secondes
    # de bulles puis rien) donne evenement-silence-evenement, et la boucle
    # s'entend. Les trous de l'une sont combles par l'autre.
    return 0.6 * (sortie + np.roll(sortie, saut // 2, axis=0))


def construire(clip, sortie, total=14.0, gain_lit=0.5):
    a = decoder(clip)
    d = meilleure_fenetre(a)
    print(f"  extrait du lit : {d/SR:.2f} s -> {d/SR + 2.5:.2f} s")
    n = int(total * SR)
    mix = np.zeros((n, a.shape[1]))
    mix[:min(n, len(a))] += a[:n]                 # le clip, avec ses evenements
    mix += lit(a, d, 2.5, total) * gain_lit       # le lit, continu dessous
    # fondu de sortie sur 1,5 s : la video s'arrete, le son ne doit pas etre coupe
    nf = int(1.5 * SR)
    mix[-nf:] *= np.linspace(1, 0, nf)[:, None]
    c = np.abs(mix).max()
    if c > 0.99:
        mix *= 0.99 / c
    with tempfile.TemporaryDirectory() as t:
        brut = os.path.join(t, 'brut.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR),
                        '-ac', str(a.shape[1]), '-i', '-', brut],
                       input=mix.astype(np.float32).tobytes(), check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', brut,
                        # loudnorm en une passe est approximatif : la 4 Fromages
                        # ressortait a +0,1 dBTP, donc ecretee. Le limiteur ferme
                        # la porte a -1 dBFS, quoi que l'encodeur fasse.
                        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.89:level=disabled',
                        '-acodec', 'aac', '-b:a', '160k', sortie], check=True)
    v = decoder(sortie, 8000, 1)[:, 0]
    print('  niveau par seconde :', ' '.join(
        f'{np.abs(v[i*8000:(i+1)*8000]).mean():.3f}' for i in range(int(total))))
    return sortie


if __name__ == '__main__':
    construire(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 14.0)
