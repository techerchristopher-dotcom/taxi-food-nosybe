-- ALERTE A CHAQUE NOUVELLE INSCRIPTION.
--
-- Objectif du porteur du projet : etre prevenu des qu'un compte est cree —
-- client ou restaurateur — pour prendre contact personnellement. Sur un service
-- qui demarre, le premier message humain vaut plus que n'importe quelle
-- fonctionnalite.
--
-- ⚠️ Le trigger tire APRES celui des invitations (`on_auth_user_invitation`),
-- grace a l'ordre alphabetique des noms de triggers sur une meme table :
-- « on_auth_user_invitation » < « on_auth_user_signup_alerte ». C'est ce qui
-- permet a l'alerte de dire « restaurateur de La Cabane » plutot que « client »
-- pour quelqu'un qui vient d'etre rattache. Renommer l'un des deux casserait
-- silencieusement cette information.
--
-- ⚠️ Le telephone n'est presque jamais connu a l'inscription : il n'est saisi
-- qu'a la premiere commande, dans l'adresse de livraison. On l'envoie quand il
-- existe, sans quoi on attendrait une donnee qui n'arrive qu'apres.

create or replace function public.alerter_nouvelle_inscription()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text; v_sec text; v_resto text; v_role text; v_tel text; v_nom text;
  v_fournisseur text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'n8n_inscription_url';
  if v_url is null then
    -- Inerte tant que le webhook n'est pas configure. Une inscription ne doit
    -- JAMAIS echouer a cause d'une alerte.
    return new;
  end if;
  select decrypted_secret into v_sec from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  select r.name into v_resto
    from public.restaurant_staff rs join public.restaurants r on r.id = rs.restaurant_id
   where rs.user_id = new.id limit 1;

  select string_agg(distinct ur.role::text, ', ') into v_role
    from public.user_roles ur where ur.user_id = new.id and ur.status = 'active';

  select p.full_name, p.phone into v_nom, v_tel
    from public.profiles p where p.id = new.id;

  select i.provider into v_fournisseur
    from auth.identities i where i.user_id = new.id limit 1;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'x-taxifood-secret', coalesce(v_sec,'')),
    body    := jsonb_build_object(
                 'email',        new.email,
                 'nom',          coalesce(v_nom, new.raw_user_meta_data->>'full_name',
                                          new.raw_user_meta_data->>'name'),
                 'telephone',    coalesce(v_tel, new.phone),
                 'fournisseur',  coalesce(v_fournisseur, 'email'),
                 'type',         case when v_resto is not null then 'restaurateur' else 'client' end,
                 'restaurant',   v_resto,
                 'roles',        coalesce(v_role, 'client'),
                 'inscrit_le',   new.created_at),
    timeout_milliseconds := 5000);
  return new;
end $$;

drop trigger if exists on_auth_user_signup_alerte on auth.users;
create trigger on_auth_user_signup_alerte
  after insert on auth.users
  for each row execute function public.alerter_nouvelle_inscription();
