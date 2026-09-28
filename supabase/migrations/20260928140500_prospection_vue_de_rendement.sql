-- Pourquoi : « un code par établissement ne sert à rien si personne ne
-- regarde combien de fois il a servi » (stratégie § 5, dernière ligne). Sans
-- cette vue, 439 codes créés n'apprendraient rien — c'est elle qui dira, dans
-- trois mois, quels hôtes envoient vraiment des clients, et donc à qui
-- proposer une commission le jour où on décide d'en donner une (stratégie § 7).
--
-- Une ligne par CODE, pas par fiche : le code est déjà posé sur toutes les
-- fiches d'un même groupe (`admin_prospect_creer_code`), les rejoindre sans
-- grouper dupliquerait chaque utilisation autant de fois qu'il y a de logements.
create or replace view public.prospects_rendement
with (security_invoker = true)
as
select
  pc.id as code_id,
  pc.code,
  -- Représentatif du groupe : le nom qu'on a donné au code à sa création.
  right(pc.description, length(pc.description) - length('Hébergement : ')) as adresse,
  pc.actif,
  pc.expire_le,
  pc.max_utilisations,
  count(distinct pr.id) as utilisations,
  coalesce(sum(o.total), 0) as montant_livre,
  max(o.created_at) as derniere_commande_le
from public.promo_codes pc
join public.prospects_hebergement p on p.code_promo_id = pc.id
left join public.promo_redemptions pr on pr.code_id = pc.id
left join public.orders o on o.id = pr.order_id and o.status = 'livree'
where pc.description like 'Hébergement : %'
group by pc.id, pc.code, pc.description, pc.actif, pc.expire_le, pc.max_utilisations;

comment on view public.prospects_rendement is
  'Un code de prospection hébergement = une ligne : combien il a vraiment servi, et combien ça a livré. Voir admin_prospect_creer_code.';

grant select on public.prospects_rendement to anon, authenticated;
