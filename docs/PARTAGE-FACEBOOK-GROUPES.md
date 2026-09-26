# Publier les plats du jour dans les groupes Facebook

Procédure **relevée en la jouant pour de vrai** le 2026-09-25 : 7 groupes publiés, une erreur
Facebook rencontrée et contournée. Écrite pour être confiée à un agent qui la rejoue chaque jour.

---

## 1. Ce que l'objectif « tout publier chaque jour » ne peut pas être

Le porteur du projet voulait publier **chaque jour dans tous les groupes**. Ça ne tient pas, et il
vaut mieux le savoir avant d'y passer du temps :

- **L'API des groupes est fermée** aux applications tierces depuis 2020. Aucun outil légitime ne
  publie dans un groupe : le seul chemin est de piloter le navigateur connecté.
- **macOS exige une autorisation humaine** à chaque prise de contrôle du navigateur. Un
  déclenchement à 11 h sans personne devant l'écran ne cliquera rien. L'agent a donc besoin d'un
  « go » quotidien — c'est 10 secondes d'attention, pas 20 minutes de travail.
- **Meta limite** : ~20 partages quotidiens depuis une page de 21 abonnés, c'est le profil qui se
  fait restreindre. Erreur « Quelque chose ne fonctionne pas » déjà rencontrée après le 1ᵉʳ partage.
- **Les groupes bannissent** la publicité répétée : publier tous les jours dans le même groupe fait
  perdre l'accès à son audience pour de bon.
- **Les audiences se recouvrent** : ces groupes, ce sont largement les mêmes personnes.

## 2. La règle retenue : ROTATION, 6 groupes par jour

- Liste complète (aujourd'hui **20 et quelques** groupes) → **6 par jour**, dans l'ordre, en
  reprenant au début quand on a fait le tour : chaque groupe reçoit la publication **tous les 3 à
  4 jours**, et la page reste présente partout chaque semaine.
- **Jamais deux fois le même groupe dans la même journée.**
- **Un texte différent à chaque publication** (voir § 5).
- **Au premier refus de Facebook, on arrête la session** et on reprend le lendemain. On ne réessaie
  pas deux fois de suite : c'est le signal qui précède la limitation.

## 3. La liste des groupes ne s'écrit JAMAIS en dur

⚠️ **Source de vérité unique** : la fenêtre **« Partager dans un groupe »** de la publication.
Elle liste exactement les groupes où **la page** est autorisée à publier. Un groupe que la page
rejoint demain y apparaît tout seul ; un groupe quitté en disparaît.

L'agent doit donc, à chaque exécution :
1. ouvrir la fenêtre, **faire défiler jusqu'au bout** (la liste se charge par paquets) ;
2. relever les noms dans l'ordre ;
3. les comparer au journal de la veille (`journal-partages.md` ou équivalent) pour savoir où
   reprendre la rotation, et repérer les nouveaux groupes.

⚠️ **Le compte personnel de Christopher est membre de 428 groupes** (chiffre affiché par Facebook
sur `facebook.com/groups/joins`, vérifié le 25/09/2026). **Ils sont hors périmètre — décision du
porteur du projet, 25/09/2026 :** on ne travaille que sur les groupes de la page Taxi Food.

Pourquoi c'est la bonne décision : la quasi-totalité des 428 n'a rien à voir avec Nosy Be (groupes
de La Réunion, d'automobile, de métier…). Y publier une livraison de repas, c'est au mieux ignoré,
au pire un signalement qui met le compte personnel en danger. Le périmètre utile est déjà constitué
et tient en une trentaine de lignes — c'est le § 3 ter.

## 3 ter. LE PÉRIMÈTRE TAXI FOOD — la liste de travail

**C'est la seule liste que l'agent parcourt.** Elle se relit dans la fenêtre « Partager dans un
groupe » (colonne « déjà servi » mise à jour par le journal), une fois par semaine, pour attraper
les groupes rejoints entre-temps.

| # | Groupe | Membres | Slug `?g=` | État |
|---|---|---|---|---|
| 1 | Business Nosy-Be (Hell Ville 207) | 39 700 | `business207` | ✅ servi 25/09 |
| 2 | TANY ALAFO SY TRANO AFONDRO… 207 | 25 400 | `tanyalafo` | ✅ servi 25/09 |
| 3 | Zanaka nosy be mila tragno | 25 200 | `zanaka` | ✅ servi 25/09 |
| 4 | INO VAOVAO NOSY BE HELL-VILLE | 21 600 | `inovaovao` | ✅ servi 25/09 |
| 5 | AMBIANCE À NOSY BE | 20 700 | `ambiance` | ✅ servi 25/09 |
| 6 | NOSY-BE Petit Paris | 16 300 | `petitparis` | ⏳ modéré, jamais paru |
| 7 | TRAGNO AFONDRO ETO NOSY BE HELLE VILLE | 15 025 | `tragnoafondro` | ⬜ **jamais servi** — page membre |
| 8 | Nosy Bon Coins | 13 251 | `bonscoins` | ⬜ **jamais servi** — page membre |
| 9 | Bizness nosy be hell ville | 12 385 | `bizness` | ✅ servi 25/09 |
| 10 | Nosy be hell Mbizna | 10 100 | `mbizna` | ✅ servi 25/09 |
| 11 | Le grand marché de nosy-be | 8 447 | `grandmarche` | ✅ servi 25/09 |
| 12 | NosyBe Bonnes Affaires | 7 632 | `bonnesaffaires` | ⬜ **jamais servi** — page membre |
| 13 | Séjour Nosybe et Nord Madagascar | 5 500 | `sejour` | ✅ servi 25/09 |
| 14 | MADAGASCAR TOURIST INFO | 4 216 | `touristinfo` | ⬜ **jamais servi** — page membre |
| 15 | Amici italiani 🇮🇹🇲🇬 (Nosy be) | 3 132 | `amici` | ✅ servi 25/09 (italien) |
| 16 | BAZAR BE NOSY BE | 2 200 | `bazarbe` | ✅ servi 25/09 |
| 17 | Have you been Nosy Be? | 725 | `haveyoubeen` | ✅ servi 25/09 (anglais) |
| 18 | Nosy be hell ville M bizna | — | `mbiznaville` | ✅ servi 25/09 |
| 19 | NOSY-BE PUB | — | `nosybepub` | ✅ servi 25/09 |
| 20 | Nosy be vente en ligne | — | `venteenligne` | ✅ servi 25/09 |
| 21 | Nosybe Tsara Business \| Tany alafo & Trano afondro | — | `tsarabusiness` | ✅ servi 25/09 |
| 22 | Nosy-Be Plaisirs de vacances | — | `plaisirs` | ✅ servi 25/09 |
| 23 | Bizness Tout Sur Nosy Be | — | `toutsur` | ✅ servi 25/09 |
| 24 | Le Bon coin Nosy be | — | `leboncoin` | ⚠️ partagé sans lien marqué |
| 25 | Bon prix Nosy be | — | `bonprix` | ⚠️ partagé sans lien marqué |
| 26 | NOSY BE HELL-VILLE | — | `hellville` | ⚠️ partagé sans lien marqué |
| 27 | Le BonCoin et Plan de NosyBe | — | `boncoinplan` | ⚠️ partagé sans lien marqué |
| 28 | TOURISME - NOSY BE - MADAGASCAR | — | `tourisme` | ⚠️ partagé sans lien marqué |
| 29 | Business Madio à Nosy-Be | — | `businessmadio` | ⚠️ partagé sans lien marqué |
| 30 | La Vie à Nosy-Be | — | `lavie` | ⚠️ partagé sans lien marqué |

🚫 **Exclu volontairement : Fitadiavana Asa eto Nosy Be** — groupe de recherche d'emploi. Hors
sujet, publication supprimée, risque d'exclusion. Ne pas le reproposer.

**Ce que dit ce tableau** : ~250 000 membres cumulés sur les seuls groupes dont on connaît la
taille. **Quatre groupes que la page a rejoints n'ont jamais rien reçu** (lignes 7, 8, 12, 14) —
c'est le gisement immédiat, et il est publiable depuis Meta Business Suite, sans piloter le
navigateur. **Sept autres** (lignes 24 à 30) n'ont reçu qu'un partage non mesurable : à refaire
avec leur lien marqué.

⚠️ Les membres manquants (`—`) et les slugs des lignes 7-8, 12, 14 et 24-30 sont à relever au
prochain passage ; les slugs proposés ici ne comptent rien tant qu'ils n'ont pas été publiés.

## 3 bis. UN GROUPE = UN SLUG — le lien exact à partager

⚠️ **Depuis le 2026-09-25, on ne partage plus l'adresse nue.** Chaque groupe reçoit SON lien,
marqué de son nom court (`?g=`). C'est ce qui permettra, au bout d'une semaine, de dire lesquels
de ces vingt groupes amènent des clients et lesquels ne servent à rien.

**La règle, et elle n'a pas d'exception : un groupe = un slug, et jamais deux groupes avec le
même.** Deux groupes qui partagent une étiquette forment une seule ligne dans les chiffres, et
cette ligne ne veut plus rien dire : on ne saura pas lequel des deux garder. Un slug se choisit
une fois et ne change plus — le changer coupe l'historique en deux.

Un slug : **minuscules, chiffres et tirets, 24 caractères au plus, sans accent** (`hellville`,
jamais `Hell-Ville`). Hors de ces règles, l'étiquette est ignorée en silence : la page s'ouvre
normalement, mais la visite n'est attribuée à personne.

| Groupe (nom exact dans Facebook) | Slug | Lien exact à partager |
|---|---|---|
| Le Bon coin Nosy be | `boncoin` | `https://taxifoodnosybe.distripro207.com/jour?g=boncoin` |
| Bon prix Nosy be | `bonprix` | `https://taxifoodnosybe.distripro207.com/jour?g=bonprix` |
| NOSY BE HELL-VILLE | `hellville` | `https://taxifoodnosybe.distripro207.com/jour?g=hellville` |
| Le BonCoin et Plan de NosyBe | `boncoinplan` | `https://taxifoodnosybe.distripro207.com/jour?g=boncoinplan` |
| TOURISME - NOSY BE - MADAGASCAR | `tourisme` | `https://taxifoodnosybe.distripro207.com/jour?g=tourisme` |
| Business Madio à Nosy-Be | `madio` | `https://taxifoodnosybe.distripro207.com/jour?g=madio` |
| La Vie à Nosy-Be | `lavie` | `https://taxifoodnosybe.distripro207.com/jour?g=lavie` |

**Un groupe qui n'est pas encore dans ce tableau** : lui inventer un slug court tiré de son nom
(sans accent, sans espace), l'ajouter ICI avant de publier, et vérifier qu'aucune autre ligne ne
le porte déjà. Le tableau est la seule liste de slugs — la fenêtre Facebook, elle, reste la seule
liste de groupes (§ 3).

⚠️ **Ne pas ajouter `?v=` à la main.** L'empreinte des plats se fabrique toute seule quand
Facebook lit la page ; le lien à coller est celui du tableau, rien de plus.

### Pourquoi `?g=` et pas `utm_campaign`

Les deux étaient possibles. `?g=` a été retenu pour trois raisons :

1. **Les `utm_*` sont déjà pris, et pour autre chose.** `utm_source` dit par quel CANAL un lien a
   été partagé depuis l'application (`whatsapp`, `lien`, `systeme`) et `utm_medium` vaut `partage`.
   Y ajouter un `utm_campaign` de groupe mélangerait deux questions différentes dans le même
   tiroir, et un jour quelqu'un lirait l'un pour l'autre.
2. **Le lien se dicte et se recopie.** `…/jour?g=boncoin` tient dans une conversation, sur une
   affiche, au téléphone. `…/jour?utm_source=facebook&utm_medium=groupe&utm_campaign=boncoin` non.
3. **On ne dépend d'Umami pour rien ici.** Son API est réservée à l'offre payante (« API access
   requires a Pro plan », constaté le 2026-09-25) : ses chiffres ne peuvent pas être rapatriés
   dans le tableau de bord, et surtout pas croisés avec les commandes. L'étiquette est donc
   comptée dans **notre propre base**, où elle se recoupe avec `orders`. Umami reste branché pour
   le reste (visiteurs, provenance) — il n'est pas remplacé.

## 4. La procédure, clic par clic

⛔ **CE QUI CHANGE AVEC LES ÉTIQUETTES — à lire avant de rejouer la procédure ci-dessous.**
Partager **la publication de la page** dans un groupe emporte le lien de CETTE publication, le
même pour tous les groupes : aucune étiquette n'est possible par ce chemin, et la mesure reste à
zéro. Pour mesurer, il faut **publier dans le groupe**, en y collant le lien du groupe :

1. ouvrir le groupe, cliquer sa zone **« Écrivez quelque chose… »** ;
2. **coller le lien du tableau § 3 bis** (`…/jour?g=<slug>`) et attendre que l'aperçu apparaisse
   (photo des plats, titre « Les plats du jour à Nosy Be ») ;
3. écrire le texte du jour **au-dessus**, et — si on veut — effacer l'adresse du texte : l'aperçu
   reste, le lien aussi ;
4. **Publier**, attendre ~15 s, groupe suivant.

Les deux chemins peuvent cohabiter : le partage de la publication de page fait vivre la page,
la publication directe fait vivre la mesure. **Mais un groupe mesuré une semaine sur deux ne se
compare à rien** — tant que dure la semaine de mesure, on publie directement, partout.

⚠️ **Jamais deux étiquettes dans le même lien** et jamais un lien recopié d'un autre groupe :
c'est l'erreur qui fausse tout sans rien signaler.

**La procédure d'origine (partage de la publication de la page), conservée** :

1. `https://www.facebook.com/profile.php?id=61594104278047` (page Taxi Food).
2. Vérifier qu'il existe **une publication du jour** (« Les plats du jour de Nosy Be… »). Sinon,
   la créer d'abord avec le lien `https://taxifoodnosybe.distripro207.com/jour` — l'aperçu et
   l'empreinte `?v=` se fabriquent tout seuls.
3. Descendre jusqu'à la publication, cliquer son bouton **partager** (libellé d'accessibilité :
   « Envoyez ce contenu à vos ami(e)s ou publiez-le sur votre profil. »).
4. **« Partager dans un groupe »**.
5. **Taper le nom du groupe dans le champ de recherche** plutôt que de viser une position dans la
   liste : elle bouge à chaque chargement. Chercher un mot COURT et sans accent (« Vie » et non
   « La Vie à Nosy-Be » : la recherche est sensible aux accents et à la ponctuation).
6. Cliquer le résultat, puis **cliquer dans la zone « Créez une publication publique… »** — au-dessus
   de l'aperçu. ⚠️ Un clic à côté et la frappe part dans le vide : c'est arrivé deux fois.
7. Écrire le texte du jour, cliquer **Publier**.
8. **Attendre ~15 s**, revenir à la page, groupe suivant.

## 5. Les textes (à faire tourner, jamais copier-coller à l'identique)

Ils doivent citer **les plats réellement à l'affiche** (RPC `plats_du_jour_publics()`).
Exemples utilisés le 25/09 :

1. « Les plats du jour des restos de Nosy Be, mis à jour chaque jour. Livraison 10 000 Ar jusqu'à 3 km. »
2. « Envie de manger sans sortir ? Voici ce que les restos de Nosy Be cuisinent aujourd'hui. »
3. « Les plats du jour de Nosy Be, mis à jour chaque matin par les restaurants. Livraison à domicile, à l'hôtel ou en villa. »
4. « Ce midi à Nosy Be : paella, calamar au pesto, escalope milanaise… Tout ce que les restos cuisinent aujourd'hui. »
5. « Vous êtes à Nosy Be ? Voici les plats du jour des restaurants de l'île, livrés à votre hôtel ou votre villa. »
6. « Manger bon sans bouger : voici les plats du jour des restaurants de Nosy Be. »
7. « Aujourd'hui à Nosy Be : les plats du jour des restos, livrés chez vous. »

## 6. Le journal, à tenir à chaque session

Une ligne par publication : **date, groupe, texte utilisé, résultat** (publié / en attente de
validation / refusé / erreur Facebook). Sans ce journal, impossible de savoir où reprendre la
rotation ni quels groupes exigent l'accord d'un administrateur.

État au 2026-09-25 (vague 1) : Le Bon coin Nosy be · Bon prix Nosy be · NOSY BE HELL-VILLE ·
Le BonCoin et Plan de NosyBe · TOURISME - NOSY BE - MADAGASCAR · Business Madio à Nosy-Be ·
La Vie à Nosy-Be. **Reprendre la rotation après « La Vie à Nosy-Be ».**

## 7. Lire le résultat, et décider quoi garder

**Livré le 2026-09-25** : les liens sont marqués, et les chiffres sont **dans le tableau de bord**,
pas ailleurs.

### Où regarder

**Admin → onglet 📈 Audience → « Ce que rapporte chaque groupe Facebook ».**
<https://taxi-food-admin-nosybe.netlify.app>

Une ligne par groupe, sur la période choisie (7 / 14 / 30 / 90 jours) :

| Colonne | Ce que c'est |
|---|---|
| **Ouvertures** | la page `/jour` ouverte depuis ce groupe |
| **Vers l'app** | le visiteur a tapé « Commander » et est parti vers l'application |
| **Commandes** | les commandes passées par quelqu'un arrivé par ce groupe (≤ 7 jours avant) |
| **Livrées** | celles qui sont allées au bout |
| **Chiffre d'affaires** | le total des commandes **livrées** seulement |

Le tableau est trié par **commandes décroissantes**. Il affiche aussi « Mesuré depuis le JJ/MM » :
⚠️ **les publications faites avant cette date ne portent pas d'étiquette** et ne comptent nulle
part — un zéro sur un groupe publié avant ne veut rien dire.

Umami reste en place pour le reste (visiteurs, provenance, référencement) : les deux boutons
« Ouvrir Umami » sont dans le même onglet. Mais il ne sert plus à la mesure par groupe — son API
est payante, ses chiffres ne peuvent ni être affichés ici ni être croisés avec les commandes.

### Les deux pièges qui rendaient tout ceci impossible

⚠️ **Facebook remplace le lien cliqué par `og:url`.** Une publication ne renvoie pas les gens vers
l'adresse collée dans le composeur, mais vers celle que la page déclare elle-même. Sans rien faire,
l'étiquette `?g=` disparaissait entre le clic et l'arrivée.
`landing/netlify/functions/partage.mjs` **réinjecte donc le `g` reçu dans `og:url`**, à côté de
l'empreinte `?v=` qui force Facebook à relire la page quand les plats changent. Le `canonical`,
lui, reste sans étiquette : une seule page pour Google.

⚠️ **La vitrine et l'application sont deux domaines.** L'étiquette est donc reportée sur le lien
« Commander », mémorisée **7 jours** dans le navigateur, et posée sur la commande au moment où
elle est créée. Sans ce relais, on saurait qui ouvre une page, jamais qui commande.

### Ce que cette étiquette ne fait pas

⚠️ **Elle ne touche à AUCUN montant.** Ni prix, ni remise, ni frais de livraison, ni commission.
`create_order` ne la connaît même pas : elle est posée après coup, sur une commande déjà chiffrée
en base, par une fonction qui n'accepte que la commande de l'appelant, une seule fois, dans
l'heure. Et elle n'enregistre **aucune donnée personnelle** : ni adresse IP, ni compte, ni agent
utilisateur.

### Comment décider, au bout d'une semaine — trois lignes

1. Chaque groupe a reçu **2 publications** (rotation de 6 par jour sur une vingtaine de groupes) :
   la comparaison est honnête, personne n'a été publié plus souvent qu'un autre.
2. On classe sur les **commandes**, et à défaut sur **vers l'app** : ouvrir une page ne coûte rien,
   aller vers l'application est le premier geste qui ressemble à un client. Un groupe à
   **zéro « vers l'app » sur la semaine** sort de la rotation.
3. On garde les **5 ou 6 premiers** et on les publie plus souvent ; les autres passent à une fois
   par semaine ou disparaissent. À reprendre chaque mois — une audience de groupe bouge.

⚠️ **Zéro ouverture ne veut pas toujours dire « mauvais groupe »** : une publication en attente de
validation d'un administrateur n'a jamais été vue. Le journal du § 6 dit lesquelles ; ne pas
condamner un groupe sur une publication qui n'est jamais parue.

## 8. Ce qui, lui, peut être VRAIMENT automatique

- **La publication quotidienne sur la page** (API Graph, comme Rentanoo) : autorisée, fiable.
- **L'image et le texte** : déjà fabriqués par `/jour` et `apercu.jpg`.
- **Le rappel** à 11 h pour lancer la session de partage.
- **L'annonce aux clients** (notification + e-mail), depuis l'onglet 📣 Annonce de l'admin.

## 9. L'outil officiel de Meta — ce qu'il fait, ce qu'il ne fait pas

Vérifié le 25/09/2026 dans **Meta Business Suite → Créer une publication → Publier dans**
(business.facebook.com, page Taxi Food Nosy Be). C'est l'outil que le bandeau Facebook propose.

**Ce qu'il sait faire**
- Publier le même texte + lien **dans la page ET dans des groupes**, d'un seul geste.
- **Programmer** la date et l'heure — y compris avec des groupes sélectionnés (testé : la case
  « Programmer → Définir la date et l'heure » reste active, le bouton devient « Programmer »).
  Meta suggère même les créneaux où l'audience est la plus active.
- Officiel, donc **aucun risque de blocage** — contrairement à un pilotage du navigateur.

**Ses deux limites, qui décident de tout**
1. **Trois groupes maximum par publication.** Au-delà, les autres cases se grisent. Ce n'est pas
   contournable : c'est la règle de Meta.
2. **Il ne voit que les groupes que la PAGE a rejoints** — sept aujourd'hui : Le grand marché de
   nosy-be (8 447), Bizness nosy be hell ville (12 385), Amici italiani (3 132), Nosy Bon Coins
   (13 251), MADAGASCAR TOURIST INFO (4 216), NosyBe Bonnes Affaires (7 632), TRAGNO AFONDRO ETO
   NOSY BE HELLE VILLE (15 025). Les vingt autres groupes ont été rejoints avec le **profil
   personnel** : l'outil les ignore.

**Conséquence pratique**
- Pour les groupes déjà rejoints par la page : **une publication programmée par groupe** (et non
  trois d'un coup) — sinon les trois groupes reçoivent le même lien et l'étiquette `?g=` ne
  distingue plus rien (§ 3 bis). Sept publications à programmer, gratuites, sans ordinateur
  piloté.
- Pour élargir : **faire rejoindre les autres groupes par la page Taxi Food** (bouton « Rejoindre »
  en tant que page, quand l'administrateur du groupe l'autorise — beaucoup le refusent). Chaque
  groupe gagné sort définitivement de la corvée manuelle.
- Le reste — les groupes qui n'acceptent que les profils personnels — continue à la main, avec la
  rotation du § 2.

⚠️ Ne pas confondre avec l'API Graph : publier dans un groupe par API est **fermé depuis 2020**.
Meta Business Suite est une interface, pas une API : il n'y a rien à automatiser côté code.

---

## JOURNAL DES PUBLICATIONS

### 2026-09-25, vague 1 — PARTAGE de la publication de la page (NON MESURABLE)
Le Bon coin Nosy be · Bon prix Nosy be · NOSY BE HELL-VILLE · Le BonCoin et Plan de NosyBe ·
TOURISME - NOSY BE - MADAGASCAR · Business Madio à Nosy-Be · La Vie à Nosy-Be.
⚠️ Fait avant les liens marqués : **ces sept-là ne comptent rien**, le lien emporté est celui de la
publication, identique pour tous. Et NOSY-BE Petit Paris affichait « 1 publication en attente » :
une partie de cette vague n'a même jamais été vue.

### 2026-09-26, 11 h — LES GROUPES DE LA PAGE, 36 publications

Publication de la page programmée à 11 h par Christopher ; partage lancé à 11 h 05. Consigne :
« aucun groupe de la page Taxi Food ne doit être oublié ».

**Les 27 groupes atteints depuis le profil** (composeur du groupe, lien marqué, texte différent à
chaque fois — français, malgache, italien, anglais) :

`business207` · `tanyalafo` · `zanaka` · `inovaovao` · `ambiance` · `bizness` · `mbizna` ·
`grandmarche` · `haveyoubeen` · `mbiznaville` · `nosybepub` · `venteenligne` · `tsarabusiness` ·
`plaisirs` · `toutsur` · `leboncoin` · `hellville` · `tourisme` ⏳ · `businessmadio` · `bonprix` ·
`lavie` · `boncoinplan` · `petitparis` ⏳ · `bonnesaffaires` · `amici` · `sejour` · `bazarbe`

⏳ = groupe qui modère : TOURISME - NOSY BE - MADAGASCAR (3 publications en attente) et NOSY-BE
Petit Paris (2 en attente, dont celle d'hier). Ces deux-là coûtent du temps et n'ont encore jamais
rien rapporté.

**Les 9 groupes atteints depuis Meta Business Suite, en tant que PAGE** — parce que le profil
personnel n'en est pas membre :

| Groupe | Membres | Slug |
|---|---|---|
| TRAGNO AFONDRO ETO NOSY BE HELLE VILLE | 15 057 | `tragnoafondro` |
| BON PLAN VACANCES À NOSY BE MADAGASCAR | 14 987 | `bonplanvacances` |
| Nosy Bon Coins | 13 269 | `bonscoins` |
| BIZNA SY SERA ETO NOSY BE HELL VILLE (privé) | 11 947 | `biznasera` |
| Visit Nosy be Madagascar Island | 6 249 | `visitnosybe` |
| Nosy Be Madagascar '' | 4 865 | `nosybemada` |
| MADAGASCAR TRAVEL with Tour Guide | 4 589 | `madatravel` |
| Nosy be business | 4 404 | `nosybebusiness` |
| MADAGASCAR TOURIST INFO | 4 238 | `touristinfo` |

### ⚠️ La découverte du jour : le sélecteur de Meta est une liste TOURNANTE

La fenêtre « Publier dans des groupes Facebook » de Meta Business Suite n'affiche que **7 groupes
à la fois, et pas toujours les mêmes** : à chaque rechargement du composeur, elle en propose sept
autres. **Il n'existe donc aucun écran qui liste d'un coup tous les groupes de la page.** La seule
méthode connue est de recharger le composeur en boucle et de noter les nouveaux noms.

Conséquence directe : **on ne peut pas certifier qu'aucun groupe n'a été oublié.** On peut
seulement dire ce qui a été servi, et ce qu'on a vu passer sans le servir.

**Vus mais pas encore servis, à prendre en priorité au prochain passage :**
Top business Nosy be hell ville (8 836) · Nosy Be , Tiako (5 832) · bizna nosy be hell ville ·
Nosy Be mora tany alafo | trano afondro.

**Autre enseignement** : depuis le composeur d'un groupe, Facebook publie désormais **au nom de la
page Taxi Food Nosy Be** et non du profil de Christopher — sauf dans le tout premier groupe de la
session. C'est mieux (la marque signe), mais ce n'est pas nous qui l'avons choisi.

**Méthode Meta Business Suite, à réutiliser** : composeur → « Publier dans » → « Voir d'autres
groupes » → cocher UN seul groupe → Enregistrer → rouvrir « Publier dans » → **décocher la page
Taxi Food Nosy Be** (sinon la publication part aussi sur la page, en doublon du post de 11 h) →
écrire le texte + le lien marqué → Publier. Un groupe par publication : cocher les trois groupes
autorisés leur donnerait le même lien, donc la même étiquette, et la mesure serait perdue.

### 2026-09-25 au soir, vague 2 — LIEN MARQUÉ publié DANS le groupe (mesurable)

| Groupe | Membres | Étiquette | Résultat |
|---|---|---|---|
| NOSY-BE Petit Paris | 16 300 | `petitparis` | ⏳ **en attente d'un administrateur** |
| Amici italiani (Nosy be Madagascar) | 3 100 | `amici` | ✅ publié (texte en italien) |
| Bizness nosy be hell ville | 12 400 | `bizness` | ✅ publié |
| INO VAOVAO NOSY BE HELL-VILLE | 21 600 | `inovaovao` | ✅ publié |
| Zanaka nosy be mila tragno | 25 200 | `zanaka` | ✅ publié (accroche en malgache) |
| Business Nosy-Be (Hell Ville 207) | 39 700 | `business207` | ✅ publié |
| TANY ALAFO SY TRANO AFONDRO… 207 | 25 400 | `tanyalafo` | ✅ publié (accroche en malgache) |
| Nosy be hell Mbizna | 10 100 | `mbizna` | ✅ publié |
| Séjour Nosybe et Nord Madagascar | 5 500 | `sejour` | ✅ publié |
| Have you been Nosy Be? | 725 | `haveyoubeen` | ✅ publié (texte en anglais) |
| BAZAR BE NOSY BE | 2 200 | `bazarbe` | ✅ publié |
| Nosy be hell ville M bizna | — | `mbiznaville` | ✅ publié |
| Le grand marché de nosy-be | 8 447 | `grandmarche` | ✅ publié |
| NOSY-BE PUB | — | `nosybepub` | ✅ publié |
| Nosy be vente en ligne | — | `venteenligne` | ✅ publié |
| AMBIANCE À NOSY BE | 20 700 | `ambiance` | ✅ publié |
| Nosybe Tsara Business \| Tany alafo & Trano afondro | — | `tsarabusiness` | ✅ publié |
| Nosy-Be Plaisirs de vacances | — | `plaisirs` | ✅ publié |
| Bizness Tout Sur Nosy Be | — | `toutsur` | ✅ publié |

**19 publications ce soir** (18 parues + 1 en attente), un texte différent à chaque fois, trois
langues. **Reprendre la rotation après « Bizness Tout Sur Nosy Be ».**

⚠️ **Groupe volontairement écarté : « Fitadiavana Asa eto Nosy Be »** — groupe de recherche
d'emploi. Une annonce de livraison de repas y serait hors sujet, supprimée, et pourrait faire
exclure le compte. Ne pas le reprendre dans la rotation.

Identifiants des huit derniers groupes, pour les retrouver sans chercher :
`facebook.com/groups/302974809351919` (M bizna), `295031501540330` (grand marché),
`293405054684497` (PUB), `552810303637676` (vente en ligne), `486950544671896` (AMBIANCE),
`891645463108338` (Tsara Business), `936640151968666` (Plaisirs de vacances),
`850147542271601` (Tout Sur Nosy Be).

**Restent à faire avec un lien marqué** (déjà touchés en vague 1, donc sans mesure) : Le Bon coin
Nosy be, Bon prix Nosy be, NOSY BE HELL-VILLE, Le BonCoin et Plan de NosyBe, TOURISME - NOSY BE -
MADAGASCAR, Business Madio à Nosy-Be, La Vie à Nosy-Be. Puis les groupes encore jamais publiés :
Nosy be hell ville M bizna, Bizna Nosy be hell ville, Nosy-Be Plaisirs de vacances, Nosy Be mora
tany alafo | trano afondro avec Mornique, Varotra rehetra eto Nosy Be, Business Nosy bé Magnifique,
TRAGNO AFONDRO ETO NOSY BE HELLE VILLE, Nosy Be Tiako, Actualité Nosy Be, MADAGASCAR…

**Leçon de la soirée** : un groupe sur onze modère les publications. Le journal sert justement à
repérer ceux qui laissent nos publications en attente : ils coûtent du temps et ne rapportent rien.
