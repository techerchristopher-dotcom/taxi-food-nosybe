-- ============================================================================
-- Mesurer ce que chaque groupe Facebook rapporte — SANS Umami
-- ----------------------------------------------------------------------------
-- La page `/jour` est publiée à la main dans une vingtaine de groupes Facebook.
-- Chaque groupe reçoit désormais son propre lien, marqué : `/jour?g=<slug>`.
-- Restait à compter. Umami réserve son API à l'offre payante (« API access
-- requires a Pro plan », constaté le 2026-09-25 sur le compte
-- techerchristopher) : on ne peut donc PAS rapatrier ses chiffres côté serveur,
-- et un tableau de bord qui renvoie ailleurs ne sert à personne.
--
-- On compte donc nous-mêmes, ici. Umami reste en place pour tout le reste
-- (visiteurs, provenance, événements) — rien n'y est touché.
--
-- ── Ce qu'on enregistre, et ce qu'on refuse d'enregistrer ────────────────────
-- Trois colonnes utiles : QUELLE étiquette, QUELLE page, QUEL geste. Plus
-- l'heure, et le pays à deux lettres quand le réseau le donne.
-- ⚠️ AUCUNE DONNÉE PERSONNELLE : pas d'adresse IP (ni brute ni hachée — une IP
-- hachée reste une donnée personnelle), pas d'identifiant de compte, pas
-- d'agent utilisateur, pas de référent. C'est ce qui permet de continuer à se
-- passer de bandeau de consentement, exactement comme avec Umami. Une ligne
-- d'ici ne désigne personne : elle dit « une visite de plus, venue de ce
-- groupe ».
--
-- ── Pourquoi une table fermée et une RPC, plutôt qu'un INSERT ouvert ─────────
-- La vitrine n'a aucune session : elle écrit avec la clé publiable, que
-- n'importe qui lit dans le HTML. Ouvrir un INSERT sur la table laisserait
-- écrire n'importe quoi dedans, et surtout la LIRE. La table n'a donc aucune
-- policy et aucun droit ; la seule porte est `compter_visite_partage`, qui
-- valide, plafonne, et ne rend jamais rien. Même raisonnement que
-- `preferences_annonces` et `annonces`.
-- ============================================================================

-- ── 1. Les compteurs ────────────────────────────────────────────────────────
create table if not exists public.visites_partage (
  id        bigint generated always as identity primary key,
  -- Le nom court du groupe Facebook : `boncoin`, `tourisme`… La contrainte est
  -- la même, au caractère près, que celle de landing/js/mesure.js et de
  -- landing/netlify/functions/partage.mjs. Trois endroits, une seule règle.
  etiquette text not null check (etiquette ~ '^[a-z0-9][a-z0-9-]{0,23}$'),
  -- La page d'où part le geste (`jour`, `plats-du-jour`…), pour distinguer une
  -- arrivée directe d'un rebond interne.
  page      text not null check (page ~ '^[a-z0-9/-]{1,40}$'),
  -- `ouverture` = la page a été ouverte depuis ce groupe.
  -- `vers-app`  = le visiteur est parti vers l'application. C'est le geste qui
  --               ressemble le plus à un client, et celui sur lequel on classe.
  evenement text not null check (evenement in ('ouverture', 'vers-app')),
  -- Deux lettres, quand le réseau les donne. Jamais une IP.
  pays      text check (pays ~ '^[A-Z]{2}$'),
  vu_le     timestamptz not null default now()
);

comment on table public.visites_partage is
  'Compteurs de visites par étiquette de groupe Facebook (?g=). Aucune donnée personnelle : '
  'ni IP, ni compte, ni agent utilisateur. Écriture par compter_visite_partage() seulement, '
  'lecture par admin_audience_groupes() seulement.';

create index if not exists visites_partage_etiquette_idx on public.visites_partage (etiquette, vu_le desc);
create index if not exists visites_partage_vu_le_idx on public.visites_partage (vu_le desc);

-- ⚠️ RLS ACTIVE ET AUCUNE POLICY : personne ne lit ni n'écrit cette table par
-- l'API REST. C'est voulu, ce n'est pas un oubli.
alter table public.visites_partage enable row level security;
revoke all on public.visites_partage from anon, authenticated;

-- ── 2. La seule porte d'écriture ────────────────────────────────────────────
create or replace function public.compter_visite_partage(
  p_etiquette text,
  p_page      text default 'jour',
  p_evenement text default 'ouverture'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etiquette text := lower(coalesce(p_etiquette, ''));
  v_page      text := lower(coalesce(p_page, ''));
  v_pays      text;
  v_recentes  int;
begin
  -- ⚠️ ON NE LÈVE JAMAIS D'ERREUR. Cette fonction est appelée depuis une page
  -- publique : une exception s'afficherait dans la console du visiteur et
  -- apprendrait à un curieux ce qui est validé. Une entrée refusée est
  -- simplement ignorée — la page, elle, continue de marcher.
  if v_etiquette !~ '^[a-z0-9][a-z0-9-]{0,23}$' then return; end if;
  if p_evenement is null or p_evenement not in ('ouverture', 'vers-app') then return; end if;

  v_page := left(regexp_replace(v_page, '[^a-z0-9/-]', '', 'g'), 40);
  if v_page = '' then v_page := 'inconnue'; end if;

  -- ── Garde-fou anti-bourrage ───────────────────────────────────────────────
  -- La porte est ouverte à la clé publiable : quelqu'un peut la marteler. On ne
  -- peut pas limiter par IP (on n'en garde pas, volontairement), alors on
  -- plafonne PAR ÉTIQUETTE : au-delà de 120 écritures dans la minute, on cesse
  -- d'enregistrer. Un groupe Facebook de Nosy Be n'envoie pas deux visites par
  -- seconde ; du bourrage, si. Le plafond abîme au pire la minute en cours
  -- d'une seule étiquette, jamais les autres ni l'historique.
  select count(*) into v_recentes
    from public.visites_partage
   where etiquette = v_etiquette
     and vu_le > now() - interval '1 minute';
  if v_recentes >= 120 then return; end if;

  -- Le pays vient de l'en-tête posé par le réseau devant Supabase, jamais du
  -- client. Absent ? On laisse vide, c'est un bonus, pas une donnée attendue.
  begin
    v_pays := nullif(upper(left(coalesce(
      current_setting('request.headers', true)::json ->> 'cf-ipcountry', ''), 2)), '');
  exception when others then
    v_pays := null;
  end;
  if v_pays is not null and v_pays !~ '^[A-Z]{2}$' then v_pays := null; end if;

  insert into public.visites_partage (etiquette, page, evenement, pays)
  values (v_etiquette, v_page, p_evenement, v_pays);
end;
$$;

revoke all on function public.compter_visite_partage(text, text, text) from public;
grant execute on function public.compter_visite_partage(text, text, text) to anon, authenticated;

comment on function public.compter_visite_partage(text, text, text) is
  'Incrémente un compteur de visite par étiquette de groupe. Ne rend RIEN : impossible de '
  's''en servir pour lire la table. Valide, plafonne, et ignore en silence ce qui ne passe pas.';

-- ── 3. La provenance sur la commande ────────────────────────────────────────
-- C'est le cœur de la demande : savoir quel groupe fait passer des COMMANDES,
-- pas seulement ouvrir des pages.
alter table public.orders
  add column if not exists etiquette_partage text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_etiquette_partage_format') then
    alter table public.orders
      add constraint orders_etiquette_partage_format
      check (etiquette_partage is null or etiquette_partage ~ '^[a-z0-9][a-z0-9-]{0,23}$');
  end if;
end $$;

create index if not exists orders_etiquette_partage_idx
  on public.orders (etiquette_partage) where etiquette_partage is not null;

comment on column public.orders.etiquette_partage is
  'Groupe Facebook d''où vient le client (?g=). PROVENANCE SEULEMENT : n''entre dans aucun '
  'calcul de prix, de remise, de frais ni de commission.';

-- ⚠️ POURQUOI UNE FONCTION À PART, ET PAS UN PARAMÈTRE DE `create_order`.
-- `create_order` existe en DEUX signatures (4 et 5 arguments), et les binaires
-- déjà installés sur l'App Store et le Play Store appellent la première. Lui
-- ajouter un paramètre, même avec une valeur par défaut, crée une TROISIÈME
-- surcharge : PostgREST répond alors `PGRST203 « Could not choose the best
-- candidate function »` et PLUS AUCUNE COMMANDE NE PASSE. C'est arrivé le
-- 2026-09-05 et c'est resté invisible un jour entier. Une étiquette de mesure
-- ne vaut pas ce risque : elle se pose APRÈS, par sa propre fonction.
--
-- ⚠️ ET SURTOUT : `create_order` ne connaît même pas ce champ. Il ne peut donc
-- pas être détourné pour peser sur un prix, une remise ou une commission — le
-- montant est calculé entièrement en base, avant que cette étiquette n'existe.
create or replace function public.enregistrer_provenance_commande(
  p_order_id  uuid,
  p_etiquette text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etiquette text := lower(coalesce(p_etiquette, ''));
  v_lignes    int;
begin
  if auth.uid() is null then return false; end if;
  if v_etiquette !~ '^[a-z0-9][a-z0-9-]{0,23}$' then return false; end if;

  -- Trois verrous, et chacun sert :
  --   `user_id = auth.uid()`  — on ne marque que SA propre commande ;
  --   `etiquette_partage is null` — une provenance ne se réécrit pas, sinon
  --       n'importe qui pourrait repeindre l'historique d'un groupe ;
  --   `created_at > now() - 1 heure` — la provenance se pose à la création, pas
  --       des semaines après.
  update public.orders
     set etiquette_partage = v_etiquette
   where id = p_order_id
     and user_id = auth.uid()
     and etiquette_partage is null
     and created_at > now() - interval '1 hour';

  get diagnostics v_lignes = row_count;
  return v_lignes > 0;
end;
$$;

revoke all on function public.enregistrer_provenance_commande(uuid, text) from public;
revoke all on function public.enregistrer_provenance_commande(uuid, text) from anon;
grant execute on function public.enregistrer_provenance_commande(uuid, text) to authenticated;

-- ── 4. La lecture, réservée à l'administrateur ──────────────────────────────
create or replace function public.admin_audience_groupes(
  p_depuis date default null,
  p_jusqua date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Jour LOCAL, comme partout ailleurs dans ce projet (rapport de clôture,
  -- versements) : une journée de service ne se coupe pas à minuit UTC.
  v_jusqua date := coalesce(p_jusqua, (now() at time zone 'Indian/Antananarivo')::date);
  v_depuis date := coalesce(p_depuis, v_jusqua - 6);
  v_debut  timestamptz := (v_depuis::timestamp at time zone 'Indian/Antananarivo');
  v_fin    timestamptz := ((v_jusqua + 1)::timestamp at time zone 'Indian/Antananarivo');
  v_res    jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_audience_groupes : réservé aux administrateurs';
  end if;

  with v as (
    select etiquette,
           count(*) filter (where evenement = 'ouverture') as ouvertures,
           count(*) filter (where evenement = 'vers-app')  as vers_app
      from public.visites_partage
     where vu_le >= v_debut and vu_le < v_fin
     group by etiquette
  ), o as (
    select etiquette_partage as etiquette,
           count(*)                                                    as commandes,
           count(*) filter (where status::text = 'livree')             as livrees,
           coalesce(sum(total) filter (where status::text = 'livree'), 0) as chiffre_affaires
      from public.orders
     where etiquette_partage is not null
       and created_at >= v_debut and created_at < v_fin
     group by etiquette_partage
  ), tout as (
    select coalesce(v.etiquette, o.etiquette) as etiquette,
           coalesce(v.ouvertures, 0)          as ouvertures,
           coalesce(v.vers_app, 0)            as vers_app,
           coalesce(o.commandes, 0)           as commandes,
           coalesce(o.livrees, 0)             as livrees,
           coalesce(o.chiffre_affaires, 0)    as chiffre_affaires
      from v full outer join o on o.etiquette = v.etiquette
  )
  select jsonb_build_object(
    'depuis', v_depuis,
    'jusqua', v_jusqua,
    -- ⚠️ « Depuis le … » : les publications faites AVANT la mise en place ne
    -- portent aucune étiquette. Sans cette date affichée à l'écran, on lirait
    -- un zéro comme « ce groupe ne marche pas » alors qu'il n'a jamais été
    -- mesuré. C'est la première mesure enregistrée, pas la date du code.
    'premiere_mesure', (select min(vu_le) from public.visites_partage),
    'lignes', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.commandes desc, t.vers_app desc,
                                            t.ouvertures desc, t.etiquette asc)
        from tout t
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.admin_audience_groupes(date, date) from public;
revoke all on function public.admin_audience_groupes(date, date) from anon;
grant execute on function public.admin_audience_groupes(date, date) to authenticated;

comment on function public.admin_audience_groupes(date, date) is
  'Une ligne par groupe Facebook : ouvertures, passages vers l''app, commandes, chiffre '
  'd''affaires livré. Réservée à is_admin().';
