-- =============================================================================
-- Le message Telegram de nouvelle commande, plus clair (2026-10-22).
--
-- Retour du porteur du projet : « le message Telegram qui envoie la commande n'est pas
-- assez clair ». Défauts relevés : le supplément payant (« Frites ») noyé au milieu des
-- options gratuites triées par ordre alphabétique ; un montant « hors livraison » qui
-- n'incluait pas l'emballage et ne disait pas ce que le restaurant touchera ; le moyen
-- de paiement écrit brut (« orange_money ») ; aucune heure.
--
-- Format validé par le porteur du projet :
--   💰 Montant de la commande : 79 000 Ar (plats 73 000 + emballage 6 000)
--   ➖ Commission Taxi Food (7 %) : −5 530 Ar
--   ✅ Net à vous reverser : 73 470 Ar
--
-- UNE SEULE SOURCE pour le texte : `texte_telegram_commande(charge, pour)`, fonction
-- PURE qui lit la charge de `notify_order_status`. La base pose le texte dans la charge
-- (`telegram_texte`) ; n8n l'envoie tel quel (et garde son ancien texte en repli si le
-- champ manque). La copie admin passe par la même fonction : les deux ne peuvent plus
-- diverger.
--
-- ⚠️ `notify_order_status` tourne au COMMIT de chaque commande (trigger différé) : une
-- erreur y annulerait la commande. La mise en forme est donc appelée par
-- `texte_telegram_commande_sur()`, qui avale toute erreur et rend NULL — n8n retombe
-- alors sur son ancien texte, la copie admin sur une ligne minimale.
--
-- Net affiché = formule de mark_order_delivered / admin_commandes_a_reverser :
--   montant = plats + emballage ; commission = round(taux × (plats + emballage
--   − emballage Taxi Food − part offerte)) ; net = montant − emballage Taxi Food
--   − commission − part offerte. Taux = celui du restaurant AU MOMENT de la commande
--   (le taux figé n'est posé qu'à la livraison).
-- Charge enrichie (champs AJOUTÉS, rien de retiré) : commande.paye_en_ligne,
-- commande.livraison_souhaitee_a, commande.emballage_taxifood, restaurant.commission_rate.
-- =============================================================================

create or replace function public.texte_telegram_commande(p_charge jsonb, p_pour text default 'restaurant')
returns text
language plpgsql
stable
set search_path to 'public'
as $$
declare
  c jsonb := p_charge->'commande';
  r jsonb := p_charge->'restaurant';
  it boolean := coalesce(p_charge->'restaurant'->>'langue', 'fr') = 'it' and p_pour = 'restaurant';
  v_plats int := coalesce((c->>'sous_total')::int, 0);
  v_emb int := coalesce((c->>'emballage')::int, 0);
  v_emb_tf int := coalesce((c->>'emballage_taxifood')::int, 0);
  v_offert int := coalesce((c->>'remise_charge_restaurant')::int, 0);
  v_taux numeric := coalesce((r->>'commission_rate')::numeric, 0);
  v_comm int;
  v_net int;
  v_heure text;
  v_souhait text;
  v_paiement text;
  v_mode text := coalesce(c->>'paiement', '');
  v_t text := '';
  a jsonb;
  v_payants text; v_gratuits text;
begin
  v_comm := greatest(round((v_plats + v_emb - v_emb_tf - v_offert) * v_taux)::int, 0);
  v_net := v_plats + v_emb - v_emb_tf - v_comm - v_offert;
  v_heure := to_char((c->>'creee_le')::timestamptz at time zone 'Indian/Antananarivo',
                     case when it then 'HH24:MI' else 'HH24" h "MI' end);
  if nullif(c->>'livraison_souhaitee_a', '') is not null then
    v_souhait := to_char((c->>'livraison_souhaitee_a')::timestamptz at time zone 'Indian/Antananarivo',
                         case when it then 'DD/MM HH24:MI' else 'DD/MM "à" HH24" h "MI' end);
  end if;

  -- Paiement, en toutes lettres : c'est ce que le livreur et le restaurant doivent savoir.
  if coalesce((c->>'paye_en_ligne')::boolean, false) then
    v_paiement := case when it then '💳 Già pagato online (' || case v_mode when 'cb' then 'carta' else 'Orange Money' end || ') : niente da incassare'
                       else '💳 Déjà payé en ligne (' || case v_mode when 'cb' then 'carte' else 'Orange Money' end || ') : rien à encaisser' end;
  else
    v_paiement := case when it then
                    case v_mode when 'especes' then '💵 Il cliente paga in contanti alla consegna'
                                when 'orange_money' then '📱 Il cliente paga alla consegna (Orange Money)'
                                when 'cb' then '💳 Il cliente paga con carta alla consegna'
                                else '💵 Il cliente paga alla consegna' end
                  else
                    case v_mode when 'especes' then '💵 Le client paie en espèces à la livraison'
                                when 'orange_money' then '📱 Le client paie à la livraison (Orange Money)'
                                when 'cb' then '💳 Le client paie par carte à la livraison'
                                else '💵 Le client paie à la livraison' end
                  end;
  end if;

  if p_pour = 'admin' then
    v_t := '🏪 ' || coalesce(r->>'nom', '?') || chr(10);
  end if;
  v_t := v_t || case when it then '🛵 NUOVO ORDINE — ' else '🛵 NOUVELLE COMMANDE — ' end || coalesce(v_heure, '?');
  if v_souhait is not null then
    v_t := v_t || chr(10) || case when it then '⏰ DA CONSEGNARE IL ' else '⏰ À LIVRER LE ' end || v_souhait;
  end if;
  v_t := v_t || chr(10);

  -- Les plats. Suppléments PAYANTS d'abord, en capitales avec leur prix ; le reste
  -- (inclus, offert, choix sans supplément) sur une seule ligne discrète.
  for a in select * from jsonb_array_elements(coalesce(p_charge->'articles', '[]'::jsonb)) loop
    v_t := v_t || chr(10) || (a->>'quantite') || ' × ' || (a->>'nom');
    select string_agg('   ➕ ' || upper(o2->>'nom')
                      || case when coalesce((o2->>'quantite')::int, 1) > 1 then ' × ' || (o2->>'quantite') else '' end
                      || ' (+' || replace(to_char((o2->>'prix')::int, 'FM999G999G999'), ',', ' ') || ' Ar)', chr(10)
                      order by o2->>'nom')
      into v_payants
      from jsonb_array_elements(coalesce(a->'options', '[]'::jsonb)) o2
     where coalesce((o2->>'prix')::int, 0) > 0;
    select string_agg(o2->>'nom', ' · ' order by o2->>'nom')
      into v_gratuits
      from jsonb_array_elements(coalesce(a->'options', '[]'::jsonb)) o2
     where coalesce((o2->>'prix')::int, 0) <= 0;
    if v_payants is not null then v_t := v_t || chr(10) || v_payants; end if;
    if v_gratuits is not null then v_t := v_t || chr(10) || '   ' || v_gratuits; end if;
    if nullif(btrim(a->>'commentaire'), '') is not null then
      v_t := v_t || chr(10) || '   ✎ « ' || btrim(a->>'commentaire') || ' »';
    end if;
  end loop;

  -- Les montants : ce que le restaurant touchera, sans calcul à faire.
  v_t := v_t || chr(10) || chr(10)
      || case when it then '💰 Importo dell''ordine : ' else '💰 Montant de la commande : ' end
      || replace(to_char(v_plats + v_emb, 'FM999G999G999'), ',', ' ') || ' Ar';
  if v_emb > 0 then
    v_t := v_t || chr(10) || case when it then '   (piatti ' else '   (plats ' end
        || replace(to_char(v_plats, 'FM999G999G999'), ',', ' ')
        || case when it then ' + imballaggio ' else ' + emballage ' end
        || replace(to_char(v_emb, 'FM999G999G999'), ',', ' ') || ')';
  end if;
  if v_offert > 0 then
    v_t := v_t || chr(10) || case when it then '➖ Offerto da voi' else '➖ Offert par vous' end
        || coalesce(' (code ' || (c->>'code_promo') || ')', '') || ' : −'
        || replace(to_char(v_offert, 'FM999G999G999'), ',', ' ') || ' Ar';
  end if;
  if v_emb_tf > 0 then
    v_t := v_t || chr(10) || case when it then '➖ Imballaggio per Taxi Food : −' else '➖ Emballage pour Taxi Food : −' end
        || replace(to_char(v_emb_tf, 'FM999G999G999'), ',', ' ') || ' Ar';
  end if;
  if v_taux > 0 then
    v_t := v_t || chr(10) || case when it then '➖ Commissione Taxi Food (' else '➖ Commission Taxi Food (' end
        || replace(trim_scale(round(v_taux * 100, 2))::text, '.', ',') || ' %) : −'
        || replace(to_char(v_comm, 'FM999G999G999'), ',', ' ') || ' Ar';
  end if;
  v_t := v_t || chr(10) || case when it then '✅ Netto a voi : ' else '✅ Net à vous reverser : ' end
      || replace(to_char(v_net, 'FM999G999G999'), ',', ' ') || ' Ar'
      || chr(10) || v_paiement;

  if p_pour = 'admin' then
    v_t := v_t || chr(10) || '🧾 Total client : ' || replace(to_char(coalesce((c->>'total')::int, 0), 'FM999G999G999'), ',', ' ') || ' Ar'
        || ' (livraison ' || replace(to_char(coalesce((c->>'livraison')::int, 0), 'FM999G999G999'), ',', ' ') || ')'
        || coalesce(chr(10) || '   dont porte-monnaie client : −' || nullif(c->>'remise_porte_monnaie', '0') || ' Ar (Taxi Food)', '');
  end if;

  -- Le client et où livrer.
  v_t := v_t || chr(10) || chr(10) || '👤 ' || coalesce(p_charge->'client'->>'nom', '—')
      || coalesce(' · 📞 ' || (p_charge->'client'->>'telephone'), '');
  if nullif(btrim(p_charge->'livraison_adresse'->>'precisions'), '') is not null
     or nullif(p_charge->'livraison_adresse'->>'zone', '') is not null then
    v_t := v_t || chr(10) || '📍 ' || concat_ws(' — ', nullif(p_charge->'livraison_adresse'->>'zone', ''),
                                              nullif(btrim(p_charge->'livraison_adresse'->>'precisions'), ''));
  end if;
  if p_pour = 'admin' and nullif(p_charge->'livraison_adresse'->>'latitude', '') is not null then
    v_t := v_t || chr(10) || 'https://www.google.com/maps?q=' || (p_charge->'livraison_adresse'->>'latitude')
        || ',' || (p_charge->'livraison_adresse'->>'longitude');
  end if;
  v_t := v_t || chr(10) || coalesce(c->>'numero', '');
  return v_t;
end $$;

-- Version qui ne lève JAMAIS : appelée depuis le trigger des commandes.
create or replace function public.texte_telegram_commande_sur(p_charge jsonb, p_pour text default 'restaurant')
returns text
language plpgsql
stable
set search_path to 'public'
as $$
begin
  return public.texte_telegram_commande(p_charge, p_pour);
exception when others then
  raise warning 'texte_telegram_commande : % (commande %)', sqlerrm, p_charge->'commande'->>'numero';
  return null;
end $$;

revoke all on function public.texte_telegram_commande(jsonb, text) from public, anon, authenticated;
revoke all on function public.texte_telegram_commande_sur(jsonb, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- notify_order_status : charge enrichie, texte posé dans la charge, copie admin
-- au nouveau format. Patch par REMPLACEMENT D'ANCRES (jamais retapée), contrôlé.
-- -----------------------------------------------------------------------------
do $patch$
declare
  v_def text := pg_get_functiondef('public.notify_order_status()'::regprocedure);
  v_new text;
  a1 constant text := $a$'paiement',v_o.payment_method,'creee_le',v_o.created_at,$a$;
  n1 constant text := $a$'paiement',v_o.payment_method,'creee_le',v_o.created_at,
      'paye_en_ligne',(v_o.payment_status = 'paye'),
      'livraison_souhaitee_a',v_o.livraison_souhaitee_a,
      'emballage_taxifood',coalesce(v_o.emballage_taxifood,0),$a$;
  a2 constant text := $a$'zone',r.zone_served,'langue',r.langue,'telegram_chat_id',r.telegram_chat_id,$a$;
  n2 constant text := $a$'zone',r.zone_served,'langue',r.langue,'telegram_chat_id',r.telegram_chat_id,
      'commission_rate',coalesce(r.commission_rate,0),$a$;
  a3 constant text := $a$  perform net.http_post(url := v_n8n_url,$a$;
  n3 constant text := $a$  -- Le texte Telegram du restaurant, composé UNE fois ici (2026-10-22). NULL si la
  -- mise en forme échoue : n8n retombe alors sur son ancien texte.
  v_charge := v_charge || jsonb_build_object('telegram_texte',
                public.texte_telegram_commande_sur(v_charge, 'restaurant'));

  perform net.http_post(url := v_n8n_url,$a$;
  i_deb int; i_fin int;
begin
  if (length(v_def) - length(replace(v_def, a1, ''))) / length(a1) <> 1 then raise exception 'ancre 1 absente ou multiple'; end if;
  if (length(v_def) - length(replace(v_def, a2, ''))) / length(a2) <> 1 then raise exception 'ancre 2 absente ou multiple'; end if;
  if (length(v_def) - length(replace(v_def, a3, ''))) / length(a3) <> 1 then raise exception 'ancre 3 absente ou multiple'; end if;
  v_new := replace(replace(replace(v_def, a1, n1), a2, n2), a3, n3);

  -- Copie admin : tout l'argument de telegram_admin_envoyer( … ) est remplacé.
  i_deb := strpos(v_new, 'perform public.telegram_admin_envoyer(');
  i_fin := strpos(substr(v_new, i_deb), E');\n  end if;');
  if i_deb = 0 or i_fin = 0 then raise exception 'ancre copie admin absente'; end if;
  v_new := substr(v_new, 1, i_deb - 1)
        || $a$perform public.telegram_admin_envoyer(coalesce(
             public.texte_telegram_commande_sur(v_charge, 'admin'),
             coalesce(v_charge->'restaurant'->>'nom', '?') || chr(10) || 'COMMANDE '
               || coalesce(v_charge->'commande'->>'numero', '?') || ' (détail illisible, voir l''admin)'));
  end if;$a$
        || substr(v_new, i_deb + i_fin - 1 + length(E');\n  end if;'));
  execute v_new;
end $patch$;
