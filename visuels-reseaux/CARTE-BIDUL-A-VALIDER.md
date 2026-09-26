# Chez Bidul & Truc — la nouvelle carte

**À relire et valider avant que quoi que ce soit ne parte en base ou à l'impression.**
71 références. 61 plats, 10 boissons.

---

## 1. Ce qui change

| | Avant | Après |
|---|---|---|
| Catégories | 9, dont un bloc « Plat » de 18 lignes | 11, aucun bloc au-delà de 13 lignes |
| Ordre des catégories | collision : Softs et Dessert tous les deux à 40 | parcours net de 10 à 110 |
| Plats décrits | 29 sur 71 | 71 sur 71 |
| Présentation d'une ligne | aucune | 71 |
| Prix | — | +1 000 Ar sur les 61 plats, **10 boissons inchangées** |
| Logo | en base, jamais sur un document | en tête de la carte imprimée |
| Taxi Food | absent de la carte | bloc « aussi livré » en pied de carte |

---

## 2. La nouvelle organisation

Le bloc « Plat » de 18 lignes était le vrai problème : personne ne lit 18 lignes d'affilée.
Il se coupe naturellement en trois familles, ce qui est aussi la façon la plus rapide de faire
monter une carte en gamme — on passe d'une liste à un menu.

| Ordre | Catégorie | Nb | Fourchette (après +1000) |
|---|---|---|---|
| 10 | Tapas & à grignoter 🍢 | 5 | 11 000 – 19 000 |
| 20 | Entrées 🥗 | 12 | 9 000 – 30 000 |
| 30 | De la mer 🐟 | 6 | 23 000 – 34 000 |
| 40 | Viandes & volailles 🥩 | 7 | 25 000 – 34 000 |
| 50 | Brasserie 🍳 | 5 | 15 000 – 29 000 |
| 60 | Pâtes 🍝 | 4 | 15 000 – 31 000 |
| 70 | Pizzas 🍕 *(le soir, 18h–22h)* | 13 | 26 000 – 36 000 |
| 80 | Burgers 🍔 | 3 | 25 000 – 29 000 |
| 90 | Desserts 🍰 | 6 | 10 000 – 16 000 |
| 100 | Bières 🍺 | 4 | 7 000 – 9 000 *(inchangé)* |
| 110 | Softs 🥤 | 6 | 5 000 – 8 000 *(inchangé)* |

**Pourquoi Tapas en premier.** C'est l'entrée de gamme (11 000 Ar) et c'est l'identité affichée
de la maison — « restaurant, bar & tapas ». Dans l'appli, la première catégorie est celle que
tout le monde voit : commencer par ce qui est le moins cher et le plus facile à commander fait
entrer les gens. Si tu préfères ouvrir sur les Entrées, c'est un chiffre à changer, rien de plus.

**Coût technique.** « De la mer », « Viandes & volailles » et « Brasserie » n'existent pas encore :
il faut créer 2 catégories (la 3e réutilise l'actuelle « Plat ») et re-pointer 18 plats. Une
migration, dix minutes.

---

## 3. Les deux surfaces

Chaque plat reçoit **deux textes**, écrits une seule fois :

- **Ingrédients** → c'est ce qui part dans le champ `description` de l'appli. Court, factuel :
  quand quelqu'un commande, il veut savoir ce qu'il y a dedans, pas lire de la poésie.
- **Présentation** → c'est la ligne de la carte imprimée, sous le nom du plat. C'est elle qui
  fait la montée en gamme.

Si tu veux les deux dans l'appli aussi, dis-le : c'est un collage, pas une réécriture.

> **Légende** — ° = composition que je n'ai pas trouvée en base, écrite d'après la recette
> classique du plat. À confirmer par Bidul avant impression.
> 🐖 = contient du porc (badge déjà actif dans l'appli).

---

## 4. Les 71 fiches

### 🍢 Tapas & à grignoter

*À partager, au comptoir ou à table.*

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Pommes frites** | 11 000 | Pommes de terre, sel. ° | La frite qui accompagne tout — et qui se tient très bien toute seule. |
| **Beignets crevettes, calamar ou poisson** | 18 000 | Au choix : crevettes, calamar ou poisson. Pâte à beignet, frits minute. Les 10. | Dix bouchées dorées à partager, le meilleur prétexte pour une deuxième tournée. |
| **Crevettes croustillantes** | 18 000 | Crevettes panées, frites minute. Les 10. ° | Croquant dehors, moelleux dedans — ça se mange avec les doigts, c'est fait pour. |
| **Poulet croustillant** | 18 000 | Émincés de poulet panés, frits minute. ° | Le tapas qui met tout le monde d'accord, du comptoir aux enfants. |
| **Poisson fumé** | 19 000 | Poisson fumé, huile d'olive, citron, pain grillé. ° | Une entrée en matière iodée, fumée juste ce qu'il faut. |

### 🥗 Entrées

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Salade légumes** | 9 000 | Salade verte, tomate, carotte, concombre, vinaigrette maison. ° | Simple et fraîche — la bonne idée quand il fait 32°. |
| **Œuf mimosa** | 10 000 | Œufs durs, jaunes montés à la mayonnaise maison, ciboulette. ° | Le classique de bistrot : celui qu'on ne commande jamais et qu'on finit toujours. |
| **Salade tomate œuf dur** | 10 000 | Tomates, œufs durs, oignon, vinaigrette maison. ° | Deux produits, rien à cacher. |
| **Salade crudité œuf dur** | 10 000 | Crudités de saison, œufs durs, vinaigrette maison. ° | Le plein de frais avant le plat. |
| **Terrine de campagne maison** 🐖 | 11 000 | Porc, foie, persil, cornichons, pain grillé. Terrine maison. ° | Faite ici, tranchée épais, servie avec ses cornichons. Sans chichis. |
| **Salade tomate crevettes** | 15 000 | Tomates, crevettes, salade, sauce cocktail. ° | La salade qui se prend pour une entrée de bord de mer. Et qui a raison. |
| **Tartare de poisson** | 19 000 | Poisson cru taillé au couteau, citron vert, huile d'olive, oignon rouge, coriandre. ° | Le poisson du jour, cru, réveillé au citron vert. La fraîcheur à l'état pur. |
| **Carpaccio de poisson** | 19 000 | Fines tranches de poisson cru, huile d'olive, citron, baies roses. ° | Tranché fin, assaisonné juste : on laisse le poisson parler. |
| **Carpaccio de zébu** | 21 000 | Zébu cru en fines tranches, huile d'olive, parmesan, roquette, citron. ° | Le zébu malgache servi cru et fin — une viande de caractère, tout en douceur. |
| **Camembert pané** | 23 000 | Camembert pané et frit, salade, confiture de fruits rouges. ° | Croustillant dehors, coulant dedans. Le plaisir coupable, assumé. |
| **Foie gras poêlé** | 30 000 | Foie gras poêlé, réduction sucrée, pain grillé. ° | Saisi à la minute : doré dehors, fondant dedans. |
| **Terrine foie gras** | 30 000 | Terrine de foie gras, fleur de sel, pain grillé. ° | Le même produit, la version tranquille. |

### 🐟 De la mer

*Accompagnement inclus au choix : frites, riz, pâtes, purée ou légumes sautés. 2e accompagnement + 5 000 Ar.*

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Soupe de poisson maison** | 23 000 | Poissons de roche mixés, croûtons à l'ail, rouille (ail, safran, piment, huile d'olive). | Une vraie soupe de poisson, servie brûlante avec ses croûtons et sa rouille. |
| **Poisson (filet)** | 28 000 | Filet de poisson grillé. Accompagnement inclus au choix. | Le poisson du jour, grillé simplement. On ne cache rien derrière une sauce. |
| **Filet de poisson sauce au choix** | 31 000 | Filet de poisson, sauce au choix : curry, poireaux ou poivre vert. Accompagnement inclus. | Le même filet, trois caractères : doux, crémeux ou relevé. |
| **Crevette ou calamar sauté** | 31 000 | Crevettes ou calamars sautés, à l'ail ou au gingembre. Accompagnement inclus. | Saisi vif à la poêle, ail ou gingembre — deux façons de réveiller la mer. |
| **Crevette ou calamar sauce** | 33 000 | Crevettes ou calamars, sauce au choix : combava, poivre vert ou curry. Accompagnement inclus. | Le combava, cet agrume de l'océan Indien, réveille tout ce qu'il touche. |
| **Marmite du pêcheur** | 34 000 | Poisson, crevettes, calamars, légumes, bouillon safrané. Accompagnement inclus. ° | Tout ce que la mer a donné ce jour-là, réuni dans une seule marmite. |

### 🥩 Viandes & volailles

*Accompagnement inclus au choix : frites, riz, pâtes, purée ou légumes sautés. 2e accompagnement + 5 000 Ar.*

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Steak haché** | 25 000 | Steak haché de zébu. Accompagnement inclus au choix. ° | Le zébu haché maison : le plat qu'on commande sans réfléchir, et qu'on refait. |
| **Steak haché à cheval** | 27 000 | Steak haché de zébu, œuf au plat. Accompagnement inclus au choix. | Le même, coiffé d'un œuf au plat. Le jaune fait la sauce. |
| **Cuisse de poulet** | 29 000 | Cuisse de poulet rôtie. Accompagnement inclus au choix. ° | Peau dorée, chair qui se détache. Le rôti du dimanche, tous les jours. |
| **Filet de zébu** | 31 000 | Filet de zébu grillé. Accompagnement inclus au choix. | Le zébu, c'est la viande d'ici : moins grasse, plus de goût. |
| **Pavé de zébu piqué à l'ail** | 32 000 | Pavé de zébu piqué à l'ail, grillé. Accompagnement inclus au choix. | L'ail glissé dans la viande avant cuisson : il parfume de l'intérieur. |
| **Émincé de poulet sauce estragon** | 32 000 | Émincé de poulet, crème à l'estragon. Accompagnement inclus au choix. ° | L'estragon et la crème, un mariage de cuisine française qui ne rate jamais. |
| **Filet de zébu sauce au choix** | 34 000 | Filet de zébu, sauce au choix : 3 poivres ou champignons. Accompagnement inclus. | Poivre pour le caractère, champignons pour la rondeur. |

### 🍳 Brasserie

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Omelette légumes** | 15 000 | Œufs, légumes de saison, herbes. Accompagnement + 5 000 Ar. ° | Battue à la commande, baveuse comme il faut. |
| **Croque-monsieur** 🐖 | 23 000 | Pain de mie, jambon, fromage, béchamel, gratiné. Accompagnement + 5 000 Ar. ° | Gratiné au four, pas au grille-pain. La différence se voit. |
| **Croque-madame** 🐖 | 25 000 | Croque-monsieur + œuf au plat. Accompagnement inclus au choix. | Le croque-monsieur qui a mis un chapeau. |
| **Omelette campagnarde** 🐖 | 26 000 | Œufs, lardons, pommes de terre, oignon, fromage. Accompagnement + 5 000 Ar. | Une omelette qui tient au corps : lardons, pommes de terre, fromage fondu. |
| **Cordon bleu** 🐖 | 29 000 | Blanc de poulet, jambon, fromage, pané, crème de poireaux. Accompagnement inclus. | Pané maison, cœur fondant, crème de poireaux. Le souvenir d'enfance, en mieux. |

### 🍝 Pâtes

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Pâtes au beurre** | 15 000 | Pâtes, beurre, parmesan. ° | La valeur sûre des enfants — et des grands qui assument. |
| **Pâtes bolognaise** | 30 000 | Pâtes, sauce tomate mijotée, viande de zébu hachée, parmesan. ° | Une bolognaise qui a mijoté, pas une sauce réchauffée. |
| **Pâtes carbonara** 🐖 | 31 000 | Pâtes, lardons, crème, œuf, parmesan. ° | Crémeuse et généreuse, la version qu'on aime vraiment. |
| **Pâtes fruit de mer** | 31 000 | Pâtes, crevettes, calamars, poisson, sauce tomate. ° | La marée du jour posée sur des pâtes. |

### 🍕 Pizzas

*Servies le soir, de 18h à 22h. Pâte fine, cuite à la commande.* °

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Margherita** | 26 000 | Tomate, mozzarella, olive, origan | Trois ingrédients, zéro cachette : celle qui juge une pizzeria. |
| **Végétarienne** | 28 000 | Tomate, aubergine, poivron, courgette, gouda, mozzarella, oignon, herbes de Provence | Le potager entier, rôti sur la pâte. |
| **Maître Coq** | 28 000 | Tomate, gouda, mozzarella, poulet | Généreuse en poulet, douce en fromage : celle que tout le monde finit. |
| **Carnivore** | 28 000 | Tomate, gouda, mozzarella, viande hachée, oignon | Le nom annonce la couleur. |
| **Toscane** 🐖 | 30 000 | Crème, lardon, champignon, mozzarella, œuf | Base crème, œuf au centre : on casse le jaune avant la première part. |
| **Reine** 🐖 | 30 000 | Tomate, gouda, mozzarella, jambon de porc, champignons, olive noire | L'intemporelle. Jambon, champignons, rien à réinventer. |
| **Océane** | 30 000 | Tomate, calamar, crevette, poisson, gouda, mozzarella | Nosy Be sur une pizza : calamar, crevette, poisson. |
| **Paysanne** 🐖 | 30 000 | Crème, fromage local, mozzarella, jambon de porc, champignons | Le fromage local rencontre la base crème. Rustique et fondante. |
| **Oriental** | 32 000 | Tomate, gouda, mozzarella, merguez, viande hachée, oignon, poivron, œuf | Merguez et poivrons : celle qui a du tempérament. |
| **Napolitaine** | 32 000 | Tomate, gouda, mozzarella, câpres, anchois, olives noires | Câpres et anchois : salée, franche, pour les amateurs. |
| **4 Fromages** | 33 000 | Crème, gouda, mozzarella, bleu d'Antsirabe, raclette | Quatre fromages dont le bleu d'Antsirabe, le seul persillé de Madagascar. |
| **Savoyarde** 🐖 | 36 000 | Crème, oignon, fromage de montagne, gouda, lardon, pomme de terre, œuf | La montagne sous les tropiques. Pomme de terre, lardons, fromage. |
| **Gargantua** | 36 000 | Tomate, gouda, mozzarella, viande hachée, poulet, merguez, oignon, poivron, œuf | Trois viandes. Le nom est une mise en garde. |

### 🍔 Burgers

*Frites incluses. Sauce au choix : mayonnaise, moutarde ou ketchup.*

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Le classique** | 25 000 | Pain, légumes, oignon, zébu ou poulet, frites incluses. Sauce au choix. | Zébu ou poulet, à toi de voir. Les frites ne se discutent pas. |
| **Le poisson** | 25 000 | Pain, légumes, oignon, poisson, frites incluses. Sauce au choix. | Le burger de l'île : poisson frais entre deux pains. |
| **Le patron** 🐖 | 29 000 | Pain, viande, oignon, légumes, bacon, fromage, frites incluses. Sauce au choix. | Bacon et fromage fondu. Il porte bien son nom. |

### 🍰 Desserts

*Suppléments au choix : glace vanille, chantilly ou coulis chocolat, + 5 000 Ar.*

| Plat | Prix | Ingrédients *(appli)* | Présentation *(carte)* |
|---|---|---|---|
| **Salade de fruit de saison** | 10 000 | Fruits frais de saison, taillés minute. ° | Ce que le marché a donné le matin même. |
| **Crêpes** | 10 000 | Crêpes maison. Nappage au choix : sucre, chocolat, confiture ou miel. | Faites à la poêle, pliées chaudes. |
| **Banane flambée** | 10 000 | Bananes, sucre, rhum flambé. ° | Flambée devant toi. Le dessert qui fait tourner les têtes. |
| **Mousse au chocolat** ⏸ | 13 000 | Chocolat noir, œufs, montée maison. ° | Montée à la main, dense et brillante. |
| **Crème caramel ou chocolat** | 13 000 | Crème maison, caramel ou chocolat au choix. | Faite maison, servie bien froide. |
| **Crème brûlée** ⏸ | 16 000 | Crème vanille, sucre caramélisé au chalumeau. ° | Le bruit de la cuillère qui casse la croûte. |

⏸ = actuellement marqué indisponible dans l'appli.

### 🍺 Bières — *prix inchangés*

| Plat | Prix | Présentation *(carte)* |
|---|---|---|
| **Fresh 33 cl** | 7 000 | La légère, bien fraîche. |
| **THB 50 cl** | 8 000 | La bière de Madagascar. Grand format. |
| **Beaufort 33 cl** | 8 000 | Blonde, ronde, sans détour. |
| **Gold Blanche 50 cl** | 9 000 | Blanche et douce, la plus facile sous la chaleur. |

### 🥤 Softs — *prix inchangés*

| Plat | Prix |
|---|---|
| **World Cola 33 cl** | 5 000 |
| **Caprice Grenadine 33 cl** | 5 000 |
| **Caprice Bonbon Anglais 33 cl** | 5 000 |
| **Caprice Orange 33 cl** | 5 000 |
| **Energy Drink XXL** | 7 000 |
| **Energy Drink Fosa 50 cl** | 8 000 |

---

## 5. Les six points à trancher

**1. Le croque-monsieur n'a pas d'accompagnement inclus, le croque-madame si.**
Croque-monsieur 23 000 sans garniture (+5 000 pour en ajouter) ; croque-madame 25 000 avec
garniture incluse. Le croque-madame, c'est un croque-monsieur plus un œuf : 2 000 Ar d'écart
qui donnent en plus une garniture à 5 000. Soit le croque-monsieur doit inclure sa garniture,
soit le croque-madame ne devrait pas. **Deux plats sur 61, mais c'est celui qui se voit.**

**2. Deux desserts sont indisponibles** — mousse au chocolat et crème brûlée. On les imprime
quand même, ou on les sort de la carte papier ? (Dans l'appli ils restent, grisés.)

**3. Les compositions marquées °** — 31 lignes écrites d'après la recette classique parce que la
base ne disait rien. Les cinq qui comptent vraiment : marmite du pêcheur, pâtes fruit de mer
(tomate ou crème ?), camembert pané (avec quoi ?), poisson fumé (quel poisson ?), et si les
frites sont fraîches ou surgelées — parce que « pommes de terre fraîches » sur une carte, ça
s'écrit seulement si c'est vrai.

**4. Tapas en première catégorie** — mon choix, expliqué plus haut. Un mot et je remets Entrées.

**5. Créer « De la mer » et « Viandes & volailles »** — ça casse le bloc de 18. Je le recommande,
mais c'est ta base de production, donc c'est ton feu vert.

**6. Rien à signaler sur le porc.** Vérifié ligne à ligne : les 11 plats qui contiennent du porc
portent tous le tag. Les merguez de l'Oriental et du Gargantua sont bœuf/mouton, pas de tag à
ajouter.

---

## 6. Après ton feu vert

1. Migration : les 61 nouveaux prix, les 71 descriptions, les 2 catégories, le réordonnancement.
2. La carte imprimée : logo Bidul en tête, les 11 sections, et en pied le bloc Taxi Food —
   « Ce restaurant est aussi livré », code promo, les deux stores.
3. Un contrôle mesuré avant livraison, comme pour les visuels : aucun débord, aucune ligne veuve.

*Rien n'est écrit en base tant que tu n'as pas dit oui.*
