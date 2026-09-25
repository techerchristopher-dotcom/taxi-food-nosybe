# Le calendrier éditorial et ses trois agents — modèle réutilisable pour tous les business

Ce document est **le modèle**, pas la doc d'un seul projet. Il décrit une chaîne qui doit
fonctionner à l'identique pour Rentanoo, Taxi Food, et les activités suivantes. Quand un nouveau
business arrive, on ne réécrit rien : on remplit **une fiche de configuration** (§ 6).

Document frère, à lire avec celui-ci : [PARTAGE-FACEBOOK-GROUPES.md](PARTAGE-FACEBOOK-GROUPES.md)
— c'est le mode d'emploi détaillé du seul maillon qui reste manuel.

---

## 1. La seule chose que Christopher doit faire

**Remplir et valider le calendrier éditorial de chaque business, une fois par semaine.**

Rien d'autre. Pas de publication, pas de partage, pas de copier-coller dans les groupes. Si une
semaine il ne valide rien, la chaîne ne publie rien — c'est volontaire, un calendrier vide vaut
mieux qu'un post automatique hors sujet.

---

## 2. La chaîne, en trois agents

| | Agent | Quand | A besoin d'un navigateur ? | Coût humain |
|---|---|---|---|---|
| **1** | **Planner** — rédige les brouillons de la semaine | samedi | non | 0 |
| — | **Christopher valide** sur `/admin/calendar` | samedi/dimanche | — | **15 min/semaine/business** |
| **2** | **Publisher** — publie le post validé sur la Page | chaque matin | non | 0 |
| **3** | **Partageur** — porte le post dans les groupes | chaque jour | **oui** | 0 (mais machine allumée) |

Les agents 1 et 2 existent déjà et tournent pour **Rentanoo** :
`docs/agents/agent1-planner.md` et `docs/agents/agent2-publisher.md` dans le dépôt Rentanoo,
table `editorial_calendar`, écran `/admin/calendar`, endpoint `GET /api/social/publish-editorial`.
**C'est le patron à copier**, pas à réinventer.

L'agent 3 n'existe nulle part encore. C'est lui, l'objet de la décision ci-dessous.

---

## 3. La frontière technique qui décide de tout

> **Publier sur une Page** se fait par l'API Graph : fiable, sans navigateur, sans machine allumée.
> **Publier dans un groupe** ne se fait **par aucune API** : Meta a fermé l'API Groups aux
> applications tierces **en 2020**. Il n'existe pas de contournement légal.

Tout découle de là :

- Les agents 1 et 2 sont du **code serveur**. Ils scalent à l'infini, un business de plus ne coûte
  rien, ils tournent même ordinateur éteint.
- L'agent 3 est forcément **un navigateur piloté, avec la session Facebook de Christopher**. Il
  exige que la machine soit allumée et Chrome connecté. C'est un plafond qu'aucune architecture ne
  fera sauter.

**La seule exception, à exploiter :** Meta Business Suite sait programmer une publication vers la
Page **et jusqu'à 3 groupes**, mais uniquement les groupes que **la Page elle-même a rejoints** —
7 pour Taxi Food aujourd'hui. Voir § 9 de
[PARTAGE-FACEBOOK-GROUPES.md](PARTAGE-FACEBOOK-GROUPES.md).

⚠️ **Périmètre, décidé le 25/09/2026 :** on ne travaille **que sur les groupes de la Page**. Le
compte personnel est membre de 428 groupes — hors sujet pour l'essentiel, et y publier ferait
porter le risque sur le compte personnel. Le périmètre Taxi Food tient en 30 lignes : c'est le
§ 3 ter du document frère, et c'est la seule liste que l'agent parcourt.

---

## 4. Décision : agent Claude Code, pas agent co-work

**Retenu : Claude Code + l'extension Chrome (`claude-in-chrome`), déclenché par une tâche
planifiée.**

Pourquoi pas un **agent co-work** (prise de contrôle de l'écran, clics en pixels) :

| | Claude Code + extension Chrome | Agent co-work (écran) |
|---|---|---|
| Machine allumée requise | oui | oui — **même plafond** |
| Lit la page | le DOM : noms de groupes, boutons, états | des pixels, par capture d'écran |
| Vitesse | ~3 à 5× plus rapide | lent, chaque clic = une capture |
| Résiste à un changement de design Facebook | oui (il cherche le bouton par son texte) | non (coordonnées) |
| Approbations à donner | une fois | à chaque application |
| Trace de ce qui a été fait | journal exploitable | captures d'écran |

Le co-work n'apporte **aucun avantage** ici : il ne lève pas la contrainte machine allumée, et il
est moins bon sur tout le reste. Il ne se justifierait que pour une application native — ce n'est
pas le cas, Facebook est un site web.

**Un seul agent 3 pour tous les business — pas un agent par Page.**

C'est contre-intuitif mais c'est la bonne réponse :

1. Tous les business partagent **la même session Facebook** (le profil personnel de Christopher).
   Deux agents qui publient en parallèle sous la même identité, c'est le scénario type du
   « comportement automatisé » que Facebook bloque. On a déjà vu un « Quelque chose ne fonctionne
   pas » après trois partages trop rapprochés.
2. Le nombre de publications par jour est **le** facteur de risque, tous business confondus. Il
   faut un seul endroit qui en tienne le compte.
3. Les groupes se recoupent : le même groupe Nosy Be peut recevoir Taxi Food ET Rentanoo. Deux
   agents aveugles l'un à l'autre y publieraient deux fois dans l'heure.

Donc : **une tâche planifiée, une session, qui parcourt les business l'un après l'autre**, avec un
plafond global de publications par jour et une pause entre chaque.

---

## 5. Le rythme

| Quand | Qui | Quoi |
|---|---|---|
| Samedi | Agent 1, par business | remplit les 7 brouillons de la semaine suivante |
| Samedi/dimanche | **Christopher** | valide sur `/admin/calendar` — le seul geste humain |
| Chaque matin ~8 h 30 | Agent 2, par business | publie le post validé du jour sur la Page + lien en 1er commentaire |
| Chaque jour, heure choisie | **Agent 3, une seule fois pour tous** | reprend le post du jour de chaque business et le porte dans 6 groupes par business, en rotation |

⚠️ **La tâche planifiée ne tourne que si l'application Claude est ouverte.** Si l'ordinateur était
éteint à l'heure dite, elle se déclenche au prochain lancement. À dire clairement : ce n'est pas un
serveur, c'est un rendez-vous quotidien avec sa propre machine.

---

## 6. La fiche de configuration d'un business

C'est la seule chose à produire quand une nouvelle activité arrive. Tant qu'elle n'est pas
complète, l'agent 3 saute ce business au lieu d'improviser.

```yaml
business: taxi-food                      # identifiant court, sert de préfixe partout
page_facebook: "Taxi Food Nosy Be"       # nom exact, tel qu'affiché
page_id: "1350723891454039"
business_id: "1313131440466945"          # Meta Business Suite
supabase_projet: "<ref>"                 # où vit editorial_calendar
url_admin_calendrier: "https://…/admin/calendar"
lien_a_partager: "https://taxifoodnosybe.distripro207.com/jour"
parametre_mesure: "g"                    # ?g=<slug du groupe> — voir PARTAGE-FACEBOOK-GROUPES § 3 bis
langues: [fr, mg, en, it]                # dans quelles langues on sait écrire une accroche
groupes_rejoints_par_la_page: 7          # utilisables par Meta Business Suite, § 9
liste_de_travail: "docs/PARTAGE-FACEBOOK-GROUPES.md § 3 ter"  # LA source de la rotation
plafond_publications_par_jour: 6
```

**La liste de travail est celle des groupes de la Page, et rien d'autre** — 30 lignes pour Taxi
Food (§ 3 ter du document frère) : nom, membres, slug `?g=`, état, plus les exclusions **avec leur
motif**. Elle se relit **une fois par semaine** dans la fenêtre « Partager dans un groupe », pour
attraper les groupes rejoints entre-temps.

⚠️ La règle « jamais de liste en dur » tient toujours — elle devient « jamais de liste en dur
**plus vieille que sept jours** ».

---

## 7. Ce que l'agent 3 fait, à chaque passage

1. Pour chaque business de la liste, dans l'ordre :
2. Lire le post **publié aujourd'hui** sur la Page (ou la ligne `published` du calendrier).
3. Lire la **liste de travail** du business (§ 6) — les groupes de la Page, et rien d'autre.
4. Retirer ceux déjà servis dans les N derniers jours (journal), retirer les groupes hors sujet
   (recherche d'emploi, petites annonces sans rapport) — la liste des exclusions est dans le
   journal, avec le motif.
5. Prendre les 6 suivants dans la rotation.
6. Pour chacun : **publier dans le groupe** un texte court + **le lien marqué** `?g=<slug>` —
   jamais un simple « partage » de la publication de la Page, qui ne se mesure pas. Varier le texte
   et la langue selon le groupe.
7. Attendre entre deux publications. Si Facebook affiche une erreur, **s'arrêter pour ce business**
   et le consigner — ne jamais réessayer en boucle.
8. Écrire le journal : groupe, étiquette, heure, résultat (publié / en attente de modération /
   refusé).
9. Rendre compte en une ligne par business.

**Interdits, à rappeler dans le prompt de la tâche :** ne jamais accepter une invitation, ne jamais
rejoindre un groupe de sa propre initiative, ne jamais répondre à un commentaire, ne jamais
publier dans un groupe dont le sujet n'a rien à voir, ne jamais publier deux business dans le même
groupe le même jour.

---

## 8. Comment on lit les résultats

Chaque lien porte son étiquette de groupe (`?g=…`), comptée par nos soins, pas par un outil tiers
— le détail est au § 7 de [PARTAGE-FACEBOOK-GROUPES.md](PARTAGE-FACEBOOK-GROUPES.md).

⚠️ **Zéro ouverture ne veut pas dire « mauvais groupe »** tant qu'on n'a pas vérifié que la
publication est bien parue : un groupe sur dix passe les publications en modération, et elles
n'ont alors jamais été vues. Le journal sert exactement à ça.

Au bout d'une semaine, trois décisions seulement : les groupes qui rapportent → on garde, ceux qui
modèrent sans jamais publier → on retire, ceux qui rapportent zéro alors que la publication est
parue → on essaie un autre texte, puis on retire.

---

## 9. Où en est chaque business

| | Agent 1 planner | Validation admin | Agent 2 publisher | Agent 3 partageur |
|---|---|---|---|---|
| **Rentanoo** | ✅ écrit (tâche désactivée) | ✅ `/admin/calendar` | ✅ écrit (tâche désactivée) | ❌ |
| **Taxi Food** | ❌ | ❌ pas de calendrier | ❌ (page `/jour` et image prêtes) | ⚠️ fait à la main le 25/09/2026 |

Autrement dit, ce qui manque aujourd'hui pour tenir la promesse du § 1 :

- [ ] **Taxi Food** : table `editorial_calendar` + écran de validation + publisher Page — copier le
      patron Rentanoo, pas le réinventer.
- [ ] **Agent 3** : une tâche planifiée unique, avec le prompt du § 7 et la fiche du § 6.
- [ ] **Taxi Food, gisement immédiat** : 4 groupes que la Page a rejoints n'ont jamais rien reçu
      (Nosy Bon Coins, MADAGASCAR TOURIST INFO, NosyBe Bonnes Affaires, TRAGNO AFONDRO) — et ils
      sont servables depuis Meta Business Suite, sans navigateur piloté. Puis les 7 groupes de la
      vague 1, à refaire avec leur lien marqué.
- [ ] **La même liste de travail pour Rentanoo** (§ 3 ter à écrire pour sa page).
- [ ] **Réactiver** les deux tâches Rentanoo, aujourd'hui désactivées.
- [ ] **Faire rejoindre par chaque Page** le plus de groupes possible : chaque groupe gagné passe
      de l'agent 3 (fragile, machine allumée) à Meta Business Suite (programmable, sans machine).
