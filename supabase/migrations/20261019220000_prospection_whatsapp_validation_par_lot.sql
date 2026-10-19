-- Industrialisation (2026-10-19) : une fiche ne reçoit un WhatsApp automatique que si
-- Christopher l'a VALIDÉE (liste de 10 montrée, puis « go »). La validation vit en base,
-- pas dans le texte de la tâche programmée : une nouvelle liste = un UPDATE, rien d'autre.
alter table public.prospects_restaurant
  add column if not exists whatsapp_valide_le timestamptz,
  add column if not exists whatsapp_lot int;
comment on column public.prospects_restaurant.whatsapp_valide_le is
  'Validé par le porteur du projet pour la prospection WhatsApp automatique (lot whatsapp_lot). Null = jamais d''envoi automatique.';

-- Lot 1, validé le 19/10 au soir.
update public.prospects_restaurant set whatsapp_valide_le = '2026-10-19 18:20:00+00', whatsapp_lot = 1
 where slug in ('karibo-restaurant','hotel-restaurant-blue-velvet','hotel-ambatoloaka','nosy-tagada','zeburger',
                'casa-rhum','le-papillon','pizza-eden','hotel-chez-pat','hotel-la-bombonera');

-- La file de la compétence : les fiches validées seulement (relances d'abord, puis par lot).
create or replace function public.prospects_whatsapp_valides(p_limite int default 3)
returns table (prospect_id uuid, nom text, slug text, lot int, numero text, etape text, texte text)
language sql stable security definer set search_path = public as $$
  with s as (
    select p.id, p.nom, p.slug, p.whatsapp_lot, p.whatsapp_valide_le, e.numero_wa, e.etape
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
     order by numero_wa, whatsapp_valide_le)
  select id, nom, slug, whatsapp_lot, numero_wa, etape, public.texte_whatsapp_prospect(id, etape)
    from d
   order by (etape = 'whatsapp_relance') desc, whatsapp_lot, nom
   limit greatest(0, least(p_limite, 10))
$$;
revoke all on function public.prospects_whatsapp_valides(int) from public, anon, authenticated;

do $$ begin
  if (select count(*) from public.prospects_restaurant where whatsapp_lot = 1) <> 10 then
    raise exception 'lot 1 : attendu 10 fiches'; end if;
end $$;
