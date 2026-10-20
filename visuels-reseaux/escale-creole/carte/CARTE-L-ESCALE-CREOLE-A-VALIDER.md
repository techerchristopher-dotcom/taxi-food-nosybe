# La carte de L'escale Créole — à valider avant impression

`CARTE-L-ESCALE-CREOLE.pdf` : 4 pages A4 (une feuille A3 pliée), même gabarit que La Plage
et le Nandipo. Rendu : `python3 carte_escale.py` (Chrome du Mac, polices Google Fonts).
Données : `donnees_escale.py`. Contrôles automatiques (débord bas, débord droite) : OK.

**Sources** : sa carte papier (photo IMG_2541, 20/10) pour le bar, les desserts, les
amuses-bouches à la pièce, les omelettes et les cafés ; la base Taxi Food pour les plats
tous les jours, les descriptions et les badges porc. Les prix concordent partout où les deux
se recoupent.

## À faire confirmer par Frédéric

| Point | Ce qui est imprimé | Pourquoi demander |
|---|---|---|
| **Horaires** | lun.–sam. 11 h 30 – 13 h 45 et 18 h – 21 h 45, fermé le dimanche | Ce sont les horaires en base. 13 h 45 et 21 h 45 sont peut-être des fins de commande, pas la fermeture. |
| **Desserts sans prix** | « Et selon le jour : mousse au chocolat, nougat glacé, gâteau au chocolat. Prix au comptoir. » | Sa carte les montre en photo, sans prix. |
| **Beignets** | « dès 20 000 », 8 à 12 pièces selon la portion | Le prix exact des deux portions ? |
| **Soupe chinoise** | « dès 25 000 » | Les déclinaisons et leurs prix ? |
| **Sambos zébu ou poulet** | 2 000 Ar la pièce, 10 000 Ar le lot de 5 | Conforme au papier et à la base : juste à vérifier. |
| **Accompagnement** | « Servis avec riz ou pâtes, grains et piment. Frites en supplément : 10 000 Ar. » | Repris de son tableau (20/10). |
| **Présentations en italique** | 3 phrases (rougail, bol renversé, émincé de poulet) | Écrites par nous, pas par lui. |
| **Rhum menthe** | « glace arak » | Recopié tel quel de sa carte. |

## Mis à jour le 2026-10-20 d'après son tableau

- Bol renversé : **poulet ou zébu** (plus de crevettes).
- Émincé de poulet au poivre vert : **38 000 Ar** (35 000 pour les autres émincés).
- Ardoise : exemples = rougail morue, cari poulet pays, filet de vivaneau sauce combava, massalé cabri, rôti de porc.

## Choix faits (validés par le porteur du projet le 20/10)

- Amuses-bouches : prix à la pièce **et** prix du lot de 5 (vendus par 5 dans l'appli).
- Les plats du jour ne sont pas listés : une **ardoise** renvoie au tableau du restaurant et à
  l'appli (« Offre du jour »), avec 4 exemples **sans prix**.
- Tout ce qui n'est pas dans l'appli (bar, omelettes, desserts, cafés) est imprimé sous
  « **Servis sur place** ». Les textes Taxi Food parlent « des plats, des bières et des
  softs », jamais de « toute la carte ».
- Fresh 33 cl : imprimée (sa carte), mais **éteinte dans l'appli**.

## Photos

Sept plats ont une photo : rougail, bol renversé, émincé de zébu, émincé de poulet,
demi-lunes, sambos, crudités (dossier `../visuels/`). Ce sont les visuels déjà utilisés pour
l'annonce du 14/10. Les autres lignes n'ont pas de photo : rien n'a été inventé.
