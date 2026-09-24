# Taxi Food — Livraison de repas (Nosy Be)

Marketplace de livraison de repas à Nosy Be. **App cliente construite et fonctionnelle**, branchée sur le vrai backend Supabase. **Huit restaurants en base** au 2026-09-17 : deux ouverts à la commande (La Cabane, Chez Bidul & Truc), quatre « en négociation » (Les Siciliens, Madame Oh, Oh Hazar, La Plage), deux masqués (Angelo, et Taxi Be depuis le 2026-09-17) — voir « Les vrais restaurants ». Branche de travail : `main`.

Trois livrables distincts, à ne pas confondre :

| | Quoi | Où |
|---|---|---|
| **`app/`** | l'application mobile (Expo, iOS + Android) | **en ligne sur l'App Store ET le Play Store** |
| **`admin/`** | le tableau de bord de gestion (Next.js, web) | `taxi-food-admin-nosybe.netlify.app` |
| **`landing/`** | le site de **pré-lancement**, trilingue | **`taxifoodnosybe.distripro207.com`** |

## 🧭 Reste à faire — état au 2026-09-17

Liste unique, à tenir à jour. Le détail de chaque point vit dans sa section.

**Bloquant ou risqué**
- 🔓 **Fuite de confidentialité ouverte** : avec la seule clé publiable, n'importe qui lit
  `restaurants.commission_rate` et `telegram_chat_id`. La fermeture par privilèges de colonne a
  **cassé l'app** (colonnes calculées) et a été annulée. Voie qui marchera : table privée.
  → section « Fuite connue ».
- 🗑️ **Supprimer depuis le tableau de bord Supabase** la fonction Edge jetable
  `upload-plats-du-jour-bidul` — encore ACTIVE (vérifié le 2026-09-17). Sa version 1 portait la
  `service_role`. L'API MCP ne sait pas supprimer une fonction.

**Mesure et référencement**
- (Facultatif) propriété Search Console pour l'app web `taxifood.distripro207.com`.

**Nouveaux chantiers (demandés le 2026-09-17)**
- ✅ **Taxi Be retiré du catalogue** (2026-09-17) : `hidden` en base (migration
  `20260917140000_taxi_be_quitte_le_catalogue`), vitrine redéployée (bloc de repli nettoyé, logos
  supprimés), pages de partage `/r/ /j/ /p/` d'un restaurant `hidden` → accueil (vérifié : 302),
  écrans `restaurant/[id]` et `product/[id]` → « introuvable » sauf pour le personnel du restaurant.
  ⚠️ **`demo.resto@taxifood.mg` reste rattaché à Taxi Be** (espace restaurant intact, invisible des
  clients) — décision à valider, et **son espace est vide** (0 commande) : voir
  `docs/FICHE-APP-STORE.md` § 4 avant la prochaine soumission.
- 🔄 **Dernière version dès le premier lancement** — code écrit (`app/lib/miseAJour.ts`, voir sa
  section), publié en OTA le 2026-09-17 sur les runtimes 1.2.2 et 1.2.1. ⚠️ Il ne protège les
  **nouvelles installations** qu'une fois dans le binaire : build **1.2.3** (voir « Où en est la
  soumission »). **Non vérifié sur un vrai téléphone** : installation fraîche → doit ouvrir
  directement la dernière version (≤ 5 s d'écran de lancement en plus).
- ☎️ **Commande par téléphone** — ✅ livrée dans l'admin le 2026-09-17 (onglet « ☎ Commande tél. »,
  voir sa section). **Aucune vraie commande passée** : testée en transaction annulée seulement
  (un test réel aurait réveillé Chez Bidul & Truc). Première vraie commande à surveiller :
  message Telegram du restaurant = nom et numéro du CLIENT, pas ceux du porteur du projet.
  Décision à valider : commande rattachée au compte admin. **GPS facultatif depuis le
  2026-09-17** (retour du porteur du projet), repère obligatoire.
- 📱 **Puces de catégories en retour à la ligne** sur la page restaurant (2026-09-17) : OTA + web
  livrés, vérifié à 375 px sur l'export web.

**🌴 La Plage — EN LIGNE (`visible`) depuis le 2026-09-17**, à la demande du porteur du projet
- ✅ Horaires en base (`restaurant_hours`) : fermé le lundi, mar.–dim. 10:00–15:00 et 18:00–22:00.
- ✅ Telegram en **groupe** « Taxi Food - La Plage » (patron + cuisinier), `telegram_chat_id =
  -1004301209124` (supergroupe, identifiant stable). Commande test TF-242 acceptée depuis le groupe
  en moins d'une minute, puis TF-242/243/244 (tests) **supprimées**. Message de bienvenue envoyé.
- ✅ Comptes rattachés (Google, sans mot de passe) : `laplagehellville.nosybe@gmail.com` (patron,
  inscrit seul le 14/09, rattaché par `inviter_restaurateur`) et `davidantoniods35@gmail.com`
  (pré-autorisé, rattaché à sa 1re connexion). Jetons push enregistrés (Android + iOS) ; aucune
  notification push encore observée chez eux.
- ✅ Commission **7 %** (décision du porteur du projet, 2026-09-17).
- ✅ Livraison **10 000 Ar**, zone « Nosy Be », téléphone +261 32 71 548 96 (2026-09-17).

**🥢 Chez M&K (en négociation depuis le 2026-09-21)** — `56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53`,
restaurant chinois, Djabala Honko, +261 37 19 861 96 (Kenny). 28 plats, 7 catégories, 9h–22h 7j/7
(une ligne par jour), **10 %** (corrigé le 2026-09-22, 5 % à la création), 10 000 Ar, `auto_open = false`, `is_open = false`. Carte et photos :
`partenaire /M&K/` (dossier ignoré par git). Migration `20260921100000_…` : tout y est expliqué.
Réponses de Kenny versées le 2026-09-21 (migrations `…120000` et `…121000`) : riz / pâtes
inclus au choix sur les 12 plats principaux ; ti pan mixte = poulet + bœuf, sans porc ; soupes,
riz cantonais et mi sao **« Avec porc / Sans porc » en option obligatoire** (le client choisit, pas
de badge) ; fondue 24 h à l'avance, 2 pers. minimum (reste indisponible) ; Coca / Sprite petit
modèle 8 000, bière en canette 10 000 (marques à demander) ; pas de dessert.
✅ Telegram (2026-09-22) : groupe « Taxi food - chez mk », `telegram_chat_id = -1004341065622`
(supergroupe, identifiant stable), message de test remis. Commande test à faire à l'ouverture.
Reste AVANT `visible` : photo du **bol renversé fruits de mer** (envoyée sur WhatsApp, pas encore
déposée) ; ingrédients des autres plats ; adresse exacte et logo détouré ; **photos tirées
d'Internet** (riz cantonais avec le filigrane « petitsplatsentreamis.com », et d'autres).
⚠️ `est_boisson` est déduit du NOM de catégorie : seuls « Bières » et « Softs » comptent.
Une catégorie « Boissons » est comptée comme de la nourriture. ⚠️ **Limite produit** : `diet_tags` vit sur le produit — nem, bouchon et
bol renversé ont le porc en OPTION, sans badge possible.

**Madame Oh et Oh Hazar (en négociation), AVANT tout passage en `visible`**
- Commission par défaut **15 %**, livraison **0 Ar**, zone et **horaires vides**, aucun canal Telegram.
- À confirmer par les restaurateurs : prix réels du poisson entier, du mi xao et de la soupe
  chinoise (créés **indisponibles**, « à partir de 29 000 ») ; plats qui reçoivent les
  accompagnements ; tajine de poisson (photo **chermoula**, mais options pruneaux / citron confit) ;
  photos = reconstitutions, contenant des plats de La Plage.

**Produit et contenu**
- 🚪 **Fermeture en un geste livrée le 2026-09-20** (voir sa section). L'écran Réglages est vérifié
  en production. **Restent à constater** : le **tap** lui-même (fermer puis rouvrir, à faire une
  fois en service — non fait pour ne pas ouvrir La Cabane hors de ses horaires) et l'onglet
  **Temps réel** de l'admin (« Fermer maintenant » / « Rendre aux horaires »), jamais vu connecté.
- Page de partage `/r/<id>` d'un restaurant en négociation : dit encore « Commandez… » et montre
  « Commander maintenant ». À aligner sur « En négociation ».
- Chez Bidul : confirmer le contenant et les couches du boudin façon hachis ; constater à l'écran
  Réglages (compte restaurateur) que les 3 anciens plats du jour sont bien « dormants ».
- Partage Facebook sur **iPhone** (app installée) : correctif « attendre avant de fermer la feuille »
  non vérifié sur un vrai iPhone.
- Sélection d'essai `199877aa-3096-468a-8600-840efba83f15` (« Les plats du jour à Nosy Be ») encore
  active : la désactiver depuis l'onglet Sélections si inutile.
- Fiche App Store : le contact commerçant DSA publié porte l'**ancien** numéro `+261 37 34 379 12`
  (le site est passé au `+261 36 15 74 521` le 2026-09-10). ⚠️ Le modifier peut relancer une
  vérification Apple et retirer l'app des boutiques de l'UE le temps de l'examen.
- **Aucun moyen pour un client d'écrire en laissant une trace** : « Contactez-nous » = lien WhatsApp,
  l'espace client n'a pas de messagerie, et le formulaire « Être rappelé » (restaurateurs) n'avait
  reçu qu'un test au 2026-09-16. Un client disant avoir « envoyé un message » a écrit par WhatsApp
  ou e-mail — hors base. Piste ouverte : un vrai formulaire de contact enregistré + notifié n8n.

- ⏱️ **Préparation automatique** (2026-09-22, voir sa section) : livrée base + OTA + web + vitrine.
  Reste à constater sur une vraie commande, et à dire aux restaurateurs.

**Codes offerts** (voir leur section) : identifiant n8n à coller, ligne Telegram « Repas offert »,
test `MERCISULLI` avec Sulli.

## Où en est la soumission

**Au 2026-09-17 (catalogue Apple relu en MG et FR, pas de mémoire) :**

| | Version | État |
|---|---|---|
| **Android** | **1.2.2** (versionCode 12) | ✅ **en ligne**, production, 177 pays |
| **iOS** | **1.2.2** (build 32) | ✅ **en ligne** depuis le 2026-09-15 23:23 UTC (Madagascar ET France) |

**Build 1.2.3 (2026-09-17)** — iOS **build 33** (`03784765-bd6a-4fdb-a731-704b55c259f5`) envoyé à
App Store Connect / TestFlight (soumission EAS `7a2519b4…`, FINISHED) ; Android **versionCode 13**
(`40087104-13f6-4d83-a967-744b6208b351`) déposé sur la piste **interne** (soumission `ab841b19…`,
FINISHED). Commit `d842e50`, `git grep -i mvola` vide. `runtimeVersion` **1.2.2** (voir « Les
commandes »). ⏳ **Restent au porteur du projet** : recette sur appareil
(`docs/EN-ATTENTE-DE-BUILD.md`), puis soumission à la vérification Apple (textes et notes :
`docs/FICHE-APP-STORE.md` § 9) et promotion Play interne → production. Ni l'une ni l'autre n'est
faite.

Des téléphones restent en 1.2.1 tant qu'ils n'ont pas mis l'app à jour : les OTA partent donc
encore pour les **deux** runtimes.

✅ **CONFORMITÉ DSA VALIDÉE le 2026-09-15** (e-mail « Your trader contact information was
verified »). L'app était **absente des 27 boutiques de l'UE** depuis le lancement : des clients
français et réunionnais, physiquement à Nosy Be, lisaient « pas disponible dans votre pays ».
Vérifié après validation : présente en FR, BE, DE, IT, ES. ⚠️ **L'App Store regarde le pays du
COMPTE Apple, jamais l'endroit où se trouve le téléphone.** Détails et pièges du formulaire :
mémoire `statut-commercant-dsa-app-store-taxi-food`.

⚠️ **Deux mises à jour à distance sont publiées à chaque fois, une par runtime** (1.2.1 ET
1.2.2), tant que les deux versions coexistent en magasin — voir plus bas.

⚠️ **Les builds 26 et 27 sont des échecs, pas des versions** : le profil de provisioning
n'avait pas encore l'entitlement Apple Pay. Détail et remède dans `docs/PAIEMENT-STRIPE.md`
§ 12 — et la règle à retenir : **`eas build --non-interactive` ne régénère JAMAIS le profil**
après un changement de capacité Apple, il réutilise celui en cache et échoue à l'identique.

⚠️ **Ce qui a changé dans la fiche produit, et qui n'est pas anodin.** La déclaration de
confidentialité a gagné un 9ᵉ type de données : **Informations de paiement**
(*Fonctionnalité de l'app*, lié à l'identité, pas de suivi), parce que la carte se saisit
désormais dans la feuille Stripe **à l'intérieur de l'app**. Apple affiche une exemption qui
ne s'applique PAS ici — le raisonnement complet, à ressortir si c'est contesté, est dans
`docs/FICHE-APP-STORE.md` § 8.

⚠️ **Changer de build oblige à retirer la version de la vérification**, donc à repartir en
bas de la file. Les textes, eux, restent modifiables pendant l'attente.

⚠️ **À défaire dès qu'Apple valide** : les réglages posés pour le relecteur (restaurants
ouverts en permanence, Taxi Be rendu visible et renvoyé sur le Telegram du porteur du
projet). Tableau dans `docs/FICHE-APP-STORE.md` § 7. Les laisser en l'état fait de vrais
dégâts en exploitation.

**Historique.** La **1.0.0 (22)** est passée le 2026-08-24, après **deux rejets** du build 17 :

1. **Guideline 5.1.1(v)** — « the app requires users to register before viewing the menu ». L'app s'ouvrait sur l'écran de connexion. Corrigé : le catalogue est désormais libre, voir la section « Navigation libre » plus bas. C'est le changement de comportement le plus important de tout le projet.
2. **Guideline 2.1(a)** — « we cannot access the Restaurant and Courier accounts ». Un seul compte de démo était fourni, et les notes disaient que les espaces pro étaient hors périmètre. **Apple veut vérifier CHAQUE type de compte.** Trois comptes actifs sont maintenant fournis.

⚠️ Le relecteur teste sur **iPad** (iPad Air 11-inch M3 sur les deux revues), en mode compatibilité iPhone puisque `supportsTablet: false`. Il a aussi passé de **vraies commandes** chez Angelo (TF-47, TF-48, depuis une adresse Apple private relay) : pendant une revue, quelqu'un doit pouvoir traiter une commande qui arrive, sinon le parcours paraît cassé.

**Android — ✅ PUBLIÉE SUR LE PLAY STORE le 2026-09-08.** Constaté moi-même en console,
pas rapporté : *« Last published on September 8, 2026 »*, plus aucun bloc « Changes in
review », et la fiche répond **HTTP 200** :
`https://play.google.com/store/apps/details?id=com.chris97416.taxifoodnosybe`

**La revue a duré 7 jours** (déposée le 1er septembre à 2 h 13). C'est la normale pour un
**premier** passage : le dossier complet part en examen manuel — classification du contenu,
sécurité des données, public cible 18 ans et plus, déclaration publicitaire, applications
gouvernementales et **fonctionnalités financières**, cette dernière étant la plus lente.

⚠️ **Ne pas s'alarmer avant 7 jours** la prochaine fois, et **ne rien modifier pendant** :
toucher un élément du dossier remet le compteur à zéro. Au-delà de 7 jours, le levier utile
est *Aide → Contacter l'assistance* dans la console, bien plus efficace que d'attendre.

⚠️ **Ce qui est publié aujourd'hui, c'est encore la 1.1.0 (build 4)** — sans paiement par
carte, sans les deux services par jour, sans le partage social, sans l'offre du jour.
**La 1.2.0 (build 5) a été testée en interne le 2026-09-08** (paiement carte confirmé,
Google Pay affiche son bouton mais reste bloqué par `OR_BIBED_11` tant que l'accès
production Google Pay n'est pas approuvé — voir `docs/PAIEMENT-STRIPE.md` § 12-13), puis
**envoyée en production le même jour** (« Promote release », sans re-téléverser le
fichier). Statut au moment d'écrire : *Changes in review*, jusqu'à 7 jours annoncés.

⚠️ **La règle des 12 testeurs ne s'applique pas, la question est close.** Le compte est un
**compte d'organisation** (vu en console : « Organization account », ID
`6682410097385681985`), pas un compte personnel. Ne plus la reposer.

⚠️ **Classement IARC** — Global Rating ID `e3a3d6e9-5f88-8f8f-8ef0-3f8d89a9dc4b`, mis en
ligne le 2026-09-08 en même temps que l'app. Le réutiliser tel quel sur tout autre magasin
ayant licencié IARC (Amazon, Galaxy Store) évite de refaire le questionnaire. ⚠️ Une version
qui **changerait les réponses** au questionnaire oblige à le repasser — à surveiller au dépôt
de la 1.2.0, même si vendre des repas livrés ne devrait rien changer (le questionnaire porte
sur le **contenu numérique**).

Toute la chaîne technique était prête et testée en conditions réelles le 2026-08-19 (Google
natif, Facebook en flux web, clé Maps, notifications FCM). Compte Google Play créé,
**identité vérifiée**, appareil Android physique disponible depuis le 2026-08-24.

### Les deux empreintes Android — ne jamais les confondre

| | SHA-256 | À quoi ça sert |
|---|---|---|
| **Clé de signature Google** (Play App Signing) | `9E:83:EC:47:51:33:B9:01:63:15:63:25:6D:E0:AD:55:DE:EF:FE:81:00:1D:F3:5C:7D:94:7B:AE:BB:CA:8C:74` | **C'est celle-ci** qu'il faut dans `assetlinks.json` |
| **Clé de dépôt** (EAS, keystore `Default`) | `02:05:17:F9:C3:DD:6E:15:1F:20:08:EC:C6:9E:85:9A:41:77:68:1A:DA:20:26:6A:FB:D4:10:9E:93:95:03:D4` | Signe l'AAB envoyé à Google, rien d'autre |

Google **re-signe** l'app avec sa propre clé après le dépôt : c'est donc la sienne que le
téléphone vérifie quand il décide d'ouvrir un lien `https://` dans l'app plutôt que dans le
navigateur. Mettre l'empreinte EAS ferait silencieusement tomber **tous** les liens partagés
dans le navigateur, et le symptôme est pénible à diagnostiquer (rien n'échoue, ça marche
« presque »). `assetlinks.json` acceptant plusieurs empreintes, on met **les deux**.

⚠️ **Utile à savoir** : la clé de signature Google est générée dès le **premier** dépôt d'un
bundle, pas à la validation — son empreinte est donc récupérable sans rien attendre.
Où la retrouver : **Play Console → Protected with Play → App signing**. La page affiche
même le `assetlinks.json` déjà rempli, prêt à copier. Package Android :
`com.chris97416.taxifoodnosybe`, identifiant d'app Play `4972795001003481903`.

✅ **Règle Google des testeurs — POINT TRANCHÉ le 2026-09-07.** Le compte est bien un
**compte d'organisation** (« Organization account », vu en clair en Play Console,
identifiant `6682410097385681985`). L'obligation de test fermé avec des testeurs pendant
14 jours continus ne vise que les comptes **personnels** créés après le 13 novembre 2023 :
elle **ne s'applique donc pas ici**. La conversion envisagée a bien été faite. Ce doute est
clos, ne plus le rouvrir.

⚠️ Le tableau de bord affiche quand même un parcours guidé « SET UP YOUR CLOSED TEST TRACK »
avec *Select testers* non coché. **Ce n'est pas un blocage** : c'est le fil d'accueil
générique de Play Console, et la production est déjà partie en revue à côté. Ne pas s'y
laisser prendre. Procédure : [docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md).

⚠️ **Cinq documents à tenir à jour, à lire avant de commencer quoi que ce soit :**

- **[docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md)** — ce qui est écrit mais pas encore compilé, et la recette à passer sur appareil avant l'envoi. Décision du 2026-08-18 : on empile les chantiers et on ne fait **qu'un seul gros build**, la liaison de Nosy Be rendant chaque envoi coûteux. À vider après chaque build.
- **[docs/SOUMISSION-APPLE.md](docs/SOUMISSION-APPLE.md)** — audit de conformité iOS, bloquant par bloquant.
- **[docs/FICHE-APP-STORE.md](docs/FICHE-APP-STORE.md)** — textes de la fiche, questionnaire App Privacy, classement d'âge, **et les notes de revue à coller** (§ 4, rédigées en anglais).
- **[docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md)** — état des lieux Android : ce qui est fait, ce qui est bloqué par du code, et ce qui l'est par un compte externe que seul le porteur du projet peut créer.
- **[docs/ONBOARDING-RESTAURATEUR.md](docs/ONBOARDING-RESTAURATEUR.md)** — **la procédure à rejouer telle quelle à chaque nouveau restaurant** : pré-autoriser l'adresse, créer le compte à la place du restaurateur (impossible en SQL — sas Edge temporaire, refermé aussitôt), vérifier le rattachement, brancher Telegram, et **finir par le message copier-coller à lui envoyer, avec le lien, l'adresse e-mail et le mot de passe**. ⚠️ Cette dernière étape est le livrable : un compte créé et non communiqué ne sert à rien. La création de la carte et des visuels, elle, est dans [docs/PARTENAIRES.md](docs/PARTENAIRES.md).

## Lancer l'app en local

```bash
npm run dev --prefix app        # équiv. `cd app && npx expo start`
npx expo start --web --port 8081 --prefix app   # aperçu web direct
```

⚠️ **Expo Go NE MARCHE PAS** : le projet est en **Expo SDK 57** (RN 0.86, React 19.2), plus récent que ce qu'Expo Go du store embarque → « projet incompatible ». Pour tester sur téléphone, il faut une **build de dev EAS** (voir `app/eas.json`), pas Expo Go.

⚠️ **`expo run:ios` : forcer la locale UTF-8.** Quand un nouveau module natif est ajouté, `pod install` se relance et CocoaPods plante sur `Unicode Normalization not appropriate for ASCII-8BIT` : Ruby lit le chemin du projet en binaire quand `LANG`/`LC_ALL` sont vides, ce qui est le cas par défaut dans un shell non interactif. Le piège est déroutant parce que le build ne casse **qu'à l'ajout d'une dépendance native**, jamais sur un rebuild ordinaire (les Pods déjà installés ne sont pas retouchés). Remède :

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device <udid>
```

- **Web** (aperçu rapide) : `http://localhost:8081`. L'accueil **est libre depuis le 2026-08-22** (voir « Navigation libre ») : on arrive directement sur le catalogue, sans compte.
- Comptes de démonstration : trois, créés pour la revue Apple — voir « Comptes de démonstration » plus bas.

## Stack & backend

- **Expo SDK 57** + expo-router (navigation par fichiers) + **zustand** (panier/checkout/session) + AsyncStorage.
- **Supabase** projet `bmdveawomizjpiebgtkj` (accès via le connecteur MCP claude.ai ; c'est un projet distinct des autres — voir aussi le projet frère `addition-appli`).
- **Clés** dans `app/.env` (git-ignoré, à recréer depuis `app/.env.example`) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé **publishable/anon**, publique par conception — RLS protège), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## Les vrais restaurants

État vérifié en base le 2026-09-17 : **huit** lignes dans `restaurants`. Dans l'ordre du
catalogue (`rang_catalogue`, voir « Ordre du catalogue ») :

| Rang | Restaurant | `listing_status` | id |
|---|---|---|---|
| 10 | La Cabane | visible | `958faac6-61ab-4ff5-9226-b8adab46ed24` |
| 20 | Chez Bidul & Truc | visible | `700e8f32-e966-476a-b371-02884d08dea1` |
| 30 | Les Siciliens | coming_soon | `aee1c612-5ee0-402b-a7b4-aec9c6825b0b` |
| 40 | Madame Oh (thaï, Hell-Ville) | coming_soon | `ba08c074-bc2f-4d0c-b087-ecdf7925269f` |
| 50 | Oh Hazar (marocain, Hell-Ville) | coming_soon | `c2a49e11-d839-459f-a332-024796102155` |
| 60 | La Plage (bistrot & bar, Hell-Ville) | coming_soon | `eb10f338-fb78-4c16-82d5-810ae37b49fe` |
| 70 | Angelo | hidden | `cb482596-b39e-4355-96a5-3dfdad75dcee` |
| 90 | Taxi Be — **retiré du catalogue le 2026-09-17** | hidden | `ac2766bb-c4d1-4f5e-9a40-3ea0febcb886` |

`coming_soon` s'affiche **« En négociation »** partout (app et vitrine) et n'est **jamais
commandable** : `commandable_maintenant()` exige `listing_status = 'visible'` — la garde est en base.

- **Chez Bidul & Truc** (`700e8f32-…`) — **visible**, et le seul en `auto_open = true` : son
  ouverture est déduite de ses horaires, pas d'un interrupteur. Deux services par jour, midi et
  soir, et une catégorie « Pizza » servie de 18 h à 22 h seulement — c'est lui qui a fait naître
  tout le chantier « heures de service » plus bas. **Carte entière ouverte le 2026-09-15**
  (migration `20260915074237_chez_bidul_ouvre_toute_sa_carte`) : les 6 catégories coupées le
  09/09 (Entrée, Plat, Pâtes, Tapas, Hamburger, Dessert) sont réactivées, `food_types` =
  Pizza, Pâtes, Burger, Tapas ; plage Pizza 18–22 h inchangée. **Offre du jour** (migration
  `20260915082305_chez_bidul_trois_plats_du_jour`) : Poulet basquaise, Blanquette de poisson,
  Tartare de zébu — 30 000 Ar, étiquette « Plat du jour », créations « À l'affiche » (sans
  catégorie, `in_menu = false`). **Depuis le 2026-09-16, ces trois-là DORMENT** dans la
  bibliothèque (`is_featured = false`, jamais archivés, photo intacte) et l'affiche porte
  **Pot-au-feu** et **Boudin noir façon hachis** (30 000 Ar, `sort_order` 4 et 5 — le bandeau suit
  `sort_order`), migrations `20260916150000_chez_bidul_pot_au_feu_et_boudin_a_l_affiche` et
  `20260916151000_…_photos`, photos déposées par `deposer-visuel`. ⚠️ **Ne jamais archiver un plat
  du jour** : `getFeaturedLibrary` filtre `is_archived = false`, il sortirait de la bibliothèque
  et le retour en un tap serait perdu. ⚠️ Sans catégorie, **aucune plage horaire** : `create_order`
  ne vérifie `categorie_servie_maintenant` que si le produit a une catégorie. Photos branchées le même jour (migration
  `20260915083553_chez_bidul_plats_du_jour_photos`, fichiers `produits/chez-bidul-truc/plat-*.png`,
  sources dans `visuels-reseaux/photos/`), déposées via la fonction Edge jetable
  `upload-plats-du-jour-bidul`, **neutralisée (410)** — ⚠️ à supprimer depuis le tableau de bord. Accompagnements
  identiques aux plats de la carte (migration `20260915084147_chez_bidul_plats_du_jour_accompagnements`,
  copiés depuis « Cuisse de poulet ») : « Accompagnement (1 au choix, inclus) » obligatoire +
  « 2e accompagnement (+5 000 Ar) » facultatif — Frites, Légumes sautés, Pâtes, Riz, Purée. Enseigne, logo et visuels branchés depuis
  `produits/chez-bidul-truc/divers`. ⚠️ **Sa couverture est un HEIC**, photo iPhone déposée
  telle quelle : Chrome et Android ne savent pas l'afficher, Safari si. Elle passe côté client
  parce que la fiche restaurant appelle `imageUrl()`, qui réécrit vers le **transformateur
  d'images Supabase** et rend un `image/jpeg`. `PhotoEditable`, dans l'écran Réglages du
  partenaire, affichait l'URL **brute** : le restaurateur voyait un cadre vide sur Android que
  ses clients, eux, ne voyaient pas. Corrigé le 2026-09-07 — tout passe par le transformateur.
- **La Cabane** — snacks. ⚠️ Son `chat_id` Telegram était celui du téléphone du porteur du
  projet, posé pendant les tests : **ses commandes nous arrivaient à nous**. Remplacé le
  2026-09-06 par son canal privé, message de contrôle et commande de test remis. La commande de
  test n'est pas une formalité : c'est elle qui a rattrapé le bug de la commande vide.
- **Les Siciliens** — `coming_soon` (« En négociation »).
- **Madame Oh, Oh Hazar, La Plage** — ajoutés le 2026-09-16 en `coming_soon` (migration
  `20260916131000_madame_oh_oh_hazar_et_la_plage_s_annoncent`) : 14, 8 et 38 plats, 60 photos
  `produits/madame-oh|oh-hazar|la-plage/*.png`, **ramenées de 1792×2240 (7 Mo) à 1024×1280** avant
  dépôt. Les choix sont des **options**, pas des plats : tajines (pruneaux OU citron confit),
  desserts « ananas ou banane » / « confiture ou sucre », et à La Plage **un accompagnement inclus
  au choix + les suivants à 5 000 Ar** (deux groupes). Les sandwichs s'appellent « Sandwich
  fromage », pas « Fromage » : panier et ticket affichent le plat SANS sa catégorie. Tout ce qui
  reste à régler avant l'ouverture : « Reste à faire » en tête de fichier.
- **Angelo** — `listing_status = 'hidden'`. Voir sa carte en base pour le détail des catégories.
- **Taxi Be** — **`hidden` depuis le 2026-09-17** (retiré à la demande du porteur du projet ; carte conservée en base, compte démo Apple `demo.resto` toujours rattaché). Bar & pizzeria (Pizza, Tapas, Bières, Cocktails, Softs). ⚠️ Les 6 cocktails sont désactivés depuis le 2026-08-19 (`categories.is_active = false`, décision classement d'âge — voir `docs/FICHE-APP-STORE.md` § 3), les 19 bières restent.

⚠️ Les 4 restaurants de **démo** (Pizzeria Papillon, Tacos du Boulevard, Burger Baobab, Chez Loulou) ont été **supprimés de la base**. Ne pas les réintroduire ; aucun nom en dur dans le code (juste un exemple dans un commentaire de `data/types.ts`).

Les menus, compositions et photos viennent de photos de carte déposées dans le **bucket Storage `MENU`** (`MENU/TAXI BE/`, `MENU/LA CABANE/`) ; les logos dans le bucket `logo`. Buckets **publics**.

### Buckets Storage

| Bucket | Contenu | Écriture |
|---|---|---|
| `MENU` | photos des cartes papier, source des menus | — |
| `logo` | logos des restaurants | — |
| `produits` | visuels produits et sauces (`sauces/<nom>.png`) | `public.is_admin()` |
| `boissons` | visuels boissons | `public.is_admin()` |
| `marketing` | visuels de communication, hors app : `app-store/` (les captures de la fiche, en 6,9" **et** 6,5"), `video/` (rushes des vidéos du site) | `public.is_admin()` |

Tous sont **publics en lecture**.

⚠️ **Historique corrigé le 2026-08-19** (migration `buckets_produits_boissons_ecriture_admin`) : `produits` et `boissons` avaient des politiques `INSERT`/`UPDATE` ouvertes au rôle `public`, sans autre prédicat que le `bucket_id`. La clé anon étant lisible dans le bundle de l'app, cela suffisait à déposer ou **écraser** n'importe quelle photo de produit. Reliquat des fonctions Edge d'import (`import-visuels`, `montage-visuels`, neutralisées depuis). Alignés sur `marketing` : écriture réservée aux administrateurs, lecture publique inchangée. Vérifié : la clé anon se fait refuser en écriture (403 RLS), la lecture publique répond toujours 200.

Le dépôt initial dans `marketing` a demandé une **fenêtre temporaire** (migrations `bucket_marketing_depot_initial` puis `bucket_marketing_fermeture`) : l'écriture y est réservée aux administrateurs, et le seul compte admin est celui du porteur du projet — dont le mot de passe n'a pas à transiter. La fenêtre était restreinte au préfixe `app-store/` et a été refermée aussitôt. Même procédé pour un futur dépôt, ou passer par le tableau de bord Supabase (qui utilise `service_role` et contourne la RLS).

## Modèle de données (au-delà de `SCHEMA-TAXI-FOOD.md`)

Colonnes/tables ajoutées au fil de l'eau (migrations appliquées via MCP) :

- `restaurants` : `logo_url`, `cover_url`, `food_types text[]` (types de plats pour le **filtre** de l'accueil).
- `categories` : `icon` (emoji, ex. 🍕), `is_active` (masquage doux d'une catégorie sans supprimer ses produits).
- `products` : `photo_url`.
- **Options/suppléments** : `product_option_groups` (name, min_select, max_select, required, sort_order) + `product_options` (name, price_delta, is_available, sort_order) ; snapshot commande `order_item_options`.
- `addresses` : `latitude`, `longitude`, `location_captured_at` (**GPS obligatoire**, voir plus bas).
- RPC **`create_order`** (**SECURITY DEFINER**) : atomique, valide les options (appartenance produit, dispo, quotas min/max, groupes requis), **recalcule `unit_price` = price + Σ price_delta** (le client n'envoie jamais de prix), **calcule elle-même les frais de livraison** par `frais_livraison(restaurant, lat, lng)` à partir de l'adresse choisie (voir « Livraison au kilomètre »), applique le code promo éventuel, génère `order_number` (`TF-…`), et **vérifie que l'adresse a lat/lng** (exception sinon). La fonction fixe elle-même `user_id = auth.uid()` et exige que l'adresse appartienne à l'appelant → elle n'écrit jamais pour autrui, DEFINER est sûr.
  - ⚠️ **Elle existe en DEUX signatures, et pas une de plus** : l'implémentation à **5 arguments** (`…, p_code_promo text`) et une **enveloppe à 4 arguments** typée `payment_method`, que les versions déjà installées sur les magasins appellent. **Ne jamais recréer `create_order` en changeant le type d'un paramètre** : `create or replace` n'écrase pas, il *ajoute* une surcharge, et PostgREST répond alors `PGRST203 « Could not choose the best candidate function »` — plus aucune commande ne passe. C'est exactement ce qui s'est produit le 2026-09-05 (migration « adresse introuvable », `payment_method` → `text`) et qui est resté invisible jusqu'au 2026-09-06 faute de commande passée entre-temps.
  - ⚠️ **Pourquoi DEFINER et pas INVOKER** : la fonction fait un `UPDATE orders SET subtotal/total` après avoir inséré les lignes. `orders` n'a **volontairement aucune politique RLS UPDATE** (un client ne doit pas pouvoir modifier ses commandes via l'API REST). En INVOKER, cet UPDATE touchait **0 ligne** sous RLS → `returning into v_order` = NULL → la fonction renvoyait NULL et laissait `total = frais de livraison` (bug corrigé le 2026-08-14 : montant 0 en confirmation, « commande introuvable », total faux). DEFINER exécute les écritures hors RLS. **Ne pas repasser en INVOKER sans supprimer l'UPDATE final.**

## Multi-rôle & espace restaurant

Un même compte Google peut être **client** et/ou **restaurant** (et **livreur** en Phase 3).

- **Base** : enums `app_role` {client,restaurant,livreur} / `role_status` {pending,active,revoked} ; tables `user_roles`, `restaurant_staff` (lie un compte à un `restaurants.id`), `couriers`. RPC `request_role(p_role)` : `client` → `active` immédiat ; `restaurant`/`livreur` → `pending` jusqu'à validation **manuelle** (toi, en base).
- **Helpers rôle** (SECURITY DEFINER) : `is_active_restaurant_staff_of(rid)`, `current_restaurant_id()`. Un « restaurant actif » = rôle restaurant `active` **ET** lien `restaurant_staff`.
- **RLS restaurant** : policies SELECT additives sur `orders`/`order_items`/`order_item_options` → le staff voit les commandes de **son** restaurant (les policies client, par `user_id`, restent inchangées).
- **Transitions de statut** : RPC **`set_order_status(order_id, new_status, reason)`** (SECURITY DEFINER, comme `create_order` — aucune policy UPDATE ouverte sur `orders`). Vérifie l'appartenance au restaurant et n'autorise que les transitions valides : `recue→confirmee|annulee`, `confirmee→en_preparation|annulee`, `en_preparation→en_livraison`. ⏱️ Depuis le 2026-09-22, `confirmee→en_preparation` se fait **aussi tout seul** après 30 s (tâche pg_cron, voir « Préparation automatique ») ; un appui tardif `en_preparation→en_preparation` est accepté sans effet. `annulee` exige un motif (stocké dans `orders.cancellation_reason`, visible côté client).
- **Routage app** (`app/index.tsx`, corrigé le 2026-09-06) : **un rôle pro ACTIF est une décision d'administrateur, un rôle client n'est qu'un tap.** L'aiguillage lit, dans cet ordre, le `mode` persisté (AsyncStorage `tf_mode`), puis les rôles **pro actifs seuls** — le rôle client n'est plus lu du tout, il ne donne aucun droit. Un restaurant ou un livreur actif entre donc DIRECTEMENT dans son espace même s'il porte aussi un rôle client, et sans passer par `/phone` ; `role-select` est réservé au seul cas restaurant **et** livreur actifs. Le mode déduit des rôles est écrit, pas seulement calculé. On sort de l'espace pro par le bouton **« ↔ App client »** de l'en-tête (qui POSE `mode = 'client'`), on y revient par **Profil → « Mon espace partenaire »**. Voir « Navigation libre » et `docs/EN-ATTENTE-DE-BUILD.md` § « Un partenaire arrive dans SON espace ». Espace restaurant = groupe de routes `app/(restaurant)/` : 4 onglets **Commandes en cours** (polling 12 s, badge du nb de commandes en attente d'action via le store `restaurantQueue`) · **En livraison** (`en_livraison`, lecture seule) · **Historique** (`livree`/`annulee`) · **Réglages** (logo, couverture, téléphone public, ouverture, horaires, plats à l'affiche, ruptures). Chaque écran monte `RestaurantHeader`, qui porte le badge **« Espace partenaire »**. Le suivi client affiche l'état **refusée + motif**. ⚠️ **La RLS ne sépare RIEN toute seule, et ça vaut dans LES DEUX SENS.** `orders` porte quatre policies SELECT permissives (propriétaire, staff du restaurant, livreur, admin) qui se cumulent en OU ; `addresses` en porte trois. Chaque écran filtre donc explicitement : côté pro par `restaurant_id` / `courier_id` (`listRestaurantOrders`, `listMyActiveDeliveries`), **et côté client par `user_id`** (`listOrders`, `listAddresses`). Le sens client manquait : corrigé le 2026-09-06 après vérification avec de vrais jetons — l'onglet **Commandes** du parcours client renvoyait 4 lignes à `demo.resto` et 5 à `demo.livreur`, **aucune n'étant la leur** (les commandes de leurs clients, nom, téléphone et adresse joints), et le Profil listait 2 adresses de clients comme « adresses enregistrées ». C'était latent depuis toujours, mais le bouton « App client » a mis cet écran à UN tap d'un partenaire.
- **Visite guidée de l'espace partenaire** (2026-09-06) — 5 étapes jouées **à la première entrée** dans l'espace restaurant, rejouables par **Réglages → « Découvrir votre espace »** : Commandes (avec une **commande d'exemple**) · En livraison · Historique · Réglages · le bouton « App client ». `components/VisiteGuidee.tsx` ; les cibles se signalent elles-mêmes via `components/ZoneVisite.tsx` + `store/visiteGuidee.ts` (la barre d'onglets et l'en-tête ne sont pas dessinés par l'écran qui joue la visite). Quatre règles à ne pas casser :
  - ⚠️ **Le repère ne masque JAMAIS sa cible** : voile en **quatre bandes autour**, contour fin, bulle **à côté**. Pas d'aplat par-dessus (erreur déjà commise sur le guide restaurateur du site vitrine).
  - ⚠️ **Le panneau « Exemple » est ÉPINGLÉ hors du `ScrollView` de la carte.** Sur 667 pt (iPhone SE/8, et le mode compatibilité iPhone du relecteur Apple) la carte d'exemple déborde et il faut défiler pour atteindre « Refuser »/« Accepter ». Tant que la légende défilait avec elle, ce geste la chassait de l'écran : il restait une commande #TF-000 d'apparence réelle, sans son démenti. Ne jamais la remettre dans le contenu défilant. C'est aussi la seule carte de l'app où `showsVerticalScrollIndicator` est **vrai**.
  - ⚠️ **Fermer la visite mémorise à TOUTE étape — et l'écran doit le dire.** La case « Ne plus afficher » n'existe qu'à l'étape 5 ; sa seule présence enseigne « je ferme sans cocher, donc elle reviendra ». Une ligne (`visitePro.fermerNote`) est donc affichée sur les étapes **1 à 4 seulement** et donne le chemin de repêchage, avec le libellé **interpolé** depuis `visitePro.revoirTitre`. Ne pas afficher les deux ensemble : la bulle dépasserait sa hauteur éprouvée.
  - ⚠️ **La commande d'exemple n'existe pas en base** — objet en mémoire rendu par le vrai `RestaurantOrderCard`, badge « Exemple ». En créer une vraie polluerait rapport journalier et commissions et déclencherait e-mail + Telegram + push. Ses frais de livraison sont **lus** dans `restaurants.delivery_fee`, jamais écrits en dur — c'est le **socle** (moins de 3 km), la seule valeur honnête pour une commande d'exemple sans adresse.
  - ⚠️ **N'annoncer que ce qui existe, AVEC LES MOTS DE L'ÉCRAN** — une promesse fausse envoie le restaurateur chercher un bouton absent. Trois pièges déjà payés (revue de vérité du 2026-09-06) : (a) **vocabulaire** — l'écran Réglages écrit « Couverture » et « À l'affiche », pas « devanture » ni « plat du jour » ; et contrairement à ce qui était écrit ici, `save_featured_product` **crée bien un plat avec son prix** (en `in_menu = false` : il vit à l'affiche, pas dans la carte permanente), et le **prix d'un plat de la carte devient modifiable** dès qu'il est étoilé, puisqu'il rejoint « À l'affiche » et son bouton « Modifier » ; (b) **libellés cités** — toujours interpolés depuis la clé réellement rendue (`{{lien}}` ← `profile.proRestaurantLabel`), jamais recopiés : l'anglais et l'italien renvoyaient vers un « My partner space » qui n'existe pas ; (c) **ce qui n'est vrai qu'ensuite** — une commande entre dans « En livraison » dès qu'elle est marquée prête, donc **avant** qu'un livreur l'ait prise.
  - ⚠️ **La préférence est en BASE** (`profiles.visite_pro_vue_le`, écrite par la RPC `marquer_visite_pro_vue(p_vue boolean)` SECURITY DEFINER), pas en AsyncStorage : elle suit la personne, pas l'appareil. Fermer la visite en cours de route la mémorise aussi — elle ne doit pas se represser un soir de service.
- **Espace livreur** (`app/(livreur)/`, mode `livreur`) : colonnes `orders.courier_id`/`picked_up_at`/`delivered_at`/`cash_confirmed` (pas de nouvel enum — le statut reste `en_livraison` de la prise jusqu'à `livree` ; `courier_id`/`picked_up_at` distinguent disponible/prise/récupérée). Helper `is_active_courier()`. RLS SELECT livreur : commandes **disponibles** (`en_livraison`, `courier_id is null`) + **les siennes** (`courier_id = auth.uid()`). RPC SECURITY DEFINER : **`claim_order`** (attribution atomique `UPDATE … WHERE courier_id IS NULL`, une seule commande à la fois), `release_order`, `mark_order_picked_up`, `mark_order_delivered` (encaissement espèces obligatoire), `set_courier_availability` (upsert `couriers.is_available`). 2 onglets : **Livraisons** (toggle dispo, prise « Je la prends », cycle Récupérée→Livrée, polling 12 s) + **Historique**. Le suivi client distingue « en attente d'un livreur » vs « récupérée, en route » via `picked_up_at`.
- ⚠️ **Compte de test** : le compte `techerchristopher@gmail.com` (`9ca91352…`) est lié à **Angelo** (staff restaurant **actif**) **et** a le rôle **livreur actif** (pour tester les deux espaces). À sa connexion il voit l'écran de sélection de rôle. Pour lier un **vrai** compte restaurant : `user_roles(user_id,'restaurant','active',now())` + `restaurant_staff(user_id, restaurant_id)` ; pour un **livreur** : `user_roles(user_id,'livreur','active',now())` (la ligne `couriers` est créée au 1er toggle de disponibilité).
- **Non fait (P2 futur)** : édition menu/horaires depuis l'app, filtrage livreur par zone (`couriers.zone`), stats. Notifications push : **faites** pour les trois publics — client, restaurant, livreur (voir plus bas).

## Dashboard admin (web — `admin/`)

Petite app **Next.js 15** (App Router, TS) séparée, **même projet Supabase**, réservée à l'admin. `cd admin && npm install && npm run dev` → http://localhost:3000.

- **Auth** : rôle **`admin`** (`app_role` étendu) attribué **uniquement à la main** en base, jamais via `request_role`. Connexion **Google** (même provider). Garde : `supabase.rpc('is_admin')` ; un non-admin voit « Accès refusé » et surtout **ne lit aucune donnée** (RLS `*_select_admin using (is_admin())`). ⚠️ Ajouter `http://localhost:3000` (+ l'URL Netlify de prod) dans **Supabase → Auth → Redirect URLs**.
- **Base** (migrations `app_role_add_admin`, `admin_dashboard_foundation`) : `restaurants.commission_rate` (fraction 0..1, **placeholder 0.15 à ajuster par resto**) ; `orders.commission_rate/commission_amount` **figés à la livraison** (`mark_order_delivered`) → un rapport déjà sorti ne bouge jamais ; table `restaurant_settlements` (trace des reversements). RPC SECURITY DEFINER admin : `set_commission_rate`, `record_settlement` (calcule le net dû sur la période, jour local `Indian/Antananarivo`), `approve_role`/`reject_role`.
- **Modèle d'argent** (tranché) : le livreur encaisse tout le cash → te le remet → tu reverses au restaurant `Σ plats − commission` et gardes commission + frais de livraison. **Commission sur les plats (`subtotal`) uniquement.** Seules les `livree` comptent ; aucune commission sur une annulée. **Ouvert** : rémunération livreur (le rapport trace le reversement restaurant en priorité).
- **Écrans d'origine (2026-08)** : Temps réel (commandes actives tous restos + livreurs dispo, polling 10 s, badge RETARD) · Rapport de clôture (période, net à reverser/resto, totaux, export CSV, « marquer reversé » + historique) · Demandes de rôle (valider/refuser, lier `restaurant_staff`) · Restaurants & menus (créer/éditer un restaurant ; gérer catégories/produits — prix, description, dispo, **photo par URL en V1**, upload direct = P1). Écritures via RPC admin (`admin_create_restaurant`, `admin_update_restaurant`, `admin_upsert_category`, `admin_upsert_product`), gardées par `is_admin()`.
- **Onglets au 2026-09-17** : Temps réel · Remboursements · Codes offerts · **Sélections** · Rapport de
  clôture · Demandes de rôle · Restaurants & menus. L'onglet Restaurants montre le **rang** et le
  statut (Disponible / En négociation / Masqué) et permet de changer le rang
  (`admin_ordonner_restaurant`, fonction à part : ajouter un paramètre à `admin_update_restaurant`
  créerait une surcharge PGRST203). La liste des restaurants de l'admin vient de
  `admin_lister_restaurants()` (commission + rang + statut, dans l'ordre du catalogue client).
- **Téléphone d'abord (2026-09-16)** : un palier `@media (max-width: 640px)` dans `globals.css`.
  La barre du haut débordait de 38 px à elle seule (une adresse e-mail ne se coupe pas). Les
  tableaux **d'action** (Temps réel, Remboursements, classe `cartes` + `data-label` sur chaque
  cellule) deviennent des cartes empilées ; les tableaux **de consultation** défilent latéralement
  avec une largeur minimale. Champs à **16 px** (en dessous iOS zoome et ne redescend pas), cibles à
  **44 px** — `!important` voulu, pour battre les styles écrits en ligne. Modales en feuilles basses
  (`dvh`). Mesuré à 375 px : mise en page 720 → 375 px, cibles sous 44 px 20 → 0.
- **Onglet « ☎ Commande tél. »** (2026-09-17) : voir la section « Commande par téléphone ».
- **Onglet « 📣 Annonce »** (2026-09-18) : voir la section « Annonces push ».
- **Rapport de clôture → versements** (2026-09-22) : détail des commandes, référence Orange Money
  obligatoire, message Telegram au restaurant — voir la section « Versements aux restaurants ».
- **Reste (P1/P2)** : rémunération livreur dans le rapport (question ouverte), upload photo depuis le dashboard, filtres/recherche commandes, graphes.

## 📣 Annonces push — prévenir tous les clients (2026-09-18)

« Nouveau restaurant : La Plage », « L'appli s'est mise à jour ». Migration
`20260918090000_annonces_push`, fonction Edge **`envoyer-annonce`**, onglet admin **📣 Annonce**.

- **Deux gestes séparés, exprès** : `admin_creer_annonce` ÉCRIT l'annonce (table `annonces`,
  historique : titre, corps, cible, route, auteur, dates, compteurs) ; la fonction Edge l'ENVOIE.
  Une annonce existe donc en base avant le premier push, et un envoi interrompu laisse une trace.
- **Garde-fous** (tous vérifiés en transaction annulée) : titre ≤ 50, corps ≤ 150, cible ∈
  {`clients`, `moi`}, route `/` ou `/restaurant/<uuid>`, **refus d'un doublon exact dans les 24 h**,
  `is_admin()` sur les trois RPC, statut `preparee` exigé côté Edge (une annonce ne part qu'UNE
  fois, même si le navigateur rejoue l'appel), auteur = appelant. Aucun trigger n'appelle tout ceci :
  **rien ne part automatiquement**.
- **L'écran** : aperçu façon notification (titre gras + corps), compteurs, **« M'envoyer un test »**
  (cible `moi`, un tap), puis confirmation qui relit **à cet instant** le nombre d'appareils ET de
  comptes visés et demande de **taper ENVOYER**. Historique en dessous, avec les résultats.
- ⚠️ **UN TICKET « ok » N'EST PAS UNE LIVRAISON.** Mesuré le 2026-09-18 sur les 10 appareils du
  compte administrateur : **10 tickets « ok », puis 9 reçus `DeviceNotRegistered`** (anciennes
  builds désinstallées) — un seul vrai destinataire. `envoyer-annonce` va donc chercher les **reçus**
  8 s plus tard, compte `recus_ok`, et supprime les jetons morts. `notify-order`, lui, ne lit que
  les tickets : ses chiffres restent optimistes, c'est assumé (il ne les affiche à personne).
- ⚠️ **Les deux fonctions Edge ne sont PAS factorisées**, volontairement : un module commun ferait
  qu'un déploiement d'`envoyer-annonce` peut casser l'annonce d'une commande au restaurant. Toute
  correction de la mécanique Expo se porte dans LES DEUX.
- **Cible `clients`** = tout compte portant le rôle client **actif** (au 2026-09-18 : 26 jetons pour
  4 comptes — beaucoup de jetons de test, ils tomberont au premier envoi réel). Un restaurateur qui
  a aussi un rôle client reçoit l'annonce : c'est voulu, il est aussi client.
- **Côté app, rien à changer** : le tap suit `data.route`, déjà géré depuis les notifications de
  commande, et l'absence d'`orderId` est sans effet (`_layout.tsx`). Aucune OTA n'a donc été publiée
  pour ce chantier.
- ⏳ **Jamais exercé de bout en bout** : l'envoi passe par un JWT d'administrateur, que seul le
  porteur du projet obtient en se connectant. Vérifiés séparément : les RPC et leurs refus (SQL),
  les refus de la fonction Edge (403 sans jeton, 403 avec la clé publiable, CORS 200), et la chaîne
  Expo elle-même (envoi réel aux 10 appareils du compte admin, 10 tickets + 1 reçu livré).

## ☎️ Commande par téléphone (2026-09-17)

Un client appelle, le porteur du projet saisit sa commande dans l'admin (onglet **☎ Commande tél.**),
elle part dans le **circuit de l'app**. Migration `20260917150000_commande_par_telephone`.

- **RPC `admin_commande_telephone(restaurant, nom, téléphone, zone, repère, lat, lng, items)`**,
  `is_admin()`, aucune exécution pour `anon` (vérifié : 401 `42501` par PostgREST). Elle crée une
  adresse puis appelle **`create_order` (5 arguments)** : mêmes gardes (restaurant commandable,
  catégorie servie à l'heure, produit dispo, options obligatoires, prix et frais relus, GPS),
  mêmes triggers (numéro TF-, jeton `/a/`, notification **différée** au commit). Aucune écriture
  directe dans `orders`. `items` a le format exact de l'app.
- **Trace** : table `commandes_telephone` (order_id, adresse, nom, téléphone, `telephone_norme`
  générée, saisie_par) — RLS sans policy ni grant. `admin_client_telephone_connu(tel)` ramène le
  dernier nom / zone / repère / position d'un numéro déjà servi par téléphone.
- ⚠️ **`notify_order_status()` modifiée sur le seul bloc `client`** de la charge utile : nom et
  téléphone de `commandes_telephone` priment, e-mail omis, clé `par_telephone`. Tout le reste du
  corps (relecture différée, garde carte) est inchangé — appliqué par `replace()` du texte existant
  avec contrôle, pas réécrit à la main.
- **Décisions à valider par le porteur du projet** :
  1. La commande appartient au **compte admin qui la saisit**, jamais à un compte client retrouvé
     par numéro (un appelant peut donner le numéro d'un autre ; aucun compte créé). Conséquences :
     les push « client » arrivent sur le téléphone de l'admin, la commande apparaît dans SON onglet
     Commandes de l'app, et `clientName` dans l'app restaurant / livreur affiche le nom de l'admin
     (le **téléphone** affiché est bien celui du client : l'adresse prime). L'adresse porte le
     libellé `☎ <nom du client>`, filtré du carnet d'adresses de l'app (`listAddresses`).
  2. **GPS FACULTATIF, repère OBLIGATOIRE** (migration `20260917170000_commande_telephone_sans_gps`,
     retour du porteur du projet : « impossible que je saisisse un repère GPS pour le client »).
     `create_order` ne lève sa garde GPS que si le **drapeau de transaction**
     `taxifood.commande_telephone = 'on'` (posé par `set_config(..., true)` dans
     `admin_commande_telephone`, remis à vide juste après) **ET** `is_admin()`. ⛔ Ne jamais retirer
     l'une des deux conditions : un client de l'app sans GPS doit rester refusé. Position fournie :
     les deux coordonnées, dans le cadre de Nosy Be (−13,55/−13,05 × 48,05/48,45), sinon refus.
     Jamais de « centre de zone » inventé. Aval sans GPS vérifié dans le code : carte de commande
     restaurant / livreur (« Pas de GPS — appelle le client » + bouton d'appel), admin Temps réel
     (badge SANS GPS), charge utile Telegram patron (lien 📍 absent), nœud n8n du dépôt
     (`carte` vide si pas de coordonnées — ⚠️ l'instance n8n n'a pas été relue).
  3. **Espèces à la livraison seulement**, pas de code promo, pas de commentaire libre.
- **Vérifié sans GPS** (transaction annulée, 2026-09-17) : client app sans GPS → refusé ; client qui
  pose lui-même le drapeau → refusé ; admin appelant `create_order` directement sans drapeau →
  refusé ; admin par la RPC sans GPS → TF-245 acceptée, drapeau revenu à vide, lien 📍 vide ; sans
  repère → `telephone:repere_manquant` ; position incomplète / inversée → refus ; avec GPS → accepté.
  Refusé aussi après application réelle de la migration (client + drapeau).
- **Nom du vrai client** : l'app (`mapOrder`) et l'admin Temps réel lisent le libellé `☎ <nom>` ;
  le téléphone de l'adresse prime sur celui du profil (l'admin Temps réel faisait l'inverse,
  corrigé). OTA `8773196a…` (1.2.2/1.2.3) et `7db125ab…` (1.2.1), web et admin redéployés.
- **Vérifié** (transaction annulée, 2026-09-17, Chez Bidul & Truc ouvert) : non-admin refusé ;
  option obligatoire manquante → `Choix requis manquant : Sauce au choix` ; Les Siciliens →
  `service:restaurant_ferme` ; sans GPS → refus ; commande valide → 2 × « Le classique »,
  sous-total 48 000 + livraison 10 000 = 58 000, 3 options, jeton posé, bloc client = nom et numéro
  saisis, e-mail nul. ⚠️ Chaque test consomme un numéro TF- (séquence non annulée). **Pas de test
  réel** : il aurait prévenu un vrai restaurant. Écran vérifié à 375 px (données réelles, envoi
  non exercé faute de session admin dans le navigateur de test).

## Paiement par carte (Stripe) — 2026-09-06

**Document de référence complet : [docs/PAIEMENT-STRIPE.md](docs/PAIEMENT-STRIPE.md).**
Ce qu'il faut savoir sans l'ouvrir :

- ⚠️ **LE CANAL CARTE EST OUVERT.** `payment_config.carte_active` vaut **`true`** depuis le
  2026-09-06 07 h 39, et le compte Stripe est en mode **RÉEL** : TF-96 a encaissé 3,41 € pour de
  bon. Ce paragraphe annonçait le contraire — il datait d'avant l'ouverture. Arrêt d'urgence,
  sans déploiement : `select public.admin_set_carte_active(false);` en tant qu'admin ; les
  espèces continuent de fonctionner. Tant que l'interrupteur est faux, l'option carte
  **n'apparaît pas** sur l'écran de validation (absente, pas grisée) et `creer-paiement` refuse
  avant tout appel à Stripe.
- ✅ **Une commande carte annulée demande et envoie son remboursement toute seule.** Trigger sur
  `orders` (et son miroir sur une capture tardive) → `payment_refunds` → fonction Edge
  **`rembourser-paiement`** → Stripe. Le montant rendu est celui des **euros réellement
  débités** (`payment_intents.amount_minor`), jamais une reconversion de l'ariary au taux du
  jour. Un paiement jamais capturé est **annulé** (gratuit), pas remboursé. Détail, recette et
  limites : `docs/PAIEMENT-STRIPE.md` § 8.
- ✅ **Un remboursement se déclenche aussi à la main, et le client en est prévenu.** Cinquième
  onglet **Remboursements** du tableau de bord admin : montant modifiable (un plat manquant
  n'est pas une commande annulée), motif obligatoire, double confirmation, et le rappel que
  **Stripe ne rend pas ses frais**. Côté client, le trigger `notifier_remboursement()` sur
  `payment_refunds` envoie l'e-mail dès qu'un remboursement passe à `effectue` — jamais sur
  `demande`, `echoue` ni `sans_objet`. ⚠️ **Le workflow n8n reste à réimporter sur
  l'instance** : tant que ce n'est pas fait, un remboursement réussi envoie au client un
  **second e-mail d'annulation** (l'ancien nœud Code retombe sur `cmd.statut`, qui vaut
  `annulee`) **et repousse un message Telegram d'annulation au restaurant** — vérifié dans le
  nœud de `HEAD~1`, qui émet vers Telegram sur `cle === 'annulee'`.
- ⚠️ **La liste des remboursables part des `payment_intents` capturés, jamais de
  `payment_method`.** Une commande peut porter « carte » sans qu'un centime ait été pris, et
  `basculer_en_especes()` peut la repasser en espèces alors qu'un paiement vit encore.
- ⚠️ **RIEN NE RÉESSAIE TOUT SEUL.** `pg_cron` n'était pas installé sur ce projet à l'époque (il l'est depuis le 2026-09-18, mais aucune tâche ne relance les remboursements) et `pg_net`
  n'émet qu'une fois : si Stripe est injoignable au moment de l'annulation, la demande reste
  en `demande` avec son motif dans `erreur`, et **elle y reste**. Elle bloque au passage tout
  autre remboursement sur le même paiement (index unique partiel). Le réveil est un geste
  humain : bouton **« Relancer les envois »** de l'onglet Remboursements, ou
  `select public.relancer_remboursements_en_attente();`. ⚠️ Cet appel SQL **levait
  « Reserve aux administrateurs » jusqu'à la migration `20260906113000`** — `is_admin()` lit
  `auth.uid()`, NULL sur une connexion directe — donc le filet de sécurité n'avait jamais pu
  servir.
- **« Ce client a-t-il été remboursé ? » se répond en une requête** :
  `select * from public.suivi_remboursements where commande = 'TF-96';` — une ligne par
  paiement encaissé, colonne `ou_en_est` en français, et `a_regarder` pour le balayage du soir.
  `rapport_remboursements` agrège par jour et par restaurant : elle compte, elle ne montre pas.
- **Les prix restent en ariary, le débit se fait en euros** à un taux **fixe** lu dans
  `payment_config.fx_ar_per_eur` (4 700 Ar = 1 EUR). Jamais une constante dans le code.
  L'écran de validation ET l'écran de paiement affichent le total en ariary, le montant exact
  en euros et le taux — c'est une exigence de revue Apple, pas une politesse.
- ⚠️ **L'app ne décide JAMAIS qu'une commande est payée.** `presentPaymentSheet()` sans erreur
  veut dire « le client a confirmé sur son appareil », rien de plus. Le verdict est
  `orders.payment_status`, écrit par un trigger à partir des lignes que seul le webhook Stripe
  (signature vérifiée côté serveur) modifie.
- ⚠️ **`components/paiement/FormulaireCarte.web.tsx` n'est pas cosmétique.** Stripe ne supporte
  pas le web avec le SDK React Native. Sans ce jumeau, `expo export --platform web` embarquerait
  le module natif et casserait taxifood.distripro207.com. Le SDK natif n'est importé qu'à **un**
  endroit du dépôt ; l'y importer ailleurs sans jumeau casse le site.
- **Le PaymentSheet natif exige un nouveau build** (`@stripe/stripe-react-native` est un module
  natif) : il n'existe pas dans les binaires 1.1.0 en ligne. Le web, lui, part au prochain
  déploiement Netlify.
- **Orange Money est non sélectionnable** (badge « Bientôt ») à la SAISIE seulement. Trois
  commandes en base le portent : `admin/lib/util.ts` et `components/DeliverSheet.tsx` doivent
  continuer à les afficher — ne pas les toucher.
- ✅ **Le restaurant n'est plus prévenu d'une commande carte non payée** (migration
  `20260905231109`). `notify_order_status()` se tait sur une commande `cb` dont le paiement
  n'est pas capturé, et **rattrape l'annonce** à l'encaissement (ou au repli espèces).
  ⚠️ Le trigger `orders_notify_status` est passé à
  `after update of status, picked_up_at, payment_status, payment_method` : **ne jamais retirer
  les deux dernières colonnes**. Sans `payment_status`, la capture ne réveille pas le trigger
  et le restaurant ne serait *jamais* prévenu ; sans `payment_method`, le repli espèces non
  plus. Toute la garde est conditionnée à `carte_active` : elle est donc **inerte tant que
  l'interrupteur est à `false`**, et « cb » continue d'y désigner le terminal du livreur.
  ✅ **Exécutée pour de vrai le 2026-09-06**, et la preuve est dans `net._http_response` :
  aucun appel sortant entre 05 h 44 et 08 h 10 alors que cinq commandes carte non payées
  étaient créées dans cette fenêtre (TF-91, 92, 94, 95, 96), puis push + n8n à **08:10:10**,
  une seconde après la capture de TF-96 à 08:10:09. La garde tient, et son rattrapage aussi.
- ✅ **Double encaissement fermé des deux côtés** : `mark_order_delivered` fait primer
  `payment_status = 'paye'` sur `payment_method` et n'enregistre alors aucun cash, même si
  l'appelant coche la case. `app/components/DeliverSheet.tsx` porte la même règle à l'écran —
  la garde app seule ne suffisait pas.
- ⚠️ **Reste ouvert** : le repli espèces n'annule toujours pas le PaymentIntent chez Stripe
  (il faudrait une Edge Function). La colonne `carte_non_encaissee` du rapport rend le cas
  visible — **elle doit rester à zéro**.
- ✅ **`creer-paiement` déployée est la version 4**, conforme au dépôt (relue le 2026-09-06 :
  garde `CLE_STRIPE_VALIDE`, `try/catch` global, nettoyage récursif de `raw_event`), avec
  `verify_jwt = true`. `rembourser-paiement` est déployée elle aussi et répond bien les codes
  du dépôt (`identifiant_manquant`, `devise_incoherente`, `sans_objet`… vus en production).
  Ce paragraphe annonçait la version 1 : il datait d'avant le chantier du 2026-09-06.
  `supabase/config.toml` fige désormais `verify_jwt` pour toutes les fonctions.
- 🚨 **LE TROU LE PLUS GRAVE ENCORE OUVERT : le client peut écrire lui-même le total de sa
  commande.** `creer-paiement` relit `orders.total` — c'est juste — mais `orders`,
  `order_items` et `order_item_options` acceptent toujours un **INSERT direct par l'API REST**
  (policies `orders_insert_own`, `order_items_insert_own`, `order_item_options_insert_own`),
  et `orders` ne porte **aucune contrainte CHECK** : `total`, `delivery_fee`, `commission_rate`
  et `commission_amount` sont libres, `address_id` est nullable. Avec la clé anon (publique par
  conception) et un compte gratuit : un repas payé 50 centimes en carte, une commande espèces
  à 0 Ar qui réveille quand même le restaurant, une livraison sans GPS, un rapport de clôture
  falsifié. Vérifié le 2026-09-06 : **aucune source** (`app/`, `admin/`, `landing/`) n'insère
  dans ces trois tables — le seul `.insert(` du projet porte sur `addresses` — et `create_order`
  est `SECURITY DEFINER` appartenant à `postgres`, propriétaire des trois tables, aucune en
  `FORCE ROW LEVEL SECURITY` : elle n'est pas soumise à la RLS et n'a jamais eu besoin de ces
  policies. Le correctif tient en trois lignes, à appliquer avec son fichier de migration :
  `drop policy if exists orders_insert_own on public.orders;` et les deux équivalents.
  ⚠️ Deux sessions successives ont vu leur écriture **refusée par le classificateur de
  permissions** (DDL sur des policies RLS) : c'est un geste que le porteur du projet doit faire
  lui-même, ou autoriser explicitement.

## ⚠️ Le restaurant recevait une commande VIDE (corrige le 2026-09-06)

Constate sur le telephone du patron de Chez Bidul & Truc a sa premiere commande :
**« il me dit qu'il a recu une commande a 0 Ar »**. Ce n'etait pas un souci d'affichage
Telegram — c'est bien une commande vide qui partait. Mesure dans une transaction annulee :

| | En base | Envoye au restaurant |
|---|---|---|
| Sous-total | 9 000 Ar | **0** |
| Total | 19 000 Ar | **10 000** (les frais de livraison seuls) |
| Articles | 1 | **0** |

**Cause.** `create_order` procede en trois temps, et elle y est obligee : INSERT de la
commande (subtotal 0, total = frais de livraison) pour obtenir son id, INSERT des lignes
d'articles qui referencent cet id, puis UPDATE des montants recalcules. `orders_notify_new`
etait un `AFTER INSERT` ordinaire : il partait **dans l'intervalle**.

⚠️ **Pourquoi c'est reste invisible — et pourquoi ca aurait frappe le premier vrai client.**
Les seules commandes annoncees jusqu'ici etaient des commandes **carte**, volontairement
muettes a l'insertion : leur annonce est rattrapee plus tard par le trigger UPDATE, quand
articles et montants sont en place. **Le chemin carte masquait le defaut ; le chemin
especes — celui de la quasi-totalite des clients reels — le portait en plein.**

**Correctif** (migration `20260906183000_le_restaurant_recoit_la_commande_entiere`), deux
gestes **indissociables** :

1. `orders_notify_new` devient un **`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`** :
   il se declenche au COMMIT, pas a l'insertion.
2. `notify_order_status()` **RELIT la ligne** (`select * into v_o from orders where id = new.id`)
   au lieu de faire confiance a `NEW`. ⚠️ Un trigger differe conserve le `NEW` **fige a
   l'instant de l'INSERT** : reporter sans relire n'aurait repare que la moitie du probleme —
   les articles seraient apparus (ils viennent d'un sous-select), les montants seraient restes
   faux. C'est la moitie la plus trompeuse.

⚠️ **Ne jamais remettre `orders_notify_new` en `after insert` simple, ni retirer la relecture
de `notify_order_status()`.** Les deux gestes se tiennent : reporter sans relire ne repare que
la moitie du probleme, et relire sans reporter ne repare rien. Le defaut revient entier, et il
ne se voit pas en carte. Etat re-verifie en base le 2026-09-07 :
`CREATE CONSTRAINT TRIGGER orders_notify_new AFTER INSERT ON public.orders DEFERRABLE INITIALLY
DEFERRED FOR EACH ROW EXECUTE FUNCTION notify_order_status()`.

✅ **Verifie apres correction** : base et charge utile coincident (total 19 000, sous-total
9 000, 1 article nomme). ✅ **Et le bouton Accepter de Telegram fonctionne de bout en bout** —
TF-99 est passee en `confirmee` par un appui du patron : Telegram -> lien `/a/<id>/<jeton>` ->
base. C'etait le dernier maillon jamais eprouve.

Les trois liens de la charge utile (suivi, accepter, refuser) sont passes au domaine canonique
au meme moment.

## ⏱️ Préparation automatique 30 s après l'acceptation (2026-09-22)

**Règle du cycle de commande : `confirmee → en_preparation` se fait TOUT SEUL**, 30 à 60 s après
l'acceptation, sans geste du restaurant. Demande du porteur du projet : ils acceptent d'un tap
dans Telegram et oublient tous « Démarrer la préparation » — le client restait sur « Confirmée ».
Migrations `20260922100000_preparation_automatique_apres_acceptation` et
`20260922101000_preparation_automatique_tache_pg_cron`.

- **Même chemin que l'appui du restaurateur.** `passer_en_preparation_automatiquement()`
  (SECURITY DEFINER, **non exécutable** par `anon`/`authenticated`, vérifié) fait exactement
  l'UPDATE de `set_order_status` : `status = 'en_preparation', status_updated_at = now()`. Tous
  les effets viennent des triggers `AFTER UPDATE OF status` : push client (`notify-order`),
  e-mail « C'est en cuisine » (n8n), etc. Vérifié en transaction annulée : **2 appels pg_net**
  (notify-order + webhook n8n) pour la bascule automatique, **2 identiques** pour l'appui manuel.
  ⚠️ **Ne jamais la réécrire en UPDATE qui contourne les triggers** (ex. `session_replication_role`).
- **Ce qui bascule** : `confirmee` depuis **≥ 30 s et < 2 h** (au-delà, « C'est en cuisine » le
  lendemain serait faux : elle reste à la main), restaurant `preparation_auto = true`, et **pas
  une carte non encaissée** (`carte_active` + `cb` + `payment_status <> 'paye'` — la même règle
  que la commande muette de `notify_order_status()` et que l'écran restaurant qui ne la montre
  pas). Jamais une annulée, en préparation, en livraison ou livrée. Idempotente (2ᵉ passage :
  0 ligne). Course avec un appui simultané : `FOR UPDATE SKIP LOCKED` + `status = 'confirmee'`
  relu sous verrou, et `set_order_status` lit désormais **sous verrou** (`FOR UPDATE`).
- **Tâche pg_cron `preparation-automatique`, `'30 seconds'`** (pg_cron 1.6.4 accepte les
  secondes). ⏱️ **Délai réel : 30 à 60 s** + quelques secondes de pg_net ; l'écran client se
  rafraîchit toutes les 15 s, l'écran restaurant toutes les 12 s (sondage, pas de temps réel —
  suffisant). Une tâche `preparation-automatique-purge-journal` (03:17 UTC) ne garde que 2 jours
  de journal de CETTE tâche (2 880 passages/jour).
- **Désactiver** : pour un restaurant, `update restaurants set preparation_auto = false where
  id = '…'` (vrai par défaut pour tous) ; pour tout le monde,
  `select cron.alter_job((select jobid from cron.job where jobname = 'preparation-automatique'), active := false);`
  (`active := true` pour rallumer). Aucun écran ne porte encore ce réglage.
- **`set_order_status` : `en_preparation → en_preparation` n'est plus une erreur** — l'appui
  tardif sur le bouton renvoie la commande sans rien écrire (pas de notification en double).
  Protège toutes les versions de l'app, y compris celles qui ne recevront pas l'OTA.
- **Écran restaurant** (OTA 1.2.1 / 1.2.2 / 1.2.3 + web, 2026-09-22) : une commande confirmée
  d'un restaurant en automatique affiche « Acceptée — passe en préparation toute seule dans
  moins d'une minute » et un bouton secondaire « Démarrer maintenant ». Lu depuis
  `restaurants.preparation_auto` dans l'embed de `ORDER_SELECT`.
- **Page « Commande acceptée »** (lien Telegram `/a/…`, fonction `landing/netlify/functions/
  repondre-commande.mjs`, vitrine redéployée) : `repondre_commande_par_jeton` renvoie
  `preparation_auto`, et la page dit « passe en préparation toute seule… il te restera à la
  marquer prête » au lieu de « ouvre ton espace pour la passer en préparation ».
- ⚠️ **Le message Telegram de nouvelle commande (n8n T7uX) n'a PAS été modifié** : la
  réactivation du workflow fait perdre les notifications émises pendant la coupure, et des
  restaurants étaient ouverts. À faire restaurants fermés si on veut l'annoncer là aussi.
- ⚠️ **Non vérifié : un passage de la tâche sur une vraie commande commitée.** La tâche tourne
  (`cron.job_run_details` : `succeeded` toutes les 30 s) et la fonction est prouvée en
  transaction annulée ; la création d'une commande de test réelle (Taxi Be, sans client, sans
  Telegram) a été refusée par le garde-fou de permissions. Première vraie commande acceptée à
  surveiller : `status_updated_at` de `en_preparation` ≈ acceptation + 30 à 60 s.

## Codes promo (2026-09-06)

**Le code donne une remise sur la LIVRAISON seulement.** La commission prélevée sur les
plats n'est pas touchée : la remise sort de notre marge de livraison, jamais de la poche du
restaurant. Le code de lancement est **`TAXIFOOD50`** — 50 %, soit 10 000 → 5 000 Ar.

- **Tables** : `promo_codes` (code, `code_normalise` **générée** via `normaliser_code_promo()`
  — majuscules, sans espaces —, type/valeur de remise, `porte_sur` ∈ {livraison, sous_total},
  `actif`, `commence_le`, `expire_le`, `max_utilisations` global) et `promo_redemptions`
  (qui, quel code, quelle commande, quand). RLS active, **aucune policy client** : lecture
  réservée à `is_admin()`, écriture uniquement par les fonctions SECURITY DEFINER.
- ⚠️ **L'unicité par client est la contrainte `unique (code_id, user_id)`, pas un `select`
  suivi d'un `insert`.** Deux commandes envoyées en même temps depuis deux appareils
  passeraient toutes les deux une vérification préalable. `create_order` insère et **traduit
  la violation** (`unique_violation`) en `code_promo:deja_utilise`.
- ⚠️ **La consommation est dans `create_order`, pas dans un appel séparé.** Même
  transaction : un code ne peut pas être consommé pour une commande qui échoue, ni l'inverse.
- **`verifier_code_promo(code, restaurant, sous_total)`** ne consomme rien : elle sert
  l'aperçu au panier. Le montant qui fait foi reste celui que `create_order` recalcule.
- **Le client n'envoie que le CODE.** Barème, frais de livraison et total sont relus en base.
  `orders.promo_code` / `orders.promo_discount` sont des **instantanés** : la commande reste
  lisible si le code est désactivé plus tard.
- **Verrou de plafond global** : `select … from promo_codes … for update` sérialise les
  commandes portant le même code. L'unicité par client, elle, ne dépend jamais de ce comptage.
- ⚠️ **Le rapport de clôture compte les frais de livraison NETS de remise** (`admin/`), et le
  net à reverser au restaurant est inchangé.
- ✅ **Le champ se saisit AU PANIER**, sous la ligne « Frais de livraison » : `components/CodePromo.tsx`
  monté à l'identique par `(tabs)/cart.tsx` et `checkout.tsx`, vérification partagée dans
  `store/promo.ts`. Le **code** vit avec le panier (AsyncStorage, il survit au détour par
  `/login`) ; la **vérification** vit en mémoire et porte les entrées sur lesquelles elle a été
  faite — une entrée qui change périme le résultat, jamais un montant hérité à l'écran.
- ⚠️ **`promo.aEnvoyer` n'est PAS `promo.valide`.** Tout code retenu qu'aucune réponse de la
  base n'a expressément refusé part à `create_order`, qui tranche. N'envoyer que les codes
  confirmés perdait la remise en silence dans deux cas très réels sur la liaison de Nosy Be :
  vérification encore en vol au moment du tap, et échec réseau. L'aperçu à l'écran, lui, ne
  bouge que confirmé : **on peut facturer moins qu'annoncé, jamais plus.**
- ✅ **Les frais de livraison affichés sont réalignés sur ceux qui seront facturés**
  (`app/lib/fraisLivraison.ts`, monté par les deux seuls écrans qui affichent un total).
  Le panier figeait `deliveryFeeValue` au premier ajout et ne le rafraîchissait jamais, alors
  que `create_order` relit `restaurants.delivery_fee` : au passage de 5 000 à 10 000 Ar, un
  panier resté ouvert affichait « livraison offerte » avec le code promo et se faisait
  facturer 5 000 Ar. Vérifié en production le 2026-09-06 avec un panier volontairement périmé
  à 5 000 : l'écran affiche 10 000. ⚠️ **Les prix des plats et des suppléments, eux, restent
  figés dans le panier persisté** — la vraie réponse est une revalidation du panier à
  l'ouverture (prix, disponibilité, rupture), qui est un chantier, pas un correctif.
- ⚠️ **RIEN, NULLE PART, NE LIBÈRE UNE UTILISATION CONSOMMÉE.** `create_order` insère dans
  `promo_redemptions` au moment de créer la commande ; ni une annulation, ni un paiement carte
  qui échoue ne rendent le code au client. C'est déjà arrivé : l'unique ligne de la table
  appartient à **TF-91**, commande carte jamais payée. Et comme `max_utilisations` est NULL
  sur TAXIFOOD50 et que `promo_redemptions_user_id_fkey` est `ON DELETE CASCADE`, supprimer
  puis recréer son compte rend le code réutilisable sans plafond.

## 🎁 Codes offerts « MERCI + prénom » (2026-09-15)

**Geste commercial nominatif, PAYÉ PAR LE RESTAURANT qui l'offre.** Né d'un client mécontent
(Sulli, TF-162 chez Chez Bidul & Truc) à qui le restaurant a voulu offrir le repas suivant.

- **Un code par client**, nommé `MERCI` + prénom nettoyé (`MERCISULLI`), **réservé à son
  bénéficiaire** : tout autre compte reçoit `inconnu`, sans révéler que le code existe. Le nom
  peut donc circuler. Valable **dans un seul restaurant**, **une fois**, **30 jours**.
- **Ce qu'il offre** : plats + suppléments + emballage, **hors Bières et Softs**
  (`categories.est_boisson`, recalculé au renommage). Plafond par défaut **37 000 Ar**
  (`type_remise = 'montant'`). Le client paie la livraison et ses boissons.
- ⚠️ **`orders.remise_charge_restaurant`** fige la part offerte par le restaurant. Le net à
  reverser en est diminué, et **Taxi Food ne prélève pas de commission sur la part offerte**.
  `mark_order_delivered`, `record_settlement`, la vue `rapport_journalier` et `Report.tsx`
  appliquent tous la même formule : **dû = plats + emballage − commission − part offerte**.
- ⚠️ **Un code « livraison offerte » ne peut PAS être payé par le restaurant** (contrainte en
  base) : c'est Taxi Food qui encaisse la livraison.
- ⚠️ **Un code rendu à l'annulation.** `liberer_code_promo_annulation` supprime la redemption
  — mais jamais depuis `livree`, et elle est **recréée** si la commande ressort de `annulee`
  (`admin_set_order_status` accepte toutes les transitions : sans ça, le repas déjà mangé
  libérait le code et le restaurant payait deux fois).
- ⚠️ **`verifier_code_promo` (3 args, appelée par les apps installées) renvoie remise 0 pour un
  code repas** : elle ne voit que le sous-total, donc ni l'emballage ni l'exclusion des
  boissons. C'est délibéré — **on peut facturer moins qu'annoncé, jamais plus.** Les apps à
  jour appellent **`apercu_code_promo(code, restaurant, items)`**, qui calcule exactement comme
  `create_order`. Nom nouveau, **jamais une surcharge** (piège PGRST203 du 2026-09-05).
- **Admin** : onglet « Codes offerts » (recherche client, génération, e-mail, lien WhatsApp
  pré-rempli, liste et désactivation). RPC `admin_chercher_clients`, `admin_creer_codes_offerts`,
  `admin_lister_codes_offerts`, `admin_envoyer_codes_email`, `admin_noter_whatsapp`,
  `admin_desactiver_code_offert` — toutes `is_admin()`, aucune exécution pour `anon`.
- ⚠️ **On n'affiche JAMAIS « envoyé »** : n8n ne renvoie rien à la base, `promo_envois.statut`
  reste `demande`. Ouvrir un lien WhatsApp ne prouve pas non plus qu'il est parti.

### Reste à faire (au 2026-09-16)

1. ⏳ **Activer l'e-mail** : credential Header Auth `x-taxifood-secret` à créer dans n8n avec la
   valeur du Vault `n8n_webhook_secret` (**geste humain** : un assistant ne saisit pas un
   jeton), à attacher au webhook de `xDZt2TzDehkvNUHN` (« Taxi Food — code offert », créé,
   **inactif**), puis poser `n8n_code_offert_url` dans le Vault. Tant que ce secret n'existe
   pas, `notifier_code_offert` est **inerte** : aucun e-mail ne part, et c'est voulu.
2. ⏳ **Ligne Telegram « Repas offert par vous — code X (−N Ar) »** dans T7uX : patch **écrit et
   testé hors n8n** (sans geste : sortie identique ; avec geste : une ligne de plus, 208
   caractères). Sauvegarde du workflow prise hors dépôt. **À appliquer restaurants FERMÉS** :
   la réactivation du webhook fait perdre toute notification émise pendant la coupure.
3. ⏳ **Tester `MERCISULLI` avec Sulli** — le porteur du projet le fera lui-même, **à lui
   rappeler**. Sans la ligne Telegram, prévenir Chez Bidul & Truc par téléphone que la commande
   est le geste, sinon il verra une commande à 10 000 Ar pour une pizza.

## 💸 Versements aux restaurants : référence Orange Money + message Telegram (2026-09-22)

Onglet « Rapport de clôture ». Migration `20260922140000_versement_reference_et_message_telegram`
(appliquée), fonction Edge `notifier-versement` (v1, `verify_jwt = false` figé dans `config.toml`,
admin actif exigé comme `envoyer-annonce`), composants `admin/components/Versements.tsx` +
`admin/lib/versement.ts`. Recette : `supabase/tests/versement.test.sql` (transaction annulée).

- **Une seule source pour le calcul** : `admin_commandes_a_reverser(resto, début, fin)` rend les
  commandes retenues, une par ligne (numéro, date, montant = plats + emballage, commission, part
  offerte, net), avec la formule et le filtre de `record_settlement` **recopiés à l'octet**. Le
  détail affiché ET le montant enregistré en sortent. Test : sa somme = `record_settlement` sur 6
  périodes réelles. ⚠️ **Toute évolution de la formule se porte dans les DEUX** (et dans
  `lib/reversement.ts`) ; l'écran signale en rouge si la base et le rapport divergent.
  ⚠️ Depuis le 2026-09-23 elle rend aussi `deja_reverse` / `settlement_id` / `reverse_le` /
  `reference_versement`, et le montant enregistré ne somme que les lignes `not deja_reverse`.
- **`admin_enregistrer_versement(resto, début, fin, montant_versé, référence, dû_attendu)`** — nom
  nouveau, `record_settlement` **inchangée** (piège PGRST203). Refuse : référence vide / < 4 ou
  > 64 caractères ; référence déjà utilisée (comparée sans espaces ni casse, + index unique) ;
  ~~toute période qui CHEVAUCHE un versement existant~~ — **remplacé le 2026-09-23** par le refus
  commande par commande, voir « Une commande n'appartient qu'à UN reversement » plus bas ;
  période sans commande ; dû affiché ≠ dû en base (« recharge le rapport »). Verrou
  consultatif par restaurant contre le double clic. `is_admin()` ; aucune exécution pour `anon`
  (vérifié par PostgREST : 401 `permission denied`).
- **Colonnes ajoutées** à `restaurant_settlements` : `reference_versement`, `nb_commandes`,
  `numeros_commandes`, `telegram_statut` (`non_prevu` = anciens reversements · `en_attente` ·
  `en_cours` · `envoye` · `echec` · `sans_canal`), `telegram_erreur`, `telegram_message_id`,
  `telegram_envoye_at`, `telegram_tente_at`, `telegram_tentatives`. Auteur = `created_by`
  (existait), date = `paid_at`.
- **Le message** est écrit par `texte_message_versement` (fonction pure, aussi appelée par la
  fenêtre pour l'aperçu : même texte). Liste des TF- seulement sous 10 commandes. Texte brut,
  sans `parse_mode`.
- **Chemin d'envoi : fonction Edge, pas n8n ni pg_net.** T7uX n'est pas touché ; pg_net ne rend
  pas la réponse de Telegram. Le jeton vit au Vault (`telegram_bot_token`), lu par
  `lire_jeton_telegram()` **service_role seul**, jamais renvoyé ni journalisé (effacé de tout
  message d'erreur). `versement_prendre_envoi` verrouille la ligne, refuse un 2ᵉ envoi confirmé
  (`deja_envoye`) ou concurrent (`envoi_en_cours`, 2 min), relit le canal ACTUEL du restaurant ;
  `versement_noter_envoi` n'écrit `envoye` que sur `ok: true` **avec** `message_id`.
- ⚠️ **Délai dépassé (10 s) = échec « a PU partir »** : l'écran dit de regarder le groupe avant de
  renvoyer. Un renvoi à ce moment-là peut doubler le message — c'est le seul cas.
- **Essai** : bouton « Essai du message sur mon canal » (historique) → message d'exemple préfixé
  🧪 sur `telegram_admin_chat_id` (vérifié : celui d'aucun restaurant). Aucun versement lu ni écrit.
- ⚠️ **Non vérifié au 2026-09-22** : aucun envoi Telegram réel (ni essai ni vrai versement) —
  l'admin exige Google et le navigateur disponible est connecté avec un compte non admin. Écran
  vérifié à 375 px sur un banc d'essai local à données simulées (aucune requête Supabase), pas
  sur l'admin en ligne. **Premier geste à faire : l'essai sur ton canal.**
- ⚠️ La présence d'un groupe (avertissement « aucun message ne partira ») est lue dans
  `restaurants.telegram_chat_id` — lisible aujourd'hui (fuite connue). Quand la colonne passera en
  table privée, l'écran dira « inconnu » et la base tranchera quand même (`sans_canal`).
- **Code marchand Orange Money** (2026-09-22, commit `60638d8`) : colonne `restaurants.code_marchand`
  (migration `20260922170000_…`, lisible par tous par choix : un code marchand n'ouvre rien),
  écriture par **`admin_set_code_marchand` seule**. Sur chaque carte du bloc « Reversement par
  restaurant » : code + **Copier** (« ✓ Copié ») + Modifier ; absent = « non renseigné » en ambre +
  **Ajouter**. Forme vérifiée avant l'appel (3–20 chiffres/lettres, espaces retirés, vide = efface).
  Dans « Marquer reversé », juste au-dessus de la référence, avec Copier ; absent = avertissement
  ambre, versement non bloqué. Lu par une requête **séparée** de `telegram_chat_id`, pour survivre à
  la fermeture future de ce dernier. Composant `admin/components/CodeMarchand.tsx`. Vérifié par
  PostgREST avec la clé publique : RPC → **401 `42501`**, PATCH direct → 0 ligne, code inchangé.
- **Fiche complète d'une commande** (2026-09-22) : dans le détail d'un versement, chaque ligne TF-
  se déplie (plats + options + commentaire, emballage, code promo et qui le paie, livraison, total
  et paiement, client/téléphone/zone/repère/consignes, livreur, heures, reversement avec le taux
  **figé** de la commande). **Aucune migration** : les politiques `*_select_admin` existantes
  couvrent `orders`, `order_items`, `order_item_options`, `addresses`, `profiles`,
  `admin_actions`. Clé publique vérifiée : `[]` sur ces six tables. ⚠️ `unit_price` **inclut déjà
  les options** (Σ = `subtotal` sur les 20 commandes) : ne pas rajouter `price_delta_snapshot`.
  ⚠️ **Heures** : seules `created_at`, `picked_up_at`, `delivered_at` existent ; « acceptée » et
  « en préparation » ne sont **pas horodatées en base** (l'écran le dit) — seuls les changements
  faits depuis l'admin le sont (`admin_actions`, `statut_commande`). Commande par téléphone : le
  nom vient du libellé `☎ <nom>` de l'adresse (`commandes_telephone` n'a aucune politique, illisible
  même pour l'admin).
- ⚠️ **Non vérifié sur l'admin en ligne** (connexion Google, pas de session admin) : rendu contrôlé
  à 375 px sur un banc local à données simulées (aucun défilement horizontal, cibles ≥ 44 px,
  champ à 16 px, Copier → « ✓ Copié » sur un vrai clic). Le paquet déployé contient bien les deux
  écrans. **Jamais exercés** : un enregistrement réel du code par la RPC depuis l'écran, la lecture
  d'une vraie fiche.

## 🔗 Une commande n'appartient qu'à UN reversement (2026-09-23)

Migration `20260923100000_une_commande_un_seul_reversement` (appliquée). Le manque signalé :
« Voir les N commandes » affichait ensemble des commandes déjà payées et des commandes encore
dues, sans rien pour les distinguer — risque de payer deux fois.

- **Table `settlement_orders`** (`order_id` **CLÉ PRIMAIRE**, `settlement_id`, `restaurant_id`,
  `net` figé, `created_at`). La clé primaire EST la garantie anti-double-paiement : ce n'est plus
  une règle d'écran, c'est la base qui refuse. FK composite vers `orders (id, restaurant_id)` :
  un rattachement ne peut pas viser le reversement d'un autre restaurant. **RLS active, AUCUNE
  politique, aucun droit** : illisible par la clé publique comme par un compte connecté (vérifié
  par PostgREST : **401 `42501`**), tout passe par les RPC `is_admin()`.
- **Remplie par `admin_enregistrer_versement`, dans la MÊME transaction** que le versement : soit
  les deux, soit ni l'un ni l'autre.
- ⛔ **Le refus par CHEVAUCHEMENT DE PÉRIODE a disparu.** Il interdisait de solder une période
  entamée et de rattraper une commande livrée en retard, et une période décalée d'un jour le
  contournait. Ce qui protège désormais est **commande par commande**. Un versement ne retient que
  les commandes **non encore rattachées** ; si elles le sont toutes, il est refusé (« Rien à
  reverser : les N commande(s) … ont déjà été reversées »).
- **`admin_commandes_a_reverser`** rend quatre colonnes de plus (`deja_reverse`, `settlement_id`,
  `reverse_le`, `reference_versement`) et **garde** les commandes déjà payées dans la liste : les
  cacher ferait disparaître des commandes réelles. ⚠️ Sa signature de retour a changé (`drop` +
  `create`) : tout appelant qui somme `net` doit filtrer `not deja_reverse`.
- **`admin_commandes_deja_reversees(début, fin)`** : ce que le Rapport de clôture lit pour savoir
  quelles commandes de la période sont déjà payées.
- ⛔ **`record_settlement` n'est plus exécutable** par `anon` ni `authenticated` (révoquée) : elle
  écrivait un reversement **sans rattacher aucune commande**, donc rouvrait le double paiement par
  la porte de derrière. Son corps est inchangé, elle reste la référence de calcul du test.
- **Reprise de l'existant** : les 3 reversements déjà en base ont reçu leurs commandes selon la
  règle de période du calcul (`status = 'livree'` ET `coalesce(delivered_at, created_at)` au jour
  local `Indian/Antananarivo` dans la période ET même restaurant) — Chez Bidul 13→14/09 (TF-161,
  TF-162), La Cabane 20/09 (TF-254), Chez M&K 22→23/09 (TF-265). ⚠️ Pour Chez Bidul, la somme des
  nets (125 800) vaut le **montant payé**, pas l'`amount_due` enregistré (117 800) : ce
  reversement date d'avant l'ajout de l'emballage dans la formule. C'est normal, rien à corriger.
- **À l'écran** : pastille par commande — verte « Reversé le JJ/MM · réf. XXX » ou ambre
  « À reverser » ; pied de liste à **deux totaux** (déjà reversé / reste à reverser) ; carte du
  restaurant dont le gros chiffre est le **reste à reverser** seul, avec les deux pastilles de
  répartition ; « Marquer reversé » apparaît dès qu'**une** commande reste due (et non plus
  « aucun versement sur une période qui chevauche »).
- **Recette** : `supabase/tests/versement.test.sql`, transaction annulée — **40 contrôles, 0 KO**
  (2026-09-23). Rattachement à l'enregistrement, refus d'un second versement sur des commandes
  déjà rattachées, période chevauchante acceptée SANS la commande déjà payée, clé primaire qui
  refuse un doublon hors RPC, cohérence restaurant, reprise des 3 reversements, commande sans
  `delivered_at` (TF-248) visible et rattachée, non-admin refusé, clé publique refusée. Aucun vrai
  reversement créé, aucun message Telegram envoyé.
- ⚠️ **Non vérifié sur l'admin en ligne** (connexion Google, pas de session admin) : rendu contrôlé
  à **375 px sur une copie locale** à données simulées reprenant `globals.css` — aucun défilement
  horizontal (`scrollWidth = clientWidth = 375`), pastilles et deux totaux lisibles. Le paquet
  déployé contient bien le nouveau code (`admin_commandes_deja_reversees`, `pill reverse`,
  `pill a-reverser` présents dans le JS et le CSS servis). **Jamais exercé en vrai** : un versement
  réel passant par le nouveau chemin.

### Marquer MANUELLEMENT les commandes reversées (2026-09-23, 2ᵉ passe)

Retour du porteur du projet : « je veux pouvoir marquer manuellement chaque commande comme étant
reversée ». On ne pouvait reverser qu'un bloc « tout ce qui reste dû sur la période ».
Migration `20260923140000_reverser_les_commandes_choisies` (appliquée).

- **Un cœur unique, `versement_enregistrer_core(resto, ids[], début, fin, montant, réf, dû)`** —
  **appelable par personne de l'extérieur** (révoqué de `public`, `anon`, `authenticated` ET
  `service_role`). Deux portes y mènent :
  - **`admin_enregistrer_versement_commandes(resto, order_ids[], montant, réf, dû)`** — le chemin
    de l'écran depuis cette passe : la liste vient des cases cochées ;
  - **`admin_enregistrer_versement(resto, début, fin, …)`** — inchangée de l'extérieur, elle
    résout la période en liste (les non rattachées) puis appelle le même cœur.
  Une seule implémentation : une règle ne peut plus diverger entre les deux chemins.
- **Contrôles du cœur**, tous avant la moindre écriture : liste vide refusée ; commandes d'un
  autre restaurant refusées (nombre annoncé) ; commandes non livrées refusées (numéros annoncés) ;
  commandes déjà rattachées refusées (numéros annoncés) ; référence obligatoire, 4–64 caractères,
  unique ; dû affiché ≠ dû en base refusé ; `is_admin()` seul ; verrou consultatif par restaurant.
  Le montant enregistré est **la somme exacte des nets de ces commandes-là**, et ce sont les mêmes
  lignes qui sont rattachées (mêmes tableaux : aucune seconde lecture ne peut s'en écarter).
- ⚠️ **Période enregistrée en mode liste = min/max des jours locaux des commandes retenues**, pas
  la période du rapport. Deux versements peuvent donc porter des périodes qui se chevauchent :
  c'est voulu depuis la 1ʳᵉ passe, la garantie est `settlement_orders`, pas la période.
- **Écran** (`Versements.tsx`) : case à cocher sur chaque ligne encore « À reverser », dans une
  cible de **44 × 44 px** (mesurée) ; « Tout sélectionner / Tout désélectionner » ; pied de liste
  « N sélectionnées · X Ar » + **« Marquer reversé (N) »** ; sur une ligne dépliée, **« Marquer
  cette commande comme reversée »** pour solder une commande isolée. Le bouton de la carte est
  devenu **« Tout reverser »**. La fenêtre existante sert dans tous les cas (référence Orange
  Money obligatoire, aperçu du message Telegram avec le bon nombre et le bon montant).
- ⚠️ **La fenêtre RELIT toujours la base** (`admin_commandes_a_reverser`) et n'utilise la
  sélection que pour restreindre : les montants ne viennent jamais de l'écran. L'alerte d'écart
  avec le rapport ne se déclenche **que** si l'on paie tout ce qui reste dû — sur une sélection
  partielle, un montant plus petit est voulu, pas suspect.
- **Après enregistrement** : `load()` relit commandes, reversements et rattachements (carte et
  historique à jour) et un compteur `rafraichi` relit le détail resté ouvert — les lignes payées
  passent au vert sans recharger la page.
- **Recette** : `supabase/tests/versement.test.sql`, transaction annulée — **51 contrôles, 0 KO**
  (2026-09-23). Dont : liste vide refusée, autre restaurant refusé, non livrée refusée, déjà
  rattachée refusée, dû périmé refusé, sélection d'UNE commande (dû = somme des nets rattachés,
  période déduite), même commande refusée au 2ᵉ versement, solde de la période (reste 0), cœur
  inappelable, `anon` refusé. Aucun vrai reversement, aucun message Telegram.
- Clé publique par PostgREST : `admin_enregistrer_versement_commandes` et
  `versement_enregistrer_core` → **401 `42501`**.
- ⚠️ **Non vérifié sur l'admin en ligne.** Rendu contrôlé à 375 px sur copie locale : cases
  44 × 44 px, boutons ≥ 44 px, aucun défilement horizontal.

## 📍 Position GPS des restaurants (2026-09-24)

`restaurants.latitude` / `longitude`, écrites par `admin_set_position_restaurant()` (admin
seulement, refus hors de Nosy Be : une virgule perdue ferait facturer des kilomètres imaginaires).
Chez Bidul & Truc −13.3930201 / 48.2078429 · La Cabane −13.397834 / 48.206980 ·
Chez M&K −13.3861762 / 48.2386413 (liens Google Maps du porteur du projet). **La Plage n'en a pas** :
tout calcul de distance doit traiter « position inconnue ».

⚠️ **Préalable au chantier « livraison au kilomètre »** : sans ces positions, aucune distance n'est
calculable. Distances mesurées à vol d'oiseau × **1,3** pour approcher la route (pas d'itinéraire
routier : payant, lent sur la liaison de Nosy Be, et en panne quand le service tombe).

## 🛵 Livraison au kilomètre (2026-09-24) — formule C

**La règle, en une phrase, celle qu'on annonce aux clients :**
> **Livraison 10 000 Ar jusqu'à 3 km, puis 1 000 Ar par kilomètre entamé.**

Décision du porteur du projet : **aucun plafond, aucun rayon maximum** (les deux
explicitement). Prime livreur : **hors de ce lot**, rien n'est décompté pour lui.

**La base fait foi, et elle seule.** `create_order` calcule les frais elle-même par
`frais_livraison(restaurant, latitude, longitude)` à partir de l'adresse choisie, et
n'accepte aucun montant venu du client — il n'existe **aucun paramètre** pour en proposer un,
et `orders` n'a volontairement aucune politique RLS UPDATE. `orders.delivery_fee` est **figé à
la création** : un rapport déjà sorti ne bouge pas. Vérifié en transaction annulée : un compte
client qui tente `update orders set delivery_fee = 1` touche **0 ligne**.

**Distance** : vol d'oiseau (haversine, `distance_vol_oiseau_km`) **× 1,3** pour approcher la
route. Pas d'API d'itinéraire — payante, lente sur la liaison de Nosy Be, et en panne quand le
service tombe. Le kilomètre est **entamé** : 4,3 km ⇒ 2 km au-delà de 3 ⇒ +2 000 Ar.

**Trois replis sur le tarif de base (10 000 Ar), jamais une erreur bloquante** :
- le **restaurant n'a pas de position** — c'est le cas de **La Plage** au 2026-09-24 ;
- l'**adresse n'a pas de GPS** — commande par téléphone, où la position est facultative ;
- une des deux positions tombe **hors du carré de Nosy Be** (latitude −13,55 à −13,05,
  longitude 48,05 à 48,45 — le même carré que la garde de `admin_commande_telephone`).
  ⚠️ **Hygiène de données** : une virgule perdue ou deux coordonnées inversées facturerait des
  dizaines de kilomètres imaginaires. On préfère sous-facturer que facturer une donnée fausse.

**Où se changent les réglages, sans redéployer** : trois colonnes sur `restaurants`, avec
valeurs par défaut — `livraison_km_inclus` (3), `livraison_prix_par_km` (1 000),
`livraison_coef_route` (1,3) — à côté de `delivery_fee`, qui reste le socle. Tout le tarif d'un
restaurant se lit donc sur **sa** ligne, et un restaurant peut être traité à part. RPC admin
**`admin_set_tarif_livraison(restaurant, socle, km_inclus, prix_par_km, coef)`**, tracée dans
`admin_actions`. ⚠️ Fonction **à part**, jamais un paramètre de plus sur
`admin_update_restaurant` : une surcharge fait répondre PGRST203 à PostgREST.

**Les fonctions** (migrations `20260924150000`, `20260924151000`, `20260924152000`) :
| Fonction | Pour qui | Rend |
|---|---|---|
| `frais_livraison(restaurant, lat, lng)` | `create_order` | le montant |
| `frais_livraison_detail(restaurant, lat, lng)` | app, admin (anon + authenticated) | montant, distance, `distance_connue`, barème |
| `frais_livraison_adresse(restaurant, address_id)` | app | idem, pour **une adresse de l'appelant** |
| `dans_nosy_be(lat, lng)`, `distance_vol_oiseau_km(...)` | briques | booléen / km |

⚠️ **`frais_livraison_adresse` prend un IDENTIFIANT d'adresse, pas des coordonnées** : l'adresse
doit appartenir à l'appelant, sinon la fonction serait un mesureur de distance à la demande.
Adresse d'un autre compte ⇒ tarif de base, aucune distance rendue (vérifié).

**Ce que voient les écrans** :
- **catalogue et fiche restaurant** : « **À partir de** 10 000 Ar » — ils ne connaissent pas
  l'adresse du client. La fiche rappelle le barème **lu en base**, jamais écrit en dur.
- **panier** : le montant pour l'adresse déjà choisie, sinon le socle + « montant définitif une
  fois l'adresse choisie ».
- **validation** : le montant exact + la distance retenue (« 9,3 km »).
- Clés FR/EN/IT : bloc **`delivery`** (`rule`, `from`, `distance`, `beforeAddress`,
  `noDistance`). ⚠️ `rule` est **interpolée** depuis ce que la base a répondu : changer le
  tarif en base ne doit pas laisser une phrase fausse sur les téléphones.
- **vitrine** (`landing/js/partenaires.js`) et **aperçus sociaux** (`partage.mjs`, mis en cache
  300 s) : « à partir de » obligatoire — ils sont vus par des gens dont on ne connaît aucune adresse.
- **commande par téléphone** (admin) : position facultative ; donnée, le prix suit la distance
  et l'écran l'affiche entre parenthèses ; absente, il écrit « tarif de base, position non fournie ».

**Preuves chiffrées** (transactions annulées, 2026-09-24, aucune commande réelle créée) :
| Cas | Distance recalculée | Frais |
|---|---|---|
| TF-268 — Chez Bidul & Truc | 0,478 km | 10 000 |
| TF-251 — La Cabane | **3,013 km** | **11 000** |
| TF-265 — Chez M&K | 4,317 km | 12 000 |
| TF-151 — La Cabane | 9,250 km | 17 000 |

⚠️ **TF-251 est l'enseignement du lot** : annoncée « 3 km », elle mesure **3,013 km** une fois
recalculée, donc **un kilomètre entamé** et 11 000 Ar. Treize mètres au-dessus du seuil coûtent
1 000 Ar. C'est la règle demandée qui s'applique, pas un défaut — mais si ce couperet dérange,
le remède est un réglage, pas du code : monter `livraison_km_inclus` à 3,2 par exemple.

## 🍟 Accompagnements de Chez Bidul & Truc (2026-09-20)

- **Plats du jour : UN SEUL accompagnement**, inclus dans le prix (frites, légumes sautés, pâtes,
  riz, purée). Le groupe facultatif « 2e accompagnement (+5 000 Ar) » a été **retiré des plats du
  jour** ce soir — décision du porteur du projet.
- ⚠️ **La carte permanente le garde** (15 plats : cordon bleu, filet de zébu, marmite du pêcheur…).
  Ne pas « harmoniser » sans que le porteur du projet l'ait demandé.
- ⚠️ **Cinq plats du jour n'ont AUCUN groupe d'accompagnement** : pot-au-feu, boudin noir façon
  hachis, paella, tripes, 1/2 poulet grillé BBQ. Les trois premiers arrivent avec leur propre
  garniture (pommes de terre, purée gratinée) ; la paella et le demi-poulet, non. À trancher avec
  le restaurateur — question posée, pas encore répondue.

## 🥩 Repères alimentaires (`products.diet_tags`) — 2026-09-19

`diet_tags` est un tableau ; seule la valeur **`porc`** est utilisée aujourd'hui (17 produits).
À Nosy Be, une part importante de la clientèle ne mange pas de porc : un plat qui en contient
sans le dire coûte un client pour de bon.

⚠️ **Le badge ne vivait QUE dans `ProductRow`**, la ligne d'une catégorie. Un **plat du jour**
n'a pas de catégorie (`in_menu = false`) : la paella au chorizo portait donc `{porc}` en base
sans qu'aucun écran ne l'affiche — une valeur qui ne protège personne. Le badge est désormais
aussi sur la **fiche produit** (`app/app/product/[id].tsx`) et sur la carte du **bandeau
« Offre du jour »** (`app/app/restaurant/[id].tsx`), avec le texte traduit
(`product.contientPorc`, FR/EN/IT) au lieu du français en dur.

**Règle** : tout plat contenant du porc reçoit `diet_tags = array['porc']` à sa création, et on
le CONSTATE à l'écran — pas seulement en base.

## 🚪 Fermer doit être UN SEUL GESTE, visible même en automatique (2026-09-20)

**Le défaut.** Le patron de Chez Bidul & Truc a voulu fermer son restaurant à midi depuis son
espace. Il est resté **OUVERT pour ses clients**, et il a cru que le bouton ne marchait pas.

**Pourquoi.** `ouvert_maintenant(r)` vaut `is_open` quand `auto_open` est faux, et **l'horaire du
jour** sinon. Or l'écran Réglages n'affichait l'interrupteur « Je suis ouvert » **que si
l'ouverture automatique était déjà coupée** (`{!autoOuverture ? … : null}`). Fermer demandait donc
**deux gestes dans le bon ordre** — couper « Ouverture automatique » (qui ne ferme rien, le
restaurant reste ouvert à cet instant), puis trouver un second interrupteur **apparu plus bas**.
Personne ne devine ça, surtout pas en plein service.

**⚠️ LA RÈGLE, à ne plus jamais enfreindre : fermer est UN SEUL GESTE, VISIBLE EN PERMANENCE, y
compris quand le restaurant est en ouverture automatique.** Un réglage qui conditionne l'existence
d'un bouton vital est un piège : le mode n'est pas un préalable à l'action.

**Corollaire : un état doit dire POURQUOI.** « Fermé en ce moment » ne suffit pas — l'écran dit
maintenant si c'est l'horaire ou une décision manuelle, et ce que la fermeture entraîne (les
horaires **ne rouvriront pas tout seuls**).

Ce qui a été fait (migration `20260920100000_fermer_est_un_seul_geste`) :

- **Espace restaurateur** (`app/app/(restaurant)/reglages.tsx`) : bloc d'état teinté (vert/rouge)
  + bouton **« Fermer maintenant » / « Rouvrir »** toujours affiché, qui appelle
  `set_restaurant_open`. Le réglage « Ouverture automatique » reste — il sert à **revenir** au
  fonctionnement par horaires — mais il n'est plus le passage obligé pour fermer.
  ⚠️ `set_restaurant_open` écrit **deux** colonnes (`is_open` ET `auto_open = false`) : l'écran
  anticipe les deux, sinon il afficherait « Fermé » sous une « Ouverture automatique » allumée.
- **Admin** : `admin_set_restaurant_open(uuid, boolean)` ne touchait **QUE `is_open`**. Sur un
  restaurant en ouverture automatique (La Cabane, La Plage), le bouton de l'admin était donc
  **INERTE** : il écrivait en base et rien ne changeait à l'écran du client. Elle coupe désormais
  `auto_open` **dans les deux sens** — rouvrir en le laissant allumé redonnerait exactement le
  même bouton mort. Le retour aux horaires devient une action à part,
  **`admin_set_restaurant_auto_open(uuid, boolean)`** (bouton « Rendre aux horaires »).
  Décision assumée : **rouvrir ne remet JAMAIS l'automatique tout seul.**
- **Écran Temps réel** : lit `ouvert_maintenant` (colonne calculée) et non plus `is_open`, affiche
  la raison (« selon ses horaires » / « réglé à la main ») et dit ce que la fermeture entraîne.
  ⚠️ L'onglet **Restaurants & menus** montre toujours `is_open` : sa colonne s'appelle désormais
  **« Interrupteur »**, pas « État », et la fiche prévient que ce n'est pas l'ouverture réelle.

**Vérifié en transaction annulée le 2026-09-20** (rien de persisté, TF-252 consommé dans la
séquence sans commande créée) : admin ferme un restaurant en automatique → `is_open=f auto_open=f
ouvert_maintenant=f` ; admin rouvre → automatique toujours coupé ; « Rendre aux horaires » →
recalcul par les horaires ; non-admin et restaurant introuvable refusés ; patron ferme →
**commande client refusée `service:restaurant_ferme`** ; patron rouvre → commande acceptée
(11 000 + 10 000 = 21 000). Trace `admin_actions` avec **les deux colonnes** dans `avant`/`apres` —
sans `auto_open`, la trace d'une fermeture sans effet était indiscernable d'une vraie fermeture.

**Vérifié à l'écran, en production** (2026-09-20, session restaurateur existante, La Cabane —
`auto_open = true`) : l'écran Réglages affiche « **Fermé en ce moment** · Ce sont vos horaires qui
vous ferment », le bouton **« Ouvrir maintenant »** juste en dessous, et « Ouverture automatique »
allumée **sous** lui. C'est exactement la régression corrigée : le bouton existe **en mode
automatique**. Côté client (375 px) : La Cabane et Chez Bidul & Truc portent le badge « Fermé »,
la fiche dit « pas commander — reviens à l'ouverture » et les plats n'ont plus de bouton d'ajout.

**Non vérifié** :
- le **tap** sur « Ouvrir maintenant » / « Fermer maintenant » depuis l'écran. Le seul restaurant
  accessible avec la session disponible est **La Cabane, un vrai restaurant visible** : l'ouvrir
  hors de ses horaires, même quelques secondes, l'expose à une commande sans personne en cuisine.
  Le geste est exercé en base, dans les deux sens. ⚠️ **À constater une fois, en service** :
  fermer d'un tap depuis l'espace restaurateur et voir le badge « Fermé » côté client.
- **l'écran admin connecté** : l'admin exige une connexion Google. Ce qui est prouvé : le paquet
  déployé contient bien « Fermer maintenant », « Rendre aux horaires » et
  `admin_set_restaurant_auto_open`, et les deux RPC sont exercées en base.

⚠️ **Chez Bidul & Truc a été fermé à la main le 2026-09-20** (`is_open=false, auto_open=false`).
Il ne rouvrira pas tout seul : c'est au restaurateur de rouvrir, ou de réactiver son ouverture
automatique.

## Heures de service — deux services par jour, cartes à l'heure (2026-09-07)

Chantier ouvert en branchant **Chez Bidul & Truc**, qui sert **midi ET soir** et dont les
**pizzas ne sortent qu'à partir de 18 h**. Migration
`20260907190000_deux_services_par_jour_et_cartes_a_l_heure`.

- ⚠️ **Deux services n'étaient pas « pas prévus » : ils étaient INTERDITS par la clé.**
  `restaurant_hours` avait `primary key (restaurant_id, weekday)` — une seule ligne par jour,
  point. La table porte désormais `service smallint not null default 1`
  (`check (service between 1 and 2)` ; 1 = midi, 2 = soir) et sa clé primaire est
  **`(restaurant_id, weekday, service)`** — vérifié en base. Un restaurant à service unique
  n'utilise que le 1 : la migration ne change rien pour lui.
- **`ouvert_maintenant(restaurants)` est passé en `exists`** : ouvert = il existe **un**
  service du jour, non fermé, dont la plage contient l'heure d'`Indian/Antananarivo`. Le
  calcul de plage est extrait dans **`heure_dans_plage(ouvre, ferme, moment)`**, et il l'est
  exprès : il sert maintenant à **trois** endroits (ouverture du restaurant, disponibilité
  d'une catégorie, garde de `create_order`) — trois copies auraient divergé. Il gère le
  **passage de minuit** (22h → 02h est vraie aux deux bouts).
- **`services_du_jour(r)` rend TOUS les services du jour**, dans l'ordre. `horaires_du_jour(r)`
  survit et rend le **service 1**, le temps que les binaires déjà sur les magasins soient
  remplacés. ⚠️ La fiche restaurant lit `services_du_jour`, pas `horaires_du_jour` : à 18 h,
  un restaurant qui sert midi et soir affichait « Ouvert · 11h30 – 15h » — l'état était juste,
  l'horaire montrait le service **déjà terminé**.
- ⚠️ **`set_restaurant_week_hours` : `service` est OPTIONNEL dans la charge utile et retombe
  sur 1.** C'est ce qui laisse les écrans déjà installés (sept objets sans `service`) piloter
  le midi sans rien casser. Mais s'appuyer là-dessus depuis l'app écraserait silencieusement
  un service du soir sur le midi : `app/data/api.ts` envoie donc **toujours** `service`, même
  à 1. Et « Fermé » ferme **la journée**, donc les DEUX services — n'en remettre qu'un à zéro
  laisserait un service du soir actif en base sur un jour de fermeture.

### Une catégorie peut n'être servie qu'à certaines heures

- **`categories.serving_from` / `serving_to`** (`time`, nullables). **Vide = servie dès que le
  restaurant est ouvert** — c'est le cas de toutes les catégories sauf une, vérifiée en base :
  « Pizza » chez Chez Bidul & Truc, **18:00 → 22:00**. Le verdict est rendu par
  `categorie_servie_maintenant(categories)`, que `getMenu` sélectionne comme colonne calculée.
- ⚠️ Avant, `is_active` était le seul levier, et il est tout ou rien : masquer les pizzas le
  midi obligeait à **les éteindre et les rallumer à la main, deux fois par jour, tous les
  jours**.

### Et le vrai trou : `create_order` ne regardait NI l'ouverture NI l'heure

⚠️ **On pouvait commander à 3 h du matin sur un restaurant fermé.** Mesuré le 2026-09-07 dans
une transaction annulée, Chez Bidul & Truc fermé : « restaurant ouvert ? f | commande acceptée
? t » — TF-107, 19 000 Ar. Le restaurant aurait reçu son message Telegram, avec ses boutons,
sans personne en cuisine. **L'écran grisait le bouton — l'écran n'a jamais été l'autorité** :
la clé anon est publique par conception, l'API REST s'appelle directement.

`create_order` lève désormais deux exceptions, en `errcode = '22023'` :

| Message levé | Quand |
|---|---|
| `service:restaurant_ferme` | `ouvert_maintenant(resto)` est faux |
| <code>service:categorie_hors_service&#124;nom&#124;de&#124;a</code> | la catégorie d'un plat du panier n'est pas servie à cette heure |

- ⚠️ **Le séparateur est `|`, pas `:`** — un nom de catégorie peut contenir un deux-points, et
  le découpage côté app se ferait alors au mauvais endroit.
- ⚠️ **Pas de `to_char()` sur un `time`** : Postgres n'a pas de `to_char(time, text)`. Les
  heures partent en `substring(x::text from 1 for 5)`, soit « 18:00 ».
- Côté app, `refusServiceDepuisErreur()` (`app/data/api.ts`) reconstitue le motif, et
  `checkout.tsx` le teste **avant** le code promo : un restaurant fermé ou une carte pas encore
  ouverte n'est pas un échec technique, et « la commande n'a pas pu être créée » ne dit rien à
  quelqu'un qui vient de composer son panier. Le client doit lire **l'heure à laquelle
  revenir**.
- Côté saisie, l'écran Réglages du partenaire compose les deux services par jour
  (« + Ajouter un service du soir », « Retirer ») ; sa clé interne est `weekday:service`, pas
  `weekday`.

## L'ordre de la carte n'existait pas (2026-09-07)

Migration `20260907200000_la_carte_ne_se_reordonne_plus_toute_seule`.

⚠️ **`products` ne portait aucune colonne d'ordre, et `getMenu` ne demandait aucun `ORDER
BY`.** Sans tri explicite, Postgres rend les lignes dans l'**ordre physique du fichier**, et
une ligne `UPDATE`-ée est réécrite **à la fin**. Chaque changement de prix, chaque rupture
cochée, chaque plat étoilé faisait donc descendre le plat au bas de sa catégorie, **chez le
client, définitivement**. Constaté en posant des labels « contient du porc » chez Chez Bidul &
Truc : le croque-monsieur est passé de la 3e à la 15e place et la croque-madame en dernier,
alors que **rien n'avait bougé à l'écran** — c'est la base qui les avait déplacés. Ce n'est pas
un défaut d'affichage : c'est un ordre qui n'existait pas, et un restaurateur qui range sa
carte ne pouvait pas la ranger.

- Le correctif a **deux moitiés indissociables** : la colonne `products.sort_order` **et** le
  tri explicite `.order('sort_order').order('name')` dans `getMenu`. ⚠️ **Ne jamais retirer cet
  `ORDER BY`** : la colonne seule ne trie rien, et le défaut revient entier et silencieux.
  `name` départage les ex æquo pour que l'ordre reste stable même à rangs égaux.
- Le semis part de `ctid` — la position physique, précisément ce qui servait d'ordre implicite
  — numéroté par dizaines dans chaque catégorie, pour que **rien ne bouge** à l'application de
  la migration. ⚠️ **L'ordre semé est donc celui d'aujourd'hui, déjà partiellement brassé par
  les modifications passées** : il n'y a aucun moyen de retrouver l'ordre d'origine de la carte
  papier, `products` n'ayant même pas de `created_at`. Le figer est le mieux qu'on puisse faire
  sans inventer.
- Les 18 plats de la catégorie « Plat » de Chez Bidul & Truc ont ensuite été remis dans l'ordre
  de sa **carte papier**, relevé sur la photo versionnée à côté — ni alphabétique, ni par prix :
  celui que le restaurateur a choisi.
- Index `products_categorie_ordre_idx (category_id, sort_order)`.
- ⚠️ **Figer l'ordre n'est pas le CHOISIR.** Le restaurateur qui veut remonter sa spécialité en
  tête de catégorie ne pouvait toujours rien faire : l'ordre était simplement figé, et figé sur
  une disposition déjà brassée. Un écran de réordonnancement (« monter » / « descendre » dans
  les Réglages) et sa RPC `set_product_sort_order` sont **en cours dans le répertoire de
  travail, ni commités ni appliqués en base au 2026-09-07** — migration
  `20260907210000_le_restaurateur_range_enfin_sa_carte.sql`. À reprendre là.

## Partage social d'un plat ou d'un restaurant (2026-09-07)

`app/lib/partage.ts` et `app/components/PartageSheet.tsx`, qui exporte **deux** composants :
**`PartageSheet`** (la feuille modale, montée par la fiche produit et par les lignes de menu de
la fiche restaurant) et **`PartageEnLigne`** (la rangée « Partager sur : » annoncée en clair sur
la fiche produit — une icône de partage seule ne se remarque pas, et la fiche est le seul écran
qui a la place).

- ⚠️ **`navigator.share` N'EXISTE PAS sur un navigateur de bureau** — vérifié le 2026-09-07 en
  production : `typeof navigator.share === 'undefined'`. `Share.share` de React Native s'appuie
  dessus côté web, donc le bouton de partage n'y faisait **RIEN, en silence**, l'échec étant
  avalé par le `catch` de `partager()`. Et c'est exactement là que ça compte : un restaurateur
  qui pousse son plat sur la page Facebook de son établissement le fait **depuis un
  ordinateur**. Les trois destinations sont donc explicites et marchent partout (WhatsApp par
  `wa.me`, Facebook par `sharer.php`, copie du lien pour tout le reste), et la feuille système
  n'est proposée que là où **`partageNatifDisponible()`** est vrai.
- ⚠️ **Facebook IGNORE tout texte qu'on lui passe** — le paramètre `quote` ne fonctionne plus
  depuis 2017. Titre, description et image viennent **exclusivement** des balises Open Graph de
  la page ciblée : d'où `/p/<id>` et `/r/<id>`, servis par
  `landing/netlify/functions/partage.mjs`, qui lit Supabase et rend ces balises. Ne jamais
  pointer un partage vers `/product/<id>`, qui est l'app et n'a aucune balise.
- ⚠️ **L'URL est mise DANS `message`, et `url` est laissé vide** dans `Share.share`. C'est
  contre-intuitif et délibéré : quand les deux sont fournis, iOS publie deux éléments distincts
  et la plupart des applications de destination n'en retiennent qu'un — l'URL. Le texte
  disparaît, le destinataire reçoit un lien nu.
- **Le lien partagé est une vraie URL `https://`, jamais le schéma `taxifood://`** : un schéma
  privé n'est même pas cliquable dans WhatsApp et ne fait rien chez qui n'a pas l'app —
  c'est-à-dire exactement la personne qu'on cherche à convertir.
- ⚠️ **`SITE`, dans `app/lib/partage.ts`, est un endroit de PLUS où le domaine doit rester
  aligné**, avec `app.json` (`ios.associatedDomains`, `android.intentFilters`),
  `landing/.well-known/apple-app-site-association` et `landing/.well-known/assetlinks.json`.
  Désaligné, le lien tombe silencieusement dans le navigateur au lieu de l'app.

⚠️ **Le domaine canonique est `taxifoodnosybe.distripro207.com`** — c'est lui que portent
`SITE`, les trois liens de la notification Telegram (suivi, accepter, refuser) et toutes les URL
absolues du site. **Ne pas le confondre avec `taxifood.distripro207.com`, qui est l'app web** :
elle n'a aucune balise Open Graph, et un partage qui la vise ne montre qu'un lien nu.

## Partage des plats du jour, sélections, Facebook (2026-09-16/17)

**Les pages de partage** (`landing/netlify/functions/partage.mjs`) : `/p/` plat, `/r/` restaurant,
`/j/` plats du jour d'un restaurant, `/s/` **sélection multi-restaurants**. Chaque page a son image
Open Graph `…/apercu.jpg`, fabriquée par une fonction Edge.

- ⛔ **La vitrine se déploie DEPUIS `landing/`** — sinon `partage` et `repondre-commande` ne partent
  pas : tous ces liens ET les liens `/a/…` de réponse des restaurants tombent en 404 (payé le
  2026-09-16). Contrôle : `/a/00000000-0000-0000-0000-000000000000/x` → **400**.
- **Sélections** (tables `selections` / `selection_items`, RLS sans aucune policy ni grant, lecture par
  la seule `selection_publique()`, écriture par `admin_creer_selection` / `admin_lister_selections` /
  `admin_desactiver_selection`) : le fondateur choisit jusqu'à 12 plats chez 5 restaurants au plus,
  onglet admin **Sélections**. **Rien n'est figé** : nom, prix et photo relus à chaque ouverture ; un
  plat devenu non commandable disparaît. Le panier étant **mono-restaurant** (`cart.ts`, `canAdd`),
  la page groupe les plats par restaurant et le dit.
- **Charte des images d'aperçu** (`apercu-plats-du-jour`, `apercu-selection`) : photo pleine bord à
  bord, **filet or #FFC72C**, **bandeau rouge #E8342A**, sur-titre or en capitales espacées, titre
  blanc très gras — celle de `visuels-reseaux/gabarit.py`. ⚠️ Le fond brun sombre de la première
  version a été **refusé** par le porteur du projet. Le nom du plat a sa propre ligne (à côté du prix
  il était tronqué : « Poulet b… »). Voile sous les photos en rampe courte (lisible sur une canette
  blanche), encre posée AVANT une photo détourée. ⚠️ **Les deux fonctions se recopient** (primitives
  de dessin) : toute retouche graphique se porte dans LES DEUX. Chaque fichier du dépôt est le texte
  exact du bundle déployé (déploiement par MCP) — relire par `get_edge_function` en cas de doute.
- ⚠️ **Déployer une fonction Edge ne rend pas le nouveau code immédiat** : l'isolate chaud sert
  l'ancien bundle quelques dizaines de secondes. Comparer l'empreinte de l'image avant de conclure.
- ⚠️ **Facebook met en cache, PAR ADRESSE**, titre, texte et image. Le lien `/j/<resto>` étant
  toujours le même, le partage publiait les plats **de la veille**. Le lien porte désormais une
  **empreinte des plats à l'affiche** (`?v=`, FNV-1a sur les identifiants triés), calculée à
  l'identique dans `app/lib/partage.ts` et `partage.mjs`, et posée aussi dans `og:url` et sur
  l'image. Une publication DÉJÀ faite garde son ancien aperçu : seul le débogueur
  https://developers.facebook.com/tools/debug/ (« Scrape Again ») la rafraîchit.
- **Bouton Facebook** : sur un navigateur mobile **sans** `navigator.share` (navigateur intégré de
  Facebook, certains Android), `sharer.php` n'affichait qu'un logo — le lien est maintenant **copié**
  et la feuille le dit. Dans la feuille de partage, on **attend** la fin du partage avant de fermer :
  iOS refuse en silence d'ouvrir une feuille système pendant qu'une autre se referme.
- Liens partagés marqués `utm_source` (whatsapp / lien / systeme) pour la mesure — **jamais
  Facebook**, qui remplace le lien par `og:url`.

### « Enregistrer l'image » (2026-09-18)

**Publier l'IMAGE comme photo, avec le lien dans le texte, rend mieux sur Facebook** qu'une
publication qui porte un lien : le composeur rogne la carte d'aperçu. La feuille de partage
propose donc une quatrième ligne, **« Enregistrer l'image »**.

- ⚠️ **Elle n'apparaît que pour `/j/` (plats du jour) et `/s/` (sélection)** : eux seuls ont une
  image ASSEMBLÉE (`…/apercu.jpg`). Pour `/p/` et `/r/`, l'`og:image` est la photo du plat ou la
  couverture — rien de plus que ce que la fiche montre déjà. `lienApercuImage()` (`app/lib/partage.ts`)
  rend null, et le bouton disparaît. La requête `?v=` est conservée : c'est elle qui identifie les
  plats à l'affiche.
- ⚠️ **AUCUNE DÉPENDANCE NATIVE AJOUTÉE, et c'est le cœur de la décision.** `expo-file-system`,
  `expo-sharing` et `expo-media-library` sont absents du projet : en ajouter un aurait rendu le
  bouton **impossible à livrer en OTA** et aurait exigé un build, donc des semaines avant que
  quiconque en profite. Ce qui est livré marche sur les binaires DÉJÀ installés :
  - **web** : lecture de l'image puis téléchargement sous un nom lisible
    (`taxi-food-plats-du-jour-de-chez-bidul-truc.jpg`) ;
  - **app installée** : l'image s'ouvre dans le navigateur du téléphone, et s'enregistre d'un
    **appui long** (« Ajouter aux photos » sur iOS, « Télécharger l'image » sur Android). La feuille
    reste ouverte et l'écrit — sans cette phrase, le bouton paraîtrait n'avoir rien fait.
- ⚠️ **La vitrine sert l'aperçu avec `access-control-allow-origin: *`** (`partage.mjs`). L'app web
  vit sur `taxifood.distripro207.com`, l'image sur `taxifoodnosybe.distripro207.com` : sans cet
  en-tête le navigateur refuse de lire le fichier, et un `<a download>` inter-domaines est ignoré.
  Le retirer ferait retomber le bouton sur « ouvrir l'image », sans erreur visible.
- ✅ **Le vrai enregistrement dans la galerie est ÉCRIT, pas encore compilé** (2026-09-18) :
  `expo-media-library` + `expo-file-system` installés, plugin et textes d'autorisation **en
  français** dans `app.json`. ⚠️ Les deux modules sont chargés en **`require` paresseux dans un
  `try/catch`** (`modulesGalerie()`, `app/lib/partage.ts`) : ce code part aussi en OTA vers les
  binaires **1.2.1 / 1.2.2, qui n'ont pas ces modules**, et un `import` en tête de fichier les
  ferait planter AU DÉMARRAGE, pas seulement sur le bouton. Sans les modules, ou si l'autorisation
  est refusée, on retombe sur l'ouverture dans le navigateur. **Ne jamais remonter ces `require` en
  haut du fichier** tant que des binaires sans ces modules reçoivent des OTA.
  ⏳ **Aucune OTA publiée depuis cet ajout, et aucun build lancé** : à faire quand le porteur du
  projet le décide (voir « Les commandes » pour les TROIS runtimes).
- Vérifié le 2026-09-18 sur l'app web en production (375 px) : la feuille montre les quatre lignes,
  le téléchargement rend un vrai JPEG (1200×630, `ff d8 ff`, 196 ko) sous le bon nom, et le bouton
  est ABSENT du partage d'un restaurant. ⏳ **Non vérifié sur un téléphone** : l'ouverture de
  l'image et l'appui long sur iOS et Android.

## Ordre du catalogue et « En négociation » (2026-09-16)

- **L'ordre vit en base** (migration `20260916130000_l_ordre_du_catalogue_se_decide_en_base`) : `restaurants.sort_order` (choisi dans l'admin, 10/20/30…) et
  `rang_catalogue`, colonne **générée** = statut d'abord (visible, puis coming_soon, puis hidden),
  rang ensuite. L'app (`listRestaurants`) et la vitrine (`partenaires.js`) trient toutes deux sur
  `rang_catalogue.asc, created_at.asc` — vérifié identique par l'API. Avant : l'app triait par date
  (Taxi Be en tête), la vitrine par `listing_status.asc`, un tri **alphabétique** qui passait les
  « bientôt » avant les ouverts. Pas de vue : `restaurants` porte quatre colonnes calculées.
  ⚠️ Ne jamais antidater `created_at` pour déplacer un restaurant.
- **« En négociation »** remplace « Bientôt disponible » pour TOUT restaurant `coming_soon`, app et
  vitrine (décision du porteur du projet). Clé i18n **à part** `restaurantCard.enNegociation` :
  `comingSoon` sert aussi aux PLATS qui s'annoncent (milkshakes). La liste d'identifiants
  `EN_NEGOCIATION` écrite en dur dans la vitrine a disparu.
- Un restaurant en négociation **n'est plus grisé** (ni carte de l'app, ni vitrine) : ses photos
  doivent donner envie. Seule la commande reste coupée — bouton grisé sur la fiche, refus en base.
  Un restaurant simplement **fermé** reste grisé.

## 🔓 Fuite connue : commission et canal Telegram lisibles par anon (2026-09-16)

Avec la seule clé publiable, `select commission_rate, telegram_chat_id from restaurants` répond.
**Toujours ouvert au 2026-09-17.**

⛔ **Ne pas refaire la fermeture par privilèges de colonne.** Tentée le 2026-09-16 (migration
`20260917091000_la_commission_ne_regarde_personne`) : l'accueil de l'app a répondu **401**, annulée
dans la foulée (`20260917092000_la_commission_attendra`). Cause : `restaurants` porte quatre
**colonnes calculées PostgREST** (`commandable_maintenant`, `horaires_du_jour`, `ouvert_maintenant`,
`services_du_jour`) qui prennent la **ligne entière** — Postgres exige alors le SELECT sur toutes
les colonnes. Le contrôle en SQL direct (`set local role anon; select id, name…`) passait : faux
témoin. **Toujours vérifier un changement de droits par PostgREST, avec la clé publiable et la
requête exacte de l'app.**

Voie qui marchera : sortir les deux colonnes dans une table privée `restaurant_prive` sans grant
public, et adapter les 9 fonctions SECURITY DEFINER qui les lisent ou écrivent ainsi que
`notify-order`. `admin_lister_restaurants()` est déjà en place côté admin.

## Règles produit importantes (déjà implémentées)

- ⚠️ **Labels alimentaires « contient du porc » : on ne tague que ce qui est CONFIRMÉ par le
  restaurateur, jamais par déduction.** Document de référence :
  [docs/LABELS-ALIMENTAIRES.md](docs/LABELS-ALIMENTAIRES.md). Un label est un label de
  confiance : se tromper une fois coûte le client définitivement, et **ne rien afficher vaut
  mieux qu'une supposition**. La déduction se trompe dans les **deux** sens — les pizzas
  « Reine » et « Pepperoni » d'Angelo et de Taxi Be sont au jambon de volaille (les taguer
  aurait fait fuir exactement les clients que le label sert), et à l'inverse la « Terrine foie
  gras » de Chez Bidul & Truc n'en contient pas, alors que la déduction courante l'aurait
  taguée et aurait écarté un plat à 29 000 Ar sans raison. Colonne `products.diet_tags`, posée
  par `set_product_diet_tags`.
- **Un groupe d'options OBLIGATOIRE qui ne propose qu'une seule option disponible se
  pré-remplit** (2026-09-07). ⚠️ « Coché par défaut » **n'existe nulle part en base** —
  `product_options` n'a pas de colonne pour ça : la règle vit dans l'écran produit, et elle est
  **générale**, pas codée en dur pour un restaurant. Sans elle, il reste un tap pour rien et,
  pour qui ne le voit pas, un bouton « Ajouter » grisé inexplicable. ⚠️ Une sélection déjà faite
  l'emporte toujours : la règle **pré-remplit, elle n'écrase jamais**.
- ⚠️ **La rubrique de mise en avant s'appelle « Offre du jour » DES DEUX CÔTÉS du comptoir**
  (2026-09-07) : le partenaire lisait « À l'affiche » dans ses Réglages et le client « Plats du
  jour » sur la fiche — deux noms pour une seule chose. Le libellé de l'écran Réglages est une
  **chaîne EN DUR**, pas une clé traduite, et la **visite guidée le CITE dans les trois
  langues** : renommer l'un sans l'autre envoie le restaurateur chercher une section qui
  n'existe plus. Les deux bougent ensemble, et le nom cité reste le **texte littéral de
  l'écran**, français quelle que soit la langue lue.
- ⚠️ **Les catégories de la page restaurant passent à la ligne** (2026-09-17), plus de rangée qui
  défile horizontalement : les clients ne voyaient pas qu'il fallait la faire glisser et rataient
  « Hamburger », « Dessert »… Chez Bidul & Truc tient en 3 lignes à 375 px. Ne pas remettre de
  `ScrollView horizontal` (`styles.catWrap`, `app/app/restaurant/[id].tsx`). La vitrine et les pages
  de partage n'ont pas de rangée équivalente.
- **Choix structurés, pas de commentaire libre** : les produits « à choix » (kebab, tacos, burgers, pizzas…) utilisent des groupes d'options (radios / cases). Le champ commentaire a été retiré.
- **Suppléments = ingrédients de la composition** (1:1, prix unitaire) ; La Cabane a en plus « Sauce au choix » (obligatoire) + « Sauce supplémentaire » (+2 000 Ar).
- **Frais de livraison : AU KILOMÈTRE depuis le 2026-09-24** — 10 000 Ar jusqu'à 3 km, puis 1 000 Ar par kilomètre entamé. `restaurants.delivery_fee` n'est plus le prix mais le **socle**. Aucun montant n'est écrit en dur dans le code ; l'app, le site et l'admin lisent la base. Voir la section « Livraison au kilomètre » pour la règle complète, les replis et les réglages.
- **Filtre accueil** = `restaurants.food_types` (Pizza, Tacos, Kebab, Burger, Américain, Panini, Crêpe, Milkshake, Tapas) ; un resto multi-types ressort dans chaque filtre. **Les tags sur la carte resto = les CATÉGORIES actives** (emoji + nom), différent des food types.
- **Photos** : `products.photo_url` via `ProductThumb`, logos resto via `RestaurantLogo` (image + repli initiales) ; repli propre si `null`/échec, jamais le nom en texte.
- **GPS OBLIGATOIRE** pour valider une commande (pas d'adressage postal à Nosy Be) : l'écran adresse bloque « Confirmer » tant qu'aucune position n'est captée (`expo-location`) ; refus → réessayer/Réglages, aucun contournement. Adresses enregistrées sans GPS = signalées et bloquées. Utilitaire `getMapsNavigationUrl(lat,lng)` prêt pour un futur back-office livreur. Depuis le 2026-08-17, un **aperçu carte cliquable** (`MapPreview`, voir plus bas) permet de vérifier visuellement la position captée.

## Fonctionnalités livrées le 2026-08-17/18 (build n°5, soumis à TestFlight)

- **Options en grille de chips** (`app/app/product/[id].tsx`) : les groupes d'options s'affichent en chips repliables (flexWrap) façon Uber Eats/Deliveroo au lieu de lignes empilées. Sélectionné = fond `colors.primary` + coche blanche ; non sélectionné = bordure fine. Logique de sélection/prix **inchangée**.
- **Photos de sauces dans les chips** : colonne `product_options.photo_url` (nullable). Vignette ~34px affichée à gauche du libellé quand renseignée (7 sauces à ce jour : Ketchup, Mayonnaise, Andalouse, Algérienne, Blanche, Harissa, Samouraï — bucket Storage `produits`, chemin `sauces/<nom>.png`). Repli silencieux (pas de vignette) si absente ou en échec de chargement.
- **Groupes d'options obligatoires en premier** : tri appliqué dans `getProductDetail` (`app/data/api.ts`) — corrige l'ordre illogique observé sur les tacos (« sauce supplémentaire » payante affichée avant « sauce au choix » obligatoire), appliqué à tous les produits à options.
- **Suggestions d'upsell au panier** (`app/data/suggestions.ts`, `app/app/(tabs)/cart.tsx`) : remplace le bouton générique « Ajouter d'autres plats » par de vraies suggestions **du restaurant courant** — une boisson si le panier n'en contient pas encore, sinon un dessert, avec ajout rapide en un tap. Classification par nom **et** emoji de catégorie (la table `categories` n'a pas de colonne « type » — les catégories boisson comme « Bières »/« Softs »/« Cocktails » ne contiennent jamais le mot « boisson »).
- **Aperçu carte GPS cliquable** (`app/components/MapPreview.tsx`, utilisé dans `app/app/address.tsx`) : tuiles raster **OpenStreetMap** (`tile.openstreetmap.org`) affichées via `<Image>`, **zéro dépendance native, zéro clé API**. Choix fait après échec répété de `npx expo install react-native-maps` (timeouts réseau persistants) — plus léger et sans risque de build pour un simple aperçu. Appui → ouvre l'app de cartes native (Plans iOS / Google Maps). Attribution OSM affichée (obligatoire).
- **Écran de confirmation illustré** (`app/app/confirmation.tsx`) : le logo du restaurant réapparaît, plus la photo de chaque plat/boisson commandé, dans une `ScrollView` (évite l'overflow avec plusieurs articles).
- **Connexion par téléphone + bouton Facebook** : voir section Auth ci-dessous.

## Corrections du retour build 5 + multilingue (2026-08-18, build n°6)

Retour de test TestFlight sur iPhone, 5 points corrigés + 2 chantiers :

- **A1 — Logo du restaurant au panier** : la colonne est **`restaurants.logo_url`** (et non `photo_url`). Le panier mémorise `restaurantLogoUrl` (`app/store/cart.ts`) et l'affiche via `RestaurantLogo` ; repli initiales inchangé.
- **A2 — Grille de chips pour TOUS les groupes d'options** : il n'y avait **aucune condition « single-select »** dans le code — le vrai coupable était la **largeur** des chips (contenu + « + 2 000 Ar » ⇒ une seule par ligne). Corrigé par `flexBasis: '47%'`, libellé et prix empilés, coche hors flux.
- **A3 — Sélecteur d'indicatif pays** (`app/components/PhoneField.tsx`, `app/data/countries.ts`) : drapeau + indicatif, Madagascar par défaut, La Réunion et voisins présents ; placeholder **et** règle de validation dépendants du pays.
- **A4 — Adresse de livraison précise et éditable** : champ « adresse précise » libre avec exemple concret, éditable **après** la géolocalisation. `formatAddressLine` déduplique zone/label — c'est ce qui affichait « Province d'Antsiranana — Province d'Antsiranana » sur les adresses déjà en base, sans migration de données.
- **A5 — Carte native** : l'aperçu précédent n'était **ni un webview ni une lib JS**, mais des **tuiles OSM affichées en `<Image>`**. Remplacé par **`react-native-maps`** (`MapSurface.tsx` = natif, `MapSurface.web.tsx` = repli tuiles, résolution par extension de plateforme Metro : le natif ne part jamais dans le bundle web). ⚠️ **Android exigera une clé Google Maps** (`android.config.googleMaps.apiKey` dans `app.json`) ; iOS utilise MapKit, aucune clé.

### Multilingue FR / EN / IT

- `i18next` + `react-i18next` + `expo-localization`. Tout est dans **`app/lib/i18n.ts`** ; dictionnaires dans **`app/locales/{fr,en,it}.json`** (210 clés, parité vérifiée entre les trois).
- **Français par défaut et langue de repli.** Au 1er lancement on suit la langue du téléphone si elle fait partie des trois. Choix manuel dans **Profil → Langue de l'app** (drapeau + nom), effet immédiat, persisté en AsyncStorage (`taxifood.language`) — donc valable sans compte et conservé après déconnexion. `hydrateLanguage()` est attendu **avant le premier rendu** (`app/app/_layout.tsx`), sinon l'app clignote en français.
- **Périmètre assumé** : tout le **parcours client** + Profil + connexion/rôles + composants partagés sont traduits. Les espaces **restaurant / livreur / admin restent en français** (arbitrage : ce sont des outils internes, le personnel est francophone). Effet de bord accepté : `statusLabel`/`paymentLabel`/`paymentShort` lisent le singleton i18next, donc les badges de statut et libellés de paiement suivent la langue **même** sur les écrans resto/livreur.
- ⚠️ **On ne traduit QUE les libellés d'interface.** Noms de restaurants, de produits, d'options, types de plats (filtre accueil) et motif de refus saisi par le restaurant viennent de la base et s'affichent tels quels.
- Pièges : `closedLabel` était calculé au mapping (`data/api.ts`) donc figé en français — `RestaurantCard` le recalcule maintenant à partir de `opensAt`. Le filtre « Tout » de l'accueil est devenu une sentinelle opaque `'__all__'` (son identifiant ne peut plus servir de libellé).

### Reconnexion des utilisateurs déjà inscrits

- **Diagnostic** : la reconnexion marchait déjà côté Supabase (`verifyOtp` rend bien la session du compte existant). Le bug était en base : le trigger **`handle_new_user` ne recopiait jamais `auth.users.phone` dans `profiles.phone`**. Résultat, `app/index.tsx` voyait `session.phone = null` et renvoyait le client sur l'écran « ton numéro de téléphone » — pour lui redemander le numéro qu'il venait de valider par SMS.
- **Migration `profile_phone_unique_and_otp_phone_sync`** : trigger corrigé (recopie du numéro vérifié), rattrapage des comptes déjà créés, et **index unique partiel `profiles_phone_unique`** sur les seuls chiffres du numéro (`regexp_replace(phone,'[^0-9]','','g')`) — deux profils ne peuvent plus porter le même numéro. Le trigger **ne recopie pas** un numéro déjà pris : la création de compte ne doit jamais échouer sur l'index.
- **App** : `buildSession` retombe sur `user.phone` (numéro déjà vérifié côté Auth) si le profil est vide ; `login-phone.tsx` entre directement dans `/(tabs)` quand la session lue côté serveur porte déjà un numéro, sinon `/` aiguille vers la suite de l'inscription ; `setPhone` traduit la violation `23505` en `PhoneAlreadyUsedError`, affichée proprement sur `app/phone.tsx`.
- **Déconnexion** : déjà présente, Profil → « Se déconnecter » (`app/app/(tabs)/profile.tsx`).
- Contrôles passés en base (transaction annulée) : nouvel inscrit OTP → numéro présent dans `profiles` ✅ · second compte au même numéro → profil créé **sans** numéro, aucune erreur ✅ · écriture directe d'un doublon → refusée par l'index ✅.

## Notifications push (2026-08-18)

**Pourquoi le push et pas le SMS.** Les apps de livraison modernes n'envoient quasiment pas de SMS : le suivi de commande passe en **push** (gratuit, illimité, arrive app fermée), les reçus en **e-mail** (gratuit). Le SMS n'est irremplaçable qu'au seul moment où l'on n'a pas encore d'appareil enregistré : le **code de vérification à l'inscription** — traité à part (voir « OTP par WhatsApp »).

Chaîne complète, sans aucun service tiers payant :

```
app  →  push_tokens          (RPC register_push_token)
orders INSERT / UPDATE  →  triggers orders_notify_new / orders_notify_status  →  pg_net
                        →  Edge Function notify-order  →  API Expo Push  →  APNs / FCM
```

**Trois publics, une seule fonction.** La base dit seulement ce qui vient d'arriver (`event` = `nouvelle` ou `statut`, plus `status` et `picked_up`) ; c'est la fonction Edge qui décide qui prévenir :

| Événement | Prévenu |
|---|---|
| commande créée (`INSERT`, statut `recue`) | le **restaurant** (tout `restaurant_staff` du resto concerné) |
| changement de statut / `picked_up_at` | le **client** |
| passage `en_livraison` **et** `courier_id is null` | en plus, les **livreurs** avec `couriers.is_available = true` |

⚠️ Deux garde-fous à ne pas retirer : une course **déjà attribuée** ne rappelle pas les livreurs, et un livreur **hors service** n'est pas réveillé. Les textes destinés au restaurant et aux livreurs n'existent **qu'en français** (leurs écrans le sont aussi) — le repli `?? set.fr` s'en charge si leur jeton porte une autre langue.

- **Table `push_tokens`** : `token text primary key`, `user_id`, `platform`, `language`, RLS ligne-par-ligne. ⚠️ **La clé primaire est le jeton, pas (user_id, token)** : un appareil = un compte. Si quelqu'un se reconnecte avec un autre compte sur le même téléphone, la ligne **change de propriétaire** au lieu de se dupliquer — sinon l'ancien compte continuerait de recevoir les notifications de commandes d'un autre.
- **RPC** `register_push_token(p_token, p_platform, p_language)` / `unregister_push_token(p_token)` (SECURITY DEFINER). ⚠️ La version à 2 arguments a été **supprimée** en ajoutant `p_language` : PostgREST ne savait pas départager les deux surcharges.
- **Langue portée par le jeton, pas par le profil** : c'est le serveur qui rédige la notification, et le choix de langue vit dans l'AsyncStorage de l'appareil. Un même compte sur deux téléphones réglés différemment reçoit la bonne langue sur chacun. `_layout.tsx` réenregistre le jeton quand `i18n.language` change.
- **Triggers `orders_notify_status`** (`AFTER UPDATE OF status, picked_up_at`) **et `orders_notify_new`** (`AFTER INSERT`), une seule fonction `notify_order_status()` qui branche sur `TG_OP` : appel de l'Edge Function par `net.http_post` (pg_net, asynchrone — la commande n'attend jamais la notification). L'UPDATE écoute **aussi `picked_up_at`** parce que la prise en charge par le livreur ne change pas le statut (`en_livraison` du début à la fin) alors que c'est le moment que le client attend le plus.
- **Secret partagé dans le Vault** (`push_hook_secret`) : `verify_jwt` est désactivé sur la fonction (l'appelant est la base, pas un utilisateur), donc elle vérifie elle-même l'en-tête `x-hook-secret`. Le trigger lit le secret dans le Vault pour l'émettre ; la fonction le relit avec sa clé service_role pour le comparer. Aucune clé en clair, **aucun réglage manuel côté tableau de bord**. `public.push_hook_secret()` n'est exécutable que par `service_role`.
- **Code source** : `supabase/functions/notify-order/index.ts` — **premier répertoire `supabase/` du dépôt**. L'original fait foi ici, pas dans le tableau de bord ; le déploiement se fait par MCP.
- **Textes FR/EN/IT dans la fonction**, volontairement dupliqués des dictionnaires de l'app : le serveur n'a pas accès au bundle. Toute reformulation de `status.*` côté app devrait s'y répercuter. Nom du restaurant et motif d'annulation viennent de la base, **jamais traduits**.
- **Nettoyage automatique** : Expo répond 200 même quand un jeton individuel est mort. Un ticket `DeviceNotRegistered` (app désinstallée) ne guérira jamais → le jeton est supprimé à la volée.
- **App** : `app/lib/push.ts` (enregistrement, ne lève jamais — une notification ratée ne doit pas empêcher de commander), désenregistrement dans `signOut` **avant** `auth.signOut` (la RPC a besoin du jeton d'accès encore valide).
- **Écran ouvert au tap** : décidé **par le serveur** (`data.route`), puisque la même fonction sert trois publics — `/order/[id]`, `/(restaurant)` ou `/(livreur)`. `_layout.tsx` n'ouvre un espace pro **que si le compte porte le rôle ACTIF correspondant** (le jeton suit le compte, pas le rôle) et bascule le `mode` au passage. Repli sur `orderId` seul pour les notifications antérieures restées dans le centre de notifications du téléphone.
- ⚠️ **Rien de tout ça n'est visible sans une build EAS native** : ni Expo Go, ni simulateur, ni web n'obtiennent de jeton (`pushSupported()` renvoie false). Sur iOS, EAS doit détenir une clé APNs (`eas credentials` la provisionne).
- ✅ **Vérifié de bout en bout côté serveur** (jetons de test, base restaurée après) : refus sans secret (403), envoi réel à Expo sur changement de statut, message de prise en charge sur `picked_up_at`, suppression du jeton mort ; puis, pour les trois publics — création → restaurant seul, `en_livraison` sans livreur assigné → client + livreur, avec livreur assigné → client seul, livreur hors service → client seul. Reste à voir sur un vrai téléphone au prochain build.
- ⚠️ **Piège de test** : le compte `techerchristopher@gmail.com` est à la fois client, `restaurant_staff` et `couriers` — un test de destinataires sur ce seul compte ne prouve rien. Utiliser le second compte (`locationscooternosybe@gmail.com`) comme client pur pour distinguer les publics.

## Auth

Trois fournisseurs sont **natifs** depuis le 2026-08-18 (Apple, Google, Facebook) : plus de
redirection navigateur, donc plus jamais le domaine `bmdveawomizjpiebgtkj.supabase.co` visible
à la connexion. Chaque bouton connecte OU inscrit selon que le compte existe déjà — voir la
ligne « Connecte-toi ou crée ton compte en un tap » sur `login.tsx`. Tout est dans
`app/lib/auth.ts`.

- **Apple** — `expo-apple-authentication`, `signInAsync` puis `signInWithIdToken({provider:'apple'})`. Le NOM n'est fourni qu'à la **toute première** connexion, jamais ensuite — recopié dans `profiles` immédiatement, sinon perdu pour de bon. `usesAppleSignIn: true` dans `app.json` (entitlement Apple — nécessite un build **interactif**, voir plus bas). **iOS uniquement, en permanence** — Apple n'exige pas cette option sur Android, aucun équivalent n'existe.
- **Google** — `@react-native-google-signin/google-signin`, `signInWithIdToken({provider:'google'})`. ⚠️ **« Skip nonce check » doit être activé** côté *Authentication → Providers → Google* : les SDK natifs mobiles ne savent pas satisfaire le nonce que Supabase attend par défaut (documenté officiellement par Supabase comme la solution standard pour iOS natif, pas un contournement). **Natif sur iOS ET Android** depuis le 2026-08-19. Trois Client IDs distincts dans Google Cloud, tous dans le même projet (`227662072769` / `taxifoodnosybe`) et tous listés dans *Client IDs* de Supabase : web (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), iOS (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`), Android (`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`). ⚠️ **Le Client ID Android n'est jamais lu par le SDK** (`GoogleSignin.configure` n'a pas de paramètre `androidClientId`) — sur Android, c'est l'**empreinte SHA-1 du keystore de signature** (celui qu'EAS gère, récupérable via `eas credentials --platform android`) qui doit être enregistrée sur ce Client ID dans Google Cloud ; la variable d'env ne sert que de drapeau « configuration faite », comme son équivalent iOS. Testé en conditions réelles sur Android le 2026-08-19 (connexion + position GPS confirmées fonctionnelles par le porteur du projet).
- **Facebook** — `react-native-fbsdk-next` en mode **« Limited Login »** sur iOS : `logInWithPermissions([...], 'limited', nonce)` puis `AuthenticationToken.getAuthenticationTokenIOS()`, dont le JWT part dans `signInWithIdToken({provider:'facebook', token, nonce})`.
  - ⚠️ **C'est bien le Limited Login qu'il faut, pas le flux classique.** `signInWithIdToken` attend un **jeton OIDC signé** (le type `SignInWithIdTokenCredentials` de supabase-js : « OIDC ID token issued by the specified provider »), validé par sa signature. Le jeton d'accès classique de l'API Graph n'est pas un JWT → Supabase répond **« Bad ID token »**. Erreur constatée à l'écran le 2026-08-19 seulement après avoir fait remonter le message brut dans l'UI, les journaux Supabase étant en panne prolongée. Le guide Facebook de Supabase ne mentionne nulle part le Limited Login, ce qui avait envoyé le diagnostic dans la mauvaise direction pendant deux builds.
  - ⚠️ **Le nonce est obligatoire** : le jeton du Limited Login porte toujours un claim `nonce`, et supabase-js impose de fournir la valeur d'origine dès que c'est le cas. Généré via `expo-crypto` et passé des deux côtés (SDK puis Supabase).
  - ⚠️ **Ne pas rétrograder sous la `13.x`** : la 13.0.0 adopte facebook-ios-sdk 17, qui apporte les **privacy manifests** exigés par Apple pour ce SDK depuis mai 2024 — une 12.x risquerait un rejet App Store. Une tentative de pin en 12.2.0 (2026-08-18) reposait sur le diagnostic erroné ci-dessus : inutile, et risquée pour la soumission.
  - Côté Meta : permission `email` à ajouter dans **Use Cases → Authentication and Account Creation** (écran distinct de la config du produit Facebook Login) ; « Allow users without an email » activé côté Supabase en filet de sécurité. ⚠️ Une app déjà autorisée par un compte **ne redemande pas** les nouvelles permissions — il faut la révoquer dans *Facebook → Applications et sites web* pour que le consentement complet réapparaisse.
  - ⚠️ **Sur Android, le Limited Login n'existe pas** — vérifié (doc Meta + rapports de bug Supabase) : c'est une fonctionnalité liée à l'App Tracking Transparency d'Apple, sans équivalent Android. Le SDK Android ne renvoie qu'un jeton d'accès Graph API classique (opaque, pas un JWT), que `signInWithIdToken` ne sait pas vérifier. `facebookNativeAvailable()` (`lib/auth.ts`) est donc **`Platform.OS === 'ios'` en permanence**, pas une limite temporaire. Sur Android, `handleOAuth` bascule automatiquement sur `signInWithOAuth('facebook')` — le flux web classique, déjà générique — sans code supplémentaire. Testé en conditions réelles le 2026-08-19 (`redirectTo` déclenché dans les logs, onglet Chrome ouvert).
- **Téléphone (OTP)**, depuis le 2026-08-17 : écran `app/app/login-phone.tsx`, `signInWithOtp`/`verifyOtp`. Depuis le 2026-08-18 le code part par **WhatsApp**, pas SMS — voir plus bas.
- **E-mail + mot de passe**, depuis le 2026-08-18 : `app/app/login-email.tsx` (connexion + mot de passe oublié) et `app/app/signup.tsx` (création de compte avec nom). Erreurs Supabase traduites en codes métier (`AuthError`), jamais le message anglais brut.
- **Suppression de compte**, depuis le 2026-08-18 : Profil → « Supprimer mon compte », RPC `delete_my_account()` (agit sur `auth.uid()` seul). Les commandes sont **anonymisées**, pas supprimées (`orders.user_id`/`address_id` → NULL) — sinon ça faussait rétroactivement le rapport de clôture et les reversements aux restaurants.
- **Nom du profil** : `app/app/name.tsx`, demandé une seule fois aux comptes **créés par SMS** (l'OTP ne fournit aucun nom). L'aiguillage `app/app/index.tsx` s'appuie sur `session.hasName`, pas sur `fullName` — qui retombe sur « Client » et masquerait le manque.
- **Code de vérification par WhatsApp**, depuis le 2026-08-18 : **aucun fournisseur SMS n'est configuré** (`/otp` répondait `400: Unsupported phone provider`) et le SMS vers Madagascar est facturé à l'unité. Le code passe donc par le **« Send SMS Hook »** de Supabase → Edge Function `send-otp-whatsapp` → WhatsApp Cloud API (quota mensuel gratuit sur les conversations « authentification »). **Rien ne change côté app** : `verifyOtp({ type: 'sms' })` reste correct, `sms` est le nom du canal dans l'API Supabase, pas le transport. Seuls les libellés ont été réécrits (« Code WhatsApp », et l'avertissement que le numéro doit avoir WhatsApp).
  - Sécurité : `verify_jwt` désactivé (l'appelant est Supabase Auth), signature **Standard Webhooks** vérifiée par la fonction elle-même (HMAC-SHA256, comparaison à temps constant, refus au-delà de 5 min → anti-rejeu). Identifiants Meta + secret du hook dans le **Vault**, lus par `whatsapp_hook_config()` réservée à `service_role`. Le code à 6 chiffres n'est **jamais journalisé**.
  - ⚠️ **Inerte tant que les secrets ne sont pas posés** (répond `500 whatsapp not configured`) : il faut une app Meta Business, un numéro WhatsApp Business, un **jeton système permanent** (les temporaires expirent en 24 h) et un **modèle « Authentification » approuvé**. Procédure complète, table de diagnostic des erreurs Meta et SQL de pose des secrets : **[docs/OTP-WHATSAPP.md](docs/OTP-WHATSAPP.md)**.

## Navigation libre (rejet Apple 5.1.1(v), corrigé le 2026-08-22)

**Parcourir Taxi Food ne demande aucun compte.** Restaurants, menus, fiches produit, configurateur d'options, panier : tout est accessible déconnecté. Le compte n'est réclamé qu'au moment de **commander**, parce qu'il faut alors une adresse et un numéro.

C'est un principe, pas un réglage : Apple rejette une app qui met du contenu non personnalisé derrière une inscription. Si un écran de découverte redevient gardé un jour, le rejet reviendra.

- **`app/app/index.tsx`** porte tout l'aiguillage dans une fonction **pure** `destination(session, mode, intent)`, lisible d'un bloc. Pas de session → `/(tabs)`. Les longs commentaires en tête de fichier expliquent chaque garde ; ils valent mieux que ce résumé.
- **La garde est sur le tunnel de commande** (`app/address.tsx`), pas sur les écrans de découverte.
- **`app/store/authIntent.ts`** mémorise en RAM où la personne voulait aller avant de se connecter, pour l'y ramener après. L'intention est **consommée quand elle sert de destination**, jamais avant — sinon on boucle.
- ⚠️ **Le verrou de navigation porte sur la DESTINATION, pas sur un booléen.** Un simple « j'ai déjà navigué » produisait un **écran blanc**, constaté sur appareil : en se déconnectant depuis la sélection de rôle on repasse par `/`, mais expo-router **réutilise l'instance déjà montée** — le booléen valait déjà `true`, l'effet sortait aussitôt, et le `return null` laissait un écran vide sans onglets ni retour.
- ⚠️ **`retourOnglets()` (`app/lib/nav.ts`) et non `router.replace`** pour rentrer dans `(tabs)` : le `replace` empilait un **second** jeu d'onglets par-dessus celui du fond de pile (deux barres d'onglets visibles).
- ⚠️ **Un compte à rôle PRO ACTIF entre DIRECTEMENT dans son espace** — même s'il porte aussi un rôle client (règle élargie le 2026-09-06 ; elle ne visait auparavant que les comptes à rôle unique, et se cassait au premier tap sur « Je commande »). Lui présenter `/role-select`, dont la carte mise en avant était « Je commande », l'envoyait du mauvais côté. C'est très probablement ce qui aurait provoqué un troisième rejet Apple, et c'est ce qui a réellement égaré le premier vrai restaurateur. On sort de l'espace pro par le bouton **« ↔ App client »** de l'en-tête et on y revient par **Profil → « Mon espace partenaire »** (`components/RestaurantHeader.tsx`, `components/CourierHeader.tsx` — **dans `components/`, pas dans les dossiers de routes** : un grep limité aux routes ne les trouve pas).

## Comptes de démonstration (revue Apple)

Trois comptes e-mail + mot de passe, **rôles actifs**, un par public. Identifiants et notes de revue en anglais : **[docs/FICHE-APP-STORE.md](docs/FICHE-APP-STORE.md) § 4** — à recopier dans *App Review Information* à chaque soumission.

⚠️ **Apple veut vérifier chaque type de compte.** Le rejet 2.1(a) du build 17 vient précisément de là : un seul compte fourni, et des notes de revue qui présentaient les espaces professionnels comme hors périmètre. Le relecteur a demandé le rôle restaurant depuis l'app, l'a obtenu en statut `pending`, et n'a donc rien vu.

⚠️ Ces comptes ont été créés **par l'API Auth**, pas par un `INSERT` SQL. Une ligne `auth.users` insérée en SQL laisse huit colonnes de jetons à `NULL` et GoTrue répond « Database error querying schema » à la connexion. Piège déjà rencontré, ne pas le refaire.

⚠️ `auth.users` **n'a pas de contrainte unique sur `email`** : `ON CONFLICT (email)` échoue. Et la table `user_roles` porte `activated_at`, pas `approved_at`.

## 📓 Journal du 2026-09-09 — veille de lancement

Session longue : garde « restaurant ferme », cartes coupees, comptabilite du
rapport, temps reel, canal Telegram du patron, icones refaites, 1.2.1 soumise
sur les deux magasins. **Tout y est consigne, avec les pieges et ce qui reste
ouvert** : [docs/JOURNAL-2026-09-09.md](docs/JOURNAL-2026-09-09.md).

⚠️ La liste « Reste ouvert » de ce journal porte des points **bloquants avant
l'ouverture**, dont le Telegram de La Cabane qui pointe encore sur le patron.

## 📓 Journal du 2026-09-10 — jour de lancement

Boissons de Chez Bidul & Truc, puis **trois defauts remontes par de vrais
testeurs** : la route `/auth/callback` inexistante (personne ne pouvait creer de
compte), une adresse enregistree **en pleine mer**, et l'ecran noir de plusieurs
secondes au chargement du web. Plus la conformite DSA qui rendait l'app
**invisible dans toute l'Union europeenne**.
[docs/JOURNAL-2026-09-10.md](docs/JOURNAL-2026-09-10.md).

⚠️ **Le fil rouge de cette journee : trois fois, le defaut n'etait pas la ou on
le croyait.** Ce qui a tranche a chaque fois, c'est une verification — le DOM, le
code d'Expo, `git log --all`, le catalogue Apple pays par pays — jamais une
hypothese. Avant d'accuser un correctif, verifier ce qui tourne vraiment.

⚠️ **`runtimeVersion: appVersion`** : une mise a jour OTA ne rejoint QUE les
appareils portant le meme numero de version. Un magasin reste sur 1.2.0 pendant
qu'on publie en 1.2.1 = ces utilisateurs ne recevront **jamais** ces correctifs.
Verifier la version reellement servie par chaque magasin avant de promettre
qu'une correction est arrivee.

⚠️ **Le pied de page du Profil ne ment plus** : il lit `Updates.createdAt`, la
date du paquet JavaScript en cours d'execution. C'est desormais un repere
FIABLE pour savoir si une mise a jour est arrivee. L'ancienne constante ecrite a
la main avait induit en erreur deux fois.

## ⚠️ Une correction se livre sur QUATRE surfaces (2026-09-09)

**Le même code `app/` tourne à trois endroits, qui se mettent à jour séparément.
Corriger l'un ne corrige pas les autres.** Oublier la troisième est l'erreur
commise le 2026-09-09 : la garde « restaurant fermé » avait été publiée en OTA
et vérifiée sur mobile, pendant que **le site web restait figé sur le build du
07/09 — 21 commits en retard**. Le client testait sur le web et voyait encore
l'ancien écran ; seule la garde en base empêchait la commande de passer.

| Surface | Comment elle se met à jour | Délai |
|---|---|---|
| **Base Supabase** | migration (MCP + fichier dans `supabase/migrations/`) | immédiat, tout le parc |
| **Apps iOS / Android** | `eas update` sur la branche `production` | au **2ᵉ** lancement de l'app |
| **Site web** (`app/`) | **déploiement Netlify À LA MAIN** | immédiat après la commande |
| **Dashboard admin** (`admin/`) | **déploiement Netlify À LA MAIN**, site distinct | immédiat après la commande |

### Les deux commandes, à lancer ensemble

```bash
# 1. Mobile — UNE PUBLICATION PAR RUNTIME EN MAGASIN (voir l'avertissement ci-dessous)
cd app && npx expo export --platform ios --platform android --output-dir dist-ota
cd app && npx eas update --branch production --message "…" --skip-bundler --input-dir dist-ota --environment production --non-interactive

# 2. Web — NE PAS OUBLIER
cd app && npx expo export -p web --output-dir dist \
  && npx netlify deploy --prod --dir=dist --site=1e13c535-fd25-4027-9188-2b8c178c7f60

# 3. Dashboard admin — SI admin/ a change (site Netlify DIFFERENT)
cd admin && npm run build \
  && npx netlify deploy --prod --dir=out --site=d2e677f5-4db2-46e3-a39f-cc83a18dbc40

# 4. Vitrine — SI landing/ a change. ⚠️ DEPUIS landing/, JAMAIS depuis la racine.
cd landing && npx netlify deploy --prod --dir=. --site=7fd9a34d-15d9-4b0d-a866-1288e48f7eaa
```

- ⛔ **La vitrine se déploie DEPUIS `landing/`.** Son `netlify.toml` y vit, pas à la racine.
  Lancé depuis la racine avec `--dir=landing`, le CLI ne le lit pas : **zéro fonction
  embarquée**, et ni les redirections ni `[images] remote_images` de ce fichier. Payé le
  2026-09-16 : deux déploiements du matin sont partis sans `partage` ni `repondre-commande`.
  Tous les liens `/p/ /r/ /j/ /s/` répondaient 404 — et surtout les liens `/a/…` par
  lesquels les **restaurants répondent aux commandes**. Rétabli le jour même. Contrôle après
  chaque déploiement : `curl -s -o /dev/null -w '%{http_code}' https://taxifoodnosybe.distripro207.com/a/00000000-0000-0000-0000-000000000000/x`
  doit répondre **400** (la fonction refuse le jeton) — un **404** veut dire fonctions absentes.
- ⚠️ **Un déploiement brouillon (sans `--prod`) ne prouve pas les pages de partage** :
  `SUPABASE_URL` et `SUPABASE_ANON_KEY` n'existent qu'en contexte *production* sur ce site, et
  `partage.mjs` renvoie alors vers l'accueil. Il prouve seulement que les fonctions sont embarquées.

- ⚠️ **`--site=<nom>` ne marche plus** : `netlify deploy --site=taxi-food-admin-nosybe` répond
  *« Failed retrieving site data … Not Found »* (constaté le 2026-09-15) alors que le site
  existe. **Utiliser l'ID**, lisible par `npx netlify sites:list`. Les deux IDs sont dans les
  commandes ci-dessus : `1e13c535…` pour le site web, `d2e677f5…` pour l'admin.
- ⛔ **CHANGEMENT NATIF DU 2026-09-18 : `runtimeVersion` est repassé à `"1.2.3"`.** Le prochain
  build embarque **`expo-media-library` et `expo-file-system`** (bouton « Enregistrer l'image » dans
  la galerie). Un binaire qui porte de nouveaux modules natifs ne peut plus partager le runtime des
  anciens : le paragraphe ci-dessous décrit ce qui valait AVANT ce changement, il est conservé pour
  comprendre pourquoi le runtime avait été figé.
  **Conséquence immédiate : une mise à jour à distance se publie désormais en TROIS fois** —
  runtime `1.2.1`, `1.2.2` (les binaires en magasin) et `1.2.3` (le prochain build) — en changeant
  `runtimeVersion` le temps de chaque commande, avec le `trap` habituel, puis `git diff -- app/app.json`
  vide. Tant que la 1.2.3 n'est pas en magasin, une publication sur son runtime ne touche personne :
  elle n'est pas inutile pour autant, c'est elle qui servira au premier lancement du nouveau binaire.
- ⚠️ **Ce qui valait pour la 1.2.3 AVANT le 2026-09-18 : `runtimeVersion` était FIXÉ à `"1.2.2"`** (il suivait
  `appVersion`). Raison : aucun changement natif entre le build 1.2.2 (commit `aa350d4`) et la 1.2.3
  (package.json, package-lock, app.json hors version, eas.json, assets : diff vide), et Apple exige
  un numéro de version supérieur pour tout nouveau build. Une seule OTA sert donc 1.2.2 **et** 1.2.3.
  ⛔ **Au premier changement natif** (module natif, plugin, permission, icône, `app.json` natif) :
  passer `runtimeVersion` à la nouvelle version, sinon une OTA partirait vers des binaires
  incompatibles et les ferait planter. Pour publier sur le runtime **1.2.1**, c'est désormais
  `runtimeVersion` (et plus `expo.version`) qu'il faut changer le temps de la commande.
  Conséquence visible : une OTA publiée depuis la config 1.2.3 affiche « v1.2.3 » dans le pied du
  Profil d'un binaire 1.2.2 — pour identifier le binaire, lire le build number, pas cette ligne.
- ⚠️ **DEUX runtimes coexistent tant que les deux versions sont en magasin.** Une mise à jour
  n'atteint QUE les appareils portant le même numéro de version. Le 2026-09-15, l'Android
  servait la 1.2.2 et l'iOS la 1.2.1 : il a fallu publier **deux fois** le même paquet. Pour la
  version qui n'est plus celle d'`app.json`, changer `expo.version` **le temps de la commande**
  puis le restaurer (un `trap … EXIT` évite de le laisser faux si la commande échoue), et
  vérifier ensuite `git diff -- app/app.json` **vide**. `eas update:list --branch production`
  doit alors montrer une ligne par runtime.

- ⚠️ **eas-cli 18.5 (constaté le 2026-09-15) : la commande ci-dessus ne passe plus depuis un
  terminal non interactif** (Claude Code, CI) — elle exige `--environment`, et en pseudo-terminal
  elle ouvre un menu de choix d'environnement. Procédure utilisée et vérifiée ce jour-là :
  1. `cd app && npx expo export --platform ios --platform android --output-dir dist-ota`
     (les variables viennent de `app/.env`, comme d'habitude) ;
  2. **vérifier les deux paquets AVANT de publier** : `dist-ota/metadata.json` donne le `.hbc` de
     chaque plateforme, qui doit contenir `bmdveawomizjpiebgtkj.supabase.co` et la clé publishable ;
  3. `npx eas update --branch production --message "…" --skip-bundler --input-dir dist-ota --environment production --non-interactive`
     — avec `--skip-bundler`, `--environment` ne sert qu'à satisfaire la CLI : le paquet est déjà
     construit, les variables EAS (vides) ne le touchent pas ; puis supprimer `dist-ota`.
- ⚠️ **`eas update` sans `--environment`.** EAS n'a **aucune** variable
  d'environnement enregistrée côté serveur (vérifié le 2026-09-09) : passer
  `--environment production` fait échouer la commande, et le faire avec
  `--non-interactive` publierait un bundle **sans URL Supabase**. Les variables
  viennent de `app/.env`, dont les 6 valeurs ont été confrontées une à une à
  `eas.json > build.production.env` — identiques.
- ⚠️ **L'admin est un site Netlify SÉPARÉ** (`taxi-food-admin-nosybe`, Next.js
  exporté en statique) et se déploie à la main lui aussi. Oubli constaté le
  2026-09-09 : il était resté sur le build du 05/09, **sans les remboursements
  ni le pilotage du service** — le patron voyait ses commandes mais ne pouvait
  pas agir dessus, et croyait l'outil casse. Verifier avec
  `git log --since=<date du dernier deploiement> -- admin/`.
- ⚠️ **Aucun des sites n'a de déploiement continu depuis GitHub.** Pousser sur
  `main` ne le met pas à jour. Site Netlify `taxi-food-commander`
  (https://taxifood.distripro207.com), `siteId` dans `app/.netlify/state.json`,
  `deploy_source: cli`. C'est exactement le piège des migrations MCP hors dépôt :
  ce qui n'est pas automatique diverge en silence.
### Dernière version dès le premier lancement (2026-09-17)

`app/lib/miseAJour.ts`, appelé par `app/app/_layout.tsx`. Au démarrage natif (jamais web ni dev) :
`checkForUpdateAsync` → `fetchUpdateAsync` → `reloadAsync` pendant l'écran de lancement, **5 s au
plus** au total (sous le filet de 8 s). Passé le délai, l'app s'ouvre et la mise à jour s'applique
au lancement suivant — **jamais de rechargement après coup** (drapeau `abandonne`). **Pas de
boucle** : l'identifiant de la mise à jour pour laquelle on a rechargé est mémorisé
(AsyncStorage `tf_maj_rechargee_pour`). Au **retour au premier plan après ≥ 30 min** : téléchargement
silencieux, rechargement seulement si l'écran est `/` hors espace pro. ⚠️ Ne sert aux **nouvelles
installations** qu'une fois embarqué dans un binaire (1.2.3).

### 🛑 Avant de déboguer quoi que ce soit sur mobile : QUEL BINAIRE tourne ?

**Un binaire tout juste déposé n'est PAS celui du magasin.** `eas submit -p android`
dépose sur la piste **interne** ; la fiche Play publique sert la **production**.
Sur iOS, un build soumis est dans **TestFlight**, pas sur l'App Store.

Le 2026-09-09, plus d'une heure perdue là-dessus : l'appareil tournait sur le
`versionCode 5 (1.2.0)` du 8 septembre pendant qu'on raisonnait sur des builds
déposés en interne, et le diagnostic repartait chaque fois dans le code.

- Lien de test interne Android :
  `https://play.google.com/apps/internaltest/4700730027165144358`
- ⚠️ **Le numéro de version ne distingue rien** : les builds 8, 9 et 10 portaient
  tous `1.2.1`. Seul le **versionCode** (Android) ou le **build number** (iOS)
  identifie un binaire.
- **Si le binaire installé ne correspond pas à celui qu'on vient de déposer, il
  n'y a rien à chercher dans le code.**

⚠️ Et ne pas confondre une convention de plateforme avec un défaut : Telegram
affiche **toujours** une confirmation « Ouvrir le lien » avant d'ouvrir un lien
depuis un bouton de bot. Ce « double clic » touchera tous les restaurateurs.

- **Corriger la base D'ABORD, toujours.** C'est la seule surface qui protège
  tout le parc immédiatement, y compris les versions anciennes qui ne recevront
  jamais l'OTA (un client resté en 1.1.0) et le web tant qu'il n'est pas
  redéployé. L'écran n'est jamais l'autorité : la clé anon est publique et
  `create_order` reste appelable directement.

### Pièges de la publication OTA, rencontrés le 2026-09-16/17

- **Une commande OTA interrompue ne publie rien** : `dist-ota/` resté sur le disque et
  `eas update:list` sans la ligne attendue. Toujours vérifier la liste avant de dire « c'est en ligne ».
- **Chercher un texte dans un paquet Hermes (`.hbc`)** : toute chaîne contenant un caractère non ASCII
  (« é ») y est stockée en **UTF-16**. Une recherche UTF-8 répond « absent » à tort — chercher les
  deux encodages.
- **Changer `expo.version` le temps d'une publication** : restaurer par `trap` **sans changer de
  dossier dans la commande**. Un `cd ..` avant la sortie a fait restaurer `app.json` au mauvais
  endroit (fichier parasite à la racine, `app/app.json` resté en 1.2.1). Vérifier ensuite
  `git diff -- app/app.json` **vide** dans une commande séparée.
- **`deposer-visuel` depuis ce poste** : Python 3.14 (python.org) n'a pas de certificats racine →
  passer par `curl`, secret dans un fichier d'en-tête temporaire (`-H @fichier`, `umask 077`,
  supprimé par `trap`), jamais sur la ligne de commande.

## ⛔ MVola ne doit entrer dans AUCUN build ni aucune mise à jour (2026-09-15)

Consigne du porteur du projet. L'intégration MVola est écrite sur la **branche locale `mvola`**
(copie de travail `taxi-food-nosybe-mvola`, jamais poussée, migrations **non appliquées**).

⚠️ Un code « derrière un interrupteur éteint » **est quand même embarqué** dans le binaire ou le
paquet OTA. Avant tout `eas build`, `eas update` ou `netlify deploy`, sur le commit exact publié :

```bash
git grep -n -i mvola <commit> -- app supabase/functions landing admin
```

Résultat non vide = **ne pas publier**, prévenir le porteur du projet. Vérifié vide le 2026-09-15
pour les builds 1.2.2 (iOS 32, Android 12), les deux OTA et les deux sites.

## Build de production (EAS) — état

- **Compte Apple Developer actif** (Team « jean christopher techer », `CV2FA6NJ75`) ; certificat de distribution + provisioning profile iOS gérés par EAS (Expo server), valides jusqu'à 08/2027.
- `app/eas.json` : profils `development` (dev client), `preview` (interne), `production` (`distribution: "store"`, `autoIncrement: true` → **chaque build de prod incrémente automatiquement `buildNumber`**, ne jamais le fixer à la main), `simulator` (build iOS pour simulateur, jamais soumis). `appVersionSource: "remote"`.
- Bundle ids : iOS `com.chris97416.taxi-food-nosybe`, Android `com.chris97416.taxifoodnosybe` (Android interdit les tirets). Soumission App Store Connect : `submit.production.ios.ascAppId = "6802418114"`.
- **iOS build 1.0.0 (22) — dernier sorti, envoyé à App Store Connect le 2026-08-23.** Répond aux deux rejets du build 17 : catalogue libre sans compte (5.1.1(v)), trois comptes de démonstration à rôles actifs (2.1(a)), entrée directe dans l'espace pro pour un compte à rôle unique, et le correctif de l'écran blanc à la déconnexion. Le build 17 apportait l'authentification native (Apple/Google/Facebook), la suppression de compte et les correctifs des captures App Store. Historique complet des builds 5 à 22 : [docs/SOUMISSION-APPLE.md](docs/SOUMISSION-APPLE.md) et [docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md).
- ⚠️ **Un build touchant les capabilities Apple (Push, Sign In with Apple) doit être lancé par Christopher lui-même, dans son propre terminal, en interactif** (`eas build -p ios --profile production`, **sans** `--non-interactive`). Lancé depuis un outil sans TTY réel, EAS bascule silencieusement en mode non-interactif et réutilise un profil de provisioning obsolète sans jamais contacter Apple — cause exacte de l'échec des builds 7, 8 et 11. Google et Facebook natifs n'ont besoin d'aucune capability côté portail Apple (juste des schémas d'URL dans Info.plist) : un build non-interactif suffirait pour ces deux-là, mais autant garder le même réflexe partout.
- **Android** : builds `development` testés avec succès le 2026-08-19 (émulateur Pixel 8 local, `eas build --profile development --platform android`) — connexion Google native, Facebook (flux web) et position GPS tous confirmés fonctionnels en conditions réelles. **Un bundle de production a depuis été déposé sur le Play Store** (vers le 2026-08-29, en attente de revue au 2026-09-05) — la vérification d'identité du compte n'est donc plus un obstacle. Voir [docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md).

## Ce qui est vérifié vs pas encore

- ✅ Vérifié en web (lectures publiques, sans login) : accueil/filtres/logos/emojis, menu, configurateur d'options + prix temps réel, panier (clé par produit+options), blocage GPS obligatoire + capture (position simulée), `tsc --noEmit`, bundle web.
- ✅ Vérifié côté build iOS : `eas build`/`eas submit` production opérationnels de bout en bout, build 22 **envoyé** le 2026-08-23.
- ✅ Vérifié en navigateur : aiguillage de `destination()` sur les 12 combinaisons de session/rôle/mode, et la déconnexion depuis la sélection de rôle (l'écran blanc ne revient pas).
- ✅ Vérifié en production sur le site : écriture réelle en `waitlist`, refus du `INSERT` direct, limitation de débit non falsifiable, badges chargés et inertes.
- ✅ Vérifié sur appareil réel (iOS, TestFlight) : connexion native Apple/Google/Facebook, suppression de compte, écrans multilingues.
- ✅ Vérifié sur appareil réel (Android, émulateur Pixel 8, 2026-08-19) : connexion Google native, connexion Facebook (flux web), position GPS — testé en conditions réelles, parcours client complet, par le porteur du projet.
- ⏳ **Non testé** : parcours restaurant et livreur sur appareil réel, toutes plateformes. Le build `production` Android est déposé mais **je n'ai pas de retour d'usage dessus** (ni revue Google, ni test terrain). **Recette du build 22 sur appareil** : liste dans [docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md) — notamment un compte SMS neuf (sans nom ni numéro) qui part de « Commander » et doit arriver sur `/address`, et le bouton Retour après connexion qui doit fermer l'app, pas révéler une seconde barre d'onglets.

## 📈 Téléchargements et écran Audience (2026-09-18)

**Le nombre d'installations se lit maintenant dans l'admin**, onglet **📈 Audience**, sans ouvrir la
console Apple. Migrations `20260918120000_telechargements_et_audience` et
`20260918124000_releves_magasins_un_etat_par_jour`, fonction Edge `collecter-telechargements`,
tâche `pg_cron` **`collecte-telechargements`** à 09 h 30 UTC (12 h 30 à Nosy Be).

- **Ce qui est relevé** : rapport App Store Connect `SALES / SUMMARY / DAILY`, un TSV **gzippé**
  (`Accept: application/a-gzip`, ce n'est pas un `content-encoding`). Stocké par (jour, magasin,
  pays, **type de produit**) dans `telechargements_magasins`.
- ⚠️ **On n'additionne pas les types.** `1`, `1F`, `1T` = première installation (iPhone, iPad,
  Apple TV) ; `3…` = ré-installation ; `7…` = mise à jour. L'écran ne compte comme « installation »
  que les `1*` : une mise à jour n'est pas un nouveau client.
- ⚠️ **404 = aucun rapport ce jour-là, pas une panne.** Apple ne publie rien pour une journée sans
  la moindre unité. C'est inscrit comme relevé « vide » — sinon le rattrapage repasse indéfiniment
  sur les mêmes journées, et le journal ne saurait pas distinguer « rien ce jour-là » de « on n'a
  pas regardé ».
- **Rejouable** : `upsert` sur (jour, magasin, pays, type). Vérifié le 2026-09-18 — une collecte
  forcée sur 14 jours puis une collecte normale laissent **5 lignes, somme 5**, et la seconde répond
  `deja_releve` partout.
- ⚠️ **Un index unique PARTIEL ne peut pas servir à un `on conflict` de PostgREST** (il n'envoie
  aucune clause WHERE). L'index `(magasin, jour, statut) where statut <> 'echec'` a fait échouer
  **en silence** toutes les écritures du journal : 14 journées collectées, journal vide. Corrigé par
  un index complet `(magasin, jour)` ET par la remontée de l'erreur d'écriture dans la réponse de la
  fonction — le même défaut ne peut plus passer inaperçu.
- ⚠️ **`pg_cron` est désormais INSTALLÉ** sur ce projet (il ne l'était pas ; c'est ce qui expliquait
  qu'aucun remboursement ne se relance tout seul). Une seule tâche pour l'instant, la collecte.
- **La clé privée Apple (`.p8`) n'est ni dans le dépôt ni dans une conversation** : elle est passée
  du poste au **Vault** par la fonction Edge **`deposer-secret`**, qui réutilise le secret et
  l'**interrupteur** de `deposer-visuel` (`delete from vault.secrets where name =
  'depot_visuel_empreinte'` désarme les deux) et ne peut écrire que six noms en liste blanche
  (`asc_*`, `umami_*`). Elle ne relit jamais un secret.
- **Google Play : rien n'est branché**, et la colonne `magasin` attend. Il faut un compte de service
  Google Cloud lié à la Play Console — geste du porteur du projet, voir `docs/SOUMISSION-ANDROID.md`.
- **Umami** : l'écran renvoie vers les deux tableaux de bord. Pour rapatrier les chiffres ici, il
  faut une **clé d'API par compte** (Umami Cloud → profil → *Settings* → *API keys* → *Create key*,
  base `https://api.umami.is/v1`, en-tête `Authorization: Bearer …`, 50 appels / 15 s). Les clés se
  déposeront par `deposer-secret` (`umami_api_key_vitrine`, `umami_api_key_app`) ; **jamais dans le
  bundle admin**. Non fait : les clés n'existent pas encore.

## 📊 Mesure d'audience — Umami (2026-09-17)

**Umami Cloud, sans cookie** : pas de bandeau de consentement, donc pas de visiteurs européens
qui refusent et disparaissent des chiffres. Script de 2 Ko.

| Surface | Compte Umami | Identifiant | Où il vit |
|---|---|---|---|
| Vitrine + pages de partage `/j/ /r/ /s/ /p/` | techerchristopher@gmail.com | `8be3907d-295a-4b7f-ac06-c398d6a20c57` | `landing/js/mesure.js` |
| App web `taxifood.distripro207.com` | chrisrentanoo@gmail.com | `bff7e721-dac8-4030-b295-5960d0842930` | `app/public/index.html` |

- ⚠️ **Le plan gratuit n'accepte qu'UN site par compte** (« Website limit reached »). D'où deux
  comptes. Ne jamais recopier l'identifiant de la vitrine dans l'app web : les audiences se mélangent.
- `landing/js/mesure.js` est inclus en **synchrone** dans le `<head>` des 12 pages et du modèle de
  `partage.mjs`. Il compte : `telecharger` (magasin), `vers-app`, `contact-whatsapp`, `appel`,
  `reseau-social`, `partage-ouvert` (type + titre de ce qui a été partagé), `demande-rappel`,
  `candidature-livreur`, `video-langue`. Inerte hors du domaine de production.
- **Les téléchargements réels** ne se voient QUE dans les consoles des magasins : les liens Google
  Play sont marqués `referrer=utm_…` par page (Play Console → Acquisition) ; les liens App Store
  le sont par `pt=129322978&ct=<page>&mt=8` (jeton relevé le 2026-09-17, App Analytics → Campagnes →
  « Générer un lien de campagne » ; nom de campagne **30 caractères max**). Apple n'affiche une
  campagne qu'à partir de **5 comptes Apple différents** installés par elle. ⚠️ Les boutons App Store
  de la vitrine passent par `/telecharger/` : leur campagne est donc `vitrine-telecharger`, la page
  d'origine est perdue. Les pages de partage, elles, gardent la leur.
- App web : `app/lib/mesure.ts` (`ajout-panier`, `commande-validee`, `partage` par canal). **Jamais
  de donnée personnelle** dans un événement. Web seulement, silencieux sur l'app installée.
- Liens partagés depuis l'app marqués `utm_source` (whatsapp / lien / systeme) — **pas Facebook**,
  qui remplace le lien par `og:url`.
- **Ne pas se compter soi-même** : ouvrir UNE fois `https://taxifoodnosybe.distripro207.com/?ne-pas-me-compter`
  (et `https://taxifood.distripro207.com/?ne-pas-me-compter` pour l'app web — la mémoire du navigateur
  est propre à chaque site) sur chaque appareil. `?me-compter` annule. Pose `localStorage["umami.disabled"]`,
  que le tracker Umami lit avant chaque envoi. Un **bandeau noir s'affiche à l'ouverture de cette adresse
  et reste jusqu'à un appui** (✕) — demande du porteur du projet, qui ne voyait pas passer la version
  à 5 s. Il s'affiche aussi en cas d'échec (« ce navigateur bloque le stockage »). Jamais sur une visite
  normale. Fait le 2026-09-17 sur le Chrome de l'ordinateur du porteur du projet, pour les deux sites.
- Données à ignorer dans les deux comptes : événements `verification-installation` et visites
  `utm_source=verification` / `test-claude` du 2026-09-17 (tests d'installation).
- Vérifier qu'une surface mesure : sur la page en production, `typeof window.umami === 'object'`, et
  un `POST https://cloud.umami.is/api/send` avec l'identifiant doit répondre **200**.
- ✅ **Google Search Console** (2026-09-17) : propriété **préfixe d'URL**
  `https://taxifoodnosybe.distripro207.com/`, compte techerchristopher@gmail.com, validée par le
  fichier `landing/googlebf483449cdeef436.html`. ⛔ **Ne jamais supprimer ce fichier** : la propriété
  perdrait sa validation. Sitemap `/sitemap.xml` soumis : « Opération effectuée », 8 pages découvertes.
- **Play Console** : rien à configurer. Les chiffres sont dans *Développer les utilisateurs* (Grow
  users) → cartes Acquisition, filtre « Traffic source » ; les liens du site portent
  `utm_source=taxifood-site`, `utm_medium` = vitrine/partage, `utm_campaign` = la page. Au
  2026-09-17 : 23 acquisitions d'appareils sur 28 jours ; la ventilation par source n'a pas été lue.
- ✅ Jeton `pt` App Store posé et déployé le 2026-09-17 (vérifié au clic sur `/telecharger/`).

## Bulle WhatsApp (2026-09-17)

Bulle verte flottante, numéro **+261 36 15 745 21**, message pré-rempli « Bonjour Taxi Food 👋
J'ai une question : » (EN / IT selon la langue). Décidé avec le porteur du projet.

- Vitrine et pages de partage : `landing/js/bulle-whatsapp.js`, inclus après `mesure.js` dans 10
  pages et le modèle de `partage.mjs`. **Pas** sur `/mon-espace/` ni `/telegram/` (outils pro).
- App (native + web) : `app/components/BulleWhatsApp.tsx`, posée dans `app/(tabs)/_layout.tsx`
  (Accueil, Commandes, Profil — **cachée sur Panier**) et sur `restaurant/[id]` (remontée
  au-dessus du bouton « Voir le panier »). Jamais sur les écrans qui valident ni les espaces pro.
- ⚠️ Numéro et message vivent aux DEUX endroits (+ `locales/*.json > bulleWhatsApp`) : les changer
  ensemble.
- Comptée dans Umami : `contact-whatsapp` (vitrine, par `mesure.js`) ; `contact-whatsapp` avec
  `origine: bulle` (app web).
- Livrée le 2026-09-17 : vitrine, app web, OTA runtimes 1.2.2 et 1.2.1 (visible au 2ᵉ lancement).

## Le site de pré-lancement (`landing/`)

**https://taxifoodnosybe.distripro207.com** — site statique, aucun build, aucune dépendance. Déploiement **depuis `landing/`** : `cd landing && npx netlify deploy --prod --dir=. --site=7fd9a34d-15d9-4b0d-a866-1288e48f7eaa` — jamais `--dir=landing` depuis la racine, qui part sans les fonctions (voir « Les commandes » plus haut). Documentation propre : [landing/LISEZ-MOI.md](landing/LISEZ-MOI.md).

✅ **Domaine canonique changé le 2026-09-06 : `taxifood.rentanoo.com` → `taxifoodnosybe.distripro207.com`.** C'est le *primary domain* Netlify du site `taxifood-nosybe-landing`, et toutes les URL absolues des pages (canonical, hreflang, og:image, sitemap, JSON-LD, `Sitemap:` de `robots.txt`) le désignent désormais. Tant qu'elles pointaient sur rentanoo, **le nouveau nom ne pouvait pas être indexé** : le canonical envoyait Google ailleurs.

⚠️ **`taxifood.rentanoo.com` est redirigé, pas coupé** — trois raisons de ne pas le retirer du DNS ni de Netlify : des liens `/p/<id>` partagés sur WhatsApp le portent encore ; les binaires **1.0.0/1.1.0 déjà en ligne sur l'App Store déclarent ce nom** dans leurs Universal Links (`app.json` déclare maintenant les **deux**, ce qui n'existera que dans le prochain build) ; et un 301 transfère à Google ce qui avait été indexé dessus. Les règles vivent dans `landing/_redirects`. ⚠️ **`/.well-known/*` y est explicitement servi en 200 sur l'ancien nom** : iOS et Android **ne suivent pas les redirections** en cherchant `apple-app-site-association` et `assetlinks.json`, un 301 casserait l'association des liens pour toute nouvelle installation des binaires en ligne.

⚠️ **Le *primary domain* Netlify ne redirige RIEN tout seul** (vérifié le 2026-08-24, et ça contredit ce qu'on lit partout) : `taxifood-nosybe-landing.netlify.app` répondait 200 avec le site entier, canonical compris, et Netlify ne pose de `X-Robots-Tag: noindex` que sur les deploy previews et les branch deploys, **jamais en production**. La seule protection est la règle de redirection absolue de `_redirects`.

✅ **Déclaré en Search Console le 2026-09-17** (préfixe d'URL, fichier `googlebf483449cdeef436.html` à la racine de `landing/` — à ne jamais supprimer) et sitemap soumis. Détail dans la section « Mesure ».

**Six pages, deux parcours × trois langues.** Client : `/`, `/en/`, `/it/`. Restaurateur : `/restaurants-partenaires/`, `/en/restaurant-partners/`, `/it/ristoranti-partner/`.

⚠️ **Deux pages distinctes, pas un onglet.** La maquette d'origine cachait le contenu restaurateur en `display:none` — invisible pour Google, et pénalisé. Séparer les URL était la seule façon de référencer les deux offres.

- **La maquette Claude Design (`.dc.html`) n'a pas été livrée telle quelle.** Elle chargeait React + Babel standalone depuis unpkg et recompilait le JSX **dans le navigateur** : ~3 Mo de dépendances externes pour une page de contenu. Remplacée par un runtime maison d'environ 120 lignes qui fait des **mises à jour chirurgicales du DOM** — vérifié en navigateur : le champ de saisie conserve son focus et sa valeur à chaque changement d'état, ce que le re-rendu naïf cassait. **16,98 Mo → 207 ko.**
- **Traductions** : `landing/i18n/{fr,en,it}.json`, **304 clés**, parité vérifiée. Rien n'est traduit à la volée : chaque page sert sa langue en dur, avec `hreflang` réciproques + `x-default`.
- **SEO** : JSON-LD en `@graph` (Organization, WebSite, LocalBusiness, FAQPage), Open Graph par langue, images en WebP + `srcset`, `robots.txt` et `sitemap.xml` couvrant les 6 URL.
- **Sécurité** : en-têtes dans `landing/_headers` (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Vidéos** (`landing/media/`) : `taxi-food-540.mp4` côté client, `resto-540.mp4` côté restaurateur. **Chargées au clic seulement** — une image fixe WebP légère et un `poster` tiennent la place avant. La liaison de Nosy Be ne pardonne pas un `<video autoplay preload>`.
- **Bloc fondateur** : photo + récit personnel, sur les 6 pages, en 3 langues. Le polo au logo Taxi Food est une image générée ; le logo y est **approximé**, pas le vrai fichier — recomposer le vrai laissait un halo visible.
- **Badges App Store / Google Play** (2026-08-24) : **fichiers rapatriés en local** (deux requêtes externes en moins), localisés par langue, ratio Play/Apple de 1,22. Le badge Apple **français est plus large** (viewBox 126,5 contre 119,7 — « Télécharger dans » est plus long) : une largeur unique décalerait la mise en page. La section sombre `#comment` utilise la déclinaison **blanche** d'Apple, sinon le badge noir disparaît. Pour l'instant `pointer-events:none` + pastille « bientôt disponible ».
  - **Le jour du lancement**, trois gestes : envelopper chaque `<img>` dans un `<a href>` vers la fiche, retirer `pointer-events:none`, supprimer les pastilles.
  - ⚠️ Les **licences d'usage** (Apple *Marketing Resources*, formulaire partenaire Google) restent à accepter par le porteur du projet.

### Liste d'attente

Le formulaire écrit réellement en base (`waitlist`), vérifié en soumettant le formulaire en production puis en relisant la ligne.

- ⚠️ **L'écriture directe en table est fermée.** Elle passe par des RPC `SECURITY DEFINER`. Une fois les RPC en place, le `INSERT` direct était **resté ouvert** — un oubli classique : ajouter la porte propre ne ferme pas l'ancienne. Le POST répond désormais 401 (`42501`), la RPC 204.
- ⚠️ **La limitation de débit lisait la MAUVAISE valeur de `x-forwarded-for`.** Elle prenait la **première**, que le client contrôle : il suffisait d'envoyer une fausse IP à chaque requête pour ne jamais être limité. Elle lit maintenant la **dernière** (celle posée par le proxy). Vérifié : 7 requêtes avec 7 fausses IP, bloquées dès la 4ᵉ.
- ⚠️ **La normalisation des téléphones laissait passer des doublons** : `+261 34 11 111 11` et `0261341111111` donnaient deux clés différentes. `normaliser_telephone()` traite le préfixe `00`, le `0` national et la forme à 9 chiffres. L'index unique a **refusé de se construire** tant que les doublons de test n'étaient pas purgés — ce qui prouve la correction.

## 🎨 Visuels réseaux, boissons et série animée (2026-09-09/10)

**Toute la communication visuelle sort d'un seul gabarit Python, versionné dans
[`visuels-reseaux/`](visuels-reseaux/LISEZ-MOI.md).** Un visuel = une entrée dans `plats.py` +
`python3 rendre.py <slug>`. Rien ne se dessine à la main, rien ne se règle au cas par cas.

⚠️ **La chaîne a d'abord vécu dans le conteneur éphémère d'une session Claude** — donc à un
effacement près de disparaître avec les 8 visuels déjà produits. Versionnée le 2026-09-10.
`partenaire /` et `motion design /` sont **hors dépôt** (`.gitignore`) : tout document de
travail qui doit survivre va dans `visuels-reseaux/`, pas à côté des photos.

### Le gabarit, et pourquoi il se vérifie tout seul

`rendre.py` refuse de dire CONFORME tant que trois mesures ne passent pas, chacune née d'une
erreur réelle :

| Contrôle | L'erreur qu'il empêche |
|---|---|
| bas du badge Google Play **== 0 px** du bas du bloc promo | l'écart avait été *estimé* à 38 px ; mesuré au `getBoundingClientRect`, c'était **40**. D'où `COL_H = 401`. |
| ligne d'ingrédients sur **UNE** ligne | le format story multipliait tout par k = 1,34 — faux : **une story n'agrandit rien**, même largeur qu'un carré, seule la photo grandit. À deux lignes, tout le bas du visuel se décale. |
| **≥ 20 px** d'air entre le plat et la pastille du logo, le QR **et** le badge promo | un décalage `dx` par pizza a été essayé : **2 sur 8** seulement passaient. Et l'air se mesure sur le **masque alpha réel**, pas sur un cercle équivalent — sur un panini de 1,95:1 l'approximation se trompait de 100 px. |

💡 **Placement de série, pas placement par plat** (`DEBORD_W/CX/BAS` = 760/572/685, identiques
pour les huit pizzas). Le `dx` au cas par cas donnait *une collection, pas une série* — huit
tailles de pizza différentes. Le problème de fond n'était pas l'air, c'était la cohérence.

💡 **Détourage par la COULEUR** (`detourage.py`) — **valable pour les pizzas seulement.** Le
fond studio et l'ardoise sont neutres (R−B mesuré = 0,0), la nourriture reste chaude même
carbonisée (R−B jusqu'à 100) → seuil `R − B > 12`, plus `luminance > 120` pour le fromage
blanc. Deux méthodes échouées avant : le **contour convexe** pontait la croûte brûlée vers
l'ardoise ; la **médiane polaire** mordait dans les croûtes pâles.

⛔ **Ce détourage ne tient PAS les plats posés à plat** (burger, sandwich, tacos). Mesuré sur
La Cabane : le résidu d'ardoise sous les frites fait **lum 36 / R−B 60**, le steak saisi
**42 / 59**. C'est l'ombre chaude des frites sur la pierre — chromatiquement identique à de la
viande grillée. **Aucun seuil ne les sépare** ; s'acharner sur les paramètres est une perte de
temps.

💡 **Pour tout le reste : `packshot.py`.** Trois temps. 1. `gpt_image_2` **régénère** la photo
réelle sur fond blanc — plat identique, ardoise et accessoires retirés (prompt : « EXACT same
dish », liste des composants à garder, puis REMOVE the slate/backdrop/props/shadows, et
toujours no text / no logo). 2. `remove_background` de Higgsfield sort l'alpha. 3. `packshot.py`
pose l'**ombre de contact**, tirée de la silhouette du plat lui-même (bande basse de l'alpha,
écrasée, floutée) — pas une ellipse générique : un kebab ne se pose pas comme un burger.
⚠️ Chaque régénération se regarde **à côté de l'original** avant d'être gardée.

### Le fond et la pastille appartiennent à la SÉRIE

Trois choses ne sont plus dans le gabarit mais dans la série, parce qu'elles dépendent de la
forme des plats :

| | `SERIE_PIZZA` | `SERIE_CABANE` |
|---|---|---|
| boîte du plat | 760 × 1000, cx 572, bas 685 | 820 × 520, cx 640, bas 600 |
| fond | `studio` | `creme` |
| pastille code | 186 px en (14, 20) | 206 px en (26, 40) |

- ⚠️ **`SERIE_PIZZA['haut']` vaut 1000, pas 760.** À 760 les pizzas un peu plus hautes que
  larges étaient rabotées de 12 px et la série validée changeait sous nos pieds.
- ⚠️ **Le fond sombre est fait pour les pizzas.** Un tacos, un kebab, un panini sont beiges :
  sur anthracite ils virent au terne, et le pain du burger s'y noie. Rouge et ambre écartés
  aussi (le rouge noie le filet or, l'ambre est la même famille de teinte que le pain).
- ⚠️ **La pastille du code promo est plus petite sur les pizzas** (186 contre 206) : une pizza
  ronde de 760 px occupe déjà le coin haut-gauche et la chevauchait de 8 à 20 px. Taille
  cherchée par balayage sur les huit, pas estimée.
- ⚠️ **Piège du sélecteur.** La pastille contient elle aussi « 1re commande » et un
  `border-radius` : le contrôle qui identifiait le bloc promo par son texte désignait le badge
  — écart **−751 px** au lieu de 0. Il prend désormais le plus bas des candidats. Ne jamais
  identifier un élément par son seul texte quand le gabarit peut le répéter ailleurs.

`rendre.py` mesure maintenant **trois** distances au plat : pastille du logo, QR, et badge.

⚠️ Google Fonts doit être **bloqué** (`pg.route('**://fonts.g**', abort)`) pendant les rendus
Playwright, sinon la page ne finit jamais de charger. Archivo est installée en local.

### Les quatre gestes du mode d'emploi

Ordre arrêté par le porteur du projet, **le code promo est le 3ᵉ** (il se tape à la commande,
avant la livraison) : 1. tu choisis le restaurant et tes plats · 2. **tu te géolocalises** ·
3. **tu tapes ton code** · 4. on te livre, tu paies à l'arrivée.

Les gestes 2 et 3 sont les seuls que personne à Nosy Be ne connaît — ce sont eux qu'on montre
le plus longtemps. Le bloc promo **tutoie** (« Tape le code »), comme tout le reste des
visuels. Textes prêts : `visuels-reseaux/TEXTES_RESEAUX_BIDUL_TRUC.md`. **La nouveauté ouvre
toujours le post** (« Nouveau à Nosy Be : … »), trois blocs, jamais cinq.

### Numéro de téléphone — changé le 2026-09-10

**`+261 36 15 74 521`** (composé `036 15 74 521`). Remplace `+261 37 34 379 12` **partout sur
le site**, déployé le 2026-09-10.

⚠️ **Le site écrit le numéro de TROIS façons**, pas deux : `tel:+261361574521`,
`wa.me/261361574521`, et l'affichage espacé **2-2-2-3** (`+261 36 15 74 521`). La première
passe en a raté 10 en n'anticipant que deux formes. Et les **`landing/i18n/*.json`** portaient
encore l'ancien numéro à 3 clés × 3 langues (`client.noscript.whatsappLink`,
`resto.noscript.phoneLink`, `resto.contact.phone`) : ces fichiers ne sont **pas** chargés au
runtime, mais ils sont la source des pages — corrigés le 2026-09-10.

⚠️ `perl -pi` sur le dossier monté laisse des orphelins **`.fuse_hidden…`** qui portent
l'ANCIEN contenu et qu'on ne peut ni supprimer ni déplacer sur le moment (ils s'effacent seuls
plus tard). Ils sont désormais dans `.gitignore` : sans ça, un `git add .` publie une copie du
fichier d'avant correction.

### Boissons — tout passer en canette

**11 packshots** générés à partir de photos réelles prises au bar (Higgsfield `gpt_image_2`,
2048², fond blanc), dans `partenaire /bidul et truc /pub /boissons-packshots/`.

- ✅ **Chez Bidul & Truc : ses 10 boissons sont déjà nommées en canettes** (« THB 50 cl »,
  « Beaufort 33 cl », « Caprice Grenadine 33 cl »…) → correspondance 10/10, **aucun renommage**.
  4 n'avaient aucune image, 3 en avaient une fausse.
- ⛔ **Angelo, La Cabane, Taxi Be gardent leurs images** : leurs produits s'appellent « THB PM »
  / « GM » = *petit* et *grand modèle*, donc des **bouteilles**. Y coller une canette 50 cl,
  c'est remplacer une image fausse par une autre. Renommer leurs produits en formats canette
  supposerait de revoir les prix — décision commerciale, **en attente**.
- ⚠️ **`thb-pm.jpg` est un verre vide**, et il illustre le THB PM en vente chez Angelo, La
  Cabane et Taxi Be entre 6 000 et 7 000 Ar. Pire visuel du catalogue. Il faut une photo de la
  **bouteille 33 cl**. `caprice-grenadine.png` est une **bouteille de sirop** — autre produit.
- Le téléversement demande `is_admin()` sur le bucket `boissons` : il revient à Claude Code ou
  au tableau de bord. Prompt prêt : `visuels-reseaux/PROMPT_CLAUDE_CODE_CANETTES.md`.

### Série animée « Maki » — Story / TikTok

Un mini dessin animé par épisode, un maki livreur Taxi Food comme personnage récurrent.
Gabarit d'épisode en 8 plans : `visuels-reseaux/SERIE_MAKI_GABARIT_EPISODE.md`. Registre des
éléments Higgsfield (le maki, la famille, les 11 canettes, le top-case, le sticker) :
`visuels-reseaux/ELEMENTS_HIGGSFIELD.md`.

Règles arrêtées, valables aussi hors série :

- ⚠️ **L'IA ne dessine JAMAIS un logo ni du texte.** La marque vient des éléments validés
  (top-case, sticker) et du **carton de fin en Remotion**. Appliqué au refus du Coca-Cola, au
  casque du maki, au carton de pizza (on écrit **MATSIRO**, « délicieux » en malgache) et au
  tee-shirt du petit garçon — une première génération avait inventé un écusson de football
  illisible, qui aurait changé à chaque plan.
- **Le monde est dessiné, la vraie photo n'arrive qu'au carton de fin** (le visuel produit
  existant, animé). C'est ce qui résout le problème d'appétit sans casser le cartoon.
- **Deux images pour une vidéo** : générer l'image B *à partir de* l'image A, sinon le décor se
  transforme entre les plans. Trois images = deux clips, raccordés en Remotion.
- 💡 **Modèle vidéo : Wan 3.0 (`wan3_0`)**, 1080p, `start_image` + `end_image`. **MiniMax H3 a
  échoué deux fois** sur les mêmes jobs, crédits disponibles — ce n'était pas un problème de
  quota. Limite du plan : **8 jobs simultanés** maximum.
- ⚠️ Le maki est un **maki catta** (face blanche, triangles noirs sur les yeux, museau court,
  queue annelée noir et blanc tenue en S). Une première version disait « museau de renard » et
  interdisait la queue annelée : il ressemblait à un renard. Ne pas réintroduire ces deux
  formulations.

## Conventions

- Dépôt git **isolé** dans `taxi-food-nosybe/`. GitHub : https://github.com/techerchristopher-dotcom/taxi-food-nosybe . **Commit + push (HTTPS, pas SSH) après chaque étape.**
- ⚠️ **Ne jamais committer depuis un répertoire parent.** `/Users/christopher` est lui-même couvert par un dépôt git : un `git add` lancé d'un cran au-dessus embarque le home entier.
- ⚠️ **Secrets.** `app/.env` est git-ignoré et doit le rester. La clé **anon/publishable** y est publique par conception (la RLS protège) ; la clé **`service_role` n'y a jamais sa place**. Les identifiants Meta/WhatsApp et l'App Secret Facebook ne transitent pas par la conversation — ils vont dans le Vault Supabase. Une clé privée Firebase a déjà traîné dans le dépôt (commit `84fe5c9`) : `.gitignore` couvre désormais `*firebase-adminsdk*.json`.
- ⚠️ **La base Supabase est la base de PRODUCTION.** Pas de bac à sable. Tout test à effet de bord se fait dans une transaction annulée, et les lignes de test se nettoient.
- ⚠️ **Avancer point par point.** Consigne explicite du porteur du projet : vérifier chaque correctif isolément avant de passer au suivant, plutôt que d'empiler les changements et de tout casser d'un coup.
- Après toute migration touchant le schéma : penser à régénérer les types si un fichier `db-types` est réintroduit (actuellement les types sont mappés à la main dans `app/data/api.ts`).
- ⚠️ **Tester une RPC à effet de bord en SQL** : utiliser `select * from create_order(...)` (une seule évaluation). **Jamais `select (create_order(...)).*`** : l'expansion `.*` d'un type composite évalue la fonction **une fois par colonne** → autant d'insertions parasites. Et pour reproduire un souci RLS, tester sous `set local role authenticated` + `set_config('request.jwt.claims', ...)` dans une transaction annulée — sinon on tourne en superuser et la RLS est ignorée (le bug reste invisible).
- ⚠️ **`revoke ... from public` ne retire PAS `anon` / `authenticated`.** Supabase pose un `ALTER DEFAULT PRIVILEGES` qui accorde `EXECUTE` à ces deux **rôles nommés** sur **toute** fonction nouvellement créée dans `public`. `PUBLIC` est une notion distincte : le révoquer laisse les grants nommés intacts. Pour verrouiller une fonction interne, révoquer **explicitement** chaque rôle *et* `public` séparément, puis vérifier dans `pg_proc.proacl` (`=X/postgres` = grant PUBLIC résiduel).
- ⚠️ **Une fonction trigger n'a pas besoin du droit `EXECUTE` pour se déclencher** : PostgreSQL le vérifie **au `CREATE TRIGGER`**, pas à chaque tir. Révoquer `EXECUTE` sur une fonction trigger la retire de l'API REST sans casser le trigger (vérifié expérimentalement sur `notify_order_status`).
- 💡 **Lire le résultat d'un test SQL par MCP** : `RAISE NOTICE` n'est pas remonté par `execute_sql`. Accumuler le résultat dans une variable `text` puis `raise exception 'RESULTAT >>> %', v_out` — ça affiche **et** annule la transaction, donc le test ne laisse aucune trace.
- 💡 **Diagnostiquer un flux d'auth natif (Apple/Google/Facebook) sans les logs** : `query_logs` sur `auth_logs` a connu des pannes prolongées côté Supabase (« Backend error », service entier indisponible, pas juste cette table). En repli : interroger directement `auth.users` / `auth.identities` (`created_at`, `last_sign_in_at`) — ça dit si une tentative a **atteint** Supabase et créé quelque chose, ce qui suffit souvent à localiser le problème (avant vs après l'échange avec le fournisseur) sans avoir besoin du message d'erreur exact.
- 💡 **`npx expo install` ajoute les plugins natifs SANS leurs options.** Vérifié deux fois le 2026-08-18 (`@react-native-google-signin/google-signin` et `react-native-fbsdk-next`) : l'entrée nue route vers une branche de config différente (souvent Firebase) qui exige un fichier absent et **fait échouer la compilation native**. Toujours lire le code du plugin (`node_modules/<pkg>/plugin/`) avant de laisser l'entrée telle quelle, et lui donner ses options explicitement.
- ⚠️ **Les prix et les contenus produits viennent de la base** : jamais traduits, jamais écrits en dur, ni dans l'app, ni sur le site.
- Documentation en français.
- Docs de référence : `CAHIER-DES-CHARGES-MVP.md`, `SCHEMA-TAXI-FOOD.md`, `PROMPT_BUILD_APP_CLIENT.md`.
