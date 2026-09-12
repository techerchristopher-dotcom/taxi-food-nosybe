# Le montage — Remotion

La carte n'est **pas** redessinee ici. Elle vient de `gabarit.py`, decoupee en
douze PNG transparents par `calques_tiktok.py`. Ce projet ne fait que les faire
entrer par-dessus le clip. Redessiner la carte en React, c'est se garantir qu'un
jour la video et la publication ne diront plus la meme chose.

## La chaine, pour un plat

```bash
cd visuels-reseaux
export TF_TRAVAIL=<dossier de travail>     # les .png sources y vivent

python3 rendre_tiktok.py   <slug>          # la carte + l'image de fin, mesurees
python3 calques_tiktok.py  <slug>          # les douze calques transparents
#   -> deposer IMAGE-DE-FIN-<slug>.png dans Higgsfield, generer le clip

python3 son_tiktok.py    clip.mp4 remotion/public/<slug>/son.m4a 14.0
python3 calculer_correction.py <slug> clip.mp4 IMAGE-DE-FIN-<slug>.png \
        remotion/src/plats.json

cd remotion
npx remotion render <slug>    out/VIDEO-<slug>.mp4 --codec=h264 --crf=18
npx remotion render <slug>-nu out/NU-<slug>.mp4    --codec=h264 --crf=20
python3 ../verifier_tiktok.py <slug>
```

**Rien n'est ecrit a la main.** `calculer_correction.py` mesure la derniere image
du clip contre l'image de fin et ecrit `plats.json` ; Remotion declare ses
compositions a partir de ce manifeste. Un clip regenere = un fichier remesure,
pas une constante retouchee a l'oeil.

## Pourquoi un rendu « nu »

Le rendu sans la carte n'est pas un brouillon : c'est le seul endroit ou la
derive du plat se mesure. Dans la video finie la bande rouge couvre le bas du
plat a partir de y = 880, et la cible descend a 896. Un controle qui ne peut pas
voir ce qu'il mesure ne controle rien.

## Le dossier public/

Un sous-dossier par plat : `public/<slug>/` avec `L01..L12.png`, `clip.mp4`,
`gel.png` (la derniere image du clip, qui tient le cadre apres 10 s) et
`son.m4a`. Il n'est pas versionne — ce sont des dizaines de Mo.
