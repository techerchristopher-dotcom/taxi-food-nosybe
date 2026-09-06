-- ============================================================================
-- REMBOURSEMENT : LES PORTES DE LA FONCTION EDGE `rembourser-paiement`
-- 2026-09-06
-- ============================================================================
--
-- Le socle (`20260906084514`) enregistre les demandes et met un appel HTTP en
-- file. Il manquait tout ce qui est de l'autre cote du fil : de quoi authentifier
-- l'appelant, et de quoi ECRIRE le resultat de l'appel Stripe.
--
-- ⚠️ REGLE QUI STRUCTURE TOUT CE FICHIER : LA FONCTION EDGE N'ECRIT PAS DANS
-- `payment_refunds` A MAIN LEVEE. Elle a pourtant la cle `service_role`, qui
-- passe la RLS et lui permettrait un `update` libre. On lui donne trois portes
-- etroites a la place — `enregistrer_envoi_remboursement`, `echec_envoi_
-- remboursement`, `enregistrer_verdict_remboursement` — parce que chacune porte
-- un invariant que du TypeScript ne saurait pas garantir tout seul :
--   - on n'attache jamais un SECOND `re_...` a une ligne qui en a deja un ;
--   - un echec d'ENVOI ne touche pas au statut ;
--   - un verdict ne se retracte pas.
-- C'est la meme raison qui fait vivre les regles metier de ce projet dans les
-- triggers plutot que dans le front.

-- ============================================ 1. LE SECRET PARTAGE (l'appelant)

-- Jumeau exact de `public.push_hook_secret()`. `verify_jwt = false` sur la
-- fonction Edge (l'appelant est la BASE, via pg_net, qui n'a pas de jeton
-- utilisateur) : sa seule barriere est ce secret, emis par
-- `declencher_remboursement()` en en-tete `x-hook-secret` et relu ici par la
-- fonction avec sa cle service_role.
--
-- ⚠️ LA VALEUR NE VIT PAS DANS CE FICHIER, ni dans aucun autre du depot. Elle est
-- posee une fois dans le Vault, avec une valeur tiree au sort par la base
-- elle-meme, donc que personne n'a jamais eu a choisir ni a transmettre :
--
--   select vault.create_secret(encode(gen_random_bytes(32), 'hex'),
--                              'remboursement_hook_secret',
--                              'Secret partage base <-> fonction Edge rembourser-paiement');
--
-- Tant qu'il est absent, `declencher_remboursement()` reste inerte et le dit par
-- un warning : les demandes s'empilent en `demande` et attendent
-- `relancer_remboursements_en_attente()`.
create or replace function public.remboursement_hook_secret()
returns text
language sql
security definer
set search_path to 'public', 'vault'
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'remboursement_hook_secret';
$$;

comment on function public.remboursement_hook_secret() is
  'Secret partage entre la base et la fonction Edge rembourser-paiement. Reserve a service_role : personne d''autre n''a de raison de le lire.';

revoke all on function public.remboursement_hook_secret() from public, anon, authenticated;
grant execute on function public.remboursement_hook_secret() to service_role;

-- ================================== 2. « STRIPE A ACCEPTE LA DEMANDE » (re_...)

-- Stripe repond a `POST /v1/refunds` par un objet `Refund` dont le `status` vaut
-- presque toujours `pending` : cette reponse dit « demande acceptee », JAMAIS
-- « argent arrive » (le client voit le credit sous 5 a 10 jours ouvres). La
-- ligne reste donc en `demande` — seul son `re_...` est desormais connu, et
-- c'est lui que le webhook cherchera pour rendre le verdict.
--
-- ⚠️ C'EST ICI QUE SE JOUE « UN SEUL REMBOURSEMENT ». La cle d'idempotence
-- envoyee a Stripe est purgee au bout de 24 h : elle ne protege pas d'un rejeu a
-- J+2. Ce `where provider_refund_id is null` si : une ligne qui porte deja son
-- `re_...` refuse d'en accueillir un second, et la fonction Edge en deduit
-- qu'elle est en train de rejouer un appel deja passe.
create or replace function public.enregistrer_envoi_remboursement(
  p_refund_id          uuid,
  p_provider_refund_id text,
  p_statut_stripe      text,
  p_raw_event          jsonb default null
)
returns public.payment_refunds
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_refund public.payment_refunds;
begin
  if nullif(btrim(coalesce(p_provider_refund_id, '')), '') is null then
    raise exception 'Un envoi sans identifiant de remboursement Stripe ne se trace pas';
  end if;

  update public.payment_refunds
     set provider_refund_id = p_provider_refund_id,
         raw_event          = coalesce(p_raw_event, raw_event),
         -- Le statut brut de Stripe (`pending`, `requires_action`...) sert au
         -- diagnostic : la colonne `erreur` est le seul champ texte libre de la
         -- ligne, et une demande en vol n'a pas d'erreur a y ranger.
         erreur             = 'envoye a Stripe (' || coalesce(p_statut_stripe, 'inconnu') || ')'
   where id = p_refund_id
     and status = 'demande'
     and provider_refund_id is null
  returning * into v_refund;

  if v_refund.id is null then
    raise exception 'Remboursement % : introuvable, deja tranche, ou porte deja un identifiant Stripe',
      p_refund_id
      using errcode = 'check_violation';
  end if;
  return v_refund;
end $$;

comment on function public.enregistrer_envoi_remboursement(uuid, text, text, jsonb) is
  'Attache le re_... a une demande encore en vol. Refuse d''en attacher un second : c''est la barriere anti-double-remboursement qui survit a la purge des cles d''idempotence Stripe.';

revoke all on function public.enregistrer_envoi_remboursement(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enregistrer_envoi_remboursement(uuid, text, text, jsonb)
  to service_role;

-- ====================================== 3. « L'ENVOI N'EST PAS PARTI » (motif)

-- ⚠️ UN ECHEC D'ENVOI N'EST PAS UN ECHEC DE REMBOURSEMENT, et le confondre
-- couterait de l'argent dans les deux sens :
--   - marquer `echoue` sortirait la ligne de l'index unique partiel
--     `payment_refunds_une_demande_en_vol` ; la relance suivante creerait une
--     SECONDE demande, avec une nouvelle cle d'idempotence, donc un second
--     remboursement chez Stripe ;
--   - `echoue` veut dire « la banque a refuse le credit, le client n'a rien » :
--     ce n'est pas ce qui vient de se passer quand c'est notre appel qui n'est
--     pas parti.
-- La ligne reste donc en `demande`, avec son motif, et
-- `relancer_remboursements_en_attente()` la rejouera.
create or replace function public.echec_envoi_remboursement(
  p_refund_id uuid,
  p_erreur    text,
  p_raw_event jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_n integer;
begin
  update public.payment_refunds
     set erreur    = left(coalesce(p_erreur, 'echec inconnu'), 300),
         raw_event = coalesce(p_raw_event, raw_event)
   where id = p_refund_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

comment on function public.echec_envoi_remboursement(uuid, text, jsonb) is
  'Ecrit le motif d''un envoi rate SANS toucher au statut : la demande reste en vol et sera relancee.';

revoke all on function public.echec_envoi_remboursement(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.echec_envoi_remboursement(uuid, text, jsonb) to service_role;

-- ================================= 4. LE VERDICT ADMET `sans_objet` (migr. 090100)

-- Meme fonction que dans le socle, a un mot pres : `sans_objet` rejoint les
-- verdicts acceptables. Il decrit le seul cas ou la demande se clot sans qu'un
-- euro bouge — un PaymentIntent jamais capture, donc ANNULE chez Stripe au lieu
-- d'etre rembourse (`POST /v1/payment_intents/{id}/cancel`, gratuit).
-- `effectue_le` reste NULL : rien n'a ete rendu, il n'y a pas de date de retour.
create or replace function public.enregistrer_verdict_remboursement(
  p_refund_id          uuid,
  p_provider_refund_id text,
  p_statut             public.payment_refund_status,
  p_erreur             text  default null,
  p_raw_event          jsonb default null
)
returns public.payment_refunds
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_refund public.payment_refunds;
begin
  if p_statut not in ('effectue', 'echoue', 'sans_objet') then
    raise exception 'Verdict attendu : effectue, echoue ou sans_objet (recu : %)', p_statut;
  end if;

  update public.payment_refunds
     set status             = p_statut,
         provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id),
         erreur             = p_erreur,
         raw_event          = coalesce(p_raw_event, raw_event),
         effectue_le        = case when p_statut = 'effectue' then now() else effectue_le end
   where id = p_refund_id
  returning * into v_refund;

  if v_refund.id is null then
    raise exception 'Remboursement introuvable : %', p_refund_id;
  end if;
  return v_refund;
end $$;

revoke all on function public.enregistrer_verdict_remboursement(uuid, text, public.payment_refund_status, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enregistrer_verdict_remboursement(uuid, text, public.payment_refund_status, text, jsonb)
  to service_role;

-- =========================================== 5. LE RAPPORT VOIT LE NOUVEL ETAT

-- ⚠️ `create or replace view` interdit d'intercaler une colonne : `sans_objet`
-- va donc a la fin, comme `rembourse_par_stripe` avant elle.
-- La colonne existe pour une seule raison : sans elle, ces lignes seraient
-- comptees dans `remboursements` sans apparaitre dans aucun detail, et la
-- somme des quatre etats ne retomberait pas sur le total.
create or replace view public.rapport_remboursements as
select
  (pr.created_at at time zone 'Indian/Antananarivo')::date as jour,
  r.id   as restaurant_id,
  r.name as restaurant,
  o.status::text as statut_commande,
  count(*)                                                     as remboursements,
  count(*) filter (where pr.status = 'demande')                as en_vol,
  count(*) filter (where pr.status = 'effectue')               as effectues,
  count(*) filter (where pr.status = 'echoue')                 as echoues,
  coalesce(sum(pr.amount_ar)    filter (where pr.status = 'effectue'), 0) as rendu_ar,
  coalesce(sum(pr.amount_minor) filter (where pr.status = 'effectue'), 0) as rendu_minor,
  coalesce(sum(pr.amount_ar)    filter (where pr.status = 'demande'), 0)  as en_vol_ar,
  -- Rien a rendre : le paiement n'avait jamais ete capture, il a ete annule
  -- chez Stripe. Ni un incident, ni un euro sorti.
  count(*) filter (where pr.status = 'sans_objet')             as sans_objet
from public.payment_refunds pr
join public.orders      o on o.id = pr.order_id
join public.restaurants r on r.id = o.restaurant_id
group by 1, 2, 3, 4;

revoke all on public.rapport_remboursements from public, anon, authenticated;

comment on view public.rapport_remboursements is
  'Remboursements par jour, restaurant et statut de commande. Couvre les commandes ANNULEES, que rapport_journalier ignore par construction. '
  'echoues doit rester a zero : une ligne signifie que le client n''a pas ete rembourse et qu''il faut le faire autrement. '
  'sans_objet = paiement jamais capture, annule chez Stripe : rien n''a ete debite, rien n''est rendu.';
