# Le montage — Remotion

La carte n'est **pas** redessinee ici. Elle vient de `gabarit.py`, decoupee en
quatre PNG transparents par `calques_tiktok.py`. Ce projet ne fait que les faire
entrer par-dessus le clip. Redessiner la carte en React, c'est se garantir qu'un
jour la video et la publication ne diront plus la meme chose.

## La chaine

```
gabarit.py  ──►  rendre_tiktok.py     la carte fixe, mesuree
            └─►  calques_tiktok.py    L1 bande · L2 texte · L3 pastille · L4 badge
                        │
   clip Seedance ───────┴──►  remotion  ──►  verifier_tiktok.py
```

## Preparer un plat

```bash
cd visuels-reseaux
TF_TRAVAIL=<dossier de travail> python3 calques_tiktok.py      # les 4 calques
cp L1-bande-<slug>.png    remotion/public/L1.png
cp L2-texte-<slug>.png    remotion/public/L2.png
cp L3-pastille-<slug>.png remotion/public/L3.png
cp L4-badge-<slug>.png    remotion/public/L4.png
cp <clip>.mp4             remotion/public/clip.mp4
ffmpeg -i remotion/public/clip.mp4 -vf "select=eq(n\,<derniere>)" -vsync 0 -frames:v 1 remotion/public/gel.png
```

## Les quatre nombres a remesurer a chaque clip

`KX KY DX DY` en tete de `Pizza.tsx` corrigent le cadrage d'arrivee du modele.
Ils sont **mesures**, jamais retouches a l'oeil : boite du plat sur la derniere
image du clip, boite du plat sur l'image de fin, meme detecteur pour les deux.
Voir le bloc de commentaire dans `Pizza.tsx`.

## Rendre

```bash
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
npx remotion render pizza-oriental    out/VIDEO-<slug>.mp4 --codec=h264 --crf=18
npx remotion render pizza-oriental-nu out/NU-<slug>.mp4    --codec=h264 --crf=20
python3 ../verifier_tiktok.py out/VIDEO-<slug>.mp4 out/NU-<slug>.mp4
```

Le rendu **nu** (sans la carte) n'est pas un brouillon : c'est le seul endroit ou
la derive du plat se mesure. Dans la video finie la bande rouge couvre le bas du
plat a partir de y = 880, et la cible descend a 896.
