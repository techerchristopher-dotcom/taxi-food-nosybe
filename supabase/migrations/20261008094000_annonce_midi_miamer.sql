-- Notification « 😋 C'est l'heure de miamer ! » le 2026-10-08 à 12:00 (Nosy Be = 09:00 UTC).
-- Demande du porteur du projet. Notification SEULE (pas d'e-mail : l'annonce porte-monnaie
-- de 10 h en a déjà envoyé un), tous les clients, ouvre l'accueil. Tâches pg_cron à usage
-- unique, compte rendu Telegram à 12:05. Annuler : select cron.unschedule('annonce_midi_envoi');

create or replace function public.annonce_midi_lancer()
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"9ca91352-d36d-4500-87fd-68d0f696640d","role":"authenticated"}', true);
  v_id := public.admin_creer_annonce(
    '😋 C''est l''heure de miamer !',
    'Ragoût de mouton, osso bucco, pizzas, burgers, zébu… Les restos de Nosy Be sont prêts : commande, on te livre 🛵',
    'clients', '/', 'push');
  perform public.envoyer_annonce_depuis_la_base(v_id);
exception when others then
  perform public.annonce_programmee_telegram('⚠️ Notification de midi NON partie : ' || sqlerrm);
end $$;
revoke all on function public.annonce_midi_lancer() from public, anon, authenticated, service_role;

create or replace function public.annonce_midi_bilan()
returns void language plpgsql security definer set search_path to 'public' as $$
declare a record;
begin
  select * into a from public.annonces
   where titre = '😋 C''est l''heure de miamer !' and cible = 'clients'
   order by creee_le desc limit 1;
  if a.id is null then
    perform public.annonce_programmee_telegram('⚠️ Bilan notification de midi : aucune annonce trouvée.');
  else
    perform public.annonce_programmee_telegram(
      '😋 Notification de midi — ' || a.statut
      || chr(10) || 'Téléphones visés : ' || coalesce(a.jetons_vises, 0)
      || ' · acceptés : ' || coalesce(a.envois_reussis, 0)
      || ' · reçus confirmés : ' || coalesce(a.details->>'recus_ok', '?')
      || coalesce(chr(10) || 'Erreurs : ' || (a.details->'erreurs')::text, ''));
  end if;
end $$;
revoke all on function public.annonce_midi_bilan() from public, anon, authenticated, service_role;

select cron.schedule('annonce_midi_envoi', '0 9 8 10 *', $job$
  select public.annonce_midi_lancer();
  select cron.unschedule('annonce_midi_envoi');
$job$);

select cron.schedule('annonce_midi_bilan', '5 9 8 10 *', $job$
  select public.annonce_midi_bilan();
  select cron.unschedule('annonce_midi_bilan');
$job$);
