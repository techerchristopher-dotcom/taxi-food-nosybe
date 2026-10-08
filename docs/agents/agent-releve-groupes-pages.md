# Agent — Relevé des groupes Facebook rejoints par chaque Page

**But** : tenir à jour la source de vérité des groupes suivis par chaque Page (projet Supabase
Taxi Food `bmdveawomizjpiebgtkj`, tables `groupes_facebook` et `groupes_pages`). Le bouton
« Synchroniser » de l'admin Rentanoo (`/admin/calendar`) recopie ensuite `groupes_pages` vers la
base Rentanoo. **Ce relevé alimente la source ; il ne publie rien.**

Relevé à la demande (choix de Christopher), pas de saisie manuelle. Premier relevé par cette
méthode : 08/10/2026 (voir § 6).

---

## 1. Les Pages

| identite (base) | Page | page_id (`asset_id`) |
|---|---|---|
| `taxi-food` | Taxi Food Nosy Be | `1350723891454039` |
| `rentanoo` | Rentanoo.com | `1040683242454617` |
| *(pas d'identité en base)* | AM résidence hôtel Nosy be | `1370700546118046` |

`business_id` : **`1313131440466945`** pour les trois (Business Suite redirige vers lui même si on
l'omet).

⚠️ Seulement les groupes de la **Page**. Les ~428 groupes du profil personnel de Christopher sont
hors sujet : on ne lit jamais `facebook.com/groups/joins`.

AM Résidence (et Villa Lune de Miel & Clair de Lune) partagent officiellement les groupes de la Page
Rentanoo. Mais AM Résidence **a sa propre Page** et peut rejoindre des groupes de son côté : la
relever aussi, pour information, et signaler ce qu'elle a en plus de Rentanoo.

## 2. Ce qu'on sait de l'écran

- **Aucun écran ne liste tous les groupes d'une Page.** Le composeur de Business Suite
  (`business.facebook.com/latest/composer/?asset_id=<page_id>&business_id=<business_id>`) →
  « Publier dans » → « Voir d'autres groupes » montre **7 groupes**, tirés côté serveur à chaque
  chargement de la page.
- Ces 7 groupes sont **embarqués dans le HTML** de la page, dans un `<script type="application/json">`
  du préchargeur `BusinessCometComposerRootQuery`, sous la clé `"suggested_groups":[…]` — avec
  l'**identifiant numérique**, le nom, la confidentialité et `group_member_profiles.count`
  (membres). Inutile d'ouvrir le menu : il suffit de lire le script.
- Un `fetch()` de la même URL **ne renvoie pas** ce bloc (le serveur ne le streame qu'à une vraie
  navigation). Un **`<iframe>` de même origine**, lui, le reçoit : c'est ce qui permet de boucler
  sans recharger l'onglet.
- **Le tirage n'est pas uniforme.** Certains groupes sortent 1 fois sur 15, d'autres 1 fois sur
  200 (« Expat : Madagascar », 178 000 membres, vu une seule fois en 30 chargements). D'où un
  grand nombre de chargements et un critère d'arrêt strict.
- Onglet en arrière-plan = minuteries (`setTimeout`) bridées par Chrome, jusqu'à ~1/min. La
  pause de la boucle peut donc s'allonger : c'est sans danger (plus lent, jamais plus rapide).

## ⛔ 2 bis. Le plafond de Facebook — payé le 08/10/2026

Au premier relevé, trois onglets bouclaient **sans pause** (≈ 700 chargements du composeur en
≈ 35 min, soit ~20/min). Facebook a répondu **« Cette fonction est temporairement bloquée — il
semble que vous ayez abusé de cette fonctionnalité en l'utilisant trop vite »**, sur le composeur
de Business Suite. Durée du blocage inconnue ; il peut gêner la publication quotidienne par
Business Suite (Passe B de l'agent 3) le jour même.

Règles qui en découlent :

- **Une seule Page à la fois**, jamais plusieurs onglets en parallèle.
- **Au moins 15 s entre deux chargements** (≤ 4/min) : paramètre `pauseMs` de la fonction.
- **Au plus 150 chargements par Page et par jour.**
- **Deux échecs d'affilée = arrêt immédiat** (la fonction s'arrête seule) ; ouvrir alors l'URL du
  composeur dans un onglet et regarder. Si le message de blocage s'affiche : ne plus rien
  charger ce jour-là, le dire à Christopher.

## 3. Procédure

Navigateur : **Chrome (claude-in-chrome)**, session Facebook de Christopher. Vérifier d'abord que
`mcp__claude-in-chrome` figure dans `permissions.allow` de `addition appli/.claude/settings.local.json`.
Ne jamais se déconnecter, ne saisir aucun mot de passe, ne cocher aucun groupe, ne rien publier.

1. Un onglet par Page : `navigate` vers
   `https://business.facebook.com/latest/composer/?asset_id=<page_id>&business_id=1313131440466945`,
   attendre 8 s.
2. Dans cet onglet, `javascript_tool` : coller la fonction du § 4 puis lancer
   `window.__releve2('<page_id>','1313131440466945',150,80,15000)` **sans `await`** (elle tourne
   seule). Arguments : nombre max de chargements, critère d'arrêt, pause en ms.
3. Suivre l'avancement : `window.__st2.msg` → `loads N total T zeroStreak Z fail F`.
   **Une Page à la fois** (§ 2 bis). Le cumul est gardé dans `sessionStorage` de l'onglet : on
   peut relancer sur plusieurs jours dans le même onglet, ou noter le cumul et repartir.
4. **Critère d'arrêt** : 80 chargements d'affilée sans aucun groupe nouveau (`STOP-CRITERE`),
   ou le plafond de 150. `BLOCAGE?` dans le message = deux échecs d'affilée : regarder l'écran
   (§ 2 bis) avant toute chose.
5. Récupérer le cumul (`sessionStorage['releve_<page_id>']`, objet `g` : id → `{n, m, seen,
   first}`) et le passer à la base (§ 5).
6. Fermer les onglets ouverts.

## 4. La fonction de relevé

```js
window.__releve2 = async (asset,biz,n,stopAfter,pauseMs)=>{ const key='releve_'+asset; const st=window.__st2={asset,running:true,msg:''};
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 let failsDeSuite=0;
 for(let r=0;r<n && st.running;r++){
  if(r>0) await pause(pauseMs||15000);
  const f=document.createElement('iframe'); f.style.cssText='position:fixed;left:-5000px;width:1200px;height:800px'; document.body.appendChild(f);
  const arr = await new Promise(ok=>{ f.onload=()=>{ try{
     const s=[...f.contentDocument.querySelectorAll('script')].map(x=>x.textContent).find(x=>x.includes('suggested_groups'));
     if(!s) return ok(null);
     const k='"suggested_groups":['; const i=s.indexOf(k)+k.length-1; let d=0,j=i;
     for(;j<s.length;j++){if(s[j]=='[')d++; else if(s[j]==']'){d--; if(d==0)break;}}
     ok(JSON.parse(s.slice(i,j+1))); }catch(e){ok(null)} };
   f.src='/latest/composer/?asset_id='+asset+'&business_id='+biz+'&r=j'+Date.now()+r; });
  f.remove();
  const acc=JSON.parse(sessionStorage.getItem(key)||'{"loads":0,"g":{},"hist":[]}');
  if(!arr){acc.fail=(acc.fail||0)+1; sessionStorage.setItem(key,JSON.stringify(acc)); if(++failsDeSuite>=2){st.msg+=' BLOCAGE?';break;} continue;}
  failsDeSuite=0; acc.loads++; let nouv=0;
  for(const g of arr){ if(!acc.g[g.id]){acc.g[g.id]={n:g.name,m:g.group_member_profiles?.count,p:g.privacy_info?.title?.text,first:acc.loads}; nouv++;} acc.g[g.id].seen=(acc.g[g.id].seen||0)+1;}
  acc.hist.push(nouv); sessionStorage.setItem(key,JSON.stringify(acc));
  let z=0; for(let q=acc.hist.length-1;q>=0&&acc.hist[q]==0;q--)z++;
  st.msg='loads '+acc.loads+' total '+Object.keys(acc.g).length+' zeroStreak '+z+' fail '+(acc.fail||0);
  if(z>=stopAfter){st.msg+=' STOP-CRITERE'; break;} }
 st.running=false; return st.msg; };
```

⚠️ Le 08/10 la boucle tournait sans pause et, dans un onglet, continuait sur échec : ≈ 140
requêtes sont parties en rafale après le blocage. La version ci-dessus corrige les deux.

Pour exporter le cumul (l'outil tronque vers 1 000 caractères : sortir par tranches de 12) :

```js
const a=JSON.parse(sessionStorage.getItem('releve_<page_id>'));
window.__rows=Object.entries(a.g).map(([id,g])=>id+'|'+g.m+'|'+g.seen+'|'+g.n);
window.__rows.slice(0,12).join('\n')   // puis 12-24, 24-36…
```

## 5. Écriture en base — seulement ce qui a été VU

Pour chaque groupe vu (`facebook_id` = identifiant numérique) :

1. **Rapprocher** d'abord par `facebook_id`, sinon par nom normalisé : une partie des lignes
   portent un identifiant « vanity » (`sejourmadagascar`, `VoyagesMadagascar`…) au lieu du
   numérique. Dans ce cas on ne remplace pas `facebook_id` ; on ajoute l'identifiant numérique
   dans `notes`.
2. Absent de `groupes_facebook` → le créer : `nom`, `facebook_id`, `membres`,
   `membres_releve_le`, `etiquette` (slug unique `^[a-z0-9-]{1,24}$`, inventé une seule fois),
   `zone` et `themes` déduits du nom, `voie = 'business_suite'`,
   `notes = 'Relevé du <date> (Page <identite>)'`.
3. Pas de ligne `groupes_pages` pour cette Page → l'ajouter : `statut 'rejoint'`,
   `rejoint_le = <date du relevé>`.
4. Effectif vu → `membres` et `membres_releve_le` mis à jour.

⛔ **Ne jamais supprimer ni passer à un autre statut un groupe non vu.** La liste n'est jamais
garantie complète. Un groupe connu non vu reçoit seulement, dans `groupes_pages.notes`,
« non vu au relevé du <date> ».

Les données seules ne demandent pas de fichier de migration. Toute modification de **structure**
passe par `apply_migration` **et** un fichier dans `supabase/migrations/` (le MCP n'écrit rien
dans le dépôt).

## 6. Compte rendu

Par Page : nombre de chargements, nombre de groupes vus, nouveaux groupes (nom + membres),
groupes connus non vus. **Ne jamais écrire « aucun oubli »** : le tirage n'étant pas uniforme,
un groupe rarement servi peut échapper même à 300 chargements (le 08/10, « Voyageons à
Madagascar » n'est sorti qu'une fois en 249 chargements Rentanoo).

### Journal

#### 2026-10-08 — premier relevé, interrompu par un blocage Facebook

| Page | Chargements | Groupes vus | Nouveaux en base | Lignes `groupes_pages` ajoutées | Connus non vus |
|---|---|---|---|---|---|
| Taxi Food | 329 | 90 | 2 | 7 | **31** |
| Rentanoo | 249 | 76 | 7 | 14 | 0 |
| AM Résidence | 129 | 54 | 15 (sans ligne de Page) | — | — |

- Arrêt : Taxi Food encore en progression (dernier groupe nouveau au chargement ~329) ;
  Rentanoo 100 chargements d'affilée sans nouveauté ; AM Résidence 33.
- Blocage « fonction temporairement bloquée » après ≈ 700 chargements en ≈ 35 min → § 2 bis.
- **Taxi Food : 31 groupes en base non vus**, dont plusieurs vus sur les Pages Rentanoo ou AM
  Résidence (Le Bon Plan Nosy Be, Business Nosy-Be 207, TANY ALAFO…, Zanaka nosy be mila
  tragno, Bon prix Nosy be…). Soit ils sont rarement servis, soit le remplissage du 07/10 les a
  attribués à la mauvaise Page. Marqués « non vu au relevé du 08/10/2026 », rien d'autre.
- **Annonces Express Nosy-Be** : la Page voit l'id `1233556085590879` (2 213 membres), la base
  porte `1062928512775394` (137 membres). Note posée sur la ligne, pas de fusion.
- **AM Résidence a sa propre Page** et ses propres groupes (54 vus, surtout des groupes
  d'annonces de Nosy Be), dont le groupe de **303 725 membres** cherché par Christopher :
  « tolotr'asa, restauration, hôtellerie, tourisme à Madagascar » (`401168336985065`, vu une
  fois). Les 15 groupes propres à AM sont créés dans `groupes_facebook` avec une note ; aucune
  ligne `groupes_pages` faute d'identité `am-residence` — décision à prendre.
- Les identifiants « vanity » (`sejourmadagascar`, `hotelmadagascar`…) ont reçu leur id numérique
  en note ; les `facebook_id` vides ont été remplis quand le nom correspondait exactement.
