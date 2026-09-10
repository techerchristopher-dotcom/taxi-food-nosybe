# Visuels réseaux sociaux — la chaîne complète

Tout ce qui sort en visuel de lancement (carré 1080, story 1080×1920, mode d'emploi) sort
**d'ici**. Un seul gabarit, des textes qu'on remplace. Rien ne se dessine à la main.

Ce dossier a failli disparaître : la chaîne a d'abord vécu dans le conteneur d'une session
Claude, qui est effacé à la fin. Elle est versionnée depuis le 2026-09-10.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `gabarit.py` | **la source de vérité.** `visuel()` pour un plat, `mode_emploi()` pour le mode d'emploi. Toutes les constantes de mise en page y vivent. |
| `detourage.py` | détoure une photo de plat sur son fond studio → `det-<slug>.png` + `.json` (la boîte englobante) |
| `plats.py` | le registre : une entrée = un visuel. Titre, ingrédients, prix, lieu. |
| `rendre.py` | rend les PNG **et se vérifie tout seul** (voir plus bas) |
| `mesure.py` | transforme un `.dc.html` en page autonome (images en data-URI) et mesure au navigateur |
| `assets/` | logo Taxi Food, badges App Store / Google Play, QR, logo Bidul & Truc |
| `CHARTE_LANCEMENT_RESTAURANT.md` | **à lire avant de toucher au gabarit.** Les règles, et les erreurs déjà faites. |

## Faire un visuel de plat

```bash
# 1. détourer la photo source (fond studio + ardoise noire)
python3 detourage.py src-pizza-oriental.png det-oriental.png

# 2. ajouter six lignes dans plats.py

# 3. rendre — le dossier de travail porte les photos, pas le dépôt
TF_TRAVAIL=~/"Desktop/1-DEV CLAUDE /taxi-food-nosybe/partenaire /bidul et truc /pub /pizza" \
  python3 rendre.py oriental
```

Sortie attendue :

```
oriental.png     ecart   0  secondaire 1 ligne  air  25.0/ 25.4  ->  CONFORME
```

`TF_TRAVAIL` par défaut = ce dossier. Les photos sources et les rendus pèsent des dizaines de
Mo : ils vivent dans `partenaire /`, qui est hors dépôt. **Seule la chaîne est versionnée.**

## Les trois contrôles automatiques

`rendre.py` refuse de dire CONFORME tant que les trois ne passent pas. Ils viennent chacun
d'une erreur réellement commise :

1. **écart = 0** — le bas du badge Google Play doit tomber exactement sur le bas du bloc promo.
   Estimé à 38 px pendant un temps ; mesuré, c'était 40. D'où `COL_H = 401`.
2. **secondaire sur UNE ligne** — la ligne d'ingrédients qui passe à deux lignes décale tout le
   bas du visuel. C'est ce qui a cassé le format story quand tout était multiplié par 1,34.
3. **≥ 20 px d'air** entre la croûte et la pastille du logo, et entre la croûte et le QR.

## Ce qu'il ne faut pas refaire

Détaillé dans la charte, en résumé ici :

- **Le placement du plat est celui de la série** (`DEBORD_W/CX/BAS` = 760/572/685), identique
  pour les huit pizzas. Un décalage au cas par cas a été essayé : deux pizzas sur huit
  seulement passaient les deux contraintes, et surtout on obtenait *une collection, pas une
  série* — huit tailles différentes.
- **Le détourage se fait par la couleur, pas par la forme.** Le fond studio et l'ardoise sont
  parfaitement neutres (R−B = 0,0), la nourriture reste chaude même carbonisée (R−B jusqu'à
  100). Le contour convexe pontait la croûte brûlée vers l'ardoise ; la médiane polaire mordait
  dans les croûtes pâles. Seule la couleur marche.
- **Une story n'agrandit rien.** Même largeur qu'un carré : seule la photo grandit, le bandeau
  ne bouge pas.
- **L'IA ne dessine jamais un logo ni du texte.** La marque vient des éléments validés
  (`ELEMENTS_HIGGSFIELD.md`) et du carton de fin Remotion.
