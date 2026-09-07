-- La carte se reordonnait toute seule a chaque modification d'un plat.
--
-- Constate le 2026-09-07 en posant des labels « contient du porc » chez Chez Bidul
-- & Truc : le croque-monsieur etait 3e de la categorie « Plat », il s'est retrouve
-- 15e, et la croque-madame derniere. Rien dans l'ecran n'avait bouge — c'est la
-- BASE qui les avait deplaces.
--
-- CAUSE. `products` ne portait aucune colonne d'ordre, et `getMenu` ne demandait
-- aucun `ORDER BY`. Sans tri explicite, Postgres rend les lignes dans l'ordre
-- physique du fichier, et une ligne UPDATE-ee est reecrite A LA FIN. Chaque
-- changement de prix, chaque rupture cochee, chaque plat etoile faisait donc
-- descendre le plat au bas de sa categorie, chez le client, definitivement.
--
-- ⚠️ Ce n'est pas un defaut d'affichage : c'est un ordre qui n'existait pas. Un
-- restaurateur qui range sa carte ne pouvait pas la ranger.
--
-- CORRECTIF. Une colonne `sort_order`, semee depuis l'ordre actuel pour que RIEN
-- ne bouge a l'application de cette migration, et un tri explicite cote app.
--
-- ⚠️ L'ordre seme est celui d'aujourd'hui, deja partiellement brasse par les
-- modifications passees — il n'y a aucun moyen de retrouver l'ordre d'origine de
-- la carte papier, `products` n'ayant meme pas de `created_at`. Le figer est donc
-- le mieux qu'on puisse faire sans inventer : a partir de maintenant il ne bouge
-- plus tout seul, et un ecran de reordonnancement pourra s'appuyer dessus.

alter table public.products
  add column if not exists sort_order integer not null default 0;

comment on column public.products.sort_order is
  'Rang du plat dans sa categorie. Sans lui, l''ordre suivait la disposition physique des lignes et changeait a chaque UPDATE.';

-- Semis : on numerote les plats dans l'ordre ou ils sortaient jusqu'ici, categorie
-- par categorie. `ctid` est la position physique — precisement ce qui servait
-- d'ordre implicite. On la fige avant qu'elle ne rebouge.
with rangs as (
  select id,
         row_number() over (
           partition by restaurant_id, category_id
           order by ctid
         ) * 10 as rang
  from public.products
)
update public.products p
   set sort_order = r.rang
  from rangs r
 where r.id = p.id and p.sort_order = 0;

create index if not exists products_categorie_ordre_idx
  on public.products (category_id, sort_order);
