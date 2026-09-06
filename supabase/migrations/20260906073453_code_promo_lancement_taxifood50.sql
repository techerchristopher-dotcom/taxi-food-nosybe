-- Le code de lancement s'appelle TAXIFOOD50, pas LALIE.
--
-- LALIE etait un nom de travail, choisi avant que le porteur du projet ne
-- tranche. Le renommage avait ete fait a la main en base le 2026-09-06, donc
-- SANS FICHIER : rejouer les migrations depuis zero aurait recree LALIE, et le
-- code communique aux clients au lancement n'aurait pas fonctionne.
--
-- Ecrit de facon idempotente : si la base porte deja TAXIFOOD50 (c'est le cas
-- en production), cette migration ne fait rien.
--
-- `code_normalise` est une colonne generee : elle suit toute seule.
update public.promo_codes
   set code = 'TAXIFOOD50'
 where code = 'LALIE';
