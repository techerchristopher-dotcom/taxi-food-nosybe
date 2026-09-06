-- ============================================================================
-- SOCLE BASE DE DONNEES DU REMBOURSEMENT CARTE — 2026-09-06
-- ============================================================================
--
-- LE CAS REEL QUI DECLENCHE CE CHANTIER, ce matin meme :
--   08:09:23  TF-96 creee, 16 000 Ar, La Cabane, mode carte
--   08:10:09  capture chez Stripe : 3,41 EUR debites (pi_3UCb8j53bhPYA4IF1zRA7Usq)
--   08:12:06  le restaurant REFUSE depuis Telegram
-- Le client a paye, ne sera pas livre, et l'argent n'est jamais revenu. Aucun
-- des trois chemins d'annulation du projet (`repondre_commande_par_jeton`,
-- `set_order_status`, `admin_set_order_status`) ne regarde `payment_status` :
-- une commande encaissee s'annule aussi silencieusement qu'une commande en
-- especes.
--
-- ⚠️ CINQ PARTIS PRIS, dans l'ordre d'importance :
--
-- 1. LE DECLENCHEMENT EST UN TRIGGER, PAS UN APPEL DANS CHAQUE CHEMIN.
--    Le cadrage a recense trois chemins d'annulation ; celui qu'on oublierait
--    serait justement celui qui coute de l'argent — et c'est deja arrive : le
--    refus par jeton Telegram est le chemin le moins visible du projet, et
--    c'est lui qui a mange les 3,41 EUR. Un trigger sur `orders` est vrai quel
--    que soit l'appelant, y compris un UPDATE fait a la main un dimanche soir.
--
-- 2. LA SOURCE DE VERITE EST LE PAIEMENT CAPTURE, PAS `payment_method`.
--    On ne demande pas un remboursement parce que la commande est marquee
--    « cb », mais parce qu'il existe une ligne `payment_intents` en `capture`.
--    C'est le seul critere qui resiste a `basculer_en_especes()`, dont la
--    limite documentee est precisement de laisser une commande passer en
--    « especes » alors qu'un PaymentIntent vit encore chez Stripe. Une commande
--    especes n'a aucune ligne capturee : elle ne declenche donc rien, sans
--    qu'on ait besoin de tester quoi que ce soit.
--
-- 3. LE PLAFOND EST UN VERROU DE LIGNE, PAS UNE VERIFICATION.
--    « La somme des remboursements ne depasse jamais le montant capture » ne
--    peut pas etre une contrainte CHECK (elle porte sur plusieurs lignes) ni un
--    `select` suivi d'un `insert` (deux demandes concurrentes liraient toutes
--    les deux « rien de rembourse » avant que l'une n'ait ecrit, et le client
--    serait rembourse deux fois). C'est le `for update` sur la ligne
--    `payment_intents` qui rend le controle sur : il SERIALISE les demandes
--    portant sur le meme paiement. Meme raisonnement que l'index unique partiel
--    `payment_intents_un_actif_par_commande`, avec l'outil qui convient au cas
--    « plusieurs lignes legitimes, somme bornee ».
--
-- 4. UNE ANNULATION NE PEUT PAS ECHOUER A CAUSE D'UN REMBOURSEMENT.
--    Tout le corps du trigger est sous `exception when others then raise
--    warning`. Refuser une commande doit rester possible meme si Stripe est
--    injoignable, si le Vault est vide, ou si une demande existe deja. Le pire
--    scenario acceptable est « le refus passe, le remboursement est a relancer
--    a la main » ; « le restaurant ne peut plus refuser » ne l'est pas.
--
-- 5. LA BASE N'APPELLE JAMAIS STRIPE. Elle ENREGISTRE la demande, puis met un
--    appel HTTP en file avec `net.http_post`. Le SQL ne sait pas signer un
--    appel Stripe, et surtout : une transaction qui attendrait une reponse
--    reseau tiendrait un verrou sur `orders` pendant ce temps.
--    ⚠️ `net.http_post` met la requete en file DANS la transaction : un test
--    joue dans une transaction annulee ne prouve donc RIEN sur l'envoi reel.
--
-- ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS, ET QUI RESTE A FAIRE AILLEURS :
--
--    a) LA FONCTION EDGE `rembourser-paiement` N'EXISTE PAS ENCORE. Tant que le
--       secret `remboursement_hook_secret` est absent du Vault,
--       `declencher_remboursement()` reste INERTE et le dit par un warning —
--       exactement le patron de `notify_order_status()` avec `n8n_webhook_url`.
--       La demande, elle, est enregistree dans tous les cas : c'est elle la
--       trace comptable, et `relancer_remboursements_en_attente()` rejouera les
--       appels le jour ou la fonction sera deployee. Contrat attendu :
--         POST https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/rembourser-paiement
--         en-tete  x-hook-secret: <Vault remboursement_hook_secret>
--         corps    { refund_id, payment_intent_row, provider_intent_id,
--                    amount_minor, currency, idempotency_key,
--                    order_id, order_number, motif }
--       ⚠️ La cle d'idempotence a envoyer a Stripe est `payment_refunds.
--       idempotency_key`, JAMAIS `payment_intents.idempotency_key` : reutiliser
--       celle du paiement ferait rejouer a Stripe la reponse memorisee du
--       PaymentIntent au lieu de creer un remboursement.
--
--    b) LE WEBHOOK NE SAIT PAS ENCORE ECRIRE ICI. `stripe-webhook/` est hors
--       perimetre de ce chantier. Il faudra qu'il retrouve la ligne par
--       `provider_refund_id` (re_...) et la passe a `effectue` ou `echoue`, et
--       que l'endpoint Stripe s'abonne a `refund.created`, `refund.updated` et
--       `refund.failed` — aucun des trois n'est dans ses `enabled_events`
--       aujourd'hui. `enregistrer_verdict_remboursement()`, plus bas, est le
--       point d'entree qui l'attend.
--
--    c) LE CLIENT N'EST TOUJOURS PAS PREVENU. `notify_order_status()` se tait
--       sur un passage `paye` -> `rembourse` (la commande etant deja `annulee`,
--       `new.status is not distinct from old.status` est vrai et la fonction
--       sort sans rien envoyer). Corriger cela touche le meme trigger que le
--       chantier notification : a faire dans un second temps.

-- ======================================================== 1. LE VOCABULAIRE

-- Trois etats, et un seul est terminal du point de vue de l'argent.
--   demande  : la demande est enregistree, Stripe n'a pas encore tranche.
--              ⚠️ C'est l'etat NORMAL a la creation : la reponse de Stripe a
--              `POST /v1/refunds` vaut « demande acceptee », jamais « argent
--              arrive » — le client voit le credit sous 5 a 10 jours ouvres.
--   effectue : Stripe a confirme (refund.status = succeeded).
--   echoue   : la banque du client a refuse le credit. ⚠️ L'argent nous est
--              rendu (jusqu'a 30 jours), le client n'a RIEN, et il faut le
--              rembourser autrement. C'est le miroir exact du bug d'aujourd'hui,
--              et c'est pour cela que cet etat existe des le premier jour.
do $$ begin
  create type public.payment_refund_status as enum ('demande', 'effectue', 'echoue');
exception when duplicate_object then null; end $$;

-- ========================================================= 2. LA TRACE

-- UNE LIGNE PAR REMBOURSEMENT, pas une par paiement : Stripe accepte plusieurs
-- remboursements PARTIELS sur une meme charge, jusqu'a concurrence du montant
-- capture. Rendre les plats sans rendre la livraison est un geste commercial
-- courant ; le modele doit le permettre sans qu'on ait a le reecrire.
create table if not exists public.payment_refunds (
  id                 uuid primary key default gen_random_uuid(),

  -- Le paiement rembourse. C'est LUI qui porte le montant et le taux figes,
  -- donc c'est lui la reference, `order_id` n'etant qu'un raccourci de lecture.
  payment_intent_id  uuid not null references public.payment_intents(id) on delete cascade,
  -- Denormalise volontairement : le rapport du soir et les policies RLS
  -- interrogent par commande, et une jointure de plus par ligne lue sur une
  -- table qui porte des montants n'apporte rien.
  order_id           uuid not null references public.orders(id) on delete cascade,

  provider           public.payment_provider not null default 'stripe',

  -- Le `re_...`. NULL entre l'enregistrement de la demande et la reponse de
  -- Stripe. UNIQUE tolere plusieurs NULL : c'est ce qu'il faut, et c'est ce qui
  -- rend un rejeu de webhook incapable de creer une seconde ligne.
  provider_refund_id text unique,

  status             public.payment_refund_status not null default 'demande',

  -- ⚠️ CE QU'ON REND EST CE QUI A ETE DEBITE, EN EUROS. Jamais une
  -- reconversion de l'ariary au taux du jour : `fx_rate` est copie dans
  -- `payment_intents` precisement pour refaire le calcul d'hier a l'identique.
  -- Sur TF-96, reconvertir 16 000 Ar au marche (~5008) donnerait 320 centimes
  -- au lieu des 341 debites — 21 centimes de moins que ce que la banque du
  -- client a prelevee, soit le motif de contestation bancaire parfait (et une
  -- contestation coute 20 EUR, 66 fois le montant en jeu).
  amount_minor       integer not null check (amount_minor > 0),
  currency           text not null check (currency = lower(currency)),

  -- L'equivalent ariary, pour le rapport du soir uniquement. Copie du paiement
  -- quand le remboursement est total, proratise sinon : jamais recalcule au
  -- taux courant.
  amount_ar          integer not null check (amount_ar > 0),
  fx_rate            numeric(10,2) not null check (fx_rate > 0),

  -- ⚠️ OBLIGATOIRE. Un remboursement sans motif est indefendable six mois plus
  -- tard, devant un restaurateur comme devant une banque. La contrainte porte
  -- sur la colonne, pas sur la fonction d'ecriture : elle protege aussi un
  -- INSERT fait a la main depuis le tableau de bord.
  motif              text not null check (btrim(motif) <> ''),

  -- Qui a demande. `automatique` = le trigger d'annulation, et il n'a pas
  -- d'`auth.uid()` : c'est pour cela que la tracabilite vit ICI et pas dans
  -- `admin_actions`, dont la colonne `admin_id` est `not null`.
  origine            text not null default 'automatique'
                     check (origine in ('automatique', 'admin', 'stripe')),
  demande_par        uuid references auth.users(id) on delete set null,

  -- Cle d'idempotence envoyee a Stripe, generee en base pour que la fonction
  -- Edge qui rejoue une ligne rejoue AUSSI sa cle.
  -- ⚠️ Stripe purge ses cles au bout de 24 h : elle ne protege donc PAS d'un
  -- rejeu a J+2. La barriere qui tient dans le temps est l'index unique partiel
  -- ci-dessous, plus `provider_refund_id unique`.
  idempotency_key    uuid not null unique default gen_random_uuid(),

  erreur             text,
  raw_event          jsonb,

  created_at         timestamptz not null default now(),
  maj_le             timestamptz not null default now(),
  effectue_le        timestamptz
);

comment on table public.payment_refunds is
  'Une ligne par REMBOURSEMENT (partiels compris). Ecrite uniquement par service_role et par les RPC SECURITY DEFINER.';
comment on column public.payment_refunds.amount_minor is
  'Ce qui est rendu, dans l''unite mineure de la devise du DEBIT. Jamais une reconversion de l''ariary au taux du jour.';
comment on column public.payment_refunds.status is
  'demande = enregistre, verdict Stripe attendu. echoue = la banque a refuse le credit : l''argent nous revient et le client n''a rien.';

-- ⚠️ AU PLUS UNE DEMANDE EN VOL PAR PAIEMENT.
-- Les remboursements partiels multiples restent possibles — mais l'un APRES
-- l'autre, jamais deux en meme temps. C'est ce qui empeche le double
-- remboursement que la cle d'idempotence Stripe ne couvre plus au-dela de 24 h,
-- et c'est la base qui tranche : deux appels concurrents, l'un des deux prend
-- un 23505.
create unique index if not exists payment_refunds_une_demande_en_vol
  on public.payment_refunds (payment_intent_id)
  where status = 'demande';

create index if not exists payment_refunds_order_id_idx   on public.payment_refunds (order_id);
create index if not exists payment_refunds_status_idx     on public.payment_refunds (status);
create index if not exists payment_refunds_created_at_idx on public.payment_refunds (created_at);

create or replace function public.payment_refunds_maj_le()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.maj_le := now();
  return new;
end $$;

drop trigger if exists payment_refunds_maj_le on public.payment_refunds;
create trigger payment_refunds_maj_le
  before update on public.payment_refunds
  for each row execute function public.payment_refunds_maj_le();

-- ============================================== 3. LE PLAFOND (parti pris 3)

create or replace function public.verifier_plafond_remboursement()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_intent public.payment_intents;
  v_deja   integer;
begin
  -- ⚠️ C'EST CETTE LIGNE QUI FAIT TOUT LE TRAVAIL. `for update` verrouille la
  -- ligne du PAIEMENT : deux transactions qui inserent un remboursement sur le
  -- meme paiement se serialisent ici, et la seconde lit forcement la somme
  -- ecrite par la premiere. Sans ce verrou, le `select sum(...)` qui suit
  -- serait un controle de confort : les deux liraient 0 et passeraient.
  select * into v_intent
    from public.payment_intents
   where id = new.payment_intent_id
     for update;

  if v_intent.id is null then
    raise exception 'Paiement introuvable : %', new.payment_intent_id
      using errcode = 'foreign_key_violation';
  end if;

  -- On ne rembourse que de l'argent reellement pris. `rembourse` est admis :
  -- c'est l'etat d'un paiement deja rembourse en partie, sur lequel un second
  -- partiel reste legitime.
  if v_intent.status not in ('capture', 'rembourse') then
    raise exception 'Rien a rembourser : le paiement % est en % (attendu : capture)',
      coalesce(v_intent.provider_intent_id, v_intent.id::text), v_intent.status
      using errcode = 'check_violation';
  end if;

  -- La commande citee doit etre celle du paiement, sinon le rapport du soir
  -- attribuerait le remboursement au mauvais restaurant.
  if new.order_id is distinct from v_intent.order_id then
    raise exception 'Le remboursement designe une commande qui n''est pas celle du paiement'
      using errcode = 'check_violation';
  end if;

  if new.currency is distinct from v_intent.currency then
    raise exception 'Devise incoherente : remboursement en %, paiement en %',
      new.currency, v_intent.currency
      using errcode = 'check_violation';
  end if;

  -- `echoue` ne compte pas : la banque nous a rendu l'argent, il est de nouveau
  -- remboursable. `id is distinct from new.id` pour que le controle reste juste
  -- quand c'est un UPDATE de la ligne elle-meme.
  select coalesce(sum(amount_minor), 0) into v_deja
    from public.payment_refunds
   where payment_intent_id = new.payment_intent_id
     and status in ('demande', 'effectue')
     and id is distinct from new.id;

  if v_deja + new.amount_minor > v_intent.amount_minor then
    raise exception
      'Sur-remboursement refuse sur % : deja % + demande % > capture % %',
      coalesce(v_intent.provider_intent_id, v_intent.id::text),
      v_deja, new.amount_minor, v_intent.amount_minor, upper(v_intent.currency)
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

comment on function public.verifier_plafond_remboursement() is
  'Interdit que la somme des remboursements depasse le montant capture. Le verrou de ligne sur payment_intents serialise les demandes concurrentes.';

drop trigger if exists payment_refunds_plafond on public.payment_refunds;
-- BEFORE, et sur `status` aussi : repasser une ligne `echoue` en `demande`
-- reintroduit son montant dans la somme, et doit donc etre re-controle.
create trigger payment_refunds_plafond
  before insert or update of amount_minor, status, payment_intent_id, currency
  on public.payment_refunds
  for each row execute function public.verifier_plafond_remboursement();

-- ================================================ 4. ENREGISTRER UNE DEMANDE

-- Le point d'entree unique. Ne parle pas a Stripe : il ecrit la ligne, et rien
-- d'autre. L'appel HTTP est `declencher_remboursement()`, separe expres — c'est
-- ce qui permet de rejouer un envoi rate sans creer une seconde demande.
create or replace function public.demander_remboursement(
  p_payment_intent_id uuid,
  p_motif             text,
  p_origine           text    default 'automatique',
  p_montant_minor     integer default null,
  p_demande_par       uuid    default null
)
returns public.payment_refunds
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_intent  public.payment_intents;
  v_deja    integer;
  v_reste   integer;
  v_montant integer;
  v_ar      integer;
  v_refund  public.payment_refunds;
begin
  if nullif(btrim(coalesce(p_motif, '')), '') is null then
    raise exception 'Un remboursement sans motif ne se defend pas : motif obligatoire';
  end if;

  -- Meme verrou que le trigger de plafond, pris ici pour que le calcul du
  -- « reste a rembourser » soit lui aussi a l'abri d'une demande concurrente.
  select * into v_intent
    from public.payment_intents where id = p_payment_intent_id for update;

  if v_intent.id is null then
    raise exception 'Paiement introuvable : %', p_payment_intent_id;
  end if;

  if v_intent.status not in ('capture', 'rembourse') then
    raise exception 'Rien a rembourser : le paiement est en %', v_intent.status;
  end if;

  -- Refus explicite plutot que de laisser le 23505 de l'index unique remonter
  -- tel quel : l'appelant (ecran admin) doit pouvoir montrer la phrase au
  -- gestionnaire. La barriere reste l'index, pas ce test.
  if exists (select 1 from public.payment_refunds
              where payment_intent_id = p_payment_intent_id and status = 'demande') then
    raise exception 'Un remboursement est deja en cours sur ce paiement : attends son verdict';
  end if;

  select coalesce(sum(amount_minor), 0) into v_deja
    from public.payment_refunds
   where payment_intent_id = p_payment_intent_id
     and status in ('demande', 'effectue');

  v_reste := v_intent.amount_minor - v_deja;
  if v_reste <= 0 then
    raise exception 'Ce paiement est deja integralement rembourse';
  end if;

  -- Par defaut : tout ce qui reste. C'est le cas du refus restaurant, le seul
  -- automatise aujourd'hui.
  v_montant := coalesce(p_montant_minor, v_reste);
  if v_montant <= 0 then
    raise exception 'Montant de remboursement invalide : %', v_montant;
  end if;

  -- ⚠️ Remboursement TOTAL : on recopie `amount_ar` du paiement au lieu de le
  -- recalculer. `montant_eur_centimes` arrondit au superieur, donc le chemin
  -- retour (341 x 4700 / 100 = 16 027) ne retombe pas sur les 16 000 Ar
  -- d'origine. Le rapport du soir doit voir sortir exactement ce qui est entre.
  if v_montant = v_intent.amount_minor then
    v_ar := v_intent.amount_ar;
  else
    v_ar := greatest(round(v_montant::numeric * v_intent.fx_rate / 100)::integer, 1);
  end if;

  insert into public.payment_refunds
    (payment_intent_id, order_id, provider, status,
     amount_minor, currency, amount_ar, fx_rate,
     motif, origine, demande_par)
  values
    (v_intent.id, v_intent.order_id, v_intent.provider, 'demande',
     v_montant, v_intent.currency, v_ar, v_intent.fx_rate,
     btrim(p_motif), p_origine, p_demande_par)
  returning * into v_refund;

  return v_refund;
end $$;

comment on function public.demander_remboursement(uuid, text, text, integer, uuid) is
  'Enregistre une demande de remboursement. N''appelle pas Stripe : voir declencher_remboursement().';

-- ⚠️ REGLE DU PROJET : tout `create function` du schema public est suivi d'un
-- REVOKE. Les privileges par defaut de Supabase accordent EXECUTE a `anon` ET
-- `authenticated` sur toute fonction creee. Celle-ci ne verifie AUCUNE
-- identite : elle est appelee par les triggers (SECURITY DEFINER, donc avec les
-- droits du proprietaire) et par les fonctions admin qui, elles, verifient.
revoke all on function public.demander_remboursement(uuid, text, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.demander_remboursement(uuid, text, text, integer, uuid)
  to service_role;

-- ============================================ 5. METTRE L'APPEL STRIPE EN FILE

create or replace function public.declencher_remboursement(p_refund_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
  v_charge jsonb;
begin
  select jsonb_build_object(
           'refund_id',          pr.id,
           'payment_intent_row', pr.payment_intent_id,
           'provider_intent_id', pi.provider_intent_id,
           'amount_minor',       pr.amount_minor,
           'currency',           pr.currency,
           'idempotency_key',    pr.idempotency_key,
           'order_id',           pr.order_id,
           'order_number',       o.order_number,
           'motif',              pr.motif
         )
    into v_charge
    from public.payment_refunds pr
    join public.payment_intents pi on pi.id = pr.payment_intent_id
    join public.orders          o  on o.id  = pr.order_id
   where pr.id = p_refund_id and pr.status = 'demande';

  if v_charge is null then
    raise warning 'Remboursement % introuvable ou deja tranche : aucun appel envoye', p_refund_id;
    return false;
  end if;

  -- Sans `provider_intent_id`, Stripe ne sait pas quoi rembourser : la ligne
  -- reste en `demande` et devient une anomalie a instruire, ce qui est le bon
  -- comportement (le cas existe : TF-94 a un paiement sans `pi_...`).
  if v_charge ->> 'provider_intent_id' is null then
    raise warning 'Remboursement % : aucun PaymentIntent Stripe sur cette ligne', p_refund_id;
    return false;
  end if;

  -- INERTE TANT QUE LE SECRET N'EST PAS POSE. Meme patron que
  -- `notify_order_status()` : la demande est deja ecrite, seul l'envoi attend.
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'remboursement_hook_secret';

  if v_secret is null then
    raise warning
      'remboursement_hook_secret absent du Vault : remboursement % enregistre mais NON ENVOYE a Stripe',
      p_refund_id;
    return false;
  end if;

  -- Asynchrone : `net.http_post` met la requete en file et rend la main. Une
  -- annulation de commande ne doit jamais attendre Stripe.
  perform net.http_post(
    url     := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/rembourser-paiement',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body    := v_charge,
    timeout_milliseconds := 8000
  );

  return true;
end $$;

comment on function public.declencher_remboursement(uuid) is
  'Met en file l''appel a la fonction Edge rembourser-paiement. Inerte et bavard tant que remboursement_hook_secret est absent du Vault.';

revoke all on function public.declencher_remboursement(uuid) from public, anon, authenticated;
grant execute on function public.declencher_remboursement(uuid) to service_role;

-- Rattrapage : rejouer les envois pour toutes les demandes restees en vol.
-- C'est ce qui rendra leur argent aux clients deja annules (TF-96) le jour ou
-- la fonction Edge sera deployee, sans avoir a re-annuler quoi que ce soit.
create or replace function public.relancer_remboursements_en_attente()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid; v_n integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;
  for v_id in select id from public.payment_refunds where status = 'demande' order by created_at
  loop
    if public.declencher_remboursement(v_id) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

revoke all on function public.relancer_remboursements_en_attente() from public, anon;
grant execute on function public.relancer_remboursements_en_attente() to authenticated, service_role;

-- ====================================== 6. LE VERDICT (ecrit par le webhook)

-- Point d'entree que `stripe-webhook` appellera — il est hors perimetre de ce
-- chantier, mais la porte doit exister et etre la seule.
-- ⚠️ Un verdict ne se retracte pas : `effectue` et `echoue` sont terminaux ici.
-- A ce niveau, c'est le `re_...` qui identifie la ligne, et Stripe n'envoie
-- qu'un verdict par remboursement.
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
  if p_statut not in ('effectue', 'echoue') then
    raise exception 'Verdict attendu : effectue ou echoue (recu : %)', p_statut;
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

-- ⚠️ REFERMER LA BOUCLE SANS DEPENDRE DU WEBHOOK.
-- `orders.payment_status` est deduit de `payment_intents` par
-- `maj_payment_status_commande()`. Si le verdict d'un remboursement n'etait
-- ecrit QUE dans `payment_refunds`, la commande resterait marquee `paye` alors
-- que l'argent est rendu — le symetrique exact du bug d'aujourd'hui. On fait
-- donc basculer le paiement des que la somme rendue atteint le montant
-- capture, sans attendre que `charge.refunded` arrive.
-- Un remboursement PARTIEL ne bascule rien : la commande reste `paye`, ce qui
-- est vrai (il reste de l'argent chez nous), et c'est le rapport du soir qui
-- porte le detail. C'est aussi le correctif du defaut releve dans le cadrage :
-- le webhook, lui, marque `rembourse` sans regarder `amount_refunded`.
create or replace function public.repercuter_remboursement_sur_paiement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_capture integer;
  v_rendu   integer;
begin
  if new.status <> 'effectue' then
    return null;
  end if;

  select amount_minor into v_capture
    from public.payment_intents where id = new.payment_intent_id;

  select coalesce(sum(amount_minor), 0) into v_rendu
    from public.payment_refunds
   where payment_intent_id = new.payment_intent_id and status = 'effectue';

  if v_rendu >= v_capture then
    update public.payment_intents
       set status = 'rembourse'
     where id = new.payment_intent_id and status <> 'rembourse';
  end if;

  return null;
end $$;

drop trigger if exists payment_refunds_repercuter on public.payment_refunds;
create trigger payment_refunds_repercuter
  after insert or update of status on public.payment_refunds
  for each row execute function public.repercuter_remboursement_sur_paiement();

-- ============================== 7. LE DECLENCHEMENT AUTOMATIQUE (parti pris 1)

create or replace function public.remboursement_sur_annulation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pi     record;
  v_refund public.payment_refunds;
  v_motif  text;
begin
  -- Seul le PASSAGE a `annulee` compte : un UPDATE quelconque sur une commande
  -- deja annulee ne doit pas redemander un remboursement.
  if new.status <> 'annulee' or old.status = 'annulee' then
    return null;
  end if;

  -- Le motif d'annulation devient le motif du remboursement : c'est la meme
  -- phrase que le client lira, et les trois chemins d'annulation l'exigent deja.
  v_motif := coalesce(nullif(btrim(coalesce(new.cancellation_reason, '')), ''),
                      'Commande annulee');

  -- Parti pris 2 : on interroge les PAIEMENTS CAPTURES, pas `payment_method`.
  -- Une commande especes n'a aucune ligne ici, la boucle ne tourne pas.
  for v_pi in
    select pi.id
      from public.payment_intents pi
     where pi.order_id = new.id
       and pi.status in ('capture', 'rembourse')
     order by pi.created_at
  loop
    -- Parti pris 4 : une annulation ne peut pas echouer a cause d'un
    -- remboursement. Toute erreur (demande deja en vol, plafond atteint, Vault
    -- vide) sort en warning et laisse le refus passer.
    begin
      v_refund := public.demander_remboursement(v_pi.id, v_motif, 'automatique', null, null);
      perform public.declencher_remboursement(v_refund.id);
    exception when others then
      raise warning 'Remboursement automatique impossible sur la commande % (paiement %) : %',
        coalesce(new.order_number, new.id::text), v_pi.id, sqlerrm;
    end;
  end loop;

  return null;
end $$;

comment on function public.remboursement_sur_annulation() is
  'Demande le remboursement de tout paiement capture quand une commande passe en annulee, quel que soit le chemin d''annulation.';

drop trigger if exists orders_remboursement_annulation on public.orders;
create trigger orders_remboursement_annulation
  after update of status on public.orders
  for each row execute function public.remboursement_sur_annulation();

-- LE MIROIR, et il n'est pas theorique : sur TF-96 la capture (08:10:09) a
-- precede le refus (08:12:06) de deux minutes. L'ordre inverse — le restaurant
-- refuse pendant que le client valide sa carte — laisserait une commande
-- `annulee` encaissee APRES coup, que le trigger ci-dessus ne verrait jamais.
create or replace function public.remboursement_sur_capture_tardive()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order  public.orders;
  v_refund public.payment_refunds;
begin
  if new.status <> 'capture' then
    return null;
  end if;
  -- ⚠️ `old` n'est pas affecte sur un INSERT : le tester dans la meme
  -- expression booleenne leverait « record old is not assigned yet », PL/pgSQL
  -- ne garantissant pas l'evaluation paresseuse d'un `and`.
  if tg_op = 'UPDATE' then
    if old.status = 'capture' then
      return null;
    end if;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.status is distinct from 'annulee' then
    return null;
  end if;

  begin
    v_refund := public.demander_remboursement(
      new.id,
      coalesce(nullif(btrim(coalesce(v_order.cancellation_reason, '')), ''),
               'Paiement encaisse apres l''annulation de la commande'),
      'automatique', null, null);
    perform public.declencher_remboursement(v_refund.id);
  exception when others then
    raise warning 'Remboursement automatique impossible sur la commande % (capture tardive) : %',
      coalesce(v_order.order_number, v_order.id::text), sqlerrm;
  end;

  return null;
end $$;

drop trigger if exists payment_intents_remboursement_capture_tardive on public.payment_intents;
create trigger payment_intents_remboursement_capture_tardive
  after insert or update of status on public.payment_intents
  for each row execute function public.remboursement_sur_capture_tardive();

-- ================================================= 8. LE GESTE DE L'ADMIN

-- Le bouton « Rembourser » de l'espace admin appellera ceci. Il existe deja un
-- geste jumeau (`admin_set_order_status`) et le meme journal.
create or replace function public.admin_demander_remboursement(
  p_order_id      uuid,
  p_motif         text,
  p_montant_minor integer default null
)
returns public.payment_refunds
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order   public.orders;
  v_intents uuid[];
  v_refund  public.payment_refunds;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  select array_agg(id order by created_at) into v_intents
    from public.payment_intents
   where order_id = p_order_id and status in ('capture', 'rembourse');

  if v_intents is null then
    raise exception 'Aucun paiement encaisse sur la commande %',
      coalesce(v_order.order_number, p_order_id::text);
  end if;
  -- Ne devrait jamais arriver (l'index unique partiel n'autorise qu'un paiement
  -- vivant par commande), mais deviner lequel rembourser serait pire que refuser.
  if array_length(v_intents, 1) > 1 then
    raise exception 'Plusieurs paiements encaisses sur cette commande : a traiter au cas par cas';
  end if;

  v_refund := public.demander_remboursement(v_intents[1], p_motif, 'admin', p_montant_minor, auth.uid());
  perform public.declencher_remboursement(v_refund.id);

  -- Meme patron que `admin_set_order_status` : `admin_id` est `not null`, ce
  -- qui est precisement la raison pour laquelle les remboursements AUTOMATIQUES
  -- ne passent pas par ce journal mais par `payment_refunds.origine`.
  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'remboursement', p_order_id, v_order.restaurant_id,
          v_order.payment_status::text,
          v_refund.amount_minor::text || ' ' || upper(v_refund.currency),
          btrim(p_motif));

  return v_refund;
end $$;

revoke all on function public.admin_demander_remboursement(uuid, text, integer) from public, anon;
grant execute on function public.admin_demander_remboursement(uuid, text, integer) to authenticated, service_role;

-- ==================================================== 9. LES ACCES (RLS)

alter table public.payment_refunds enable row level security;

-- Le proprietaire de la commande et l'administrateur. PAS le restaurant :
-- `peut_voir_paiements_commande()` (utilisee par `payment_intents`) inclut le
-- personnel du restaurant, ce qui n'a pas de sens ici — c'est nous qui rendons
-- l'argent, sur notre compte Stripe, et le restaurateur n'a rien a arbitrer.
create or replace function public.peut_voir_remboursements_commande(p_order_id uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id
       and (o.user_id = auth.uid() or public.is_admin())
  );
$$;

revoke all on function public.peut_voir_remboursements_commande(uuid) from public, anon;
grant execute on function public.peut_voir_remboursements_commande(uuid) to authenticated, service_role;

-- ⚠️ AUCUNE POLICY D'ECRITURE, VOLONTAIREMENT — comme `payment_intents`.
-- Insert/update/delete passent exclusivement par `service_role` et par les RPC
-- SECURITY DEFINER ci-dessus. Le predicat `auth.uid() is not null` respecte la
-- regle du projet : jamais `to authenticated` seul.
drop policy if exists payment_refunds_select on public.payment_refunds;
create policy payment_refunds_select on public.payment_refunds
  for select to authenticated
  using (auth.uid() is not null and public.peut_voir_remboursements_commande(order_id));

-- Les privileges par defaut de Supabase accordent `arwd` a anon et
-- authenticated sur toute table neuve : on les reprend. La RLS suffirait, mais
-- deux barrieres valent mieux qu'une sur la table qui rend de l'argent.
revoke all on public.payment_refunds from anon, authenticated;
grant select on public.payment_refunds to authenticated;

-- ============================================= 10. LE RAPPORT DU SOIR

-- DEFAUT CORRIGE ICI : `encaisse_par_stripe` comptait `sum(o.total)` sur les
-- commandes `payment_status = 'paye'`, sans jamais retirer ce qui a ete rendu.
-- Un remboursement PARTIEL laisse la commande en `paye` : le rapport du soir
-- annoncait donc de l'argent qui n'est plus chez nous.
--
-- SECOND DEFAUT CORRIGE : `carte_non_encaissee` (« doit rester a zero ; toute
-- valeur non nulle est une anomalie a instruire ») capturait `payment_status
-- is distinct from 'paye'`, donc AUSSI `rembourse`. Une commande livree puis
-- remboursee par geste commercial aurait fait crier a la fraude. Elle est
-- desormais bornee a « ni paye ni rembourse ».
--
-- ⚠️ CE QUE JE NE TRANCHE PAS, et qui reste au porteur du projet : la
-- COMMISSION. Une commande livree puis remboursee continue d'alimenter
-- `commission_taxi_food` et `a_reverser_au_restaurant`, donc de facturer le
-- restaurant sur de l'argent rendu au client. Corriger cela, c'est decider qui
-- porte la perte — le meme genre de decision qu'`emballage_a_arbitrer`, et pas
-- une correction technique. Le chiffre est desormais VISIBLE
-- (`rembourse_par_stripe`), ce qui est le prealable a la decision.
--
-- ⚠️ LES FRAIS STRIPE NE SONT PAS RENDUS sur un remboursement (doc Stripe :
-- « Stripe's processing fees from the original transaction aren't returned »).
-- Sur TF-96 : 0,30 EUR preleves sur 3,41 EUR encaisses, soit ~8,8 % du panier
-- perdus sur une commande dont on ne touche rien. Ils n'apparaissent dans
-- AUCUNE colonne ici, parce que la base ne les connait pas : seule la
-- `balance_transaction` Stripe les porte. A rapprocher a la main.
create or replace view public.rapport_journalier as
select
  (o.created_at at time zone 'Indian/Antananarivo')::date as jour,
  r.id   as restaurant_id,
  r.name as restaurant,
  count(*)                              as commandes,
  sum(o.subtotal)                       as ca_marchandise,
  sum(o.commission_amount)              as commission_taxi_food,
  sum(o.subtotal - o.commission_amount) as a_reverser_au_restaurant,

  sum(o.delivery_fee - coalesce(o.promo_discount, 0))                       as livraisons_taxi_food,
  sum(o.commission_amount + o.delivery_fee - coalesce(o.promo_discount, 0)) as total_taxi_food,

  coalesce(sum(o.total) filter (where o.payment_method = 'especes'), 0) as encaisse_par_les_livreurs,

  -- NET DE CE QUI A ETE RENDU. `rembourse` est inclus dans le filtre puis
  -- ramene a zero par la soustraction : la commande reste comptee comme une
  -- vente carte, elle ne rapporte simplement plus rien. `greatest(...,0)` parce
  -- que l'equivalent ariary d'un remboursement est un arrondi, pas une identite.
  coalesce(sum(greatest(o.total - rb.rendu_ar, 0))
           filter (where o.payment_method = 'cb'
                     and o.payment_status in ('paye', 'rembourse')), 0) as encaisse_par_stripe,

  -- Commande carte livree SANS paiement capture : un trou de caisse. Doit
  -- rester a zero. Un remboursement volontaire n'en est pas un.
  coalesce(sum(o.total) filter (where o.payment_method = 'cb'
                                  and o.payment_status not in ('paye', 'rembourse')), 0) as carte_non_encaissee,

  coalesce(sum(o.total) filter (where o.payment_method = 'orange_money'), 0) as encaisse_hors_app,

  sum(o.packaging_fee) as emballage_a_arbitrer,

  sum(o.total) as facture_aux_clients,

  -- NOUVELLES COLONNES (ajoutees a la fin : `create or replace view` interdit
  -- de les intercaler). Ne concernent que les commandes LIVREES puis
  -- remboursees ; les commandes annulees-remboursees — le cas TF-96, le plus
  -- frequent — sont dans `rapport_remboursements`.
  coalesce(sum(rb.rendu_ar), 0)            as rembourse_par_stripe,
  count(*) filter (where rb.rendu_ar > 0)  as commandes_remboursees

from public.orders o
join public.restaurants r on r.id = o.restaurant_id
-- `effectue` seulement : une demande en vol n'a pas encore quitte notre compte.
-- ⚠️ Le `::integer` n'est pas cosmetique : `sum()` d'un integer rend un bigint,
-- puis `sum()` d'un bigint rend un NUMERIC — et `create or replace view`
-- refuse de changer le type d'une colonne existante
-- (« cannot change data type of view column encaisse_par_stripe »).
left join lateral (
  select coalesce(sum(pr.amount_ar), 0)::integer as rendu_ar
    from public.payment_refunds pr
   where pr.order_id = o.id and pr.status = 'effectue'
) rb on true
where o.status = 'livree'      -- une commande refusee n'a rien encaisse
group by 1, 2, 3;

revoke all on public.rapport_journalier from public, anon, authenticated;

comment on view public.rapport_journalier is
  'Rapport du soir par restaurant et par jour (commandes livrees uniquement, heure de Nosy Be). '
  'a_reverser_au_restaurant = marchandise moins commission. '
  'total_taxi_food = commission + livraison NETTE de remise promo. '
  'encaisse_par_les_livreurs = ESPECES uniquement : c''est le cash a rendre. '
  'encaisse_par_stripe est NET des remboursements effectues. '
  'carte_non_encaissee doit rester a zero (un remboursement n''y entre pas). '
  'emballage_a_arbitrer n''est attribue a personne : decision a prendre. '
  'La commission reste facturee sur une commande livree puis remboursee : decision a prendre.';

-- Les remboursements a part, comme demande — et ils ne peuvent PAS vivre dans
-- la vue ci-dessus : elle est bornee aux commandes `livree`, alors que le cas
-- courant du remboursement est une commande ANNULEE. Sans cette seconde vue,
-- les 3,41 EUR de TF-96 resteraient invisibles partout dans l'application,
-- exactement comme aujourd'hui.
create or replace view public.rapport_remboursements as
select
  (pr.created_at at time zone 'Indian/Antananarivo')::date as jour,
  r.id   as restaurant_id,
  r.name as restaurant,
  o.status::text as statut_commande,
  count(*)                                                     as remboursements,
  count(*) filter (where pr.status = 'demande')                as en_vol,
  count(*) filter (where pr.status = 'effectue')               as effectues,
  -- ⚠️ A INSTRUIRE UNE PAR UNE : la banque a refuse le credit, l'argent nous
  -- est revenu et le client n'a rien. Il faut le rembourser autrement.
  count(*) filter (where pr.status = 'echoue')                 as echoues,
  coalesce(sum(pr.amount_ar)    filter (where pr.status = 'effectue'), 0) as rendu_ar,
  coalesce(sum(pr.amount_minor) filter (where pr.status = 'effectue'), 0) as rendu_minor,
  coalesce(sum(pr.amount_ar)    filter (where pr.status = 'demande'), 0)  as en_vol_ar
from public.payment_refunds pr
join public.orders      o on o.id = pr.order_id
join public.restaurants r on r.id = o.restaurant_id
group by 1, 2, 3, 4;

revoke all on public.rapport_remboursements from public, anon, authenticated;

comment on view public.rapport_remboursements is
  'Remboursements par jour, restaurant et statut de commande. Couvre les commandes ANNULEES, que rapport_journalier ignore par construction. '
  'echoues doit rester a zero : une ligne signifie que le client n''a pas ete rembourse et qu''il faut le faire autrement.';

-- ============================ 11. LE PASSIF : les annulations deja encaissees

-- TF-96 est annulee depuis ce matin : aucun UPDATE ne surviendra plus sur elle,
-- donc le trigger ne la verra jamais. On enregistre la demande ici, une fois.
-- L'appel Stripe partira au premier `relancer_remboursements_en_attente()`,
-- une fois la fonction Edge deployee.
do $$
declare v_o record; v_r public.payment_refunds;
begin
  for v_o in
    select o.id, o.order_number, o.cancellation_reason, pi.id as pi_id
      from public.orders o
      join public.payment_intents pi on pi.order_id = o.id
     where o.status = 'annulee'
       and pi.status in ('capture', 'rembourse')
       and not exists (select 1 from public.payment_refunds pr
                        where pr.payment_intent_id = pi.id)
  loop
    v_r := public.demander_remboursement(
             v_o.pi_id,
             coalesce(nullif(btrim(coalesce(v_o.cancellation_reason, '')), ''),
                      'Commande annulee'),
             'automatique', null, null);
    raise notice 'Remboursement a rattraper : % -> %', v_o.order_number, v_r.id;
  end loop;
end $$;
