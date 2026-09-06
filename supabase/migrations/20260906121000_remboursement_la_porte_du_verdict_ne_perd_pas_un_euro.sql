-- ============================================================================
-- LA PORTE DU VERDICT NE PEUT PLUS EFFACER UN EURO DEJA SORTI
-- ============================================================================
--
-- `enregistrer_verdict_remboursement()` est la porte que `stripe-webhook` doit
-- pousser quand Stripe tranche. Aujourd'hui elle n'a AUCUNE machine a etats :
-- elle ecrit ce qu'on lui donne, dans n'importe quel ordre, autant de fois
-- qu'on l'appelle. Or un webhook arrive deux fois, arrive en retard, arrive
-- dans le desordre — c'est la regle, pas l'exception. Trois consequences,
-- trouvees par la revue « argent » du 2026-09-06 :
--
-- 1. `effectue` -> `sans_objet` EFFACE DE L'ARGENT RENDU. `sans_objet` veut
--    dire « rien n'a jamais ete debite, donc rien n'est rendu » : la ligne sort
--    de `rapport_remboursements.rendu_ar` et du plafond. La poser sur une ligne
--    dont les euros SONT partis rouvre le droit a un second remboursement du
--    meme montant, et fait disparaitre le premier du rapport du soir. C'est le
--    bug de TF-96 retourne : la base affirmerait qu'il n'y a rien a rendre
--    alors que l'argent est parti.
--
-- 2. UN SECOND `re_...` ECRASAIT LE PREMIER. `coalesce(p_provider_refund_id,
--    provider_refund_id)` remplacait silencieusement l'identifiant Stripe deja
--    attache. Deux remboursements reels (celui de la chaine + un fait a la main
--    depuis le tableau de bord) se retrouvaient ranges sur UNE ligne : la somme
--    des `amount_minor` sous-comptait alors ce qui est reellement sorti du
--    compte, et le plafond autorisait de rendre une troisieme fois la
--    difference. `provider_refund_id` est unique en base — mais l'unicite
--    n'empeche pas d'ecraser une valeur par une autre, seulement de la
--    dupliquer.
--
-- 3. `effectue_le` RECULAIT A CHAQUE REJEU. Un `refund.updated` renvoye trois
--    jours plus tard redatait le remboursement d'aujourd'hui, et c'est cette
--    date qu'on oppose a un client qui dit ne pas avoir ete credite.
--
-- ⚠️ CE QUI RESTE DELIBEREMENT OUVERT : `effectue` <-> `echoue`, DANS LES DEUX
-- SENS. Ce n'est pas un oubli, c'est le cycle de vie reel d'un remboursement
-- carte chez Stripe : il repond `succeeded` tout de suite, puis peut basculer en
-- `failed` des jours plus tard si la banque du client refuse le credit (l'argent
-- nous revient, le client n'a RIEN). Interdire ce retour, ce serait laisser la
-- base affirmer pour toujours qu'un client a ete rembourse alors qu'il ne l'a
-- pas ete — exactement le mensonge que tout ce chantier ferme. Et le chemin
-- inverse (`echoue` -> `effectue`) est celui du rattrapage reussi.
--
-- ⚠️ `sans_objet` devient terminal. Si une capture arrive apres coup, ce n'est
-- pas cette ligne qui doit revivre : `remboursement_sur_capture_tardive` en
-- ouvre une neuve, et le plafond la juge sur les centimes reellement captures.
--
-- ⚠️ AUCUN APPELANT EXISTANT NE CHANGE. `rembourser-paiement` n'ecrit
-- `sans_objet` que sur une demande jamais partie (elle sort en `deja_traite`
-- avant, des que la ligne porte un `re_...`), et n'ecrit `effectue`/`echoue`
-- qu'apres `enregistrer_envoi_remboursement()`, avec le MEME identifiant.
-- Verifie sur la fonction deployee avant d'ecrire cette migration.
create or replace function public.enregistrer_verdict_remboursement(
  p_refund_id          uuid,
  p_provider_refund_id text,
  p_statut             public.payment_refund_status,
  p_erreur             text default null,
  p_raw_event          jsonb default null
)
returns public.payment_refunds
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_avant  public.payment_refunds;
  v_refund public.payment_refunds;
begin
  if p_statut not in ('effectue', 'echoue', 'sans_objet') then
    raise exception 'Verdict attendu : effectue, echoue ou sans_objet (recu : %)', p_statut;
  end if;

  -- Le verrou avant la decision, pas apres : deux webhooks du meme remboursement
  -- peuvent arriver a la milliseconde, et c'est la lecture de l'etat courant qui
  -- decide ici. Sans `for update`, les deux liraient le meme « avant ».
  select * into v_avant
    from public.payment_refunds where id = p_refund_id for update;

  if v_avant.id is null then
    raise exception 'Remboursement introuvable : %', p_refund_id;
  end if;

  -- (2) Un identifiant Stripe deja attache ne se remplace jamais. On accepte le
  -- meme (rejeu), on accepte d'en poser un la ou il n'y en avait pas (le chemin
  -- manuel documente : remboursement fait au tableau de bord, ligne reconciliee
  -- a la main), on refuse d'en changer.
  if v_avant.provider_refund_id is not null
     and p_provider_refund_id is not null
     and p_provider_refund_id is distinct from v_avant.provider_refund_id then
    raise exception
      'Remboursement % : un autre identifiant Stripe est deja attache (% recu, % en base). Deux remboursements reels ne tiennent pas sur une ligne.',
      p_refund_id, p_provider_refund_id, v_avant.provider_refund_id
      using errcode = 'check_violation';
  end if;

  -- (1) `sans_objet` ne se declare que sur une demande qui n'est jamais partie.
  if p_statut = 'sans_objet'
     and (v_avant.status <> 'demande' or v_avant.provider_refund_id is not null) then
    raise exception
      'Remboursement % : « sans objet » dirait que rien n''a ete debite, alors que cette demande est en % et porte %. Utilise « echoue » si la banque a refuse le credit.',
      p_refund_id, v_avant.status, coalesce(v_avant.provider_refund_id, 'aucun identifiant')
      using errcode = 'check_violation';
  end if;

  -- `sans_objet` est terminal : une capture tardive ouvre une NOUVELLE demande,
  -- elle ne ressuscite pas celle-ci.
  if v_avant.status = 'sans_objet' and p_statut <> 'sans_objet' then
    raise exception
      'Remboursement % : « sans objet » est definitif. Une capture arrivee depuis ouvre une nouvelle demande.',
      p_refund_id
      using errcode = 'check_violation';
  end if;

  update public.payment_refunds
     set status             = p_statut,
         provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id),
         erreur             = p_erreur,
         raw_event          = coalesce(p_raw_event, raw_event),
         -- (3) La date du PREMIER succes. Un rejeu ne redate pas un virement.
         effectue_le        = case when p_statut = 'effectue'
                                   then coalesce(effectue_le, now())
                                   else effectue_le end
   where id = p_refund_id
  returning * into v_refund;

  return v_refund;
end $$;

revoke all on function public.enregistrer_verdict_remboursement(uuid, text, public.payment_refund_status, text, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_verdict_remboursement(uuid, text, public.payment_refund_status, text, jsonb) to service_role;

comment on function public.enregistrer_verdict_remboursement(uuid, text, public.payment_refund_status, text, jsonb) is
  'Porte du verdict Stripe. Rejouable sans dommage : un meme verdict reecrit la meme ligne, '
  '`effectue_le` garde la date du premier succes, et un second identifiant Stripe est refuse. '
  '`effectue` <-> `echoue` reste ouvert dans les deux sens (un remboursement carte peut echouer '
  'apres avoir repondu succeeded) ; `sans_objet` ne se pose que sur une demande jamais partie.';
