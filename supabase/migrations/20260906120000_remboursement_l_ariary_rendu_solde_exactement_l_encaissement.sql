-- ============================================================================
-- LE REMBOURSEMENT QUI SOLDE UN PAIEMENT REND L'ARIARY EXACT, PAS UNE RECONVERSION
-- ============================================================================
--
-- DEFAUT TROUVE PAR LA REVUE « argent » du 2026-09-06, reproduit en base sur
-- TF-96 (16 000 Ar encaisses = 341 centimes au taux fige de 4 700) :
--
--   remboursement partiel A : 200 cts -> round(200 x 4700 / 100) =  9 400 Ar
--   remboursement partiel B : 141 cts -> round(141 x 4700 / 100) =  6 627 Ar
--   -------------------------------------------------------------------------
--   341 cts rendus, soit EXACTEMENT ce qui a ete debite, mais 16 027 Ar
--   annonces contre 16 000 Ar encaisses. 27 Ar de trop.
--
-- Les euros, eux, sont justes : c'est l'EQUIVALENT ARIARY qui deborde, et c'est
-- lui que lisent le rapport du soir (`rapport_journalier.rembourse_par_stripe`,
-- `rapport_remboursements.rendu_ar`) et l'e-mail envoye au client. On lui
-- ecrivait donc qu'on lui avait rendu plus que ce qu'il avait paye.
--
-- POURQUOI CA DERIVE. `montant_eur_centimes()` arrondit au SUPERIEUR
-- (16 000 / 4 700 = 3,4042... -> 341 centimes) : le chemin retour ne retombe
-- jamais sur le montant d'origine. `demander_remboursement()` le savait deja et
-- traitait le cas du remboursement TOTAL en recopiant `amount_ar`. Ce qu'il ne
-- traitait pas, c'est la SOMME de plusieurs partiels qui aboutit au meme total :
-- chacun arrondissait dans son coin, et personne ne rattrapait le reste.
--
-- LA REGLE, en une phrase : le remboursement qui SOLDE le paiement recoit
-- l'ariary qui reste (`amount_ar` moins ce que les lignes precedentes ont deja
-- consomme), jamais une reconversion. Les autres continuent d'arrondir.
--
-- Cette regle englobe l'ancienne : sur un remboursement total, rien n'a ete
-- consomme, donc « le reste » vaut `amount_ar` — exactement ce que faisait le
-- code precedent. Le cas particulier disparait dans le cas general.
--
-- ⚠️ `greatest(..., 1)` est conserve pour la contrainte `amount_ar > 0` : si une
-- serie de tres petits partiels avait deja arrondi au-dela de `amount_ar`, le
-- solde serait negatif. Les euros restent justes dans ce cas ; seul l'equivalent
-- ariary, qui n'est qu'une lecture, garderait quelques ariary de trop.
--
-- ⚠️ `admin/lib/remboursement.ts` (`arRendu`) recopie cette arithmetique pour
-- afficher au gestionnaire ce que la base va ecrire. Les deux changent ensemble.
create or replace function public.demander_remboursement(
  p_payment_intent_id uuid,
  p_motif             text,
  p_origine           text default 'automatique',
  p_montant_minor     integer default null,
  p_demande_par       uuid default null
)
returns public.payment_refunds
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_intent   public.payment_intents;
  v_deja     integer;
  v_deja_ar  integer;
  v_reste    integer;
  v_montant  integer;
  v_ar       integer;
  v_refund   public.payment_refunds;
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

  -- Les DEUX sommes, sur le meme filtre que le plafond : les centimes disent ce
  -- qu'on a le droit de rendre, les ariary disent ce qu'on a deja annonce.
  select coalesce(sum(amount_minor), 0), coalesce(sum(amount_ar), 0)
    into v_deja, v_deja_ar
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

  -- ⚠️ LE CORRECTIF. Le remboursement qui SOLDE le paiement — le total comme le
  -- dernier des partiels — prend l'ariary qui reste. C'est la seule facon que la
  -- somme des lignes retombe sur `amount_ar`, donc que le rapport du soir voie
  -- sortir exactement ce qui est entre.
  if v_montant = v_reste then
    v_ar := greatest(v_intent.amount_ar - v_deja_ar, 1);
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

revoke all on function public.demander_remboursement(uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.demander_remboursement(uuid, text, text, integer, uuid) to service_role;
