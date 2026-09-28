-- Pourquoi : la file de travail ne doit jamais demander à l'admin de choisir
-- quoi faire — elle doit le lui DIRE. La règle vit dans une seule fonction,
-- pas dans l'écran : sinon un `git grep` ne suffit plus à savoir ce que l'app
-- promet, et deux affichages (web, futur mobile) pourraient décider différemment.
--
-- ⚠️ TROIS ÉCARTS ASSUMÉS PAR RAPPORT AU BRIEF, TOUS EXPLIQUÉS ICI :
--
-- 1. Le brief exclut le statut `partenaire` de toute file de travail (règle 1
--    du tableau), mais range juste en dessous deux règles qui ne peuvent se
--    déclencher QUE sur une fiche `partenaire` : « accepté, flyers pas encore
--    déposés » et « accepté, flyers déposés, pas de contrôle depuis ». En
--    effet `admin_prospect_agir` fait passer une fiche en `partenaire` dès le
--    résultat `accepte` (demandé explicitement en § 1.5 du brief). Prise au
--    pied de la lettre, la règle 1 rendrait donc les règles 3 et 4 mortes :
--    plus aucune fiche acceptée n'atteindrait jamais le dépôt de flyers ni le
--    contrôle à trois semaines — précisément l'étape que la stratégie désigne
--    comme « celle qu'on oublie et qui dit la vérité »
--    (STRATEGIE-PROSPECTION-HEBERGEMENTS.md § 6.1). Résolu en sortant
--    `partenaire` de la liste d'exclusion : seuls `hors_zone`, `exclu` et
--    `refuse` coupent la file.
--
-- 2. Le brief donne une règle pour `code_dormant` (le code n'a pas servi :
--    repasser) mais aucune pour son pendant heureux `code_utilise` (le code a
--    servi : tout va bien). Sans règle dédiée, une fiche dans cet état
--    retomberait sur la relance générique d'écrit ou de visite, ce qui
--    rouvrirait un dossier qui n'a justement PAS besoin qu'on y revienne.
--    `code_utilise` retourne donc `null`, au même titre que `refus` : rien à
--    faire, c'est un succès silencieux.
--
-- La garde « 3 actions en 30 jours » est décrite comme passant « avant tout
-- le reste sauf les cas accepté/intéressé », alors qu'elle est la DERNIÈRE
-- ligne du tableau — et les lignes qui la précèdent (code_dormant, a_rappeler,
-- mauvais_numero…) doivent pourtant, elles, la subir. Résolu sur la PHRASE,
-- pas sur la position dans le tableau : la garde s'applique à tout, sauf
-- quand le dernier résultat est `accepte` ou `interesse` (sortis plus haut,
-- donc jamais évalués contre elle).
--
-- 3. Trouvé en testant le cas limite « WhatsApp envoyé aujourd'hui, sans
--    réponse » (cobaye : Andilana Nosy be, `11d8371d-…`) : une première
--    version conditionnait les trois règles d'escalade (2ᵉ WhatsApp, rappel
--    téléphonique, écrit) à `j >= N` — SI le délai n'était pas encore atteint,
--    la condition ne matchait pas et la fonction tombait tout droit sur la
--    visite du jour même, un message envoyé une minute plus tôt se voyant
--    aussitôt suivi de « Passer sur place ». Corrigé : ces trois règles
--    renvoient TOUJOURS l'escalade dès que le canal/résultat correspond, avec
--    sa date calculée (passée ou future) — c'est `a_faire_le` qui porte
--    l'attente, jamais une condition qui fait sauter la règle en silence. Le
--    tri de `prospects_pilotage` (retard d'abord) fait le reste.
create or replace function public.prospect_prochaine_action(
  p_statut                  text,
  p_dernier_canal           text,
  p_dernier_resultat        text,
  p_derniere_action_le      timestamptz,
  p_derniere_controle_le    timestamptz,
  p_flyers_total            integer,
  p_telephone               text,
  p_telephone_2             text,
  p_facebook_url            text,
  p_email                   text,
  p_priorite                text,
  p_nb_tentatives_whatsapp  integer,
  p_nb_tentatives_appel     integer,
  p_nb_tentatives_ecrit     integer,
  p_nb_actions_30j          integer
)
returns table (prochain_canal text, prochaine_action text, a_faire_le date)
language plpgsql
stable
as $$
declare
  v_j integer := case when p_derniere_action_le is null then 999999
                      else floor(extract(epoch from (now() - p_derniere_action_le)) / 86400)::int
                 end;
begin
  if p_statut in ('hors_zone', 'exclu', 'refuse') then
    return;
  end if;

  if p_dernier_resultat = 'refus' then
    return;
  end if;

  if p_dernier_resultat = 'code_utilise' then
    return;
  end if;

  if p_dernier_resultat = 'accepte' then
    if coalesce(p_flyers_total, 0) = 0 then
      prochain_canal := 'flyers';
      prochaine_action := 'Déposer les flyers et créer le code';
      a_faire_le := current_date;
      return next;
    elsif p_derniere_controle_le is null then
      prochain_canal := 'controle';
      prochaine_action := 'Vérifier si le code a servi';
      a_faire_le := (coalesce(p_derniere_action_le, now()) + interval '21 days')::date;
      return next;
    end if;
    return;
  end if;

  if p_dernier_resultat = 'interesse' then
    prochain_canal := 'visite';
    prochaine_action := 'Passer déposer les flyers';
    a_faire_le := (coalesce(p_derniere_action_le, now()) + interval '2 days')::date;
    return next;
    return;
  end if;

  if coalesce(p_nb_actions_30j, 0) >= 3 then
    a_faire_le := (coalesce(p_derniere_action_le, now()) + interval '30 days')::date;
    return next;
    return;
  end if;

  if p_dernier_resultat = 'code_dormant' then
    prochain_canal := 'visite';
    prochaine_action := 'Repasser voir l''accueil : le code n''a pas servi';
    a_faire_le := (coalesce(p_derniere_action_le, now()) + interval '14 days')::date;
    return next;
    return;
  end if;

  if p_dernier_resultat = 'a_rappeler' then
    prochain_canal := coalesce(p_dernier_canal, 'visite');
    prochaine_action := 'Rappeler, comme convenu';
    a_faire_le := (coalesce(p_derniere_action_le, now()) + interval '2 days')::date;
    return next;
    return;
  end if;

  if p_dernier_resultat = 'mauvais_numero' then
    if p_telephone_2 is not null then
      prochain_canal := 'whatsapp';
      prochaine_action := 'Essayer le second numéro';
      a_faire_le := current_date;
      return next;
      return;
    elsif p_facebook_url is not null and coalesce(p_nb_tentatives_ecrit, 0) = 0 then
      prochain_canal := 'messenger';
      prochaine_action := 'Écrire sur Messenger';
      a_faire_le := current_date;
      return next;
      return;
    elsif p_email is not null and coalesce(p_nb_tentatives_ecrit, 0) = 0 then
      prochain_canal := 'email';
      prochaine_action := 'Écrire par e-mail';
      a_faire_le := current_date;
      return next;
      return;
    end if;
  end if;

  if p_derniere_action_le is null and p_telephone is not null then
    prochain_canal := 'whatsapp';
    prochaine_action := 'Premier message WhatsApp';
    a_faire_le := current_date;
    return next;
    return;
  end if;

  -- WhatsApp tenté une fois, sans réponse : la 2ᵉ tentative (ou l'appel, en
  -- priorité haute), datée à +3 jours du premier envoi — TOUJOURS renvoyée,
  -- que ces 3 jours soient déjà passés ou encore à venir (voir l'en-tête).
  if p_dernier_canal = 'whatsapp' and p_dernier_resultat = 'pas_de_reponse'
     and coalesce(p_nb_tentatives_whatsapp, 0) = 1 then
    if p_priorite = 'haute' then
      prochain_canal := 'appel';
      prochaine_action := 'Appeler (priorité haute, WhatsApp resté sans réponse)';
    else
      prochain_canal := 'whatsapp';
      prochaine_action := 'Deuxième message WhatsApp';
    end if;
    a_faire_le := (coalesce(p_derniere_action_le, now()) + interval '3 days')::date;
    return next;
    return;
  end if;

  -- Appel tenté, sans réponse : un seul rappel, daté à +2 jours.
  if p_dernier_canal = 'appel' and p_dernier_resultat = 'pas_de_reponse'
     and coalesce(p_nb_tentatives_appel, 0) < 2 then
    prochain_canal := 'appel';
    prochaine_action := 'Un seul rappel';
    a_faire_le := (coalesce(p_derniere_action_le, now()) + interval '2 days')::date;
    return next;
    return;
  end if;

  -- Écrit possible (Messenger ou e-mail), jamais encore tenté, daté à +5 jours
  -- du dernier contact (ou aujourd'hui pour une fiche jamais contactée : v_j
  -- vaut alors 999999, la date calculée tombe dans le passé, donc « aujourd'hui »).
  if (p_facebook_url is not null or p_email is not null)
     and coalesce(p_nb_tentatives_ecrit, 0) = 0 then
    prochain_canal := case when p_facebook_url is not null then 'messenger' else 'email' end;
    prochaine_action := 'Message écrit';
    -- Jamais contactée (v_j = 999999) : pas de délai, le premier écrit part
    -- aujourd'hui. Sinon, 5 jours après le dernier contact, passé ou à venir.
    a_faire_le := case when p_derniere_action_le is null then current_date
                       else (p_derniere_action_le + interval '5 days')::date end;
    return next;
    return;
  end if;

  -- Plus aucun canal à distance : la visite sur place. C'est aussi la seule
  -- porte pour les fiches qui ne connaissent que la messagerie Airbnb (celle-ci
  -- ne compte pas comme canal ici — coupée après cinq messages, § 3 du brief) :
  -- elles n'ont ni téléphone, ni Facebook, ni e-mail, donc aucune règle
  -- au-dessus n'a pu se déclencher, et elles arrivent ici tout naturellement.
  prochain_canal := 'visite';
  prochaine_action := 'Passer sur place';
  a_faire_le := current_date;
  return next;
end;
$$;

revoke all on function public.prospect_prochaine_action(
  text, text, text, timestamptz, timestamptz, integer, text, text, text, text,
  text, integer, integer, integer, integer
) from public;
grant execute on function public.prospect_prochaine_action(
  text, text, text, timestamptz, timestamptz, integer, text, text, text, text,
  text, integer, integer, integer, integer
) to authenticated;
