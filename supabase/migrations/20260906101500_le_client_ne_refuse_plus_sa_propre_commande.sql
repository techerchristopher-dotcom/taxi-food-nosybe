-- Le jeton d'acceptation quitte `orders` : le client le lisait, donc il pouvait
-- refuser sa propre commande A LA PLACE du restaurant — et, depuis le socle de
-- remboursement pose ce matin, se faire rembourser tout seul.
--
-- CE QUI A ETE CONSTATE, par l'API, avec le compte client de demonstration :
--
--   GET /rest/v1/orders?select=order_number,status,accept_token
--     -> 200, le jeton en clair, pour chacune de ses commandes.
--
--   POST /rest/v1/rpc/repondre_commande_par_jeton   (cle anon, ce jeton-la)
--     -> {"ok": false, "raison": "deja traitee"}      (commande deja livree)
--   alors qu'un jeton faux, sur la meme commande, repond
--     -> {"ok": false, "raison": "lien invalide"}
--
-- Le jeton lu par le client etait donc ACCEPTE par la porte anonyme. Sur une
-- commande encore en `recue` — l'etat ou le paiement carte est deja capture,
-- c'est-a-dire exactement la fenetre de TF-96 — le meme appel passait la
-- commande en `annulee` avec un motif choisi par le client, ce qui declenche
-- `remboursement_sur_annulation` et fait repartir l'argent chez Stripe. Le refus
-- etait journalise comme venant du restaurant, qui n'a rien fait. Le meme jeton
-- permettait aussi de CONFIRMER la commande a sa place, donc de lancer la
-- cuisine et la course sans son accord.
--
-- ⚠️ POURQUOI DEPLACER LE JETON PLUTOT QUE MASQUER LA COLONNE. Deux essais,
-- faits en transaction annulee sur cette base :
--   * `revoke select (accept_token) on public.orders from authenticated` ne
--     change rien : le GRANT SELECT sur la TABLE couvre deja toutes ses
--     colonnes, un revoke de colonne ne le perce pas.
--   * et meme s'il le percait, `create_order` rend `public.orders` EN ENTIER
--     (type composite). Les droits de colonne ne s'appliquent pas a une valeur
--     composite rendue par une fonction : le controle a montre le jeton lu sans
--     erreur a travers une fonction SECURITY DEFINER, sous le role
--     `authenticated`, colonne revoquee.
-- Un secret qui autorise a agir a la place du restaurant ne peut donc pas vivre
-- dans une ligne que le client recoit. Il change de table.

-- ---------------------------------------------------------------- LE JETON
create table if not exists public.order_accept_jetons (
  order_id uuid primary key references public.orders(id) on delete cascade,
  jeton    uuid not null default gen_random_uuid(),
  cree_le  timestamptz not null default now()
);

comment on table public.order_accept_jetons is
  'Le jeton des liens Telegram « J''accepte » / « Je refuse ». Hors de `orders` parce que le client recoit sa propre commande en entier — par la RLS et par le retour de `create_order`.';
comment on column public.order_accept_jetons.jeton is
  'Autorise a repondre A LA PLACE du restaurant. Ne doit sortir que dans le lien envoye au restaurant.';

alter table public.order_accept_jetons enable row level security;

-- ⚠️ Aucune policy ET aucun droit : ce n'est pas un oubli. Supabase accorde par
-- defaut tous les droits a `anon` et `authenticated` sur toute nouvelle table du
-- schema `public` ; sans ce revoke, la table naitrait lisible. Les deux seules
-- fonctions qui s'en servent sont SECURITY DEFINER et appartiennent a postgres.
revoke all on public.order_accept_jetons from public, anon, authenticated;

-- Reprise des commandes existantes AVEC LEUR JETON ACTUEL, et non un neuf : un
-- restaurateur peut avoir en ce moment meme, dans Telegram, le lien d'une
-- commande en `recue`. Le casser lui ferait afficher « lien invalide » sur une
-- commande qui l'attend. Le client de ces commandes-la garde donc son jeton ;
-- la fenetre se referme d'elle-meme des qu'elles sont traitees.
insert into public.order_accept_jetons (order_id, jeton)
select id, accept_token from public.orders
on conflict (order_id) do nothing;

-- ------------------------------------------------------- POSE A LA CREATION
create or replace function public.poser_jeton_acceptation()
returns trigger language plpgsql security definer set search_path to public as $$
begin
  insert into public.order_accept_jetons (order_id) values (new.id)
  on conflict (order_id) do nothing;
  return null;
end $$;

revoke all on function public.poser_jeton_acceptation() from public, anon, authenticated;

-- ⚠️ Le nom compte. Les triggers AFTER INSERT s'executent dans l'ordre
-- alphabetique : `orders_jeton_acceptation` passe avant `orders_notify_new`,
-- donc le jeton existe quand la notification construit le lien.
drop trigger if exists orders_jeton_acceptation on public.orders;
create trigger orders_jeton_acceptation
  after insert on public.orders
  for each row execute function public.poser_jeton_acceptation();

-- ------------------------------------------------------------- LA PORTE
create or replace function public.repondre_commande_par_jeton(
  p_order_id uuid, p_token uuid, p_action text, p_motif text default null)
returns jsonb language plpgsql security definer set search_path to public as $function$
declare v_order public.orders; v_resto text; v_jeton uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;

  -- Le jeton attendu se lit desormais dans `order_accept_jetons`, que le client
  -- ne peut ni lire ni recevoir. Une commande sans ligne de jeton ne repond
  -- jamais « ok » : `is distinct from` traite le NULL comme une non-egalite.
  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;

  -- Comparaison stricte du jeton. Un uuid n'est pas devinable ; inutile de
  -- ruser, mais on ne dit jamais QUELLE partie est fausse.
  if v_jeton is distinct from p_token then
    return jsonb_build_object('ok', false, 'raison', 'lien invalide');
  end if;

  if v_order.status <> 'recue' then
    -- Cas le plus frequent en vrai : le restaurateur a deja repondu depuis
    -- l'application, puis clique le lien de l'e-mail. Ce n'est pas une erreur.
    return jsonb_build_object('ok', false, 'raison', 'deja traitee',
                              'statut', v_order.status::text);
  end if;

  if p_action = 'accepter' then
    update public.orders set status = 'confirmee', status_updated_at = now()
     where id = p_order_id returning * into v_order;
  elsif p_action = 'refuser' then
    if nullif(btrim(coalesce(p_motif,'')), '') is null then
      return jsonb_build_object('ok', false, 'raison', 'motif obligatoire');
    end if;
    update public.orders set status = 'annulee', status_updated_at = now(),
           cancellation_reason = btrim(p_motif)
     where id = p_order_id returning * into v_order;
  else
    return jsonb_build_object('ok', false, 'raison', 'action inconnue');
  end if;

  select name into v_resto from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number,
                            'statut', v_order.status::text, 'restaurant', v_resto);
end $function$;

-- ------------------------------------------------------------ LA NOTIFICATION
-- Corps repris a l'identique de la version en place : SEULES les deux
-- expressions qui construisent les liens changent, `new.accept_token` cedant la
-- place a une lecture de `order_accept_jetons`.
create or replace function public.notify_order_status()
returns trigger language plpgsql security definer set search_path to public as $function$
declare
  v_secret text; v_picked boolean := false; v_event text := 'statut';
  v_n8n_url text; v_n8n_sec text; v_charge jsonb;
  v_obj constant text := '/storage/v1/object/public/';
  v_img constant text := '/storage/v1/render/image/public/';
  v_carte boolean;
  v_muette_new boolean;
  v_muette_old boolean;
  v_jeton text;
begin
  -- Une commande carte dont le paiement n'est pas capture ne doit RIEN annoncer :
  -- sinon le restaurant recoit un lien « Accepter » et peut commencer a cuisiner
  -- pour un client qui abandonnera le PaymentSheet.
  -- Garde par carte_active : tant que l'interrupteur est a false, « cb » designe
  -- encore le terminal du livreur et le comportement historique est preserve.
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

  -- ⚠️ LE SEUL CHANGEMENT DE CETTE FONCTION. Le jeton ne se lit plus sur la
  -- ligne de commande : il vient de `order_accept_jetons`, invisible au client.
  select j.jeton::text into v_jeton from public.order_accept_jetons j where j.order_id = new.id;

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
      'lien_accepter','https://taxifood.rentanoo.com/a/'||new.id::text||'/'||v_jeton,
      'lien_refuser','https://taxifood.rentanoo.com/r-refus/'||new.id::text||'/'||v_jeton),
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

-- --------------------------------------------------------- CE QUI RESTE A FAIRE
-- `orders.accept_token` n'autorise plus rien : aucune fonction ne le lit, et la
-- porte anonyme ne le reconnait plus. La colonne reste neanmoins la, remplie
-- d'uuid encore lisibles par le client — un leurre, et un leurre est une dette.
-- La retirer (`alter table public.orders drop column accept_token;`) est le
-- geste d'hygiene qui garantit qu'un `create or replace` ressorti d'une vieille
-- copie echouera bruyamment au lieu de rouvrir le trou. Volontairement pas fait
-- ici : c'est une suppression de donnees, elle se decide, elle ne se glisse pas
-- dans une migration de securite.

notify pgrst, 'reload schema';
