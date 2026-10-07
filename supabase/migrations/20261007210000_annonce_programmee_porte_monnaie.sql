-- Annonce « Laisse un avis, gagne 1 000 Ar » programmée le 2026-10-08 à 10:00 (Nosy Be).
--
-- Demande du porteur du projet (2026-10-07 au soir) : « tu dois faire un rappel et lancer
-- en automatique, demain à 10 h ». Trois tâches pg_cron À USAGE UNIQUE (chacune se
-- désinscrit en fin d'exécution), heures en UTC (Nosy Be = UTC+3) :
--   06:45 UTC (09:45) — rappel Telegram au canal admin : l'annonce part dans 15 min ;
--   07:00 UTC (10:00) — l'annonce est écrite par `admin_creer_annonce` sous l'identité
--                       admin, puis envoyée par `envoyer_annonce_depuis_la_base()` :
--                       tous les clients, notification + e-mail, ouvre /porte-monnaie ;
--   07:05 UTC (10:05) — compte rendu Telegram (appareils, reçus, e-mails).
-- Pour ANNULER avant 10:00 : select cron.unschedule('annonce_porte_monnaie_envoi');
-- (et les deux autres si besoin).

create or replace function public.annonce_programmee_telegram(p_texte text)
returns void language plpgsql security definer set search_path to '' as $$
declare v_token text; v_chat text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  if v_token is null or v_chat is null then return; end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', v_chat, 'text', p_texte, 'disable_web_page_preview', true),
    timeout_milliseconds := 10000);
end $$;
revoke all on function public.annonce_programmee_telegram(text) from public, anon, authenticated, service_role;

create or replace function public.annonce_porte_monnaie_lancer()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  -- `admin_creer_annonce` exige is_admin() : on se présente comme le compte admin.
  perform set_config('request.jwt.claims',
    '{"sub":"9ca91352-d36d-4500-87fd-68d0f696640d","role":"authenticated"}', true);
  v_id := public.admin_creer_annonce(
    '⭐ Laisse un avis, gagne 1 000 Ar',
    'Nouveau : ton porte-monnaie Taxi Food ! Chaque avis = 1 000 Ar à dépenser sur tes plats, sans date limite. Note tes commandes en 10 secondes 👉',
    'clients', '/porte-monnaie', 'push_email');
  perform public.envoyer_annonce_depuis_la_base(v_id);
exception when others then
  perform public.annonce_programmee_telegram('⚠️ Annonce porte-monnaie NON partie : ' || sqlerrm);
end $$;
revoke all on function public.annonce_porte_monnaie_lancer() from public, anon, authenticated, service_role;

create or replace function public.annonce_porte_monnaie_bilan()
returns void language plpgsql security definer set search_path to 'public' as $$
declare a record;
begin
  select * into a from public.annonces
   where titre = '⭐ Laisse un avis, gagne 1 000 Ar' and cible = 'clients'
   order by creee_le desc limit 1;
  if a.id is null then
    perform public.annonce_programmee_telegram('⚠️ Bilan annonce porte-monnaie : aucune annonce trouvée.');
  else
    perform public.annonce_programmee_telegram(
      '📣 Annonce porte-monnaie — ' || a.statut
      || chr(10) || 'Téléphones visés : ' || coalesce(a.jetons_vises, 0)
      || ' · acceptés : ' || coalesce(a.envois_reussis, 0)
      || ' · reçus confirmés : ' || coalesce(a.details->>'recus_ok', '?')
      || chr(10) || 'E-mails : ' || coalesce(a.emails_envoyes, 0) || ' / ' || coalesce(a.emails_vises, 0)
      || coalesce(chr(10) || 'Erreurs : ' || (a.details->'erreurs')::text, ''));
  end if;
end $$;
revoke all on function public.annonce_porte_monnaie_bilan() from public, anon, authenticated, service_role;

select cron.schedule('annonce_porte_monnaie_rappel', '45 6 8 10 *', $job$
  select public.annonce_programmee_telegram('⏰ Rappel : l''annonce « ⭐ Laisse un avis, gagne 1 000 Ar » part à 10 h vers tous les clients (notification + e-mail, ouvre la page Porte-monnaie). Pour l''annuler, dis-le à Claude avant 10 h.');
  select cron.unschedule('annonce_porte_monnaie_rappel');
$job$);

select cron.schedule('annonce_porte_monnaie_envoi', '0 7 8 10 *', $job$
  select public.annonce_porte_monnaie_lancer();
  select cron.unschedule('annonce_porte_monnaie_envoi');
$job$);

select cron.schedule('annonce_porte_monnaie_bilan', '5 7 8 10 *', $job$
  select public.annonce_porte_monnaie_bilan();
  select cron.unschedule('annonce_porte_monnaie_bilan');
$job$);
