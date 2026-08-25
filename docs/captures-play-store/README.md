# Visuels Play Store

Huit fichiers à téléverser dans le Play Console. Contraintes vérifiées sur la
[page officielle de Google](https://support.google.com/googleplay/android-developer/answer/9866151).

| Fichier | Où le déposer |
|---|---|
| `00-icone-512x512.png` | Fiche du store › **Icône de l'application** |
| `00-image-presentation-1024x500.png` | Fiche du store › **Image de présentation** |
| `01` à `06` | Fiche du store › **Captures d'écran de téléphone** |

## Comment les captures ont été produites

Elles dérivent de `../captures-app-store/` (les six captures iPhone validées par Apple),
avec **deux retouches imposées par Google** :

1. **175 px retirés en haut** — la barre d'état iOS et l'îlot dynamique. Une capture
   d'iPhone sur une fiche Play se remarque, et l'îlot est le détail qui trahit.
2. **60 px ajoutés de chaque côté** — pour passer sous la contrainte de ratio.

### Pourquoi le ratio imposait de les retoucher

Google exige que « la dimension la plus longue soit **inférieure au double** de la plus
courte ». Les captures iPhone font 1 320 × 2 868, soit **2,17 : 1** : elles auraient été
**refusées**. Les nôtres font 1 440 × 2 693, soit **1,87 : 1**.

### Pourquoi les bandes ne sont pas d'une couleur unie

C'est la **colonne de bord étirée**, pas un aplat. Le haut des captures est un dégradé
rouge, le bas est blanc : une bande unie jurerait forcément à l'une des deux extrémités.
Étirée, elle se raccorde à toutes les hauteurs — le raccord est invisible.

## Pour les régénérer

```python
from PIL import Image
import glob, os
COUPE, MARGE = 175, 60
for src in sorted(glob.glob('docs/captures-app-store/*.png')):
    im = Image.open(src).convert('RGB')          # 24 bits, sans alpha
    l, h = im.size
    im = im.crop((0, COUPE, l, h)); l, h = im.size
    t = Image.new('RGB', (l + 2*MARGE, h))
    t.paste(im.crop((0,0,1,h)).resize((MARGE,h), Image.NEAREST), (0,0))
    t.paste(im, (MARGE, 0))
    t.paste(im.crop((l-1,0,l,h)).resize((MARGE,h), Image.NEAREST), (l+MARGE, 0))
    t.save('docs/captures-play-store/' + os.path.basename(src), 'PNG', optimize=True)
```

## ⚠️ Elles montrent l'ancien registre

Prises le 2026-08-19, **avant** le passage au tutoiement du 2026-08-24. On y lit encore
« En route vers **vous** ». Rien de bloquant pour la validation, mais **à refaire après le
prochain build**.

## L'image de présentation

Créée le 2026-08-24, sans équivalent chez Apple. Rendue depuis un gabarit HTML avec la
police de la marque (Archivo), le dégradé de l'app et quatre plats réels du catalogue.
Rendu exact en 1 024 × 500 par Chrome sans interface — PIL n'a pas le support des polices
sur cette machine. Le gabarit a été supprimé après rendu : il vivait dans `landing/` le
temps de l'opération et n'avait rien à faire sur le site.
