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

⚠️ **Les 69 groupes du compte personnel ne sont PAS concernés** : ils n'apparaissent pas dans cette
fenêtre parce que c'est la PAGE qui partage. Y publier demanderait de passer par le profil
personnel — autre mécanique, et le risque porte alors sur le compte personnel.

## 4. La procédure, clic par clic

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

## 7. Ce qui manque encore, et qui vaut plus que le reste

**Marquer les liens par groupe** (`?g=boncoin`, `?g=tourisme`…) et lire le résultat dans Umami.
Aujourd'hui on publie à l'aveugle : on ne sait pas si un seul de ces groupes amène un client.
Une semaine de mesure dirait quels 5 groupes méritent la rotation — et les 15 autres deviendraient
inutiles, ce qui réglerait le problème de charge bien mieux que n'importe quelle automatisation.

## 8. Ce qui, lui, peut être VRAIMENT automatique

- **La publication quotidienne sur la page** (API Graph, comme Rentanoo) : autorisée, fiable.
- **L'image et le texte** : déjà fabriqués par `/jour` et `apercu.jpg`.
- **Le rappel** à 11 h pour lancer la session de partage.
- **L'annonce aux clients** (notification + e-mail), depuis l'onglet 📣 Annonce de l'admin.
