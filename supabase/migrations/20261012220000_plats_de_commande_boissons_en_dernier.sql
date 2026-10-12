-- Les plats d'une commande, plats d'abord, boissons ensuite (2026-10-12) : un post d'avis
-- disait « Jenn a commandé « Caprice Grenadine 33 cl », « Toscane » » (ordre alphabétique).
-- Décision du porteur du projet : garder les deux, la boisson après le plat.
create or replace function public.plats_de_commande(p_order_id uuid)
returns text[]
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(array_agg(nom order by boisson, nom), '{}')
    from (select oi.product_name_snapshot nom,
                 bool_and(coalesce(c.est_boisson, false)) boisson
            from public.order_items oi
            left join public.products p on p.id = oi.product_id
            left join public.categories c on c.id = p.category_id
           where oi.order_id = p_order_id
           group by oi.product_name_snapshot) t;
$$;

-- Le post de Jenn (TF-392), encore au calendrier : texte recalculé et renvoyé (un seul envoi).
select public.planifier_publication_avis(a.id)
  from public.avis a join public.orders o on o.id = a.order_id
 where o.order_number = 'TF-392';
