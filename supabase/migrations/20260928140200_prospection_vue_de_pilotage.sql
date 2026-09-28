-- Pourquoi : l'écran ne doit jamais lire `prospects_hebergement` seule — il a
-- besoin, pour chaque fiche, de ce que dit le journal (dernière action, combien
-- de tentatives par canal) ET de ce qu'il faut faire ensuite. Une vue, pas des
-- colonnes dénormalisées : rien ne peut se désynchroniser, tout se recalcule
-- à chaque lecture depuis `prospect_actions`, la seule source de vérité.
--
-- La distance reprend la formule déjà en usage pour les hôtels — plane, pas
-- géodésique, suffisante à l'échelle de l'île (voir la note de la 2ᵉ requête
-- du prompt) — mesurée contre le restaurant `visible` le plus proche.
--
-- ⚠️ `security_invoker = true`, SANS QUOI CETTE VUE FUIT TOUT LE FICHIER.
-- Par défaut une vue Postgres lit ses tables avec les droits de son PROPRIÉTAIRE
-- (ici la migration, donc un rôle qui contourne la RLS), pas avec ceux de la
-- personne qui interroge la vue. `prospects_hebergement` et `prospect_actions`
-- accordent SELECT à `anon` ET `authenticated` au niveau table (schéma exposé
-- par défaut à PostgREST) et comptent UNIQUEMENT sur leur politique RLS
-- `is_admin()` pour se fermer. Sans cette option, n'importe quel compte
-- connecté — client compris — lirait les 799 fiches (téléphones, mails)
-- via cette vue. Avec elle, la RLS s'applique avec les droits du VRAI
-- appelant, exactement comme une lecture directe de la table.
create or replace view public.prospects_pilotage
with (security_invoker = true)
as
select
  p.*,
  agg.derniere_action_le,
  agg.dernier_canal,
  agg.dernier_resultat,
  agg.nb_actions,
  agg.nb_tentatives_whatsapp,
  agg.nb_tentatives_appel,
  agg.nb_tentatives_ecrit,
  agg.flyers_total,
  agg.derniere_controle_le,
  agg.nb_actions_30j,
  km.km_restaurant,
  pa.prochain_canal,
  pa.prochaine_action,
  pa.a_faire_le,
  case
    when pa.prochaine_action is not null then
      row_number() over (
        partition by (pa.prochaine_action is not null)
        order by
          -- 1) le retard passe devant le neuf.
          (case when pa.a_faire_le is not null and pa.a_faire_le <= current_date then 0 else 1 end),
          -- 2) distance au restaurant le plus proche, par tranches (sans position : après sa tranche de priorité, jamais devant).
          (case when km.km_restaurant is null then 4
                when km.km_restaurant < 3 then 0
                when km.km_restaurant < 6 then 1
                when km.km_restaurant < 12 then 2
                else 3 end),
          -- 3) priorité.
          (case p.priorite when 'haute' then 0 when 'moyenne' then 1 when 'basse' then 2 else 3 end),
          -- 4) capacité décroissante.
          coalesce(p.capacite, -1) desc,
          -- 5) joignable autrement que par Airbnb en premier.
          (case when p.canal_contact = 'messagerie Airbnb' or p.canal_contact is null then 1 else 0 end),
          p.nom
      )
  end as rang
from public.prospects_hebergement p
left join lateral (
  select
    max(a.fait_le) as derniere_action_le,
    (select a2.canal from public.prospect_actions a2
      where a2.prospect_id = p.id order by a2.fait_le desc limit 1) as dernier_canal,
    (select a2.resultat from public.prospect_actions a2
      where a2.prospect_id = p.id order by a2.fait_le desc limit 1) as dernier_resultat,
    count(*) as nb_actions,
    count(*) filter (where a.canal = 'whatsapp') as nb_tentatives_whatsapp,
    count(*) filter (where a.canal = 'appel') as nb_tentatives_appel,
    count(*) filter (where a.canal in ('messenger', 'email')) as nb_tentatives_ecrit,
    coalesce(sum(a.flyers_deposes), 0) as flyers_total,
    max(a.fait_le) filter (where a.canal = 'controle') as derniere_controle_le,
    count(*) filter (where a.fait_le > now() - interval '30 days') as nb_actions_30j
  from public.prospect_actions a
  where a.prospect_id = p.id
) agg on true
left join lateral (
  select min(
    sqrt(
      power((p.latitude - r.latitude) * 111, 2)
      + power((p.longitude - r.longitude) * 111 * cos(radians(p.latitude)), 2)
    )
  ) as km_restaurant
  from public.restaurants r
  where r.listing_status = 'visible' and r.latitude is not null and r.longitude is not null
    and p.latitude is not null and p.longitude is not null
) km on true
left join lateral public.prospect_prochaine_action(
  p.statut, agg.dernier_canal, agg.dernier_resultat, agg.derniere_action_le,
  agg.derniere_controle_le, agg.flyers_total::integer, p.telephone, p.telephone_2,
  p.facebook_url, p.email, p.priorite, agg.nb_tentatives_whatsapp::integer,
  agg.nb_tentatives_appel::integer, agg.nb_tentatives_ecrit::integer, agg.nb_actions_30j::integer
) pa on true;

comment on view public.prospects_pilotage is
  'prospects_hebergement + ce que dit le journal (prospect_actions) + la prochaine action calculée. Rien de dénormalisé : tout se relit à chaque appel.';

-- La vue hérite de la RLS de ses deux tables sources (toutes deux admin seul,
-- grâce à security_invoker) : elle ne s'ouvre donc QUE via des politiques déjà
-- posées, sans politique propre. Mêmes bénéficiaires que la table elle-même
-- (anon + authenticated) : c'est la RLS qui ferme, pas le GRANT.
grant select on public.prospects_pilotage to anon, authenticated;

-- Le contrôle ci-dessous s'exécute sous le rôle de la migration, qui ne porte
-- pas de session admin : `security_invoker` (juste posé) le priverait donc de
-- toute ligne. On emprunte le temps du contrôle l'identité du premier compte
-- admin actif — exactement ce que fait déjà `execute_sql` pour tester une RPC
-- réservée aux admins — puis on la restaure (`reset` implicite en fin de
-- transaction de migration, `local` ne fuit pas au-delà).
do $$
declare n integer; v_admin uuid;
begin
  select user_id into v_admin from public.user_roles where role = 'admin' and status = 'active' limit 1;
  if v_admin is null then
    raise exception 'Aucun admin actif trouvé pour vérifier prospects_pilotage';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);

  select count(*) into n from public.prospects_pilotage;
  if n <> 799 then
    raise exception 'prospects_pilotage : attendu 799 lignes (autant que prospects_hebergement), trouvé %', n;
  end if;
end $$;
