# -*- coding: utf-8 -*-
"""La bande-son de la video. Ce que le clip donne, et ce qu'il ne donne pas.

CE QU'IL DONNE : dix secondes de son, en entier. La premiere version de ce
script croyait le contraire — j'avais mesure la MOYENNE d'un gresillement
clairsseme, vu un chiffre bas, et conclu au silence. On ne touche donc pas au
son du clip sur ses dix secondes. Un lit pose dessous n'y ajoute rien et
finit par s'entendre.

CE QU'IL NE DONNE PAS :

1. LES QUATRE DERNIERES SECONDES. La video dure 14 s. Il faut donc fabriquer
   4 s de texture — et une BOUCLE S'ENTEND. La premiere version bouclait 2,5 s
   en fondu croise et doublait la copie : le transitoire contenu dans la
   fenetre revenait toutes les secondes. On synthetise donc la texture par
   GRAINS : des fragments de 60 ms tires au hasard dans les zones calmes du
   clip, poses a des instants aleatoires avec recouvrement. Ca ne peut pas se
   repeter, et ca garde le grain du gresillement qu'un bruit filtre perdrait.

2. UN SON PROPRE. Sur la 4 Fromages le modele a produit un transitoire a
   3,26 s a 1,336 d'amplitude : 80 fois la mediane, AU-DESSUS du zero dB, donc
   ecrete. Ce n'est pas une bulle de fromage, c'est une saturation. On le
   remplace par de la texture : mieux vaut un gresillement continu qu'un faux
   bruit qu'on remarque.

3. DU NIVEAU. Le modele sort autour de -37 dB de moyenne, inaudible sur un
   telephone. loudnorm remonte a -14 LUFS puis un limiteur ferme a -1 dBFS :
   en une passe loudnorm est approximatif et laissait passer +0,1 dBTP.
"""
import os, subprocess, sys, tempfile
import numpy as np

SR = 48000
GRAIN = 0.060          # 60 ms : assez court pour ne rien raconter, assez long
                       # pour porter le grain du gresillement
SEUIL_EVENEMENT = 12   # x la mediane de l'enveloppe : au-dela, c'est un
                       # evenement, pas de la texture


def decoder(f, sr=SR, canaux=2):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le',
                        '-ac', str(canaux), '-ar', str(sr), '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, canaux).astype(float)


def enveloppe(a, pas=SR // 100):
    n = len(a) // pas * pas
    return np.abs(a[:n]).max(1).reshape(-1, pas).max(1)


def zones_calmes(a, env=None):
    """Les instants ou l'on peut prelever un grain : pas d'evenement dedans."""
    env = enveloppe(a) if env is None else env
    med = np.median(env)
    calme = env < SEUIL_EVENEMENT * med
    # on elargit l'exclusion autour de chaque evenement : l'attaque et la
    # queue d'un transitoire debordent de la tranche ou on l'a detecte
    bruyant = ~calme
    for d in (-3, -2, -1, 1, 2, 3):
        bruyant |= np.roll(calme == False, d)
    ok = np.nonzero(~bruyant)[0]
    n = int(GRAIN * SR)
    pas = SR // 100
    return [i * pas for i in ok if (i + 1) * pas + n < len(a)], med


def grains(a, duree, positions, sr=SR, densite=2.2, germe=0):
    """Texture granulaire. Aucune periode : les instants et les grains sont
    tires au hasard, donc rien ne revient."""
    r = np.random.default_rng(germe)
    n = int(GRAIN * sr)
    fen = np.hanning(n)[:, None]
    total = int(duree * sr)
    out = np.zeros((total + n, a.shape[1]))
    pas = int(n / densite)
    for t in range(0, total, pas):
        p = int(r.choice(positions))
        g = a[p:p + n] * fen * r.uniform(0.8, 1.2)
        j = t + r.integers(-pas // 3, pas // 3)
        j = max(0, min(total - 1, j))
        out[j:j + n] += g
    return out[:total]


def construire(clip, sortie, total=14.0, gain_lit=0.9):
    a = decoder(clip)
    env = enveloppe(a)
    pos, med = zones_calmes(a, env)
    print(f"  {len(pos)} positions de prelevement ; mediane {med:.4f}, "
          f"max {env.max():.3f} ({env.max()/med:.0f}x)")

    # --- 1. on repare les transitoires ecretes ---------------------------
    n_g = int(GRAIN * SR)
    repares = 0
    for i in np.nonzero(env > 40 * med)[0]:
        d = max(0, i * (SR // 100) - int(0.03 * SR))
        f = min(len(a), (i + 1) * (SR // 100) + int(0.08 * SR))
        if f - d < n_g:
            continue
        a[d:f] = grains(a, (f - d) / SR, pos, germe=i)[:f - d]
        repares += 1
    if repares:
        print(f"  {repares} transitoire(s) ecrete(s) remplace(s) par de la texture")

    # --- 2. le clip garde son son ; on ne fabrique que la queue ----------
    n = int(total * SR)
    mix = np.zeros((n, a.shape[1]))
    fin_clip = min(n, len(a))
    mix[:fin_clip] = a[:fin_clip]
    if fin_clip < n:
        queue = grains(a, (n - fin_clip) / SR, pos, germe=7) * gain_lit
        nf = int(0.5 * SR)                       # fondu d'entree, pas de couture
        queue[:nf] *= np.linspace(0, 1, nf)[:, None]
        mix[fin_clip:] = queue
        print(f"  queue granulaire de {(n - fin_clip)/SR:.2f} s a partir de "
              f"{fin_clip/SR:.2f} s")

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
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', brut, '-af',
                        'loudnorm=I=-15:TP=-2.0:LRA=11,alimiter=limit=0.84:level=disabled',
                        '-acodec', 'aac', '-b:a', '160k', sortie], check=True)
    return sortie


def repetition(f, mini=0.30, maxi=6.0):
    """Mesure ce que l'oreille reproche : une boucle. On autocorrele
    l'enveloppe ; un pic a un retard entre 0,3 et 6 s, c'est un motif qui
    revient. Un controle qui aurait existe hier aurait attrape le defaut."""
    a = decoder(f, 8000, 1)[:, 0]
    e = np.abs(a[:len(a) // 80 * 80].reshape(-1, 80)).max(1)   # 100 Hz
    e = e - e.mean()
    c = np.correlate(e, e, 'full')[len(e) - 1:]
    c /= c[0]
    d, fn = int(mini * 100), min(int(maxi * 100), len(c) - 1)
    i = d + int(np.argmax(c[d:fn]))
    return i / 100, float(c[i])


if __name__ == '__main__':
    s = construire(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 14.0)
    r, v = repetition(s)
    print(f"  repetition : pic d'autocorrelation {v:.3f} au retard {r:.2f} s"
          f"   (max 0.35)  ->  {'OK' if v <= 0.35 else 'BOUCLE AUDIBLE'}")
