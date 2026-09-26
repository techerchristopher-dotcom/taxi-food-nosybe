# L'annonce Facebook de Chez M&K

Calqué sur ton post La Plage du 18/09 — même découpe : une ligne par idée, une ligne vide
entre chaque, le lien complet seul sur sa ligne, les hashtags en dernier, zéro emoji.

**Visuel à joindre** : `PUB-mk-annonce.png` — 1080 × 1350. Ne pas le recadrer en carré,
on y perdrait la bande rouge et donc le code promo.

---

## 1. Page Taxi Food Nosy Be — à copier tel quel

```
Nouveau : Chez M&K livre chez toi.

Bols renversés, ti pan à la plancha, nems, van tan, ribs laqués etc..

À Djabala Honko, de 9 h à 22 h, 7 jours sur 7,

Code TAXIFOOD50 : la livraison à moitié prix sur ta première commande.
Télécharge Taxi Food :

https://taxifoodnosybe.distripro207.com/

#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar #DjabalaHonko #ChezMK #RestaurantChinois
```

Le lien porte les trois gestes d'un coup : bouton *Commander maintenant* (la commande dans
le navigateur, rien à installer), bouton App Store, bouton Google Play.

Sept hashtags, dont tes quatre fixes. Les trois autres remplacent `#HellVille #Grillades
#LaPlage` par leurs équivalents chez lui.

---

## 2. Page Chez M&K — à publier par lui

Sa page, sa voix : il dit « nous », et Taxi Food est le moyen, pas le sujet.

```
Ça y est : on livre. 💛

On s'est associés à Taxi Food. Nos bols renversés, nos ti pan à la plancha, le tsa siou, les nems, les ribs laqués — tout ce que vous venez chercher chez nous à Djabala Honko, vous pouvez maintenant l'avoir là où vous êtes.

Pas besoin d'installer quoi que ce soit, ça se commande depuis le site.

Première commande : le code TAXIFOOD50 met la livraison à moitié prix.

https://taxifoodnosybe.distripro207.com/

On est là de 9 h à 22 h, tous les jours. À tout de suite.
```

---

## 3. Story, WhatsApp, statut

```
Chez M&K livre, maintenant. 💛

Le chinois de Djabala Honko est sur Taxi Food. Bols renversés, ti pan, nems, ribs laqués.
Dès 15 000 Ar, 7 jours sur 7.

Code TAXIFOOD50 : livraison à moitié prix sur ta première commande.

https://taxifoodnosybe.distripro207.com/
```

---

## Ce qui a été vérifié avant d'écrire

| Affirmation | Vérifiée où |
|---|---|
| `TAXIFOOD50` = −50 % sur la livraison | `promo_codes` : `actif`, pourcentage 50, `porte_sur = livraison`, sans expiration ni plafond, tous restaurants |
| Livraison 10 000 Ar → 5 000 avec le code | `delivery_fee = 10000` |
| 9 h – 22 h, 7 jours sur 7 | `restaurant_hours`, 7 lignes service 1 |
| Dès 15 000 Ar | min des 28 plats, hors fondue |
| Les plats nommés sont commandables | `is_available = true` sur les 27 ; seule la fondue est à `false`, elle est « sur commande » et n'est pas nommée |
| Djabala Honko | `zone_served` |
| La commande arrive jusqu'à lui | `telegram_chat_id` présent |
| Le lien mène au téléchargement **et** à la commande | page d'accueil relue le 22/09/2026 |

---

## Trois choses à régler AVANT de publier

Un post Facebook est public. Les deux premiers points enverraient des gens sur une commande
qui ne se fait pas.

### 1. `listing_status` est toujours `coming_soon` — bloquant

L'appli **refuse la commande** chez M&K aujourd'hui. Le post dit « livre chez toi ».
Une commande SQL et c'est réglé.

### 2. Le site vitrine ne connaît pas M&K — bloquant

Relu ce matin : la page d'accueil ne nomme que **La Cabane**, plus Angelo en « on est encore
en train de le convaincre ». Ni M&K, ni La Plage, ni Chez Bidul & Truc. Le texte est
**statique**, il n'est pas alimenté par la base.

C'était déjà signalé au lancement de La Plage il y a quatre jours et ça n'a pas bougé — donc
le post La Plage renvoie lui aussi, en ce moment, vers une page qui ne parle pas de La Plage.

### 3. `auto_open = false` — à surveiller

Chez La Plage il est à `true` : le restaurant s'ouvre et se ferme seul sur ses horaires.
Chez M&K il est à `false`, donc `is_open` garde sa dernière valeur — actuellement `true`,
donc **ouvert en permanence, y compris à 3 h du matin**. Maintenant que ses horaires sont en
base, autant le passer à `true`.

### Et deux détails

- **4 produits en ligne sans photo** : Bol renversé fruits de mer (40 000), Coca petit
  modèle, Sprite petit modèle, bière en canette.
- **`logo_url` est vide** : l'appli n'affiche aucun logo pour lui. Le nouveau est prêt à
  déposer dans le bucket.
