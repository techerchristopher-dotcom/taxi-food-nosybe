# Fiche App Store — tout ce qu'il faut coller

Contenu prêt à copier dans App Store Connect. Rédigé le 2026-08-19, déduit du code et de la
base réels (pas de supposition sur ce que l'app collecte).

Rappel : rien ici ne demande de build. C'est la dernière étape avant la soumission, une fois
le bloquant A3 tranché (voir [SOUMISSION-APPLE.md](SOUMISSION-APPLE.md)).

---

## 1. Textes

### Nom (30 caractères max)

```
Taxi Food
```

### Sous-titre (30 caractères max) — 28 caractères

```
Livraison de repas à Nosy Be
```

### Texte promotionnel (170 max) — modifiable sans nouvelle version

```
Pizzas, burgers, tacos et sandwichs livrés chauds à Hell-Ville et dans tout Nosy Be. Commandez en quelques taps, payez en espèces à la livraison.
```

### Mots-clés (100 caractères max) — 92 caractères

```
nosy be,madagascar,hell-ville,pizza,burger,tacos,sandwich,crêpe,milkshake,restaurant,livreur
```

⚠️ Ne pas y remettre « livraison » ni « repas » : ils sont déjà dans le sous-titre, qu'Apple
indexe. Les répéter gaspille des caractères sans rien gagner.

### Description (4 000 caractères max)

```
Taxi Food, c'est la livraison de repas à Nosy Be.

Choisissez votre restaurant, composez votre commande, et faites-vous livrer où que vous soyez sur l'île — Hell-Ville, Ambatoloaka, Madirokely, Dzamandzar.

COMMANDER EN QUELQUES TAPS

Parcourez les cartes de nos restaurants partenaires, avec les vraies photos des plats. Pizzas, burgers, tacos, sandwichs, crêpes, milkshakes : tout est là, avec les prix affichés clairement, sans surprise à la fin.

Pour les plats à composer — tacos, kebabs, pizzas — choisissez votre viande, vos sauces et vos suppléments directement dans l'application. Le prix se met à jour à chaque choix : vous savez toujours exactement ce que vous allez payer.

LIVRÉ OÙ VOUS ÊTES, VRAIMENT

À Nosy Be, il n'y a pas d'adressage postal fiable. C'est pourquoi Taxi Food enregistre votre position GPS et vous laisse ajouter un point de repère et des précisions. Votre livreur vous trouve du premier coup, même au fond d'une ruelle ou sur la plage.

SUIVEZ VOTRE COMMANDE EN DIRECT

Vous êtes prévenu à chaque étape : commande confirmée par le restaurant, préparation en cours, livreur en route, commande livrée. Plus besoin d'appeler pour savoir où en est votre repas.

PAIEMENT EN ESPÈCES

Payez votre livreur à la livraison, en ariary. Aucune carte bancaire à saisir, aucune donnée de paiement enregistrée dans l'application.

EN FRANÇAIS, EN ANGLAIS, EN ITALIEN

L'application est entièrement traduite. Pratique pour les résidents comme pour les vacanciers.

VOUS ÊTES RESTAURATEUR OU LIVREUR ?

Taxi Food intègre aussi les espaces professionnels. Les restaurants reçoivent et gèrent leurs commandes depuis l'application ; les livreurs voient les courses disponibles et les prennent en charge. Demandez votre accès directement depuis votre profil.

Taxi Food est un service local, conçu à Nosy Be, pour Nosy Be.
```

---

## 2. Questionnaire App Privacy — quoi cocher exactement

Déduit du code réel. Une déclaration incomplète est un motif de rejet **à part entière**,
indépendamment du reste : Apple compare ce que tu déclares à ce que le binaire fait.

Pour **chaque** donnée ci-dessous, les réponses sont les mêmes :
- **Utilisée pour le suivi publicitaire ?** → **NON** (aucun traceur : vérifié, zéro
  bibliothèque d'analytics dans les dépendances, et le SDK Facebook est configuré avec
  `autoLogAppEventsEnabled: false` et `advertiserIDCollectionEnabled: false`)
- **Liée à l'identité de l'utilisateur ?** → **OUI** (tout est rattaché au compte)
- **Finalité** → **Fonctionnement de l'app** uniquement

| Catégorie Apple | Donnée à cocher | Pourquoi, dans le code |
|---|---|---|
| Coordonnées | **Nom** | `profiles.full_name` — le restaurant et le livreur voient qui ils servent |
| Coordonnées | **Adresse e-mail** | `profiles.email` — création et récupération du compte |
| Coordonnées | **Numéro de téléphone** | `profiles.phone` + `addresses.phone` — le livreur doit pouvoir joindre le client |
| Coordonnées | **Adresse physique** | `addresses` (libellé, zone, point de repère, instructions) |
| Localisation | **Position précise** | `addresses.latitude/longitude`, capturée via `expo-location` au seul moment de l'enregistrement d'une adresse |
| Achats | **Historique d'achat** | tables `orders` / `order_items` |
| Identifiants | **Identifiant utilisateur** | `auth.users.id` (Supabase) |
| Identifiants | **Identifiant d'appareil** | `push_tokens.token` — jeton Expo/APNs, uniquement si les notifications sont acceptées |

**À ne PAS cocher** : Santé, Finances (aucune donnée bancaire — paiement en espèces),
Contacts, Photos, Historique de navigation, Données d'utilisation, Diagnostics (aucun outil
de crash reporting), Contenu audio/vidéo.

---

## 3. Classement d'âge

### Décision prise le 2026-08-19 : cocktails retirés, bières gardées

Les **6 cocktails** de Taxi Be (Mojito, Ti-Punch, Piña Colada, Tequila Sunrise, Planteur,
granité vodka) sont retirés du catalogue : `categories.is_active = false` et les 6 produits
`is_available = false`. **Rien n'est supprimé**, la remise en service est une requête.
Motif retenu : ces boissons se livrent mal en scooter. Vérifié qu'aucune commande en cours
n'en contenait avant de basculer.

État du catalogue après retrait : **106 produits disponibles, dont 19 bières.**

### ⚠️ Ce que ça ne change PAS

**Le classement reste très probablement 17+.** La bière est de l'alcool : avec 19 bières
réparties sur les trois restaurants, l'app continue de **vendre** de l'alcool, et la rubrique
« Alcool, tabac ou drogues » du questionnaire ne peut pas être laissée à « Aucun ».

Retirer les cocktails était donc un bon choix opérationnel, mais ce n'est pas un levier sur le
classement d'âge. Pour viser un classement « tout public », il faudrait retirer **aussi les 19
bières** — ce qui ampute une part réelle de l'activité, Taxi Be étant un bar.

Rien à faire de plus si le 17+ est assumé : c'est cohérent avec un service qui livre de
l'alcool, et beaucoup d'apps de livraison sont dans ce cas.

Toutes les autres rubriques du questionnaire (violence, contenu sexuel, jeux d'argent,
horreur, langage grossier, contenu web non filtré) → **Aucun**.

---

## 4. Comptes de démonstration et notes pour le relecteur

### ✅ Trois comptes, un par rôle (2026-08-23)

⚠️ **Il en fallait trois, et c'est ce qui a causé le second rejet.** Le 23/08, Apple a
répondu *« we cannot access the "Restaurant" and "Courier" accounts »* (guideline 2.1(a)) :
un seul compte client avait été fourni, et les notes disaient que les espaces pro ne
faisaient pas partie du parcours à tester. Apple ne l'entend pas ainsi — **le relecteur veut
pouvoir vérifier CHAQUE type de compte**. Il avait d'ailleurs demandé le rôle restaurant
depuis l'app, qui le laisse en `pending` jusqu'à validation manuelle : il est resté bloqué là.

| Rôle | E-mail | Ce qu'il voit |
|---|---|---|
| Client | `demo.apple@taxifood.mg` | parcours de commande, adresse déjà géolocalisée |
| Restaurant | `demo.resto@taxifood.mg` | espace restaurant de **Taxi Be**, 3 commandes en 3 états |
| Livreur | `demo.livreur@taxifood.mg` | 3 courses disponibles à prendre |

Mot de passe commun : `TaxiFoodDemo2026`.

**Pourquoi Taxi Be pour le compte restaurant** : c'est le seul des trois restaurants avec
**zéro commande réelle**, et il a un vrai menu. Le relecteur voit donc une interface
authentique et peut accepter, préparer et clôturer des commandes **sans jamais toucher aux
données de La Cabane ni d'Angelo**.

Trois commandes de démonstration ont été créées chez Taxi Be, réparties sur **reçue /
confirmée / en préparation**, pour que le cycle complet soit exerçable dès la connexion.
Un espace vide aurait conduit au même rejet une seconde fois.

Le compte client est prêt à l'emploi, avec nom, téléphone **et une adresse de livraison déjà
géolocalisée** (Hell-Ville, en face du marché couvert) — sans adresse, le relecteur ne
pourrait pas valider de commande et conclurait que l'app est cassée.

**Les trois connexions sont vérifiées par l'API d'authentification**, pas déduites du code :
jeton obtenu pour chacun, puis lecture sous RLS confirmant que `demo.resto` est bien rattaché
à Taxi Be (`current_restaurant_id()`) et que `demo.livreur` est bien livreur actif
(`is_active_courier()` → true).

**Vérifié pour de vrai**, pas supposé : connexion testée via l'API d'authentification (jeton
obtenu), puis lecture du catalogue et de l'adresse **sous les droits du compte** (RLS active)
— il voit bien son adresse, les trois restaurants, et la catégorie Cocktails désactivée.

⚠️ **Piège rencontré à la création.** Un compte inséré directement en SQL laisse quatre
colonnes de `auth.users` à `NULL` (`confirmation_token`, `recovery_token`,
`email_change_token_new`, `email_change`) là où GoTrue attend des chaînes vides. Résultat : la
connexion échoue avec **« Database error querying schema »**, message qui ne dit rien du vrai
problème et ne mentionne jamais le mot de passe. Corrigé en alignant ces colonnes sur celles
d'un compte créé normalement. À refaire si un autre compte est créé par SQL.

L'e-mail est marqué confirmé d'office : aucun courriel n'a besoin d'arriver sur
`@taxifood.mg`. En revanche « mot de passe oublié » ne fonctionnerait pas sur ce compte — le
relecteur n'en a pas besoin.

### Notes à coller dans « App Review Information »

⚠️ Réécrites le 2026-08-23 après le second rejet. Deux changements de fond : les **trois**
comptes sont donnés (et non le seul compte client), et la phrase qui disait que les espaces
pro « ne font pas partie du parcours à tester » a disparu — c'est précisément elle qui a
déclenché le rejet 2.1(a). On indique désormais explicitement comment y entrer.

```
Taxi Food is a food delivery platform operating in Nosy Be, Madagascar.

WHAT CHANGED SINCE THE LAST REVIEW
1. Guideline 5.1.1(v) — browsing no longer requires an account. The app now opens directly
   on the restaurant list. Browsing restaurants, menus and dish details, and filling the
   cart, all work with no account at all. Signing in is requested only when placing an
   order, which is an account-based feature.
2. Guideline 2.1(a) — demo accounts are now provided for all three account types, below.

DEMO ACCOUNTS — password is the same for all three: TaxiFoodDemo2026

  Customer     demo.apple@taxifood.mg
  Restaurant   demo.resto@taxifood.mg
  Courier      demo.livreur@taxifood.mg

To switch account: Profile tab > Sign out, then sign in with another one.
All three sign in with the "E-mail" button on the sign-in screen.

BROWSING WITHOUT AN ACCOUNT (no sign-in needed)
1. Open the app. You land on the restaurant list, not on a sign-in screen.
2. Tap a restaurant to see its full menu with prices.
3. Tap a dish (for example a tacos at La Cabane) to see the meat, sauce and topping
   options, with the price updating live.
4. Add it to the cart. The cart works without an account.
5. Tap "Order". Only here are you asked to sign in, and you are returned to checkout
   afterwards with the cart intact.

CUSTOMER ACCOUNT (demo.apple@taxifood.mg)
This account already has a delivery address saved with GPS coordinates, so you can complete
an order without going through location capture.

RESTAURANT ACCOUNT (demo.resto@taxifood.mg)
Signs in to the restaurant space of "Taxi Be". Three demo orders are waiting, one in each
state, so the full cycle can be exercised:
  - one "Received"     -> you can Accept or Decline it
  - one "Confirmed"    -> you can start preparation
  - one "In preparation" -> you can mark it ready
This restaurant has no real customer orders, so nothing you do there affects live data.

COURIER ACCOUNT (demo.livreur@taxifood.mg)
Signs in to the courier space, with deliveries available to claim. You can take one, mark it
picked up, then mark it delivered.

ABOUT LOCATION
Location permission is requested only when saving a delivery address. Nosy Be has no
reliable street addressing, so GPS coordinates are what allows the courier to find the
customer. Location is never captured in the background or while the app is closed. The
customer demo account already has an address saved, so this step can be skipped.

PAYMENT
Payment is cash on delivery, to the courier. No banking details are entered or stored, and
the app offers no in-app purchase: it sells physical goods that are delivered (guideline
3.1.1).

ACCOUNT DELETION
In the app: Profile tab, at the bottom, "Delete my account".

EXTERNAL SERVICES
Supabase (database, authentication, storage), Sign in with Apple / Google Sign-In / Facebook
Login for authentication, Expo Push Notifications (relaying to APNs) for order updates,
Apple MapKit for the address map. No AI services, no payment processor, no analytics or
advertising SDK.
```

⚠️ **Pendant toute la durée de la revue**, quelqu'un doit pouvoir traiter une commande qui
arriverait sur l'écran restaurant. Si le relecteur valide une commande et que personne ne la
confirme, il verra un parcours bloqué et pourra juger l'app non fonctionnelle.

---

## 5. Plan des captures d'écran — ✅ FAIT (2026-08-19)

**Les six fichiers sont dans [captures-app-store/](captures-app-store/)**, aux bons noms et au
bon format, avec leur ordre de téléversement et leurs légendes. Il n'y a plus qu'à les
déposer dans App Store Connect. Le reste de cette section documente comment elles ont été
prises, pour pouvoir en refaire une.

**Format requis : iPhone 6,9 pouces** (1320 × 2868 px). C'est le seul format obligatoire
aujourd'hui : App Store Connect décline automatiquement vers les tailles inférieures.

Prises dans le **simulateur iOS** (iPhone 17 Pro Max) : un iPhone 14 Pro rend en 1179 × 2556,
que l'App Store n'accepte pas. `⌘S` dans le simulateur, ou `xcrun simctl io <udid> screenshot`
en ligne de commande.

Ordre proposé, du plus vendeur au plus explicatif — les deux premières sont celles que 90 %
des visiteurs verront :

| # | Écran | Ce qu'il faut montrer | Légende suggérée |
|---|---|---|---|
| 1 | Accueil | La liste des restaurants avec leurs logos et les filtres par type | « Vos restaurants préférés, livrés chez vous » |
| 2 | Menu restaurant | Une carte avec de vraies photos de plats, prix visibles | « Les vraies cartes, les vraies photos » |
| 3 | Détail d'un plat à composer | Un tacos avec les chips de viandes et de sauces illustrées, prix à jour | « Composez exactement ce que vous voulez » |
| 4 | Panier | Deux ou trois articles, total et frais de livraison clairs | « Aucune surprise sur le prix » |
| 5 | Adresse GPS | La carte avec le point capté et le champ de précision rempli | « Livré où vous êtes, même sans adresse postale » |
| 6 | Suivi de commande | Une commande en cours, à l'étape « livreur en route » | « Suivez votre repas en direct » |

À éviter dans les captures :
- l'écran de choix de rôle et les espaces restaurant/livreur — ils s'adressent aux partenaires
  et brouillent le message pour un client ;
- un panier vide ou un écran de chargement ;
- toute donnée personnelle réelle (nom complet, numéro de téléphone).
