# Soumission à Apple — ce qu'il reste à faire

Audit du dépôt au 2026-08-18 (build 10) contre les règles d'Apple. Les points marqués
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

### A1. Sign in with Apple absent — règle 4.8

**Vérifié** : aucune trace d'Apple dans le code d'authentification, alors que l'app propose
**Google et Facebook**. La règle 4.8 impose, dès qu'un service de connexion tiers est
proposé, d'offrir en parallèle une option équivalente respectant la vie privée — en
pratique, Sign in with Apple.

Une connexion e-mail + mot de passe qu'on opère soi-même peut théoriquement passer pour
l'équivalent exigé (données limitées au nom et à l'e-mail, pas de suivi publicitaire), mais
c'est une appréciation du relecteur, pas une garantie. Sur une app qui affiche un bouton
Google **et** un bouton Facebook, c'est le motif de rejet le plus fréquent.

Travail : `expo-apple-authentication` + activation du provider Apple côté Supabase +
bouton sur l'écran de connexion. Nécessite un compte développeur payant, ce qui est déjà
le cas.

### A2. Suppression de compte absente — règle 5.1.1(v)

**Vérifié** : l'écran Profil propose téléphone, e-mail, adresses, notifications, aide,
langue, espace partenaire et déconnexion. **Aucune suppression de compte.**

Toute app permettant de créer un compte doit permettre de le supprimer **depuis l'app**,
sans passer par un formulaire ou un e-mail. C'est obligatoire depuis 2022 et vérifié
systématiquement.

Travail : une entrée « Supprimer mon compte » dans le Profil, avec confirmation, et côté
serveur une fonction qui supprime le compte Auth. Attention aux commandes déjà passées :
elles portent `orders.user_id` — il faudra décider entre anonymisation et suppression en
cascade, sachant que le rapport de clôture admin s'appuie dessus.

### A3. Connexion par téléphone visible mais inopérante — règle 2.1

**Vérifié** : l'écran de connexion propose « Continuer avec un numéro », qui appelle un
service WhatsApp dont les identifiants Meta ne sont pas posés. La fonction répond
`500 whatsapp not configured`.

Un bouton bien en vue qui échoue est une fonctionnalité cassée. Le relecteur la testera.

Deux issues : finir la configuration WhatsApp (voir [OTP-WHATSAPP.md](OTP-WHATSAPP.md)),
ou masquer le bouton jusque-là. La seconde est gratuite et immédiate.

### A4. Bouton Facebook cassé dans les builds de production — règle 2.1

**Vérifié** : `facebookConfigured()` teste `EXPO_PUBLIC_FACEBOOK_APP_ID`, et cette variable
**n'est pas** dans le profil `production` de `eas.json` (qui ne porte que l'URL Supabase,
la clé publique et l'identifiant Google). Dans le build livré, le bouton Facebook affiche
donc un message d'erreur.

Même problème que A3, même choix : poser la variable, ou retirer le bouton.

À noter : régler A4 en posant la variable **aggrave** A1, puisque cela confirme deux
connexions tierces sans Sign in with Apple.

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
| **Compte de démonstration** | à créer | e-mail + mot de passe, jamais Google : le relecteur ne peut pas utiliser ton compte Google. Le build 10 permet enfin d'en créer un. À donner dans le formulaire, avec le mode d'emploi (« choisir Je commande, commander chez Angelo ») |
| **Politique de confidentialité** | à écrire | URL publique obligatoire. L'app collecte nom, e-mail, téléphone, **position précise** et historique de commandes |
| **URL de support** | à créer | une page ou un lien de contact suffit |
| **Questionnaire App Privacy** | à remplir | déclarer : identité, coordonnées, **localisation précise**, historique d'achat. Une déclaration incomplète est un motif de rejet à part entière |
| **Classement d'âge** | à remplir | questionnaire dans App Store Connect |
| **Captures d'écran** | à produire | format iPhone 6,9" obligatoire ; iPad seulement si tu gardes `supportsTablet` |
| **Description, sous-titre, mots-clés** | à écrire | doivent décrire l'app réelle — règle 2.3 |
| **Icône 1024 px** | ✅ présente | |

## D. Points de vigilance métier

- **Les prix en base sont inventés** (jeu de test). Une app de livraison affichant des prix
  fantaisistes tombe sous la règle 2.3 (métadonnées trompeuses). À remplacer par les vrais
  avant soumission — c'est de toute façon indispensable pour ouvrir le service.
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

## Ordre conseillé

1. A3 et A4 — masquer les deux boutons cassés. Une heure, débloque la revue bêta.
2. B — passer `supportsTablet` à `false`. Deux minutes.
3. A2 — suppression de compte. C'est le plus long des quatre, à cause de la décision sur
   les commandes existantes.
4. A1 — Sign in with Apple.
5. C — les éléments hors code, en parallèle du développement.
6. D — les vrais prix, juste avant de soumettre.

Les points 1 et 2 suffisent probablement à passer la **revue bêta** et donc à ouvrir le test
externe. Les points 3 et 4 sont indispensables pour la **mise en vente**.
