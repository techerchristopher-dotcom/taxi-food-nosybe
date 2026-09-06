-- ============================================================================
-- Le plafond de remboursement bloquait le geste qui LIBERE de l'argent
-- ============================================================================
--
-- DEFAUT TROUVE PAR LA RECETTE de `20260906084514_socle_remboursement_carte`,
-- pas par relecture : `verifier_plafond_remboursement()` est un trigger
-- `BEFORE INSERT OR UPDATE OF ... status ...`, et il recalculait la somme SANS
-- regarder le statut vers lequel la ligne allait.
--
-- Consequence, reproduite :
--   ligne A = 341 centimes en `demande`, ligne B = 100 en `demande`
--   `update payment_refunds set status = 'echoue' where ...`
--   -> « Sur-remboursement refuse : deja 100 + demande 341 > capture 341 »
--
-- Autrement dit : impossible d'enregistrer qu'un remboursement A ECHOUE des
-- qu'un autre est en vol sur le meme paiement. Or c'est exactement le geste
-- qu'il ne faut jamais empecher — un `refund.failed` signifie que la banque du
-- client a refuse le credit, que l'argent nous est revenu, et que le client n'a
-- RIEN. Ne pas pouvoir l'ecrire, c'est laisser la base affirmer qu'un client a
-- ete rembourse alors qu'il ne l'a pas ete : le bug d'aujourd'hui, a l'envers.
--
-- LA REGLE, en une phrase : on ne controle le plafond que pour une ligne qui
-- COMPTE dans la somme. Une ligne qui en sort ne peut, par construction, que
-- la faire baisser.
--
-- ⚠️ Le reste de la fonction est repris a l'identique : verrou `for update`
-- d'abord (c'est lui qui serialise les demandes concurrentes, cf. le parti pris
-- n°3 de la migration precedente), puis coherence commande/devise, puis somme.
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

  -- LE CORRECTIF. `echoue` ne compte pas dans la somme : y faire entrer la
  -- ligne dans le calcul revenait a interdire d'enregistrer un echec.
  if new.status not in ('demande', 'effectue') then
    return new;
  end if;

  -- `id is distinct from new.id` pour que le controle reste juste quand c'est
  -- un UPDATE de la ligne elle-meme.
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
