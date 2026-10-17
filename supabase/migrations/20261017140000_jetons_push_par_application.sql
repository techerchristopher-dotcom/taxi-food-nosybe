-- Jetons push rangés par APPLICATION (2026-10-17) — cahier des charges app livreur § 6.1.
--
-- Jusqu'ici un jeton n'était rattaché qu'à un COMPTE. Avec deux apps (Taxi Food et
-- Taxi Food Livreur) sur le même téléphone, le porteur du projet aurait reçu les
-- « Course disponible » dans l'app client, et ses suivis de commande dans l'app livreur.
--
-- `push_tokens.app` ('client' par défaut : toutes les apps déjà installées le sont).
-- `register_push_token` prend un 4e paramètre facultatif `p_app` — l'ancienne signature
-- à 3 paramètres est SUPPRIMÉE avant (sinon surcharge → PGRST203 et plus aucun jeton
-- enregistré). Les apps installées appellent avec 3 clés nommées : elles résolvent sur la
-- nouvelle fonction et restent 'client'.
--
-- Le tri se fait dans les fonctions Edge (notify-order, notifier-message, envoyer-annonce,
-- relancer-orange-money) : client et restaurant → jetons 'client' ; livreur → jetons
-- 'livreur' s'il en a, sinon ses jetons 'client' (transition : livreur sans l'app livreur).

alter table public.push_tokens
  add column if not exists app text not null default 'client';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_tokens_app_check') then
    alter table public.push_tokens add constraint push_tokens_app_check check (app in ('client', 'livreur'));
  end if;
end $$;

drop function if exists public.register_push_token(text, text, text);

create or replace function public.register_push_token(
  p_token text,
  p_platform text,
  p_language text default 'fr',
  p_app text default 'client'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_language text := coalesce(nullif(trim(p_language), ''), 'fr');
  v_app text := coalesce(nullif(trim(p_app), ''), 'client');
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'jeton vide';
  end if;
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'plateforme inconnue: %', p_platform;
  end if;
  if v_language not in ('fr', 'en', 'it') then
    v_language := 'fr';
  end if;
  if v_app not in ('client', 'livreur') then
    raise exception 'application inconnue: %', v_app;
  end if;

  insert into public.push_tokens (token, user_id, platform, language, app)
  values (trim(p_token), auth.uid(), p_platform, v_language, v_app)
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = excluded.platform,
        language = excluded.language,
        app = excluded.app,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;
