# Brancher les canettes — prompt pour Claude Code

## Le contexte, en trois lignes

Onze packshots de canettes viennent d'être produits à partir de photos réelles prises au bar.
Ils sont sur le disque, prêts. Il faut les **téléverser dans le bucket `boissons`** de Supabase,
puis **rebrancher les produits de Chez Bidul & Truc** dessus.

Je n'ai pas pu téléverser moi-même : les règles du bucket exigent `is_admin()`, et je ne
manipule pas d'identifiants. C'est le seul morceau qui te revient.

## Où sont les fichiers

```
~/Desktop/1-DEV CLAUDE /taxi-food-nosybe/partenaire /bidul et truc /pub /boissons-packshots/
```

Attention aux **espaces dans les noms de dossiers** — `1-DEV CLAUDE ` et `partenaire ` et
`bidul et truc ` et `pub ` ont tous un espace final. Utilise des guillemets.

Onze PNG, 2048 × 2048, fond blanc, environ 3,5 Mo chacun :

```
canette-beaufort-33cl.png                canette-gold-blanche-50cl.png
canette-caprice-bonbon-anglais-33cl.png  canette-gold-blonde-50cl.png
canette-caprice-grenadine-33cl.png       canette-thb-50cl.png
canette-caprice-orange-33cl.png          canette-world-cola-33cl.png
canette-fosa-50cl.png                    canette-xxl.png
canette-fresh-33cl.png
```

## Étape 1 — téléverser

Projet Supabase `bmdveawomizjpiebgtkj`, bucket **`boissons`**, à la racine, **sans renommer**.

Le bucket est public en lecture. L'écriture demande `is_admin()` : utilise la clé
`service_role` (elle est dans `.secrets.local` à la racine du dépôt, ne la fais jamais
apparaître dans un message ni dans un commit).

Les fichiers font ~3,5 Mo. Si c'est trop lourd pour l'appli, réduis-les à 1024 × 1024 avant
d'envoyer — mais garde le fond blanc et le PNG.

**Vérifie après coup** que les onze URL publiques répondent bien en 200 :
`https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/<fichier>`

## Étape 2 — rebrancher les produits

**Uniquement Chez Bidul & Truc.** Les dix produits sont déjà nommés au bon format, il n'y a
aucun renommage à faire. Quatre n'ont aucune image aujourd'hui, trois en ont une fausse.

| Produit (Chez Bidul & Truc) | Image aujourd'hui | Nouveau fichier |
|---|---|---|
| THB 50 cl | une **bouteille** | `canette-thb-50cl.png` |
| Gold Blanche 50 cl | **aucune** | `canette-gold-blanche-50cl.png` |
| Beaufort 33 cl | canette correcte, basse définition | `canette-beaufort-33cl.png` |
| Fresh 33 cl | **aucune** | `canette-fresh-33cl.png` |
| Energy Drink Fosa 50 cl | **aucune** | `canette-fosa-50cl.png` |
| Energy Drink XXL | **aucune** | `canette-xxl.png` |
| World Cola 33 cl | canette correcte, basse définition | `canette-world-cola-33cl.png` |
| Caprice Grenadine 33 cl | une **bouteille de sirop** — autre produit | `canette-caprice-grenadine-33cl.png` |
| Caprice Orange 33 cl | une **bouteille PET 1,5 L** | `canette-caprice-orange-33cl.png` |
| Caprice Bonbon Anglais 33 cl | une **bouteille verre** | `canette-caprice-bonbon-anglais-33cl.png` |

Le SQL, à passer **tel quel** — ciblé par restaurant ET par nom de produit, jamais en masse :

```sql
-- Chez Bidul & Truc : brancher les canettes
with r as (select id from restaurants where name = 'Chez Bidul & Truc'),
     b as (select 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/' as u)
update products p set photo_url = (select u from b) || m.fichier
from (values
  ('THB 50 cl',                    'canette-thb-50cl.png'),
  ('Gold Blanche 50 cl',           'canette-gold-blanche-50cl.png'),
  ('Beaufort 33 cl',               'canette-beaufort-33cl.png'),
  ('Fresh 33 cl',                  'canette-fresh-33cl.png'),
  ('Energy Drink Fosa 50 cl',      'canette-fosa-50cl.png'),
  ('Energy Drink XXL',             'canette-xxl.png'),
  ('World Cola 33 cl',             'canette-world-cola-33cl.png'),
  ('Caprice Grenadine 33 cl',      'canette-caprice-grenadine-33cl.png'),
  ('Caprice Orange 33 cl',         'canette-caprice-orange-33cl.png'),
  ('Caprice Bonbon Anglais 33 cl', 'canette-caprice-bonbon-anglais-33cl.png')
) as m(nom, fichier)
where p.restaurant_id = (select id from r) and p.name = m.nom;
```

Attendu : **10 lignes modifiées.** Si tu en obtiens un autre nombre, n'insiste pas — un nom a
changé quelque part, signale-le.

Contrôle après coup :

```sql
select p.name, p.price, regexp_replace(p.photo_url,'^.*/boissons/','') as image
from products p join restaurants r on r.id = p.restaurant_id
where r.name = 'Chez Bidul & Truc'
  and p.category_id in (select id from categories
                        where restaurant_id = r.id and name in ('Bières','Softs'))
order by p.name;
```

## Ce que tu ne touches pas

**Angelo, La Cabane et Taxi Be gardent leurs images actuelles.** Leurs produits s'appellent
« THB PM », « THB GM », « Gold Blanche PM » — *petit* et *grand modèle*, c'est-à-dire des
bouteilles. Y coller une canette 50 cl serait remplacer une image fausse par une autre.

Une exception qui mérite d'être signalée, sans être corrigée à l'aveugle : **`thb-pm.jpg` est
un verre vide**, et il illustre le THB PM en vente chez Angelo, La Cabane et Taxi Be, entre
6 000 et 7 000 Ar. Il faudra une photo de la bouteille 33 cl. En attendant, c'est le pire
visuel du catalogue.

Ne supprime aucun ancien fichier du bucket : d'autres restaurants s'en servent encore.

## Ce que tu me renvoies

Le nombre de fichiers téléversés, le nombre de lignes modifiées, le résultat de la requête de
contrôle, et toute URL qui ne répond pas en 200.
