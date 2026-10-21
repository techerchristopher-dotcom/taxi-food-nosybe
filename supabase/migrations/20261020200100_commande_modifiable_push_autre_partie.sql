-- Plat manquant (2026-10-20) : quand le RESTAURANT (ou Taxi Food) retire le plat après avoir
-- appelé le client, c'est le client qu'il faut prévenir (push « modification_faite »), pas le
-- restaurant. Patch par ancre de resoudre_plats_manquants_core (le fichier
-- 20261020200000_… porte déjà la version finale).
do $$
declare v text;
  a constant text := 'perform public.pousser_notification_commande(v_o.id, ''modification_retiree'');';
begin
  v := pg_get_functiondef('public.resoudre_plats_manquants_core(uuid, text, text, uuid, boolean)'::regprocedure);
  if position('modification_faite' in v) > 0 then return; end if;
  if (length(v) - length(replace(v, a, ''))) / length(a) <> 1 then raise exception 'ancre introuvable'; end if;
  execute replace(v, a,
    'if p_par = ''client'' then
      perform public.pousser_notification_commande(v_o.id, ''modification_retiree'');
    elsif not exists (select 1 from public.commandes_telephone ct where ct.order_id = v_o.id) then
      perform public.pousser_notification_commande(v_o.id, ''modification_faite'');
    end if;');
end $$;
revoke all on function public.resoudre_plats_manquants_core(uuid, text, text, uuid, boolean) from public, anon, authenticated;
