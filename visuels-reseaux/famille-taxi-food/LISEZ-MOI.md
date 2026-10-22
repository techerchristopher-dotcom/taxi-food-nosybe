# La famille Taxi Food — un personnage par restaurant (chantier ouvert le 2026-10-22)

Recette reprise de Frity (`../../../fritty/CLAUDE.md` §4) : vraie matière du plat sur une forme
cartoon, le corps EST le personnage, visage énorme, bras/jambes fil brun foncé, baskets blanc et
rouge. Tous portent le MÊME t-shirt blanc à col rond ; le logo du restaurant y sera posé ensuite
par un élément Higgsfield (le modèle ne dessine jamais un logo). Générés par Nano Banana Pro avec
la photo du plat du bucket `produits/` en référence.

| Restaurant | Personnage | Fichier retenu | job Higgsfield |
|---|---|---|---|
| L'escale Créole | Monsieur Bouchon (bouchon fermé) | retenus/escale-creole-monsieur-bouchon.png | ac4e6015-4ecc-45ed-8ee3-994dccbdc28b |
| La Plage | Madame Croustille (poulet façon KFC) | retenus/la-plage-madame-croustille.png | d4fee59c-46fb-41ba-bdce-1cbc25d89af1 |
| La Cabane | Monsieur Tacos | v1/1-tacos-la-cabane.png (à valider) | 69b24e82-8c80-4c4a-890f-650582b65ccc |
| Les Siciliens | Signor Pizza | v1/5-pizza-les-siciliens.png (à valider) | 8849c72b-a0a8-4a0d-b0b1-52028379ef90 |
| Chez M&K | Madame Nem | final/5-madame-nem-chez-mk.png | 6a36e79d-02e9-41ee-a6cc-077bc1e7f89a |
| Manson 2.0 (en négociation) | Monsieur Manson (serpent en pâte à pizza) | final/6-monsieur-manson-manson.png | a5e608e6-a9c4-4aff-82ec-623a765644d1 |
| Taxi Food | Maki (élément Maki-livreur) | — | 9e73f050-9a9c-4c96-8205-63386bb198d2 |

Refusés : samoussa (le triangle déborde du t-shirt), poisson grillé et poulet coco (La Plage :
le plat le plus vendu est le choix du porteur — poulet façon KFC), nem (lu comme du pain).

## Validation et logos (2026-10-22)

Tout validé par le porteur du projet : Tacos (v1/1), Pizza (v1/5), Bouchon (v3/I),
Croustille (v3/K), Nem **A** (v3/M). Personnages définitifs avec logo : `final/`.

Logos posés par `scripts/imprimer_tshirts.py` (logos préparés par `scripts/preparer_logos.py`
depuis le bucket : `logo/`, `partenaires/`, `produits/…/divers/logo.png` ; Les Siciliens :
`siciliens/src/logo-siciliens-rond.png`, aucun logo en base). ⚠️ Nano Banana, à qui l'on
demandait un logo « en grand », l'a laissé petit (v4) ou l'a rogné (v5, Siciliens) : on
n'utilise plus l'IA pour le logo. Le logo original est posé sur ~90 % de la HAUTEUR de la
face avant du t-shirt (c'est la hauteur qui limite : t-shirts plus larges que hauts),
courbé (cylindre) et ombré par le tissu. Faces avant relevées à la main sur grille.

## Manson 2.0 — 7e membre (2026-10-22)

Serpent en pâte à pizza dressé en S, yeux verts et tête du serpent du logo, langue en basilic,
garniture de la pizza Cannibal sur le dos (tête comprise). Pistes et corrections dans `manson/`.
Logo (serpent blanc sur noir) posé dans un badge noir arrondi. Élément Higgsfield
`Famille-Serpent-Manson` `5e21b1ae-7716-4ffe-bc97-3be05843bee7`. Restaurant `coming_soon` :
jamais présenté comme commandable avant son ouverture.

Éléments Higgsfield de la famille : voir `../ELEMENTS_HIGGSFIELD.md` (section « La famille »).
