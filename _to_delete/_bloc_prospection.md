## 🏨 Prospection des hébergements — 799 fiches en base (2026-09-28)

Table **`prospects_hebergement`** (RLS admin seul). But : passer chez les hôtes de Nosy Be avec
des flyers portant **un code de réduction par adresse**, pour que leurs voyageurs commandent.
Livrables : `PROSPECTION-HEBERGEMENTS-NOSY-BE.xlsx` (3 feuilles) et
`PROSPECTION-HEBERGEMENTS-NOTES.md` à la racine. **La base est la référence, le classeur est une
photo du 28/09.**

### Ce qui est en base

| | Fiches |
|---|---|
| Total | **799** |
| À visiter | 671 (**441 adresses** après regroupement) |
| Hors zone (Nosy Komba 95, Sakatia 15, Ankify 1) | 111 |
| Exclues (Rentanoo 11, annonce morte 1) | 12 |
| Contactées (messages Airbnb du 28/09 au matin) | 5 |

Contacts : **265 téléphones · 76 pages Facebook · 28 mails · 175 sites · 588 positions GPS**.
**482 fiches joignables seulement par la messagerie Airbnb** · **22 sans aucun canal**.

Trois sources fusionnées, dédoublonnées sur `airbnb_room_id` puis sur le nom normalisé (accents
aplatis, suffixe « Nosy Be » retiré) : relevé **Google Places 23/02/2026** (175 fiches, avec
téléphone), relevé **Airbnb Madirokely/Ambatoloaka/Andilana 28/09** (172), relevé **Airbnb complet
de l'île 28/09** (430 sur 613 annonces, 183 étant déjà fichées), plus 22 fiches saisies à la main.

### Colonnes qui portent une décision

- **`canal_contact`** est **calculé** (`generated always as`) : téléphone → facebook → email →
  messagerie Airbnb → vide. C'est la colonne qui répond à « par où je joins cette fiche ».
- **`etablissement`** regroupe les logements d'une même maison, **`airbnb_host_id`** ceux d'un même
  hôte. **Un code de réduction par groupe, jamais par logement** : Villa Sophie = 8 annonces mais
  une seule maison, Mahé Lodge = 11 annonces et un seul interlocuteur.
- **`contact_source`** dit d'où vient chaque valeur et avec quelle certitude : « site officiel » est
  sûr, « annuaire » et « titre indexé » sont **à confirmer par un appel**.
- **`telephone_2`** = second numéro publié. À Madagascar un mobile (032/033/034/037/038) est aussi
  un numéro WhatsApp.
- `latitude`/`longitude` : contrainte en base sur la boîte de l'archipel
  (lat −13,60..−13,15 · lng 48,10..48,45), Nosy Komba et Ankify compris.

### Les quatre mesures qui ont changé le résultat

1. **Le quartier déclaré par les hôtes est faux.** Le libellé « Andoany » (= Hell-Ville, à 8 km)
   avait le même centre de gravité que Madirokely, et Emeraude Lodge se déclarait à Ambatozavavy
   alors que sa position est à Andilana. La zone vient donc du **GPS** : on garde le quartier
   déclaré quand la position le confirme à moins de 3 km de l'ancre de cette zone, sinon on
   rattache à l'ancre la plus proche, au-delà la zone reste vide.
   **Témoin : l'ancre Ambatoloaka calculée tombe à 184 m de la position réelle de La Cabane.**
2. **20 positions effacées.** Huit annonces partagent exactement `-13.315, 48.2593`, dont une qui
   se dit « plage à 50 m » d'Ambatoloaka — 8 km plus loin. Airbnb masque ces adresses et renvoie
   le centre de l'île. Une fausse position est pire que pas de position : effacée, et la fiche dit
   d'écrire à l'hôte.
3. **Le dédoublonnage jetait la ligne qui portait le téléphone.** Dix numéros récupérés après coup,
   dont Résidence Ambalamanga et Bungalow chez Mouch, qui se retrouvaient sans aucun contact.
4. **Un rapprochement trop permissif diffusait un faux numéro.** « Villa Nosy » (Hell-Ville) avait
   absorbé « Villa nosy Breizh » et « villa Nosy Komba », qui sont à Nosy Komba, et son téléphone
   s'était répandu sur toutes les annonces de leurs hôtes. Trois rapprochements défaits, contacts
   effacés, repropagation. **Garde en place : aucun numéro sur plus de deux groupes.**

### Règles à ne pas enfreindre

- **Aucune coordonnée personnelle de particulier.** On ne relève que ce que l'établissement publie
  lui-même : son site, sa page professionnelle, sa fiche Google, un annuaire. Chercher le téléphone
  personnel de « Benjamin » en croisant Facebook, c'est constituer un fichier sur des personnes
  privées : on ne le fait pas. Pour un hôte particulier, **la messagerie Airbnb EST le canal**.
- **Aucune valeur écrite sans sa source.** Toute trouvaille arrive avec l'URL de la page où elle a
  été lue, et cette URL va dans `contact_source`.
- **Chaque migration compte ses lignes et refuse de passer si le compte diffère.** Les gardes ont
  attrapé : 17 fiches annoncées contre 22 réelles, la contrainte GPS qui refusait Ankify, une
  empreinte md5 qui ne tombait pas (mise en forme `numeric(9,6)`), 24 fiches sans canal.
- **Ne jamais prospecter Rentanoo** (hôte Airbnb « Chris Rentanoo », 11 annonces) : c'est le
  porteur du projet lui-même.
- **« FAIT AUSSI RESTAURANT » dans les notes = concurrent sur la nourriture.** Le bon angle est
  « un service pour vos clients quand votre cuisine est fermée », pas « plus de choix que vous ».

### Reste à faire — dans l'ordre

1. **Finir la recherche de contacts.** Le quota de recherche web de la session du 28/09 s'est
   épuisé (200/200) : **une quarantaine d'exploitants au nom d'établissement n'ont jamais été
   cherchés**. Les plus gros d'abord : **Résidence Suisse** (11 annonces, Ambondrona),
   **Villa Melissa97** (7, Ampasy), **Résidence Casablanca** (6, Ambatoloaka), **Villa Luna /
   villa Onja** (5, Ambondrona), **Villa Premium** (5, Ambatoloaka), **Villa Volatiana** (3),
   **Collines de Passot** (3), **Résidence Bel Air**, **Résidence Vahi-Ni**, **Villa Donia**,
   **Villa Maddie**, **Mandroso Palazetto**, **Chez Paul et Denise**, **Villa Arcadia**
   (confirmée à Madirokely mais son numéro est masqué sur `nosybe-pro.com`).
   Pistes qui ont refusé la lecture automatisée et qu'il faut ouvrir à la main :
   `annuaire.tourisme.gov.mg` (503 sur les robots), `nosybe-pro.com` (numéros réservés aux
   inscrits), et **facebook.com** (robots.txt) — d'où les pages identifiées par leur seul titre
   indexé, marquées « titre indexé » dans `contact_source`.
2. **Les 22 fiches sans aucun canal** (liste dans la feuille Fiches, filtre Canal vide) :
   quatre agents les ont cherchées, rien de public. À traiter sur place.
3. **Trancher ce que l'hôte gagne** : commission sur les commandes de ses clients, avantage en
   nature, ou rien d'autre que le service rendu. C'est la question qui arrivera avec la première
   réponse, et elle n'est pas tranchée.
4. **Créer les codes promo par adresse** (441), colonne « Code promo à créer » de la feuille
   « Par adresse ». La mécanique existe déjà : table `promo_codes` (`expire_le`,
   `max_utilisations`), et `prospects_hebergement.code_promo_id` attend d'être rempli.
5. **Airbnb a coupé l'envoi de messages** après les 5 premiers, avec un écran d'avertissement
   (« Pourquoi prendre ce risque ? Restez sur Airbnb », menace de suppression du compte). Ne pas
   reformuler pour passer le filtre. La tournée physique et le téléphone restent ouverts.

