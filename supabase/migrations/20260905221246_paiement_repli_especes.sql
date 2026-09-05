-- ============================================================================
-- Repli especes : abandonner un paiement carte sans perdre la commande
-- ============================================================================
--
-- POURQUOI CETTE RPC EXISTE.
-- Quand la banque refuse la carte, ou quand le client renonce devant le
-- formulaire, il faut pouvoir finir la commande en especes. Recreer la commande
-- serait le geste facile, et il serait faux :
--   - le numero TF-xx a deja ete annonce au restaurant (push, e-mail, Telegram) ;
--   - le code promo a deja ete consomme dans `promo_redemptions`, et
--     `create_order` le refuserait une seconde fois (`code_promo:deja_utilise`) ;
--   - le restaurant verrait deux commandes pour un seul client.
-- On change donc le mode de paiement SUR PLACE.
--
-- POURQUOI UNE RPC ET PAS UN UPDATE DEPUIS L'APP.
-- `public.orders` n'a AUCUNE policy UPDATE, volontairement. Toute ecriture passe
-- par une fonction SECURITY DEFINER qui porte les regles metier. Ouvrir une
-- policy d'UPDATE au client donnerait acces a `total`, `status`, `courier_id`.
--
-- CE QUI N'EST PAS TOUCHE : `create_order` et les policies de `orders`, ni ici
-- ni ailleurs dans ce chantier.
--
-- ⚠️ LIMITE CONNUE, ASSUMEE. On marque la tentative `annule` EN BASE, mais on ne
-- peut pas annuler le PaymentIntent CHEZ STRIPE depuis du SQL. Si le client
-- confirmait quand meme le paiement apres avoir bascule en especes, le webhook
-- recevrait `payment_intent.succeeded` et remettrait `payment_status = 'paye'`.
-- Le sens de cette divergence est le bon : l'argent reellement encaisse est
-- enregistre. Le livreur verrait alors une commande « especes » deja payee — a
-- traiter par l'ecran livreur si le cas se presente. Dans le parcours reel, la
-- feuille de paiement est fermee avant que le repli ne soit propose.

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

  -- Meme reponse que « introuvable » : on n'apprend a personne qu'une commande
  -- existe si elle n'est pas la sienne.
  if v_order.user_id is distinct from auth.uid() then
    raise exception 'Commande introuvable';
  end if;

  if v_order.payment_method <> 'cb' then
    raise exception 'Cette commande n''est pas reglee par carte';
  end if;

  -- De l'argent encaisse ne se transforme pas en especes a payer au livreur.
  if v_order.payment_status in ('paye', 'rembourse') then
    raise exception 'Cette commande est deja payee par carte';
  end if;

  if v_order.status in ('annulee', 'livree') then
    raise exception 'Cette commande est terminee';
  end if;

  -- On eteint les tentatives vivantes AVANT de changer la methode : cela libere
  -- l'index unique partiel `payment_intents_un_actif_par_commande`, et le
  -- trigger `payment_intents_maj_commande` recalcule `payment_status` tout seul.
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

comment on function public.basculer_en_especes(uuid) is
  'Repli especes apres un echec ou un abandon de paiement carte. Ne recree pas la commande, ne touche ni au total ni au code promo.';

-- ⚠️ REGLE DU PROJET : tout `create function` dans le schema `public` est suivi
-- d'un REVOKE. Les privileges par defaut de Supabase accordent EXECUTE a `anon`
-- ET `authenticated` sur toute fonction creee ; un simple GRANT n'enleve rien a
-- `anon`. Ici la fonction se protege deja par `auth.uid()`, mais une fonction
-- d'ecriture n'a aucune raison d'etre appelable sans compte.
revoke all on function public.basculer_en_especes(uuid) from public, anon;
grant execute on function public.basculer_en_especes(uuid) to authenticated;
