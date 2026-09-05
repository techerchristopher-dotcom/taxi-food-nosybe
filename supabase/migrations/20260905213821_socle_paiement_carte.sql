-- SOCLE BASE DE DONNEES DU PAIEMENT CARTE (Stripe) — 2026-09-06.
--
-- Version appliquee en base : 20260905213821 (supabase_migrations.schema_migrations).
-- ⚠️ L'horodatage vient du serveur Supabase (UTC), pas de la machine qui a
--    ecrit ce fichier : le nom du fichier suit la BASE, pas l'heure locale.
--
-- Ce fichier pose TOUT ce qui doit vivre en base pour encaisser une carte :
-- le taux de change, la conversion, la trace des tentatives, l'etat de paiement
-- d'une commande, et les verrous qui empechent qu'un montant bouge apres coup.
-- Aucune Edge Function, aucun code front ici : ils viendront s'y brancher.
--
-- ⚠️ CINQ PARTIS PRIS, dans l'ordre d'importance :
--
-- 1. LE TAUX DE CHANGE EST UNE DONNEE, PAS UNE CONSTANTE DU CODE.
--    Le porteur du projet encaisse en EUROS a 4700 Ar = 1 EUR alors que le
--    marche est a ~5000 : l'ecart couvre les frais Stripe. Mais l'ariary a
--    bouge entre 4952 et 5053 sur trente jours. S'il descend sous 4700, la
--    marge s'INVERSE et chaque commande coute de l'argent. Un taux fige dans
--    un bundle mobile ne se corrige qu'avec une soumission a l'App Store :
--    plusieurs jours pendant lesquels on perd de l'argent a chaque commande.
--    Il vit donc dans `payment_config`, modifiable en une requete.
--
-- 2. L'ARRONDI SE FAIT AU SUPERIEUR, TOUJOURS.
--    `montant_eur_centimes` fait un `ceil`. Sur un arrondi au centime, c'est
--    la maison qui gagne, jamais le client. Un `round` ferait perdre jusqu'a
--    un demi-centime par commande — negligeable a l'unite, mais surtout : un
--    arrondi qui penche vers le client est une decision, et personne ne l'a
--    prise. `ceil` est le seul choix qu'on n'a pas a defendre.
--
-- 3. L'IDEMPOTENCE EST UNE CONTRAINTE, PAS UNE VERIFICATION.
--    `payment_intents_un_actif_par_commande` est un index unique PARTIEL : au
--    plus UN paiement vivant par commande. Un `select` suivi d'un `insert`
--    laisserait passer deux appels concurrents de l'Edge Function (double tap,
--    retry reseau) : les deux liraient « aucun paiement en cours » avant que
--    l'un n'ait ecrit, et le client serait debite deux fois. C'est la base qui
--    tranche, pas le code applicatif.
--
-- 4. `orders.payment_status` N'EST ECRIT QUE PAR UN TRIGGER.
--    Ni le front, ni une RPC, ni meme l'Edge Function ne l'ecrivent. Il est
--    DEDUIT des lignes de `payment_intents` par `maj_payment_status_commande`.
--    Une seule source de verite : la trace des tentatives. Il n'existe donc
--    aucun chemin ou une commande serait marquee payee sans qu'un paiement
--    capture existe en face.
--
-- 5. AUCUNE POLICY D'ECRITURE SUR `payment_intents`.
--    La table est ecrite uniquement par `service_role`, depuis les Edge
--    Functions. Les privileges d'ecriture sont revoques d'`anon` et
--    d'`authenticated` EN PLUS de l'absence de policy : les privileges par
--    defaut de Supabase accordent `arwd` sur toute table neuve du schema
--    public, et se reposer sur la seule RLS laisserait un cran de trop.
--
-- ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS, ET QUI RESTE A FAIRE :
--    `create_order` insere la commande avec `status = 'recue'`, ce qui
--    declenche `orders_notify_new` -> push + e-mail + Telegram au restaurant,
--    AVANT tout paiement. Un client qui abandonne le PaymentSheet laisse donc
--    un restaurant notifie, avec un lien « Accepter » cliquable. Corriger cela
--    demande de toucher `notify_order_status` — hors du perimetre de ce
--    chantier, qui a interdiction de modifier `create_order`. Le socle pose ici
--    fournit ce qu'il faut pour le faire (`orders.payment_status`).

-- ============================================================ 1. LE TAUX

-- Une seule ligne, et la base le garantit : `id` est contraint a 1 et sert de
-- cle primaire. Impossible d'avoir deux configurations concurrentes dont on ne
-- saurait pas laquelle fait foi.
create table if not exists public.payment_config (
  id                    smallint primary key default 1 check (id = 1),

  -- Combien d'ariary pour 1 euro. Volontairement au-dessous du marche (~5000).
  -- Bornes larges mais qui attrapent la faute de frappe d'un facteur 10 : a
  -- 470, tout coute dix fois trop cher au client ; a 47000, tout est gratuit.
  -- La contrainte porte sur la COLONNE, pas sur la fonction d'ecriture : elle
  -- protege donc aussi une mise a jour faite a la main depuis le tableau de bord.
  fx_ar_per_eur         numeric(10,2) not null default 4700
                        check (fx_ar_per_eur between 2000 and 12000),

  devise_paiement       text not null default 'eur'
                        check (devise_paiement = lower(devise_paiement)),

  -- Interrupteur general. FALSE tant que le parcours n'a pas ete teste de bout
  -- en bout avec une vraie carte. Le front doit s'y fier pour proposer ou non
  -- la carte, et `mark_order_delivered` s'en sert pour savoir si « cb » designe
  -- encore le terminal du livreur ou bien un paiement en ligne.
  carte_active          boolean not null default false,

  -- Montant minimum accepte par Stripe, en unite mineure de la devise.
  -- 50 centimes pour l'EUR (docs.stripe.com/currencies). En base et non en dur
  -- parce qu'il depend de la devise, et que la devise est en base.
  montant_minimum_minor integer not null default 50 check (montant_minimum_minor > 0),

  maj_le                timestamptz not null default now(),
  maj_par               uuid references auth.users(id) on delete set null
);

comment on table public.payment_config is
  'Reglages du paiement en ligne. Une seule ligne (id = 1). Le taux de change est ici et nulle part ailleurs.';

insert into public.payment_config (id) values (1) on conflict (id) do nothing;

-- Changement de taux reserve aux admins. Redondant avec la policy d'UPDATE
-- ci-dessous, mais c'est le chemin nomme : il horodate et signe la modification
-- (`maj_le`, `maj_par`), ce qu'un UPDATE a la main oublierait.
create or replace function public.admin_set_fx_rate(p_taux numeric)
returns public.payment_config
language plpgsql security definer set search_path to 'public' as $$
declare v_config public.payment_config;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;
  update public.payment_config
     set fx_ar_per_eur = p_taux, maj_le = now(), maj_par = auth.uid()
   where id = 1
  returning * into v_config;
  return v_config;
end $$;

-- Meme raisonnement pour l'interrupteur : il doit pouvoir etre coupe en
-- urgence, depuis l'espace admin, sans ouvrir le tableau de bord Supabase.
create or replace function public.admin_set_carte_active(p_actif boolean)
returns public.payment_config
language plpgsql security definer set search_path to 'public' as $$
declare v_config public.payment_config;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;
  update public.payment_config
     set carte_active = coalesce(p_actif, false), maj_le = now(), maj_par = auth.uid()
   where id = 1
  returning * into v_config;
  return v_config;
end $$;

-- ====================================================== 2. LA CONVERSION

-- Ariary -> centimes d'euro. LE seul endroit du projet ou cette conversion
-- existe. Ni le front, ni l'Edge Function ne recalculent : ils appellent ceci.
--
-- ⚠️ L'EURO EST UNE DEVISE A DEUX DECIMALES : Stripe attend des CENTIMES.
-- `amount = 1099` vaut 10,99 EUR. Une simple division par le taux donnerait
-- des euros — le facteur 100 est la faute qui debite un client au centieme du
-- prix sans que rien ne proteste.
--
-- SECURITY DEFINER : la fonction lit `payment_config`, dont les privileges de
-- lecture sont restreints a quelques colonnes. Elle est appelable par tous
-- (le front affiche « ~11,00 EUR » avant paiement) sans ouvrir la table.
create or replace function public.montant_eur_centimes(p_total_ar integer)
returns integer
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_taux    numeric(10,2);
  v_minimum integer;
  v_devise  text;
  v_minor   integer;
begin
  if p_total_ar is null or p_total_ar <= 0 then
    raise exception 'Montant en ariary invalide : %', coalesce(p_total_ar::text, 'null');
  end if;

  select fx_ar_per_eur, montant_minimum_minor, devise_paiement
    into v_taux, v_minimum, v_devise
    from public.payment_config where id = 1;

  if v_taux is null then
    raise exception 'payment_config absente : conversion impossible';
  end if;

  -- Multiplication AVANT division : on reste en numeric exact du debut a la
  -- fin, et le ceil porte sur la vraie valeur, pas sur un intermediaire deja
  -- arrondi. `ceil` et non `round` : voir le parti pris n°2 en tete de fichier.
  v_minor := ceil(p_total_ar::numeric * 100 / v_taux)::integer;

  if v_minor < v_minimum then
    -- Message explicite plutot qu'un refus de Stripe une seconde plus tard :
    -- l'appelant peut le montrer tel quel au client.
    raise exception 'Montant trop faible pour un paiement carte : % centimes % (minimum % centimes, soit environ % Ar)',
      v_minor, upper(v_devise), v_minimum, ceil(v_minimum * v_taux / 100)::integer;
  end if;

  return v_minor;
end $$;

comment on function public.montant_eur_centimes(integer) is
  'Convertit un total en ariary vers des CENTIMES d''euro, arrondi au superieur, au taux de payment_config.';

-- ================================================== 3. LES TENTATIVES

-- `stripe` seul est utilise aujourd'hui. Les deux autres sont prevus parce
-- qu'ajouter une valeur d'enum plus tard impose `ALTER TYPE ... ADD VALUE`,
-- qui ne peut pas tourner dans la meme transaction que son usage — donc deux
-- migrations la ou une suffit ici.
do $$ begin
  create type public.payment_provider as enum ('stripe', 'mvola', 'orange_money');
exception when duplicate_object then null; end $$;

-- Le vocabulaire est celui du cycle de vie d'un PaymentIntent Stripe, traduit :
--   en_attente      : cree, le client n'a pas encore valide
--   requiert_action : 3-D Secure en cours. ⚠️ un intent peut y RESTER pour
--                     toujours si le client tue l'app : aucun evenement Stripe
--                     n'arrive alors. C'est ce qui impose une expiration.
--   autorise        : autorise mais pas encore capture (capture differee)
--   capture         : l'argent est pris. C'est le seul etat qui vaut « paye ».
--   echoue / annule : terminal, et LIBERE la commande pour une nouvelle
--                     tentative (voir l'index unique partiel)
--   rembourse       : capture puis rendu
do $$ begin
  create type public.payment_intent_status as enum
    ('en_attente', 'requiert_action', 'autorise', 'capture', 'echoue', 'annule', 'rembourse');
exception when duplicate_object then null; end $$;

-- UNE LIGNE PAR TENTATIVE, jamais une ligne par commande : une carte refusee
-- puis une carte acceptee, ce sont deux lignes. Sans cela, la trace du refus
-- disparait au moment ou on en aurait besoin (litige, reclamation client).
create table if not exists public.payment_intents (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  -- `on delete set null` : la suppression d'un compte ne doit pas effacer la
  -- trace comptable d'un encaissement reel.
  user_id            uuid references auth.users(id) on delete set null,

  provider           public.payment_provider not null default 'stripe',
  -- Le `pi_...`. NULL entre la creation de la ligne et la reponse de Stripe :
  -- on ecrit la ligne D'ABORD (pour tenir l'index unique partiel), on appelle
  -- Stripe ENSUITE. UNIQUE tolere plusieurs NULL, c'est ce qu'il faut ici.
  provider_intent_id text unique,

  status             public.payment_intent_status not null default 'en_attente',

  -- Ce qui est REELLEMENT debite, dans l'unite mineure de la devise.
  amount_minor       integer not null check (amount_minor > 0),
  currency           text not null default 'eur' check (currency = lower(currency)),

  -- Le montant d'origine et le taux FIGE au moment de la tentative. Le taux est
  -- copie, pas reference : si on le change demain, un remboursement ou un
  -- rapprochement comptable doit pouvoir refaire le calcul d'hier a l'identique.
  amount_ar          integer not null check (amount_ar > 0),
  fx_rate            numeric(10,2) not null check (fx_rate > 0),

  -- Envoyee a Stripe comme cle d'idempotence. Generee en base : l'Edge Function
  -- qui rejoue une ligne existante rejoue AUSSI sa cle, et Stripe lui rend le
  -- meme PaymentIntent au lieu d'en creer un second.
  idempotency_key    uuid not null unique default gen_random_uuid(),

  erreur             text,
  -- Le dernier evenement Stripe recu, brut. Sert a l'enquete quand les
  -- colonnes ne suffisent pas a expliquer un etat.
  raw_event          jsonb,

  created_at         timestamptz not null default now(),
  maj_le             timestamptz not null default now(),
  captured_at        timestamptz
);

comment on table public.payment_intents is
  'Une ligne par TENTATIVE de paiement. Ecrite uniquement par service_role depuis les Edge Functions.';

-- ⚠️ LE VERROU D'IDEMPOTENCE. Au plus un paiement vivant par commande.
-- Les etats terminaux ('capture','echoue','annule','rembourse') sont hors de
-- l'index : une carte refusee libere donc la commande pour une nouvelle
-- tentative, et une commande capturee ne peut plus en recevoir.
create unique index if not exists payment_intents_un_actif_par_commande
  on public.payment_intents (order_id)
  where status in ('en_attente', 'requiert_action', 'autorise');

create index if not exists payment_intents_order_id_idx on public.payment_intents (order_id);
create index if not exists payment_intents_status_idx    on public.payment_intents (status);

create or replace function public.payment_intents_maj_le()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.maj_le := now();
  return new;
end $$;

drop trigger if exists payment_intents_maj_le on public.payment_intents;
create trigger payment_intents_maj_le
  before update on public.payment_intents
  for each row execute function public.payment_intents_maj_le();

-- ============================================ 4. L'ETAT DE LA COMMANDE

do $$ begin
  create type public.order_payment_status as enum
    ('non_requis', 'en_attente', 'paye', 'echoue', 'rembourse');
exception when duplicate_object then null; end $$;

-- `non_requis` par defaut : c'est le cas des especes, et celui de toutes les
-- commandes deja en base.
alter table public.orders
  add column if not exists payment_status public.order_payment_status
    not null default 'non_requis';

comment on column public.orders.payment_status is
  'DEDUIT de payment_intents par un trigger. N''est ecrit ni par le front, ni par une RPC, ni par une Edge Function.';

-- Recalcule l'etat de paiement d'une commande a partir de TOUTES ses tentatives.
-- Recalcul complet plutot que transition incrementale : l'ordre d'arrivee des
-- webhooks Stripe n'est pas garanti, et un etat calcule depuis l'ensemble des
-- lignes donne le meme resultat quel que soit cet ordre.
create or replace function public.maj_payment_status_commande()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_statut   public.order_payment_status;
begin
  select case
           -- Priorite a l'argent encaisse : s'il existe une capture, la
           -- commande est payee, quoi qu'aient fait les tentatives ratees.
           when count(*) filter (where status = 'capture')   > 0 then 'paye'
           when count(*) filter (where status = 'rembourse') > 0 then 'rembourse'
           when count(*) filter (where status in ('en_attente','requiert_action','autorise')) > 0
                then 'en_attente'
           when count(*) filter (where status in ('echoue','annule')) > 0 then 'echoue'
           else 'non_requis'
         end::public.order_payment_status
    into v_statut
    from public.payment_intents where order_id = v_order_id;

  -- `is distinct from` : pas d'UPDATE inutile sur orders, donc pas de trigger
  -- reveille pour rien.
  update public.orders
     set payment_status = v_statut
   where id = v_order_id and payment_status is distinct from v_statut;

  return null;
end $$;

drop trigger if exists payment_intents_maj_commande on public.payment_intents;
create trigger payment_intents_maj_commande
  after insert or update of status or delete on public.payment_intents
  for each row execute function public.maj_payment_status_commande();

-- ================================================== 5. LES VERROUS

-- ⚠️ UN MONTANT AUTORISE NE BOUGE PLUS.
-- Sans ceci, un chemin admin (ou une future RPC de correction) pourrait
-- changer `total` apres qu'un PaymentIntent a ete cree sur l'ancien montant :
-- le client serait debite d'une somme differente de celle qu'il voit. Le
-- verrou est en base parce que le chemin d'ecriture n'est pas connu d'avance.
--
-- Les etats terminaux 'echoue' et 'annule' ne verrouillent pas : une tentative
-- ratee ne doit pas figer une commande pour toujours.
create or replace function public.verrouiller_montants_commande_payee()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.subtotal      is distinct from old.subtotal
  or new.packaging_fee is distinct from old.packaging_fee
  or new.delivery_fee  is distinct from old.delivery_fee
  or new.total         is distinct from old.total then
    if exists (select 1 from public.payment_intents pi
                where pi.order_id = old.id
                  and pi.status not in ('echoue', 'annule')) then
      raise exception
        'Montant verrouille : un paiement est engage sur la commande % — annule-le avant de modifier le total',
        coalesce(old.order_number, old.id::text)
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_verrou_montants on public.orders;
create trigger orders_verrou_montants
  before update on public.orders
  for each row execute function public.verrouiller_montants_commande_payee();

-- `mark_order_delivered` : on ajoute UNE garde. Le reste est repris a
-- l'identique de la version en base au 2026-09-06.
--
-- ⚠️ TOLERANCE TRANSITOIRE. Tant que `carte_active` est faux, « cb » designe
-- encore le terminal du livreur : aucun paiement en ligne n'a ete engage,
-- `payment_status` vaut 'non_requis', et le livreur doit pouvoir livrer. Des
-- que la carte en ligne est activee, toute commande « cb » exige 'paye'. Et
-- meme avant activation, une commande « cb » sur laquelle un paiement a ete
-- engage sans aboutir ('en_attente', 'echoue') est refusee.
create or replace function public.mark_order_delivered(p_order_id uuid, p_cash_confirmed boolean default false)
returns public.orders
language plpgsql security definer set search_path to 'public' as $$
declare
  v_order public.orders;
  v_rate  numeric(5,4);
  v_carte boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'Acces refuse a cette commande'; end if;
  if v_order.status <> 'en_livraison' or v_order.picked_up_at is null then
    raise exception 'Marque d''abord la commande comme recuperee';
  end if;
  if v_order.payment_method = 'especes' and not coalesce(p_cash_confirmed, false) then
    raise exception 'Confirme l''encaissement en especes';
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
        cash_confirmed = coalesce(p_cash_confirmed, false),
        commission_rate = v_rate,
        commission_amount = round(subtotal * v_rate)::integer
    where id = p_order_id returning * into v_order;
  return v_order;
end $$;

-- ======================================================= 6. LES ACCES

-- Qui a le droit de voir les paiements d'une commande. SECURITY DEFINER pour
-- que la policy n'ait pas a traverser la RLS d'`orders` a chaque ligne lue.
create or replace function public.peut_voir_paiements_commande(p_order_id uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id
       and (o.user_id = auth.uid()
            or public.is_admin()
            or public.is_active_restaurant_staff_of(o.restaurant_id))
  );
$$;

alter table public.payment_intents enable row level security;

-- ⚠️ AUCUNE POLICY D'ECRITURE, VOLONTAIREMENT. Insert/update/delete passent
-- exclusivement par `service_role` (qui contourne la RLS), depuis les Edge
-- Functions. Le predicat `auth.uid() is not null` respecte la regle du projet :
-- jamais `to authenticated` seul.
drop policy if exists payment_intents_select on public.payment_intents;
create policy payment_intents_select on public.payment_intents
  for select to authenticated
  using (auth.uid() is not null and public.peut_voir_paiements_commande(order_id));

-- Les privileges par defaut de Supabase accordent `arwd` sur toute table neuve
-- a anon et authenticated. On les reprend : la RLS suffirait, mais deux
-- barrieres valent mieux qu'une sur la table qui porte des montants.
revoke all on public.payment_intents from anon, authenticated;
grant select on public.payment_intents to authenticated;

alter table public.payment_config enable row level security;

-- Le taux doit etre LISIBLE PAR TOUS : le front affiche « 1 EUR = 4700 Ar »
-- avant paiement, y compris a un visiteur pas encore connecte. C'est une
-- exception assumee a la regle « jamais de policy sans predicat sur l'identite » :
-- l'information est publique par nature, et c'est le GRANT PAR COLONNE
-- ci-dessous — pas la policy — qui empeche de lire `maj_par` (une identite).
drop policy if exists payment_config_select on public.payment_config;
create policy payment_config_select on public.payment_config
  for select to anon, authenticated using (true);

drop policy if exists payment_config_update_admin on public.payment_config;
create policy payment_config_update_admin on public.payment_config
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.payment_config from anon, authenticated;
grant select (id, fx_ar_per_eur, devise_paiement, carte_active, montant_minimum_minor, maj_le)
  on public.payment_config to anon, authenticated;
grant update (fx_ar_per_eur, devise_paiement, carte_active, montant_minimum_minor, maj_le, maj_par)
  on public.payment_config to authenticated;

-- ============================================== 7. LES SECRETS STRIPE

-- Calque exact de `public.whatsapp_hook_config()` : une fonction SECURITY
-- DEFINER qui lit le Vault, reservee a `service_role`. Les Edge Functions
-- l'appellent ; personne d'autre ne peut.
--
-- ⚠️ AUCUN SECRET N'EST POSE AUJOURD'HUI. `stripe_secret_key` et
-- `stripe_webhook_secret` doivent etre deposes dans le Vault par le porteur du
-- projet lui-meme. En attendant, cette fonction renvoie des `null` et
-- `configure` vaut false : l'appelant doit rester INERTE et le dire, jamais
-- planter — c'est ce que `configure` est la pour permettre.
create or replace function public.stripe_config()
returns jsonb
language sql security definer set search_path to 'public', 'vault' as $$
  select jsonb_build_object(
    'secret_key',       (select decrypted_secret from vault.decrypted_secrets where name = 'stripe_secret_key'),
    'webhook_secret',   (select decrypted_secret from vault.decrypted_secrets where name = 'stripe_webhook_secret'),
    -- Publiable, mais range ici pour que tout Stripe vienne du meme endroit.
    'publishable_key',  (select decrypted_secret from vault.decrypted_secrets where name = 'stripe_publishable_key'),
    'devise',           (select devise_paiement from public.payment_config where id = 1),
    'carte_active',     (select carte_active     from public.payment_config where id = 1),
    -- Le seul drapeau que l'appelant doit tester avant d'appeler Stripe.
    'configure',        (select decrypted_secret from vault.decrypted_secrets where name = 'stripe_secret_key') is not null
  );
$$;

revoke all on function public.stripe_config() from public, anon, authenticated;
grant execute on function public.stripe_config() to service_role;

-- Les fonctions admin sont appelees depuis l'espace admin, donc par un
-- utilisateur authentifie : elles verifient `is_admin()` elles-memes.
revoke all on function public.admin_set_fx_rate(numeric)      from public, anon;
revoke all on function public.admin_set_carte_active(boolean) from public, anon;
grant execute on function public.admin_set_fx_rate(numeric)      to authenticated, service_role;
grant execute on function public.admin_set_carte_active(boolean) to authenticated, service_role;

grant execute on function public.montant_eur_centimes(integer) to anon, authenticated, service_role;
grant execute on function public.peut_voir_paiements_commande(uuid) to authenticated, service_role;
