# Soumission à Apple — ce qu'il reste à faire

Audit du dépôt contre les règles d’Apple. Créé le 2026-08-18 (build 10), **mis à jour le
2026-08-19 (build 17)** : voir le tableau d’état en fin de document pour ce qui reste. Les points marqués
« vérifié » ont été constatés dans le code ou la configuration ; les autres relèvent des
règles publiques d'Apple et devront être confirmés au moment de la soumission.

## D'abord, corriger une idée reçue

Le test externe n'est **pas** une étape obligatoire avant la mise en vente. Ce sont deux
revues différentes :

| | Revue bêta (test externe) | Revue App Store (mise en vente) |
|---|---|---|
| Quand | avant d'ouvrir TestFlight à des gens hors de ton équipe | avant publication publique |
| Sévérité | allégée — surtout plantages, contenu, connexion | complète — toutes les règles |
| Délai | souvent < 24 h, parfois 48 h | 24 h à plusieurs jours, avec allers-retours |
| Rejet | bloque le test externe | bloque la sortie |

Le test **interne** (ton amie ajoutée à ton équipe) ne passe par **aucune revue** : c'est
immédiat. C'est la bonne voie pour un test tout de suite.

En revanche l'intuition est juste sur un point : la revue bêta est une **répétition
générale**. Les bloquants ci-dessous feront rejeter les deux. Autant les traiter une fois.

## A. Bloquants dans le code

Ces quatre points provoquent un rejet quasi certain. Aucun n'est un détail de forme.

### A1. Sign in with Apple — ✅ FAIT (2026-08-18, build 13)

La règle 4.8 impose, dès qu'un service de connexion tiers est proposé, d'offrir en parallèle
une option équivalente respectant la vie privée. Avec un bouton Google **et** un bouton
Facebook, c'était le motif de rejet le plus probable.

Implémenté en **natif** (`expo-apple-authentication` → `signInWithIdToken`), bouton officiel
d'Apple placé en premier sur l'écran de connexion, provider activé côté Supabase (bundle ID
dans *Client IDs*). Le nom, qu'Apple ne transmet qu'à la toute première connexion, est
recopié immédiatement dans `profiles` — sinon il serait perdu définitivement.

⚠️ L'entitlement `usesAppleSignIn` exige un build **interactif** pour que EAS le déclare côté
portail Apple. Testé sur appareil réel : identité `provider='apple'` créée en base.

### A2. Suppression de compte — ✅ FAIT (2026-08-18)

Entrée « Supprimer mon compte » en bas du Profil, avec double confirmation. RPC
`delete_my_account()`, qui n'agit que sur `auth.uid()` — aucun paramètre, donc aucun moyen
de viser le compte d'un autre.

**Les commandes sont anonymisées, pas supprimées.** `orders.user_id` et
`orders.address_id` passent à NULL. Sans ça, supprimer un compte effaçait son historique en
cascade et faussait rétroactivement le rapport de clôture et les reversements aux
restaurants. Deux migrations ont été nécessaires : rendre ces colonnes nullables et passer
leurs clés étrangères en `ON DELETE SET NULL`.

Refusé tant qu'une livraison est en cours, sinon la commande resterait bloquée sans livreur.

Vérifié sur la vraie base avec deux comptes jetables (transactions annulées, rien conservé) :
compte, profil, adresse, jeton push et rôles supprimés ; commande conservée avec son montant,
`user_id` et `address_id` à NULL ; et refus effectif quand une livraison est en cours.

<details>
<summary>Le texte d'origine de ce point</summary>

### A2 (avant correction) — règle 5.1.1(v)

**Vérifié** : l'écran Profil propose téléphone, e-mail, adresses, notifications, aide,
langue, espace partenaire et déconnexion. **Aucune suppression de compte.**

Toute app permettant de créer un compte doit permettre de le supprimer **depuis l'app**,
sans passer par un formulaire ou un e-mail. C'est obligatoire depuis 2022 et vérifié
systématiquement.

Travail : une entrée « Supprimer mon compte » dans le Profil, avec confirmation, et côté
serveur une fonction qui supprime le compte Auth. Attention aux commandes déjà passées :
elles portent `orders.user_id` — il faudra décider entre anonymisation et suppression en
cascade, sachant que le rapport de clôture admin s'appuie dessus.

</details>

### A3. Connexion par téléphone visible mais inopérante — règle 2.1

**Vérifié** : l'écran de connexion propose « Continuer avec un numéro », qui appelle un
service WhatsApp dont les identifiants Meta ne sont pas posés. La fonction répond
`500 whatsapp not configured`.

Un bouton bien en vue qui échoue est une fonctionnalité cassée. Le relecteur la testera.

Deux issues : finir la configuration WhatsApp (voir [OTP-WHATSAPP.md](OTP-WHATSAPP.md)),
ou masquer le bouton jusque-là. La seconde est gratuite et immédiate.

### A4. Bouton Facebook — ✅ FAIT (2026-08-19, build 17)

Le diagnostic d'origine (variable `EXPO_PUBLIC_FACEBOOK_APP_ID` absente du profil
`production`) n'était que la première couche. Trois causes empilées, toutes levées :

1. la variable d'environnement manquante, posée dans les trois profils de `eas.json` ;
2. la permission `email` absente côté Meta (*Use Cases → Authentication and Account
   Creation*, écran distinct de la configuration du produit Facebook Login) — et une app déjà
   autorisée par un compte ne redemande pas les nouvelles permissions, il a fallu la révoquer
   dans *Facebook → Applications et sites web* ;
3. le mode de connexion : `signInWithIdToken` attend un **jeton OIDC signé**, pas le jeton
   d'accès de l'API Graph. C'est donc le mode **« Limited Login »** qu'il faut, avec un
   **nonce** — l'inverse de ce que le guide Facebook de Supabase laisse croire. Symptôme
   trompeur : le SDK réussissait tout son échange, et Supabase rejetait silencieusement avec
   « Bad ID token », visible seulement après avoir fait remonter le message brut à l'écran,
   les journaux Supabase étant en panne prolongée.

**Confirmé sur appareil réel** : une identité `provider='facebook'` existe désormais en base.
Détail technique complet dans la section Auth de `CLAUDE.md`.

## B. Décision à prendre : iPad

**Vérifié** : `app.json` porte `ios.supportsTablet: true`.

Conséquence : Apple teste l'app sur iPad et **exige des captures d'écran iPad**. Or aucun
écran n'a été pensé pour cette taille, et l'espace restaurant comme l'espace livreur y
seront très étirés.

Deux options :
- passer `supportsTablet` à `false` — plus rapide, l'app reste installable sur iPad en mode
  iPhone, et Apple ne demande plus de captures iPad ;
- assumer l'iPad : revoir les mises en page et produire les captures.

Pour une V1, la première option est la raisonnable.

## C. À préparer hors du code

Rien de tout ça n'est du développement, mais rien ne part sans.

| Élément | État | Note |
|---|---|---|
| **Compte de démonstration** | à créer | e-mail + mot de passe, jamais Google : le relecteur ne peut pas utiliser ton compte Google. À donner dans le formulaire, avec le mode d'emploi (« choisir Je commande, commander chez Angelo ») |
| **Politique de confidentialité** | ✅ en ligne | https://taxi-food-nosybe.netlify.app/confidentialite.html |
| **URL de support** | ✅ en ligne | https://taxi-food-nosybe.netlify.app/support.html |
| **Questionnaire App Privacy** | à remplir | déclarer : identité, coordonnées, **localisation précise**, historique d'achat. Une déclaration incomplète est un motif de rejet à part entière |
| **Classement d'âge** | à remplir | questionnaire dans App Store Connect |
| **Captures d'écran** | à produire | format iPhone 6,9" obligatoire ; iPad seulement si tu gardes `supportsTablet` |
| **Description, sous-titre, mots-clés** | à écrire | doivent décrire l'app réelle — règle 2.3 |
| **Icône 1024 px** | ✅ présente | |

## D. Points de vigilance métier

- ~~Les prix en base sont inventés~~ — **faux, corrigé le 2026-08-19.** Le catalogue est
  **réel** : les menus, compositions et prix des trois restaurants viennent de vraies cartes
  photographiées (bucket Storage `MENU`), confirmé par le porteur du projet. L'audit initial
  transposait par erreur une convention du projet voisin `addition-appli`, qui lui a bien un
  jeu de test. Rien à faire ici, et aucun risque au titre de la règle 2.3.
- **Le relecteur passera une vraie commande.** Elle arrivera sur l'écran restaurant d'Angelo
  et déclenchera de vraies notifications. Il faut que quelqu'un puisse la traiter pendant la
  revue, sinon le parcours reste bloqué et l'app est jugée non fonctionnelle.
- **Pas d'achat intégré à prévoir** : l'app vend des biens physiques livrés, la règle 3.1.1
  n'impose donc pas le paiement Apple. Le paiement en espèces à la livraison est conforme.

## E. Déjà conforme

- **Chiffrement** : `ITSAppUsesNonExemptEncryption: false` déclaré dans `app.json` —
  évite le questionnaire export à chaque envoi. **Vérifié**.
- **Localisation** : le texte d'autorisation est explicite et honnête (« Taxi Food utilise ta
  position pour enregistrer précisément ton adresse de livraison »). Apple rejette les
  formulations vagues ; celle-ci convient. **Vérifié**.
- **Notifications** : l'app reste utilisable si l'utilisateur les refuse — Apple l'exige.
  **Vérifié** : `registerForPush()` ne lève jamais et n'empêche aucun parcours.

## État au 2026-08-19 (build 17)

| Point | État |
|---|---|
| A1 — Sign in with Apple | ✅ fait, testé sur appareil |
| A2 — Suppression de compte | ✅ fait, vérifié en base |
| A3 — Connexion téléphone cassée | ❌ **seul bloquant de code restant** — voir ci-dessous |
| A4 — Bouton Facebook cassé | ✅ fait, testé sur appareil (identité créée en base) |
| B — iPad | ✅ `supportsTablet: false` |
| D — Prix réels | ✅ le catalogue est réel, rien à faire |
| Politique de confidentialité + page d'aide | ✅ en ligne |
| C — Fiche App Store | ⏳ à produire (textes, captures, questionnaires) |

**Le seul bloquant de code restant est A3.** Les secrets WhatsApp ne sont **pas** posés dans
le Vault (vérifié : 0 secret le 2026-08-19), donc le bouton « Continuer avec un numéro »
échoue toujours. Deux issues, au choix :

- **masquer le bouton** tant que WhatsApp n'est pas configuré — gratuit, immédiat, débloque
  la soumission. Les quatre autres modes de connexion (Apple, Google, Facebook, e-mail)
  couvrent tous les cas ;
- **finir la configuration WhatsApp** (procédure dans [OTP-WHATSAPP.md](OTP-WHATSAPP.md)) —
  demande les identifiants Meta et l'approbation d'un modèle de message.

Une fois A3 tranché, il ne reste que la **fiche App Store** (partie C), qui ne demande aucun
build.
