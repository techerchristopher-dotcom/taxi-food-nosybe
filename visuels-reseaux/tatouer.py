"""Poser un tatouage réel (contour extrait d'une photo) sur une peau générée.

Le modèle d'image ne sait pas dessiner une silhouette de pays : il écrit du faux
texte cursif. On extrait donc le trait d'une vraie photo de tatouage, et on le
compose en lumière linéaire — l'encre suit l'éclairage de la peau et la texture
(pores, grain) traverse le trait, ce qu'un simple calque noir ne fait pas.

    extraire_contour(photo, boite) -> /tmp/tat_a.npy   (matte alpha du trait)
    poser(source, sortie, cx, cy, haut, angle)         (composition)
"""
import cv2, numpy as np


def lin(x):
    x = x.astype(np.float32) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055) * 255.0


def extraire_contour(photo, boite, seuil_bas=14.0, seuil_haut=40.0, sortie='/tmp/tat_a.npy'):
    """boite = (y0, y1, x0, x1) autour du tatouage dans la photo de référence.

    Le fond peau est estimé par médiane large ; l'encre est ce qui est nettement
    plus sombre que ce fond. On ne garde que la composante connexe principale,
    ce qui élimine cheveux, grains de beauté et bord de l'oreille.
    """
    y0, y1, x0, x1 = boite
    roi = cv2.imread(photo)[y0:y1, x0:x1]
    gris = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    fond = cv2.medianBlur(gris, 31).astype(np.float32)
    alpha = np.clip((fond - gris.astype(np.float32) - seuil_bas) / (seuil_haut - seuil_bas), 0, 1)

    m = cv2.morphologyEx((alpha > 0.35).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    i = max(range(1, n), key=lambda k: stats[k, cv2.CC_STAT_AREA])
    garde = cv2.dilate((lab == i).astype(np.uint8), np.ones((3, 3), np.uint8), 1)
    a = alpha * garde

    x, y = stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP]
    w, h = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
    a = a[max(0, y - 2):y + h + 2, max(0, x - 2):x + w + 2]
    np.save(sortie, a)
    return a


def poser(src, sortie, cx, cy, haut, angle, matte='/tmp/tat_a.npy',
          courbe=0.10, doux=1.8, k=0.085, neutre=0.72, force=1.0):
    """Compose le trait, centré sur (cx, cy), haut de `haut` px, incliné de `angle`.

    courbe : compression horizontale progressive — le membre s'enroule.
    doux   : l'encre diffuse sous l'épiderme, elle n'a pas de bord net.
    k      : ce qui reste de lumière à travers l'encre (0.085 = tatouage noir cicatrisé).
    neutre : part de l'encre calculée sur la luminance seule ; le reste garde la
             teinte de la peau, sinon le trait sort comme un trou gris mort.
    """
    im = cv2.imread(src)
    a0 = np.load(matte)
    h0, w0 = a0.shape
    w = int(round(haut * w0 / h0))
    a = np.clip(cv2.resize(a0, (w, haut), interpolation=cv2.INTER_CUBIC), 0, 1)

    if courbe > 0:
        yy, xx = np.mgrid[0:haut, 0:w].astype(np.float32)
        u = (xx / (w - 1)) * 2 - 1
        xs = (u + courbe * u * np.abs(u)) * 0.5 + 0.5
        a = cv2.remap(a, xs * (w - 1), yy, cv2.INTER_CUBIC,
                      borderMode=cv2.BORDER_CONSTANT, borderValue=0)

    d = int(np.hypot(w, haut)) + 8
    toile = np.zeros((d, d), np.float32)
    oy, ox = (d - haut) // 2, (d - w) // 2
    toile[oy:oy + haut, ox:ox + w] = a
    M = cv2.getRotationMatrix2D((d / 2, d / 2), angle, 1.0)
    a = cv2.warpAffine(toile, M, (d, d), flags=cv2.INTER_CUBIC, borderValue=0)
    a = np.clip(cv2.GaussianBlur(a, (0, 0), doux) * force, 0, 1)

    x0, y0 = cx - d // 2, cy - d // 2
    L = lin(im[y0:y0 + d, x0:x0 + d])
    Y = (0.0722 * L[:, :, 0] + 0.7152 * L[:, :, 1] + 0.2126 * L[:, :, 2])[..., None]
    encre = k * (neutre * Y + (1.0 - neutre) * L)
    A = a[..., None]
    im[y0:y0 + d, x0:x0 + d] = np.round(srgb(L * (1.0 - A) + encre * A)).astype(np.uint8)
    cv2.imwrite(sortie, im)

    coeur = a > 0.95
    z0 = cv2.imread(src)[y0:y0 + d, x0:x0 + d]
    z1 = im[y0:y0 + d, x0:x0 + d]
    print('boite (%d, %d, %d) | coeur %d px' % (x0, y0, d, int(coeur.sum())))
    print('peau', z0[coeur].mean(0).round(1), '-> encre', z1[coeur].mean(0).round(1))
    return (x0, y0, d), a


def fermer_contour(a, ponts, largeur=6.0, echelle=8):
    """Reconstruit les segments que la photo de référence n'a pas.

    Un tatouage photographié est toujours partiellement occulté — ici la côte
    nord-est disparaissait dans l'ombre de l'oreille. Le contour extrait était
    donc ouvert, et un contour ouvert se voit. `ponts` est une liste de
    (depart, controle, arrivee) en coordonnées de la matte ; chaque pont est une
    Bézier quadratique tracée à la largeur du trait d'origine.

    La fermeture se vérifie : `verifier_ferme()` doit trouver un intérieur.
    """
    h, w = a.shape
    big = cv2.resize(a.astype(np.float32), (w*echelle, h*echelle), interpolation=cv2.INTER_CUBIC)
    pont = np.zeros_like(big)
    for p0, p1, p2 in ponts:
        t = np.linspace(0, 1, 400)[:, None]
        c = ((1-t)**2)*np.array(p0) + 2*(1-t)*t*np.array(p1) + (t**2)*np.array(p2)
        cv2.polylines(pont, [(c*echelle).astype(np.int32).reshape(-1,1,2)], False, 1.0,
                      thickness=int(largeur*echelle*0.92), lineType=cv2.LINE_AA)
    big = np.maximum(big, pont)
    return np.clip(cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA), 0, 1)


def egaliser(a, cible=0.95, plancher=0.30, gain_max=2.2):
    """Remonte les segments pâles au niveau du reste du trait, jamais l'inverse.

    Les zones de la photo de référence qui étaient dans l'ombre ressortent
    claires ; sur la peau elles liraient comme des trous dans le trait.
    """
    pic = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    gain = cv2.GaussianBlur(np.clip(cible/np.maximum(pic, plancher), 1.0, gain_max), (0, 0), 2.0)
    return np.clip(a*gain, 0, 1)


def verifier_ferme(a, seuil=0.35):
    """Un contour fermé délimite un intérieur. Sinon le remplissage fuit."""
    m = (a > seuil).astype(np.uint8)
    h, w = m.shape
    pad = np.zeros((h+2, w+2), np.uint8); pad[1:-1, 1:-1] = m
    cv2.floodFill(pad, np.zeros((h+4, w+4), np.uint8), (0, 0), 1)
    n = int((pad[1:-1, 1:-1] == 0).sum())
    comp = cv2.connectedComponentsWithStats(m, 8)[0] - 1
    print('contour : %d composante(s), intérieur %d px' % (comp, n))
    assert n > 0, 'contour OUVERT — il manque un pont'
    return n


if __name__ == '__main__':
    # La Cabane — plan éditorial Burger Tenders, tatouage Madagascar sur le dos de la main.
    # Dans la photo de référence, la côte nord-est du tatouage se perd dans l'ombre de
    # l'oreille : deux ponts la reconstruisent (13 % du contour), géométrie quasi
    # rectiligne légèrement convexe vers l'est, conforme au tracé réel de l'île.
    a = extraire_contour('/tmp/ref_tatoo.png', (95, 315, 215, 360))
    a = fermer_contour(a, [((114, 3), (120.5, 19), (119, 38)),
                           ((116, 49), (115.6, 52), (114, 55))])
    a = egaliser(a)
    verifier_ferme(a)
    np.save('/tmp/tat_a.npy', a)
    poser('/tmp/mgB-net3.png', '/tmp/mgB-tat.png', cx=2640, cy=3260, haut=540, angle=18.0)
