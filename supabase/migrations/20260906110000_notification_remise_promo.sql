-- La charge utile n8n transporte la remise.
--
-- Sans ca l'e-mail de confirmation ne tombe plus juste : il listerait les plats,
-- l'emballage, « Livraison 10 000 Ar », puis un total de 35 000 — un client qui
-- additionne trouve 40 000 et croit a une erreur. Le message Telegram au
-- restaurant a le meme probleme sur son total.
--
-- ⚠️ Deux cles seulement changent (`code_promo`, `remise`) ; le reste de la
-- fonction est recopie a l'identique. `create or replace` remplace le corps en
-- entier, il n'existe pas de « patch » d'une fonction Postgres.
create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_secret text; v_picked boolean := false; v_event text := 'statut';
  v_n8n_url text; v_n8n_sec text; v_charge jsonb;
  v_obj constant text := '/storage/v1/object/public/';
  v_img constant text := '/storage/v1/render/image/public/';
begin
  if tg_op = 'INSERT' then
    if new.status <> 'recue' then return new; end if;
    v_event := 'nouvelle';
  else
    if new.picked_up_at is not null and old.picked_up_at is null then
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
      -- Deja deduite de `total` : n8n n'a rien a recalculer, juste a l'afficher.
      'code_promo',new.promo_code,'remise',new.promo_discount,
      'paiement',new.payment_method,'creee_le',new.created_at,
      'motif_annulation',new.cancellation_reason,
      'lien_suivi','https://taxifood.rentanoo.com/o/'||new.id::text,
      -- Liens signes pour repondre depuis Telegram, sans compte.
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
    -- ⚠️ LES OPTIONS FONT LE PLAT. « 1 x Tacos » ne dit pas quel tacos : c'est
    -- le choix de viande, de sauce et les supplements qui le definissent.
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
end $fn$;
