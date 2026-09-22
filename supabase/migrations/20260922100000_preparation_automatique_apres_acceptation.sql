-- Une commande acceptee passe TOUTE SEULE en preparation, 30 s apres.
--
-- Demande du porteur du projet (2026-09-22) : les restaurants acceptent d'un tap
-- dans Telegram (lien /a/<id>/<jeton>) et oublient tous d'ouvrir l'app pour
-- appuyer sur « Demarrer la preparation ». Le client voyait « Confirmee »
-- indefiniment.
--
-- ⚠️ MEME CHEMIN QUE L'APPUI DU RESTAURATEUR. `set_order_status` ne fait, pour
-- `confirmee -> en_preparation`, qu'un
--     update orders set status = 'en_preparation', status_updated_at = now()
-- et TOUS les effets viennent des triggers `AFTER UPDATE OF status` :
-- `orders_notify_status` (push client via notify-order, e-mail « C'est en
-- cuisine » via n8n), `orders_liberer_code_promo`, `orders_remboursement_annulation`,
-- `orders_verrou_montants`. La bascule automatique fait EXACTEMENT cet UPDATE :
-- memes triggers, memes notifications, meme horodatage. Aucune ecriture qui les
-- contourne. (Il n'existe pas de table d'historique des statuts : l'historique
-- est `status_updated_at`, pose de la meme facon.)
--
-- Ce fichier pose le reglage et la fonction ; la tache pg_cron est dans la
-- migration suivante (20260922101000), appliquee apres le test de la fonction.

-- ------------------------------------------------------------------ Reglage
-- Par restaurant, ACTIVE par defaut (c'est la demande). Pour le couper :
--   update public.restaurants set preparation_auto = false where id = '<id>';
-- Pour tout couper d'un coup : voir la migration suivante (cron.alter_job).
alter table public.restaurants
  add column if not exists preparation_auto boolean not null default true;

comment on column public.restaurants.preparation_auto is
  'Vrai : une commande acceptee (confirmee) passe seule en_preparation apres 30 s '
  '(tache pg_cron preparation-automatique). Faux : le restaurateur appuie lui-meme.';

-- Les commandes a surveiller : quelques lignes au plus, a tout instant.
create index if not exists orders_confirmees_a_basculer
  on public.orders (status_updated_at) where status = 'confirmee';

-- ------------------------------------------------------------------ Bascule
create or replace function public.passer_en_preparation_automatiquement()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_carte boolean;
  v_n integer;
begin
  select coalesce(carte_active, false) into v_carte from public.payment_config where id = 1;
  v_carte := coalesce(v_carte, false);

  with cibles as (
    select o.id
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
     where o.status = 'confirmee'
       and r.preparation_auto
       -- Acceptee depuis au moins 30 s…
       and o.status_updated_at <= now() - interval '30 seconds'
       -- …mais pas une commande oubliee depuis des heures : lui envoyer
       -- « C'est en cuisine » le lendemain serait faux. Elle reste a la main.
       and o.status_updated_at >  now() - interval '2 hours'
       -- Carte non encaissee : la meme regle que `notify_order_status()` (commande
       -- muette tant que le paiement n'est pas capture) et que l'ecran restaurant
       -- (qui ne la montre pas). Elle ne part pas en cuisine toute seule.
       and not (v_carte and o.payment_method = 'cb'
                and o.payment_status is distinct from 'paye')
     -- Une ligne verrouillee = un restaurateur est en train d'agir dessus : on
     -- la laisse, le passage suivant la reverra si elle est encore confirmee.
     for update of o skip locked
  )
  update public.orders o
     set status = 'en_preparation',
         status_updated_at = now()
    from cibles
   where o.id = cibles.id
     -- Garde de course : relue sous verrou. Une commande annulee ou deja en
     -- preparation entre-temps n'est pas touchee. Idempotent par construction.
     and o.status = 'confirmee';

  get diagnostics v_n = row_count;
  return v_n;
end $function$;

comment on function public.passer_en_preparation_automatiquement() is
  'Tache pg_cron preparation-automatique : confirmee depuis >= 30 s (et < 2 h) -> '
  'en_preparation, par le meme UPDATE que set_order_status. Interne : ni anon ni authenticated.';

-- Interne. `revoke from public` ne retire PAS les grants nommes poses par
-- Supabase (ALTER DEFAULT PRIVILEGES) : on les retire un par un.
revoke all on function public.passer_en_preparation_automatiquement() from public;
revoke all on function public.passer_en_preparation_automatiquement() from anon;
revoke all on function public.passer_en_preparation_automatiquement() from authenticated;
grant execute on function public.passer_en_preparation_automatiquement() to service_role;

-- --------------------------------------------- set_order_status : inoffensif
-- Le restaurateur qui appuie sur « Demarrer la preparation » APRES la bascule
-- recevait « Transition invalide: en_preparation -> en_preparation » et l'ecran
-- affichait « Action impossible ». Ce n'est plus une erreur : l'etat demande
-- est deja atteint, on renvoie la commande sans rien ecrire (donc sans
-- notification en double). Vaut pour TOUTES les versions de l'app en magasin.
-- La lecture prend aussi un verrou de ligne (FOR UPDATE) : l'appui et la tache
-- ne peuvent plus s'entrelacer.
create or replace function public.set_order_status(p_order_id uuid, p_new_status order_status, p_reason text default null::text)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
  v_current order_status;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifie';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  if not public.is_active_restaurant_staff_of(v_order.restaurant_id) then
    raise exception 'Acces refuse a cette commande';
  end if;

  v_current := v_order.status;

  -- Deja en preparation (bascule automatique, ou double appui) : rien a faire.
  if v_current = 'en_preparation' and p_new_status = 'en_preparation' then
    return v_order;
  end if;

  -- Seules les transitions avant/refus depuis le statut courant sont permises.
  if not (
    (v_current = 'recue'          and p_new_status in ('confirmee','annulee')) or
    (v_current = 'confirmee'      and p_new_status in ('en_preparation','annulee')) or
    (v_current = 'en_preparation' and p_new_status = 'en_livraison')
  ) then
    raise exception 'Transition invalide: % -> %', v_current, p_new_status;
  end if;

  if p_new_status = 'annulee' then
    v_reason := nullif(btrim(coalesce(p_reason, '')), '');
    if v_reason is null then
      raise exception 'Un motif est obligatoire pour refuser une commande';
    end if;
  end if;

  update public.orders
    set status = p_new_status,
        status_updated_at = now(),
        cancellation_reason = case when p_new_status = 'annulee' then v_reason
                                   else cancellation_reason end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$function$;

-- ------------------------------ repondre_commande_par_jeton : dire la suite
-- Ajout d'un seul champ a la reponse (`preparation_auto`), pour que la page
-- « Commande acceptee » ouverte depuis Telegram dise que la preparation part
-- toute seule au lieu de demander d'ouvrir l'app. Rien d'autre ne change.
create or replace function public.repondre_commande_par_jeton(p_order_id uuid, p_token uuid, p_action text, p_motif text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_order public.orders; v_resto text; v_jeton uuid; v_auto boolean;
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

  select name, preparation_auto into v_resto, v_auto
    from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number,
                            'statut', v_order.status::text, 'restaurant', v_resto,
                            'preparation_auto', coalesce(v_auto, false));
end $function$;
