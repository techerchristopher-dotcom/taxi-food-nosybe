-- 5. Page « Commande acceptée » du lien Telegram (`/a/…`) : pour une réservation, la
--    préparation automatique attend l'heure de lancement. La RPC rend cette heure
--    (« 18:11 », heure de Nosy Be) quand elle est à venir ; la page ne dit plus
--    « dans moins d'une minute ».
do $patch5$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.proname = 'repondre_commande_par_jeton' and p.pronamespace = 'public'::regnamespace;
  v_new := replace(v_def,
    '''statut'', v_order.status::text, ''restaurant'', v_resto,',
    '''statut'', v_order.status::text, ''restaurant'', v_resto,
                            ''lancement_prevu'', case when v_order.lancement_prevu_a > now()
                              then to_char(v_order.lancement_prevu_a at time zone ''Indian/Antananarivo'', ''HH24:MI'') end,');
  if v_new = v_def then raise exception 'ancre repondre_commande_par_jeton introuvable'; end if;
  execute v_new;
end $patch5$;
