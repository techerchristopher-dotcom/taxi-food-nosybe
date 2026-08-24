# RETOUR_MALGACHE.md

**Rapport de collecte — le malgache dans les dépôts Taxi Food.**
Établi le 2026-08-24. Mission de lecture seule : aucun fichier de traduction n'a été
modifié, complété ni nettoyé.

---

## La réponse en une ligne, avant tout le reste

**Il n'y a aucun malgache nulle part.** Pas un fichier, pas une clé, pas une chaîne,
pas un commentaire, pas une note. Ni dans l'application, ni sur le site, ni en base,
ni dans les fonctions serveur, ni dans l'historique git.

Ce n'est pas « partiel », ni « automatique », ni « non relu ». C'est **inexistant**.

**Conséquence directe sur ta décision de la section 3 :** la version forte — film
entièrement en malgache avec les mots de l'application — **n'est pas disponible**,
parce qu'il n'existe aucun mot d'application en malgache à reprendre. Il reste la
version prudente : **image française, voix malgache**. Ce n'est pas un choix de
prudence, c'est le seul possible en l'état.

### Comment je l'ai vérifié

| Vérification | Commande | Résultat |
|---|---|---|
| Fichier de locale `mg` | `ls app/locales/` | `en.json`, `fr.json`, `it.json` — rien d'autre |
| Langues déclarées | `app/lib/i18n.ts:33` | `const SUPPORTED: LanguageCode[] = ['fr', 'en', 'it']` |
| Fichier nommé `*mg*` / `*malag*` / `*mlg*` | `find` sur les 3 dépôts | aucun |
| Le mot « malgache / Malagasy » | `grep -ri` sur les 3 dépôts | 6 occurrences, **toutes** l'adjectif dans un commentaire ou un texte descriptif — aucune traduction |
| `mg.json` dans l'historique git | `git log --all -S'mg.json'` | jamais ajouté, jamais supprimé |
| Colonne de traduction en base | `information_schema.columns` sur `(lang\|locale\|_mg\|translat\|i18n)` | une seule : `push_tokens.language` (valeurs présentes : `fr`) |
| `mg` dans le sélecteur du site | `grep` sur `landing/` | absent — **conforme à ta consigne** |

Les 6 occurrences du mot, pour que tu puisses juger toi-même :

| Fichier | Ligne | Texte |
|---|---|---|
| `app/data/countries.ts` | 4 | « Nosy Be est une destination touristique : les clients ne sont pas tous malgaches. » |
| `app/components/PhoneField.tsx` | 14 | « clients non malgaches (La Réunion en premier lieu). » |
| `app/app/login-phone.tsx` | 43 | « pas de règle malgache figée » |
| `landing/i18n/fr.json` | 185 | « …avec le patron d'une pizzeria malgache » (texte alternatif d'image) |
| `landing/i18n/en.json` | 185 | « …the owner of a Malagasy pizzeria » |
| `landing/restaurants-partenaires/index.html` | 534 | le même texte alternatif, rendu |

---

## 1. Où est le malgache

**Nulle part.** Section remplie quand même, parce que l'absence a une forme :

- **Dépôts concernés** : trois dépôts examinés — `taxi-food-nosybe`, `addition-appli`,
  `studioshot`. Aucun ne contient de malgache.
- **Code de locale utilisé** : `—`. Aucun code `mg`, `mg-MG` ni `mlg` n'existe. Le seul
  endroit où un code de langue est stocké est `push_tokens.language`, qui ne contient
  aujourd'hui que `fr`.
- **Chemin de chaque fichier malgache** : `—`.
- **Date, commit, message** : `—`. Le malgache n'a jamais été ajouté.
- **Couverture chiffrée** : **0 clé sur 275** pour l'application, **0 sur 305** pour le
  site.
- **Activé en production ?** `—`. Rien à activer.

### Ce qui existe à la place

| Périmètre | Langues | Clés | Fichiers |
|---|---|---|---|
| Application — espace **client** | fr, en, it | 275 par langue | `app/locales/{fr,en,it}.json` |
| Application — espace **restaurant** | **français seul, hors i18n** | 0 | textes en dur dans `app/app/(restaurant)/*.tsx` |
| Application — espace **livreur** | **français seul, hors i18n** | 0 | textes en dur dans `app/app/(livreur)/*.tsx` |
| Site de pré-lancement | fr, en, it | 305 par langue | `landing/i18n/{fr,en,it}.json` |
| Notifications push — client | fr, en, it | 6 messages | `supabase/functions/notify-order/index.ts` |
| Notifications push — resto & livreur | **français seul** | 2 messages | même fichier, lignes 111 et 116 |

**Mesure à l'appui** : `t()` est appelé **74 fois** dans les écrans client
(`app/app/(tabs)/*.tsx`), et **0 fois** dans les 4 fichiers de l'espace restaurant comme
dans les 3 de l'espace livreur.

---

## 2. Le dump intégral

**Néant.** Il n'existe aucun fichier malgache à recopier.

Le français correspondant existe, lui, et je le donne en regard dans les tableaux de la
section 4 — c'est la seule forme utile que puisse prendre cette section.

---

## 3. La provenance — la question qui décide de tout

- **Qui a produit ces traductions ?** Personne. Aucune traduction malgache n'existe.
- **Sur quoi je me base** : les sept vérifications du tableau d'en-tête, et en
  particulier `git log --all -S'mg.json'` qui ne renvoie rien — le fichier n'a jamais
  existé, y compris dans une branche abandonnée.
- **Relecture par un natif ?** Sans objet.
- **Quelle variante — merina ou dialecte du Nord ?** **La question ne s'est jamais
  posée dans le projet.** Aucun commit, aucun commentaire, aucun document n'en parle.

### Une précision qui a son importance

La question *a* été étudiée, mais **en dehors du code** : une étude de faisabilité menée
le 2026-08-24 dans cette conversation a conclu de **ne pas** traduire le site en
malgache. Ses éléments, s'ils te servent :

- le malgache officiel écrit est fondé sur le **merina d'Antananarivo** ;
- Nosy Be relève du **sakalava du Nord-Ouest / antankarana** — distance lexicale au
  merina mesurée à **0,387**, soit aussi loin que l'antandroy de l'extrême sud ;
- un habitant scolarisé **lit** le malgache officiel sans peine (DIANA : 83,2 %
  d'alphabétisation en malgache), mais il le lit comme la langue des plateaux ;
- trois essais de traduction par modèle de langue ont été notés **3/10, 4/10 et 4/10**
  par des relecteurs indépendants, avec les **mêmes fautes dans les trois**.

⚠️ **Rien de tout cela n'est du contenu vérifié.** C'est une étude, pas une traduction.
Aucune de ces chaînes n'a été écrite dans le code, et aucune ne doit servir de source
pour un film.

### Verdict pour tes deux formats

> **Format à retenir : image française, voix malgache.**

La version « entièrement en malgache avec les mots exacts de l'application » suppose une
interface malgache réelle et relue. Il n'y en a pas, et il n'y en a jamais eu.

---

## 4. Les chaînes d'interface des films

**La colonne « Malgache dans l'app » est `—` partout.** Elle n'est pas vide par
négligence : la chaîne n'existe pas.

J'ai rempli la colonne « Clé de l'app » quand même : elle te dit *où* vivrait la chaîne
le jour où quelqu'un la traduirait, et elle distingue trois cas très différents — une
clé i18n, un texte français **en dur** dans le composant, ou une donnée **en base**.
La colonne « Note » signale quand le français de l'app diffère de ton libellé de film.

### 4A — Film client

| Clé film | Français à l'écran | Malgache dans l'app | Clé de l'app | Note |
|---|---|---|---|---|
| `scOrder` | Commande | — | tracking.headerTitle | l'app ecrit « Commande #{{number}} » |
| `scToday` | Aujourd'hui | — | — | pas une chaine i18n : construit par formatDay(), data/types.ts:321-331 |
| `scDelivered` | Livrée | — | status.livree |  |
| `scBonAppetit` | Bon appétit ! Merci d'avoir commandé avec Taxi Food. | — | notify-order:92 | notification push, pas un ecran |
| `scSteps 1a` | Commande reçue | — | tracking.steps.receivedTitle |  |
| `scSteps 1b` | Transmise au restaurant | — | tracking.steps.receivedHead | l'app dit « Le restaurant va confirmer dans un instant » |
| `scSteps 2a` | Confirmée par le restaurant | — | tracking.steps.confirmedTitle |  |
| `scSteps 2b` | Préparation dans ~20 min | — | tracking.steps.confirmedSub | identique |
| `scSteps 3a` | En préparation | — | tracking.steps.preparingTitle |  |
| `scSteps 3b` | En cuisine | — | tracking.steps.preparingSub | identique |
| `scSteps 4a` | En livraison | — | tracking.steps.deliveringTitle |  |
| `scSteps 4b` | Le livreur est arrivé | — | tracking.steps.deliveringSub | l'app dit « Le livreur arrive » (present) |
| `scSteps 5a` | Livrée | — | tracking.steps.deliveredTitle |  |
| `scSteps 5b` | Payée en espèces au livreur | — | tracking.payToCourier | l'app : « Paiement en {{method}} au livreur » |
| `scRecap` | RÉCAPITULATIF | — | tracking.summary | l'app ecrit « Récapitulatif », sans capitales |
| `scDeliveryFee` | Frais de livraison | — | common.deliveryFee | identique |
| `scTotal` | Total | — | common.total | identique |
| `scCash` | Espèces | — | payment.especes | identique |
| `scCutLine` | tenders, sauce au choix incluse | — | — | description produit en base (Tacos), pas i18n |
| `scMeat` | Choix de la viande | — | — | product_option_groups en base |
| `scSauce` | Sauce au choix | — | — | product_option_groups en base |
| `scRequired` | OBLIGATOIRE | — | product.required | l'app ecrit « Obligatoire » |
| `scMeats 1` | Agneau | — | — | product_options en base |
| `scMeats 2` | Poulet | — | — | product_options en base |
| `scMeats 3` | Steak | — | — | product_options en base |
| `scMeats 4` | Merguez | — | — | product_options en base |
| `scMeats 5` | Nugget | — | — | product_options en base |
| `scMeats 6` | Tenders | — | — | product_options en base |
| `scSauces 1` | Mayonnaise | — | — | product_options en base |
| `scSauces 2` | Samouraï | — | — | product_options en base |
| `scSauces 3` | Algérienne | — | — | product_options en base |
| `scSauces 4` | Andalouse | — | — | product_options en base |
| `scAddress` | Adresse de livraison | — | address.title | identique |
| `scPosSaved` | Position enregistrée | — | address.captured | identique |
| `scCheckMap` | Vérifier sur la carte | — | address.mapBadge | identique |
| `scTapHint` | Appuie sur la carte pour vérifier que le repère est au bon endroit. | — | address.mapHint | identique |
| `scRefresh` | Actualiser ma position | — | address.refresh | identique |
| `scPreciseAddr` | ADRESSE PRÉCISE | — | address.streetLabel | l'app ecrit « Adresse précise » |
| `scAddrHint` | Rue, quartier ou repère visible. Corrige si la position a mal deviné. | — | address.streetHint | identique |
| `scPhone` | TÉLÉPHONE DE CONTACT | — | address.phoneLabel | l'app ecrit « Téléphone de contact » |
| `rcOpen` | Ouvert | — | restaurantCard.open | identique |
| `rcDesc` | Snacks, Burgers, Crêpes & Milkshakes — Ambatoloaka | — | — | restaurants.description en base |
| `rcChips 1` | Sandwichs & Repas | — | — | categories.name en base |
| `rcChips 2` | Burgers | — | — | categories.name en base |
| `rcChips 3` | Bières | — | — | categories.name en base |
| `rcChips 4` | Softs | — | — | categories.name en base |
| `rcChips 5` | Milkshakes | — | — | categories.name en base |
| `rcChips 6` | Crêpes | — | — | categories.name en base |
| `rcTime` | 25–40 min | — | — | constante DEFAULT_ETA, data/types.ts:252 — en dur, jamais traduite |
| `nfAgo` | il y a 19 min | — | — | horodatage relatif, pas de chaine i18n trouvee |
| `nfTitle` | Commande livrée 🎉 | — | notify-order:92 | notification push |
| `nfNow` | maintenant | — | — | pas de chaine i18n trouvee |

### 4B — Film restaurateur

| Clé film | Français à l'écran | Malgache dans l'app | Clé de l'app | Note |
|---|---|---|---|---|
| `nb1t` | Nouvelle commande 🔔 | — | notify-order:111 | l'app ecrit « Nouvelle commande 🛎️ » — FR SEULEMENT |
| `nb1b` | La Cabane — commande TF-51 à confirmer. | — | notify-order:111 | l'app : « Commande {numero} à confirmer. » — FR SEULEMENT |
| `nb2t` | Course disponible 🛵 | — | notify-order:116 | FR SEULEMENT |
| `nb2b` | La Cabane — commande TF-51 prête à enlever. | — | notify-order:116 | l'app : « {resto} — commande {numero} prête à enlever. » — FR SEULEMENT |
| `scHeader` | Commandes en cours | — | (restaurant)/index.tsx:62 | texte EN DUR, hors i18n |
| `scEmptyT` | Aucune commande en cours | — | (restaurant)/index.tsx:71 | texte EN DUR |
| `scEmptyB` | Les nouvelles commandes apparaîtront ici automatiquement. | — | ? | non retrouve verbatim — a verifier |
| `scTabs 1` | Commandes | — | (restaurant)/_layout.tsx:47 | texte EN DUR |
| `scTabs 2` | En livraison | — | (restaurant)/_layout.tsx:55 | texte EN DUR |
| `scTabs 3` | Historique | — | (restaurant)/_layout.tsx:62 | texte EN DUR |
| `scWhen` | Aujourd'hui 17h01 | — | — | formatDay() + formatTime(), data/types.ts — format francais en dur |
| `scBadge.recue` | Reçue | — | status.recue | cle i18n cote client ; l'ecran resto ne l'utilise pas |
| `scBadge.confirmee` | Confirmée | — | status.confirmee | idem |
| `scBadge.preparation` | En préparation | — | status.en_preparation | idem |
| `scFee` | Frais de livraison | — | common.deliveryFee |  |
| `scTotal` | Total · Espèces | — | tracking.totalWith | l'app : « Total · {{method}} » |
| `scPlace` | Nosy Be — Nossi-Bé | — | — | donnee d'adresse, pas une chaine d'interface |
| `scRoute` | Itinéraire | — | ? | non retrouve verbatim dans les ecrans resto |
| `scRefuse` | Refuser | — | (restaurant)/index.tsx:116 | texte EN DUR |
| `scAccept` | Accepter | — | (restaurant)/index.tsx:117 | texte EN DUR |
| `scStart` | Démarrer la préparation | — | (restaurant)/index.tsx:122 | texte EN DUR |
| `scReady` | Marquer comme prête | — | (restaurant)/index.tsx:125 | texte EN DUR |
| `vChips 1` | Sandwichs & Repas | — | — | categories.name en base |
| `vChips 2` | Burgers | — | — | categories.name en base |
| `vChips 3` | Bières | — | — | categories.name en base |
| `vSection` | Sandwichs & Repas | — | — | categories.name en base |
| `vCount` | 7 produits | — | ? | compteur calcule ; libelle non retrouve en i18n |

**Ce que 4B révèle, et qui vaut plus que la colonne vide :** l'espace restaurant n'est
pas « non traduit en malgache », il est **hors du système de traduction**. Ses textes
sont des littéraux français dans le JSX. Traduire cet écran dans quelque langue que ce
soit demanderait d'abord de l'y faire entrer.

### 4C — Le menu La Cabane

**Non.** Les noms et descriptions de produits ne sont traduits nulle part — ni en
malgache, ni en anglais, ni en italien. La table `products` a **une** colonne `name` et
**une** colonne `description`, sans variante de langue ; la vérification sur
`information_schema.columns` ne trouve aucune colonne suffixée par une langue.

Le Tacos en entier, tel qu'il est en base :

| Champ | Valeur |
|---|---|
| `name` | `Tacos` |
| `description` | `Viande au choix (agneau, poulet, steak, merguez, nugget ou tenders). Sauce au choix incluse.` |
| `price` | `30000` (ariary) |
| catégorie | `Sandwichs & Repas` |

Tu gardes donc les noms français à l'écran, ce qui est de toute façon ce que fait la
carte du restaurant.

---

## 4D — Tout ce qui s'adresse à l'utilisateur en dehors de l'interface

Tu as raison que c'est le gisement le plus intéressant. Voici tout, et la réponse est la
même : **aucune phrase malgache, nulle part.** Mais l'endroit où le travail s'est arrêté
est instructif, et il est net.

### Notifications push — `supabase/functions/notify-order/index.ts`

Sept messages. **Six existent en fr / en / it. Deux existent en français seul.**
La coupure ne suit pas le hasard : elle sépare **le client** du **personnel**.

| Événement | Public | Français | Malgache | Traduit en |
|---|---|---|---|---|
| `confirmee` (l. 77-79) | client | **Commande confirmée ✅** — « {resto} a accepté ta commande et va la préparer. » | — | fr, en, it |
| `en_preparation` (l. 82-84) | client | **En préparation 👨‍🍳** — « {resto} prépare ta commande. » | — | fr, en, it |
| `en_livraison` (l. 87-89) | client | **Prête à partir 🛵** — « Ta commande attend un livreur. » | — | fr, en, it |
| `livree` (l. 92-94) | client | **Commande livrée 🎉** — « Bon appétit ! Merci d'avoir commandé avec Taxi Food. » | — | fr, en, it |
| `annulee` (l. 97-99) | client | **Commande annulée** — « {resto} n'a pas pu honorer ta commande. » | — | fr, en, it |
| `picked_up` (l. 104-106) | client | **Le livreur est en route 🛵** — « Ta commande vient d'être récupérée chez {resto}. » | — | fr, en, it |
| `nouvelle` (l. 111) | **restaurant** | **Nouvelle commande 🛎️** — « Commande {numero} à confirmer. » | — | **français seul** |
| `course` (l. 116) | **livreurs** | **Course disponible 🛵** — « {resto} — commande {numero} prête à enlever. » | — | **français seul** |

**Où quelqu'un s'est arrêté, et pourquoi.** Ce n'est pas un oubli, c'est une décision
documentée : les écrans du restaurant et du livreur étant eux-mêmes en français, leurs
notifications le sont aussi. Le code prévoit le repli (`set[lang] ?? set.fr`), si bien
qu'un livreur dont le téléphone est en italien reçoit quand même le français.

Deux détails de ton brief à corriger, tirés du code : le film écrit « Nouvelle commande
🔔 », l'app utilise **🛎️** ; et l'app ne préfixe pas du nom du restaurant dans la
notification restaurant — elle écrit seulement « Commande {numero} à confirmer. »

### SMS et WhatsApp

- **Aucun SMS.** Aucun fournisseur SMS n'est configuré sur le projet.
- **Le code de vérification part par WhatsApp**, via
  `supabase/functions/send-otp-whatsapp/index.ts`. ⚠️ **Le texte du message n'est pas
  dans le dépôt** : c'est un *modèle « Authentification »* approuvé par Meta, dont le
  nom (`template_name`) et la langue (`template_lang`) sont lus dans le Vault Supabase
  (l. 39-40). Le libellé vit dans le compte Meta Business, pas ici. Je ne peux donc ni
  te le donner ni te dire dans quelles langues il est décliné — **c'est une chose que je
  ne sais pas**, pas une absence de malgache constatée.

### E-mails transactionnels

Aucun envoi d'e-mail par notre code (`grep` sur `sendMail|resend|sendgrid|smtp|nodemailer` :
rien). Les seuls e-mails partants sont ceux de **Supabase Auth** — confirmation de compte,
réinitialisation de mot de passe. Leurs gabarits vivent dans le tableau de bord Supabase,
pas dans le dépôt, et je ne les ai pas ouverts. **Malgache : non vérifiable d'ici**, mais
il n'y a aucune raison qu'il y en ait, l'interface Supabase ne proposant pas le malgache.

### Messages d'erreur, écrans vides, accueil et onboarding

Tous en fr / en / it, **aucun en malgache**. Les plus « voix off » d'entre eux, puisque
c'est le ton que tu cherches :

| Clé | Français | Malgache |
|---|---|---|
| `home.guestBanner` | Parcours les restaurants librement. Le compte n'est demandé qu'au moment de commander, pour savoir où te livrer et te prévenir. | — |
| `orders.guestText` | Avec un compte, tu vois minute par minute où en est ta commande, tu retrouves les précédentes et tu les recommandes d'un geste. | — |
| `orders.guestTitle` | Suis ta livraison | — |
| `login.pitch` | Pizzas, tacos, burgers — livrés chaud à Hell-Ville et dans tout Nosy Be. | — |
| `login.pitchOrder` | Plus qu'une étape avant d'être livré. Ton panier est conservé — le compte sert à te suivre et à te trouver. | — |
| `login.actionHint` | Connecte-toi ou crée ton compte en un tap | — |
| `address.shareSub` | Obligatoire pour être livré — le livreur vous trouve grâce à votre position (pas d'adressage postal à Nosy Be). | — |
| `phone.askSubtitle` | Le livreur en a besoin pour vous joindre à l'arrivée. Demandé une seule fois. | — |
| `confirmation.subtitle` | {restaurant} a reçu votre commande. Vous serez notifié à chaque étape. | — |
| `orders.emptyTitle` | Aucune commande | — |
| `orders.emptyText` | Vos commandes apparaîtront ici, avec la possibilité de les recommander en un geste. | — |
| `profile.whyTracking` | Suivre ton livreur en direct jusqu'à ta porte | — |
| `tracking.refusedDefault` | Le restaurant n'a pas pu honorer cette commande. | — |
| `tracking.waitingCourier` | Votre commande est prête — un livreur va la prendre en charge. | — |
| `checkout.noCharge` | Paiement à la livraison — aucun débit maintenant. | — |
| `address.gpsError` | Localisation refusée ou indisponible. Active-la pour continuer. | — |

**S'il existait une seule phrase malgache complète dans ce projet, elle serait dans ce
tableau. Il n'y en a pas.**

---

## 5. Les conventions d'écriture

Réponses tirées du code, pas de ce qui serait correct. **Aucune de ces conventions n'a de
variante malgache** — elles ne dépendent d'ailleurs pas de la langue du tout, ce qui est
en soi une information : la localisation de l'app s'arrête au texte.

### L'ariary

Une seule fonction, **non localisée** — `app/theme/tokens.ts:116-118` :

```ts
/** Formate un montant en ariary avec séparateur d'espace : 78000 -> "78 000 Ar". */
export function formatAr(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';
}
```

- **Séparateur de milliers** : une **espace**.
- **Position du symbole** : **suffixé**, précédé d'une espace → `30 000 Ar`. Jamais `Ar 30 000`.
- **Abréviation** : `Ar`. Jamais `Ariary` en toutes lettres.
- **Locale `mg`** : `—`. La fonction ne prend aucun paramètre de langue et produit la
  même chaîne dans les trois langues. Il n'y a rien à décliner.

### Les durées

- `25–40 min` est une **constante en dur** : `DEFAULT_ETA`, `app/data/types.ts:252`.
  Elle n'est pas une clé i18n et **n'est traduite dans aucune langue**.
- Le mot `min` n'est traduit nulle part : l'anglais dit « Ready in ~20 min », l'italien
  « Pronto tra ~20 min ». `minitra` : `—`.

### Les dates et les heures

Deux fonctions, toutes deux **au format français, en dur** (`app/data/types.ts`) :

- `formatTime()` (l. 301-307) : `« 22:30:00 » → « 22h30 »`, minutes omises si `00` → `« 22h »`.
  C'est bien **`17h01`**, jamais `17:01`.
- `formatDay()` (l. 321-331) : même jour → **`Aujourd'hui 09h52`** ; sinon **`6 août · 19h40`**.

Les noms de mois viennent du français en dur. Noms de jours et de mois en malgache : `—`.

### Le registre

C'est la réponse la plus utile de cette section, et elle ne va pas te plaire :
**l'application française mélange le tutoiement et le vouvoiement, dans le même espace
client.** Compté sur les 275 clés de `app/locales/fr.json` :

| | Nombre de chaînes |
|---|---|
| Tutoiement (`tu`, `te`, `ton`, `ta`, `tes`, `t'`) | **21** |
| Vouvoiement (`vous`, `votre`, `vos`) | **28** |
| Chaînes mélangeant les deux en interne | 0 |

Deux exemples côte à côte, tous deux adressés au client :

- `login.actionHint` — « **Connecte-toi** ou crée **ton** compte en un tap »
- `phone.askSubtitle` — « Le livreur en a besoin pour **vous** joindre à l'arrivée. »

**Réponse à ta question** : non, l'app ne fait pas comme ton film. Ton film tutoie le
client et vouvoie le restaurateur, ce qui est cohérent. L'app, elle, fait les deux au
client. Pour le restaurateur la question ne se pose pas : ses écrans sont en dur et
vouvoient (« Marquer comme prête », pas de pronom la plupart du temps).

`ianao` / `ianareo` : `—`. Aucun malgache, donc aucune décision de registre malgache.

### Les emprunts au français

Les dix mots demandés, tels qu'écrits dans le code. La colonne malgache est `—` partout ;
je donne l'anglais et l'italien parce qu'ils montrent la politique d'emprunt réellement
appliquée dans le projet — utile si tu cherches un précédent de style.

| Mot | Français, tel qu'écrit dans le code | Anglais | Italien | Malgache |
|---|---|---|---|---|
| **commande** | Commandes <br>`tabs.orders` | Orders | Ordini | — |
| **livraison** | Frais de livraison <br>`common.deliveryFee` | Delivery fee | Costo di consegna | — |
| **livreur** | Le livreur en a besoin pour vous joindre à l'arrivée… <br>`phone.askSubtitle` | The courier needs it to reach you on arr… | Serve al rider per contattarti all'arriv… | — |
| **restaurant** | Parcourir les restaurants et me faire livrer. <br>`roleSelect.clientSubtitle` | Browse restaurants and get food delivere… | Sfoglia i ristoranti e fatti consegnare … | — |
| **panier** | Panier <br>`tabs.cart` | Cart | Carrello | — |
| **total** | Total <br>`common.total` | Total | Totale | — |
| **adresse** | Choisir une adresse <br>`home.chooseAddress` | Choose an address | Scegli un indirizzo | — |
| **paiement** | Mode de paiement <br>`checkout.paymentSection` | Payment method | Metodo di pagamento | — |
| **client** | Connexion Google pas encore configurée (EXPO_PUBLIC_… <br>`login.googleNotConfigured` | Google sign-in is not configured yet (EX… | Accesso Google non ancora configurato (E… | — |
| **prêt** | Voir les commandes prêtes à livrer et les prendre en… <br>`roleSelect.courierActive` | See orders ready for delivery and take t… | Vedi gli ordini pronti da consegnare e p… | — |

### La marque

- **« Taxi Food » n'est jamais traduit, ni décliné, ni suivi d'un mot malgache.** Il
  apparaît tel quel dans les trois langues (`login.terms`, `notify-order` l. 92-94, tous
  les titres du site).
- **Accroche marketing en malgache** : `—`. Aucune, nulle part — ni dans le code, ni dans
  un commentaire, ni dans un fichier de notes.

---

## 6. La longueur

**Les vingt chaînes malgaches les plus longues : `—`.** Il n'y en a aucune.

Ce que je peux donner à la place, et qui te sert quand même : **les vingt chaînes
françaises les plus longues**, celles qui poseront problème les premières le jour où on
les traduira. Ce sont tes zones de débordement à surveiller.

| # | Caractères FR | Clé | Français | Malgache |
|---|---|---|---|---|
| 1 | 186 | `profile.deleteBody` | Ton profil, tes adresses et tes appareils seront définitivement effacé… | — |
| 2 | 137 | `login.googleNotConfigured` | Connexion Google pas encore configurée (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_… | — |
| 3 | 136 | `login.facebookNotConfigured` | Connexion Facebook pas encore configurée (EXPO_PUBLIC_FACEBOOK_APP_ID … | — |
| 4 | 127 | `home.guestBanner` | Parcours les restaurants librement. Le compte n'est demandé qu'au mome… | — |
| 5 | 127 | `orders.guestText` | Avec un compte, tu vois minute par minute où en est ta commande, tu re… | — |
| 6 | 112 | `profile.guestHint` | Tu peux parcourir les restaurants et remplir ton panier sans compte. I… | — |
| 7 | 111 | `address.shareSub` | Obligatoire pour être livré — le livreur vous trouve grâce à votre pos… | — |
| 8 | 107 | `login.pitchOrder` | Plus qu'une étape avant d'être livré. Ton panier est conservé — le com… | — |
| 9 | 104 | `phone.alreadyUsed` | Ce numéro est déjà rattaché à un autre compte. Connecte-toi avec ce nu… | — |
| 10 | 96 | `authEmail.checkInboxBody` | Nous avons envoyé un lien de confirmation à {{email}}. Cliquez dessus … | — |
| 11 | 89 | `checkout.needGps` | Position GPS manquante sur cette adresse. Reviens à l'étape adresse et… | — |
| 12 | 88 | `phone.loginSubtitle` | Nous enverrons un code de confirmation sur WhatsApp. Ce numéro doit do… | — |
| 13 | 85 | `authEmail.askNameSubtitle` | Le restaurant et le livreur voient ce nom sur votre commande. Demandé … | — |
| 14 | 83 | `orders.emptyText` | Vos commandes apparaîtront ici, avec la possibilité de les recommander… | — |
| 15 | 77 | `phone.askSubtitle` | Le livreur en a besoin pour vous joindre à l'arrivée. Demandé une seul… | — |
| 16 | 72 | `login.pitch` | Pizzas, tacos, burgers — livrés chaud à Hell-Ville et dans tout Nosy B… | — |
| 17 | 72 | `confirmation.subtitle` | {{restaurant}} a reçu votre commande. Vous serez notifié à chaque étap… | — |
| 18 | 71 | `login.terms` | En continuant, vous acceptez les conditions d'utilisation de Taxi Food… | — |
| 19 | 71 | `address.notePlaceholder` | Ex. prendre les escaliers · appart 5, code portail 12345 · maison bleu… | — |
| 20 | 70 | `address.blockSavedNoGps` | Cette adresse n'a pas de position GPS — partage ta position ci-dessus. | — |

### Ratio de longueur — mesuré, mais pas sur le malgache

| Paire | Ratio | Volume |
|---|---|---|
| anglais / français | **0.894** | 7364 caractères contre 8235 |
| italien / français | **0.980** | 8070 caractères contre 8235 |
| **malgache / français** | **—** | aucune donnée |

⚠️ **Ne déduis pas un ratio malgache de ces deux-là.** L'anglais raccourcit, l'italien est
neutre ; le malgache, langue agglutinante à préfixes verbaux, allonge — mais je n'ai
aucune mesure sur ce projet pour le chiffrer, et je ne vais pas inventer un coefficient
sur lequel tu calerais des largeurs d'écran.

---

## 7. Tout ce qui n'est pas du code

- **Glossaire, README de traduction, notes** : `—`. Recherche par nom de fichier
  (`*glossaire*`, `*glossary*`, `*traduction*`, `*translation*`) sur les trois dépôts :
  aucun résultat. Le dossier `docs/` contient six documents, tous sur les soumissions
  Apple/Android, le logo et l'OTP WhatsApp — aucun ne parle de traduction.
- **Un nom, un contact, un prestataire** : `—`. Aucun traducteur n'est nommé nulle part.
  Les traductions anglaise et italienne ne portent aucune signature ni crédit.
- **Enregistrement audio en malgache** : `—`. Les seuls fichiers audio des dépôts sont
  dans `motion design /dossier sans titre/bande son/` — musiques et bruitages de
  banque (`woosh.mp3`, `moto1.mp3`, `carbrake.mp3`, morceaux libres de droits). Aucune
  voix, aucune langue.
- **Locuteur natif identifié** : `—` dans le code. Hors code, la piste la plus courte est
  les **trois restaurants partenaires** — Angelo, Taxi Be, La Cabane — dont le personnel
  est malgachophone, et **La Cabane** en particulier, premier partenaire à avoir accepté.
  Ce n'est pas une information tirée du dépôt, c'est une déduction : traite-la comme une
  suggestion, pas comme un fait.

---

## 8. Côté site

- **Le site contient-il du malgache ?** Non, sous aucune forme. `landing/i18n/` contient
  exactement `fr.json`, `en.json`, `it.json`, 305 clés chacun, parité vérifiée.
- **`mg` figure-t-il dans le sélecteur de langue ?** **Non.** `grep` sur `"mg"`, `>MG<`
  et `hreflang="mg"` dans tout `landing/` : aucun résultat. Le générateur
  `landing/tools/build-i18n.py:31` déclare `LANGS = ["fr", "en", "it"]`.

  Conforme à ta consigne : rien à signaler, rien à retirer.

  ⚠️ Une nuance, pour que tu ne sois pas surpris : la page **`/devenir-livreur/`**,
  publiée aujourd'hui, n'existe **qu'en français** et a été conçue comme le seul endroit
  du site destiné à recevoir un jour du malgache. Elle ne contient aucun malgache
  aujourd'hui, et `mg` n'est pas dans le sélecteur du site.

---

## Ce que je ne sais pas

Sans essayer de le combler :

1. **Le texte du modèle WhatsApp d'authentification.** Il vit dans le compte Meta
   Business, pas dans le dépôt. Je ne sais ni ce qu'il dit, ni en quelles langues il est
   décliné. C'est le seul message sortant du produit dont je ne peux pas te donner le
   contenu.
2. **Les gabarits d'e-mail de Supabase Auth** (confirmation de compte, réinitialisation).
   Ils sont dans le tableau de bord Supabase ; je ne les ai pas ouverts.
3. **`scEmptyB`, `scRoute` et `vCount`** (film restaurateur) : je n'ai pas retrouvé ces
   trois libellés verbatim dans le code. Marqués `?` dans le tableau 4B. Ils sont
   peut-être formulés autrement, ou n'existent que dans ta maquette.
4. **`nfAgo` (« il y a 19 min ») et `nfNow` (« maintenant »)** : aucune chaîne i18n
   correspondante trouvée. Probablement construits à la volée, mais je n'ai pas localisé
   la fonction.
5. **Si quelqu'un, hors dépôt, a déjà commencé un travail de malgache** — un fichier sur
   un disque, un échange avec un traducteur, une note dans un carnet. Je ne vois que les
   dépôts.
6. **Quelle variante conviendrait à Nosy Be.** J'ai des éléments (section 3), pas une
   réponse. C'est une question pour un locuteur du Nord, pas pour moi.
