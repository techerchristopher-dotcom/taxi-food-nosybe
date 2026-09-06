-- ============================================================================
-- REVUE D'EXPLOITATION DU REMBOURSEMENT — 2026-09-06
-- « Un restaurant refuse une commande payee a 21 h. Que se passe-t-il ? »
-- ============================================================================
--
-- La chaine construite ce matin part bien toute seule : trigger -> pg_net ->
-- `rembourser-paiement` -> Stripe -> verdict -> e-mail. Quelques secondes, sans
-- personne. Mais elle n'a AUCUNE seconde chance, et deux trous se voient des
-- qu'on se met a la place du porteur du projet un soir de service.
--
-- ⚠️ TROU 1 — LA SEULE MANIVELLE DE SECOURS NE TOURNE PAS.
--   `relancer_remboursements_en_attente()` est le rattrapage documente : si
--   l'envoi ne part pas (Stripe injoignable, Edge en erreur, pg_net qui perd la
--   requete), la demande reste en `demande` et cette fonction la rejoue. Elle
--   s'ouvre sur `if not public.is_admin() then raise`. Or `is_admin()` lit
--   `auth.uid()`, qui est NULL sur une connexion directe a la base. Verifie :
--
--     select current_user, auth.uid(), public.is_admin();
--     -> postgres | null | false
--
--   Donc le geste ecrit noir sur blanc dans `docs/PAIEMENT-STRIPE.md` et dans
--   `CLAUDE.md` — `select public.relancer_remboursements_en_attente();` depuis
--   l'editeur SQL — leve « Reserve aux administrateurs » et ne rejoue rien. Le
--   filet de securite de tout le chantier n'a jamais pu se declencher. Il ne
--   marche ni depuis l'editeur SQL, ni sous `service_role`, ni depuis un cron
--   (pg_cron n'est de toute facon pas installe sur ce projet).
--
--   On ouvre donc la porte aux appelants qui SONT deja la base : `auth.uid()`
--   NULL veut dire « connexion directe », c'est-a-dire `postgres` ou
--   `service_role`. Ce n'est pas un elargissement : la fonction n'est pas
--   accordee a `anon`, et un `authenticated` a toujours un `auth.uid()`, donc il
--   reste juge par `is_admin()`. La seule chose qui change, c'est que le
--   proprietaire de la base peut enfin utiliser son propre outil.
--
-- ⚠️ TROU 2 — PERSONNE NE PEUT REPONDRE « CE CLIENT A-T-IL ETE REMBOURSE ? ».
--   `rapport_remboursements` agrege par jour et par restaurant : elle compte des
--   remboursements, elle n'en montre aucun. Pour repondre a la question qu'un
--   client pose au telephone — « j'ai commande TF-96 hier soir, j'ai ete
--   debite » — il faut aujourd'hui ecrire a la main une jointure sur quatre
--   tables, un soir, sous pression. On pose donc la vue par LIGNE, qui part des
--   paiements ENCAISSES (pas des commandes : c'est le meme parti pris que le
--   trigger et que l'ecran admin) et dit en francais ou en est chaque euro.
--
--   Elle part des paiements et non des remboursements pour que la reponse
--   « non, aucun remboursement n'a jamais ete demande » soit une LIGNE et pas
--   une absence de ligne : sur cette question-la, le silence est la pire des
--   reponses.
--
-- Ce que cette migration NE corrige PAS, faute de pouvoir le faire ici :
--   - `stripe-webhook` n'est abonne a aucun `refund.*` (hors perimetre). Une
--     demande partie que Stripe renvoie en `pending` reste donc en `demande`
--     pour toujours — la colonne `ou_en_est` de la vue la nomme explicitement.
--   - Rien n'alerte le porteur du projet. La vue se consulte, elle ne previent
--     pas. C'est un choix : poser une alerte demanderait un ordonnanceur, et il
--     n'y en a aucun sur ce projet.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LA MANIVELLE DE SECOURS
-- ---------------------------------------------------------------------------
-- `drop` puis `create` : ajouter un defaut a la signature creerait une SECONDE
-- fonction et rendrait `relancer_remboursements_en_attente()` ambigu. On garde
-- donc exactement la meme signature qu'avant.
drop function if exists public.relancer_remboursements_en_attente();

create or replace function public.relancer_remboursements_en_attente()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_n  integer := 0;
begin
  -- ⚠️ DEUX APPELANTS LEGITIMES, PAS UN.
  --   - un administrateur connecte (`is_admin()`), depuis l'espace admin ;
  --   - la base elle-meme : `auth.uid()` NULL = connexion directe, c'est-a-dire
  --     l'editeur SQL (`postgres`) ou `service_role`. Ces deux-la ont deja le
  --     droit de tout faire sur `payment_refunds` a la main ; leur refuser la
  --     fonction ne protegeait rien et rendait le rattrapage impossible.
  -- `anon` n'a pas le droit d'executer cette fonction (revoke plus bas), donc
  -- « auth.uid() est NULL » ne peut pas designer un visiteur anonyme.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  -- Rejouer un envoi n'a jamais rendu deux fois : la cle d'idempotence de la
  -- demande protege chez Stripe pendant 24 h, et `enregistrer_envoi_remboursement`
  -- refuse d'attacher un second `re_...` au-dela. C'est ce qui autorise a
  -- rejouer sans filtre d'age : mieux vaut un appel de trop qu'un client non
  -- rembourse parce qu'on a juge sa demande « trop recente ».
  for v_id in
    select id from public.payment_refunds where status = 'demande' order by created_at
  loop
    if public.declencher_remboursement(v_id) then
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end $$;

revoke all on function public.relancer_remboursements_en_attente() from public, anon;
grant execute on function public.relancer_remboursements_en_attente() to authenticated, service_role;

comment on function public.relancer_remboursements_en_attente() is
  'Rejoue les envois restes en file. Appelable par un administrateur connecte OU '
  'directement depuis la base (editeur SQL, service_role) : c''est la manivelle de '
  'secours quand Stripe etait injoignable. Rend le nombre d''appels reemis.';

-- ---------------------------------------------------------------------------
-- 2. LA QUESTION DU SOIR, EN UNE REQUETE
-- ---------------------------------------------------------------------------
-- Usage :  select * from public.suivi_remboursements where commande = 'TF-96';
-- ou       select * from public.suivi_remboursements where a_regarder;
create or replace view public.suivi_remboursements as
select
  o.order_number                                             as commande,
  (pi.captured_at at time zone 'Indian/Antananarivo')        as encaisse_le,
  r.name                                                     as restaurant,
  p.full_name                                                as client,
  coalesce(p.phone, a.phone)                                 as telephone,
  o.status::text                                             as statut_commande,
  o.payment_status::text                                     as paiement_commande,
  pi.amount_minor                                            as encaisse_minor,
  pi.currency                                                as devise,
  pi.amount_ar                                               as encaisse_ar,
  pr.status::text                                            as remboursement,
  pr.amount_minor                                            as rendu_minor,
  pr.amount_ar                                               as rendu_ar,
  pr.motif,
  pr.origine,
  pr.created_at                                              as demande_le,
  pr.effectue_le,
  pi.provider_intent_id,
  pr.provider_refund_id,
  pr.erreur,

  -- La colonne qui evite d'avoir a interpreter les trois autres a 21 h.
  case
    when pr.id is null and o.status = 'annulee'
      then 'ANNULEE ET ENCAISSEE, AUCUN REMBOURSEMENT DEMANDE — anomalie, a instruire'
    when pr.id is null
      then 'Encaisse, aucun remboursement demande'
    when pr.status = 'effectue'
      then 'Rembourse. Le client voit le credit sous 5 a 10 jours ouvres'
    when pr.status = 'echoue'
      then 'ECHEC : le client n''a rien recu, a rembourser autrement — ' || coalesce(pr.erreur, 'sans motif')
    when pr.status = 'sans_objet'
      then 'Rien a rendre : le paiement n''avait jamais ete encaisse'
    -- A partir d'ici, status = 'demande'. Le `re_...` est ce qui separe
    -- « parti chez Stripe » de « jamais parti » : c'est la difference entre
    -- attendre et devoir agir, et l'ecran admin disait « en attente du verdict
    -- de Stripe » dans les deux cas.
    when pr.provider_refund_id is not null
      then 'Envoye a Stripe, verdict attendu (⚠️ aucun webhook refund.* n''est '
           || 'abonne : ce verdict n''arrivera pas tout seul)'
    when pr.erreur is not null
      then 'PAS PARTI CHEZ STRIPE — ' || pr.erreur
           || ' | relancer : select public.relancer_remboursements_en_attente();'
    else
      'Demande enregistree, envoi pas encore confirme'
           || ' | relancer : select public.relancer_remboursements_en_attente();'
  end                                                        as ou_en_est,

  -- Le filtre du soir : « qu'est-ce qui reclame ma main tout de suite ? »
  (
    (pr.id is null and o.status = 'annulee')
    or pr.status = 'echoue'
    or (pr.status = 'demande' and pr.provider_refund_id is null and pr.created_at < now() - interval '10 minutes')
  )                                                          as a_regarder,

  now() - pr.created_at                                      as depuis
from public.payment_intents pi
join public.orders           o  on o.id = pi.order_id
left join public.restaurants r  on r.id = o.restaurant_id
left join public.profiles    p  on p.id = o.user_id
left join public.addresses   a  on a.id = o.address_id
-- LEFT JOIN, et pas l'inverse : un paiement encaisse sans aucune demande de
-- remboursement DOIT apparaitre. C'est meme la ligne la plus importante quand
-- la commande est annulee.
left join public.payment_refunds pr on pr.payment_intent_id = pi.id
where pi.status in ('capture', 'rembourse');

-- Vue de diagnostic : elle porte le nom et le telephone du client, elle ne
-- s'ouvre donc pas a `authenticated`. L'ecran admin a deja ses propres
-- requetes, filtrees par RLS ; cette vue-ci sert la connexion directe.
revoke all on public.suivi_remboursements from public, anon, authenticated;

comment on view public.suivi_remboursements is
  'Une ligne par paiement encaisse : ou en est son remboursement, en francais. '
  'Repond a « ce client a-t-il ete rembourse ? » en une requete. '
  'select * from public.suivi_remboursements where commande = ''TF-96''; '
  'select * from public.suivi_remboursements where a_regarder;';
