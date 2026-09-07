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

**Version en ligne aujourd'hui**, exacte tant que la carte n'est pas active :

```
Pizzas, burgers, tacos et sandwichs livrés chauds à Hell-Ville et dans tout Nosy Be. Commandez en quelques taps, payez en espèces à la livraison.
```

**À basculer le jour où `payment_config.carte_active` passe à `true`** — 143 caractères. Ce
champ est le seul du § 1 modifiable **sans** nouvelle version : c'est donc le premier à
corriger, et il peut l'être en quelques minutes.

```
Pizzas, burgers, tacos et sandwichs livrés chauds à Hell-Ville et dans tout Nosy Be. Commandez en quelques taps, payez en espèces ou par carte.
```

### Mots-clés (100 caractères max) — 92 caractères

```
nosy be,madagascar,hell-ville,pizza,burger,tacos,sandwich,crêpe,milkshake,restaurant,livreur
```

⚠️ Ne pas y remettre « livraison » ni « repas » : ils sont déjà dans le sous-titre, qu'Apple
indexe. Les répéter gaspille des caractères sans rien gagner.

### Description (4 000 caractères max)

⚠️ **La description ci-dessous contient déjà le paiement par carte** (section « PAIEMENT EN
ESPÈCES OU PAR CARTE »). Elle ne doit **pas** être envoyée avant que la fonctionnalité soit
réellement dans le binaire soumis : annoncer un moyen de paiement absent est un motif de rejet
en soi (guideline 2.3.1, « ne pas décrire des fonctions que l'app ne contient pas »).

Contrairement au texte promotionnel, ce champ **n'est modifiable qu'en soumettant une nouvelle
version**. Il se corrige donc naturellement au même moment que le build qui apporte Stripe.

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

PAIEMENT EN ESPÈCES OU PAR CARTE

Payez votre livreur à la livraison, en ariary. Vous pouvez aussi régler par carte bancaire directement dans l'application : la saisie se fait dans un écran sécurisé fourni par notre prestataire de paiement, et aucune donnée de carte n'est enregistrée par Taxi Food. Le paiement par carte est débité en euros, au taux qui vous est affiché avant validation.

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

⚠️ **Deux versions de ce questionnaire coexistent.** Le tableau ci-dessous décrit le binaire
**tel qu'il est aujourd'hui sur l'App Store** (build 22, sans Stripe). Les deux lignes à
ajouter **le jour où le SDK Stripe entre dans le binaire** sont juste en dessous, avec leur
justification. Une App Privacy qui décrit un binaire différent de celui qui est envoyé est un
motif de rejet à part entière.

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

**À ne PAS cocher** : Santé, Finances (aucune donnée bancaire tant que la carte n'est pas
dans le binaire — voir ci-dessous), Contacts, Photos, Historique de navigation, Données
d'utilisation, Diagnostics (aucun outil de crash reporting), Contenu audio/vidéo.

### ⚠️ Ce qui change avec le SDK Stripe — à cocher au build qui l'embarque

Deux lignes s'ajoutent. **Ni plus, ni moins** : sur-déclarer est aussi faux que sous-déclarer,
et l'un comme l'autre se vérifie en analysant le binaire.

| Catégorie Apple | Donnée | Lié à l'identité | Suivi | Finalité |
|---|---|---|---|---|
| **Finances** | **Informations de paiement** | **Oui** | Non | Fonctionnement de l'app |
| **Données d'utilisation** | **Interaction avec le produit** | **Oui** | Non | Fonctionnement de l'app **+ Analyses** |

#### Pourquoi « Informations de paiement » doit être coché, alors que la carte ne passe pas chez nous

C'est le point contre-intuitif du dossier, et celui sur lequel il ne faut pas se tromper.

Apple prévoit bien une exception, mais elle est **cumulative** :

> *« Payment Info: […] If your app uses a payment service, **the payment information is
> entered outside your app**, and you as the developer **never have access** to the payment
> information, it is not collected and does not need to be disclosed. »*
> — [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

La seconde condition est remplie : notre backend ne voit jamais le numéro de carte (vérifié
dans `supabase/functions/creer-paiement/index.ts` — on n'envoie à Stripe que le montant, la
devise et des références de commande). **La première ne l'est pas** : le PaymentSheet est
présenté **dans** l'app, pas dans un navigateur externe. L'exception ne s'applique donc pas.

S'y ajoute la règle générale sur les SDK :

> *« You need to identify all of the data **you or your third-party partners** collect […]
> "Third-party partners" refers to analytics tools, advertising networks, **third-party SDKs**,
> or other external vendors whose code you've added to your app. »*

Stripe conserve la donnée de carte — ce n'est pas un traitement éphémère au sens d'Apple. Elle
est donc **collectée**, par un partenaire dont on a ajouté le code.

Stripe le dit lui-même dans sa fiche destinée aux développeurs iOS
([Stripe Mobile SDK Privacy Details](https://support.stripe.com/questions/stripe-ios-sdk-privacy-details)) :
elle liste **Payment Info**, **Contact Info**, **User ID** et **Product Interaction**, et
répond « No. Stripe does not use this data for tracking purposes. » à la question du suivi.

**« Lié à l'identité » = Oui** : la ligne `payment_intents` porte `user_id`, et le PaymentIntent
Stripe porte `metadata.order_id`. Le paiement est donc rattachable à la personne.

#### Pourquoi « Interaction avec le produit », et pourquoi la finalité « Analyses » apparaît

Le SDK Stripe émet sa propre télémétrie d'usage. Stripe la déclare avec les finalités *App
Functionality* **et** *Analytics*. C'est la seule entorse à la règle « Fonctionnement de l'app
uniquement » qui tenait jusqu'ici, et l'oublier est typiquement ce qu'une analyse de binaire
rattrape. La réponse au **suivi publicitaire reste NON** : ces analyses sont celles de Stripe
sur son propre SDK, pas du pistage inter-apps.

#### Ce qu'il ne faut PAS ajouter

- **Coordonnées** — déjà déclarées (nom, e-mail, téléphone, adresse). Notre code n'envoie **ni
  `receipt_email`, ni objet `Customer`, ni coordonnées** à Stripe : aucune case nouvelle.
- **Identifiant utilisateur** — déjà déclaré.
- **Historique d'achat** — déjà déclaré.
- ⚠️ **Ne pas cocher « Informations financières › Informations de solvabilité »** ni quoi que
  ce soit qui suggère un service financier : on vend des repas, on n'octroie rien.

#### Manifeste de confidentialité (privacy manifest)

Stripe livre un `PrivacyInfo.xcprivacy` dans son SDK iOS, comme Apple l'exige depuis mai 2024
pour les SDK de sa liste. ⚠️ Piège connu de l'écosystème : Apple n'agrège pas toujours
correctement les manifestes des dépendances **CocoaPods statiques**. Si l'envoi est refusé avec
un avertissement de « required reason API » non déclarée, la parade est de reprendre les
raisons concernées dans le manifeste de l'app elle-même — voir la
[documentation Expo](https://docs.expo.dev/guides/apple-privacy/).

💡 **Réduire la surface, si on le souhaite** : `setAdvancedFraudSignalsEnabled(false)` désactive
la signature d'appareil anti-fraude de Stripe. Elle protège contre la fraude — la couper est un
arbitrage, pas une simple hygiène.

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

⚠️ **Les blocs PAYMENT et EXTERNAL SERVICES ci-dessous décrivent le paiement par carte.** Ils
ne valent que pour un build qui l'embarque réellement. Pour une soumission **sans** Stripe,
reprendre la version d'avant : *« Payment is cash on delivery, to the courier. No banking
details are entered or stored »*, et retirer Stripe de la liste des services externes.

⚠️ Réécrites le 2026-08-23 après le second rejet. Deux changements de fond : les **trois**
comptes sont donnés (et non le seul compte client), et la phrase qui disait que les espaces
pro « ne font pas partie du parcours à tester » a disparu — c'est précisément elle qui a
déclenché le rejet 2.1(a). On indique désormais explicitement comment y entrer.

```
Taxi Food is a food delivery platform operating in Nosy Be, Madagascar.

WHAT IS NEW IN THIS VERSION (1.2.0)
1. Card payment (Stripe) has been added, alongside cash on delivery. See PAYMENT below.
   IMPORTANT: card payments are LIVE. Please use "Cash on delivery" to test ordering —
   choosing "Card" would place a real charge on your card.
2. Restaurants can now set two service windows per day (lunch and dinner), and a menu
   section can be limited to certain hours (for example pizzas from 6pm).
3. Restaurant owners can upload their own logo and cover photo, and feature dishes of the day.
4. Customers and restaurant owners can share a dish or a restaurant to WhatsApp or Facebook.
5. A guided tour introduces the restaurant space on first sign-in.

STILL TRUE FROM THE PREVIOUS REVIEW
- Guideline 5.1.1(v) — browsing requires no account. The app opens on the restaurant list.
- Guideline 2.1(a) — demo accounts are provided for all three account types, below.

DEMO ACCOUNTS — password is the same for all three: TaxiFoodDemo2026

  Customer     demo.apple@taxifood.mg
  Restaurant   demo.resto@taxifood.mg
  Courier      demo.livreur@taxifood.mg

All three sign in with the "E-mail" button on the sign-in screen.

IMPORTANT — HOW TO MOVE BETWEEN SPACES
The restaurant and courier accounts open DIRECTLY into their professional space. There is no
Profile tab visible there. To reach the customer app from a professional space, tap the
"App client" button (double arrow) in the header at the top right. To come back, use the
Profile tab, then "Mon espace partenaire".
To switch account: from the CUSTOMER app, Profile tab > Sign out, then sign in with another.

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

WHERE TO PLACE A TEST ORDER
Please order from "Taxi Be". It is the one restaurant with no real customer orders and no
live notification channel, so nothing you do there disturbs a real business. The other
restaurants on the list are live businesses whose owners receive every order on their phone.

PAYMENT — PLEASE USE "CASH ON DELIVERY" FOR THIS REVIEW
Card payments are LIVE, not in test mode: selecting "Card" would place a real charge on your
own card. "Cash on delivery" is the default and lets the whole ordering flow be tested end to
end at no cost.

The app sells physical goods that are prepared and delivered in the real world, so it uses
external payment rather than in-app purchase (guideline 3.1.5(a) "Goods and Services Outside
of the App"). There is no in-app purchase of digital content anywhere in the app.

Two payment methods are offered:
  - Cash on delivery, paid to the courier. This is the default.
  - Card payment, handled by Stripe. The card details are entered in Stripe's own
    PaymentSheet; they are sent straight to Stripe and never reach our servers. We store only
    the amount, the status and Stripe's transaction reference.
Prices are shown in Malagasy ariary. Card payments are charged in euros at a fixed rate that
is displayed to the customer, together with the exact euro amount, before they confirm.

ACCOUNT DELETION
In the app: Profile tab, at the bottom, "Delete my account".

EXTERNAL SERVICES
Supabase (database, authentication, storage), Sign in with Apple / Google Sign-In / Facebook
Login for authentication, Expo Push Notifications (relaying to APNs) for order updates,
Apple MapKit for the address map, and Stripe for card payments. No AI services, no analytics
or advertising SDK.
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

---

## 6. Nouveautés de la version 1.2.0 — à coller dans « Nouveautés de cette version »

⚠️ **Registre : on tutoie le client.** C'est la décision du 2026-08-24, appliquée partout
côté client. Le vouvoiement ne subsiste que pour s'adresser aux professionnels — d'où le
« votre » du paragraphe restaurateurs, volontaire.

⚠️ **On n'annonce que ce qui est visible par la personne qui lit.** Les corrections
internes (ordre de la carte, notification vide, garde d'ouverture) ne sont mentionnées que
par leur effet, jamais par leur cause : « les commandes arrivent complètes chez le
restaurant » se comprend, « le trigger est devenu differable » non.

1 440 caractères sur 4 000.

```
Payez par carte, ou toujours en espèces à la livraison.

Le paiement par carte arrive : tes prix restent en ariary, le débit se fait en euros à un taux fixe que tu vois avant de confirmer, avec le montant exact. Tes coordonnées bancaires ne passent jamais par nous. Et si tu préfères, les espèces à la livraison n'ont pas bougé.

Les restaurants ouvrent à leurs vraies heures. Midi et soir séparément, chacun avec ses horaires — fini les restaurants affichés ouverts en plein après-midi. Certaines cartes n'ouvrent qu'à leur heure : les pizzas au four sortent le soir, et l'application te le dit avant que tu remplisses ton panier.

Partage un plat en un geste. Sur chaque plat et chaque restaurant, un bouton pour envoyer le lien sur WhatsApp ou Facebook, ou le copier. Le destinataire voit la photo, le nom et le prix, et peut commander directement.

L'offre du jour, mise en avant. Les restaurants peuvent mettre leurs plats du jour en tête de leur carte, avec la quantité restante.

Un repère « Contient du porc » sur les plats concernés, pour choisir d'un coup d'œil.

Côté restaurateurs : votre logo et votre photo de couverture depuis vos réglages, vos horaires jour par jour, et une visite guidée de votre espace à la première connexion.

Et beaucoup de petits ajustements : la carte ne se réorganise plus toute seule, les plats à choix multiple annoncent enfin leurs options, et les commandes arrivent complètes chez le restaurant.
```

---

## 7. Ce qui a été mis en place POUR LA REVUE, et qu'il faut défaire après

⚠️ **À rétablir dès la validation d'Apple.** Laisser ces réglages en l'état après la revue
crée de vrais dégâts en exploitation.

| Réglage | État posé le 2026-09-07 | À rétablir |
|---|---|---|
| Les trois restaurants visibles | `is_open = true`, `auto_open = false` — ouverts en permanence | `auto_open = true`, pour que leurs horaires reprennent la main |
| **Taxi Be** | passé `coming_soon` → `visible` | Rendre `coming_soon` s'il n'est toujours pas exploité |
| **Telegram de Taxi Be** | pointé sur le téléphone du porteur du projet (`7699975131`) | Le retirer, ou le brancher sur son vrai patron |

**Pourquoi ces réglages.** Depuis le 2026-09-07, `create_order` REFUSE une commande sur un
restaurant fermé. Le relecteur teste depuis la Californie, à n'importe quelle heure : sans
ouverture permanente il tombe sur un restaurant fermé, ne peut pas commander, et conclut que
l'app ne fonctionne pas — exactement le scénario des deux rejets précédents.

**Pourquoi le filet Telegram sur Taxi Be.** Le rendre commandable l'expose à de VRAIS
clients, alors qu'aucun patron n'y est branché : sans ce renvoi, une commande réelle passée
pendant la revue ne serait vue par personne.

---

## 8. Soumission du 2026-09-07 — ce qui est parti chez Apple

**Version 1.2.0, build 28**, envoyée à 23 h 09 (heure locale). Apple annonce jusqu'à
48 heures de vérification. Statut visible sur la page de la version : tant qu'elle est en
attente, les textes restent modifiables, mais **changer de build oblige à retirer la version
du processus** — donc à repartir en bas de la file.

⚠️ Les builds 26 et 27 sont des **échecs**, pas des versions : le profil de provisioning
n'avait pas encore l'entitlement Apple Pay (voir `PAIEMENT-STRIPE.md` § 12). Le 28 est le
premier build signé avec.

### Ce qui a été vérifié dans le binaire, pas supposé

L'IPA a été téléchargé et ouvert avant l'envoi :

- profil de provisioning **recréé le 2026-09-07 à 19:36:39** (l'ancien datait du 17 août) ;
- `com.apple.developer.in-app-payments = ['merchant.com.chris97416.taxi-food-nosybe']`,
  présent **dans le profil ET dans la signature du binaire** — c'est cette dernière qu'iOS lit ;
- `CFBundleShortVersionString` 1.2.0, `CFBundleVersion` 28.

⚠️ Le profil s'appelle toujours `…AppStore 2026-08-17T19:44:54`. **Ne pas s'y fier** : EAS
conserve le libellé d'origine. Seules la date de création et le contenu font foi.

### Déclaration de confidentialité — modifiée et publiée

Ajout d'un 9ᵉ type de données : **Informations de paiement**, *Fonctionnalité de l'app*,
*lié à l'identité de l'utilisateur*, **pas de suivi**.

**Pourquoi.** Depuis 1.2.0, le numéro de carte est saisi dans la feuille Stripe, qui s'ouvre
**à l'intérieur de l'app**. Le questionnaire d'Apple rappelle lui-même que les données
collectées par un SDK tiers comptent comme collectées par l'app.

⚠️ **Un point de droit à connaître, au cas où on nous le reprocherait.** Apple affiche, sous
« Informations de paiement », une exemption :

> *Si votre app utilise un service de paiement, les informations de paiement sont saisies en
> dehors de votre app et vous, en tant que développeur, n'avez jamais accès à ces
> informations, qui ne sont donc pas collectées et qui n'ont pas besoin d'être déclarées.*

Les deux conditions sont cumulatives. La seconde est remplie (la carte ne touche jamais nos
serveurs, cf. `PAIEMENT-STRIPE.md`), **mais pas la première** : la feuille est native et
s'ouvre dans l'app, pas dans un navigateur. On a donc déclaré. C'est le choix prudent — sous-
déclarer expose à un retrait, sur-déclarer n'expose qu'à une ligne de plus sur la fiche.

⚠️ **Pas déclaré, et c'est discutable** : *Interaction avec le produit*. Le SDK Stripe collecte
des indicateurs d'activité (rythme de frappe, copier-coller) à des fins **anti-fraude
uniquement**, jamais publicitaires, et jamais recoupés entre apps. `Identifiant de l'appareil`
est déjà déclaré et couvre les caractéristiques matérielles. À rouvrir si Apple le soulève.

### Ajout aux notes du relecteur

Une phrase sur Apple Pay, désormais présent dans la feuille :

> *Apple Pay is offered inside that same Stripe sheet: it is also a real charge, and it pays
> for physical goods, not in-app content.*

Elle sert à couper court au réflexe « paiement Apple = achat intégré » : c'est bien de la
marchandise physique, donc paiement externe autorisé (règle 3.1.5(a)).

### État des restaurants au moment de l'envoi

Vérifié en base, pas de mémoire — les quatre visibles sont ouverts en permanence
(`auto_open = false`, `is_open = true`) : Chez Bidul & Truc, La Cabane, Les Siciliens,
Taxi Be. Angelo reste `hidden`. **Tout ceci est à défaire après validation — voir § 7.**

### Ce qui n'a PAS été refait

Les captures d'écran **datent du 2026-08-19** et montrent encore le vouvoiement, abandonné
côté client le 2026-08-24. Ce n'est pas un motif de rejet, mais c'est une incohérence visible
sur la fiche produit, à reprendre à la prochaine version.
