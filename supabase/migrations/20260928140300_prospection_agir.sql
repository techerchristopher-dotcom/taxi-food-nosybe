-- Pourquoi : « ce qui n'est pas noté le jour même est perdu » (stratégie § 6.9)
-- — l'enregistrement d'un geste doit être UN appel, transactionnel, qui écrit
-- le journal ET fait avancer le statut ensemble. Deux protections que l'écran
-- ne doit pas pouvoir contourner par un clic malheureux : on refuse d'agir sur
-- une fiche hors_zone/exclu (le réflexe du bouton, pas un bug), et le statut
-- n'avance QUE sur les trois résultats qui en disent quelque chose.
create or replace function public.admin_prospect_agir(
  p_prospect_id   uuid,
  p_canal         text,
  p_resultat      text,
  p_note          text default null,
  p_interlocuteur text default null,
  p_flyers        integer default 0,
  p_offre_faite   text default null,
  p_sens          text default 'sortant'
)
returns setof public.prospects_pilotage
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_statut text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  if p_canal not in ('whatsapp', 'appel', 'messenger', 'email', 'visite', 'flyers', 'controle') then
    raise exception 'Canal inconnu : %', p_canal;
  end if;
  if p_resultat not in ('pas_de_reponse', 'a_rappeler', 'interesse', 'accepte', 'refus',
                        'absent', 'ferme', 'mauvais_numero', 'code_utilise', 'code_dormant') then
    raise exception 'Resultat inconnu : %', p_resultat;
  end if;
  if p_sens not in ('sortant', 'entrant') then
    raise exception 'Sens inconnu : %', p_sens;
  end if;

  select statut into v_statut from public.prospects_hebergement where id = p_prospect_id;
  if v_statut is null then
    raise exception 'Prospect introuvable';
  end if;
  -- Le geste réflexe, pas un bug : ces deux statuts existent précisément pour
  -- ne JAMAIS réapparaître dans une file de travail (brief § 4, dernière ligne).
  if v_statut in ('hors_zone', 'exclu') then
    raise exception 'Cette fiche est "%" : aucune action ne doit y être posée.', v_statut;
  end if;

  insert into public.prospect_actions
    (prospect_id, canal, sens, resultat, offre_faite, interlocuteur, flyers_deposes, note)
  values
    (p_prospect_id, p_canal, p_sens, p_resultat,
     nullif(btrim(coalesce(p_offre_faite, '')), ''),
     nullif(btrim(coalesce(p_interlocuteur, '')), ''),
     greatest(coalesce(p_flyers, 0), 0),
     nullif(btrim(coalesce(p_note, '')), ''));

  update public.prospects_hebergement
     set statut = case p_resultat
                    when 'interesse' then 'interesse'
                    when 'accepte'   then 'partenaire'
                    when 'refus'     then 'refuse'
                    else statut
                  end,
         visite_le = case when p_canal = 'visite' then current_date else visite_le end,
         updated_at = now()
   where id = p_prospect_id;

  return query select * from public.prospects_pilotage where id = p_prospect_id;
end;
$$;

revoke all on function public.admin_prospect_agir(uuid, text, text, text, text, integer, text, text) from public;
grant execute on function public.admin_prospect_agir(uuid, text, text, text, text, integer, text, text) to authenticated;
