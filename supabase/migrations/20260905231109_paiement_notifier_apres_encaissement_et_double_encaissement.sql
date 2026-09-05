-- Appliquee en base le 2026-09-06 sous la version 20260905231109.
-- (Horodatage attribue par le SERVEUR Supabase en UTC, d'ou le nom du fichier.)
--
-- Trois defauts signales par les trois revues adversariales, tous confirmes en
-- base avant correction, tous corrigeables sans arbitrage du porteur du projet.
--
-- ⚠️ VERIFIE PAR LECTURE, PAS A L'EXECUTION. Le test qui aurait insere une
-- commande carte dans une transaction annulee a ete refuse par le systeme de
-- permissions de la session. La logique ci-dessous n'a donc jamais tourne :
-- elle doit etre rejouee lors du premier vrai paiement de bout en bout.

-- ============================================================================
-- 1. Le restaurant n'est plus prevenu d'une commande carte NON payee
-- ============================================================================
-- `create_order` insere en status='recue' -> orders_notify_new -> push + e-mail
-- + Telegram AVEC lien « Accepter » cliquable, AVANT tout paiement. Un client
-- qui abandonne le PaymentSheet laisse un restaurant qui a pu commencer a
-- cuisiner : cout = matiere premiere, sans compte a debiter.
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text; v_picked boolean := false; v_event text := 'statut';
  v_n8n_url text; v_n8n_sec text; v_charge jsonb;
  v_obj constant text := '/storage/v1/object/public/';
  v_img constant text := '/storage/v1/render/image/public/';
  v_carte boolean;
  v_muette_new boolean;
  v_muette_old boolean;
begin
  -- Garde par carte_active : tant que l'interrupteur est a false, « cb » designe
  -- encore le terminal du livreur et le comportement historique est preserve.
  -- C'est ce qui rend cette migration PROUVABLEMENT INERTE aujourd'hui
  -- (carte_active = false, 0 commande cb sur 33 en base).
  select carte_active into v_carte from public.payment_config where id = 1;
  v_carte := coalesce(v_carte, false);

  v_muette_new := v_carte
                  and new.payment_method = 'cb'
                  and new.payment_status in ('non_requis', 'en_attente', 'echoue');

  if tg_op = 'INSERT' then
    if new.status <> 'recue' then return new; end if;
    if v_muette_new then return new; end if;   -- annonce DIFFEREE, pas supprimee
    v_event := 'nouvelle';
  else
    v_muette_old := v_carte
                    and old.payment_method = 'cb'
                    and old.payment_status in ('non_requis', 'en_attente', 'echoue');

    if v_muette_new then
      return new;                              -- toujours pas paye : silence
    elsif v_muette_old then
      -- La commande vient de se debloquer : paiement capture par le webhook, ou
      -- repli especes. C'est ICI que l'annonce differee est rattrapee.
      -- ⚠️ Ce test doit rester AVANT le `new.status is not distinct from old.status`
      -- ci-dessous : un UPDATE de payment_status seul ne change pas le statut, et
      -- tomberait donc dans le `return new` sans jamais rattraper l'annonce.
      if new.status <> 'recue' then return new; end if;
      v_event := 'nouvelle';
    elsif new.picked_up_at is not null and old.picked_up_at is null then
      v_picked := true;
    elsif new.status is not distinct from old.status then
      return new;
    end if;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name='push_hook_secret';
  if v_secret is null then
    raise warning 'push_hook_secret absent du Vault : notification push non envoyee';
  else
    perform net.http_post(
      url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notify-order',
      headers := jsonb_build_object('Content-Type','application/json','x-hook-secret',v_secret),
      body := jsonb_build_object('order_id',new.id,'status',new.status::text,
                                 'picked_up',v_picked,'event',v_event),
      timeout_milliseconds := 5000);
  end if;

  select decrypted_secret into v_n8n_url from vault.decrypted_secrets where name='n8n_webhook_url';
  if v_n8n_url is null then
    raise warning 'n8n_webhook_url absent du Vault : e-mail et Telegram non envoyes';
    return new;
  end if;
  select decrypted_secret into v_n8n_sec from vault.decrypted_secrets where name='n8n_webhook_secret';

  select jsonb_build_object(
    'evenement', v_event,
    'recuperee', v_picked,
    'commande', jsonb_build_object('id',new.id,'numero',new.order_number,'statut',new.status::text,
      'total',new.total,'sous_total',new.subtotal,'livraison',new.delivery_fee,
      'emballage',new.packaging_fee,
      'code_promo',new.promo_code,'remise',new.promo_discount,
      'paiement',new.payment_method,'creee_le',new.created_at,
      'motif_annulation',new.cancellation_reason,
      'lien_suivi','https://taxifood.rentanoo.com/o/'||new.id::text,
      'lien_accepter','https://taxifood.rentanoo.com/a/'||new.id::text||'/'||new.accept_token::text,
      'lien_refuser','https://taxifood.rentanoo.com/r-refus/'||new.id::text||'/'||new.accept_token::text),
    'client', jsonb_build_object('nom',p.full_name,'email',u.email,
      'telephone',coalesce(p.phone,a.phone)),
    'restaurant', jsonb_build_object('id',r.id,'nom',r.name,'telephone',r.phone,
      'zone',r.zone_served,'telegram_chat_id',r.telegram_chat_id,
      'logo', case when r.logo_url like '%'||v_obj||'%'
                   then replace(r.logo_url,v_obj,v_img)||'?width=120&height=120&resize=cover&quality=70'
                   else r.logo_url end),
    'livraison_adresse', jsonb_build_object('zone',a.zone,'precisions',a.landmark,
      'latitude',a.latitude,'longitude',a.longitude),
    'articles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nom', oi.product_name_snapshot,
               'quantite', oi.quantity,
               'prix', oi.unit_price,
               'commentaire', oi.comment,
               'options', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'nom', oio.option_name_snapshot,
                           'quantite', oio.quantity,
                           'prix', oio.price_delta_snapshot)
                         order by oio.option_name_snapshot)
                    from public.order_item_options oio
                   where oio.order_item_id = oi.id), '[]'::jsonb),
               'photo', case when pr.photo_url like '%'||v_obj||'%'
                             then replace(pr.photo_url,v_obj,v_img)||'?width=120&height=120&resize=cover&quality=70'
                             else pr.photo_url end)
             order by oi.id)
        from public.order_items oi
        left join public.products pr on pr.id = oi.product_id
       where oi.order_id = new.id), '[]'::jsonb))
   into v_charge
   from public.restaurants r
   left join public.profiles  p on p.id = new.user_id
   left join auth.users       u on u.id = new.user_id
   left join public.addresses a on a.id = new.address_id
  where r.id = new.restaurant_id;

  perform net.http_post(url := v_n8n_url,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'x-taxifood-secret', coalesce(v_n8n_sec,'')),
    body := v_charge, timeout_milliseconds := 5000);
  return new;
end $function$;

-- ⚠️ INDISPENSABLE : le trigger etait `after update of status, picked_up_at`.
-- Sans `payment_status` la capture par le webhook ne le reveille pas (le
-- restaurant ne serait JAMAIS prevenu — pire que le mal soigne), et sans
-- `payment_method` le repli especes non plus : sa derniere ecriture ne touche
-- ni status ni payment_status.
drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
  after update of status, picked_up_at, payment_status, payment_method
  on public.orders
  for each row execute function public.notify_order_status();

-- ============================================================================
-- 2. Le livreur ne peut plus encaisser en especes une commande deja payee
-- ============================================================================
-- `basculer_en_especes` repasse payment_method a 'especes' sans pouvoir annuler
-- le PaymentIntent chez Stripe (limitation assumee, migration 20260905221246).
-- Un 3-D Secure qui aboutit APRES le repli produit payment_method='especes' ET
-- payment_status='paye' : la commande serait encaissee deux fois — le total
-- complet, ~56 697 Ar sur le panier moyen. C'est le pendant serveur de la garde
-- posee dans app/components/DeliverSheet.tsx : la garde app seule ne suffit pas,
-- un livreur qui coche quand meme passerait.
create or replace function public.mark_order_delivered(p_order_id uuid, p_cash_confirmed boolean default false)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_rate  numeric(5,4);
  v_carte boolean;
  v_cash  boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'Acces refuse a cette commande'; end if;
  if v_order.status <> 'en_livraison' or v_order.picked_up_at is null then
    raise exception 'Marque d''abord la commande comme recuperee';
  end if;

  -- payment_status l'emporte sur payment_method, jamais l'inverse.
  if v_order.payment_status = 'paye' then
    -- Deja encaisse en ligne : on n'exige aucun cash, et surtout on n'en
    -- ENREGISTRE aucun, meme si l'appelant a coche la case.
    v_cash := false;
  elsif v_order.payment_method = 'especes' and not coalesce(p_cash_confirmed, false) then
    raise exception 'Confirme l''encaissement en especes';
  else
    v_cash := coalesce(p_cash_confirmed, false);
  end if;

  if v_order.payment_method = 'cb' and v_order.payment_status <> 'paye' then
    select carte_active into v_carte from public.payment_config where id = 1;
    if coalesce(v_carte, false) or v_order.payment_status <> 'non_requis' then
      raise exception 'Paiement carte non confirme : cette commande ne peut pas etre marquee livree';
    end if;
  end if;

  select commission_rate into v_rate from public.restaurants where id = v_order.restaurant_id;

  update public.orders
    set status = 'livree', delivered_at = now(), status_updated_at = now(),
        cash_confirmed = v_cash,
        commission_rate = v_rate,
        commission_amount = round(subtotal * v_rate)::integer
    where id = p_order_id returning * into v_order;
  return v_order;
end $function$;

-- ============================================================================
-- 3. Le taux de change et l'interrupteur d'encaissement : deuxieme barriere
-- ============================================================================
-- `payment_config` gardait `grant update (fx_ar_per_eur, carte_active, ...) to
-- authenticated`. Seule la policy `payment_config_update_admin` arretait un
-- non-admin, et un UPDATE direct touchait 0 ligne SILENCIEUSEMENT. Le projet
-- double ses barrieres partout ailleurs ; ici on ne doublait pas le bouton qui
-- FIXE LES PRIX ni l'interrupteur d'encaissement. Les RPC admin
-- (`admin_set_fx_rate`, `admin_set_carte_active`) sont SECURITY DEFINER :
-- elles ignorent ce revoke.
revoke update on public.payment_config from anon, authenticated;

-- Regle du projet : tout `create function` est suivi d'un `revoke`, jamais d'un
-- simple `grant` — les privileges par defaut du schema public accordent EXECUTE
-- a anon ET authenticated sur toute fonction creee.
revoke all on function public.notify_order_status() from public, anon, authenticated;
