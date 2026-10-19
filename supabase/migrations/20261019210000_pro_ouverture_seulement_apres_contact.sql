-- Une ouverture de /pro/<slug> ne compte (et ne prévient Telegram) que si un message a déjà
-- été envoyé au restaurant : avant, seul Taxi Food a le lien (constaté le 19/10 : deux
-- ouvertures du porteur du projet comptées comme celles des restaurants, supprimées).
create or replace function public.pro_compter_ouverture(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nom text; v_n int; v_contact timestamptz;
begin
  select id, nom into v_id, v_nom from public.prospects_restaurant where slug = p_slug;
  if v_id is null then return; end if;
  select min(fait_le) into v_contact from public.prospect_restaurant_actions
   where prospect_id = v_id and sens = 'sortant';
  if v_contact is null then return; end if;
  if exists (select 1 from public.prospect_restaurant_ouvertures
              where prospect_id = v_id and quand > now() - interval '30 minutes') then return; end if;
  select count(*) into v_n from public.prospect_restaurant_ouvertures where prospect_id = v_id;
  insert into public.prospect_restaurant_ouvertures (prospect_id) values (v_id);
  if v_n = 0 then
    perform public.telegram_admin_envoyer('👀 ' || public.nom_affiche(v_nom) || ' vient d''ouvrir sa page Taxi Food. Bon moment pour l''appeler.');
  end if;
end $$;
revoke all on function public.pro_compter_ouverture(text) from public;
grant execute on function public.pro_compter_ouverture(text) to anon, authenticated;

delete from public.prospect_restaurant_ouvertures
 where quand < '2026-10-19 18:24:00+00';
