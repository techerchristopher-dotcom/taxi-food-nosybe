-- Signer un avis d'un PSEUDO plutôt que de son prénom (2026-10-07).
--
-- Demande du porteur du projet : un bon client (« Sulli ») dont le prénom apparaît sur tous
-- les avis « sonne faux » et pourrait avoir honte de commander autant. Le client choisit :
-- son prénom (comportement actuel, `prenom_affiche(full_name)`) ou un pseudo.
--
-- `deposer_avis` reçoit un 10ᵉ paramètre FACULTATIF `p_pseudo`. Sans lui (app installée),
-- rien ne change. Le pseudo est nettoyé : espaces resserrés, caractères de contrôle et
-- chevrons retirés, 2 à 20 caractères, sinon `avis:pseudo_invalide`. Il est rangé dans la
-- même colonne publique `avis.prenom_affiche` — l'identité réelle reste dans `user_id`,
-- visible du seul admin.
--
-- Signature changée → on SUPPRIME l'ancienne version et on recrée (une surcharge créerait
-- l'ambiguïté PostgREST PGRST203). Le corps est repris de la base et patché par ancres.

create or replace function public.nettoyer_pseudo(p text)
returns text language plpgsql immutable set search_path to '' as $$
declare v text;
begin
  if p is null then return null; end if;
  v := regexp_replace(p, '[[:cntrl:]<>]', '', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  if v = '' then return null; end if;
  if length(v) < 2 or length(v) > 20 then
    raise exception 'avis:pseudo_invalide' using errcode = '22023';
  end if;
  return v;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.deposer_avis(uuid,integer,integer,integer,text,boolean,text,text,text)'::regprocedure);
  v_sig_avant constant text := 'p_message_prive text DEFAULT NULL::text)';
  v_sig_apres constant text := 'p_message_prive text DEFAULT NULL::text, p_pseudo text DEFAULT NULL::text)';
  v_nom_avant constant text := 'public.prenom_affiche(v_nom)';
  v_nom_apres constant text := 'coalesce(public.nettoyer_pseudo(p_pseudo), public.prenom_affiche(v_nom))';
begin
  if position(v_sig_avant in v_def) = 0 or position(v_nom_avant in v_def) = 0 then
    raise exception 'deposer_avis : ancres introuvables, patch refuse';
  end if;
  v_def := replace(v_def, v_sig_avant, v_sig_apres);
  v_def := replace(v_def, v_nom_avant, v_nom_apres);
  drop function public.deposer_avis(uuid,integer,integer,integer,text,boolean,text,text,text);
  execute v_def;
end $$;

revoke all on function public.deposer_avis(uuid,integer,integer,integer,text,boolean,text,text,text,text) from public, anon;
grant execute on function public.deposer_avis(uuid,integer,integer,integer,text,boolean,text,text,text,text) to authenticated;
