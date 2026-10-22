-- Notification « plats du jour » programmée le 2026-10-22 à 12:00 (Nosy Be) = 09:00 UTC.
-- Demande du porteur du projet : « envoie à midi une notification simple, pour inciter à
-- regarder les plats du jour, à tout le monde, resto et client ». Push seul (pas d'e-mail).
-- Cible `clients` = tout appareil de l'app client, pros compris (envoyer-annonce v7).
-- Ouvre /plats-du-jour (tous les plats du jour de l'île).
-- Même mécanique que l'annonce du 08/10 : tâches pg_cron à usage unique.
-- ANNULER avant midi : select cron.unschedule('annonce_pdj_2210_envoi');

create or replace function public.annonce_pdj_2210_lancer()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"9ca91352-d36d-4500-87fd-68d0f696640d","role":"authenticated"}', true);
  v_id := public.admin_creer_annonce(
    '🔥 Les plats du jour sont servis !',
    'Nouveau chez L''escale Créole : jarret de porc braisé et émincé de poulet sauce huître. Jette un œil aux plats du jour de l''île 👀',
    'clients', '/plats-du-jour', 'push');
  perform public.envoyer_annonce_depuis_la_base(v_id);
exception when others then
  perform public.annonce_programmee_telegram('⚠️ Notification plats du jour (22/10) NON partie : ' || sqlerrm);
end $$;
revoke all on function public.annonce_pdj_2210_lancer() from public, anon, authenticated, service_role;

create or replace function public.annonce_pdj_2210_bilan()
returns void language plpgsql security definer set search_path to 'public' as $$
declare a record;
begin
  select * into a from public.annonces
   where titre = '🔥 Les plats du jour sont servis !' and cible = 'clients'
   order by creee_le desc limit 1;
  if a.id is null then
    perform public.annonce_programmee_telegram('⚠️ Bilan notification plats du jour : aucune annonce trouvée.');
  else
    perform public.annonce_programmee_telegram(
      '📣 Notification plats du jour (22/10, 12 h) — ' || a.statut
      || chr(10) || 'Téléphones visés : ' || coalesce(a.jetons_vises, 0)
      || ' · acceptés : ' || coalesce(a.envois_reussis, 0)
      || ' · reçus confirmés : ' || coalesce(a.details->>'recus_ok', '?')
      || coalesce(chr(10) || 'Erreurs : ' || (a.details->'erreurs')::text, ''));
  end if;
end $$;
revoke all on function public.annonce_pdj_2210_bilan() from public, anon, authenticated, service_role;

select cron.schedule('annonce_pdj_2210_envoi', '0 9 22 10 *', $job$
  select public.annonce_pdj_2210_lancer();
  select cron.unschedule('annonce_pdj_2210_envoi');
$job$);

select cron.schedule('annonce_pdj_2210_bilan', '5 9 22 10 *', $job$
  select public.annonce_pdj_2210_bilan();
  select cron.unschedule('annonce_pdj_2210_bilan');
$job$);
