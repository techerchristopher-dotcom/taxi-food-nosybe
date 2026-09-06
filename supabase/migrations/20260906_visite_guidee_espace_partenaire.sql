-- VISITE GUIDEE DE L'ESPACE PARTENAIRE — la memoire du « deja vue »
--
-- Pourquoi en base et pas en AsyncStorage : la preference doit suivre la
-- PERSONNE, pas l'appareil. Un restaurateur qui change de telephone ou qui
-- reinstalle l'app se reprendrait la visite en plein service — precisement ce
-- qu'il ne faut pas. AsyncStorage est par appareil et disparait a la
-- reinstallation ; la colonne, elle, suit le compte.
--
-- NULL = jamais vue. C'est ce que valent tous les comptes existants apres cette
-- migration : le premier restaurateur deja connecte aura donc la visite a sa
-- prochaine entree dans l'espace pro, ce qui est l'effet recherche.

alter table public.profiles
  add column if not exists visite_pro_vue_le timestamptz;

comment on column public.profiles.visite_pro_vue_le is
  'Quand la visite guidee de l''espace partenaire a ete vue. NULL = jamais vue : elle s''ouvre a la prochaine entree dans l''espace pro.';

-- L'app n'ecrit la colonne QUE par cette fonction. La table porte deja une
-- policy `profiles_update_own` qui laisserait techniquement passer un UPDATE
-- direct depuis le client ; on ne s'en sert pas. La fonction decide seule de la
-- valeur (`now()`, jamais une date fournie par l'appelant) et n'agit que sur
-- `auth.uid()` — elle n'ecrit donc jamais pour autrui, SECURITY DEFINER est sur.
--
-- Deux sens, tous les deux utilises par l'ecran :
--   p_vue = true   fin de visite, ou fermeture en cours de route ;
--   p_vue = false  la case « ne plus afficher » a ete DECOCHEE pendant une
--                  rediffusion : on remet le compte a l'etat « jamais vue ».
--
-- ⚠️ Une seule signature, sans valeur par defaut : deux surcharges d'une meme
-- RPC font repondre PostgREST `PGRST203` et cassent l'appel (piege deja paye
-- sur `create_order` et `register_push_token`).
create or replace function public.marquer_visite_pro_vue(p_vue boolean)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_quand timestamptz;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  update public.profiles
     set visite_pro_vue_le = case when p_vue then now() else null end
   where id = v_uid
  returning visite_pro_vue_le into v_quand;

  return v_quand;
end;
$$;
