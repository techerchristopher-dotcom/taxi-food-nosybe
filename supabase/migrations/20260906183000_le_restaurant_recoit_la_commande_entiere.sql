-- Le restaurant recevait une commande VIDE, a 0 Ar de plats.
--
-- Constate le 2026-09-06 sur le telephone du patron de Chez Bidul & Truc, a sa
-- toute premiere commande de test : « il me dit qu'il a recu une commande a 0 Ar ».
-- Reproduit et mesure dans une transaction annulee :
--
--   en base apres create_order : total=19000  sous_total=9000  1 article
--   envoye au restaurant       : total=10000  sous_total=0     0 article
--
-- CAUSE. `create_order` procede en trois temps, et c'est necessaire : elle INSERE
-- d'abord la ligne de commande (subtotal 0, total = frais de livraison) pour
-- obtenir son id, INSERE ensuite les lignes d'articles qui referencent cet id,
-- puis UPDATE les montants qu'elle vient de recalculer elle-meme. Le trigger
-- `orders_notify_new` etait un AFTER INSERT ordinaire : il partait dans
-- l'intervalle, quand la commande existe mais qu'elle est encore vide.
--
-- POURQUOI PERSONNE NE L'A VU. Les seules commandes annoncees jusqu'ici etaient
-- des commandes CARTE. Or une commande carte est volontairement MUETTE a
-- l'insertion (on n'annonce pas un plat a cuisiner tant que la banque n'a pas
-- repondu) : son annonce est rattrapee plus tard, par le trigger UPDATE, a un
-- moment ou les articles et les montants sont tous en place. Le chemin carte
-- masquait donc le defaut. Le chemin ESPECES — celui de la quasi-totalite des
-- clients reels — le portait en plein.
--
-- CORRECTIF, en deux gestes qui vont ensemble :
--
--   1. `orders_notify_new` devient un CONSTRAINT TRIGGER DEFERRABLE INITIALLY
--      DEFERRED : il ne se declenche plus a l'insertion mais au COMMIT, quand la
--      commande est complete. ⚠️ Ce n'est pas un detail de forme : c'est la seule
--      facon de laisser `create_order` finir son travail avant qu'on en parle.
--
--   2. La fonction RELIT la ligne au lieu de faire confiance a NEW. Un trigger
--      differe conserve le NEW **fige au moment de l'INSERT** : sans cette
--      relecture, les articles seraient corrects (ils viennent d'un sous-select)
--      mais les montants resteraient faux. Le report seul n'aurait donc repare
--      que la moitie du probleme, et de la maniere la plus trompeuse qui soit.
--
-- Au passage, les trois liens (suivi, accepter, refuser) passent de
-- taxifood.rentanoo.com au domaine canonique. L'ancien nom redirige en 301 et les
-- boutons deja envoyes continuent de fonctionner — mais on ne fabrique plus de
-- nouveaux liens qui font un detour.

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
  v_site constant text := 'https://taxifoodnosybe.distripro207.com';
  v_carte boolean;
  v_muette_new boolean;
  v_muette_old boolean;
  v_jeton text;
  v_o public.orders;
begin
  -- ⚠️ Sur un trigger DIFFERE, NEW est fige a l'instant de l'INSERT : la commande
  -- y est encore vide. On relit la ligne telle qu'elle est au COMMIT.
  v_o := new;
  if tg_op = 'INSERT' then
    select * into v_o from public.orders where id = new.id;
    if v_o.id is null then return new; end if;   -- ligne disparue avant le commit
  end if;

  -- Une commande carte dont le paiement n'est pas capture ne doit RIEN annoncer :
  -- sinon le restaurant recoit un lien « Accepter » et peut commencer a cuisiner
  -- pour un client qui abandonnera le PaymentSheet.
  -- Garde par carte_active : tant que l'interrupteur est a false, « cb » designe
  -- encore le terminal du livreur et le comportement historique est preserve.
  select carte_active into v_carte from public.payment_config where id = 1;
  v_carte := coalesce(v_carte, false);

  v_muette_new := v_carte
                  and v_o.payment_method = 'cb'
                  and v_o.payment_status in ('non_requis', 'en_attente', 'echoue');

  if tg_op = 'INSERT' then
    if v_o.status <> 'recue' then return new; end if;
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
      if v_o.status <> 'recue' then return new; end if;
      v_event := 'nouvelle';
    elsif v_o.picked_up_at is not null and old.picked_up_at is null then
      v_picked := true;
    elsif v_o.status is not distinct from old.status then
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
      body := jsonb_build_object('order_id',v_o.id,'status',v_o.status::text,
                                 'picked_up',v_picked,'event',v_event),
      timeout_milliseconds := 5000);
  end if;

  select decrypted_secret into v_n8n_url from vault.decrypted_secrets where name='n8n_webhook_url';
  if v_n8n_url is null then
    raise warning 'n8n_webhook_url absent du Vault : e-mail et Telegram non envoyes';
    return new;
  end if;
  select decrypted_secret into v_n8n_sec from vault.decrypted_secrets where name='n8n_webhook_secret';

  -- Le jeton ne se lit pas sur la ligne de commande : il vient de
  -- `order_accept_jetons`, invisible au client.
  select j.jeton::text into v_jeton from public.order_accept_jetons j where j.order_id = v_o.id;

  select jsonb_build_object(
    'evenement', v_event,
    'recuperee', v_picked,
    'commande', jsonb_build_object('id',v_o.id,'numero',v_o.order_number,'statut',v_o.status::text,
      'total',v_o.total,'sous_total',v_o.subtotal,'livraison',v_o.delivery_fee,
      'emballage',v_o.packaging_fee,
      'code_promo',v_o.promo_code,'remise',v_o.promo_discount,
      'paiement',v_o.payment_method,'creee_le',v_o.created_at,
      'motif_annulation',v_o.cancellation_reason,
      'lien_suivi',v_site||'/o/'||v_o.id::text,
      'lien_accepter',v_site||'/a/'||v_o.id::text||'/'||v_jeton,
      'lien_refuser',v_site||'/r-refus/'||v_o.id::text||'/'||v_jeton),
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
       where oi.order_id = v_o.id), '[]'::jsonb))
   into v_charge
   from public.restaurants r
   left join public.profiles  p on p.id = v_o.user_id
   left join auth.users       u on u.id = v_o.user_id
   left join public.addresses a on a.id = v_o.address_id
  where r.id = v_o.restaurant_id;

  perform net.http_post(url := v_n8n_url,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'x-taxifood-secret', coalesce(v_n8n_sec,'')),
    body := v_charge, timeout_milliseconds := 5000);
  return new;
end $function$;

-- Le trigger d'insertion attend le COMMIT. Les autres sont inchanges.
drop trigger if exists orders_notify_new on public.orders;
create constraint trigger orders_notify_new
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.notify_order_status();
