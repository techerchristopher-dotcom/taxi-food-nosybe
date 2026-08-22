# Taxi Food Nosy Be — landing de pré-lancement

Site statique, **six pages** (deux vues × trois langues) plus une page légale, aucune
dépendance à un framework. Tout est dans ce dossier : on peut le déposer tel quel sur Netlify.

---

## 1. Ce que c'est

| URL | Fichier | Rôle |
|---|---|---|
| `/` · `/en/` · `/it/` | `index.html`, `en/index.html`, `it/index.html` | Page **client**. Objectif : inscription à la liste d'attente. |
| `/restaurants-partenaires/` · `/en/restaurant-partners/` · `/it/ristoranti-partner/` | `restaurants-partenaires/index.html` et ses deux traductions | Page **restaurateur**. Objectif : être contacté (appel, WhatsApp, RDV, rappel). |
| `/confidentialite/` | `confidentialite/index.html` | Politique de confidentialité, **trilingue dans une seule URL**. Indexable, présente dans le sitemap. |

⚠️ **Sept URL en tout, pas deux.** Toute vérification post-déploiement (curl, Search
Console, débogueur Facebook) doit les couvrir toutes : c'est justement sur les quatre
pages EN/IT que le risque de 404 est réel, puisqu'elles sont générées.

La maquette d'origine (`Landing Pre-lancement.dc.html`) contenait les deux vues dans **un seul
document**, l'une cachée en `display:none`. Elles ont été séparées en deux URL réelles : deux
titres, deux descriptions, un seul `<h1>` chacune, un aperçu de partage distinct, et surtout
**un lien partageable** pour l'argumentaire restaurateur — c'est celui qu'on envoie par WhatsApp
à un patron de resto. Le sélecteur du header est devenu deux vrais `<a href>`.

### Poids réel, mesuré dans le navigateur

| | Maquette d'origine | Ce site |
|---|---|---|
| Page client | 16,98 Mo | **207 Ko** (19 requêtes) |
| Page restaurateur | ~16 Mo | **213 Ko** (12 requêtes) |
| Dépendances CDN | React + ReactDOM + Babel (~3 Mo depuis unpkg) + Calendly | **Google Fonts uniquement** |

Sur une 3G lente à Nosy Be (~50 ko/s) : de près de 6 minutes à **environ 5 secondes**.

---

## 2. Comment modifier la page

### ⚠️ Le site est en trois langues — ne jamais éditer `/en/` ni `/it/` à la main

Six pages, deux groupes :

| | Client | Restaurateur |
|---|---|---|
| Français | `/` | `/restaurants-partenaires/` |
| Anglais | `/en/` | `/en/restaurant-partners/` |
| Italien | `/it/` | `/it/ristoranti-partner/` |

L'italien n'est pas une langue « au cas où » : Nosy Be reçoit des vols charter directs
depuis l'Italie, la clientèle italophone est structurelle sur l'île.

**Les deux pages françaises sont la source ; les quatre autres sont générées.** Le texte
traduit est écrit **en dur** dans chaque fichier — rien n'est injecté par JavaScript, donc
la page reste lisible par les moteurs et par un visiteur sans JS.

Après toute modification d'une page française :

```bash
python3 tools/build-i18n.py        # depuis le dossier landing/
```

Le script relit les deux pages françaises, remplace chaque segment connu de `i18n/fr.json`
par sa traduction dans `i18n/en.json` et `i18n/it.json`, et réécrit **six fichiers** : les
quatre pages traduites **et les deux manifestes PWA** `en/site.webmanifest` et
`it/site.webmanifest`. Éditer `/en/` ou `/it/` directement ne sert à rien : la génération
suivante écrase.

Le manifeste français `site.webmanifest` est la **source** des deux autres, exactement comme
les pages françaises : le script n'y remplace que `description`, `lang` et `start_url`, et
s'arrête si ces trois champs ne correspondent plus à `i18n/fr.json`. Sans manifeste par
langue, un visiteur anglophone qui ajoute le site à son écran d'accueil obtenait une
description française et un `start_url` qui le ramenait sur la page française.

⚠️ **`/confidentialite/` n'est pas générée par ce script** et n'a aucune clé dans les
`i18n/*.json` : c'est un document trilingue écrit à la main, en un seul fichier. Ses trois
sections doivent être modifiées ensemble, dates de mise à jour comprises.

**Un texte nouveau exige une clé nouvelle dans les trois `i18n/*.json`.** Sans elle, il
resterait en français sur les pages traduites — et le script s'en aperçoit et refuse
d'écrire, plutôt que de publier une page à moitié traduite.

Deux garde-fous, tous deux bloquants :

1. le gabarit est d'abord rendu **en français** et comparé octet à octet au fichier
   source ; s'ils diffèrent, la tokenisation a abîmé quelque chose et rien n'est écrit ;
2. chaque page produite est relue : si un segment français qui possède une traduction y
   subsiste, le script échoue en nommant la clé fautive.

Le sélecteur FR / EN / IT de l'en-tête est fait de **vrais liens `<a href>`** (pour que
Google les suive et que « ouvrir dans un nouvel onglet » fonctionne), et chaque page
déclare ses deux sœurs en `hreflang`, dans le `<head>` **et** dans `sitemap.xml`.
Changer une URL de page oblige donc à toucher trois endroits : `tools/build-i18n.py`
(dictionnaire `PATHS`), les `<link rel="alternate">`, et le sitemap.

**Il n'y a pas de redirection automatique selon la langue du navigateur**, et c'est
délibéré — voir la section 8.

### Modifier un texte, une couleur, une taille

Ouvrir le `.html` et éditer directement. **Tous les styles sont en ligne** (`style="..."`),
exactement comme dans la maquette validée : il n'y a pas de feuille de style à chercher.
Le petit bloc `<style>` du `<head>` ne contient que les animations, les états `:hover` /
`:focus`, et trois correctifs responsive commentés.

### Modifier les textes de la démonstration (le téléphone animé)

Ces textes-là ne sont **pas** au même endroit, parce qu'ils changent à chaque étape.
Ils sont dans le `<script>` en bas de page, dans le tableau `var CFG = [...]` :

```js
{
  "file": "01-accueil",                       // nom de l'image dans /img/app/
  "hint": "Touchez pour ouvrir La Cabane",    // légende sous le téléphone
  "label": "1 · Restaurant",                  // pastille au-dessus
  "bg": "#E8342A", "color": "#fff",           // couleur de l'étape
  "title": "Choisissez un restaurant",        // titre sous la frise
  "desc": "La liste des restos de Nosy Be…",  // description
  "alt": "Écran d'accueil de l'app…"          // texte alternatif de l'image
}
```

⚠️ **L'état de départ (étape 1) est aussi écrit en dur dans le HTML**, pour que la page reste
lisible par Google et sans JavaScript. Si vous changez l'étape 1 dans `CFG`, changez-la aussi
dans le HTML (chercher `data-tx="clientPhone.stepTitle"`), sinon le texte « saute » au
chargement. Les étapes 2 à 6 n'existent que dans `CFG`.

### Ajouter une étape à la démonstration

Ajouter l'objet dans `CFG` **et** ajouter le bouton correspondant dans la frise
(chercher `data-row=`). Le nombre d'étapes est déduit de `CFG.length`, le modulo suit tout seul.

---

## 3. Comment ça marche techniquement

Le runtime propriétaire de la maquette (React 18 + ReactDOM + Babel transpilé dans le
navigateur) a été remplacé par un **mini-runtime maison d'environ 120 lignes**, en haut du
`<script>` de chaque page. Principe :

1. **Une seule passe de compilation** au démarrage : on parcourt le DOM, on repère les attributs
   `data-*` ci-dessous, et on garde une référence directe sur chaque nœud à mettre à jour.
2. **Chaque changement d'état ne réécrit que ce qui a bougé.** Jamais d'`innerHTML`, jamais un
   nœud recréé, jamais un écouteur réattaché. Les champs de formulaire, en particulier, ne sont
   jamais reconstruits : ce que l'utilisateur a tapé ne peut pas disparaître.

| Attribut | Effet |
|---|---|
| `data-tx="expr"` | remplace le texte de l'élément |
| `data-st="expr"` | remplace la totalité du `style` |
| `data-show="expr"` | pilote uniquement `display` |
| `data-attr-src`, `data-attr-srcset`, `data-attr-alt`, `data-attr-disabled` | pilotent un attribut |
| `data-on="nom"` | branche un clic sur le gestionnaire `nom` |

Le texte éditorial (titres, paragraphes, cartes) n'est **jamais** produit par JavaScript : il est
écrit dans le HTML. C'est ce qui permet aux moteurs de recherche et aux robots de partage
(Facebook, WhatsApp — qui n'exécutent pas de JavaScript) de lire la page.

---

## 4. Où atterrissent les inscriptions

Les deux formulaires appellent une **fonction RPC** de **Supabase** (projet
`bmdveawomizjpiebgtkj`), par `POST` sur l'API REST, sans bibliothèque.

| Formulaire | RPC appelée | Paramètres envoyés |
|---|---|---|
| Liste d'attente (page client) | `submit_waitlist` | `p_full_name`, `p_phone`, `p_email` (ou `null`), `p_role: "client"`, `p_honeypot`, `p_suspect` |
| Être rappelé (page restaurateur) | `submit_restaurant_lead` | `p_first_name`, `p_last_name`, `p_restaurant_name`, `p_phone`, `p_honeypot`, `p_suspect` |

⚠️ **Les pages n'écrivent plus directement dans les tables** `waitlist_signups` et
`restaurant_leads`, **et surtout plus personne ne le peut**. Les deux RPC sont
`SECURITY DEFINER` : elles valident la saisie, limitent la cadence par adresse, et décident
seules de ce qui est écrit — `source` compris, que la page n'envoie donc plus.

⚠️ **Piège de raisonnement, à ne pas refaire.** Le passage aux RPC, le 22 août 2026, avait
déplacé le chemin d'écriture *de la page* sans fermer l'ancien : les policies RLS
`anon can insert waitlist signups` et `anon insert leads` étaient toujours en place, et le
rôle `anon` gardait tous ses droits de table. La clé étant publique, n'importe qui pouvait
donc continuer à déposer un nombre illimité de lignes en ignorant complètement la page —
sans honeypot, sans validation, sans limitation de cadence, et en choisissant lui-même la
colonne `source`. **Changer le code de la page ne ferme jamais un trou côté base.**

Corrigé le 22 août 2026 (migration `landing_ferme_ecriture_directe_et_fiabilise_ip`) :

```sql
drop policy "anon can insert waitlist signups" on public.waitlist_signups;
drop policy "anon insert leads" on public.restaurant_leads;
revoke all on public.waitlist_signups, public.restaurant_leads,
              public.landing_submissions_log from anon, authenticated;
```

**État à vérifier après toute migration** : il ne doit exister **aucune** policy pour `anon`
sur ces trois tables, et `anon` ne doit avoir **aucun** droit de table. Les RPC continuent
d'écrire parce qu'elles appartiennent à `postgres`, lui-même propriétaire des trois tables
(`relforcerowsecurity = false`).

```bash
# Doit repondre 401. Un 201 signifie que le trou est rouvert.
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  "https://bmdveawomizjpiebgtkj.supabase.co/rest/v1/waitlist_signups" \
  -H "Content-Type: application/json" -H "apikey: $CLE" -H "Authorization: Bearer $CLE" \
  -d '{"full_name":"ZZZ","phone":"+261 34 00 00 000","role":"client","source":"ZZZ"}'
```

⚠️ **Une RPC qui réussit répond `204 No Content`**, pas `200`. Le code traite explicitement
`204` comme un succès. Le confondre avec un échec afficherait un message d'erreur sur une
inscription pourtant enregistrée.

Trois réponses possibles, trois messages distincts et traduits — un message unique
n'apprendrait rien à quelqu'un qui vient de taper son numéro :

| Réponse | `code` du corps JSON | Ce que la page affiche |
|---|---|---|
| `400` | `22023` | saisie invalide : nom, téléphone ou e-mail à corriger |
| `500` | `53400` | trop de tentatives depuis cette connexion, réessayer plus tard |
| tout le reste (réseau, panne) | — | message générique « réessaie dans un instant » |

**Pour lire les inscriptions** : tableau de bord Supabase → Table Editor. Elles ne sont pas
lisibles depuis le site — une lecture avec la clé publique répond `401`, comme l'écriture.

**La clé publique est en clair dans le HTML, et c'est normal** : elle est publique par
conception chez Supabase. Mais la protection ne vient **pas** du secret de la clé : elle
vient du fait que `anon` n'a aucun droit sur les tables et ne peut appeler que les deux RPC.
Il ne faut jamais mettre la clé `service_role` dans une page.

⚠️ **Une seule clé pour tout le projet**, `sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv` —
la même que l'application mobile (`app/.env`). Les six pages portaient jusqu'au 22 août 2026
une clé au **format JWT hérité** (`eyJhbGciOi…`), que Supabase retire progressivement : le
jour où elle aurait été désactivée sur le projet, les six pages auraient cessé d'enregistrer
la moindre inscription — en affichant le message générique — pendant que l'application, sur
l'autre format, aurait continué de fonctionner. Une panne invisible, et du mauvais côté.
La clé n'apparaît que dans les deux pages **françaises** : les quatre autres la reçoivent
par `python3 tools/build-i18n.py`.

**L'en-tête `Prefer: return=minimal` a été retiré** le 22 août 2026, en même temps que le
passage aux RPC. Il n'avait de sens que sur une écriture directe en table : il empêchait
PostgREST de relire la ligne insérée alors qu'aucune policy `SELECT` ne l'y autorisait. Sur
un appel RPC, il ne veut rien dire. Ne pas le remettre.

### Anti-spam

Chaque formulaire a deux gardes, **découplées depuis le 21 août 2026** :

1. **Champ piège invisible (`site_web`).** S'il est rempli, c'est un robot : l'écran de
   confirmation s'affiche et rien n'est envoyé. Comportement volontaire, on ne dit pas au robot
   qu'il a été repéré. Sa valeur est **en plus transmise à la RPC** (`p_honeypot`) : la garde
   de la page ne protège que les robots qui passent par la page, et c'est la base qui tranche
   pour tous les autres.
2. **Délai depuis la première interaction avec le formulaire.** Moins de 0,8 seconde entre le
   premier `focus`/`keydown`/`pointerdown` dans le formulaire et l'envoi = vitesse machine.
   ⚠️ **C'est un soupçon, jamais un verdict : l'envoi part quand même.** La page se contente
   de poser `p_suspect: true`, et la RPC écrit alors la ligne avec la source
   `landing_pre_lancement_rapide` (ou `landing_prelancement_rapide` pour un restaurateur).
   Le tri se fait à la lecture, dans le Table Editor.

⚠️ **Ne jamais remettre un `return` dans cette branche.** Jusqu'au 22 août 2026 elle
affichait l'écran de succès **sans rien envoyer** : un visiteur qui remplissait par
autocomplétion du navigateur et validait au clavier voyait « c'est enregistré » alors que
rien n'était parti — inscription perdue en silence, côté page comme côté base. Un faux
positif de robot coûte une inscription réelle ; un faux négatif ne coûte qu'une ligne à
trier. Le même raisonnement vaut pour le chronomètre, qui part de la première interaction et
non du chargement de la page.

Ces deux gardes ne valent que pour les robots qui exécutent la page. La vraie protection est
côté base : validation et limitation de cadence dans les RPC (voir le tableau des codes
d'erreur ci-dessus).

### Limitation de cadence — l'adresse IP retenue

5 envois par heure et par adresse, comptés dans `landing_submissions_log`. L'adresse vient de
`public.landing_client_ip()`.

⚠️ **Ne jamais prendre la première valeur de `x-forwarded-for`.** C'est exactement celle que
l'appelant fournit, le proxy se contentant d'ajouter la sienne derrière : jusqu'au 22 août
2026 la fonction lisait cette première valeur, et un robot qui changeait l'en-tête à chaque
requête n'atteignait donc jamais le seuil. La fonction lit désormais `cf-connecting-ip`, avec
repli sur la **dernière** valeur de `x-forwarded-for`.

Vérifié sur ce projet le 22 août 2026, sur des appels réels :

| Requête | `cf-connecting-ip` | `x-forwarded-for` |
|---|---|---|
| sans en-tête | `102.17.2.168` (réelle) | `102.17.2.168` |
| `X-Forwarded-For: 203.0.113.77` | `102.17.2.168` (inchangée) | `203.0.113.77,102.17.2.168` |
| en posant soi-même `CF-Connecting-IP` | — | requête **rejetée par Cloudflare** (`error code: 1000`, HTTP 403), elle n'atteint jamais Postgres |

`cf-connecting-ip` n'est donc pas usurpable sur ce projet. Si Supabase changeait un jour de
passerelle, **re-journaliser `current_setting('request.headers', true)` sur un appel réel**
avant de changer la fonction : c'est la seule façon de savoir quel en-tête porte l'adresse
d'origine.

---

## 5. D'où viennent les images

Toutes les images étaient servies depuis **Supabase Storage**, en taille d'origine : 107 Mo
cumulés, dont un logo de 4,07 Mo affiché en 56 × 56 px et 42 Mo sur la seule page client.

Elles ont été **rapatriées ici**, redimensionnées aux tailles réellement affichées et converties
en WebP, via l'endpoint de transformation de Supabase :

```
https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/render/image/public/<chemin>
  ?width=<largeur>&height=4000&resize=contain&quality=<q>
```

⚠️ **`resize=contain` et `height` sont obligatoires.** Avec `width` seul, l'endpoint ne conserve
pas les proportions : il renvoie une image écrasée (largeur demandée, hauteur d'origine). Le
`height=4000` est volontairement grand pour que la largeur soit la contrainte qui s'applique.

| Dossier | Contenu | Largeurs |
|---|---|---|
| `img/personas/` | les 3 scènes clients + l'inscription | 400 / 800 / 1200 (420 / 840 pour l'inscription) |
| `img/restaurateur/` | les 6 avant/après + la commande reçue | 400 / 800 / 1200 |
| `img/app/` | captures d'écran de l'app (`01-…` à `06-…` côté client, `resto-1` à `resto-5`) | 240 / 480 |
| `img/produits/` | les 8 plats de La Cabane | 64 / 128 |
| `img/logo/` | La Cabane, Angelo, Taxi Be | 64 / 128 |
| `media/` | vidéo ré-encodée, son poster, le visuel d'attente | — |
| `og/` | images de partage 1200 × 630 | — |
| `assets/` | logo Taxi Food, favicons, icônes du manifeste | — |

**Le nom du fichier encode sa largeur** (`famille-au-calme-800.webp`). Les en-têtes de cache sont
réglés sur un an en `immutable` : si vous **remplacez** une image, changez son nom de fichier
(ou son suffixe), sinon les visiteurs déjà venus garderont l'ancienne.

### Pour régénérer une image

```bash
curl -H "Accept: image/webp" -o img/personas/famille-au-calme-800.webp \
  "https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/render/image/public/marketing/landing/personas/famille-au-calme.png?width=800&height=4000&resize=contain&quality=72"
```

### La vidéo

L'originale faisait **10,1 Mo** en 1080 × 1920 à 2 478 kbit/s — illisible en temps réel sur une
3G, qui plafonne bien en dessous. Elle a été ré-encodée en **540 × 960, 431 kbit/s, 1,76 Mo**
(`media/taxi-food-540.mp4`), soit exactement la définition affichée (278 px CSS en écran Retina).

**L'élément `<video>` n'existe pas dans la page tant qu'on n'a pas touché le bouton de lecture** :
il est créé par JavaScript au clic. Zéro octet de vidéo au chargement — vérifié. C'était déjà le
comportement de la maquette et il ne faut surtout pas le « simplifier » en posant une `<video>`
directement dans le HTML : ce serait 1,76 Mo imposés à chaque visiteur.

Le visuel d'attente reste **le tacos du design** (`media/idle-tacos-720.webp`, 20 Ko au lieu de
1,5 Mo). Le vrai `poster` extrait de la vidéo n'est utilisé que sur l'élément `<video>` lui-même,
donc invisible tant qu'on n'a pas lancé la lecture : le design n'est pas modifié.

Pour ré-encoder à partir d'une nouvelle version :

```bash
ffmpeg -i source.mp4 -vf scale=540:960 -c:v libx264 -crf 28 -maxrate 900k -bufsize 1800k \
  -c:a aac -b:a 64k -ac 1 -movflags +faststart media/taxi-food-540.mp4
ffmpeg -i media/taxi-food-540.mp4 -ss 0.8 -vframes 1 -vf scale=560:-1 -q:v 3 media/poster-video.jpg
```

### Les icônes

Les 18 pictogrammes venaient de la police **Material Symbols Rounded** : 370 Ko téléchargés pour
18 signes, et — le pire — tant que la police n'était pas arrivée, le navigateur affichait les
**noms en toutes lettres** (« arrow_forward », « notifications_active ») au milieu du français.

Ils sont maintenant en **SVG inline**, dans un `<svg>` de symboles en haut du `<body>`, appelés
par `<use href="#ic-nom">`. Environ 8 Ko, zéro requête, zéro défaut d'affichage.

⚠️ **Piège** : le `viewBox="0 -960 960 960"` doit être **uniquement sur le `<symbol>`**, jamais
sur le `<svg class="i">` qui l'appelle. Si les deux le portent, l'icône est dessinée hors du
cadre visible et **rien ne s'affiche** (le bug est silencieux : géométrie correcte, pixels
invisibles).

### Les icônes d'application (`assets/*.png`)

`assets/icon-tile.png` (392 × 392, 196 Ko) a été **supprimé** : il n'était référencé ni par les
pages ni par `site.webmanifest`, il partait en production pour rien. Le deck de présentation
(`design/taxi-food-deck/`) en garde sa propre copie, il n'est pas affecté.

Les quatre PNG restants (`favicon-32`, `icon-192`, `icon-512`, `apple-touch-icon`) sont **laissés
en RGBA pleine qualité**, à contre-courant du réflexe « passer les PNG en palette ». Testé et
rejeté : le logo n'est pas un aplat, c'est un **dégradé lisse sur deux axes** (42 445 couleurs
distinctes sur le 512). Une palettisation à 255 couleurs le ramène bien de 299 à 33 Ko, mais fait
apparaître un tramage en diagonale visible sur le dégradé — inacceptable sur l'icône de marque.

Ces fichiers ne sont de toute façon pas sur le chemin critique : au premier chargement, seul
`favicon-32.png` (2,6 Ko) est demandé. Et `site.webmanifest` déclare `"display": "browser"`, ce
qui rend le site **non installable** au sens de Chrome — il n'y a donc pas d'invite d'installation
Android qui irait chercher le 512. Si le jour vient où l'on passe en `"display": "standalone"`,
c'est **à ce moment-là** qu'il faudra fabriquer un 512 plus léger — idéalement en repartant du
vectoriel, pas en dégradant celui-ci.

---

## 6. Déploiement Netlify

Le dossier publié est **`landing/`**.

### 🛑 L'ordre des étapes est bloquant, pas cosmétique

**Le domaine doit exister AVANT le premier déploiement public.** Ce n'est pas une préférence :
l'intégralité des URL absolues du site — `canonical`, `og:url`, `og:image`, `twitter:image`, les
**sept** `<loc>` du `sitemap.xml`, les vingt-quatre `<xhtml:link rel="alternate">` du graphe
hreflang et les `@id`/`url` du graphe JSON-LD des six pages — pointent sur
`https://taxifood.rentanoo.com/`.

Au 21 août 2026, **ce nom n'existe pas** :

```bash
$ dig @8.8.8.8 taxifood.rentanoo.com +noall +comment | grep -i status
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN
```

Publier sur `*.netlify.app` avant de créer l'enregistrement DNS coûte trois choses d'un coup :

1. chaque page déclare un `canonical` vers un hôte injoignable — Google considère la page comme
   non canonique et la sort de l'index. C'est un auto-désindexage ;
2. l'`og:image` est infetchable par les scrapers : **aucun aperçu sur WhatsApp ni Facebook**, qui
   sont *le* canal de partage de cette audience ;
3. le `sitemap.xml` déclare sept URL mortes.

### 🛑 Les six pages doivent être commitées, pas seulement les deux françaises

Netlify déploie **depuis git**, pas depuis le disque. Les quatre pages EN/IT sont générées :
il est facile de les laisser en `??` dans `git status` alors que le `sitemap.xml` et les
`hreflang` des pages françaises, eux, sont commités. On publie alors un graphe hreflang qui
pointe vers quatre URL en 404 — et Google, voyant des liens non réciproques, **ignore le
groupe entier** : ni `/en/` ni `/it/` ne sont indexés, et la page française perd le bénéfice
du groupe. C'est exactement ce que le hreflang est censé éviter.

Avant tout déploiement :

```bash
git status --porcelain -uall landing/     # aucune ligne "??" ne doit subsister
git ls-files landing/en landing/it landing/i18n landing/tools   # doit lister les fichiers
```

**Séquence à respecter :**

1. 🛑 Créer l'enregistrement DNS `taxifood.rentanoo.com` (CNAME vers le site Netlify), puis dans
   Netlify → *Domain management* → **le définir comme « primary domain »**. C'est aussi la seule
   protection réelle contre le contenu dupliqué : Netlify redirige alors le sous-domaine
   `netlify.app` en 301 vers le domaine canonique.
   ⚠️ Contrairement à ce qu'on lit souvent, Netlify ne pose de `X-Robots-Tag: noindex` **que** sur
   les *deploy previews* et les *branch deploys* — **jamais** sur le sous-domaine `netlify.app`
   de production, qui reste pleinement indexable.
2. Netlify → *Site configuration* → *Build & deploy* → **Base directory : `landing`**,
   *Build command* : vide, *Publish directory* : `landing`.
3. Déployer, puis vérifier que le domaine répond vraiment **avant** de partager le lien :

```bash
dig @8.8.8.8 taxifood.rentanoo.com +short                            # doit renvoyer une réponse
curl -I https://taxifood.rentanoo.com/og/taxi-food-nosy-be.jpg       # attendu : 200, image/jpeg

# LES SIX PAGES, pas deux : les quatre EN/IT sont celles qui risquent le 404.
for u in / /en/ /it/ \
         /restaurants-partenaires/ /en/restaurant-partners/ /it/ristoranti-partner/ \
         /confidentialite/ /sitemap.xml \
         /site.webmanifest /en/site.webmanifest /it/site.webmanifest; do
  curl -s -o /dev/null -w "%{http_code} $u\n" -L https://taxifood.rentanoo.com$u
done
```

Les onze doivent renvoyer `200`. **Tant que ce n'est pas le cas, ne pas soumettre le sitemap
à Search Console** : un sitemap qui déclare des URL mortes coûte plus qu'il ne rapporte.

Si un déploiement de test sur `*.netlify.app` est inévitable entre-temps, décommenter la
redirection de domaine préparée en bas de `_redirects` (il y a un `NOM-DU-SITE` à remplacer).
Ne pas se contenter d'un commentaire dans `robots.txt` : un commentaire n'a aucun effet sur le
crawl.

`_headers` et `_redirects` sont lus par Netlify **depuis le dossier publié**, quoi qu'il arrive :
ce sont eux qui font foi. `netlify.toml` reprend la même chose et sert si vous placez la base
ailleurs (dans ce cas, déplacez-le à la racine du dépôt et mettez `publish = "landing"`).

Cache : un an en `immutable` sur `/img/` et `/media/`, 30 jours sur `/assets/`, 7 jours sur
`/og/`, et **revalidation systématique du HTML** — une correction de texte est donc visible
immédiatement.

### Juste après la mise en ligne

- [ ] Passer les **six** URL dans <https://developers.facebook.com/tools/debug/> et cliquer
      **Scrape Again** — Facebook et WhatsApp gardent l'ancien aperçu jusqu'à 30 jours.
- [ ] S'envoyer les **six** liens sur WhatsApp depuis un téléphone et vérifier que le grand
      aperçu s'affiche (les images font 98 et 91 Ko, bien sous le seuil d'environ 300 Ko de
      WhatsApp).
- [ ] Déclarer les **six** URL dans Google Search Console et demander l'indexation, puis
      vérifier dans le rapport *Ciblage international* que les trois groupes hreflang sont
      reconnus. Un « lien alternatif non réciproque » signale une page manquante en ligne.
- [ ] Vérifier le balisage sur <https://search.google.com/test/rich-results>.
- [ ] Poser un lien depuis la page d'accueil de `rentanoo.com` vers `taxifood.rentanoo.com`,
      avec l'ancre « Livraison de repas à Nosy Be ». C'est le meilleur lien entrant disponible,
      il est gratuit, et il accélère l'indexation de plusieurs semaines.

### Vérifier en local avant de pousser

```bash
cd landing && python3 -m http.server 8899
# puis http://localhost:8899/
```

Un simple double-clic sur `index.html` ne suffit pas : les chemins sont absolus (`/img/…`).

---

## 7. Ce qui reste à faire — points en suspens

### Bloquant pour la publicité

- [x] **Page `/confidentialite/` — créée, et trilingue depuis le 22 août 2026.** Le lien du
      pied de page des six pages ne tombe plus dans le vide, et un visiteur anglophone ou
      italophone y trouve désormais **sa** langue : les trois versions vivent dans la même
      URL, chacune dans un `<section lang="…">`. C'est indispensable, pas décoratif — le
      document se déclare `lang="fr"`, et sans le `lang` par section Google voyait une page
      française dont les deux tiers du texte ne le sont pas.
      Elle est **indexable et présente dans `sitemap.xml`** (elle porte un `canonical` et une
      `meta description` depuis la même date), sans alternative `hreflang` puisqu'il n'existe
      qu'une URL. Ne pas créer `/en/privacy/` ni `/it/privacy/` sans refaire en même temps le
      groupe hreflang du sitemap.
      ⚠️ Les trois sections décrivent **les deux formulaires de pré-lancement**, pas seulement
      l'application : ce sont les seules données que le site collecte aujourd'hui. La version
      anglaise ne les couvrait pas jusqu'au 22 août 2026, alors que le formulaire de `/en/`
      renvoyait déjà vers elle. Si vous modifiez une section, modifiez les trois, dates de
      mise à jour comprises.
      Meta **exige** une URL de politique de confidentialité
      pour valider un compte publicitaire et diffuser des publicités à formulaire — or Facebook
      sera le premier canal d'acquisition à Nosy Be.
- [ ] ⚠️ **Deux mentions MANQUENT dans les trois sections de la page de confidentialité**, et
      il faut le porteur pour les écrire — elles ne se déduisent pas du code. Ce paragraphe
      affirmait jusqu'au 22 août 2026 qu'elles y figuraient : c'était faux, la page ne les a
      jamais contenues (vérifié : aucune occurrence de « Rentanoo », « responsable » ni d'une
      durée en mois dans le fichier).
      - **l'identité juridique exacte du responsable de traitement.** S'il existe une société
        immatriculée, mettre sa raison sociale ; sinon, nommer explicitement la personne ou
        l'équipe responsable. Une notice sans responsable identifiable ne vaut rien.
      - **les durées de conservation des deux formulaires de pré-lancement.** La page annonce
        une durée pour les données de l'application (« tant que vous utilisez le service »),
        mais rien pour la liste d'attente ni pour les demandes de partenariat. Une durée de
        l'ordre de 12 mois après l'ouverture pour la liste d'attente et de 24 mois pour les
        prospects restaurateurs serait raisonnable et tenable — **à trancher par le porteur**,
        puis à écrire dans les **trois** sections.

      Tout le reste de la page est factuel et vérifié dans le code : champs collectés, tables
      `waitlist_signups` / `restaurant_leads`, hébergement Supabase en **`eu-north-1`
      (Stockholm, Suède)** — et non `eu-west-1`, comme l'indiquait ce paragraphe par erreur —,
      chargement de Calendly seulement au clic, absence de cookie de mesure,
      `Permissions-Policy` qui coupe la géolocalisation.

### Réseaux sociaux

- [ ] **Seul YouTube figure sur le site.** Les icônes Facebook, Instagram et TikTok ont été
      retirées : elles pointaient sur `href="#"`, ce qui renvoie l'utilisateur en haut de page
      — perçu comme un bug, et coûteux en confiance sur une page dont le seul but est de faire
      remplir un formulaire.

      Dès que les comptes existent, rajouter dans le hero **et** dans le pied de page (le bloc
      YouTube sert de gabarit — copier-coller et changer l'URL, l'`aria-label` et le `<path>`) :

      ```html
      <a href="URL_REELLE" target="_blank" rel="noopener me" aria-label="Facebook" class="soc"
         style="…mêmes styles que le lien YouTube voisin…"> … </a>
      ```

      Et ajouter les URL dans le tableau `"sameAs"` du JSON-LD des **deux pages
      françaises**, puis `python3 tools/build-i18n.py` pour propager aux quatre autres.

### Contenu et suivi

- [ ] **Fiche Google Business Profile** en « zone de service » (sans adresse publique, zone =
      Nosy Be), catégorie « Service de livraison de repas ». Sur un marché de cette taille, la
      fiche Maps captera plus de contacts que tout le référencement naturel du site. **À créer
      le jour du lancement, pas avant** : une fiche pour un service qui n'ouvre pas encore
      génère des avis négatifs.
- [ ] Mettre à jour `"dateModified"` dans le JSON-LD (constante `MODIFIED` de
      `tools/build-i18n.py` pour les pages traduites) et les **sept** `<lastmod>` du
      `sitemap.xml` à chaque modification réelle du contenu.
- [x] Le nœud `MobileApplication` du JSON-LD porte maintenant
      `"offers": {"@type":"Offer","price":"0","priceCurrency":"EUR","availability":"…/PreOrder"}`.
      Il lui manque encore `aggregateRating` pour être éligible au résultat enrichi complet —
      **ne pas en inventer un** : le service n'est pas ouvert, aucune note n'existe, et un avis
      fabriqué est une violation des règles de spam de Google qui expose à une action manuelle.
      Sans note réelle, l'app n'aura pas d'étoiles : c'est le comportement correct.
- [ ] Dès que les fiches App Store / Play Store sont en ligne, ajouter `installUrl` et
      `downloadUrl` au nœud `MobileApplication` des deux pages françaises, puis regénérer.
- [ ] Le lien Calendly est codé en dur dans `restaurants-partenaires/index.html` (constante
      `CALENDLY_URL` et attribut `data-url`) : **deux endroits à changer** s'il évolue.
- [ ] Le numéro `+261 37 34 37 912` apparaît **trois fois** sur la page restaurateur (texte
      affiché, `href="tel:"`, lien `wa.me`) et dans le JSON-LD des deux pages françaises.
      À changer partout en même temps, puis `python3 tools/build-i18n.py` — sinon les quatre
      pages traduites gardent l'ancien numéro.

### Accessibilité — contrastes : corrigés le 21 août 2026

Les combinaisons sous le seuil WCAG AA ont été **remontées**, en gardant la teinte d'origine au
plus près : chaque couleur a été assombrie du minimum nécessaire pour passer 4,5:1. Le rouge de
marque `#E8342A` **reste inchangé** partout où il sert de trait, d'icône, de contour de focus ou
de grand texte (≥ 18,66 px gras) — seuls les **fonds qui portent du texte blanc** ont bougé.

| Usage | Avant | Après | Ratio |
|---|---|---|---|
| Fonds rouges portant du texte blanc (CTA, onglet actif, badge, pastille 1, bouton d'envoi) | `#E8342A` 4,24 | `#DF3228` | **4,54** |
| Pastille 4 de la frise + bouton WhatsApp (blanc sur vert) | `#16A34A` 3,30 | `#12873D` | **4,61** |
| Pastille 5 de la frise (blanc sur cyan) | `#0EA5B7` 2,96 | `#0B8291` | **4,55** |
| Onglet actif « Je suis restaurateur » (blanc sur orange, 2,84) | texte `#fff` | texte `#1A1A1A` | **7,38** |
| Placeholders des champs et « — facultatif » | `#B4AFA9` 2,18 | `#797571` | **4,57** |
| Libellés 11 px, « NOSY BE », « SUIVEZ-NOUS », onglet inactif, copyright | `#8A8580` 2,92–3,28 | `#6B6662` | **4,53–5,67** |
| Sur-titres orange, badge « EN COURS DE NÉGOCIATION » | `#B4620A` 4,01 | `#A75B09` | **4,54** |
| Badge « DÉJÀ DANS L'AVENTURE » | `#15803D` 4,49 | `#157F3C` | **4,55** |
| Sur-titres rouges 11 px, numéro de téléphone, liens par défaut | `#E8342A` 3,71–4,24 | `#C42419` | **5,08–5,81** |

L'onglet actif orange a été traité **sans toucher à l'orange** : le texte passe à l'encre du
design (`#1A1A1A`), exactement le couple déjà utilisé par le badge « 2 · Menu ». Aucune couleur
nouvelle n'a été inventée pour ce cas.

À noter pour l'avenir : **`#FFC72C` sur le crème `#F5F2EF` donne 1,40** — combinaison à
proscrire. Elle n'existe pas dans le design (le jaune n'apparaît que sur `#1A1A1A`, où il est
excellent).

### Accessibilité — focus clavier : corrigé le 21 août 2026

Deux anneaux de focus étaient posés mais invisibles. Corrigés par deux règles CSS, sans toucher
au HTML :

- `#video-play:focus-visible{outline-offset:-4px}` — le bouton de lecture remplit exactement
  `#video-frame`, qui porte `overflow:hidden` : un anneau dessiné 2 px à l'extérieur tombait
  intégralement dans la zone rognée. Il est maintenant dessiné à l'intérieur.
- `[data-row]:focus-visible{opacity:1!important;outline-color:#fff}` — les étapes non atteintes
  de la frise portent `opacity:.4` en style en ligne, et l'opacité s'applique à l'élément
  composité, anneau compris : le focus retombait à 1,66:1. Au focus clavier l'étape redevient
  opaque et l'anneau passe en blanc (18:1 sur le fond sombre du simulateur).
  ⚠️ Le `!important` est indispensable : `buildTimeline` réécrit `style.cssText` du bouton à
  chaque rendu, opacité comprise.

### Accessibilité — ce qui n'a délibérément pas été corrigé

- [ ] **Taille des cibles tactiles de la frise.** Les six boutons d'étape mesurent 43 × 30 px
      (le dernier 30 × 30). C'est **conforme** au minimum de WCAG 2.2 SC 2.5.8 (24 × 24), mais
      loin des 44 px recommandés au pouce. Les agrandir demanderait de passer les pastilles de
      30 à 36 px dans le HTML **et** dans `buildTimeline` — un changement de dessin, à trancher
      avec le graphiste. Le lien « Confidentialité » du pied de page, lui, était réellement
      sous le seuil (77 × 18) : corrigé par `min-height:24px;padding:4px 2px`.

- [ ] **Carrousel du menu (page restaurateur).** Il défile en boucle sans bouton pause, ce qui
      reste un échec WCAG 2.2.2. Les visiteurs qui ont activé « réduire les animations » dans
      leur système ne le voient plus bouger (`prefers-reduced-motion` est géré), mais les autres
      n'ont aucun moyen de l'arrêter. Ajouter un bouton pause aurait introduit un élément que le
      design ne prévoit pas — à trancher avec le graphiste.

---

## 8. Écarts assumés par rapport à la maquette

Tout le reste du design — textes, dimensions, styles en ligne — est repris **au caractère près**.
Vérifié automatiquement : sur 106 fragments de texte de la maquette, aucun n'a été perdu ni
reformulé, hors les deux points ci-dessous. Les couleurs sont celles de la maquette, à l'exception
des remontées de contraste listées en section 7.

**1. Le `<h1>` de la page client a été préfixé** (recommandation SEO explicite) :

> avant — « Les meilleurs restos d'Ambatoloaka, **sans le bruit.** »
> après — « **Livraison de repas à Nosy Be :** les meilleurs restos d'Ambatoloaka, **sans le bruit.** »

Le titre ne contenait aucun mot-clé géographique. Pour revenir au texte d'origine : une seule
ligne à éditer dans `index.html` (chercher `id="h-hero"`).

**2. Le badge « Bientôt à Nosy Be » est devenu « Bientôt à Nosy Be, Madagascar ».** Le mot
« Madagascar » n'apparaissait nulle part sur le site — c'est pourtant le pays.

**3. Deux phrases de la page restaurateur ont été enrichies** (22 août 2026). Cette page ne
contenait **aucune** occurrence de « Madagascar » ni de « Hell-Ville », alors que ce sont les
deux repères géographiques que cherche un restaurateur de l'île :

> chapô — « …arrive à Nosy Be**, à Madagascar**. »
> section partenaire — « **Que votre restaurant soit à Ambatoloaka, à Hell-Ville ou ailleurs
> sur l'île,** on passe vous voir… »

Rien d'autre n'a bougé dans l'argumentaire, et aucun mot-clé n'a été ajouté ailleurs.

**Pas de redirection automatique selon la langue du navigateur.** Elle a été envisagée puis
écartée : Googlebot explore depuis les États-Unis avec un `Accept-Language` anglais et exécute
le JavaScript. Une redirection l'enverrait de `/` vers `/en/` — soit exactement la page que
`x-default` et le `canonical` désignent comme *ne devant pas* être servie par défaut. Sur un
site neuf, le risque de désindexer la page française pour un confort marginal n'en vaut pas la
peine ; Google recommande d'ailleurs explicitement un sélecteur visible plutôt qu'une
redirection. Le sélecteur FR / EN / IT de l'en-tête joue ce rôle.

**Ajouts** (aucune suppression) : une phrase de zone desservie sous les personas (elle apporte
« livre », « Hell-Ville », « à domicile », « commander à manger » — tous absents), une phrase sur
l'absence d'Uber Eats et de Glovo, un paragraphe en anglais et une phrase en italien dans la
section inscription (clientèle charter italienne structurelle sur l'île), et le lien
« Confidentialité » au pied de page.

**Corrections techniques invisibles à l'œil :**

- Le message « Erreur d'envoi, réessayez. » du formulaire restaurateur était **affiché en
  permanence** dans la maquette, dès le premier affichage, sans qu'aucun envoi ait eu lieu
  (le test portait sur la chaîne `'none'`, qui est vraie en JavaScript). Corrigé.
- Un `setInterval` tournait toutes les 4,5 secondes pour animer un carrousel supprimé depuis :
  code mort, retiré.
- Les deux formulaires ne se vidaient pas après envoi ; « Inscrire quelqu'un d'autre » ré-affichait
  l'inscription précédente. Ils appellent maintenant `form.reset()`.
- Le script Calendly (~100 Ko de tiers) était chargé sur **toutes** les pages, y compris côté
  client où le widget n'existe pas. Il n'est plus injecté qu'au clic sur « Prendre rendez-vous ».
- Les 13 `<div onClick>` sont devenus des `<button>` : la moitié du site était inatteignable au
  clavier et au lecteur d'écran, dont le formulaire de contact restaurateur.
- Les 7 champs de formulaire n'avaient aucune étiquette liée : `for`/`id` posés partout, plus les
  attributs `autocomplete` (gain de conversion direct sur mobile).
- Un état de focus clavier visible a été ajouté (contour rouge `#E8342A`, 3 px) : il n'y en avait
  aucun.
- `<html lang="fr">`, repères sémantiques `<header>` / `<nav>` / `<main>` / `<section>` /
  `<footer>`, et `aria-hidden` sur toutes les icônes décoratives.
- Trois correctifs responsive, tous en `@media` et sans effet sur le design au-delà :
  le widget Calendly était **coupé net de 47 à 51 px** sous 412 px de large ; les libellés des
  onglets passaient sur deux lignes sous 420 px ; plusieurs colonnes en `min-width:NNNpx`
  mangeaient la gouttière à 320 px (passées en `min(NNNpx, 100%)`).

### Un écart de structure à trancher — page restaurateur

⚠️ **Ce point n'est pas une régression, c'est un choix explicite. Ne pas le « corriger » sans
avoir demandé au porteur.**

Dans la maquette (`Landing Pre-lancement.dc.html`), le bloc « LE CYCLE D'UNE COMMANDE » **et**
toute la section `#partenaire` (carte blanche + onglets de contact + formulaire de rappel) sont
des enfants du grand bloc sombre `#1A1A1A` : le `<div>` ouvert ligne 369 ne se referme qu'à la
ligne 510. Dans la page livrée, la section sombre se referme juste après les trois cartes
« On s'occupe de la mise en place », et ces deux blocs reposent sur le crème `#F5F2EF`.

Ce qui fait douter que la maquette exprime une intention : dans la maquette, le bloc « cycle » est
aussi **hors** du conteneur `max-width:1120px`, donc à fond perdu et sans gouttière latérale,
alors que son équivalent de la page client est bien dans le conteneur. Cette asymétrie ressemble
à un `</div>` oublié plutôt qu'à un parti pris.

- Si la version maquette est voulue : remonter la fermeture de la section sombre après
  `#partenaire`, ou envelopper les deux blocs dans un conteneur `background:#1A1A1A`.
- Si le fond crème est voulu : ne rien faire, ce paragraphe sert de trace.

### Réseaux sociaux — pour mémoire

Le retrait des icônes Facebook, Instagram et TikTok est documenté en section 7. Elles pointaient
sur `href="#"` dans la maquette : ce sont des emplacements sans URL, pas des liens perdus.
