-- Annonce « Commande pour plus tard » programmée le LUNDI 2026-10-19 à 10:00 (Nosy Be).
--
-- Fonction en ligne depuis le 2026-10-17 (base, app web, OTA 1.2.1/1.2.2/1.2.3), annoncée
-- la semaine suivante à la demande du porteur du projet : notification + e-mail à tous les
-- clients, et le visuel visuels-reseaux/commande-programmee/PUB-commande-programmee.png.
--
-- Même mécanique que 20261007210000 (porte-monnaie) : trois tâches pg_cron À USAGE UNIQUE,
-- heures en UTC (Nosy Be = UTC+3) :
--   06:45 UTC (09:45) — rappel Telegram au canal admin ;
--   07:00 UTC (10:00) — annonce écrite par admin_creer_annonce (identité admin) puis envoyée
--                       par envoyer_annonce_depuis_la_base() : tous les clients, push + e-mail ;
--   07:05 UTC (10:05) — compte rendu Telegram.
-- ANNULER avant 10:00 : select cron.unschedule('annonce_plus_tard_envoi');

create or replace function public.annonce_plus_tard_lancer()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"9ca91352-d36d-4500-87fd-68d0f696640d","role":"authenticated"}', true);
  v_id := public.admin_creer_annonce(
    '⏰ Ton resto est fermé ? Commande quand même',
    'Nouveau : commande dès maintenant et choisis ton heure de livraison pour aujourd''hui. Le resto reçoit ta commande à son ouverture 👉',
    'clients', '/', 'push_email');
  perform public.envoyer_annonce_depuis_la_base(v_id);
exception when others then
  perform public.annonce_programmee_telegram('⚠️ Annonce « commande pour plus tard » NON partie : ' || sqlerrm);
end $$;
revoke all on function public.annonce_plus_tard_lancer() from public, anon, authenticated, service_role;

create or replace function public.annonce_plus_tard_bilan()
returns void language plpgsql security definer set search_path to 'public' as $$
declare a record;
begin
  select * into a from public.annonces
   where titre = '⏰ Ton resto est fermé ? Commande quand même' and cible = 'clients'
   order by creee_le desc limit 1;
  if a.id is null then
    perform public.annonce_programmee_telegram('⚠️ Bilan annonce « commande pour plus tard » : aucune annonce trouvée.');
  else
    perform public.annonce_programmee_telegram(
      '📣 Annonce « commande pour plus tard » — ' || a.statut
      || chr(10) || 'Téléphones visés : ' || coalesce(a.jetons_vises, 0)
      || ' · acceptés : ' || coalesce(a.envois_reussis, 0)
      || ' · reçus confirmés : ' || coalesce(a.details->>'recus_ok', '?')
      || chr(10) || 'E-mails : ' || coalesce(a.emails_envoyes, 0) || ' / ' || coalesce(a.emails_vises, 0)
      || coalesce(chr(10) || 'Erreurs : ' || (a.details->'erreurs')::text, ''));
  end if;
end $$;
revoke all on function public.annonce_plus_tard_bilan() from public, anon, authenticated, service_role;

select cron.schedule('annonce_plus_tard_rappel', '45 6 19 10 *', $job$
  select public.annonce_programmee_telegram('⏰ Rappel : l''annonce « Ton resto est fermé ? Commande quand même » part à 10 h vers tous les clients (notification + e-mail). Pour l''annuler, dis-le à Claude avant 10 h.');
  select cron.unschedule('annonce_plus_tard_rappel');
$job$);

select cron.schedule('annonce_plus_tard_envoi', '0 7 19 10 *', $job$
  select public.annonce_plus_tard_lancer();
  select cron.unschedule('annonce_plus_tard_envoi');
$job$);

select cron.schedule('annonce_plus_tard_bilan', '5 7 19 10 *', $job$
  select public.annonce_plus_tard_bilan();
  select cron.unschedule('annonce_plus_tard_bilan');
$job$);
