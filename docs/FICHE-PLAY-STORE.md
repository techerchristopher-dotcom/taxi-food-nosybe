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

**À ne PAS déclarer** : Informations financières (paiement en **espèces**, aucune donnée
bancaire ne transite), Santé, Messages, Photos et vidéos, Fichiers, Contacts, Activité dans
l'application, Informations sur les performances (aucun outil de crash reporting).

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
