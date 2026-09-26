# Trois chantiers — plan à valider avant implémentation

Demandés le 26/09/2026 au soir, **validés tels quels et implémentés dans la nuit** (voir la section
« Nuit du 26 au 27/09 » de `CLAUDE.md`). Ce document reste le plan d'origine. La partie technique est reléguée tout en bas, à part.

---

## Chantier 1 — Deux boutons pour le livreur : « J'arrive » et « Je suis là »

### Ce qui existe aujourd'hui
Le livreur a trois gestes, dans l'ordre : **Je la prends** → **Récupérée** (au restaurant) →
**Marquer livrée**. Le client reçoit une notification quand la commande est récupérée
(« Le livreur est en route 🛵 »), puis **plus rien jusqu'à la livraison**. C'est précisément le
trou : entre le restaurant et sa porte, le client ne sait pas quand sortir.

### Ce que ça deviendra
Après « Récupérée », la carte de la commande montre un bouton **« J'arrive »**. Le livreur appuie
quand il est à environ cinq minutes.
→ Le client reçoit : **« Ton livreur arrive dans 5 minutes 🛵 — tiens-toi prêt. »**

Le bouton devient alors **« Je suis là »**. Le livreur appuie devant la porte.
→ Le client reçoit : **« Ton livreur est devant chez toi 📍 — il t'attend. »**

Puis « Marquer livrée », comme aujourd'hui.

### Ce que ça change pour chacun
- **Livreur** : deux boutons de plus, dans l'ordre, un seul appui possible chacun (pas de
  rappel en rafale : une fois envoyé, c'est envoyé).
- **Client** : deux notifications de plus, dans la langue de son téléphone (français, anglais,
  italien — comme les notifications actuelles). Son écran de suivi affiche aussi l'état
  « Livreur à 5 min » puis « Livreur sur place », avec le bouton d'appel déjà en place.
- **Toi, dans l'historique** : l'heure de chaque appui est conservée. On saura mesurer le temps
  entre « Je suis là » et « Livrée » — c'est le temps d'attente du livreur devant la porte,
  aujourd'hui invisible.

### À valider
1. Le mot exact des deux messages (ci-dessus, ma proposition).
2. « J'arrive » n'apparaît **qu'après** « Récupérée » — pas avant. D'accord ?
3. Un appui unique par bouton, sans possibilité de le renvoyer. D'accord ?

---

## Chantier 2 — Une zone de texte pour préciser (« sans tomate »)

### Ce qui existe aujourd'hui — et c'est la bonne nouvelle
Un client a commandé un tacos ce soir et ne pouvait pas dire « sans tomate ». Or, en creusant :
**la base sait déjà stocker une précision par article, et le message Telegram au restaurant
l'envoie déjà.** Ce qui manque, c'est tout le reste : l'app ne propose jamais de la saisir, et
elle n'est affichée nulle part — ni chez le restaurant, ni chez le livreur, ni chez le client.
Le tuyau existe à deux endroits sur six.

### Ce que ça deviendra
Sur la fiche d'un plat, juste avant « Ajouter », un champ :
**« Une précision ? (sans tomate, bien cuit, sauce à part…) »** — court, facultatif, une centaine
de caractères. Modifiable ensuite depuis le panier.

Cette précision suit ensuite la commande **partout** :

| Où | Comment elle apparaît |
|---|---|
| Telegram du restaurant | déjà transmise — je vérifie que le mot ressort bien |
| Écran « Commandes » du restaurant | sous l'article, **en évidence** : ⚠️ *Sans tomate* |
| Carte du livreur | idem, pour qu'il puisse vérifier au restaurant |
| Récapitulatif et suivi du client | sous l'article, pour qu'il voie que c'est bien parti |
| Espace admin, détail de la commande | idem |

### Ce que ça ne fait pas
- Ça ne change **pas le prix** : c'est une précision, pas une option payante.
- Ça n'oblige pas le restaurant : il peut refuser la commande avec un motif, comme aujourd'hui
  (« pas possible sans tomate, la sauce est déjà préparée »).

### À valider
1. Précision **par plat** (comme demandé) — et pas de note générale « pour le livreur » ?
   Je peux ajouter les deux ; je recommande de commencer par le plat seul, c'est ce qui manquait
   ce soir.
2. Le mot du champ, ci-dessus.

---

## Chantier 3 — Restaurants « en négociation » : capter l'intérêt, prévenir à l'ouverture

### Ce qui existe aujourd'hui
Quatre restaurants sont « en négociation » (Les Siciliens, Madame Oh, Oh Hazar, La Plage… selon
l'état du jour). Leur fiche est visible, la carte se consulte, le bouton Commander est grisé avec
un bandeau « arrive bientôt ». **Rien n'est enregistré** : on ne sait ni qui l'a ouverte, ni
combien de fois. Et quand un restaurant ouvre, **personne n'est prévenu** — l'ouverture elle-même
se fait à la main, en base, il n'y a pas de bouton dans l'admin.

### Ce que ça deviendra

**1. On capte, sans rien demander.** Chaque fois qu'un client connecté ouvre la fiche d'un
restaurant en négociation, c'est enregistré : qui, quel restaurant, quand. Une visite = une
ligne. Silencieux pour le client.

**2. On propose d'être prévenu.** À la place du bouton Commander grisé, un bouton
**« Me prévenir à l'ouverture 🔔 »**. Un tap → « Tu seras prévenu ✓ », et le bouton reste dans
cet état. Un visiteur non connecté est invité à se connecter d'abord (parcours existant).

**3. Tu vois l'intérêt, restaurant par restaurant.** Dans l'admin, sur chaque restaurant en
négociation : *« 42 clients ont consulté la fiche · 17 veulent être prévenus »*. C'est aussi
**un argument de négociation** face au restaurateur : « dix-sept personnes attendent déjà votre
ouverture ».

**4. L'ouverture prévient tout le monde, toute seule.** J'ajoute dans l'admin le bouton qui
manque : passer un restaurant de « En négociation » à « Visible ». Au moment où tu l'appuies,
chaque client qui a demandé à être prévenu reçoit :
- une notification : **« Les Siciliens ouvrent sur Taxi Food 🎉 — la carte t'attend. »**, qui
  ouvre directement la fiche du restaurant ;
- et un e-mail, s'il a une adresse — même canal que les annonces.

### Ce que ça ne fait pas
- Les clients qui ont **seulement consulté** la fiche sans appuyer ne reçoivent rien : ils n'ont
  rien demandé. Ils comptent dans le chiffre d'intérêt, c'est tout.
- Le désabonnement « uniquement des annonces » ne bloque pas ce message : le client l'a demandé
  explicitement, ce n'est pas une annonce générale.

### À valider
1. Le principe « seuls ceux qui ont appuyé sont prévenus » — ou tu veux aussi prévenir ceux qui
   ont simplement consulté ? Je recommande la première option.
2. Le mot du bouton et de la notification, ci-dessus.
3. Le bouton d'ouverture dans l'admin : d'accord pour que ce soit désormais le seul chemin ?

---

## Comment ça arrive sur les téléphones

Les trois chantiers passent par **une seule mise à jour de l'app**, livrée en mise à jour
automatique (les clients qui ont déjà l'app la reçoivent au lancement suivant — pas de nouvelle
soumission aux magasins). Les notifications, elles, sont rédigées côté serveur : elles marchent
dès la mise en ligne, quelle que soit la version de l'app du client.

⚠️ Un livreur ou un restaurant qui n'a pas relancé l'app ne verra pas les nouveaux boutons ni la
précision : je le dis pour qu'on ne cherche pas un bug là où il n'y a qu'une app pas relancée.

## Ordre proposé, et durée
1. **Chantier 2** (précision) — le plus court, le tuyau existe à moitié, et c'est un client réel
   qui l'a demandé ce soir.
2. **Chantier 1** (boutons livreur) — moyen.
3. **Chantier 3** (négociation) — le plus long : base, fiche client, admin, notification.

Une nuit pour les trois est réaliste si le plan est validé tel quel. Chaque chantier est vérifié
avec de vrais comptes de test (la base est remise en état après) et consigné avant de passer au
suivant.

---
---

## Annexe technique (pour l'implémentation, pas pour la validation)

**Ch. 1** — `orders` : deux colonnes `arriving_at`, `arrived_at timestamptz`. RPC SECURITY
DEFINER `mark_order_arriving(p_order_id)` / `mark_order_arrived(p_order_id)` : `courier_id =
auth.uid()`, `picked_up_at not null`, `delivered_at null`, idempotentes (refus si déjà posé).
Trigger `orders_notify_status` : ajouter `arriving_at, arrived_at` à `AFTER UPDATE OF`, émettre
`event='livreur'` + `phase='arriving'|'arrived'` dans le payload. Edge `notify-order` : deux clés
`MESSAGES.arriving` / `MESSAGES.arrived` FR/EN/IT, audience client, route `/order/[id]`. App :
`api.ts` (`markArriving`, `markArrived`, mapper `arrivingAt/arrivedAt`), `(livreur)/index.tsx`
(footer en 4 états), `order/[id].tsx` (deux sous-états après `pickedUp`), `locales/*.json`.
Nettoyage : `release_order` remet les deux colonnes à null.

**Ch. 2** — Base : rien (`order_items.comment` + `create_order` lit `v_item->>'comment'`).
Vérifier que la longueur est bornée dans `create_order` (ajouter `left(…,140)` sinon). App :
`CartLine.comment`, `lineKey` inclut le commentaire (deux tacos, l'un sans tomate = deux lignes),
`product/[id].tsx` champ, `cart.tsx` édition, `api.ts` `createOrder` envoie `comment` + mappers
`listOrders/listRestaurantOrders/listMyActiveDeliveries` lisent `comment`, `RestaurantOrderCard`
+ `order/[id].tsx` affichent. Admin : détail commande (`admin/components/…Commandes`). Telegram :
relire le gabarit de `notify_order_status` — le champ `commentaire` est dans le JSON n8n, vérifier
que le workflow n8n l'imprime (sinon c'est là que ça se perd).

**Ch. 3** — Table `restaurant_interest (id, restaurant_id, user_id, kind 'visite'|'alerte',
created_at)` + index unique partiel sur `(restaurant_id, user_id) where kind='alerte'`. RPC
`noter_interet_restaurant(p_restaurant_id, p_kind)` SECURITY DEFINER (refus si le restaurant
n'est pas `coming_soon`). Vue admin `admin_interet_restaurants()` (compteurs). Admin :
`admin_set_listing_status(p_id, p_status)` + select dans `Restaurants.tsx`. Trigger `AFTER UPDATE
OF listing_status` : `coming_soon → visible` ⇒ `net.http_post` vers une Edge `notifier-ouverture`
(ou réutiliser `envoyer-annonce` avec une cible `alerte:<restaurant_id>` — préférable : mêmes
compteurs, même chemin e-mail n8n, même journal `annonces`). Route de la notif :
`/restaurant/<id>` (déjà autorisée par `admin_creer_annonce`). App : `restaurant/[id].tsx`
— `useEffect` note la visite ; bouton « Me prévenir » à la place du Commander grisé ; état lu par
`mon_interet_restaurant(p_restaurant_id)`. ⚠️ RLS : jamais `to authenticated` seul.
