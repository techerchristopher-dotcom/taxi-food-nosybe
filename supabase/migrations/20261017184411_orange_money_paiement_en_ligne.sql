-- PAIEMENT ORANGE MONEY DANS L'APP (API Orange Money WebPay) — 2026-10-17.
--
-- Le client choisit « Orange Money » à la validation, `create_order` crée la
-- commande avec `payment_method = 'orange_money'`, puis la fonction Edge
-- `paiement-orange-money` ouvre un paiement chez Orange et renvoie la page de
-- paiement. Orange prévient `om-notification`, qui REVÉRIFIE le statut auprès
-- d'Orange avant d'écrire quoi que ce soit. Référence : docs/PAIEMENT-ORANGE-MONEY.md.
--
-- ⚠️ DEUX « ORANGE MONEY » COEXISTENT, ET C'EST TOUT L'ENJEU DE CE FICHIER.
--   1. Encaissé À LA LIVRAISON (2026-10-12) : la commande naît en espèces, le
--      livreur ou l'admin passe `payment_method` à `orange_money` AU MOMENT de
--      la livraison (UPDATE), suivi dans `paiements_orange_money`.
--   2. Payé EN LIGNE (ici) : la commande NAÎT en `orange_money` (INSERT).
--   Ce qui les distingue est `orders.om_en_ligne`, posé par un trigger BEFORE
--   INSERT et jamais ailleurs. Sans ce drapeau, la garde « commande muette tant
--   qu'elle n'est pas payée » aurait aussi rendu muette la LIVRAISON d'une
--   commande encaissée en Orange Money à la porte.
--
-- ⚠️ MÊMES PARTIS PRIS QUE LE SOCLE CARTE (20260905213821), réutilisé tel quel :
--   - une ligne `payment_intents` par tentative, provider = 'orange_money',
--     l'index unique partiel garantit UN paiement vivant par commande ;
--   - `orders.payment_status` reste DÉDUIT des tentatives par trigger ;
--   - aucune écriture client : tout passe par service_role (fonctions Edge).
--   L'ariary n'a pas d'unité mineure : `amount_minor` = ariary, `fx_rate` = 1.
--
-- ⚠️ INERTE TANT QUE `payment_config.om_en_ligne_active` EST FAUX (défaut).
--   `create_order` refuse alors `orange_money` à la création, et l'app ne
--   propose pas l'option. Arrêt d'urgence : select public.admin_set_om_en_ligne(false);
--
-- ⚠️ AUCUNE API DE REMBOURSEMENT chez Orange. Un paiement capturé sur une
--   commande annulée crée bien sa demande dans `payment_refunds` (mêmes
--   triggers que la carte), mais `declencher_remboursement` ne l'envoie PLUS à
--   Stripe : elle reste « demande », le porteur du projet est prévenu sur
--   Telegram, rend l'argent par transfert, puis le marque fait avec
--   `admin_om_remboursement_effectue(refund_id, reference)`.

-- ============================================================ 1. RÉGLAGES

alter table public.payment_config
  add column if not exists om_en_ligne_active boolean not null default false,
  -- 'dev' = bac à sable Orange (devise OUV, /orange-money-webpay/dev/v1),
  -- 'mg'  = production Madagascar (devise MGA, /orange-money-webpay/mg/v1).
  add column if not exists om_environnement text not null default 'dev'
    check (om_environnement in ('dev', 'mg')),
  -- Orange demande des essais à 1 000 Ar au plus en bac à sable. En 'dev', le
  -- montant envoyé est plafonné à cette valeur (et tracé tel quel dans
  -- `amount_minor`) ; en 'mg', il est TOUJOURS le total exact de la commande.
  add column if not exists om_montant_test_max integer not null default 1000
    check (om_montant_test_max > 0);

grant select (om_en_ligne_active, om_environnement) on public.payment_config to anon, authenticated;

create or replace function public.admin_set_om_en_ligne(p_actif boolean)
returns public.payment_config
language plpgsql security definer set search_path to 'public' as $$
declare v_config public.payment_config;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;
  update public.payment_config
     set om_en_ligne_active = coalesce(p_actif, false), maj_le = now(), maj_par = auth.uid()
   where id = 1
  returning * into v_config;
  return v_config;
end $$;

revoke all on function public.admin_set_om_en_ligne(boolean) from public, anon;
grant execute on function public.admin_set_om_en_ligne(boolean) to authenticated, service_role;

-- ================================================ 2. LA COMMANDE EN LIGNE

alter table public.orders
  add column if not exists om_en_ligne boolean not null default false;

comment on column public.orders.om_en_ligne is
  'Vrai si la commande est NÉE en orange_money (paiement dans l''app). Posé par trigger BEFORE INSERT, jamais par un UPDATE.';

create or replace function public.marquer_orange_money_en_ligne()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.payment_method = 'orange_money' then
    if not coalesce((select om_en_ligne_active from public.payment_config where id = 1), false) then
      raise exception 'paiement:orange_money_inactif' using errcode = '22023';
    end if;
    new.om_en_ligne := true;
  else
    new.om_en_ligne := false;
  end if;
  return new;
end $$;

revoke all on function public.marquer_orange_money_en_ligne() from public, anon, authenticated;

drop trigger if exists orders_om_en_ligne on public.orders;
create trigger orders_om_en_ligne
  before insert on public.orders
  for each row execute function public.marquer_orange_money_en_ligne();

-- La seule définition de « cette commande attend encore son paiement en ligne ».
-- Carte : reprise À L'IDENTIQUE des cinq endroits qui la recopiaient.
-- Orange Money : le drapeau de naissance, ET le mode toujours en orange_money
-- (un repli en espèces la rend annonçable).
create or replace function public.commande_en_attente_de_paiement(p_o public.orders)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select (coalesce((select carte_active from public.payment_config where id = 1), false)
          and p_o.payment_method = 'cb'
          and p_o.payment_status in ('non_requis', 'en_attente', 'echoue'))
      or (coalesce(p_o.om_en_ligne, false)
          and p_o.payment_method = 'orange_money'
          and p_o.payment_status in ('non_requis', 'en_attente', 'echoue'))
$$;

grant execute on function public.commande_en_attente_de_paiement(public.orders) to authenticated, service_role;

-- ================================================ 3. LES TENTATIVES ORANGE

alter table public.payment_intents
  -- Le `order_id` envoyé à Orange : UNIQUE DANS TOUT LEUR SYSTÈME (bac à sable
  -- partagé entre marchands), 30 caractères au plus. Un par tentative.
  add column if not exists om_reference text unique,
  add column if not exists payment_url  text,
  -- Validité du lien de paiement (10 minutes chez Orange).
  add column if not exists expire_le    timestamptz;

-- Le `notif_token` rendu par Orange authentifie sa notification : il ne doit
-- JAMAIS être lisible par le client (qui lit ses `payment_intents`). Table à
-- part, sans policy ni droit : service_role seul.
create table if not exists public.payment_intents_om_jetons (
  payment_intent_id uuid primary key references public.payment_intents(id) on delete cascade,
  notif_token       text not null,
  created_at        timestamptz not null default now()
);
alter table public.payment_intents_om_jetons enable row level security;
revoke all on public.payment_intents_om_jetons from anon, authenticated;

-- ============================== 4. LA GARDE « MUETTE TANT QUE NON PAYÉE »

-- Les fonctions qui recopiaient la condition carte passent par la définition
-- unique. Patch par remplacement de texte, refusé si l'ancre a bougé.
do $$
declare
  v_def text;
  v_new text;
begin
  -- notify_order_status : les deux expressions « muette ».
  v_def := pg_get_functiondef('public.notify_order_status()'::regprocedure);
  v_new := replace(v_def,
    $a$v_muette_new := v_carte
                  and v_o.payment_method = 'cb'
                  and v_o.payment_status in ('non_requis', 'en_attente', 'echoue');$a$,
    $b$v_muette_new := public.commande_en_attente_de_paiement(v_o);$b$);
  v_new := replace(v_new,
    $a$v_muette_old := v_carte
                    and old.payment_method = 'cb'
                    and old.payment_status in ('non_requis', 'en_attente', 'echoue');$a$,
    $b$v_muette_old := public.commande_en_attente_de_paiement(old);$b$);
  if v_new = v_def or position('commande_en_attente_de_paiement(old)' in v_new) = 0
     or position('commande_en_attente_de_paiement(v_o)' in v_new) = 0 then
    raise exception 'notify_order_status : ancre introuvable, rien n''est modifie';
  end if;
  execute v_new;

  -- passer_en_preparation_automatiquement : ne bascule pas une commande impayée.
  v_def := pg_get_functiondef('public.passer_en_preparation_automatiquement()'::regprocedure);
  v_new := replace(v_def,
    $a$and not (v_carte and o.payment_method = 'cb'
                and o.payment_status is distinct from 'paye')$a$,
    $b$and not public.commande_en_attente_de_paiement(o)$b$);
  if v_new = v_def then
    raise exception 'passer_en_preparation_automatiquement : ancre introuvable';
  end if;
  execute v_new;
end $$;

-- Ces deux-là sont courtes : réécrites en entier. `reservation_carte_en_attente`
-- garde son nom (appelée par traiter_commandes_programmees) mais couvre les deux.
create or replace function public.reservation_carte_en_attente(p_o public.orders)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.commande_en_attente_de_paiement(p_o)
$$;

create or replace function public.commande_annoncee_le(p_o public.orders)
returns timestamptz
language sql stable security definer set search_path to 'public' as $$
  select case
    when public.commande_en_attente_de_paiement(p_o)
      then null
    when p_o.transmission_prevue_a is not null
      then p_o.transmise_le
    when p_o.payment_method in ('cb', 'orange_money') and p_o.payment_status = 'paye'
      then greatest(p_o.created_at,
                    coalesce((select max(pi.captured_at) from public.payment_intents pi
                               where pi.order_id = p_o.id), p_o.created_at))
    else p_o.created_at
  end
$$;

-- ====================================================== 5. REPLI ESPÈCES

-- Même RPC que la carte, élargie : une commande Orange Money en ligne non payée
-- peut repasser en espèces. Elle perd alors son drapeau `om_en_ligne` : livrée
-- plus tard en Orange Money À LA PORTE, elle ne doit pas redevenir muette.
create or replace function public.basculer_en_especes(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path to 'public' as $$
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

  if not (v_order.payment_method = 'cb'
          or (v_order.payment_method = 'orange_money' and v_order.om_en_ligne)) then
    raise exception 'Cette commande n''est pas reglee en ligne';
  end if;

  if v_order.payment_status in ('paye', 'rembourse') then
    raise exception 'Cette commande est deja payee';
  end if;

  if v_order.status in ('annulee', 'livree') then
    raise exception 'Cette commande est terminee';
  end if;

  -- Verrou sur les tentatives (même ordre que maj_payment_status_commande) :
  -- sérialise avec la notification Orange / le webhook Stripe.
  perform 1 from public.payment_intents
   where order_id = p_order_id
     for update;

  if exists (select 1 from public.payment_intents
              where order_id = p_order_id
                and status in ('capture', 'rembourse')) then
    raise exception 'Cette commande est deja payee';
  end if;

  update public.payment_intents
     set status = 'annule',
         erreur = 'repli_especes'
   where order_id = p_order_id
     and status in ('en_attente', 'requiert_action', 'autorise');

  update public.orders
     set payment_method = 'especes',
         om_en_ligne = false
   where id = p_order_id
  returning * into v_order;

  return v_order;
end $$;

-- ====================================================== 6. REMBOURSEMENTS

-- `declencher_remboursement` n'envoie plus à Stripe qu'un paiement Stripe. Copie
-- de la version en base au 2026-10-17, une seule garde ajoutée (provider).
create or replace function public.declencher_remboursement(p_refund_id uuid)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare
  v_secret text;
  v_charge jsonb;
  v_provider public.payment_provider;
begin
  select pr.provider into v_provider from public.payment_refunds pr where pr.id = p_refund_id;
  if v_provider is distinct from 'stripe' then
    raise warning 'Remboursement % : fournisseur % sans API de remboursement, a faire a la main',
      p_refund_id, v_provider;
    return false;
  end if;

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

  if v_charge ->> 'provider_intent_id' is null then
    raise warning 'Remboursement % : aucun PaymentIntent Stripe sur cette ligne', p_refund_id;
    return false;
  end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'remboursement_hook_secret';

  if v_secret is null then
    raise warning
      'remboursement_hook_secret absent du Vault : remboursement % enregistre mais NON ENVOYE a Stripe',
      p_refund_id;
    return false;
  end if;

  perform net.http_post(
    url     := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/rembourser-paiement',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body    := v_charge,
    timeout_milliseconds := 8000
  );

  return true;
end $$;

-- Une demande de remboursement Orange Money = un geste humain à faire : on le dit
-- tout de suite sur le canal admin, avec de quoi le faire (montant, téléphone).
create or replace function public.alerter_remboursement_orange_money()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_o   public.orders;
  v_tel text;
begin
  if new.provider <> 'orange_money' or new.status <> 'demande' then return null; end if;
  select * into v_o from public.orders where id = new.order_id;
  select coalesce(p.phone, a.phone) into v_tel
    from public.orders o
    left join public.profiles  p on p.id = o.user_id
    left join public.addresses a on a.id = o.address_id
   where o.id = new.order_id;
  perform public.telegram_admin_envoyer(
       '💸 REMBOURSEMENT ORANGE MONEY À FAIRE — ' || coalesce(v_o.order_number, '?')
    || chr(10) || public.alerte_ar(new.amount_ar) || ' à renvoyer au client'
    || chr(10) || 'Téléphone : ' || coalesce(nullif(btrim(v_tel), ''), 'inconnu')
    || chr(10) || 'Motif : ' || coalesce(new.motif, '-')
    || chr(10) || 'Orange n''a pas d''API de remboursement : transfert à faire à la main, puis le marquer fait dans l''admin.');
  return null;
exception when others then
  raise warning 'alerter_remboursement_orange_money : %', sqlerrm;
  return null;
end $$;

revoke all on function public.alerter_remboursement_orange_money() from public, anon, authenticated;

drop trigger if exists payment_refunds_alerte_orange_money on public.payment_refunds;
create trigger payment_refunds_alerte_orange_money
  after insert on public.payment_refunds
  for each row execute function public.alerter_remboursement_orange_money();

-- Le porteur du projet a rendu l'argent par transfert : il le note ici. Passe par
-- `enregistrer_verdict_remboursement`, le chemin du webhook Stripe : mêmes
-- triggers (paiement marqué remboursé, e-mail « remboursé » au client).
create or replace function public.admin_om_remboursement_effectue(p_refund_id uuid, p_reference text)
returns public.payment_refunds
language plpgsql security definer set search_path to 'public' as $$
declare v_r public.payment_refunds;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  if nullif(btrim(coalesce(p_reference, '')), '') is null then
    raise exception 'Reference du transfert obligatoire';
  end if;
  select * into v_r from public.payment_refunds where id = p_refund_id for update;
  if v_r.id is null then raise exception 'Remboursement introuvable'; end if;
  if v_r.provider <> 'orange_money' then raise exception 'Ce remboursement n''est pas Orange Money'; end if;
  if v_r.status <> 'demande' then raise exception 'Ce remboursement est deja tranche (%)', v_r.status; end if;
  perform public.enregistrer_verdict_remboursement(p_refund_id, btrim(p_reference), 'effectue', null,
    jsonb_build_object('manuel', true, 'par', auth.uid(), 'le', now()));
  select * into v_r from public.payment_refunds where id = p_refund_id;
  return v_r;
end $$;

revoke all on function public.admin_om_remboursement_effectue(uuid, text) from public, anon;
grant execute on function public.admin_om_remboursement_effectue(uuid, text) to authenticated;

-- ===================================================== 7. LES SECRETS

-- Crochet de la tâche planifiée vers la fonction Edge (balayage). Généré ici,
-- jamais affiché.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'om_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'om_hook_secret',
                                'Balayage Orange Money : pg_cron -> paiement-orange-money');
  end if;
end $$;

create or replace function public.orange_money_config()
returns jsonb
language sql security definer set search_path to 'public', 'vault' as $$
  select jsonb_build_object(
    'merchant_key',   (select decrypted_secret from vault.decrypted_secrets where name = 'om_merchant_key'),
    'auth_header',    (select decrypted_secret from vault.decrypted_secrets where name = 'om_auth_header'),
    'hook_secret',    (select decrypted_secret from vault.decrypted_secrets where name = 'om_hook_secret'),
    'environnement',  (select om_environnement     from public.payment_config where id = 1),
    'active',         (select om_en_ligne_active   from public.payment_config where id = 1),
    'montant_test_max', (select om_montant_test_max from public.payment_config where id = 1),
    'configure',      exists (select 1 from vault.decrypted_secrets where name = 'om_merchant_key')
                      and exists (select 1 from vault.decrypted_secrets where name = 'om_auth_header')
  );
$$;

revoke all on function public.orange_money_config() from public, anon, authenticated;
grant execute on function public.orange_money_config() to service_role;

-- deposer-secret accepte désormais les deux clés Orange Money.
create or replace function public.poser_secret_exploitation(p_nom text, p_valeur text)
returns text
language plpgsql security definer set search_path to '' as $$
declare v_id uuid;
begin
  if p_nom not in ('asc_private_key', 'asc_issuer_id', 'asc_key_id', 'asc_vendor_number',
                   'umami_api_key_vitrine', 'umami_api_key_app', 'anthropic_api_key',
                   'facebook_page_token', 'rounded_api_key',
                   'om_merchant_key', 'om_auth_header') then
    raise exception 'secret_non_autorise';
  end if;
  if p_valeur is null or length(p_valeur) < 8 then
    raise exception 'valeur_invalide';
  end if;
  select id into v_id from vault.secrets where name = p_nom;
  if v_id is null then
    perform vault.create_secret(p_valeur, p_nom, 'pose depuis le poste par deposer-secret');
    return 'cree';
  end if;
  perform vault.update_secret(v_id, p_valeur, p_nom);
  return 'remplace';
end $$;

-- ============================================ 8. EXPIRATION ET BALAYAGE

-- Une commande Orange Money en ligne jamais payée ne doit pas rester « reçue »
-- pour toujours : 25 minutes après sa création, sans paiement vivant, elle est
-- annulée. Le restaurant n'a jamais rien reçu (commande muette) : rien ne part
-- vers lui. Code promo et porte-monnaie reviennent par les triggers d'annulation.
create or replace function public.om_expirer_commandes()
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare v_n integer;
begin
  update public.orders o
     set status = 'annulee', status_updated_at = now(),
         cancellation_code = 'autre',
         cancellation_detail = 'paiement Orange Money non abouti',
         cancellation_reason = public.composer_motif_refus('autre', 'paiement Orange Money non abouti')
   where o.om_en_ligne
     and o.payment_method = 'orange_money'
     and o.status = 'recue'
     and o.payment_status is distinct from 'paye'
     and o.created_at < now() - interval '25 minutes'
     and not exists (select 1 from public.payment_intents pi
                      where pi.order_id = o.id
                        and pi.status in ('en_attente', 'requiert_action', 'autorise', 'capture'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.om_expirer_commandes() from public, anon, authenticated;
grant execute on function public.om_expirer_commandes() to service_role;

-- Appelée chaque minute par pg_cron. N'appelle la fonction Edge QUE s'il y a
-- quelque chose à regarder : un paiement Orange encore vivant depuis plus de
-- deux minutes, ou une commande en ligne non payée à expirer.
create or replace function public.om_lancer_balayage()
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare v_secret text;
begin
  if not exists (select 1 from public.payment_intents
                  where provider = 'orange_money' and status = 'en_attente'
                    and created_at < now() - interval '2 minutes')
     and not exists (select 1 from public.orders
                      where om_en_ligne and payment_method = 'orange_money' and status = 'recue'
                        and payment_status is distinct from 'paye'
                        and created_at < now() - interval '25 minutes') then
    return false;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'om_hook_secret';
  if v_secret is null then return false; end if;
  perform net.http_post(
    url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/paiement-orange-money',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := jsonb_build_object('action', 'balayer'),
    timeout_milliseconds := 30000);
  return true;
end $$;

revoke all on function public.om_lancer_balayage() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'orange-money-balayage') then
    perform cron.unschedule('orange-money-balayage');
  end if;
  perform cron.schedule('orange-money-balayage', '* * * * *', 'select public.om_lancer_balayage()');
end $$;

-- ================================================ 9. CE QUE VOIT LE CLIENT

-- L'état du paiement en ligne d'une commande, pour l'écran de paiement : sans
-- jamais rendre le notif_token. Propriétaire seulement.
create or replace function public.mon_paiement_om_en_ligne(p_order_id uuid)
returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when o.id is null then null else jsonb_build_object(
    'payment_status', o.payment_status,
    'statut_commande', o.status,
    'om_en_ligne', o.om_en_ligne,
    'payment_method', o.payment_method,
    'total', o.total,
    'tentative', (select jsonb_build_object('statut', pi.status, 'payment_url', pi.payment_url,
                                            'expire_le', pi.expire_le, 'montant', pi.amount_minor,
                                            'devise', pi.currency)
                    from public.payment_intents pi
                   where pi.order_id = o.id and pi.provider = 'orange_money'
                   order by pi.created_at desc limit 1)
  ) end
  from public.orders o
  where o.id = p_order_id and o.user_id = auth.uid()
$$;

revoke all on function public.mon_paiement_om_en_ligne(uuid) from public, anon;
grant execute on function public.mon_paiement_om_en_ligne(uuid) to authenticated;
