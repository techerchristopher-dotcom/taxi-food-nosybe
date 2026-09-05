-- ============================================================================
-- Le client ne doit RIEN pouvoir ecrire lui-meme sur une commande
-- ============================================================================
--
-- Version appliquee en base : 20260905224856 (supabase_migrations.schema_migrations).
-- ⚠️ L'horodatage vient du serveur Supabase (UTC), pas de la machine qui a
--    ecrit ce fichier : le nom du fichier suit la BASE, pas l'heure locale.
--
-- CE QUI ETAIT OUVERT, ET CE QUE CA COUTAIT.
--
-- Les privileges par defaut de Supabase accordent `arwd` a `anon` ET
-- `authenticated` sur toute table du schema `public`. `payment_intents` et
-- `payment_config` ont bien ete revoquees a leur creation (migration
-- `socle_paiement_carte`, parti pris n°5). Mais `orders`, `order_items` et
-- `order_item_options` sont anterieures : personne ne les a jamais revoquees.
-- Sur ces trois tables il ne restait donc QUE la RLS, et elles sont les seules
-- du schema a porter une policy d'INSERT ouverte au client :
--
--   orders             : orders_insert_own              with check (auth.uid() = user_id)
--   order_items        : order_items_insert_own         with check (la commande est a moi)
--   order_item_options : order_item_options_insert_own  with check (idem)
--
-- Ces policies verifient A QUI appartient la ligne. Elles ne verifient RIEN sur
-- son contenu. Combinees au grant `INSERT` sur TOUTES les colonnes, elles
-- laissaient un client connecte court-circuiter `create_order` :
--
--   1. FAUSSE COMMANDE DEJA PAYEE. Un `insert into orders` a la main avec
--      `payment_status = 'paye'` et `payment_method = 'cb'`, sans le moindre
--      PaymentIntent en face. Verifie en base le 2026-09-06 : 250 000 Ar
--      encaisses sur le papier, zero euro chez Stripe. `mark_order_delivered`
--      ne voit qu'un `payment_status = 'paye'` et laisse livrer.
--      -> Le parti pris n°4 du socle (« il n'existe aucun chemin ou une
--         commande serait marquee payee sans qu'un paiement capture existe en
--         face ») etait faux : ce chemin-la ne passait pas par payment_intents.
--
--   2. REPAS AJOUTES APRES COUP. `create_order` calcule le total puis rend la
--      main ; un `insert into order_items` (ou `order_item_options`) ensuite
--      ajoute des plats a une commande deja chiffree. Le restaurant lit
--      `order_items` et prepare ce qu'il y voit ; `orders.total` ne bouge pas.
--      -> On commande un soda, on se fait livrer une pizza.
--
-- LA CORRECTION : retirer le grant. La RLS restait la derniere barriere sur
-- les tables qui portent les montants ; elle n'aurait jamais du l'etre seule.
--
-- POURQUOI CA NE CASSE RIEN.
-- `create_order`, `mark_order_delivered` et `basculer_en_especes` sont
-- SECURITY DEFINER et appartiennent a `postgres`, proprietaire des trois
-- tables : elles ecrivent en tant que proprietaire et ignorent ces grants.
-- Verifie avant d'appliquer : aucune source suivie de `app/`, `admin/` ou
-- `landing/` ne fait d'`insert` direct sur ces tables — tout passe par la RPC.
-- Les Edge Functions ecrivent en `service_role`, non concerne.
--
-- LES POLICIES NE SONT PAS TOUCHEES (consigne du chantier). Elles deviennent
-- simplement inatteignables : Postgres verifie le privilege AVANT la RLS.

revoke insert, update, delete, truncate on public.orders             from anon, authenticated;
revoke insert, update, delete, truncate on public.order_items        from anon, authenticated;
revoke insert, update, delete, truncate on public.order_item_options from anon, authenticated;

-- La lecture reste entiere : l'app, le restaurant, le livreur et l'admin
-- passent tous par des SELECT filtres par la RLS.
grant select on public.orders             to anon, authenticated;
grant select on public.order_items        to anon, authenticated;
grant select on public.order_item_options to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CEINTURE ET BRETELLES : `payment_status` est DEDUIT, jamais pose a la main.
--
-- Le socle l'affirme en commentaire ; ici on le rend vrai en base. Si un futur
-- `grant` malencontreux (ou un `alter default privileges` oublie) rouvrait
-- l'INSERT, une commande ne pourrait toujours pas naitre « payee » : seul le
-- trigger `payment_intents_maj_commande` peut faire bouger cette colonne,
-- depuis une vraie ligne `payment_intents` ecrite par le webhook signe.
--
-- `create_order` n'a jamais renseigne cette colonne (elle prend son defaut
-- `non_requis`) : forcer la valeur ne change donc rien au parcours normal.
create or replace function public.forcer_payment_status_a_l_insertion()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.payment_status := 'non_requis';
  return new;
end $$;

revoke all on function public.forcer_payment_status_a_l_insertion() from public, anon, authenticated;

drop trigger if exists orders_payment_status_neuf on public.orders;
create trigger orders_payment_status_neuf
  before insert on public.orders
  for each row execute function public.forcer_payment_status_a_l_insertion();

comment on function public.forcer_payment_status_a_l_insertion() is
  'Une commande naît toujours non_requis. Seul le trigger payment_intents_maj_commande peut ensuite la marquer payee.';
