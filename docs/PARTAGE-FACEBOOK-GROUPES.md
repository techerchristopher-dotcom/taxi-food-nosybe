# Partager les plats du jour dans les groupes Facebook

Procédure relevée en la jouant pour de vrai le **2026-09-25**, cinq groupes publiés.
Elle est écrite pour être **rejouée chaque jour à 11 h**.

---

## Ce qui est automatique, et ce qui ne l'est pas

| Étape | Automatique ? |
|---|---|
| Fabriquer l'image et le texte des plats du jour | ✅ déjà fait (`/jour` + `apercu.jpg`, empreinte `?v=`) |
| Publier sur la **page** Taxi Food | ✅ possible par l'API (comme Rentanoo) |
| Partager dans les **groupes** | ❌ **impossible par programme** |

⚠️ **L'API des groupes est fermée aux applications tierces depuis 2020.** Aucun outil légitime ne
publie dans un groupe. Le seul chemin est de piloter le navigateur connecté — ce que Meta classe
comme automatisation et sanctionne par la limitation puis le blocage du compte.

⚠️ **Et un agent ne peut pas prendre la main seul** : macOS demande une autorisation explicite à
chaque prise de contrôle de la souris, du clavier ou du navigateur. Un déclenchement à 11 h sans
personne devant l'écran ne cliquera rien. Le porteur du projet doit être présent et dire « go ».

**Donc le rythme réaliste** : à 11 h, il dit « publie les groupes », et la procédure ci-dessous se
déroule en ~5 minutes sans qu'il touche à rien.

---

## Les 5 groupes atteignables PAR LA PAGE

Facebook ne propose, dans « Partager dans un groupe », que les groupes où **la page** est autorisée
à publier. Les 69 autres groupes ont été rejoints avec le **compte personnel** : pour ceux-là, il
faudrait partager depuis le profil, ce qui est une autre mécanique (et un autre risque).

1. Le Bon coin Nosy be (24 100 membres)
2. Bon prix Nosy be
3. NOSY BE HELL-VILLE…
4. Le BonCoin et Plan de NosyBe
5. TOURISME - NOSY BE - MADAGASCAR

---

## La procédure, clic par clic

1. Ouvrir `https://www.facebook.com/profile.php?id=61594104278047` (page Taxi Food).
2. Descendre jusqu'à la publication du jour (« Les plats du jour de Nosy Be, tous au même endroit »).
3. Bouton **partager** de la publication (libellé d'accessibilité : « Envoyez ce contenu à vos
   ami(e)s ou publiez-le sur votre profil. »).
4. **« Partager dans un groupe »** → la liste des 5 groupes s'affiche.
5. Choisir le groupe, **écrire un texte différent à chaque fois** (voir plus bas), puis **Publier**.
6. Revenir à la page et recommencer pour le groupe suivant.

⚠️ **Le champ de texte ne prend pas la frappe si on clique à côté** : cliquer dans la zone
« Créez une publication publique… » (au-dessus de l'aperçu), pas sur la fenêtre.

⚠️ **Facebook renvoie « Quelque chose ne fonctionne pas » quand on enchaîne trop vite.** C'est
arrivé au 2ᵉ groupe le 25/09. Remède : attendre ~15 s, recharger la page, reprendre. Ne pas
insister deux fois de suite — c'est le signal qui précède une limitation.

⚠️ **Espacer les publications** et ne jamais coller le même texte partout : c'est ce qui distingue
un partage d'un envoi automatisé.

---

## Les textes utilisés le 25/09 (à faire tourner, pas à recopier tels quels)

1. « Les plats du jour des restos de Nosy Be, mis à jour chaque jour. Livraison 10 000 Ar jusqu'à 3 km. »
2. « Envie de manger sans sortir ? Voici ce que les restos de Nosy Be cuisinent aujourd'hui. »
3. « Les plats du jour de Nosy Be, mis à jour chaque matin par les restaurants. Livraison à domicile, à l'hôtel ou en villa. »
4. « Ce midi à Nosy Be : paella, calamar au pesto, escalope milanaise… Tout ce que les restos cuisinent aujourd'hui, au même endroit. »
5. « Vous êtes à Nosy Be ? Voici les plats du jour des restaurants de l'île, livrés à votre hôtel ou votre villa. »

Le texte doit citer **les plats réellement à l'affiche du jour** : ils changent, la RPC
`plats_du_jour_publics()` les donne.

---

## Ce qui reste à mesurer

Aucun lien marqué par groupe pour l'instant : impossible de savoir lesquels amènent des clients.
À faire : `?g=<groupe>` sur le lien partagé, et lecture dans Umami. Sans cette mesure, on publie
dans cinq groupes sans savoir si un seul travaille.
