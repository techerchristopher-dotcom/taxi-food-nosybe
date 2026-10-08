-- Vraie photo du plat + avis rattachés aux plats commandés (2026-10-08)
--
-- Décision du porteur du projet :
--   * la LISTE montre le visuel qui donne envie (`products.photo_url`, souvent un visuel IA) ;
--   * la FICHE du plat montre la vraie photo prise par le restaurant quand elle existe
--     (`products.vraie_photo_url`, badge « Vraie photo du plat »), sinon le visuel avec la
--     mention « Image d'illustration » ;
--   * un avis dit CE QUI A ÉTÉ COMMANDÉ (« Jenn a commandé : Rougail saucisse »), sur la
--     fiche du restaurant comme sur la fiche de chaque plat de la commande.
--
-- `vraie_photo_url` reste vide tant qu'on n'a pas CONFIRMÉ qu'une photo est réelle : en cas
-- de doute la fiche dit « Image d'illustration », on sous-promet, jamais l'inverse.

alter table public.products
  add column if not exists vraie_photo_url text;

comment on column public.products.vraie_photo_url is
  'Vraie photo du plat prise par le restaurant (fiche plat, badge « Vraie photo »). Vide = la fiche montre photo_url avec « Image d''illustration ».';

-- Noms des plats d'une commande (instantanés figés à la commande), sans doublon. Interne :
-- seuls des noms de plats sortent, jamais quantités, prix ni options.
create or replace function public.plats_de_commande(p_order_id uuid)
returns text[]
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(array_agg(distinct oi.product_name_snapshot order by oi.product_name_snapshot), '{}')
    from public.order_items oi
   where oi.order_id = p_order_id;
$$;
revoke all on function public.plats_de_commande(uuid) from public, anon, authenticated;

-- avis_restaurant : même contrat, une colonne `plats` de plus EN DERNIER.
-- Le type de retour change : DROP puis CREATE (pas de surcharge, piège PGRST203).
drop function if exists public.avis_restaurant(uuid, integer, integer);
create function public.avis_restaurant(p_restaurant_id uuid, p_limite integer default 20, p_decalage integer default 0)
returns table(id uuid, prenom text, note_cuisine smallint, note_preparation smallint, note_livraison smallint,
              note_restaurant numeric, commentaire text, created_at timestamptz, reponse_restaurant text,
              reponse_le timestamptz, photo_url text, plats text[])
language sql stable security definer set search_path to 'public'
as $$
  select a.id, a.prenom_affiche,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.created_at,
         a.reponse_restaurant, a.reponse_le,
         a.photo_url,
         public.plats_de_commande(a.order_id)
    from public.avis a
   where a.restaurant_id = p_restaurant_id and a.statut = 'publie'
   order by a.created_at desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;
grant execute on function public.avis_restaurant(uuid, integer, integer) to anon, authenticated;

-- avis_du_plat : les avis publiés des commandes qui CONTIENNENT ce plat.
create or replace function public.avis_du_plat(p_product_id uuid, p_limite integer default 20, p_decalage integer default 0)
returns table(id uuid, prenom text, note_cuisine smallint, note_preparation smallint, note_livraison smallint,
              note_restaurant numeric, commentaire text, created_at timestamptz, reponse_restaurant text,
              reponse_le timestamptz, photo_url text, plats text[])
language sql stable security definer set search_path to 'public'
as $$
  select a.id, a.prenom_affiche,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.created_at,
         a.reponse_restaurant, a.reponse_le,
         a.photo_url,
         public.plats_de_commande(a.order_id)
    from public.avis a
   where a.statut = 'publie'
     and exists (select 1 from public.order_items oi
                  where oi.order_id = a.order_id and oi.product_id = p_product_id)
   order by (a.photo_url is not null) desc, a.created_at desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;
revoke all on function public.avis_du_plat(uuid, integer, integer) from public;
grant execute on function public.avis_du_plat(uuid, integer, integer) to anon, authenticated;
