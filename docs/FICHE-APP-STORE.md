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

## 3. Classement d'âge — ⚠️ point à trancher

**Vérifié en base le 2026-08-19 : le catalogue contient 25 produits alcoolisés.**

| Restaurant | Alcool |
|---|---|
| Taxi Be | 9 bières + 6 cocktails (Mojito, Ti-Punch, Piña Colada, Tequila Sunrise…) |
| La Cabane | 5 bières |
| Angelo | 5 bières |

Conséquence : au questionnaire de classement d'âge, la rubrique **« Alcool, tabac ou
drogues »** ne peut pas être laissée à « Aucun ». Une app qui **vend** de l'alcool — et non
qui y fait seulement allusion — est en général classée **17+** par Apple, et doit respecter la
réglementation locale sur la vente d'alcool.

Deux options, et c'est une décision qui t'appartient :

- **Assumer le 17+.** Rien à changer dans l'app. Inconvénient : l'app devient invisible pour
  les comptes d'adolescents et perd un peu de visibilité générale.
- **Retirer les bières et cocktails du catalogue** (`is_available = false`) pour viser un
  classement bas. L'app resterait « tout public », mais tu perds une part du chiffre des
  restaurants — Taxi Be est un bar, l'alcool est une partie de son activité.

Je ne peux pas trancher à ta place : c'est un choix commercial autant que réglementaire. Dis-moi
lequel tu retiens, et si tu prends le second je fais la modification.

Toutes les autres rubriques du questionnaire (violence, contenu sexuel, jeux d'argent,
horreur, langage grossier, contenu web non filtré) → **Aucun**.

---

## 4. Compte de démonstration et notes pour le relecteur

### Le compte à créer (par toi, avant de soumettre)

**Surtout pas un compte Google, Facebook ou Apple** : le relecteur n'y a pas accès. Il faut un
compte **e-mail + mot de passe**, créé depuis l'app (« Créer un compte par e-mail »).

Suggestion : une adresse dédiée du genre `demo.apple@…`, un mot de passe simple mais valide
(8 caractères minimum), et **passe l'onboarding jusqu'au bout toi-même** : nom, téléphone, et
surtout **une adresse enregistrée avec sa position GPS**. Sans adresse, le relecteur ne peut
pas valider de commande et conclura que l'app est cassée.

### Notes à coller dans « App Review Information »

```
L'application est une plateforme de livraison de repas opérant à Nosy Be (Madagascar).

COMPTE DE DÉMONSTRATION
E-mail : [à compléter]
Mot de passe : [à compléter]

Ce compte est un compte client, avec une adresse de livraison déjà enregistrée.

PARCOURS À TESTER
1. Se connecter avec le compte ci-dessus (bouton « E-mail »).
2. Choisir un restaurant sur l'écran d'accueil.
3. Ouvrir un plat à composer (par exemple un tacos) pour voir la sélection des viandes,
   sauces et suppléments, avec le prix mis à jour en direct.
4. Ajouter au panier, puis valider la commande depuis le panier.
5. L'écran de suivi affiche l'état de la commande.

À PROPOS DE LA LOCALISATION
L'autorisation de localisation est demandée uniquement lors de l'enregistrement d'une adresse
de livraison. Nosy Be n'a pas d'adressage postal fiable : les coordonnées GPS sont
indispensables pour que le livreur trouve le client. La position n'est jamais captée en
arrière-plan ni lorsque l'application est fermée. Le compte de démonstration a déjà une
adresse enregistrée, cette étape peut donc être ignorée.

PAIEMENT
Le paiement se fait en espèces au livreur, à la livraison. Aucune donnée bancaire n'est
saisie ni conservée, et l'application ne propose aucun achat intégré : elle vend des biens
physiques livrés (règle 3.1.1).

SUPPRESSION DE COMPTE
Accessible depuis l'application : onglet Profil, tout en bas, « Supprimer mon compte ».

ESPACES PROFESSIONNELS
L'application contient aussi des espaces restaurant et livreur, accessibles seulement aux
comptes dont le rôle a été validé manuellement. Un compte client n'y a pas accès ; ils ne
font pas partie du parcours à tester.
```

⚠️ **Pendant toute la durée de la revue**, quelqu'un doit pouvoir traiter une commande qui
arriverait sur l'écran restaurant. Si le relecteur valide une commande et que personne ne la
confirme, il verra un parcours bloqué et pourra juger l'app non fonctionnelle.

---

## 5. Plan des captures d'écran

**Format requis : iPhone 6,9 pouces** (1320 × 2868 px). C'est le seul format obligatoire
aujourd'hui : App Store Connect décline automatiquement vers les tailles inférieures.

Si ton iPhone n'est pas un 6,9" (16/17 Pro Max), prends-les dans le **simulateur iOS** sur ton
Mac avec un iPhone 17 Pro Max — c'est le seul moyen d'avoir la résolution exacte. `⌘S` dans le
simulateur enregistre la capture au bon format.

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
