-- Annonce du porte-monnaie (2026-10-07).
--
-- 1. Une annonce peut ouvrir la page « /porte-monnaie » (explication + solde), en plus de
--    l'accueil et d'une fiche restaurant. Le bouton de l'e-mail suit la même route sur le web.
-- 2. Seconde porte pour `envoyer-annonce` : la BASE, avec un secret du Vault
--    (`annonce_hook_secret`, généré ici, que personne ne voit). Elle permet d'envoyer une
--    annonce depuis une session d'exploitation (MCP) sans session admin humaine.
--    L'annonce reste ÉCRITE par `admin_creer_annonce` sous une identité admin (garde-fous
--    de longueur, de cible, de doublon 24 h) ; la base ne fait que demander l'envoi.
--    `envoyer_annonce_depuis_la_base()` n'est accordée à PERSONNE (ni anon, ni
--    authenticated, ni service_role) : seul le propriétaire (connexion d'exploitation)
--    peut l'appeler.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'annonce_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                                'annonce_hook_secret',
                                'appel base -> fonction envoyer-annonce (seconde porte)');
  end if;
end $$;

create or replace function public.annonce_hook_secret()
returns text language sql security definer set search_path to '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'annonce_hook_secret';
$$;
revoke all on function public.annonce_hook_secret() from public, anon, authenticated;
grant execute on function public.annonce_hook_secret() to service_role;

create or replace function public.envoyer_annonce_depuis_la_base(p_annonce_id uuid)
returns bigint language plpgsql security definer set search_path to '' as $$
declare v_secret text; v_req bigint;
begin
  if not exists (select 1 from public.annonces where id = p_annonce_id and statut = 'preparee') then
    raise exception 'annonce:introuvable_ou_deja_envoyee';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'annonce_hook_secret';
  if v_secret is null then raise exception 'annonce:secret_absent'; end if;
  select net.http_post(
    url     := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/envoyer-annonce',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body    := jsonb_build_object('annonce_id', p_annonce_id),
    timeout_milliseconds := 120000
  ) into v_req;
  return v_req;
end $$;
revoke all on function public.envoyer_annonce_depuis_la_base(uuid) from public, anon, authenticated, service_role;

-- Route « /porte-monnaie » autorisée pour une annonce.
do $$
declare
  v_def text := pg_get_functiondef('public.admin_creer_annonce(text,text,text,text,text)'::regprocedure);
  v_avant constant text := $q$v_route <> '/' and v_route !~ '^/restaurant/[0-9a-f-]{36}$'$q$;
  v_apres constant text := $q$v_route <> '/' and v_route <> '/porte-monnaie' and v_route !~ '^/restaurant/[0-9a-f-]{36}$'$q$;
begin
  if position('/porte-monnaie' in v_def) > 0 then return; end if;
  if position(v_avant in v_def) = 0 then
    raise exception 'admin_creer_annonce : motif de route introuvable, patch refuse';
  end if;
  execute replace(v_def, v_avant, v_apres);
end $$;

alter table public.annonces drop constraint if exists annonces_route_check;
alter table public.annonces add constraint annonces_route_check
  check (route is null or route = '/' or route = '/porte-monnaie' or route ~ '^/restaurant/[0-9a-f-]{36}$');
