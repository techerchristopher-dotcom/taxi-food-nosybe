-- Commande saisie par telephone depuis l'admin (2026-09-17).
--
-- Un client appelle, le porteur du projet saisit sa commande et elle part dans
-- le circuit EXISTANT : pas une ligne d'ecriture dans `orders` ici. Tout passe
-- par `create_order` (5 arguments), donc par ses gardes : restaurant commandable
-- maintenant, categorie servie a cette heure, produit disponible, options
-- valides et groupes obligatoires, prix relus en base, frais de livraison relus,
-- GPS obligatoire. Puis les memes triggers : numero TF-, jeton d'acceptation,
-- notification DIFFEREE au commit (Telegram restaurant + liens /a/, push, copie
-- Telegram au patron, e-mail n8n).
--
-- Choix (a valider par le porteur du projet) :
--   * La commande appartient au COMPTE ADMIN qui la saisit (`auth.uid()`),
--     jamais au compte d'un client retrouve par son numero : un appelant peut
--     donner le numero d'un autre, et on ne cree aucun compte. Consequence :
--     les push « client » (confirmee, en route…) arrivent sur le telephone de
--     l'admin, et la commande figure dans SON onglet Commandes de l'app.
--   * Nom et telephone du client vivent dans `commandes_telephone` et sur
--     l'adresse de livraison (`phone`, que l'app des restaurants et des livreurs
--     affiche deja en priorite). Le libelle d'adresse porte « ☎ <nom> ».
--   * Paiement : especes a la livraison, seulement. Aucun code promo.
--   * GPS toujours obligatoire (garde de `create_order` inchangee) : la position
--     vient d'un lien Google Maps ou d'une localisation WhatsApp collee dans
--     l'ecran. Pas de coordonnees de « centre de zone » : une fausse position
--     envoie le livreur au mauvais endroit (adresse en pleine mer, 2026-09-10).

-- ---------------------------------------------------------------- la trace
create table if not exists public.commandes_telephone (
  order_id          uuid primary key references public.orders(id) on delete cascade,
  address_id        uuid references public.addresses(id) on delete set null,
  client_nom        text not null check (length(btrim(client_nom)) between 1 and 80),
  client_telephone  text not null check (client_telephone ~ '^\+?[0-9]{8,15}$'),
  telephone_norme   text generated always as (public.normaliser_telephone(client_telephone)) stored,
  saisie_par        uuid not null references public.profiles(id),
  saisie_le         timestamptz not null default now()
);
create index if not exists commandes_telephone_norme_idx
  on public.commandes_telephone (telephone_norme, saisie_le desc);

-- Aucune policy, aucun grant : lecture et ecriture par les seules fonctions
-- SECURITY DEFINER ci-dessous.
alter table public.commandes_telephone enable row level security;
revoke all on public.commandes_telephone from public, anon, authenticated;

-- ---------------------------------------------------------------- la saisie
create or replace function public.admin_commande_telephone(
  p_restaurant_id    uuid,
  p_client_nom       text,
  p_client_telephone text,
  p_zone             text,
  p_repere           text,
  p_latitude         double precision,
  p_longitude        double precision,
  p_items            jsonb
) returns table (order_id uuid, order_number text, total integer)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_nom     text := btrim(coalesce(p_client_nom, ''));
  v_tel     text := regexp_replace(coalesce(p_client_telephone, ''), '[^0-9+]', '', 'g');
  v_zone    text := btrim(coalesce(p_zone, ''));
  v_adresse uuid;
  v_o       public.orders;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if v_nom = '' then
    raise exception 'telephone:nom_manquant' using errcode = '22023';
  end if;
  if v_tel !~ '^\+?[0-9]{8,15}$' then
    raise exception 'telephone:numero_invalide' using errcode = '22023';
  end if;
  if v_zone = '' then
    raise exception 'telephone:zone_manquante' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'telephone:position_manquante' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'telephone:panier_vide' using errcode = '22023';
  end if;

  insert into public.addresses (user_id, label, zone, landmark, phone, is_default,
                                latitude, longitude, location_captured_at)
  values (v_uid, '☎ ' || v_nom, v_zone, nullif(btrim(coalesce(p_repere, '')), ''), v_tel, false,
          p_latitude, p_longitude, now())
  returning id into v_adresse;

  -- LE circuit de l'app, a l'identique. Une seule evaluation (`select * from`).
  select * into v_o
    from public.create_order(p_restaurant_id, v_adresse, 'especes'::text, p_items, null::text);

  insert into public.commandes_telephone (order_id, address_id, client_nom, client_telephone, saisie_par)
  values (v_o.id, v_adresse, v_nom, v_tel, v_uid);

  return query select v_o.id, v_o.order_number, v_o.total;
end $$;

revoke all on function public.admin_commande_telephone(uuid, text, text, text, text, double precision, double precision, jsonb)
  from public, anon;
grant execute on function public.admin_commande_telephone(uuid, text, text, text, text, double precision, double precision, jsonb)
  to authenticated;

-- ------------------------------------------- le client a deja appele ?
-- Derniere commande telephone de ce numero : nom, zone, repere, position.
create or replace function public.admin_client_telephone_connu(p_telephone text)
returns table (client_nom text, zone text, repere text, latitude double precision,
               longitude double precision, derniere_commande timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  return query
  select ct.client_nom, a.zone, a.landmark, a.latitude, a.longitude, ct.saisie_le
    from public.commandes_telephone ct
    left join public.addresses a on a.id = ct.address_id
   where ct.telephone_norme = public.normaliser_telephone(p_telephone)
   order by ct.saisie_le desc
   limit 1;
end $$;

revoke all on function public.admin_client_telephone_connu(text) from public, anon;
grant execute on function public.admin_client_telephone_connu(text) to authenticated;

-- ------------------------------ le restaurant lit le VRAI client, pas l'admin
-- `notify_order_status()` : seul le bloc `client` de la charge utile change.
-- Nom et telephone de `commandes_telephone` priment ; e-mail omis (ce serait
-- celui de l'admin). Tout le reste du corps est conserve a l'octet pres —
-- relecture differee, garde carte, liens /a/ : voir CLAUDE.md « commande VIDE ».
do $migration$
declare
  v_def text := pg_get_functiondef('public.notify_order_status()'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def,
    $a$'client', jsonb_build_object('nom',p.full_name,'email',u.email,
      'telephone',coalesce(p.phone,a.phone)),$a$,
    $b$'client', jsonb_build_object('nom',coalesce(ct.client_nom,p.full_name),
      'email',case when ct.order_id is null then u.email end,
      'telephone',coalesce(ct.client_telephone,p.phone,a.phone),
      'par_telephone',(ct.order_id is not null)),$b$);
  if v_new = v_def then
    raise exception 'notify_order_status : bloc client introuvable, migration annulee';
  end if;
  v_def := v_new;
  v_new := replace(v_def,
    $a$   left join public.addresses a on a.id = v_o.address_id
$a$,
    $b$   left join public.addresses a on a.id = v_o.address_id
   left join public.commandes_telephone ct on ct.order_id = v_o.id
$b$);
  if v_new = v_def then
    raise exception 'notify_order_status : jointure adresses introuvable, migration annulee';
  end if;
  execute v_new;
end $migration$;
