-- Priorité d'un lot (20/10 : « liste 5 en priorité ») : la file sert d'abord les relances,
-- puis les fiches à priorité la plus haute, puis lot par lot. Lots 2 à 6 validés le 20/10
-- (lots 2-5 par UPDATE en séance, consignés dans la compétence prospection-restaurants-taxi-food).
alter table public.prospects_restaurant add column if not exists whatsapp_priorite int not null default 0;
update public.prospects_restaurant set whatsapp_priorite = 10 where whatsapp_lot = 5;

create or replace function public.prospects_whatsapp_valides(p_limite int default 3)
returns table (prospect_id uuid, nom text, slug text, lot int, numero text, etape text, texte text)
language sql stable security definer set search_path = public as $$
  with s as (
    select p.id, p.nom, p.slug, p.whatsapp_lot, p.whatsapp_priorite, p.whatsapp_valide_le, e.numero_wa, e.etape
      from public.prospects_restaurant p
      cross join lateral public.prospect_restaurant_etape(p) e
     where p.whatsapp_valide_le is not null
       and e.etape in ('whatsapp_1','whatsapp_relance') and e.a_faire_le <= now() and e.numero_wa is not null),
  d as (
    select distinct on (numero_wa) * from s
     where not exists (
       select 1 from public.prospect_restaurant_actions a join public.prospects_restaurant q on q.id = a.prospect_id
        where a.canal = 'whatsapp' and a.fait_le > now() - interval '30 days' and q.id <> s.id
          and coalesce(public.numero_whatsapp(q.telephone), public.numero_whatsapp(q.telephone_2)) = s.numero_wa)
     order by numero_wa, whatsapp_priorite desc, whatsapp_valide_le)
  select id, nom, slug, whatsapp_lot, numero_wa, etape, public.texte_whatsapp_prospect(id, etape)
    from d
   order by (etape = 'whatsapp_relance') desc, whatsapp_priorite desc, whatsapp_lot, nom
   limit greatest(0, least(p_limite, 10))
$$;
revoke all on function public.prospects_whatsapp_valides(int) from public, anon, authenticated;

update public.prospects_restaurant set whatsapp_valide_le = now(), whatsapp_lot = 6
 where slug in ('la-sirene-22','le-cafe-des-sports','les-boucaniers','pirates-tavern-nosy-be','puro-restaurant',
                'quai-13-48','raj-samossa','coucher-du-soleil','hotel-residence-sarimanok','hotel-chez-senga')
   and whatsapp_valide_le is null;
