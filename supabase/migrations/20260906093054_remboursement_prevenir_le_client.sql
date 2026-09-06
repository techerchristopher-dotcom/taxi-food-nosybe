-- Prevenir le client qu'il a ete rembourse.
--
-- LE PROBLEME. Un remboursement etait jusqu'ici totalement silencieux. Le client
-- voyait un debit, puis un credit, sans un mot pour les relier. `notify_order_status()`
-- ne pouvait pas s'en charger : sur le passage `paye` -> `rembourse`, la commande est
-- deja `annulee`, donc `new.status is not distinct from old.status` est vrai et la
-- fonction sort sans rien envoyer.
--
-- POURQUOI UN TRIGGER SUR `payment_refunds` ET NON SUR `orders`. Un remboursement
-- PARTIEL (plat manquant, geste commercial) ne fait jamais basculer
-- `orders.payment_status` : `repercuter_remboursement_sur_paiement()` n'ecrit
-- `rembourse` qu'au montant plein. Un declencheur pose sur `orders` laisserait donc
-- muet exactement le cas ou le client comprend le moins ce qui arrive sur son releve.
-- La verite d'un remboursement, c'est la ligne `payment_refunds` qui passe `effectue`.
--
-- CE QUI N'EST PAS ANNONCE, ET POURQUOI.
--   - `demande` : rien n'est encore parti chez Stripe. Annoncer un remboursement qui
--     peut echouer, c'est promettre a la place de la banque.
--   - `sans_objet` : le paiement n'avait jamais ete capture, il a ete annule. Le client
--     n'a rien vu partir, il n'a rien a voir revenir.
--   - `echoue` : le client n'a PAS son argent. Lui ecrire « vous avez ete rembourse »
--     serait le mensonge le plus grave de la chaine. C'est une alerte interne, pas un
--     e-mail au client — a traiter avec l'abonnement `refund.failed` du webhook.

create or replace function public.notifier_remboursement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url    text;
  v_sec    text;
  v_charge jsonb;
  v_intent public.payment_intents;
begin
  if new.status <> 'effectue' then
    return null;
  end if;
  -- Un UPDATE qui ne touche pas au statut (attachement d'un `re_...`, par exemple)
  -- ne doit pas renvoyer un second e-mail au client.
  if tg_op = 'UPDATE' and old.status = 'effectue' then
    return null;
  end if;

  select * into v_intent from public.payment_intents where id = new.payment_intent_id;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'n8n_webhook_url';
  if v_url is null then
    raise warning 'n8n_webhook_url absent du Vault : client non prevenu du remboursement %', new.id;
    return null;
  end if;
  select decrypted_secret into v_sec
    from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  -- Memes noms de champs que la charge utile de `notify_order_status()` : le noeud
  -- Code de n8n est unique pour tous les evenements, il ne doit pas avoir a deviner
  -- quelle forme il recoit. `articles` est volontairement absent — un e-mail de
  -- remboursement parle d'un montant rendu, pas du contenu du panier.
  select jsonb_build_object(
    'evenement', 'rembourse',
    'recuperee', false,
    'commande', jsonb_build_object(
      'id', o.id, 'numero', o.order_number, 'statut', o.status::text,
      'total', o.total, 'paiement', o.payment_method::text,
      'creee_le', o.created_at, 'motif_annulation', o.cancellation_reason,
      'lien_suivi', 'https://taxifood.rentanoo.com/o/' || o.id::text),
    'client', jsonb_build_object(
      'nom', p.full_name, 'email', u.email,
      'telephone', coalesce(p.phone, a.phone)),
    'restaurant', jsonb_build_object(
      'id', r.id, 'nom', r.name, 'telephone', r.phone,
      'telegram_chat_id', r.telegram_chat_id),
    'remboursement', jsonb_build_object(
      'id', new.id,
      -- Le montant en EUROS, parce que c'est celui que la banque du client a
      -- debite. L'equivalent ariary suit, pour qu'il retrouve sa commande.
      'montant_minor', new.amount_minor,
      'devise', new.currency,
      'montant_ar', new.amount_ar,
      'taux', new.fx_rate,
      -- « Partiel » se juge sur le montant CAPTURE, jamais sur le total de la
      -- commande : ce qui peut revenir, c'est ce qui est parti.
      'capture_minor', v_intent.amount_minor,
      'partiel', (new.amount_minor < v_intent.amount_minor),
      'motif', new.motif,
      'origine', new.origine,
      'effectue_le', new.effectue_le)
  ) into v_charge
    from public.orders o
    left join public.restaurants r on r.id = o.restaurant_id
    left join public.profiles    p on p.id = o.user_id
    left join auth.users         u on u.id = o.user_id
    left join public.addresses   a on a.id = o.address_id
   where o.id = new.order_id;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-taxifood-secret', coalesce(v_sec, '')),
    body    := v_charge,
    timeout_milliseconds := 5000);

  return null;
exception when others then
  -- Meme regle que le trigger d'annulation : rendre l'argent ne doit JAMAIS
  -- echouer parce qu'un e-mail n'est pas parti. Le pire scenario acceptable est
  -- « le client est rembourse et doit etre prevenu a la main ».
  raise warning 'Notification de remboursement non envoyee (%) : %', new.id, sqlerrm;
  return null;
end $$;

comment on function public.notifier_remboursement() is
  'Envoie au webhook n8n l''evenement « rembourse » quand un remboursement passe a effectue. Ne dit rien sur demande, echoue ou sans_objet.';

-- `anon` ne doit pas pouvoir appeler une fonction de trigger, meme si PostgREST
-- n'expose pas les `returns trigger` : la regle du projet ne fait pas d'exception.
revoke all on function public.notifier_remboursement() from public, anon, authenticated;

drop trigger if exists payment_refunds_notifier on public.payment_refunds;
create trigger payment_refunds_notifier
  after insert or update of status on public.payment_refunds
  for each row execute function public.notifier_remboursement();
