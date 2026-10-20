# L'escale Créole — textes d'accompagnement de l'annonce

Visuels : `PUB-escale-annonce.png` (1080 × 1350, fil Facebook / Instagram) et
`PUB-escale-annonce-story.png` (1080 × 1920, story / statut). Même gabarit que
l'annonce du Nandipo, variante « restaurant déjà disponible ». Formule de la charte :
la nouveauté ouvre le post, puis concret · action · mots-clés. Trois blocs, jamais cinq.

**La tournure est passive.** L'escale Créole ne livre pas : Taxi Food livre.

**Chaque fait écrit plus bas a été relu en base le 2026-10-14** (`128e68ab-…`) :
cuisine créole réunionnaise, Ambatoloaka ; lundi au samedi 11 h 30 – 13 h 45 et
18 h – 21 h 45, fermé le dimanche (`restaurant_hours`, deux services) ; plats
disponibles hors boissons de 2 000 Ar (sambos) à 38 000 Ar (rougail saucisses) ;
minimum de commande 0 ; livraison 2 000 Ar jusqu'à 3 km puis 1 000 Ar par km entamé ;
`TAXIFOOD50` (−50 % sur la livraison, première commande). Si l'un de ces faits change,
la légende change avec lui.

---

## Post 1 — l'annonce (avec `PUB-escale-annonce.png`)

> **Nouveau à Nosy Be : L'escale Créole est sur Taxi Food.**
>
> La cuisine réunionnaise d'Ambatoloaka, livrée chez toi : rougail saucisses, bol renversé, émincés de zébu ou de poulet, sambos. Du lundi au samedi, midi et soir.
> De 2 000 à 38 000 Ar. Livraison dès 2 000 Ar, et à moitié prix sur ta première commande avec le code `TAXIFOOD50`.
>
> Télécharge Taxi Food, lien en bio.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar #Ambatoloaka #CuisineCreole #LaReunion`

## Post 2 — le plat de la maison (photo : `produits/escale-creole/pj-rougail-saucisses.jpg`)

> **Nouveau à Nosy Be : le rougail saucisses de L'escale Créole, livré chez toi.**
>
> Saucisses fumées dorées à l'oignon et à l'ail, mijotées avec tomates, gingembre et curcuma. Servi avec riz et grains, piment selon ton choix. 38 000 Ar.
> Tu le commandes dans l'appli entre 11 h 30 et 13 h 45 ou entre 18 h et 21 h 45, on te le livre.
>
> Code `TAXIFOOD50` : la livraison à moitié prix sur ta première commande.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Ambatoloaka #Rougail #CuisineReunionnaise`

## Post 3 — la carte et les petites faims

> **Nouveau à Nosy Be : un goût de La Réunion, livré là où tu es.**
>
> Émincés de zébu ou de poulet (brèdes, poivre vert, oignons ou gingembre), bol renversé, et pour l'apéro sambos, bouchons et demi-lunes dès 2 000 Ar.
> L'escale Créole, Ambatoloaka. Du lundi au samedi, midi et soir.
>
> Code `TAXIFOOD50` pour ta première commande. Télécharge Taxi Food, lien en bio.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar #Ambatoloaka #CuisineCreole`

## Version courte — statut WhatsApp, story, TikTok (avec `PUB-escale-annonce-story.png`)

> Nouveau à Nosy Be : L'escale Créole est sur Taxi Food. Cuisine réunionnaise livrée chez toi, du lundi au samedi, midi et soir.
> Code `TAXIFOOD50` = livraison à moitié prix sur ta première commande.

---

## Ce qu'il ne faut PAS écrire

- **« L'escale Créole livre… »** : c'est Taxi Food qui livre.
- **Cari, massalé cabri, rôti de porc, poisson frit, sauté porc aux gros piments** :
  ces quatre derniers existent en base comme plats du jour, mais `in_menu = false` et
  `is_featured = false` → invisibles pour un client, donc pas commandables. Aucun cari
  n'est à la carte. Les citer serait promettre ce que l'appli ne vend pas. Idem
  « poisson » (présent dans `food_types`, aucun plat de poisson commandable aujourd'hui).
- **Riz frit, beignets crevettes/calamars, soupe chinoise** : `is_available = false`.
- **« Ouvert le dimanche »** ou « 7 j/7 » : fermé le dimanche.
- **Un nombre de plats** : `is_available` bouge, un chiffre écrit devient faux.
- **Une heure de fermeture à 14 h ou 22 h** : les services s'arrêtent à 13 h 45 et 21 h 45.

## Porc — à savoir avant de publier

Le visuel n'écrit rien sur le porc (règle de la consigne), mais **le plat héros de la
mosaïque, le Rougail saucisses (38 000 Ar), porte `diet_tags = {porc}`** en base, et le
Post 2 lui est entièrement consacré. Portent aussi le badge porc : Saucisse frite et
Bouchon porc. Les autres plats montrés (sambos zébu ou poulet, bol renversé, émincés de
zébu aux oignons, émincé de poulet au brède ; en story demi-lune poulet et assiette de
crudités) n'ont aucun badge. Si la publication vise une clientèle qui ne mange pas de
porc, le Post 3 est le plus sûr.

## Avant de publier

1. **Le restaurant n'est PAS encore commandable** : `listing_status = coming_soon`
   (« En négociation ») au 2026-10-14. Ce visuel est la variante « déjà disponible » :
   ne rien publier avant le passage en `visible`, qui se fait **par l'onglet
   Restaurants de l'admin** (`admin_set_listing_status`) — c'est ce geste qui prévient
   les clients qui ont appuyé sur « Me prévenir » (22 lignes d'intérêt en base, visites
   et alertes confondues) et qui démarre le badge « ✨ Nouveau » de 14 jours.
2. **Aucune annonce push ni e-mail** ne cite L'escale Créole (table `annonces`, 0).
3. **Les photos sont des visuels de carte en studio** (drapeau de La Réunion en fond) :
   ce sont les photos du catalogue (`products.photo_url`), celles que le client voit
   dans l'appli. Le morceau de drapeau qui porte la pastille −50 % est découpé dans la
   photo de l'émincé de poulet au brède, au-dessus de l'assiette : rien n'est dessiné.
