-- Pourquoi : « flyer générique, code écrit à la main » (brief § 1.6, stratégie
-- § 5) — un code se dicte au téléphone et se recopie d'un papier, donc jamais
-- de I/1/O/0, 12 caractères au plus. Et « un code par adresse, jamais par
-- logement » (CLAUDE.md, stratégie § 5) : Villa Sophie a 8 annonces, une seule
-- maison — le code se pose sur TOUTES les fiches du groupe en une fois, sinon
-- la 9ᵉ chambre découverte plus tard tomberait sur un code différent.
create or replace function public.admin_prospect_creer_code(
  p_prospect_id uuid,
  p_valeur      integer default 50,
  p_jours       integer default 90,
  p_max         integer default null
)
returns table (code_id uuid, code text, adresse text, fiches integer, max_utilisations integer, expire_le timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prospect     public.prospects_hebergement;
  v_group_ids    uuid[];
  v_group_n      integer;
  v_couchages    integer;
  v_nom_source   text;
  v_base         text;
  v_candidat     text;
  v_suffixe      integer := 1;
  v_max          integer;
  v_expire       timestamptz;
  v_code         public.promo_codes;
  v_deja_actif   text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  if p_valeur is null or p_valeur < 1 or p_valeur > 100 then
    raise exception 'Valeur de la remise entre 1 et 100 (pourcentage sur la livraison)';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 365 then
    raise exception 'Validite entre 1 et 365 jours';
  end if;

  select * into v_prospect from public.prospects_hebergement where id = p_prospect_id;
  if v_prospect.id is null then
    raise exception 'Prospect introuvable';
  end if;

  -- Le groupe : même établissement, sinon même hôte Airbnb, sinon la fiche seule.
  if v_prospect.etablissement is not null then
    select array_agg(h.id), coalesce(sum(h.capacite), 0)
      into v_group_ids, v_couchages
      from public.prospects_hebergement h
     where h.etablissement = v_prospect.etablissement;
  elsif v_prospect.airbnb_host_id is not null then
    select array_agg(h.id), coalesce(sum(h.capacite), 0)
      into v_group_ids, v_couchages
      from public.prospects_hebergement h
     where h.airbnb_host_id = v_prospect.airbnb_host_id;
  else
    v_group_ids := array[v_prospect.id];
    v_couchages := coalesce(v_prospect.capacite, 0);
  end if;
  v_group_n := coalesce(array_length(v_group_ids, 1), 0);

  -- Refuse un second code tant qu'un premier est encore actif sur ce groupe :
  -- une adresse ne porte jamais deux codes en même temps.
  select pc.code into v_deja_actif
    from public.prospects_hebergement h
    join public.promo_codes pc on pc.id = h.code_promo_id
   where h.id = any(v_group_ids)
     and pc.actif and (pc.expire_le is null or pc.expire_le > now())
   limit 1;
  if v_deja_actif is not null then
    raise exception 'Cette adresse porte déjà un code actif : %', v_deja_actif;
  end if;

  -- Le nom du code : l'établissement (le groupe), sinon le nom de la fiche
  -- elle-même. Majuscules, sans accent, lettres et chiffres seulement, puis
  -- les caractères ambigus retirés — un code se dicte au téléphone.
  v_nom_source := coalesce(v_prospect.etablissement, v_prospect.nom);
  v_base := upper(regexp_replace(public.texte_sans_accents(v_nom_source), '[^a-z0-9]', '', 'g'));
  v_base := regexp_replace(v_base, '[I1O0]', '', 'g');
  v_base := left(v_base, 12);
  if v_base = '' then
    v_base := 'HEBERGEMENT';
  end if;

  v_max := coalesce(p_max, greatest(v_couchages, 0) * 4);
  if v_max <= 0 then
    -- Aucun couchage renseigné sur le groupe : un plafond raisonnable plutôt
    -- qu'un code sans limite (stratégie § 5 : « un code sans plafond finira
    -- dans un groupe Facebook »).
    v_max := 8;
  end if;
  v_expire := now() + make_interval(days => p_jours);

  loop
    v_candidat := case when v_suffixe = 1 then v_base else left(v_base, 12 - length(v_suffixe::text)) || v_suffixe::text end;
    begin
      insert into public.promo_codes
        (code, type_remise, valeur, porte_sur, actif, commence_le, expire_le,
         max_utilisations, description, beneficiaire_id, restaurant_id,
         inclut_emballage, exclut_boissons, pris_en_charge_par)
      values
        (v_candidat, 'pourcentage', p_valeur, 'livraison', true, now(), v_expire,
         v_max, 'Hébergement : ' || v_nom_source, null, null,
         false, false, 'taxi_food')
      returning * into v_code;
      exit;
    exception when unique_violation then
      v_code := null;
      v_suffixe := v_suffixe + 1;
      if v_suffixe > 99 then
        raise exception 'Aucun nom de code libre pour %', v_base;
      end if;
    end;
  end loop;

  update public.prospects_hebergement
     set code_promo_id = v_code.id, updated_at = now()
   where id = any(v_group_ids);

  code_id := v_code.id;
  code := v_code.code;
  adresse := v_nom_source;
  fiches := v_group_n;
  max_utilisations := v_code.max_utilisations;
  expire_le := v_code.expire_le;
  return next;
end;
$$;

revoke all on function public.admin_prospect_creer_code(uuid, integer, integer, integer) from public;
grant execute on function public.admin_prospect_creer_code(uuid, integer, integer, integer) to authenticated;
