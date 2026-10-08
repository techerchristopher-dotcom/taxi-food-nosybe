-- 1. `facebook_page_token` rejoint la liste blanche de deposer-secret (jeton de la Page
--    Facebook, posé depuis le poste par scripts/poser-jeton-facebook.sh, jamais affiché).
-- 2. L'avis d'Alain (TF-332, La Cabane, 4,5) part aussi sur Facebook : décision du porteur
--    du projet, malgré sa remarque sur l'assaisonnement.
create or replace function public.poser_secret_exploitation(p_nom text, p_valeur text)
returns text
language plpgsql security definer set search_path to ''
as $function$
declare v_id uuid;
begin
  if p_nom not in ('asc_private_key', 'asc_issuer_id', 'asc_key_id', 'asc_vendor_number',
                   'umami_api_key_vitrine', 'umami_api_key_app', 'anthropic_api_key',
                   'facebook_page_token') then
    raise exception 'secret_non_autorise';
  end if;
  if p_valeur is null or length(p_valeur) < 8 then
    raise exception 'valeur_invalide';
  end if;
  select id into v_id from vault.secrets where name = p_nom;
  if v_id is null then
    perform vault.create_secret(p_valeur, p_nom, 'pose depuis le poste par deposer-secret');
    return 'cree';
  end if;
  perform vault.update_secret(v_id, p_valeur, p_nom);
  return 'remplace';
end $function$;

select public.planifier_publication_avis('56e18168-159d-4252-996d-39e614d81849');
