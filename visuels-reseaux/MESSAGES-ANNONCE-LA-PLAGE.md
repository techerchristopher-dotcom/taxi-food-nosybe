# Les deux posts de l'annonce La Plage — deux voix, deux pages

Il y a **deux textes, et ils ne doivent pas se ressembler**. Si la page du restaurant et la
page Taxi Food publient la même chose le même jour, ça se voit et ça sonne comme un gabarit.

| | Page **La Plage** | Page **Taxi Food** |
|---|---|---|
| Qui parle | le restaurateur, à ses clients | Taxi Food, à ses utilisateurs |
| Sujet | « **nos** plats », « chez **nous** » | « **La Plage** livre » |
| Ce qu'il annonce | qu'on peut enfin se faire livrer de chez lui | qu'un restaurant de plus est dans l'appli |
| Longueur | libre, c'est sa page | la formule de la charte, quatre blocs |
| Emojis | à son goût | zéro dans le corps |

---

# 1. Le post de La Plage, à publier par le restaurateur lui-même

**Qui parle :** le restaurateur, sur sa propre page, à ses propres clients. Ce n'est pas la
voix de Taxi Food — c'est la sienne. Il annonce que *ses* plats se font livrer, et Taxi Food
est le moyen.

**Ne nomme que du disponible.** Le mi xao et la soupe chinoise sont `is_available = false` en
base au 2026-09-17 : ils ne sont pas dans le texte, même s'ils sont sur la carte.

---

## Version principale — Facebook, Instagram

> **Ça y est : tu peux te faire livrer.** 🛵
>
> On s'est associés à Taxi Food. Nos grillades au feu de bois, nos poissons, le romazava, le
> tartare — tout ce que tu viens chercher chez nous à Hell-Ville — tu peux maintenant l'avoir
> là où tu es.
>
> Tu choisis dans l'appli, tu poses ton adresse sur la carte, et ça part. Aucun minimum de
> commande. Tu paies en espèces ou par carte, comme tu préfères.
>
> Pour ta première commande, le code **TAXIFOOD50** te met la livraison à moitié prix.
>
> Télécharge Taxi Food — ou va d'abord jeter un œil : taxifoodnosybe.distripro207.com
>
> On est là de 10 h à 15 h et de 18 h à 22 h, tous les jours sauf le lundi. À tout de suite.

## Version courte — story, WhatsApp, statut

> **On livre, maintenant.** 🛵
>
> Nos plats arrivent chez toi avec Taxi Food. Première commande : le code **TAXIFOOD50**, et
> la livraison est à moitié prix.
>
> taxifoodnosybe.distripro207.com

## Version très courte — légende sous le visuel

> On s'est associés à Taxi Food : nos plats te sont livrés là où tu es.
> Première commande avec le code **TAXIFOOD50** — livraison à moitié prix.
> taxifoodnosybe.distripro207.com

---

# 2. Le post de la page Taxi Food

Formule de la charte : accroche qui dit que c'est nouveau, le concret, l'action, les mots-clés.
Sept mots-clés, dont les quatre fixes — jamais plus de huit.

## Post 1 — l'annonce

> **Nouveau : La Plage livre chez toi.**
>
> Grillades au feu de bois, poissons, romazava, poulet citronné. La carte entière, de 6 000 à
> 35 000 Ar.
>
> À Hell-Ville, de 10 h à 15 h et de 18 h à 22 h, fermé le lundi.
> Aucun minimum de commande. Espèces ou carte bancaire.
>
> Code `TAXIFOOD50` : la livraison à moitié prix sur ta première commande.
> Télécharge Taxi Food, lien en bio.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar #HellVille #Grillades #LaPlage`

## Variante courte — story, ou second passage

> **La Plage est sur Taxi Food.**
>
> Ses grillades au feu de bois, livrées à Hell-Ville. Dès 6 000 Ar.
>
> `TAXIFOOD50` : livraison à moitié prix sur ta première commande.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #HellVille #LaPlage`

**Pourquoi « Nouveau : » en tête.** La charte l'impose — *« l'accroche dit toujours que c'est
nouveau »*, parce que personne à Nosy Be n'a l'habitude de se faire livrer : le lecteur ne
cherche pas un service qu'il connaît, il découvre qu'il existe. Et la nouveauté est celle du
**service**, jamais du restaurant : La Plage existe depuis longtemps et ses clients le savent.

**Pas de lien écrit dans ce post-là**, contrairement à celui du restaurateur : sur la page Taxi
Food le lien vit en bio, et un lien dans le corps du texte fait chuter la portée sur Facebook.
Le QR a été retiré du visuel pour la même raison — personne ne scanne en scrollant.

---

## Ce qui a été vérifié avant d'écrire

| Affirmation du post | Vérifiée où |
|---|---|
| Livraison possible | `listing_status = visible`, `auto_open = true`, `telegram_chat_id` présent |
| Aucun minimum de commande | `min_order = 0` |
| Espèces ou carte | les deux moyens de paiement du projet |
| `TAXIFOOD50` = −50 % sur la livraison | `promo_codes`, `actif = true`, `porte_sur = 'livraison'`, une fois par client |
| 10 h – 15 h et 18 h – 22 h, fermé le lundi | `restaurant_hours`, 14 lignes |
| Hell-Ville | son enseigne (`zone_served` dit encore « Nosy Be », à corriger) |
| Grillades au feu de bois, poissons, romazava, tartare | tous `is_available = true` |

## Deux choses à faire avant qu'il publie

1. **Vérifier que La Plage apparaît bien sur le site vitrine.** La page charge ses partenaires
   depuis la base en JavaScript : je n'ai pas pu le confirmer de l'extérieur, la version
   statique de la page cite encore La Cabane et Angelo. **Ouvre
   `taxifoodnosybe.distripro207.com` et regarde si La Plage y est** avant de lui donner le
   lien — un client qui clique et ne trouve pas le restaurant est pire que pas de lien.
2. **Les emojis sont à son goût.** J'en ai mis un, en tête de post. La charte Taxi Food en
   interdit dans le corps du texte, mais c'est sa page à lui : s'il en veut plus, c'est son
   ton, pas le nôtre. S'il n'en veut pas, le texte marche sans.
