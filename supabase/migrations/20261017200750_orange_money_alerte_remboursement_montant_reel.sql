-- L'alerte de remboursement Orange Money affichait le TOTAL de la commande
-- (amount_ar). Le montant à renvoyer est celui réellement prélevé chez Orange
-- (amount_minor) : identique en production (MGA), différent en bac à sable (plafond 1 000 OUV).
-- Constaté au premier test réel (TF-435, 2026-10-17) : « 43 000 Ar » annoncés pour 1 000 OUV prélevés.
do $$
declare v_def text; v_new text;
begin
  v_def := pg_get_functiondef('public.alerter_remboursement_orange_money()'::regprocedure);
  v_new := replace(v_def,
    $a$public.alerte_ar(new.amount_ar) || ' à renvoyer au client'$a$,
    $b$replace(to_char(new.amount_minor, 'FM999G999G999'), ',', ' ') || ' ' || upper(coalesce(new.currency, 'mga')) || ' à renvoyer au client (prélevé chez Orange)'$b$);
  if v_new = v_def then raise exception 'ancre introuvable'; end if;
  execute v_new;
end $$;
