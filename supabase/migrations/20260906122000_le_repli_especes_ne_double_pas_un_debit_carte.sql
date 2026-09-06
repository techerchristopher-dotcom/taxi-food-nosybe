-- ============================================================================
-- LE REPLI ESPECES NE PEUT PLUS DOUBLER UN DEBIT CARTE
-- ============================================================================
--
-- TROUVE PAR LA REVUE « argent » du 2026-09-06, en cherchant par ou un client
-- peut payer deux fois plutot que par ou il peut etre rembourse deux fois.
--
-- `basculer_en_especes()` est le repli offert au client dont la carte n'a pas
-- abouti : la commande repasse en especes et le livreur encaisse. Elle refusait
-- deja le cas evident (`payment_status in ('paye','rembourse')`) — mais elle le
-- LISAIT au debut, et n'ecrivait qu'ensuite, sans jamais verrouiller quoi que
-- ce soit entre les deux :
--
--   t0  basculer_en_especes lit orders.payment_status = 'en_attente'   -> OK
--   t1  webhook `payment_intent.succeeded` : payment_intents -> 'capture'
--       et le trigger passe orders.payment_status a 'paye'
--   t2  basculer_en_especes fait son UPDATE : `where status in ('en_attente',
--       'requiert_action','autorise')` ne touche plus rien (la ligne est en
--       'capture'), puis passe la commande en especes.
--
-- Resultat : la carte est debitee ET le livreur encaisse la meme commande. Le
-- client paie deux fois. Et rien ne le rattrape : la chaine de remboursement ne
-- se declenche qu'a l'ANNULATION, or cette commande-la va etre livree.
--
-- La fenetre n'est pas theorique : le repli espece est propose exactement au
-- moment ou l'app attend le verdict de la carte, c'est-a-dire pendant les
-- quelques secondes ou le webhook est en vol. C'est le seul moment ou le bouton
-- est utile, et c'est le seul moment ou il est dangereux.
--
-- LE CORRECTIF : verrouiller les lignes de paiement AVANT de decider, puis
-- relire. `for update` serialise avec l'UPDATE du webhook — la transaction qui
-- arrive seconde attend, et lit forcement l'etat ecrit par la premiere. C'est le
-- meme raisonnement, et le meme outil, que `verifier_plafond_remboursement()` :
-- ce n'est pas le test qui protege, c'est le verrou pris avant lui.
--
-- ⚠️ ORDRE DES VERROUS : payment_intents d'abord, orders ensuite — le meme ordre
-- que le chemin du webhook (`maj_payment_status_commande` verrouille
-- payment_intents puis met a jour orders). Le `select * into v_order` du debut
-- reste un simple SELECT, sans verrou, donc il n'inverse rien.
--
-- ⚠️ Ce que ca NE corrige PAS : une capture qui arrive APRES le basculement.
-- Elle reste possible (Stripe peut confirmer un paiement qu'on croyait perdu) et
-- elle est deja traitee ailleurs — `remboursement_sur_capture_tardive` ne se
-- declenche que sur une commande annulee. Sur une commande LIVREE payee en
-- especes dont la carte finit par passer, personne ne rend rien aujourd'hui.
-- C'est signale dans le rapport de revue, pas corrige ici : le geste juste
-- (rembourser, ou considerer la carte comme le paiement et dire au livreur de
-- ne rien encaisser) est une decision d'exploitation, pas de code.
create or replace function public.basculer_en_especes(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  if v_order.user_id is distinct from auth.uid() then
    raise exception 'Commande introuvable';
  end if;

  if v_order.payment_method <> 'cb' then
    raise exception 'Cette commande n''est pas reglee par carte';
  end if;

  if v_order.payment_status in ('paye', 'rembourse') then
    raise exception 'Cette commande est deja payee par carte';
  end if;

  if v_order.status in ('annulee', 'livree') then
    raise exception 'Cette commande est terminee';
  end if;

  -- ⚠️ LE VERROU, ET C'EST LUI QUI FAIT TOUT LE TRAVAIL. Il serialise cette
  -- transaction avec celle du webhook Stripe. Sans lui, les deux tests
  -- ci-dessus portent sur un etat deja perime au moment ou on ecrit.
  perform 1 from public.payment_intents
   where order_id = p_order_id
     for update;

  -- Relecture APRES le verrou : si la carte est passee pendant qu'on decidait,
  -- on refuse. Mieux vaut un client qui reessaie qu'un client debite deux fois.
  if exists (select 1 from public.payment_intents
              where order_id = p_order_id
                and status in ('capture', 'rembourse')) then
    raise exception 'Cette commande est deja payee par carte';
  end if;

  update public.payment_intents
     set status = 'annule',
         erreur = 'repli_especes'
   where order_id = p_order_id
     and status in ('en_attente', 'requiert_action', 'autorise');

  update public.orders
     set payment_method = 'especes'
   where id = p_order_id
  returning * into v_order;

  return v_order;
end $$;

revoke all on function public.basculer_en_especes(uuid) from public, anon;
grant execute on function public.basculer_en_especes(uuid) to authenticated, service_role;
