-- TROISIEME CANAL DE NOTIFICATION : n8n (e-mail client + Telegram restaurant).
--
-- Le trigger `notify_order_status` appelle deja la fonction Edge `notify-order`
-- pour la notification PUSH. On lui ajoute un second appel, vers un webhook n8n,
-- qui se chargera de l'e-mail au client et du message Telegram au restaurant.
--
-- ⚠️ POURQUOI ETENDRE LE TRIGGER EXISTANT plutot que d'en creer un second :
-- la logique de « qu'est-ce qui merite une notification » est subtile. Une
-- insertion dans un autre etat que `recue` ne doit pas sonner en cuisine, et la
-- prise en charge par le livreur ne change PAS le statut (`en_livraison` du
-- debut a la fin) — seul `picked_up_at` se remplit, alors que c'est l'evenement
-- que le client attend le plus. Dupliquer ce raisonnement, c'est garantir qu'il
-- divergera un jour.
--
-- ⚠️ CHARGE UTILE COMPLETE, et c'est delibere : n8n recoit le nom du client,
-- son e-mail, le restaurant, le montant. Il n'a donc besoin d'AUCUN acces a la
-- base. Un jeton de service dans n8n serait une clef de tout le systeme posee
-- dans un outil tiers, pour economiser une requete.
--
-- ⚠️ TOUS LES CLIENTS N'ONT PAS D'E-MAIL. Un compte cree par WhatsApp OTP n'en
-- a aucun, et une connexion Apple peut n'en fournir qu'un relais prive. Le
-- champ est donc envoye tel quel, eventuellement null : c'est a n8n de ne rien
-- envoyer dans ce cas, pas au trigger d'echouer.
--
-- ⚠️ INERTE TANT QUE LE SECRET N'EST PAS POSE : sans `n8n_webhook_url` dans le
-- Vault, le bloc ne fait rien et laisse un avertissement. Aucune commande ne
-- peut echouer a cause d'une notification.

create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_secret   text;
  v_picked   boolean := false;
  v_event    text := 'statut';
  v_n8n_url  text;
  v_n8n_sec  text;
  v_charge   jsonb;
begin
  if tg_op = 'INSERT' then
    -- Seule une commande fraiche interesse le restaurant. Une insertion dans un
    -- autre etat (reprise de donnees, correction) ne doit pas sonner en cuisine.
    if new.status <> 'recue' then
      return new;
    end if;
    v_event := 'nouvelle';
  else
    -- Prise en charge par le livreur : le statut ne bouge pas (`en_livraison` du debut
    -- a la fin), seul picked_up_at se remplit. C'est pourtant l'evenement que le client
    -- attend le plus, donc il declenche sa propre notification.
    if new.picked_up_at is not null and old.picked_up_at is null then
      v_picked := true;
    elsif new.status is not distinct from old.status then
      return new;
    end if;
  end if;

  ------------------------------------------------------------------ 1. PUSH
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if v_secret is null then
    raise warning 'push_hook_secret absent du Vault : notification push non envoyee';
  else
    -- Asynchrone : net.http_post met la requete en file et rend la main tout de suite.
    -- Indispensable — une commande ne doit jamais echouer parce qu'Expo repond mal.
    perform net.http_post(
      url     := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notify-order',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
      body    := jsonb_build_object(
                   'order_id',  new.id,
                   'status',    new.status::text,
                   'picked_up', v_picked,
                   'event',     v_event
                 ),
      timeout_milliseconds := 5000
    );
  end if;

  ------------------------------------------ 2. n8n : e-mail client + Telegram
  select decrypted_secret into v_n8n_url from vault.decrypted_secrets where name = 'n8n_webhook_url';
  if v_n8n_url is null then
    raise warning 'n8n_webhook_url absent du Vault : e-mail et Telegram non envoyes';
    return new;
  end if;
  select decrypted_secret into v_n8n_sec from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  select jsonb_build_object(
           'evenement',        v_event,
           'recuperee',        v_picked,
           'commande', jsonb_build_object(
             'id',             new.id,
             'numero',         new.order_number,
             'statut',         new.status::text,
             'total',          new.total,
             'sous_total',     new.subtotal,
             'livraison',      new.delivery_fee,
             'emballage',      new.packaging_fee,
             'paiement',       new.payment_method,
             'creee_le',       new.created_at,
             'motif_annulation', new.cancellation_reason
           ),
           'client', jsonb_build_object(
             'nom',            p.full_name,
             -- Peut etre null : compte cree par WhatsApp OTP, ou relais prive Apple.
             'email',          u.email,
             'telephone',      coalesce(p.phone, a.phone)
           ),
           'restaurant', jsonb_build_object(
             'id',             r.id,
             'nom',            r.name,
             'telephone',      r.phone,
             'zone',           r.zone_served
           ),
           'livraison_adresse', jsonb_build_object(
             'zone',           a.zone,
             'precisions',     a.landmark,
             'latitude',       a.latitude,
             'longitude',      a.longitude
           ),
           'articles', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'nom',      oi.product_name_snapshot,
                      'quantite', oi.quantity,
                      'prix',     oi.unit_price))
               from public.order_items oi where oi.order_id = new.id), '[]'::jsonb)
         )
    into v_charge
    from public.restaurants r
    left join public.profiles  p on p.id = new.user_id
    left join auth.users       u on u.id = new.user_id
    left join public.addresses a on a.id = new.address_id
   where r.id = new.restaurant_id;

  perform net.http_post(
    url     := v_n8n_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-taxifood-secret', coalesce(v_n8n_sec, '')),
    body    := v_charge,
    timeout_milliseconds := 5000
  );

  return new;
end;
$fn$;
