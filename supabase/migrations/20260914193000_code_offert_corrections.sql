-- Code offert nominatif : corrections apres verification independante.
--
-- Quatre defauts reproduits le 2026-09-15 sur la base live, en transaction
-- annulee, apres 20260914190000 et 20260914191000 :
--
--   1. Le code se consommait deux fois. Le trigger qui rend le code a
--      l'annulation ne regardait pas d'ou venait la commande : un repas LIVRE
--      (donc mange) puis annule par l'admin rendait le cadeau. Et comme
--      admin_set_order_status accepte toute transition, une commande annulee
--      remise en « confirmee » ou « livree » gardait sa remise alors que le code
--      etait redevenu libre. Le client le rejouait, le restaurant payait deux fois.
--   2. Un code « livraison » cree avec les valeurs par defaut etait paye par le
--      RESTAURANT. Or la livraison revient a Taxi Food : le restaurant payait une
--      course qu'il n'encaisse pas, sa commission baissait, et sur une biere
--      seule son du tombait a -2 000 Ar.
--   3. Les applications deja installees n'appellent que verifier_code_promo, qui
--      ne connait que le sous-total, boissons comprises. Pour un repas offert
--      hors boissons, l'ecran annoncait « Margherita + Beaufort : 12 000 Ar » et
--      create_order facturait 18 000 Ar. En carte, le client aurait ete debite
--      de plus que ce qu'il a lu.
--
-- (Le quatrieme, le rapport admin qui ignore la part offerte par le restaurant,
-- vit dans admin/components/Report.tsx : hors de ce fichier.)
--
-- ⚠️ Aucune signature ne change : memes noms, meme ordre, memes types. Seul le
-- DEFAUT de p_pris_en_charge_par passe de 'restaurant' a null, ce que
-- create or replace accepte sans ajouter de surcharge.
-- ⚠️ Aucune nouvelle raison de refus cote client : on reutilise deja_utilise.

-- =====================================================================
-- 1. Rendre le code seulement si le repas n'a pas ete servi, et le reprendre
--    si la commande sort de l'annulation
-- =====================================================================
-- On corrige dans le trigger, pas dans admin_set_order_status : l'annulation
-- arrive aussi par le restaurateur et par le lien de refus, et une regle posee
-- sur un seul chemin se contourne par les autres.
--
-- Sortie d'annulation : on remet la redemption en place plutot que d'interdire
-- la transition. Un admin qui a annule par erreur doit pouvoir revenir en
-- arriere ; ce qu'il ne doit pas pouvoir faire, c'est offrir le repas deux fois.
-- Si le client a deja rejoue le code entre-temps, la reactivation echoue et
-- l'admin lit pourquoi : la commande reste annulee.
create or replace function public.liberer_code_promo_annulation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes;
  v_n    integer;
begin
  -- Entree en annulation : le code n'est rendu que si le client n'a rien mange.
  -- Une commande livree puis annulee (correction, remboursement) garde son code
  -- consomme : le geste a bien eu lieu.
  if new.status = 'annulee' and old.status is distinct from 'annulee' then
    if old.status is distinct from 'livree' and new.delivered_at is null then
      delete from public.promo_redemptions pr
       using public.promo_codes pc
       where pr.order_id = new.id
         and pc.id = pr.code_id
         and pc.beneficiaire_id is not null;
    end if;
    return null;
  end if;

  -- Sortie d'annulation d'une commande qui porte encore sa remise.
  if old.status = 'annulee' and new.status is distinct from 'annulee'
     and new.promo_code is not null and coalesce(new.promo_discount, 0) > 0 then
    select * into v_code from public.promo_codes
     where code_normalise = new.promo_code
       and beneficiaire_id is not null
     for update;

    -- Code public (TAXIFOOD50...) : jamais rendu, donc rien a reprendre.
    if v_code.id is null then
      return null;
    end if;

    -- Deja en place (commande livree puis annulee : on ne l'avait pas rendu).
    if exists (select 1 from public.promo_redemptions where order_id = new.id and code_id = v_code.id) then
      return null;
    end if;

    select count(*) into v_n from public.promo_redemptions where code_id = v_code.id;
    if v_code.max_utilisations is not null and v_n >= v_code.max_utilisations then
      raise exception 'code_promo:deja_utilise — le code % a ete reutilise depuis l''annulation : la commande % ne peut pas etre reactivee avec sa remise',
        v_code.code, coalesce(new.order_number, new.id::text)
        using errcode = '22023';
    end if;

    begin
      insert into public.promo_redemptions (code_id, user_id, order_id, montant_remise)
      values (v_code.id, new.user_id, new.id, new.promo_discount);
    exception when unique_violation then
      raise exception 'code_promo:deja_utilise — le code % a ete reutilise depuis l''annulation : la commande % ne peut pas etre reactivee avec sa remise',
        v_code.code, coalesce(new.order_number, new.id::text)
        using errcode = '22023';
    end;
  end if;

  return null;
end
$$;

revoke all on function public.liberer_code_promo_annulation() from public, anon, authenticated;

-- Le trigger existe deja (20260914190000) et pointe sur cette fonction : rien a
-- recreer.

-- =====================================================================
-- 2. Une livraison offerte est payee par Taxi Food
-- =====================================================================
-- La base l'impose, pas seulement l'ecran admin : un code livraison paye par un
-- restaurant ferait baisser sa commission sur une course qu'il n'encaisse pas,
-- et pourrait rendre son du negatif. Avec cette contrainte, la part d'un
-- restaurant ne vient plus que d'un code sur les plats, ou remise_promo plafonne
-- deja la remise a la base (plats + emballage) : le du ne peut plus passer sous 0.
-- Seul code existant : TAXIFOOD50, livraison payee par Taxi Food.
alter table public.promo_codes
  drop constraint if exists promo_codes_livraison_payee_par_taxi_food;
alter table public.promo_codes
  add constraint promo_codes_livraison_payee_par_taxi_food
  check (porte_sur <> 'livraison' or pris_en_charge_par = 'taxi_food');

-- Defaut selon l'offre : repas -> restaurant (decision 2), livraison -> Taxi Food.
-- Un choix explicite « restaurant » pour une livraison est refuse en clair plutot
-- que corrige en silence : l'admin doit savoir que ce n'est pas ce qu'il a demande.
create or replace function public.admin_creer_codes_offerts(
  p_user_ids uuid[],
  p_restaurant_id uuid,
  p_offre text,
  p_plafond integer default 37000,
  p_inclut_boissons boolean default false,
  p_validite_jours integer default 30,
  p_motif text default null,
  p_commande_origine_id uuid default null,
  p_pris_en_charge_par text default null,
  p_code_force text default null)
returns table(code_id uuid, code text, user_id uuid, full_name text, email text, telephone text, expire_le timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_ids      uuid[];
  v_uid      uuid;
  v_nom      text;
  v_base     text;
  v_candidat text;
  v_suffixe  integer;
  v_code     public.promo_codes;
  v_expire   timestamptz;
  v_motif    text := nullif(btrim(coalesce(p_motif, '')), '');
  v_force    text;
  v_repas    boolean;
  v_charge   text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  if p_offre is null or p_offre not in ('repas', 'livraison') then
    raise exception 'Offre inconnue : repas ou livraison';
  end if;
  v_repas := (p_offre = 'repas');

  v_charge := coalesce(p_pris_en_charge_par, case when v_repas then 'restaurant' else 'taxi_food' end);
  if v_charge not in ('restaurant', 'taxi_food') then
    raise exception 'Prise en charge inconnue : restaurant ou taxi_food';
  end if;
  if not v_repas and v_charge = 'restaurant' then
    raise exception 'Une livraison offerte est payee par Taxi Food : la livraison lui revient, le restaurant ne peut pas la prendre en charge';
  end if;

  if p_validite_jours is null or p_validite_jours < 1 or p_validite_jours > 365 then
    raise exception 'Validite entre 1 et 365 jours';
  end if;

  if v_repas and (p_plafond is null or p_plafond <= 0) then
    raise exception 'Plafond du repas offert manquant ou nul';
  end if;

  -- Decision 2 : un code offert ne vaut que dans le restaurant qui fait le geste.
  -- Meme un geste de Taxi Food se rattache a un restaurant : sinon le code
  -- servirait partout, ce qu'aucun geste commercial n'a promis.
  if p_restaurant_id is null
     or not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'Restaurant introuvable';
  end if;

  if p_commande_origine_id is not null
     and not exists (select 1 from public.orders oo where oo.id = p_commande_origine_id) then
    raise exception 'Commande d''origine introuvable';
  end if;

  -- Doublons et trous retires, ordre de selection conserve.
  select array_agg(t.u order by t.pos) into v_ids
    from (select x.u, min(x.ord) as pos
            from unnest(p_user_ids) with ordinality as x(u, ord)
           where x.u is not null
           group by x.u) t;

  if v_ids is null then
    raise exception 'Aucun client selectionne';
  end if;

  if exists (select 1 from unnest(v_ids) as x(u)
              where not exists (select 1 from auth.users au where au.id = x.u)) then
    raise exception 'Client introuvable dans la selection';
  end if;

  -- Un nom force (« MERCIFAMILLE ») ne peut designer qu'UN code : a plusieurs
  -- clients il faudrait de toute facon suffixer, et ce ne serait plus le nom voulu.
  if nullif(btrim(coalesce(p_code_force, '')), '') is not null then
    if cardinality(v_ids) > 1 then
      raise exception 'Un nom de code force ne vaut que pour un seul client';
    end if;
    v_force := upper(regexp_replace(public.texte_sans_accents(p_code_force), '[^a-z0-9]', '', 'g'));
    if length(v_force) < 4 or length(v_force) > 30 then
      raise exception 'Nom de code force : 4 a 30 lettres ou chiffres';
    end if;
  end if;

  v_expire := now() + make_interval(days => p_validite_jours);

  foreach v_uid in array v_ids loop
    select p.full_name into v_nom from public.profiles p where p.id = v_uid;
    v_base    := coalesce(v_force, public.code_offert_nom_de_base(v_nom));
    v_suffixe := 1;
    v_code    := null;

    loop
      v_candidat := case when v_suffixe = 1 then v_base else v_base || v_suffixe::text end;

      if not exists (select 1 from public.promo_codes pc where pc.code_normalise = v_candidat) then
        begin
          insert into public.promo_codes (
            code, type_remise, valeur, porte_sur, actif, commence_le, expire_le,
            max_utilisations, description, beneficiaire_id, restaurant_id,
            inclut_emballage, exclut_boissons, pris_en_charge_par, commande_origine_id)
          values (
            v_candidat,
            case when v_repas then 'montant' else 'pourcentage' end,
            case when v_repas then p_plafond else 100 end,
            case when v_repas then 'sous_total' else 'livraison' end,
            true, now(), v_expire,
            1, v_motif, v_uid, p_restaurant_id,
            v_repas,
            v_repas and not coalesce(p_inclut_boissons, false),
            v_charge, p_commande_origine_id)
          returning * into v_code;
        exception when unique_violation then
          -- Un autre admin a pris ce nom entre la verification et l'insertion.
          v_code := null;
        end;
      end if;

      exit when v_code.id is not null;

      if v_force is not null then
        raise exception 'Le code % existe deja', v_force;
      end if;
      v_suffixe := v_suffixe + 1;
      if v_suffixe > 999 then
        raise exception 'Aucun nom libre pour %', v_base;
      end if;
    end loop;

    insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
    values (auth.uid(), 'code_offert', p_commande_origine_id, p_restaurant_id, null,
            v_code.code || ' (' || p_offre || ', ' || v_charge || ') pour ' || v_uid::text,
            v_motif);

    code_id   := v_code.id;
    code      := v_code.code;
    user_id   := v_uid;
    full_name := v_nom;
    email     := (select au.email::text from auth.users au where au.id = v_uid);
    telephone := public.telephone_du_client(v_uid);
    expire_le := v_code.expire_le;
    return next;
  end loop;
end;
$$;

revoke all on function public.admin_creer_codes_offerts(uuid[], uuid, text, integer, boolean, integer, text, uuid, text, text) from public, anon;
grant execute on function public.admin_creer_codes_offerts(uuid[], uuid, text, integer, boolean, integer, text, uuid, text, text) to authenticated;

-- =====================================================================
-- 3. L'apercu des apps installees n'annonce jamais plus que la facture
-- =====================================================================
-- verifier_code_promo ne recoit que le sous-total du panier, boissons comprises.
-- Pour un code hors boissons, la vraie base (plats hors boissons + emballage) est
-- inconnaissable ici : elle va de 0 (panier de bieres) au sous-total. Le seul
-- montant sur est donc 0.
--
-- On repond « valide, remise 0 » et non « sans_effet » : les apps installees
-- n'envoient pas a create_order un code refuse, le cadeau deviendrait inutilisable
-- jusqu'a la mise a jour. Valide a 0, le code part, create_order applique la vraie
-- remise, et le client paie MOINS que le total affiche, jamais plus (invariant de
-- app/store/promo.ts). Panier sans plat : create_order ne consomme rien et facture
-- le plein tarif, qui est bien ce qui etait affiche.
--
-- Pour un code qui inclut les boissons, sous-total <= vraie base (l'emballage ne
-- peut que l'augmenter) : la remise calculee reste une borne basse, on la garde.
-- Les nouvelles versions de l'app passent par apercu_code_promo, qui voit les lignes.
-- ⚠️ Le defaut « = 0 » de p_sous_total existe en live : l'omettre fait echouer
-- create or replace (« cannot remove parameter defaults »).
create or replace function public.verifier_code_promo(p_code text, p_restaurant_id uuid, p_sous_total integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_promo  public.promo_codes;
  v_n      integer := 0;
  v_deja   boolean := false;
  v_base   integer;
  v_remise integer;
  v_raison text;
begin
  if v_uid is null then
    return jsonb_build_object('valide', false, 'raison', 'non_connecte');
  end if;

  select * into v_promo from public.promo_codes
   where code_normalise = public.normaliser_code_promo(p_code);

  if v_promo.id is not null then
    select count(*) into v_n
      from public.promo_redemptions where code_id = v_promo.id;
    select exists (select 1 from public.promo_redemptions
                    where code_id = v_promo.id and user_id = v_uid) into v_deja;
  end if;

  v_raison := public.raison_invalidite_promo(v_promo, v_n, v_deja);
  if v_raison is not null then
    return jsonb_build_object('valide', false, 'raison', v_raison);
  end if;

  -- Code attache a un restaurant : ailleurs, il ne vaut rien.
  if v_promo.restaurant_id is not null
     and v_promo.restaurant_id is distinct from p_restaurant_id then
    return jsonb_build_object('valide', false, 'raison', 'restaurant_inconnu');
  end if;

  -- Repas offert hors boissons : aucune remise sure a annoncer (voir plus haut).
  if v_promo.porte_sur <> 'livraison' and v_promo.exclut_boissons then
    return jsonb_build_object(
      'valide',      true,
      'code',        v_promo.code_normalise,
      'porte_sur',   v_promo.porte_sur,
      'remise',      0,
      'description', v_promo.description);
  end if;

  if v_promo.porte_sur = 'livraison' then
    select delivery_fee into v_base from public.restaurants where id = p_restaurant_id;
    if v_base is null then
      return jsonb_build_object('valide', false, 'raison', 'restaurant_inconnu');
    end if;
  else
    v_base := greatest(coalesce(p_sous_total, 0), 0);
  end if;

  v_remise := public.remise_promo(v_promo.type_remise, v_promo.valeur, v_base);

  -- « Tu économises 0 Ar » n'est pas une bonne nouvelle : c'est un code que le
  -- client croit avoir dépensé. On refuse l'aperçu, l'app n'enverra donc pas le
  -- code à la commande, et l'utilisation reste disponible ailleurs.
  if v_remise <= 0 then
    return jsonb_build_object('valide', false, 'raison', 'sans_effet');
  end if;

  return jsonb_build_object(
    'valide',      true,
    'code',        v_promo.code_normalise,
    'porte_sur',   v_promo.porte_sur,
    'remise',      v_remise,
    'description', v_promo.description);
end;
$$;
