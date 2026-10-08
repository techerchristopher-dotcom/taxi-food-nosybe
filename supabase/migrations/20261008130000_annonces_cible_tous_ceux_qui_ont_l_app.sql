-- Les annonces « tous les clients » touchent TOUT LE MONDE (décision du porteur du projet,
-- 2026-10-08).
--
-- Constat du jour : 30 comptes ont l'app (41 jetons), 7 seulement recevaient les annonces.
-- La cible « clients » exigeait `user_roles.role = 'client' AND status = 'active'`, or
-- `requestRole('client')` n'est appelé que depuis l'écran de sélection de rôle, que seul un
-- compte restaurant + livreur voit : un client ordinaire n'obtient jamais ce rôle. Dernière
-- ligne client créée le 22/09. 17 vrais clients (Abbas, Alain Pignéguy, Opaline, Fridah…)
-- n'ont rien reçu ce matin.
--
-- Nouvelle règle, choisie entre trois : QUICONQUE A L'APP est un client — restaurateurs et
-- livreurs compris. Le rôle `client` ne compte plus pour les annonces.
--   - push  : tous les jetons (côté fonction Edge `envoyer-annonce`, même date) ;
--   - e-mail : toute adresse valide non désinscrite, sans exclure les comptes pros,
--              pour la même raison.
-- `est_client_annoncable` est gardée (deux appelants) mais ne regarde plus que l'existence
-- du profil.

create or replace function public.est_client_annoncable(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles p where p.id = p_user);
$$;

create or replace function public.annonces_cibles_email(p_cible text, p_auteur uuid)
returns table(user_id uuid, email text)
language sql stable security definer set search_path to 'public' as $$
  select p.id, btrim(p.email)
    from public.profiles p
   where coalesce(btrim(p.email), '') <> ''
     and p.email like '%@%.%'
     and case
           when p_cible = 'moi' then p.id = p_auteur
           when p_cible like 'restaurant:%' then exists (
                  select 1 from public.restaurant_interest i
                   where i.user_id = p.id and i.kind = 'alerte'
                     and i.restaurant_id = substring(p_cible from 12)::uuid)
           else not exists (
                  select 1 from public.preferences_annonces pa
                   where pa.user_id = p.id and pa.annonces_email = false)
         end
   order by 2;
$$;
