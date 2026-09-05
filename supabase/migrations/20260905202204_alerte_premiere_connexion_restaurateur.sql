-- ALERTE A LA PREMIERE CONNEXION D'UN RESTAURATEUR.
--
-- Le trou : depuis qu'on cree les comptes partenaires nous-memes, l'alerte
-- d'inscription (`on_auth_user_signup_alerte`) tire au moment ou NOUS creons le
-- compte — pas au moment ou le patron s'en sert. On envoie donc ses
-- identifiants, et plus rien : impossible de savoir s'il a reussi a entrer,
-- s'il a perdu le message, ou s'il n'a jamais essaye. Pendant ce temps on
-- n'ose pas le relancer, et on ne peut pas enchainer sur « maintenant,
-- installez Telegram ».
--
-- Le signal : `auth.users.last_sign_in_at` passe de NULL a une date exactement
-- une fois dans la vie d'un compte, a la premiere connexion reussie. GoTrue le
-- met a jour lui-meme, il n'y a rien a instrumenter cote application.
--
-- ⚠️ RESERVE AU PERSONNEL DE RESTAURANT, et c'est delibere. Pour un client
-- ordinaire, l'inscription et la premiere connexion sont le meme instant :
-- alerter sur les deux doublerait chaque client sans rien apprendre. Le
-- decalage n'existe que pour les comptes qu'on a crees a l'avance — donc les
-- restaurateurs.
--
-- ⚠️ INERTE SANS SECRET, comme les autres. Une connexion ne doit JAMAIS
-- echouer a cause d'une alerte : si le webhook n'est pas configure, on sort
-- sans rien faire. net.http_post met par ailleurs la requete en file et rend la
-- main tout de suite.

create or replace function public.alerter_premiere_connexion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text; v_sec text; v_resto text; v_nom text; v_tel text; v_fournisseur text;
begin
  -- Le seul instant qui nous interesse : NULL -> une date.
  if new.last_sign_in_at is null or old.last_sign_in_at is not null then
    return new;
  end if;

  select r.name into v_resto
    from public.restaurant_staff rs
    join public.restaurants r on r.id = rs.restaurant_id
   where rs.user_id = new.id
   limit 1;

  -- Pas un restaurateur : son inscription a deja ete signalee au meme moment.
  if v_resto is null then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'n8n_inscription_url';
  if v_url is null then
    raise warning 'n8n_inscription_url absent du Vault : premiere connexion non signalee';
    return new;
  end if;
  select decrypted_secret into v_sec from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  select p.full_name, p.phone into v_nom, v_tel from public.profiles p where p.id = new.id;

  -- Par quel moyen il est entre : « email » s'il a utilise le mot de passe
  -- qu'on lui a donne, « google » / « facebook » s'il a prefere son compte
  -- existant. Utile a savoir avant de l'avoir au telephone.
  select i.provider into v_fournisseur
    from auth.identities i
   where i.user_id = new.id
   order by i.last_sign_in_at desc nulls last
   limit 1;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'x-taxifood-secret', coalesce(v_sec,'')),
    body    := jsonb_build_object(
                 'evenement',      'premiere_connexion',
                 'type',           'restaurateur',
                 'restaurant',     v_resto,
                 'email',          new.email,
                 'nom',            v_nom,
                 'telephone',      v_tel,
                 'fournisseur',    coalesce(v_fournisseur, 'email'),
                 'compte_cree_le', new.created_at,
                 'connecte_le',    new.last_sign_in_at,
                 -- Combien de temps il a mis. Un delai qui s'allonge est le
                 -- signe qu'il faut rappeler, pas attendre.
                 'delai_heures',   round(extract(epoch from (new.last_sign_in_at - new.created_at))/3600.0, 1)),
    timeout_milliseconds := 5000);

  return new;
end $$;

drop trigger if exists on_auth_user_first_signin on auth.users;
create trigger on_auth_user_first_signin
  after update of last_sign_in_at on auth.users
  for each row execute function public.alerter_premiere_connexion();
