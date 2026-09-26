# Agent 3 — Porter la publication du jour dans les groupes Facebook

**Ce document est le mode d'emploi générique.** Il vaut pour Taxi Food aujourd'hui, pour Rentanoo
demain, pour n'importe quelle activité ensuite. Rien ici n'est propre à la livraison de repas :
seule la **fiche du § 1** change d'un business à l'autre.

Éprouvé en vrai le 26/09/2026 : **36 publications** en une session, sans blocage. Le détail de
cette session est dans le journal de [PARTAGE-FACEBOOK-GROUPES.md](../PARTAGE-FACEBOOK-GROUPES.md).

---

## 1. La fiche à remplir pour une nouvelle activité

```yaml
business:        taxi-food                 # identifiant court
page:            "Taxi Food Nosy Be"
page_id:         "1350723891454039"        # URL de la page → profile.php?id=…
business_id:     "1313131440466945"        # Meta Business Suite → composeur → URL
lien_a_partager: "https://taxifoodnosybe.distripro207.com/jour"
parametre:       "g"                       # ?g=<slug du groupe>, l'étiquette de mesure
garde_fou:       "la page /jour affiche au moins un plat"   # à quoi renoncer si c'est vide
langues:         [fr, mg, it, en]          # dans quoi on sait écrire une accroche
plafond_jour:    36                        # au-delà, on s'arrête
```

Puis la **liste de travail** : un tableau `Groupe | Membres | Slug | État`, tenu dans le document
de l'activité. Pour Taxi Food c'est le § 3 ter de `PARTAGE-FACEBOOK-GROUPES.md`.

⚠️ **Le slug ne s'invente qu'une fois.** Une fois publié, il ne change plus, sinon on perd le fil
des ouvertures de ce groupe.

---

## 2. Les deux identités, et pourquoi il en faut deux

C'est la découverte qui fait tout marcher, et elle n'était pas écrite avant le 26/09 :

| | Groupes rejoints par **le profil** de Christopher | Groupes rejoints par **la page** |
|---|---|---|
| Où publier | sur la page du groupe, composeur « Exprimez-vous… » | **Meta Business Suite** |
| Comment les trouver | `facebook.com/groups/joins` | composeur → « Voir d'autres groupes » |
| Combien on en voit | tous | **7 à la fois, liste tournante** |

Un groupe rejoint par la page mais pas par le profil est **invisible** depuis Facebook normal et
sort à peine dans la recherche : on ne l'atteint que par Meta Business Suite. Inversement, la
plupart des groupes du profil ne sont pas dans Business Suite. **Il faut faire les deux passes,
sinon on croit avoir tout couvert alors qu'il manque un tiers de l'audience.**

---

## 3. Passe A — les groupes du profil

Pour chaque groupe de la liste :

1. `navigate` vers `facebook.com/groups/<id>` puis **attendre 10 s**.
2. `find "Exprimez-vous"` → **cliquer par `ref`**, jamais par coordonnées.
3. Attendre 7 s, taper le texte, attendre 10 s que l'aperçu du lien se fabrique.
4. Capture d'écran **avant** de publier : on vérifie l'aperçu, et on relève la position du bouton
   « Publier » (elle bouge de 30 px quand Facebook glisse son bandeau « Gagnez du temps… »).
5. Cliquer « Publier », attendre 18 s avant le groupe suivant.

### Les pièges payés en vrai

- **Les coordonnées mentent.** Facebook re-rend la page entre la capture et le clic, et la fenêtre
  du navigateur change de taille en cours de session. Un clic en pixels a atterri sur l'onglet
  « Personnes », un autre dans le fil. **Toujours `find` puis clic par `ref`.**
- **Si deux `ref` portent le même nom**, c'est le second (celui du fil) qui ouvre la fenêtre.
- **Taper sans champ focalisé fait défiler la page** — au mieux. Au pire, la frappe part dans une
  zone de commentaire, ou ouvre la fenêtre des raccourcis clavier. D'où la capture de contrôle.
- **Les fenêtres Messenger s'ouvrent toutes seules** quand quelqu'un écrit, et volent le clic.
  Les fermer par `find "Fermer"` → clic par `ref`, pas en pixels.
- **Les groupes d'achat-vente** n'ont pas de composeur sur leur page d'accueil : le bouton propose
  « Vendre un article ». Passer par `facebook.com/groups/<id>/buy_sell_discussion`.
- **Ne jamais réécrire par-dessus un brouillon** : fermer la fenêtre conserve le texte, et le
  nouveau s'ajoute à l'ancien. Pour corriger : clic dans la zone, `cmd+a`, `Delete`, retaper.

## 4. Passe B — les groupes de la page, par Meta Business Suite

`business.facebook.com/latest/composer/?asset_id=<page_id>&business_id=<business_id>`

1. « Publier dans » → « Voir d'autres groupes ».
2. **Cocher UN SEUL groupe**, puis « Enregistrer ». Meta en autorise trois, mais trois groupes
   dans une même publication reçoivent le même lien, donc la même étiquette : la mesure est
   perdue. Un groupe = une publication.
3. Rouvrir « Publier dans » et **décocher la page**. Sans ça, la publication part AUSSI sur la
   page, en doublon du post du matin.
4. Écrire le texte + le lien marqué dans « Texte », puis « Publier ».
5. **Recharger le composeur** (ajouter `&r=1`, `&r=2`… à l'URL) : la liste des sept groupes change
   à chaque chargement. C'est la seule façon connue de découvrir les autres.

⚠️ **On ne peut pas certifier qu'aucun groupe n'a été oublié.** Aucun écran ne liste d'un coup tous
les groupes d'une page. Le compte rendu doit dire ce qui a été servi **et** ce qu'on a vu passer
sans le servir — jamais « tout est fait ».

---

## 5. Les textes

Un texte différent par groupe, **jamais deux fois le même** : Facebook repère la répétition, et un
membre présent dans cinq groupes aussi. Adapter la langue au groupe.

**En ASCII.** La frappe pilotée passe mal les accents et les apostrophes typographiques : écrire
« livres chez vous » plutôt que « livrés », « coup d'oeil » plutôt que « d'œil ». C'est moins beau,
c'est lisible, et ça évite une publication mutilée.

**Ne citer que ce qui est réellement disponible.** Le 26/09, un texte annonçait un boudin noir
retiré de l'affiche entre-temps : rattrapé avant publication, mais c'est exactement ce qui détruit
la confiance. Relire la page du jour avant d'écrire les accroches.

---

## 6. Sécurité — ce qui arrête la session

- **45 à 90 secondes entre deux publications.** C'est la seule protection réelle.
- Au premier **« Quelque chose ne fonctionne pas »**, demande de vérification, ou publication
  refusée : **arrêt immédiat**, on note où on en était. Un blocage de compte coûte infiniment plus
  que quelques groupes manqués.
- Un groupe qui met la publication **en attente d'un administrateur** n'est pas un échec : on note
  et on continue. Mais un groupe qui modère et ne publie jamais coûte du temps pour rien — le
  journal sert à les repérer et à les sortir.
- **Interdits** : répondre à un commentaire, rejoindre un groupe, accepter une invitation, cliquer
  un lien trouvé dans un groupe, publier dans un groupe hors liste, publier deux fois le même jour
  dans le même groupe, publier dans un groupe hors sujet (un groupe d'emploi supprime l'annonce et
  peut faire exclure le compte).

---

## 7. Le compte rendu, puis le journal

Dans le journal de l'activité : une entrée datée, la liste des groupes servis avec leur slug et
leur résultat (publié / en attente d'un administrateur / refusé), les groupes **vus mais non
servis**, et ce qu'on a appris. Puis commit et push depuis le dépôt de l'activité — jamais depuis
un répertoire parent.

Au porteur du projet, en clair : combien de publications, lesquelles attendent une modération,
ce qui reste à faire demain. **S'il manque des groupes, le dire — ne pas arrondir.**
