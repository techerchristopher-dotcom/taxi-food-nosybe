-- Les sélections partagées : un lien unique pour annoncer les plats du jour.
--
-- Aujourd'hui le fondateur n'a rien à envoyer sur WhatsApp ou Facebook : la
-- carte de l'application est rangée par restaurant, et un client qui reçoit le
-- lien de l'accueil doit deviner où regarder. Une SÉLECTION est une liste
-- courte, choisie à la main, qui peut piocher chez plusieurs restaurants à la
-- fois et qui vit à sa propre adresse :
--   https://taxifoodnosybe.distripro207.com/s/<uuid>
--   https://taxifoodnosybe.distripro207.com/s/<uuid>/apercu.jpg  (l'image du post)
--
-- ⚠️ Vocabulaire : « à l'affiche » est DÉJÀ pris. products.is_featured et
-- products.featured_label désignent le plat du jour d'UN restaurant, choisi par
-- le restaurateur depuis son espace partenaire. Une sélection est l'autre
-- notion : elle appartient au fondateur, elle traverse les restaurants, et elle
-- ne touche à aucune colonne de products. Les deux cohabitent sans se voir.
--
-- ⚠️ RIEN N'EST GELÉ ICI, et c'est la décision centrale de ce fichier.
-- La convention maison est pourtant de figer ce qui a été annoncé (une remise,
-- une commission). Ici, c'est l'inverse qu'il faut : le nom, le prix et la
-- photo sont relus EN DIRECT dans products à chaque ouverture de la page. La
-- raison est le client, pas la technique — une page qui affiche encore 30 000 Ar
-- alors que le restaurant en demande 35 000 ment à celui qui la lit, et c'est
-- lui qui paiera la différence à la caisse. Un post qui vieillit doit devenir
-- juste, pas rester joli. Conséquences assumées :
--   * un plat supprimé disparaît de la sélection (cascade sur products) ;
--   * un plat archivé, indisponible, en « bientôt disponible », ou dont le
--     restaurant n'est pas encore ouvert au public, est filtré à la lecture ;
--   * une sélection vidée de tous ses plats ne rend plus aucune ligne, et la
--     page doit le dire honnêtement plutôt que d'afficher un cadre vide.
-- C'est aussi pour cela que la durée de vie est obligatoire (expire_le not
-- null) : une annonce de plats du jour qui traîne six mois sur Facebook n'a
-- plus rien à voir avec ce qui sort de la cuisine.
--
-- ⚠️ Le panier de l'application est MONO-RESTAURANT (app/store/cart.ts,
-- canAdd). C'est pour cela que selection_publique rend restaurant_id et
-- restaurant_nom sur chaque ligne : la page DOIT grouper les plats par
-- restaurant et laisser le client comprendre qu'un plat chez deux enseignes,
-- c'est deux commandes. Ne pas masquer cette vérité derrière une mise en page.
--
-- ⚠️ Aucune écriture directe : les deux tables sont sous RLS sans la moindre
-- policy et sans le moindre grant. Tout passe par les fonctions ci-dessous.
-- Sans le revoke explicite, Supabase accorde par défaut tous les droits à anon
-- et authenticated sur toute nouvelle table du schéma public : la table
-- naîtrait lisible ET écrivable par n'importe quel visiteur.

-- =====================================================================
-- 1. Les deux tables
-- =====================================================================

-- cree_par n'a volontairement PAS de clé étrangère vers auth.users : le jour où
-- un compte d'administration est supprimé, on veut garder la trace de qui a
-- publié quoi, pas voir la sélection s'effacer ni la suppression échouer.
create table if not exists public.selections (
  id        uuid primary key default gen_random_uuid(),
  titre     text not null,
  cree_par  uuid not null,
  cree_le   timestamptz not null default now(),
  expire_le timestamptz not null,
  actif     boolean not null default true
);

comment on table public.selections is
  'Sélection partagée : une liste de plats choisie par le fondateur, multi-restaurants, publiée à son propre lien. À ne pas confondre avec products.is_featured (le plat du jour d''UN restaurant, choisi par le restaurateur). Écriture par RPC admin uniquement.';

comment on column public.selections.expire_le is
  'Obligatoire : une annonce de plats du jour doit cesser d''être servie. Passée cette date, selection_publique ne rend plus aucune ligne.';

-- product_id en ON DELETE CASCADE : un plat supprimé s'efface de la sélection.
-- C'est voulu — mieux vaut une ligne en moins qu'une ligne qui promet un plat
-- que le restaurant ne fait plus. ⚠️ Ce cas arrive vraiment : archive_product
-- SUPPRIME physiquement un plat jamais commandé, il ne l'archive que s'il est
-- référencé par une commande.
create table if not exists public.selection_items (
  id           uuid primary key default gen_random_uuid(),
  selection_id uuid not null references public.selections(id) on delete cascade,
  product_id   uuid not null references public.products(id)   on delete cascade,
  rang         integer not null,
  unique (selection_id, product_id)
);

comment on table public.selection_items is
  'Les plats d''une sélection, dans l''ordre voulu par le fondateur (rang). Ne stocke QUE le lien vers le plat : nom, prix et photo sont relus en direct dans products à chaque lecture.';

-- L'index de lecture de la page : une sélection, ses lignes, dans l'ordre.
create index if not exists selection_items_selection_rang_idx
  on public.selection_items (selection_id, rang);

-- La contrainte unique indexe (selection_id, product_id) : elle ne sert donc à
-- rien pour retrouver un plat. Sans cet index-ci, la suppression d'un produit
-- balaierait toute la table pour honorer la cascade.
create index if not exists selection_items_produit_idx
  on public.selection_items (product_id);

-- L'écran d'administration liste d'abord les sélections vivantes, du plus
-- récent au plus ancien.
create index if not exists selections_actives_idx
  on public.selections (cree_le desc) where actif;

-- =====================================================================
-- 2. Fermeture : RLS, aucune policy, aucun grant
-- =====================================================================
-- RLS activée ET aucune policy : même un compte authentifié ne lit rien en
-- direct. Le revoke retire les droits posés par ALTER DEFAULT PRIVILEGES de
-- Supabase — « revoke ... from public » ne retire PAS anon et authenticated,
-- qui sont nommés explicitement.
alter table public.selections      enable row level security;
alter table public.selection_items enable row level security;

revoke all on table public.selections      from public, anon, authenticated;
revoke all on table public.selection_items from public, anon, authenticated;

-- =====================================================================
-- 3. La règle d'éligibilité, écrite UNE SEULE FOIS
-- =====================================================================
-- Elle sert à deux endroits — refuser un plat à la création, et le filtrer à la
-- lecture. Les deux doivent dire exactement la même chose : un plat accepté le
-- matin et devenu indisponible le soir doit disparaître tout seul de la page.
-- Prend les lignes entières (comme commandable_maintenant(restaurants)) pour ne
-- pas refaire une lecture par plat.
--
-- ⚠️ On ne teste PAS l'horaire d'ouverture ici : une sélection se prépare le
-- matin pour le soir, et un restaurant fermé à l'instant de la publication
-- rouvrira. C'est la page qui peint « fermé maintenant » en relisant
-- commandable_maintenant(restaurants).
create or replace function public.selection_plat_commandable(
  p public.products,
  r public.restaurants)
returns boolean
language sql
stable
set search_path = public
as $$
  select not p.is_archived
     and p.is_available
     and p.listing_status = 'visible'
     and r.listing_status = 'visible';
$$;

comment on function public.selection_plat_commandable(public.products, public.restaurants) is
  'Un plat est-il présentable dans une sélection ? Même règle à la création et à la lecture. Fonction interne : execute retiré à tout le monde.';

-- =====================================================================
-- 4. La lecture publique — c'est ELLE que lisent la page et l'image
-- =====================================================================
-- SECURITY DEFINER parce que les tables ne sont lisibles par personne : la
-- fonction est la seule porte, et elle ne montre que ce qui est montrable.
-- Rend ZÉRO ligne si la sélection est inconnue, désactivée ou expirée — le
-- visiteur ne peut donc pas distinguer un lien faux d'un lien périmé, et la
-- page n'a qu'un seul cas vide à traiter.
--
-- Appel PostgREST : POST /rest/v1/rpc/selection_publique  body {"p_id":"<uuid>"}
create or replace function public.selection_publique(p_id uuid)
returns table(titre text, expire_le timestamptz, rang integer,
              product_id uuid, nom text, prix integer, photo_url text,
              restaurant_id uuid, restaurant_nom text)
language sql
stable
security definer
set search_path = public
as $$
  -- Toutes les colonnes sont qualifiées : dans une fonction SQL, un nom nu
  -- pourrait désigner aussi bien une colonne qu'un paramètre de sortie.
  select s.titre,
         s.expire_le,
         i.rang,
         p.id,
         p.name,
         p.price,
         p.photo_url,
         r.id,
         r.name
    from public.selections s
    join public.selection_items i on i.selection_id = s.id
    join public.products p        on p.id = i.product_id
    join public.restaurants r     on r.id = p.restaurant_id
   where s.id = p_id
     and s.actif
     and s.expire_le > now()
     and public.selection_plat_commandable(p, r)
   -- p.name départage deux plats au même rang : l'ordre reste stable d'une
   -- ouverture à l'autre, y compris pour l'image assemblée.
   order by i.rang, p.name;
$$;

comment on function public.selection_publique(uuid) is
  'Lecture publique d''une sélection : titre, date de fin, et les plats encore commandables, dans l''ordre. Prix, nom et photo lus en direct. Zéro ligne si la sélection est inconnue, désactivée ou expirée.';

-- =====================================================================
-- 5. Les trois RPC d'administration
-- =====================================================================
-- ⚠️ Signatures FIGÉES du premier coup. « create or replace » n'écrase pas une
-- fonction dont les paramètres diffèrent : il AJOUTE une surcharge, et
-- PostgREST répond alors PGRST203 « Could not choose the best candidate
-- function » — panne invisible jusqu'au prochain appel. Pour ajouter un
-- paramètre plus tard, écrire d'abord le « drop function » de la signature
-- complète dans la migration.
--
-- ⚠️ is_admin() en PREMIÈRE ligne du corps de chacune : l'écran admin n'est pas
-- l'autorité, un appel direct à l'API avec un jeton client doit échouer pareil.
-- Le libellé de l'exception est identique à celui des autres RPC admin du
-- dépôt, pour qu'un seul grep les retrouve toutes.

-- Tout se fait en UN appel : l'en-tête et ses lignes dans la même transaction.
-- Sinon une sélection vide pourrait être publiée puis partagée telle quelle.
create or replace function public.admin_creer_selection(
  p_titre          text,
  p_product_ids    uuid[],
  p_validite_jours integer default 7)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titre     text    := btrim(coalesce(p_titre, ''));
  v_nb        integer := coalesce(array_length(p_product_ids, 1), 0);
  v_nb_restos integer;
  v_fautif    text;
  v_id        uuid;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  if v_titre = '' then
    raise exception 'Titre de la sélection manquant';
  end if;
  if length(v_titre) > 80 then
    raise exception 'Titre trop long : 80 caractères au maximum (reçu : %)', length(v_titre);
  end if;

  if p_validite_jours is null or p_validite_jours < 1 or p_validite_jours > 90 then
    raise exception 'Validité entre 1 et 90 jours';
  end if;

  -- 1 à 12 plats : en dessous il n'y a rien à partager, au-dessus l'image
  -- assemblée devient illisible sur un téléphone.
  if v_nb < 1 or v_nb > 12 then
    raise exception 'Une sélection porte de 1 à 12 plats (reçu : %)', v_nb;
  end if;

  if exists (select 1 from unnest(p_product_ids) u where u is null) then
    raise exception 'Identifiant de plat vide dans la sélection';
  end if;

  -- Refuser plutôt que dédoublonner en silence : un doublon est une erreur de
  -- l'écran de sélection, et la contrainte unique rendrait sinon une erreur
  -- Postgres illisible à l'écran.
  if v_nb <> (select count(distinct u) from unnest(p_product_ids) u) then
    raise exception 'Le même plat figure deux fois dans la sélection';
  end if;

  -- On nomme le plat fautif : « Plat indisponible » tout seul oblige l'admin à
  -- rouvrir ses douze plats un par un pour trouver lequel coince.
  select coalesce(p.name, '(plat introuvable : ' || u.id::text || ')')
    into v_fautif
    from unnest(p_product_ids) with ordinality as u(id, rang)
    left join public.products p    on p.id = u.id
    left join public.restaurants r on r.id = p.restaurant_id
   where p.id is null
      or not public.selection_plat_commandable(p, r)
   order by u.rang
   limit 1;

  if v_fautif is not null then
    raise exception 'Plat introuvable ou pas commandable : %', v_fautif;
  end if;

  -- 5 restaurants au maximum : au-delà, la page cesse d'être une sélection et
  -- redevient un annuaire, et le client repart avec autant de commandes
  -- séparées que d'enseignes (panier mono-restaurant).
  select count(distinct p.restaurant_id) into v_nb_restos
    from public.products p
   where p.id = any(p_product_ids);

  if v_nb_restos > 5 then
    raise exception '5 restaurants au maximum dans une sélection (reçu : %)', v_nb_restos;
  end if;

  insert into public.selections (titre, cree_par, expire_le)
  values (v_titre, auth.uid(), now() + make_interval(days => p_validite_jours))
  returning id into v_id;

  -- Le rang suit l'ordre du tableau reçu : c'est l'ordre que l'admin a posé à
  -- l'écran, et celui dans lequel la page et l'image peindront les plats.
  insert into public.selection_items (selection_id, product_id, rang)
  select v_id, u.id, u.rang::integer
    from unnest(p_product_ids) with ordinality as u(id, rang);

  insert into public.admin_actions (admin_id, action, avant, apres, motif)
  values (auth.uid(), 'selection_creee', null, v_id::text, v_titre);

  return v_id;
end;
$$;

comment on function public.admin_creer_selection(text, uuid[], integer) is
  'Crée une sélection et ses plats en un appel. 1 à 12 plats, 5 restaurants au maximum, titre de 80 caractères au plus, validité de 1 à 90 jours. Refuse en nommant le plat fautif.';

-- Les compteurs sont calculés en direct : une sélection dont un plat a été
-- supprimé affiche honnêtement un plat de moins, sans qu'on ait à la rattraper.
create or replace function public.admin_lister_selections(p_limite integer default 50)
returns table(id uuid, titre text, cree_le timestamptz, expire_le timestamptz,
              actif boolean, nb_plats integer, nb_restaurants integer,
              restaurants text[])
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  return query
  select s.id,
         s.titre,
         s.cree_le,
         s.expire_le,
         s.actif,
         c.nb_plats,
         c.nb_restaurants,
         coalesce(c.restaurants, array[]::text[])
    from public.selections s
    left join lateral (
      select count(*)::integer                        as nb_plats,
             count(distinct r.id)::integer            as nb_restaurants,
             array_agg(distinct r.name order by r.name) as restaurants
        from public.selection_items i
        join public.products p    on p.id = i.product_id
        join public.restaurants r on r.id = p.restaurant_id
       where i.selection_id = s.id
    ) c on true
   -- Les expirées et les désactivées restent listées : l'admin doit pouvoir
   -- retrouver ce qu'il a publié la semaine dernière et savoir qu'il est éteint.
   order by s.cree_le desc
   limit greatest(1, least(coalesce(p_limite, 50), 200));
end;
$$;

comment on function public.admin_lister_selections(integer) is
  'Liste les sélections, de la plus récente à la plus ancienne, avec le nombre de plats et les restaurants concernés (comptés en direct). Les sélections expirées ou désactivées restent visibles.';

-- Désactiver, jamais supprimer : le lien a été partagé, il continuera d'être
-- ouvert pendant des semaines. Une sélection désactivée rend zéro ligne, ce que
-- la page sait dire ; une sélection supprimée laisserait le même vide sans
-- qu'on sache si elle a existé.
create or replace function public.admin_desactiver_selection(p_selection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_selection public.selections;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  select * into v_selection
    from public.selections
   where id = p_selection_id
   for update;

  if v_selection.id is null then
    raise exception 'Sélection introuvable';
  end if;

  update public.selections set actif = false where id = v_selection.id;

  insert into public.admin_actions (admin_id, action, avant, apres, motif)
  values (auth.uid(), 'selection_desactivee',
          case when v_selection.actif then 'actif' else 'inactif' end,
          'inactif', v_selection.titre);
end;
$$;

comment on function public.admin_desactiver_selection(uuid) is
  'Éteint une sélection : le lien partagé cesse de rendre des plats. Ne supprime jamais, et journalise dans admin_actions.';

-- =====================================================================
-- 6. Droits
-- =====================================================================
-- Signature complète recopiée à chaque ligne : « revoke ... from public » ne
-- retire rien à anon ni à authenticated, que Supabase sert par défaut sur toute
-- fonction neuve du schéma public.

-- La seule fonction ouverte au visiteur non connecté.
revoke all on function public.selection_publique(uuid) from public;
grant execute on function public.selection_publique(uuid) to anon, authenticated;

revoke all on function public.admin_creer_selection(text, uuid[], integer) from public, anon;
revoke all on function public.admin_lister_selections(integer) from public, anon;
revoke all on function public.admin_desactiver_selection(uuid) from public, anon;

grant execute on function public.admin_creer_selection(text, uuid[], integer) to authenticated;
grant execute on function public.admin_lister_selections(integer) to authenticated;
grant execute on function public.admin_desactiver_selection(uuid) to authenticated;

-- Fonction interne : personne ne l'appelle directement, seules les fonctions
-- SECURITY DEFINER ci-dessus s'en servent (leur propriétaire garde son droit).
revoke all on function public.selection_plat_commandable(public.products, public.restaurants)
  from public, anon, authenticated;
