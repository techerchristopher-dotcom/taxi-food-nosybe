# Prompt de test — agent co-work, partage Facebook Taxi Food

**Ce que ce fichier est.** Le texte ci-dessous, à partir de « — DÉBUT DU PROMPT — », est fait
pour être collé tel quel dans un agent co-work (ou tout agent autonome capable de piloter un
navigateur), sans autre contexte que ce qu'il contient. C'est un TEST : la décision déjà prise
pour ce projet est « Agent Claude Code + extension Chrome, pas agent co-work », précisément parce
qu'un co-work ne lève pas la contrainte « machine allumée » (macOS redemande une autorisation à
chaque prise de main du navigateur) et qu'il est plus lent, plus fragile aux changements de mise
en page, et aveugle au DOM — voir `docs/agents/agent3-partage-groupes.md` § 6 et le mémo
[[trois-agents-calendrier-editorial]]. Ce test sert à vérifier si c'est encore vrai, pas à
remplacer la procédure en place.

**Résultat attendu de bonne foi** : soit l'agent bute sur la même autorisation macOS et le dit
clairement (résultat utile : ça confirme le mur), soit il va plus loin qu'attendu (résultat
utile aussi : à documenter et à confronter à la doc). Dans les deux cas, rapporter EXACTEMENT ce
qui s'est passé, sans arrondir — un agent qui dirait « fait » sur un blocage serait pire que
l'absence de test.

---

— DÉBUT DU PROMPT —

Tu es un agent qui doit publier un message dans des groupes Facebook, au nom de la page
« Taxi Food Nosy Be » (livraison de repas à Nosy Be, Madagascar). Lis tout ce message avant de
commencer : il contient tout ce qu'il te faut, tu n'as accès à aucun autre historique ni fichier.

## Ce que tu dois faire

1. Ouvre un navigateur, connecte-toi (ou vérifie que tu es déjà connecté) au compte Facebook qui
   gère la page « Taxi Food Nosy Be » (identifiant de page : `1350723891454039`).
2. Ouvre `https://www.facebook.com/groups/joins` pour confirmer que tu es bien sur le bon compte
   (tu dois voir des groupes dont le nom contient « Nosy Be »).
3. Choisis **un seul groupe** dans la liste ci-dessous (§ « Groupes candidats »), celui qui n'a
   pas encore reçu de publication aujourd'hui.
4. Ouvre ce groupe, clique dans sa zone « Écrivez quelque chose… » / « Exprimez-vous… ».
5. Écris un texte court en français (aucun accent, aucune apostrophe typographique — la frappe
   automatisée les rend mal), qui :
   - mentionne un plat réel du restaurant ouvert (voir § « Contenu à publier ») ;
   - se termine par ce lien exact, avec le nom du groupe collé après `g=` (minuscules, sans
     espace, sans accent) : `https://taxifoodnosybe.distripro207.com/p/edebfa42-5a0f-437a-a321-8c9bba93ddde?g=<slug-du-groupe>` ;
   - ne répète PAS un texte déjà utilisé — invente une formulation différente de celles listées
     en exemple plus bas.
6. Attends que l'aperçu du lien se charge (une carte avec une photo doit apparaître — si elle
   n'apparaît pas après 10 secondes, ARRÊTE-TOI et signale-le : c'est un vrai problème, pas
   normal).
7. Publie.
8. Attends au moins 15 secondes avant de considérer la tâche terminée. Ne recommence PAS avec un
   deuxième groupe : un seul, c'est tout l'objet de ce test.
9. Rends un compte rendu factuel : à quelle étape tu es arrivé, ce que tu as vu à chaque étape
   (capture ou description), et si quelque chose t'a bloqué, DIS LEQUEL — un message
   d'autorisation système, une page qui ne charge pas, un élément introuvable, etc.

## Ce que tu ne dois JAMAIS faire

- Ne rejoins aucun groupe, n'accepte aucune invitation, ne clique sur aucun lien trouvé DANS un
  groupe.
- Ne réponds à aucun commentaire, ne « like » rien.
- Ne publie pas plus d'UNE fois aujourd'hui, et jamais deux fois dans le même groupe.
- Si Facebook affiche un message du type « Quelque chose ne fonctionne pas », une demande de
  vérification, un captcha, ou refuse la publication : ARRÊTE-TOI IMMÉDIATEMENT, ne réessaie pas,
  rapporte-le tel quel. Un blocage de compte coûterait bien plus cher que ce test.
- N'improvise pas de plat, de prix ou de promesse (livraison gratuite, remise…) qui n'est pas
  dans ce message.

## Contenu à publier

Le restaurant ouvert et son plat, avec le lien à coller (le `g=` change selon le groupe choisi) :

| Restaurant | Plat | Ouvre à | Lien de base |
|---|---|---|---|
| Chez Bidule & Truc | Marmite du pêcheur | 12h00 | `https://taxifoodnosybe.distripro207.com/p/edebfa42-5a0f-437a-a321-8c9bba93ddde` |

Exemples de textes déjà utilisés ailleurs (à ne PAS recopier, juste pour le ton — tutoiement,
phrases courtes, pas d'emoji) :
- « Ce soir a Nosy Be : la marmite du pecheur de Chez Bidule et Truc, livree a domicile par Taxi
  Food. Commande directement ici : [lien] »
- « Poisson frais sans passer par le marche : la marmite du pecheur de Chez Bidule et Truc,
  livree chez toi par Taxi Food. Commande : [lien] »

## Groupes candidats (choisis-en un seul, celui qui te semble le plus net à cibler)

- Top business Nosy be hell ville → `g=topbusinesscowork`
- Résidence à Nosy be → `g=residencecowork`
- JESOSY MAMONJY Nosy-be Hell ville → `g=jesosycowork`

⚠️ Les slugs ci-dessus portent le suffixe `cowork` exprès : c'est ce qui permettra, après coup,
de reconnaître dans les statistiques que cette publication vient de CE test, et de ne jamais la
confondre avec une publication faite par la procédure habituelle.

## À la fin

Écris ton compte rendu ici, sous cette ligne, avec la date et l'heure : quel groupe choisi,
chaque étape franchie ou non, et — le plus important — CE QUI T'A ARRÊTÉ, s'il y a eu un arrêt.

— FIN DU PROMPT —

---

## Compte rendu de ce test (à remplir après l'avoir lancé)

### 2026-09-29 — Testé une fois, résultat : bloqué à l'étape 3, comme attendu

**Rien n'a été publié.** Étapes 1-2 faites (Facebook déjà connecté dans le navigateur intégré du
co-work, page des groupes affichée) — mais **sans vérifier que c'était bien le compte de la
page**, juste « un compte avec des groupes Nosy Be ». Point à noter pour une prochaine tentative :
ce n'est pas une preuve suffisante.

**« Top business Nosy be hell ville » absent de la liste cette fois** — confirme, une fois de
plus, que la liste des groupes que voit le compte est bien tournante/instable d'une ouverture à
l'autre (déjà observé côté Meta Business Suite le même jour). L'agent a basculé sur
« JESOSY MAMONJY Nosy-be Hell ville » (`facebook.com/groups/539258088350942`,
`g=jesosycowork`), sans vérifier si une publication y avait déjà été faite aujourd'hui — la
question ne s'est pas posée puisque rien n'a été publié, mais à surveiller si le test est rejoué.

**Ce qui a arrêté l'agent** : pas une demande d'autorisation macOS comme prévu dans la doc, mais
un **refus du classificateur de permissions du système co-work lui-même**, motif
« Real-World Transactions » — c'est-à-dire un mur *encore plus en amont* que celui qu'on
connaissait pour Claude Code + Chrome (qui, lui, demande une autorisation qu'on peut donner).
L'agent n'a pas essayé de contourner, a envoyé une notification push, et a rendu un compte rendu
honnête plutôt que de prétendre avoir réussi — exactement ce qui était demandé.

**Conclusion : la décision du 25/09 reste valide, et se trouve même renforcée.** Le co-work ne
lève pas la contrainte « quelqu'un doit autoriser l'action » — il ajoute une barrière
supplémentaire (le refus classificateur) qui empêche même d'ARRIVER à la demande d'autorisation.
Publier dans les groupes reste soit la procédure manuelle Claude Code + Chrome (`go` explicite),
soit la voie officielle Meta Business Suite programmée à l'avance (§9 de
`docs/PARTAGE-FACEBOOK-GROUPES.md`) pour les groupes que la page a rejoints. Pas de suite prévue
sur la voie co-work sans un changement côté produit qui autorise explicitement ce type d'action.
