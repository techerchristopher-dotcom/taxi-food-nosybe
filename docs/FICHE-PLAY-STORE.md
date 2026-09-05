# Fiche Play Store — tout ce qu'il faut coller

Compagnon Android de [FICHE-APP-STORE.md](FICHE-APP-STORE.md). **Les textes sont les mêmes**
— nom, description, arguments ne sont pas propres à iOS. Ce qui change : les **limites de
caractères**, les **formats d'image**, et deux questionnaires qui portent d'autres noms.

Compte développeur : `6682410097385681985` ·
[Play Console](https://play.google.com/console/u/0/developers/6682410097385681985/app-list)

---

## 1. Textes de la fiche

| Champ Play Store | Limite | Équivalent Apple |
|---|---|---|
| Nom de l'application | **30** | Nom |
| Description courte | **80** | Sous-titre (30) — **à réécrire, la limite est plus large** |
| Description complète | **4 000** | Description |

### Nom (30 max) — 9 caractères

```
Taxi Food
```

### Description courte (80 max) — 74 caractères

⚠️ **Ne pas recopier le sous-titre Apple** : il fait 28 caractères pour une limite de 30,
alors que Google en accorde 80. Les 50 de plus sont la première chose que voit un utilisateur
dans les résultats de recherche — les gaspiller serait dommage.

```
Livraison de repas à Nosy Be — pizzas, burgers, tacos livrés chauds
```

### Description complète (4 000 max)

**Reprendre telle quelle** la description de [FICHE-APP-STORE.md](FICHE-APP-STORE.md) § 1.
Elle passe sans modification : même limite, et aucune mention d'iOS ou d'iPhone dedans.

⚠️ **Pas de champ « mots-clés » sur le Play Store.** Google indexe le **nom** et les **deux
descriptions**. Les mots-clés de la fiche Apple ne se collent nulle part — ils doivent être
fondus dans la description complète, où ils sont déjà présents (Nosy Be, Hell-Ville,
Ambatoloaka, pizza, burger, tacos…).

---

## 2. Visuels — ✅ PRÊTS

Dans [`captures-play-store/`](captures-play-store/). Contraintes vérifiées sur la
[page officielle](https://support.google.com/googleplay/android-developer/answer/9866151).

| Fichier | Format exigé | Le nôtre |
|---|---|---|
| `00-icone-512x512.png` | 512 × 512, PNG 32 bits **avec** alpha, ≤ 1 024 ko | ✅ 512 × 512, 292 ko |
| `00-image-presentation-1024x500.png` | 1 024 × 500, PNG 24 bits **sans** alpha | ✅ 1 024 × 500, 414 ko |
| `01` à `06` | 2 à 8 captures, PNG 24 bits sans alpha, côté 320–3 840 px | ✅ six, 1 440 × 2 693 |

### ⚠️ Pourquoi les captures ne sont pas celles d'Apple telles quelles

**La contrainte de ratio.** Google exige que *« la dimension la plus longue soit inférieure au
double de la dimension la plus courte »*. Les captures iPhone font 1 320 × 2 868, soit
**2,17 : 1** — elles seraient **refusées**. Deux retouches, sans rien recadrer du contenu :

1. **Suppression de la barre d'état iOS** (175 px du haut, sous l'îlot dynamique). Une
   capture d'iPhone sur une fiche Play se remarque, et l'îlot est le détail qui trahit.
2. **Ajout de 60 px de chaque côté**, pour tomber à **1 440 × 2 693 = 1,87 : 1**. Les bandes
   ne sont pas d'une couleur unie : c'est la **colonne de bord étirée**. Le haut des captures
   est un dégradé rouge, le bas est blanc — une bande unie jurerait à l'une des deux
   extrémités. Étirée, elle se raccorde partout.

Le script qui les produit est reproductible à partir de `captures-app-store/`.

### ⚠️ Les captures montrent l'ancien registre

Elles datent du 2026-08-19, **avant** le passage au tutoiement du 2026-08-24. On y lit encore
« En route vers **vous** » et « Le livreur a récupéré **votre** commande ». Rien de bloquant
pour la validation, mais **à refaire après le prochain build** pour que la fiche corresponde à
l'app.

### L'image de présentation

Créée pour l'occasion — Apple n'a pas d'équivalent. Rendue depuis un gabarit HTML avec la
police de la marque (Archivo), sur le dégradé de l'app, avec quatre plats réels du catalogue.
Le gabarit n'est pas conservé : il vivait dans `landing/` le temps du rendu et a été supprimé,
il n'a rien à faire sur le site.

---

## 3. Data Safety — l'équivalent Google d'App Privacy

**Mêmes faits que la fiche Apple** (§ 2), formulaire différent. Google pose deux questions de
plus qu'Apple, sur lesquelles il ne faut pas se tromper :

| Question Google | Réponse | Pourquoi |
|---|---|---|
| Les données sont-elles **chiffrées en transit** ? | **OUI** | tout passe par HTTPS (Supabase, Expo Push) |
| L'utilisateur peut-il **demander la suppression** de ses données ? | **OUI** | Profil → « Supprimer mon compte », RPC `delete_my_account()` |
| Collectez-vous des données ? | **OUI** | |
| Partagez-vous des données avec des tiers ? | **NON** | aucun traceur, aucune régie |

### Le tableau de correspondance

| Donnée | Catégorie Google | Collectée | Partagée | Facultative ? |
|---|---|---|---|---|
| Nom | Informations personnelles › Nom | oui | non | obligatoire |
| Adresse e-mail | Informations personnelles › Adresse e-mail | oui | non | obligatoire |
| Téléphone | Informations personnelles › Numéro de téléphone | oui | non | obligatoire |
| Adresse de livraison | Informations personnelles › Adresse | oui | non | obligatoire |
| Position précise | Position › Position précise | oui | non | obligatoire |
| Historique de commandes | Achats › Historique des achats | oui | non | obligatoire |
| Identifiant utilisateur | Identifiants › Identifiants utilisateur | oui | non | obligatoire |
| Jeton de notification | Identifiants › Identifiants d'appareil | oui | non | **facultative** (seulement si les notifications sont acceptées) |

**Finalité, pour toutes** : « Fonctionnalité de l'application ». Jamais « Publicité »,
jamais « Analyses ».

**À ne PAS déclarer** : Santé, Messages, Photos et vidéos, Fichiers, Contacts, Activité dans
l'application, Informations sur les performances (aucun outil de crash reporting).

### ⚠️ Le paiement par carte : Google demande L'INVERSE d'Apple

C'est le piège de ce dossier. **Apple veut qu'on déclare « Payment Info » ; Google veut qu'on
ne le déclare pas.** Ce n'est pas une contradiction, ce sont deux exceptions écrites
différemment — et appliquer la réponse d'un magasin à l'autre est faux dans les deux sens.

L'exception de Google tient en deux conditions **cumulatives** :

> *« If your app uses a payment service such as PayPal, Google Pay, Google Play's billing
> system, or similar services to complete payment transactions, you **don't need to declare
> collection** of the data that the payment service collects in connection with its processing
> of financial transactions, such as a credit card number, if the following conditions are met:
> **Your app never accesses this information**; and **the payment service collects this
> information directly from the user**, and collection is governed by that service's terms. »*
> — [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)

Les deux sont remplies :

1. **Notre app n'accède jamais au numéro de carte.** Il est saisi dans le composant de Stripe
   et part directement chez Stripe. Notre Edge Function `creer-paiement` n'envoie que le
   montant, la devise et des références de commande — vérifié dans le code, pas supposé.
2. **Stripe collecte la donnée directement auprès de l'utilisateur**, sous ses propres
   conditions.

→ **« Informations financières › Informations de paiement de l'utilisateur » reste NON déclarée.**

Là où Apple diverge : son exception exige en plus que la saisie ait lieu **hors de l'app**, ce
que le PaymentSheet ne fait pas. Le raisonnement complet est dans
[FICHE-APP-STORE.md](FICHE-APP-STORE.md) § 2.

#### Ce qui ne bouge pas non plus

- **« Informations financières › Historique des achats »** — **déjà déclarée**, et elle le
  reste. C'est là que vit l'historique de commandes (§ « Data safety — terminé » plus bas).
- **« Aucune donnée partagée avec des tiers »** — **reste vrai**. Google exclut explicitement
  de la notion de « partage » les transferts vers un **prestataire** qui traite pour le compte
  du développeur (*« Transferring data to entities processing it on your behalf per your
  instructions »*). Stripe est exactement cela pour les données de commande qu'on lui envoie.
  ⚠️ Cette réponse deviendrait fausse le jour où l'on transmettrait des données personnelles à
  Stripe pour son propre usage (un `Customer`, un `receipt_email`, un profil marketing) —
  aujourd'hui on ne lui envoie **aucune donnée personnelle**.
- **« Chiffrées en transit »** et **« suppression possible »** — inchangées.

#### Ce qu'il faut vérifier avant de cocher quoi que ce soit

Google rappelle que la déclaration couvre **aussi les SDK tiers** (*« This includes data
collected and handled through any third-party libraries or SDKs used in their apps »*). Il faut
donc s'assurer que le SDK Stripe Android ne collecte rien **au-delà** du traitement du
paiement. Si une future version se mettait à faire de l'analytics d'usage rattachée à
l'utilisateur, il faudrait déclarer « Activité dans l'application ». **À revérifier au moment
d'installer la dépendance**, sur la fiche de confidentialité du SDK.

---

## 4. Classement de contenu IARC

Questionnaire différent d'Apple, **même fait à déclarer** : le catalogue contient de la
**bière** (19 références chez Taxi Be et La Cabane). Les cocktails ont été retirés le
2026-08-19 — voir [FICHE-APP-STORE.md](FICHE-APP-STORE.md) § 3 pour le raisonnement, il vaut
pour les deux magasins.

Catégorie : **Achats et vente au détail** (pas « Nourriture et boissons », qui n'existe pas
comme catégorie IARC).

⚠️ **Ne pas minimiser la présence d'alcool.** Une déclaration inexacte au questionnaire IARC
est un motif de suspension, et elle se vérifie en ouvrant l'app. Répondre « oui » à la
référence à l'alcool donnera un classement supérieur — c'est le prix, et il est juste.

---

## 5. Accès pour la relecture — la leçon des deux rejets Apple

Google demande, dans **Test et publication › Contenu de l'application › Accès à
l'application**, si des parties de l'app exigent une connexion. **Oui.**

⚠️ **Le build 17 a été rejeté DEUX FOIS par Apple sur exactement ce point.** Les mêmes causes
existent côté Google, et la parade est déjà écrite :

- **Fournir les TROIS comptes**, pas un seul. Le relecteur Apple a demandé le rôle restaurant
  depuis l'app, l'a obtenu en statut `pending`, n'a rien vu, et a rejeté. Identifiants et
  notes prêts dans [FICHE-APP-STORE.md](FICHE-APP-STORE.md) § 4 — **les recopier tels quels**.
- **Dire que le catalogue est libre.** Apple avait rejeté sur la guideline 5.1.1(v) parce que
  l'app s'ouvrait sur l'écran de connexion. C'est corrigé : parcourir les restaurants et
  remplir un panier ne demande aucun compte. Google n'a pas de règle aussi stricte, mais
  l'écrire évite au relecteur de chercher.

⚠️ **Prévoir que quelqu'un traite les commandes pendant la relecture.** Le relecteur Apple a
passé de **vraies commandes** chez Angelo (TF-47, TF-48). Si une commande arrive et que
personne ne la confirme, le parcours paraît cassé — et c'est le genre de chose qui se solde
par un rejet difficile à comprendre après coup.

---

## 6. Ce qui reste à faire, dans l'ordre

- [x] **Débloquer le compte** — vérifications appareil, identité, téléphone : les trois
      passées au **2026-08-31** (voir [SOUMISSION-ANDROID.md](SOUMISSION-ANDROID.md))
- [x] **Convertir en compte organisation** pour échapper aux 12 testeurs — ✅ fait le
      **2026-08-31**, la règle des 12 testeurs ne s'applique plus (⏳ 72 h avant de pouvoir
      soumettre)
- [ ] **Changer le « Developer name »** de `christopher techer` en `Rentanoo` — c'est le nom
      d'éditeur affiché publiquement sous l'application
- [ ] Créer l'application dans le Play Console
- [ ] Clé de compte de service : Play Console › Configuration › Accès à l'API › Comptes de
      service → télécharger le JSON → le poser en `app/google-play-service-account.json`
      (déjà couvert par `.gitignore`, **ne jamais le committer**)
- [ ] Premier build `production` Android — en **interactif**, par Christopher, même règle que
      pour iOS
- [ ] `eas submit -p android` — la configuration est prête dans `app/eas.json`, elle envoie
      d'abord sur le canal **interne** en **brouillon**, jamais directement en production

---

## État de la fiche au 2026-08-31

### ✅ Fait

- **Application créée** — `4972795001003481903`, package `com.chris97416.taxifoodnosybe`,
  Taxi Food · Français (France) · Application · Gratuite
- **Test interne en ligne** — release **4 (1.1.0)**, canal `4700730027165144358`,
  lien d'inscription https://play.google.com/apps/internaltest/4700730027165144358
- **Fiche par défaut (fr-FR), textes enregistrés en brouillon** : nom, description courte
  (67/80), description complète reprise telle quelle de FICHE-APP-STORE.md § 1

### ⛔ Ce qu'un agent ne peut pas faire ici

**Les trois zones de visuels passent par un sélecteur de fichiers natif.** Le bouton
« Add assets » ouvre un panneau interne dont le champ `input[type=file]` n'est pas exposé
dans l'arbre d'accessibilité ; le bouton « Upload » déclenche la boîte de dialogue macOS,
que les outils navigateur ne pilotent pas. À faire à la main, depuis
`docs/captures-play-store/` :

| Zone | Fichier |
|---|---|
| App icon | `00-icone-512x512.png` |
| Feature graphic | `00-image-presentation-1024x500.png` |
| Phone screenshots | `01-accueil.png` … `06-suivi.png` (les six) |

### ⏳ Déclarations restantes (Policy and programs → App content)

Ce sont des **déclarations engageantes**, à remplir par le porteur du projet — même nature
que les cases cochées à la création de l'application :

- Politique de confidentialité (URL)
- Accès à l'application — ⚠️ fournir les **trois** comptes, § 5
- Publicités : **non**
- Data Safety — tableau de correspondance prêt, § 3
- Classement IARC — ⚠️ **déclarer l'alcool**, § 4
- Public cible et contenu

### ⚠️ Deux incohérences à trancher

1. **Les captures montrent l'ancien vouvoiement** (voir plus haut). Elles sont téléversables
   telles quelles pour débloquer, mais à refaire depuis la 1.1.0 installée.
2. **La description complète vouvoie** (« Choisissez votre restaurant… vous savez »), alors
   que la règle du 2026-08-24 tutoie côté client. Elle est reprise mot pour mot de la fiche
   App Store, **déjà publiée et validée** : la changer ici seul ferait diverger les deux
   magasins. À harmoniser sur les deux à la fois, ou à assumer comme registre marketing.


---

## Déclarations de contenu — état au 2026-08-31

### ✅ Faites

| Déclaration | Réponse retenue |
|---|---|
| Politique de confidentialité | `https://taxifood.rentanoo.com/confidentialite/` |
| **Identifiants de connexion** | les **trois** comptes (client, restaurant, livreur), chacun avec une note en anglais |
| Publicité | aucune |
| Fonctionnalités financières | **aucune** — inchangé, voir la note ci-dessous |
| Apps gouvernementales | non |
| Santé | aucune |
| Public cible | **18 ans et plus** |
| **Classement de contenu (IARC)** | catégorie *All Other App Types*, **alcool déclaré** |

⚠️ **« Fonctionnalités financières : aucune » reste la bonne réponse après Stripe.** Cette
déclaration vise les apps qui *fournissent* un produit ou service financier. Les cinq
catégories du formulaire sont : banque et prêts · paiements et transferts · accords d'achat
(fidélité, paiement fractionné) · trading et fonds · services de support (score de crédit,
conseil, assurance)
([Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271)).
Encaisser le prix de ses propres repas n'entre dans aucune : *« apps that receive payments do
not automatically need to select "Money transfer and wire services" — those are intended for
banking apps »*. **Ne pas cocher « paiements et transferts » par excès de prudence** : cela
déclencherait des exigences documentaires (licences, agréments) qu'on ne peut pas satisfaire,
et bloquerait la fiche.

#### Ce qui a été répondu au questionnaire IARC

| Question | Réponse | Raison |
|---|---|---|
| Contenu sensible dans le paquet téléchargé | non | |
| Échange de contenu entre utilisateurs | non | pas de messagerie dans l'app |
| Contenu en ligne hors téléchargement | **oui** | le catalogue vient du serveur, cas « product listings » |
| Violence / Sexualité / Langage | non | |
| Substances contrôlées (drogues illégales) | non | l'alcool relève de la section suivante |
| Produits à limite d'âge | **oui**, dont **alcool** | 19 références de bière au catalogue |
| **Partage de la position précise avec d'autres utilisateurs** | **oui** | le livreur reçoit les coordonnées GPS du client — c'est le cœur du produit |
| Achat de biens numériques | non | **biens physiques préparés et livrés**, jamais de contenu numérique — la réponse ne dépend pas du moyen de paiement |
| Récompenses / crypto / NFT, navigateur, actualités | non | |

⚠️ **Le formulaire IARC n'offre que trois catégories** — Jeu, Social, *All Other App Types*.
La mention « Achats et vente au détail » écrite plus haut dans cette fiche **n'existe pas**.

⚠️ **Piège du formulaire** : le bouton **Next** reste grisé tant qu'on n'a pas cliqué
**Save** au moins une fois, même quand toutes les sections affichent « Completed ».

### ✅ Data safety — terminé le 2026-08-31

Le formulaire réinitialisait la page à chaque premier essai (URL de suppression, empreintes)
mais a fini par tenir une fois relancé proprement. Les huit types déclarés à l'étape « Data
types » :

| Catégorie | Type(s) | Obligatoire |
|---|---|---|
| Location | Precise location | oui |
| Personal info | Name, Email address, User IDs, Address, Phone number | oui (les 5) |
| Financial info | Purchase history | oui |
| Device or other IDs | Device or other IDs (jeton push) | **non** — l'utilisateur choisit |

⚠️ **Ces huit types restent les bons après l'arrivée du paiement par carte.** Aucun type ne
s'ajoute côté Google : *User payment info* tombe sous l'exception « prestataire de paiement »
détaillée au § 3. Le formulaire n'a donc **rien à rouvrir** pour ce chantier — c'est la
principale différence de charge avec le dossier Apple.

Pour chaque type, à l'étape « Data usage and handling » : **Collected** (jamais Shared),
**non éphémère** (stocké en base), finalité **App functionality** uniquement. Aperçu final
confirmé : *« No data shared with third parties »*, et le lien de suppression apparaît
correctement : *« You can submit a request to delete your account and associated data for
this app https://taxifood.rentanoo.com/suppression-compte/ »*.

⚠️ **La question « Purchase history »** n'est pas sous « App activity » comme on aurait pu
le croire, mais sous **« Financial info »** — c'est là qu'est l'historique des commandes,
malgré l'absence de toute donnée bancaire.

### ✅ Catégorie et coordonnées — terminé le 2026-08-31

Store settings → App category : **Food & Drink**. Store listing contact details : e-mail
`techerchristopher@gmail.com`, téléphone `+261373437912`, site `https://taxifood.rentanoo.com`.
Publié immédiatement (le formulaire n'attend pas l'envoi global de la fiche).

### ⏳ Restant — à faire à la main

**Les visuels de la fiche** — icône, image de présentation, six captures. Champ de fichier
natif, non automatisable. ⚠️ Prendre les fichiers de `docs/captures-play-store/`, **jamais**
ceux de `captures-app-store/` : les captures iPhone font 2,17 : 1 et seraient refusées.

**C'est la dernière déclaration.** Une fois les visuels déposés, les onze tâches de la
fiche « Set up your app » seront complètes et « Send app for review » deviendra actionnable
depuis Publishing overview.
